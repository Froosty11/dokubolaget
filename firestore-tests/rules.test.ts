// Firestore rules tests. Run with `bun run test` in this folder; it starts the
// Firestore emulator (needs Java) and runs these against ../firestore.rules.

import { afterAll, beforeAll, beforeEach, describe, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { arrayUnion, collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

function utcDateKey(offsetDays: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays))
    .toISOString()
    .slice(0, 10);
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dokubolaget",
    firestore: { rules: readFileSync(resolve(import.meta.dir, "../firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "boards", utcDateKey(0)), { rows: [], cols: [] });
    await setDoc(doc(db, "boards", utcDateKey(1)), { rows: [], cols: [] });
    await setDoc(doc(db, "users", "alice"), { displayName: "Alice", totalScore: 10 });
    await setDoc(doc(db, "users", "alice", "private", "profile"), { gameCells: [1] });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();

describe("boards", () => {
  test("today's board is readable, tomorrow's is not", async () => {
    await assertSucceeds(getDoc(doc(anon(), "boards", utcDateKey(0))));
    await assertFails(getDoc(doc(anon(), "boards", utcDateKey(1))));
  });
  test("boards can't be listed or written by clients", async () => {
    await assertFails(getDocs(collection(anon(), "boards")));
    await assertFails(setDoc(doc(alice(), "boards", utcDateKey(0)), { rows: [] }));
  });
  test("malformed board ids are rejected", async () => {
    await assertFails(getDoc(doc(anon(), "boards", "latest")));
  });
});

describe("users (public leaderboard profile)", () => {
  test("anyone can read and list with a small limit", async () => {
    await assertSucceeds(getDoc(doc(anon(), "users", "alice")));
    await assertSucceeds(getDocs(query(collection(anon(), "users"), limit(20))));
  });
  test("unbounded or large listing is rejected", async () => {
    await assertFails(getDocs(collection(anon(), "users")));
    await assertFails(getDocs(query(collection(anon(), "users"), limit(1000))));
  });
  test("a new player can create their profile with a nickname", async () => {
    await assertSucceeds(setDoc(doc(bob(), "users", "bob"), { displayName: "Bobban" }));
  });
  test("an email address is never accepted as a display name", async () => {
    await assertFails(setDoc(doc(bob(), "users", "bob"), { displayName: "bob@example.com" }));
    await assertFails(updateDoc(doc(alice(), "users", "alice"), { displayName: "alice@example.com" }));
  });
  test("owner can rename, but not write scores or streaks", async () => {
    await assertSucceeds(updateDoc(doc(alice(), "users", "alice"), { displayName: "Alicia" }));
    await assertFails(updateDoc(doc(alice(), "users", "alice"), { totalScore: 999999 }));
    await assertFails(
      setDoc(doc(alice(), "users", "alice"), { currentStreak: 500 }, { merge: true }),
    );
    await assertFails(setDoc(doc(bob(), "users", "bob"), { displayName: "Bob", totalScore: 5 }));
  });
  test("nobody can write another player's profile", async () => {
    await assertFails(updateDoc(doc(bob(), "users", "alice"), { displayName: "Hacked" }));
  });
});

describe("users/{uid}/private", () => {
  test("only the owner can read and write their private profile", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users", "alice", "private", "profile")));
    await assertSucceeds(
      setDoc(doc(alice(), "users", "alice", "private", "profile"), { gameCells: [1, 2], currentCell: null, theme: "modern" }, { merge: true }),
    );
    await assertFails(getDoc(doc(bob(), "users", "alice", "private", "profile")));
    await assertFails(getDoc(doc(anon(), "users", "alice", "private", "profile")));
  });
  test("theme prefs accept known ids only", async () => {
    const ref = doc(alice(), "users", "alice", "private", "profile");
    await assertSucceeds(setDoc(ref, { theme: "cyberwave", unlockedThemes: ["cyberwave", "speakeasy"] }, { merge: true }));
    await assertFails(setDoc(ref, { theme: "hacker" }, { merge: true }));
    await assertFails(setDoc(ref, { unlockedThemes: ["cyberwave", "free-money"] }, { merge: true }));
    await assertFails(setDoc(ref, { unlockedThemes: "cyberwave" }, { merge: true }));
  });
  test("unlocks written as a union are accepted and validated", async () => {
    const ref = doc(alice(), "users", "alice", "private", "profile");
    await assertSucceeds(setDoc(ref, { theme: "prislista", unlockedThemes: arrayUnion("cyberwave") }, { merge: true }));
    await assertFails(setDoc(ref, { unlockedThemes: arrayUnion("free-money") }, { merge: true }));
  });
  test("unknown private fields are rejected", async () => {
    await assertFails(
      setDoc(doc(alice(), "users", "alice", "private", "profile"), { totalScore: 1 }, { merge: true }),
    );
  });
});

describe("appConfig Systembolaget key cache", () => {
  const keyDoc = (db: any) => doc(db, "appConfig", "dokubolagetSystembolagetApi");
  const valid = { apiKey: "8d39" + "a".repeat(28), source: "scraper", updatedAt: new Date().toISOString() };

  test("signed-in players can read and refresh with a plausible key", async () => {
    await assertSucceeds(setDoc(keyDoc(alice()), valid, { merge: true }));
    await assertSucceeds(getDoc(keyDoc(alice())));
  });
  test("anonymous players can't read or write it", async () => {
    await assertFails(getDoc(keyDoc(anon())));
    await assertFails(setDoc(keyDoc(anon()), valid));
  });
  test("junk keys and extra fields are rejected", async () => {
    await assertFails(setDoc(keyDoc(alice()), { ...valid, apiKey: "<script>" }));
    await assertFails(setDoc(keyDoc(alice()), { ...valid, extra: true }));
  });
});

describe("everything else", () => {
  test("is closed", async () => {
    await assertFails(getDoc(doc(anon(), "leaderboard", "x")));
    await assertFails(setDoc(doc(alice(), "scores", "x"), { a: 1 }));
  });
});
