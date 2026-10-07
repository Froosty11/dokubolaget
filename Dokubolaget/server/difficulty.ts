// Rolls up the real play recorded in cell_results into an observed difficulty
// signal: how often players who engaged a cell actually solved it. The board
// generator reads a snapshot of this to tune future boards toward a consistent,
// mostly-solvable difficulty (see scripts/generateBoard.ts, server.js nightly).
//
// Only real daily plays count (practice = 0), over a trailing window. A pair is
// a row tag crossed with a column tag (pairKey = sorted "a|b"), so each pair's
// numbers are attributed to both of its tags.
//
// The pure scoring model (types, constants, board-selection math) lives in
// ./difficultyModel so the type-checked generator can import it without Bun.
import type { Database } from "bun:sqlite";
import { addDays } from "../src/gameDay";
import { DEFAULT_WINDOW_DAYS, type DifficultyStats, type PairStat, type TagStat } from "./difficultyModel";

export * from "./difficultyModel";

export function computeDifficultyStats(
  db: Database,
  opts: { today: string; windowDays?: number },
): DifficultyStats {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = addDays(opts.today, -windowDays);

  const rows = db
    .query(
      `SELECT pair_key AS pairKey,
              COUNT(*) AS attempts,
              SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) AS solved,
              SUM(misses) AS misses
       FROM cell_results
       WHERE practice = 0 AND day >= ?
       GROUP BY pair_key`,
    )
    .all(cutoff) as Array<{ pairKey: string; attempts: number; solved: number; misses: number }>;

  const pairs: Record<string, PairStat> = {};
  const tagAcc: Record<string, { attempts: number; solved: number; misses: number }> = {};

  for (const row of rows) {
    const tags = row.pairKey.split("|");
    if (tags.length !== 2) continue; // defensive: tag ids never contain "|"
    pairs[row.pairKey] = {
      attempts: row.attempts,
      solved: row.solved,
      solveRate: row.attempts ? row.solved / row.attempts : 0,
    };
    for (const tag of tags) {
      const acc = (tagAcc[tag] ??= { attempts: 0, solved: 0, misses: 0 });
      acc.attempts += row.attempts;
      acc.solved += row.solved;
      acc.misses += row.misses;
    }
  }

  const tags: Record<string, TagStat> = {};
  for (const [id, acc] of Object.entries(tagAcc)) {
    tags[id] = {
      attempts: acc.attempts,
      solved: acc.solved,
      solveRate: acc.attempts ? acc.solved / acc.attempts : 0,
      avgMisses: acc.attempts ? acc.misses / acc.attempts : 0,
    };
  }

  return { generatedAt: new Date().toISOString(), windowDays, tags, pairs };
}
