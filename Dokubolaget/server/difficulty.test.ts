import { beforeEach, expect, test } from "bun:test";
import { openDb } from "./db";
import { computeDifficultyStats } from "./difficulty";

let db: ReturnType<typeof openDb>;
let player = 0;

// One engaged cell: a row in cell_results for some player. A product id means
// solved; null means they tried and never got it.
function result(opts: { pair: string; solved: boolean; misses?: number; day?: string; practice?: boolean }) {
  player += 1;
  db.run(
    "INSERT INTO cell_results (day, player, cell, practice, pair_key, product_id, misses, played_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      opts.day ?? "2026-10-01",
      `p${player}`,
      1,
      opts.practice ? 1 : 0,
      opts.pair,
      opts.solved ? "x" : null,
      opts.misses ?? 0,
      opts.day ?? "2026-10-01",
    ],
  );
}

beforeEach(() => {
  db = openDb(":memory:");
  player = 0;
});

test("aggregates solve rate per pair", () => {
  result({ pair: "A|B", solved: true });
  result({ pair: "A|B", solved: true });
  result({ pair: "A|B", solved: true });
  result({ pair: "A|B", solved: false });

  const stats = computeDifficultyStats(db, { today: "2026-10-02" });

  expect(stats.pairs["A|B"]).toEqual({ attempts: 4, solved: 3, solveRate: 0.75 });
});

test("attributes a pair to both of its tags", () => {
  result({ pair: "A|B", solved: true });
  result({ pair: "A|B", solved: false });

  const stats = computeDifficultyStats(db, { today: "2026-10-02" });

  expect(stats.tags["A"].solveRate).toBe(0.5);
  expect(stats.tags["B"].solveRate).toBe(0.5);
  expect(stats.tags["A"].attempts).toBe(2);
});

test("excludes practice and out-of-window rows", () => {
  result({ pair: "A|B", solved: true });
  result({ pair: "A|B", solved: false });
  result({ pair: "A|B", solved: true, practice: true });
  result({ pair: "A|B", solved: true, day: "2026-01-01" });

  const stats = computeDifficultyStats(db, { today: "2026-10-02", windowDays: 90 });

  expect(stats.pairs["A|B"]).toEqual({ attempts: 2, solved: 1, solveRate: 0.5 });
});

test("records average misses per tag", () => {
  result({ pair: "A|B", solved: false, misses: 0 });
  result({ pair: "A|B", solved: false, misses: 2 });
  result({ pair: "A|B", solved: true, misses: 4 });

  const stats = computeDifficultyStats(db, { today: "2026-10-02" });

  expect(stats.tags["A"].avgMisses).toBe(2);
});
