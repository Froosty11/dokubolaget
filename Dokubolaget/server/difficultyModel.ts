// Pure difficulty model: types, constants and the board-selection math shared
// between the nightly rollup (server/difficulty.ts) and the board generator
// (scripts/generateBoard.ts). Kept free of any Bun/runtime imports so the
// type-checked generator can import it without pulling in bun:sqlite.

export type TagStat = { attempts: number; solved: number; solveRate: number; avgMisses: number };
export type PairStat = { attempts: number; solved: number; solveRate: number };
export type DifficultyStats = {
  generatedAt: string;
  windowDays: number;
  tags: Record<string, TagStat>;
  pairs: Record<string, PairStat>;
};

export const DEFAULT_WINDOW_DAYS = 90;
// Target solve rate for a board's hardest ("trap") cell: consistently
// challenging but beatable.
export const TARGET_BAND = { low: 0.45, high: 0.75 };
// Attempts at which an observed tag rate is fully trusted (blended in below).
export const N_FULL = 50;
// Attempts at which a specific pair's own observed rate overrides the per-tag
// estimate (captures interactions the per-tag model misses).
export const MIN_PAIR = 30;
// Score added for an in-band board; drift out of band bleeds it away. Sized to
// steer tie-breaking among already-beatable candidates, not to override the
// hard guardrails that run before scoring.
export const BAND_WEIGHT = 80;
const BAND_PENALTY = 300;

type CellTag = { id: string; structural: number };
type Cell = { a: CellTag; b: CellTag };

// Blended hardness (0 easy .. 1 hard) for a tag: the observed miss rate,
// trusted in proportion to sample size, otherwise the structural guess.
export function tagHardness(tagId: string, structural: number, stats: DifficultyStats | null): number {
  const t = stats?.tags[tagId];
  if (!t || t.attempts === 0) return structural;
  const w = Math.min(1, t.attempts / N_FULL);
  return w * (1 - t.solveRate) + (1 - w) * structural;
}

// Predicted solve rate for one cell. A well-sampled pair uses its own observed
// rate; otherwise the two tags act as independent filters.
export function cellSolveRate(a: CellTag, b: CellTag, stats: DifficultyStats | null): number {
  const pair = stats?.pairs[[a.id, b.id].sort().join("|")];
  if (pair && pair.attempts >= MIN_PAIR) return pair.solveRate;
  const rate = (1 - tagHardness(a.id, a.structural, stats)) * (1 - tagHardness(b.id, b.structural, stats));
  return Math.max(0.01, rate);
}

// Reward a board whose hardest cell sits in the target band; penalize linearly
// as it drifts out.
export function bandScore(worstSolve: number): number {
  if (worstSolve >= TARGET_BAND.low && worstSolve <= TARGET_BAND.high) return BAND_WEIGHT;
  const dist = worstSolve < TARGET_BAND.low ? TARGET_BAND.low - worstSolve : worstSolve - TARGET_BAND.high;
  return BAND_WEIGHT - dist * BAND_PENALTY;
}

// The generator-facing term: 0 when there's no observed signal for this board
// (so a fresh server generates exactly as before), otherwise the band score of
// its hardest predicted cell.
export function boardBandScore(cells: Cell[], stats: DifficultyStats | null): number {
  if (!stats) return 0;
  const hasSignal = cells.some(
    (c) =>
      (stats.tags[c.a.id]?.attempts ?? 0) > 0 ||
      (stats.tags[c.b.id]?.attempts ?? 0) > 0 ||
      (stats.pairs[[c.a.id, c.b.id].sort().join("|")]?.attempts ?? 0) >= MIN_PAIR,
  );
  if (!hasSignal) return 0;
  let worst = 1;
  for (const c of cells) worst = Math.min(worst, cellSolveRate(c.a, c.b, stats));
  return bandScore(worst);
}
