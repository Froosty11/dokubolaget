import { expect, test } from "bun:test";
import { openDb } from "./db";
import { addDaysUtc, getBoard, putBoard, seedBoards } from "./boards";

const tag = (id: string) => ({ id, label: id, family: "x" });
const board = (n: number) => ({
  rows: [tag(`r${n}a`), tag(`r${n}b`), tag(`r${n}c`)],
  cols: [tag(`c${n}a`), tag(`c${n}b`), tag(`c${n}c`)],
  counts: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
  score: n,
  difficulty: 0.5,
});

test("a board round-trips with flat counts", () => {
  const db = openDb(":memory:");
  putBoard(db, "2026-10-01", board(1));
  const got = getBoard(db, "2026-10-01", "2026-10-01")!;
  expect(got.rows[0].id).toBe("r1a");
  expect(got.counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(got.score).toBe(1);
});

test("future boards are not readable", () => {
  const db = openDb(":memory:");
  putBoard(db, "2026-10-02", board(1));
  expect(getBoard(db, "2026-10-02", "2026-10-01")).toBeNull();
  expect(getBoard(db, "2026-10-02", "2026-10-02")).not.toBeNull();
});

test("malformed dates are refused", () => {
  expect(getBoard(openDb(":memory:"), "latest", "2026-10-01")).toBeNull();
});

test("seeding cycles through the pool and overwrites", () => {
  const db = openDb(":memory:");
  const written = seedBoards(db, [board(1), board(2)], "2026-10-01", 3);
  expect(written).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  expect(getBoard(db, "2026-10-03", "2026-12-31")!.score).toBe(1);
  seedBoards(db, [board(7)], "2026-10-01", 1);
  expect(getBoard(db, "2026-10-01", "2026-12-31")!.score).toBe(7);
});

test("addDaysUtc crosses month ends", () => {
  expect(addDaysUtc("2026-09-30", 1)).toBe("2026-10-01");
});
