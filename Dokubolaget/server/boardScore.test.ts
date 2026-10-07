import { expect, test } from "bun:test";
import { scoreBoard } from "../scripts/generateBoard";
import { BAND_WEIGHT, type DifficultyStats } from "./difficulty";

const tag = (id: string, family = "geography") => ({
  id,
  label: id,
  family,
  support: 100,
  share: 0.1,
  predicate: () => false,
});
const rows = [tag("r0"), tag("r1"), tag("r2")];
const cols = [tag("c0"), tag("c1"), tag("c2")];
const counts = [
  [50, 50, 50],
  [50, 50, 50],
  [50, 50, 50],
];
const args = { seed: "x", minCellMatches: 15, targetLow: 40, targetHigh: 400, attempts: 1, boards: 1 };

function pairsAll(rate: number): DifficultyStats {
  const pairs: Record<string, { attempts: number; solved: number; solveRate: number }> = {};
  for (const r of rows) for (const c of cols) {
    pairs[[r.id, c.id].sort().join("|")] = { attempts: 40, solved: Math.round(40 * rate), solveRate: rate };
  }
  return { generatedAt: "", windowDays: 90, tags: {}, pairs };
}

test("scoreBoard ignores an empty difficulty snapshot (cold-start parity)", () => {
  const base = scoreBoard(counts, rows, cols, { ...args });
  const empty = scoreBoard(counts, rows, cols, {
    ...args,
    difficulty: { generatedAt: "", windowDays: 90, tags: {}, pairs: {} },
  });
  expect(empty).toBe(base);
});

test("scoreBoard rewards a board whose hardest cell is in the solve-rate band", () => {
  const base = scoreBoard(counts, rows, cols, { ...args });
  const inBand = scoreBoard(counts, rows, cols, { ...args, difficulty: pairsAll(0.6) });
  expect(inBand).toBe(base + BAND_WEIGHT);
});

test("scoreBoard ranks an in-band board above a too-hard one", () => {
  const inBand = scoreBoard(counts, rows, cols, { ...args, difficulty: pairsAll(0.6) });
  const tooHard = scoreBoard(counts, rows, cols, { ...args, difficulty: pairsAll(0.05) });
  expect(inBand).toBeGreaterThan(tooHard);
});
