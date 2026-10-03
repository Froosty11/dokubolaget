import { expect, test } from "bun:test";
import { openDb } from "./db";
import { signup } from "./auth";
import { deviceHistoryUnlocks, earnedUnlocks, grantUnlocks, readUnlocks } from "./unlocks";

test("earned themes", () => {
  expect(earnedUnlocks({ finished: false, perfect: false, longestStreak: 0 })).toEqual([]);
  expect(earnedUnlocks({ finished: true, perfect: false, longestStreak: 1 })).toEqual(["cyberwave"]);
  expect(earnedUnlocks({ finished: true, perfect: true, longestStreak: 7 })).toEqual(["cyberwave", "speakeasy", "modern"]);
});

test("grants are added once and keep existing unlocks", async () => {
  const db = openDb(":memory:");
  await signup(db, { email: "a@b.se", password: "hemligt123", nickname: "AA" });
  const id = (db.query("SELECT id FROM users").get() as any).id;
  db.run("INSERT INTO prefs (user_id, theme, unlocked_themes) VALUES (?, 'prislista', '[\"club-tmeit\"]')", [id]);
  expect(grantUnlocks(db, id, ["cyberwave"])).toEqual(["cyberwave"]);
  expect(grantUnlocks(db, id, ["cyberwave", "speakeasy"])).toEqual(["speakeasy"]);
  expect(readUnlocks(db, id).sort()).toEqual(["club-tmeit", "cyberwave", "speakeasy"]);
  expect((db.query("SELECT theme FROM prefs WHERE user_id = ?").get(id) as any).theme).toBe("prislista");
});

test("a device's own finished and perfect days", () => {
  const db = openDb(":memory:");
  const add = (day: string, cell: number, product: string | null, misses: number) =>
    db.run("INSERT INTO cell_results (day, player, cell, practice, pair_key, product_id, misses, played_day) VALUES (?, 'd:dev', ?, 0, 'p', ?, ?, ?)", [day, cell, product, misses, day]);
  for (let cell = 1; cell <= 9; cell += 1) add("2026-09-30", cell, String(cell), cell === 3 ? 1 : 0);
  expect(deviceHistoryUnlocks(db, "dev")).toEqual(["cyberwave"]);
  for (let cell = 1; cell <= 9; cell += 1) add("2026-10-01", cell, String(cell), 0);
  expect(deviceHistoryUnlocks(db, "dev")).toEqual(["cyberwave", "speakeasy"]);
});
