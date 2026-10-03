// Rarity scoring (see docs/superpowers/specs/2026-10-02-scores-design.md).
// Pure, shared by the server (which owns the real numbers) and the app.
import { addDays } from "./gameDay";

export const PRIOR = 3;
export const HISTORY_WEIGHT = 0.5;
export const MISS_COST = 5;
export const MAX_MISS_COST = 20;
export const MIN_SOLVED_SCORE = 10;

export type CellCounts = {
  today: number; // today's players who solved this cell with this bottle (you included)
  todayTotal: number; // today's players who solved this cell
  history: number; // earlier picks of this bottle for the same pair
  historyTotal: number; // earlier solves of the same pair
  answers: number; // the cell's playable answers (V)
};

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export function pickShare(c: CellCounts): number {
  const answers = Math.max(1, c.answers);
  return (c.today + HISTORY_WEIGHT * c.history + PRIOR / answers) / (c.todayTotal + HISTORY_WEIGHT * c.historyTotal + PRIOR);
}

export function cellScore(share: number, misses: number): number {
  const penalty = Math.min(MAX_MISS_COST, MISS_COST * Math.max(0, misses));
  return Math.max(MIN_SOLVED_SCORE, Math.round(100 - 100 * share) - penalty);
}

export function isUnicorn(c: CellCounts): boolean {
  return c.today === 1 && c.history === 0;
}

export function rarityEmoji(cell: { solved: boolean; score: number | null; unicorn?: boolean }): string {
  if (!cell.solved) return "⬛";
  if (cell.unicorn) return "🦄";
  if (cell.score == null) return "🟩";
  return cell.score >= 80 ? "🟪" : cell.score >= 50 ? "🟩" : "🟨";
}

// finishedDays: game days with a finished board (any order, duplicates fine).
export function streaks(finishedDays: string[], today: string): { current: number; longest: number } {
  const days = [...new Set(finishedDays)].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const set = new Set(days);
  const end = set.has(today) ? today : set.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let current = 0;
  for (let day = end; day && set.has(day); day = addDays(day, -1)) current += 1;
  return { current, longest };
}
