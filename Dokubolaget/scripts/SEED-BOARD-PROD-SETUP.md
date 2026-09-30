# Daily Board Cron — Production Setup

End-to-end checklist to get the nightly board pipeline (run by `server.js` inside the Docker container) writing to the production Firestore. Assumes you're starting from a fresh clone with no automation set up yet.

Time estimate: 15–20 minutes the first time.

---

## 1. Build the container

From the repo root:

```bash
cp .env.example .env
docker compose up -d --build
```

The container serves the app on port 8080 and, once the secret in step 3 is in place, runs the board pipeline itself. No external scheduler is needed.

---

## 2. Create a Firebase service account

This is the credential the workflow uses to write to Firestore.

1. Open the [Firebase console](https://console.firebase.google.com/).
2. Pick the Dokubolaget project.
3. ⚙️ (top left) → **Project settings** → **Service accounts** tab.
4. Click **Generate new private key**. Confirm. A JSON file downloads. **Treat this like a password — never commit it.**
5. (Recommended) Scope it down: open the [Google Cloud IAM console](https://console.cloud.google.com/iam-admin/iam) for the same project. Find the service account you just created (looks like `firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com`). Grant it **Cloud Datastore User** only, and remove any broader Firebase Admin / Editor roles. This limits blast radius if the key leaks.

---

## 3. Give the container the secret

1. Open the JSON file from step 2 and collapse it to a single line (e.g. `jq -c . key.json`).
2. In `.env` next to `docker-compose.yml`, set `FIREBASE_SERVICE_ACCOUNT_KEY=` followed by that one-line JSON.
3. `docker compose up -d` to restart with the new environment. Never commit `.env`.

---

## 4. Verify the first run

The container seeds today's and tomorrow's boards as soon as it starts with credentials.

1. `docker compose logs -f` and watch for the `[seed]` lines: catalog download size (~100 MB), tag counts, one board per day with rows/cols, then `Wrote boards/<date>`.
2. `curl localhost:8080/healthz` shows `lastResult` and `nextRunAt`.
3. Open the [Firestore console](https://console.firebase.google.com/) → **Firestore Database** → `boards`. There should be docs for today and tomorrow with `rows`, `cols`, `counts`, `score`, `seed`, `difficulty`, `generatedAt`.

---

## 5. Confirm the app reads from Firestore

The runtime in `Dokubolaget/src/dokuModel.ts` does:

1. Start with a deterministic board from the bundled `data/generated-boards.json` (so first paint is instant and offline-tolerant).
2. Kick off `loadDailyBoardFromFirestore()` in the background — replaces the board with `boards/{today}` if the document exists.

To verify it's actually swapping:

1. Run the app: `bun run dev` from `Dokubolaget/`.
2. Open the page that renders the board.
3. In the browser console: `__sb.model.boardSource` — should read `"firestore"` after the fetch resolves.
4. If it stays `"local"`, check:
   - Is there a `boards/<today>` doc in Firestore? (The workflow seeds **tomorrow**'s board on each run, so the first nightly run only helps users on day N+1.)
   - Open Network tab → look for a Firestore RPC. Watch for permission errors (Firestore rules) or "document does not exist".

---

## 6. Let the timer take over

Nothing more to do. Every night at 00:05 UTC (configurable with `SEED_HOUR_UTC` / `SEED_MINUTE_UTC`) the server downloads the catalog, generates tomorrow's board and writes `boards/<tomorrow>`. A failed run is retried once after 30 minutes and shows up in `/healthz` as `lastError`. The app always falls back to the bundled boards if a day is missing.

---

## 7. Firestore security rules (don't skip)

By default, Firestore in test mode allows anyone with the project ID to read/write everything. The seed workflow needs write to `boards/*` from a service account; the app needs read.

Minimum rule set for `boards/*`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{date} {
      allow read: if true;        // public — every player needs today's board
      allow write: if false;      // only the seed workflow's service account writes
    }
    // ... keep your existing user-doc rules
  }
}
```

The service account bypasses these rules (it's authenticated through the Admin SDK, not as a "user"), so `allow write: if false` does NOT block the workflow. Test this in the Firestore Rules Playground before publishing.

---

## Troubleshooting cheatsheet

| Symptom | Likely cause |
|---|---|
| `/healthz` shows `Catalog download failed` | susbolaget.emrik.org is down. The run retries after 30 minutes and again next night. |
| `/healthz` shows `permission-denied` | The service account doesn't have Cloud Datastore User. Re-check IAM in step 2. |
| Logs say "No Firebase credentials found" | `FIREBASE_SERVICE_ACCOUNT_KEY` is missing from `.env`, or the container wasn't restarted after editing it. |
| Runs report ok but Firestore stays empty | The Firebase project ID embedded in `FIREBASE_SERVICE_ACCOUNT_KEY` doesn't match the project Firestore is in. |
| App's `boardSource` stays `"local"` even after a seed | The current-day doc is missing. The workflow seeds **tomorrow's** board — today's only exists if someone backfilled it (e.g. `seed:firestore --date <today>` from local). |
