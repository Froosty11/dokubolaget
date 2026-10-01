# Own backend: replace Firebase with the container

Date: 2026-10-01
Status: approved in conversation

## Goal

Dokubolaget stops depending on Firebase. The single container becomes the whole backend: accounts, sessions, saved preferences and progress, daily boards and, in the next step, scoring. Data lives in one SQLite file on a Docker volume.

This is step 1 of 3:

1. Backend in the container, which is this spec.
2. Rarity scoring, streaks and the leaderboard, on these tables. That is its own spec.
3. Reminder push notifications.

Success means:

- **No Firebase in the app.** The web bundle contains no Firebase SDK and the app makes no Firebase requests.
- **Accounts work end to end.** A player can sign up with email, password and nickname, stay logged in across reloads, log out, and reset a forgotten password.
- **Theme choice, unlocks and today's progress follow a logged-in player** between devices.
- **Daily boards come from the container.** They are seeded nightly into SQLite with no Firebase key.
- **Data survives a container restart,** and there is a nightly backup copy.

## Decisions (from the user)

- Email + password login. Password reset by email.
- Fresh start: existing Firebase accounts and history are not migrated.
- SQLite file on a volume. No second container.

## Architecture

### Server: one Bun process

- **Modules.** `server.js` stays the entry point. New typed modules under `Dokubolaget/server/` are loaded directly by Bun:
  - `db.ts`: opens SQLite (`bun:sqlite`) and runs migrations.
  - `auth.ts`: password hashing, sessions, password reset.
  - `api.ts`: the `/api` router as a pure function (request in, response out) so it can be tested without HTTP.
  - `boards.ts`: board storage.
  - `mail.ts`: reset emails.
  - `sbKey.ts`: the Systembolaget key.
  - `backup.ts`: the nightly backup.
- **Database file.** `DB_PATH`, default `/data/dokubolaget.sqlite` in the container and `./data/local.sqlite` in development.
- **Runtime.** The container keeps running `bun run server.js`. Node is no longer supported.

### Database

| Table | Columns |
|---|---|
| `users` | `id` (random text), `email` (unique, case-insensitive), `nickname` (unique, case-insensitive, 2–24 characters, no `@ < >`), `password_hash` (argon2id via `Bun.password`), `created_at` |
| `sessions` | `token_hash` (SHA-256 of a 32-byte random token), `user_id`, `created_at`, `expires_at` (90 days) |
| `password_resets` | `token_hash`, `user_id`, `expires_at` (1 hour), `used_at` |
| `prefs` | `user_id`, `theme`, `unlocked_themes` (JSON) |
| `progress` | `user_id`, `date`, `board_key`, `data` (JSON), primary key `(user_id, date)` |
| `boards` | `date` (YYYY-MM-DD, UTC), `rows`, `cols`, `counts` (JSON), `score`, `difficulty`, `created_at` |
| `app_config` | `key`, `value`, `updated_at` (holds the Systembolaget API key) |

Migrations are numbered SQL steps recorded in `schema_version`.

### API (JSON, same origin)

| Method and path | Purpose |
|---|---|
| `POST /api/auth/signup` `{email, password, nickname}` | Creates the account and logs in. Errors: `email_taken`, `nickname_taken`, `weak_password` (fewer than 8 characters), `bad_nickname`, `bad_email`. |
| `POST /api/auth/login` `{email, password}` | Logs in. A wrong email or wrong password gives the same `bad_credentials` error. |
| `POST /api/auth/logout` | Ends the session. |
| `POST /api/auth/reset-request` `{email}` | Always answers `ok`, so it never reveals whether an account exists. Sends a reset email if one does. |
| `POST /api/auth/reset` `{token, password}` | Sets the new password, uses up the token and ends the user's other sessions. |
| `GET /api/me` | Returns `{user: {id, email, nickname} \| null, prefs, progress}` for today. |
| `PATCH /api/me` `{nickname}` | Changes the nickname. |
| `PUT /api/me/prefs` `{theme, unlockedThemes}` | Sets the theme. Unlocks are merged on the server (union), and theme ids are validated. |
| `PUT /api/me/progress` `{date, boardKey, data}` | Saves today's progress. Data is capped at 64 KB. |
| `GET /api/boards/:date` | Returns 404 for missing boards and for dates after today (UTC). |
| `GET /api/sb-key` | Returns the cached public Systembolaget key, scraping a fresh one when it is missing or older than 12 hours. |
| `GET /api/leaderboard` | Returns `{rows: []}` until step 2. |

**Sessions and requests:**

- **Session cookie.** `doku_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 90 days. It is `Secure` when the request came over HTTPS (`X-Forwarded-Proto` with `TRUST_PROXY`).
- **Request checks.** Changing requests must be JSON and come from the app's own `Origin`. During development, `http://localhost:*` origins are also allowed (when `NODE_ENV` is not `production`), with credentialed CORS.
- **Rate limits.** Signup, login and reset requests are limited per client to 10 a minute. Reset requests are also limited to 3 per email per hour.
- **Body size.** Bodies are capped at 64 KB.

### Email

- **With SMTP.** When `SMTP_URL` and `MAIL_FROM` are set, reset emails go out through `nodemailer`, the one new runtime dependency.
- **Without SMTP.** The reset link is written to the container log, so an admin can pass it on.
- **The link.** `{PUBLIC_URL or request origin}/reset-password?token=…`

### Systembolaget key

The server scrapes the key from systembolaget.se itself (the same parsing as the client) and caches it in `app_config`. The app reads it from `/api/sb-key` instead of the Firestore cache document. The native app, which has no proxy, keeps its own scraping as a fallback.

### Boards and seeding

`scripts/seedFirestoreBoard.ts` is replaced by `scripts/seedBoards.ts`, which writes to SQLite through `server/boards.ts`. Seeding no longer needs credentials, so the nightly job always runs unless `SEED_ENABLED=false`.

### Backups

Every night after seeding, the server runs `VACUUM INTO /data/backups/dokubolaget-YYYY-MM-DD.sqlite` and keeps the newest 7.

### App

- **`src/api.ts`.** A fetch client using `credentials: "include"` and a base of `EXPO_PUBLIC_API_BASE`. It defaults to `http://localhost:8080` in development and to the same origin in builds.
- **`src/serverSync.ts`.** Replaces `firestoreModel.ts`. On start and after login or logout it loads `/api/me`, applies the theme data through `applyAccountThemeData`, and restores progress. It saves prefs and progress through reactions, debounced by 800 ms.
- **The model.** It gains `account: {id, email, nickname} | null`.
- **Home** reads the account from the model instead of the Firebase auth observer.
- **The login dialog** gets "Forgot password?", which sends a reset email. A new route, `src/app/reset-password.tsx`, takes the new password.
- **The leaderboard** shows "Scores are coming soon" until step 2.
- **Removed:** `firebase` and `firebase-admin`, `firebaseConfig.ts`, `firestoreModel.ts`, `systembolagetCache.ts`, the parts of `utilities.ts` that use Firebase, `firestore.rules`, `firebase.json`, `firestore-tests/`, `scripts/scrubPublicProfiles.ts` and `scripts/seedFirestoreBoard.ts`. The connect-src rule allowing `*.googleapis.com` is removed from the CSP.

### Docker

- **Volume.** `docker-compose.yml` mounts a named volume `dokubolaget-data` at `/data`.
- **Environment.** `.env.example` documents `SMTP_URL`, `MAIL_FROM` and `PUBLIC_URL`. The Firebase variables are removed.
- **Image.** The runtime installs `nodemailer` instead of `firebase-admin` and copies `server/`.

## Error handling

- The API answers `{error: code}` with the right status: 400, 401, 403, 404, 409 or 429. Unexpected errors give 500 with no details and are logged.
- The app shows friendly text for each error code.
- If `/api/me` fails (offline), the app keeps working logged out, using the device's saved theme and progress.

## Testing

- **Server:** Bun tests per module against `:memory:` SQLite:
  - migrations
  - signup and login, including duplicates, bad input and wrong passwords
  - sessions, including expiry and logout
  - the reset flow: one-time use, expiry, and ending other sessions
  - rate limits
  - merging prefs and validating theme ids
  - progress size cap
  - future boards are not readable
  - the origin check
- **App:** the existing tests stay green.
- **Browser check** against the dev server plus the local API:
  - sign up, reload and stay logged in
  - change theme, then log in on a second profile and see it there
  - log out
  - the reset link from the log works
- **Container check:** data survives `docker restart`, and seeding writes a board.

## Out of scope

- Scoring, rarity, streaks and the leaderboard (step 2).
- Push notifications (step 3).
- Email verification at sign-up.
- Migrating Firebase data.
