import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/*
  One-off cleanup of the public users/{uid} profiles, which are world-readable
  for the leaderboard.

  - Replaces any displayName that is an email address (older clients fell back
    to the email when no name was set) with an anonymous "Spelare XXXX".
  - Removes fields older clients left on the public doc (email, gameCells,
    currentCell, score).
  - With --delete-test-users, deletes seeded test profiles (ids like ke_000 or
    fake_001) so they stop topping the leaderboard.

  Dry run by default; pass --apply to write.

    FIREBASE_SERVICE_ACCOUNT_KEY='{...}' bun run scripts/scrubPublicProfiles.ts
    FIREBASE_SERVICE_ACCOUNT_KEY='{...}' bun run scripts/scrubPublicProfiles.ts --apply --delete-test-users
*/

const LEGACY_PUBLIC_FIELDS = ["email", "gameCells", "currentCell", "score"];
const TEST_USER_ID = /^(ke|fake)_\d+$/;
const VALID_NAME = /^[^@<>]{2,24}$/;

function initFirebase() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson) as ServiceAccount) });
    return;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp();
    return;
  }
  throw new Error(
    "Set FIREBASE_SERVICE_ACCOUNT_KEY (JSON contents) or GOOGLE_APPLICATION_CREDENTIALS (path).",
  );
}

function fallbackName(uid: string) {
  return "Spelare " + uid.slice(0, 4).toUpperCase();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const deleteTestUsers = process.argv.includes("--delete-test-users");

  initFirebase();
  const db = getFirestore();
  const snapshot = await db.collection("users").get();

  let renamed = 0;
  let cleaned = 0;
  let deleted = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const uid = docSnap.id;

    if (deleteTestUsers && TEST_USER_ID.test(uid)) {
      console.log(`delete  ${uid}`);
      deleted += 1;
      if (apply) await db.recursiveDelete(docSnap.ref);
      continue;
    }

    const update: Record<string, unknown> = {};
    const name = typeof data.displayName === "string" ? data.displayName.trim() : "";
    if (!VALID_NAME.test(name)) {
      update.displayName = fallbackName(uid);
      renamed += 1;
      // Log only the uid: the point is to stop exposing the old value.
      console.log(`rename  ${uid} -> ${update.displayName}`);
    }
    for (const field of LEGACY_PUBLIC_FIELDS) {
      if (field in data) update[field] = FieldValue.delete();
    }
    if (Object.keys(update).length === 0) continue;
    if (!("displayName" in update)) {
      cleaned += 1;
      console.log(`clean   ${uid} (legacy fields)`);
    }
    if (apply) await docSnap.ref.update(update);
  }

  console.log(
    `\n${apply ? "Applied" : "Dry run"}: ${renamed} renamed, ${cleaned} cleaned, ${deleted} deleted, ${snapshot.size} scanned.`,
  );
  if (!apply) console.log("Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
