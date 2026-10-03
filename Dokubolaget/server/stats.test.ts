import { beforeEach, expect, test } from "bun:test";
import { join } from "path";
import { openDb } from "./db";
import { putBoard } from "./boards";
import { createCatalog } from "./catalog";
import { createPlay } from "./play";
import { signup } from "./auth";
import { archiveMonth, catchUpFreeze, freezeDay, leaderboard, liveDayScores, userStats } from "./stats";

const T = (id: string) => ({ id, label: id, family: "f" });
const BOARD = {
  rows: [T("Country:Spanien"), T("Country:Frankrike"), T("Country:Sverige")],
  cols: [T("Beverage:Rött vin"), T("Beverage:Vitt vin"), T("Beverage:Rosévin")],
  counts: [[200, 50, 10], [100, 80, 5], [20, 30, 5]],
};

let db: ReturnType<typeof openDb>;
let clock: Date;
let play: ReturnType<typeof createPlay>;
let anna: string;
let bo: string;

// Writes a finished (or partial) board straight into cell_results.
function playDay(player: string, day: string, solved: number, misses = 0) {
  for (let cell = 1; cell <= 9; cell += 1) {
    db.run(
      "INSERT INTO cell_results (day, player, cell, practice, pair_key, product_id, misses, played_day) VALUES (?, ?, ?, 0, ?, ?, ?, ?)",
      [day, player, cell, `pair${cell}`, cell <= solved ? `p${cell}` : null, cell === 1 ? misses : 0, day],
    );
  }
}

beforeEach(async () => {
  db = openDb(":memory:");
  clock = new Date("2026-10-02T12:00:00Z");
  for (const day of ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]) putBoard(db, day, BOARD);
  play = createPlay({ db, catalog: createCatalog({ path: join(import.meta.dir, "fixtures", "products.json") }), now: () => clock, cacheMs: 0 });
  await signup(db, { email: "anna@x.se", password: "hemligt123", nickname: "Anna" });
  await signup(db, { email: "bo@x.se", password: "hemligt123", nickname: "Bo" });
  [anna, bo] = (db.query("SELECT id FROM users ORDER BY nickname").all() as any[]).map((r) => r.id);
});

test("live scores rank logged-in players only", () => {
  playDay(`u:${anna}`, "2026-10-02", 9);
  playDay(`u:${bo}`, "2026-10-02", 4);
  playDay("d:someone", "2026-10-02", 9);
  const scores = liveDayScores(db, play, "2026-10-02");
  expect(scores.map((s) => s.userId).sort()).toEqual([anna, bo].sort());
  expect(scores.find((s) => s.userId === anna)!.finished).toBe(true);
});

test("freezing is idempotent and catches up on missed days", () => {
  playDay(`u:${anna}`, "2026-09-30", 9);
  playDay(`u:${anna}`, "2026-10-01", 9);
  expect(catchUpFreeze(db, play, "2026-10-02")).toEqual(["2026-09-30", "2026-10-01"]);
  expect(catchUpFreeze(db, play, "2026-10-02")).toEqual([]);
  freezeDay(db, play, "2026-10-01");
  expect((db.query("SELECT COUNT(*) AS n FROM daily_scores").get() as any).n).toBe(2);
});

test("streaks: current and longest from frozen days plus today", () => {
  for (const day of ["2026-09-25", "2026-09-26", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]) playDay(`u:${anna}`, day, 9);
  catchUpFreeze(db, play, "2026-10-02");
  expect(userStats(db, play, anna, "2026-10-02")).toMatchObject({ currentStreak: 4, longestStreak: 4, finishedCount: 6 });
  playDay(`u:${anna}`, "2026-10-02", 9);
  expect(userStats(db, play, anna, "2026-10-02")).toMatchObject({ currentStreak: 5, longestStreak: 5 });
});

test("leaderboards: today, yesterday, week, all time and streaks, with your own row", () => {
  playDay(`u:${anna}`, "2026-10-01", 9);
  playDay(`u:${bo}`, "2026-10-01", 3);
  catchUpFreeze(db, play, "2026-10-02");
  playDay(`u:${bo}`, "2026-10-02", 9);
  const today = leaderboard(db, play, "today", "2026-10-02", anna);
  expect(today.provisional).toBe(true);
  expect(today.rows.map((r) => r.nickname)).toEqual(["Bo"]);
  expect(today.me).toBeNull();
  const yesterday = leaderboard(db, play, "yesterday", "2026-10-02", bo);
  expect(yesterday.rows[0].nickname).toBe("Anna");
  expect(yesterday.me!.nickname).toBe("Bo");
  expect(leaderboard(db, play, "week", "2026-10-02", null).rows.length).toBe(2);
  expect(leaderboard(db, play, "all", "2026-10-02", null).rows[0].nickname).toBe("Anna");
  const streak = leaderboard(db, play, "streak", "2026-10-02", null);
  expect(streak.rows.map((r) => [r.nickname, r.value])).toEqual([["Anna", 1], ["Bo", 1]]);
});

test("nobody played: empty lists, no errors (review focus 4)", () => {
  for (const period of ["today", "yesterday", "week", "all", "streak"] as const) {
    expect(leaderboard(db, play, period, "2026-10-02", anna)).toMatchObject({ rows: [], me: null });
  }
  expect(userStats(db, play, anna, "2026-10-02")).toEqual({ currentStreak: 0, longestStreak: 0, finishedCount: 0, unicorns: 0 });
});

test("a deleted user disappears from the boards (review focus 5)", () => {
  playDay(`u:${anna}`, "2026-10-01", 9);
  catchUpFreeze(db, play, "2026-10-02");
  db.run("DELETE FROM cell_results WHERE player = ?", [`u:${anna}`]);
  db.run("DELETE FROM users WHERE id = ?", [anna]);
  expect(leaderboard(db, play, "all", "2026-10-02", null).rows).toEqual([]);
});

test("archive month: past days with boards and your result", () => {
  playDay(`u:${anna}`, "2026-09-30", 9);
  catchUpFreeze(db, play, "2026-10-02");
  const september = archiveMonth(db, play, "2026-09", "2026-10-02", [`u:${anna}`], anna);
  expect(september.map((d) => d.day)).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"]);
  expect(september.find((d) => d.day === "2026-09-30")!.result).toMatchObject({ solved: 9, finished: true });
  expect(september.find((d) => d.day === "2026-09-29")!.result).toBeNull();
  expect(archiveMonth(db, play, "2026-10", "2026-10-02", [], null).map((d) => d.day)).toEqual(["2026-10-01"]);
});

test("streak leaderboard ranks ties by longest streak (fix round 1 finding)", () => {
  for (const day of ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]) {
    putBoard(db, day, BOARD);
    playDay(`u:${anna}`, day, 9);
  }
  for (const day of ["2026-09-30", "2026-10-01"]) {
    playDay(`u:${anna}`, day, 9);
    playDay(`u:${bo}`, day, 9);
  }
  catchUpFreeze(db, play, "2026-10-02");
  const streak = leaderboard(db, play, "streak", "2026-10-02", null);
  expect(streak.rows.map((r) => [r.nickname, r.rank, r.value, r.longest])).toEqual([
    ["Anna", 1, 2, 10],
    ["Bo", 2, 2, 2],
  ]);
});

test("a broken streak still gets your own row at zero (fix round 1 ruling)", () => {
  for (const day of ["2026-09-01", "2026-09-02", "2026-09-03"]) {
    putBoard(db, day, BOARD);
    playDay(`u:${bo}`, day, 9);
  }
  playDay(`u:${anna}`, "2026-10-01", 9);
  catchUpFreeze(db, play, "2026-10-02");
  const streak = leaderboard(db, play, "streak", "2026-10-02", bo);
  expect(streak.rows.map((r) => r.nickname)).toEqual(["Anna"]);
  expect(streak.me).toEqual({ rank: 2, nickname: "Bo", value: 0, longest: 3 });
});
