import { expect, test } from "bun:test";
import {
  BAND_WEIGHT,
  bandScore,
  boardBandScore,
  cellSolveRate,
  tagHardness,
  type DifficultyStats,
} from "./difficulty";

function stats(partial: Partial<DifficultyStats>): DifficultyStats {
  return { generatedAt: "", windowDays: 90, tags: {}, pairs: {}, ...partial };
}

const cell = (aId: string, bId: string, aStruct = 0, bStruct = 0) => ({
  a: { id: aId, structural: aStruct },
  b: { id: bId, structural: bStruct },
});

test("tagHardness falls back to the structural guess with no data", () => {
  expect(tagHardness("X", 0.5, null)).toBe(0.5);
  expect(tagHardness("X", 0.5, stats({}))).toBe(0.5);
});

test("tagHardness fully trusts a well-sampled tag", () => {
  const s = stats({ tags: { X: { attempts: 50, solved: 10, solveRate: 0.2, avgMisses: 1 } } });
  expect(tagHardness("X", 0.3, s)).toBeCloseTo(0.8, 5); // 1 - 0.2
});

test("tagHardness blends a lightly-sampled tag with the structural guess", () => {
  const s = stats({ tags: { X: { attempts: 25, solved: 5, solveRate: 0.2, avgMisses: 1 } } });
  // w = 25/50 = 0.5; 0.5*0.8 + 0.5*0.4 = 0.6
  expect(tagHardness("X", 0.4, s)).toBeCloseTo(0.6, 5);
});

test("cellSolveRate uses the per-pair rate when the pair is well-sampled", () => {
  const s = stats({ pairs: { "A|B": { attempts: 40, solved: 24, solveRate: 0.6 } } });
  expect(cellSolveRate(cell("A", "B").a, cell("A", "B").b, s)).toBe(0.6);
});

test("cellSolveRate multiplies tag solve rates when the pair is sparse", () => {
  const c = cell("A", "B", 0.5, 0.5);
  // no observed data: (1-0.5)*(1-0.5) = 0.25
  expect(cellSolveRate(c.a, c.b, stats({}))).toBeCloseTo(0.25, 5);
});

test("bandScore rewards the target band and penalizes drift", () => {
  expect(bandScore(0.6)).toBe(BAND_WEIGHT);
  expect(bandScore(0.45)).toBe(BAND_WEIGHT);
  expect(bandScore(0.35)).toBeLessThan(BAND_WEIGHT);
  expect(bandScore(0.95)).toBeLessThan(bandScore(0.8));
});

test("boardBandScore is zero without any observed signal", () => {
  const cells = [cell("A", "B", 0.5, 0.5), cell("C", "D", 0.5, 0.5)];
  expect(boardBandScore(cells, null)).toBe(0);
  expect(boardBandScore(cells, stats({}))).toBe(0);
});

test("boardBandScore ranks an in-band board above an out-of-band one", () => {
  const inBand = [cell("A", "B"), cell("C", "D")];
  const outBand = [cell("E", "F"), cell("G", "H")];
  const s = stats({
    pairs: {
      "A|B": { attempts: 40, solved: 24, solveRate: 0.6 },
      "C|D": { attempts: 40, solved: 26, solveRate: 0.65 },
      "E|F": { attempts: 40, solved: 36, solveRate: 0.9 },
      "G|H": { attempts: 40, solved: 4, solveRate: 0.1 },
    },
  });
  expect(boardBandScore(inBand, s)).toBeGreaterThan(boardBandScore(outBand, s));
  expect(boardBandScore(inBand, s)).toBe(BAND_WEIGHT);
});
