// The server's side of the game: rules on guesses, keeps one row per player
// per cell, and computes rarity scores from today's picks plus earlier boards
// with the same pair of categories.
import type { Database } from "bun:sqlite";
import { doesProductMatchTagId } from "../src/boardTags";
import { gameDay } from "../src/gameDay";
import { cellScore, isUnicorn, pairKey, pickShare } from "../src/scoring";
import { ApiError } from "./auth";
import { getBoard, type StoredBoard } from "./boards";
import type { Catalog, CatalogProduct } from "./catalog";
import { nowIso } from "./db";

export type CellResult = {
  cell: number; productNumber: string | null; product: CatalogProduct | null;
  misses: number; score: number | null; share: number | null; unicorn: boolean;
};
export type BoardResult = {
  day: string; cells: CellResult[]; score: number; solved: number; misses: number;
  unicorns: number; finished: boolean; perfect: boolean;
};
export type GuessVerdict = "correct" | "near" | "miss" | "rejected";
export type GuessOutcome = { verdict: GuessVerdict; reason?: "already_used" | "not_playable"; usedInCell?: number; matchedTagId?: string };
export type CellAnswers = {
  cell: number; solvedShare: number;
  top: Array<{ productNumber: string; name: string; share: number }>;
  rarest: { productNumber: string; name: string; share: number } | null;
  mine: string | null;
};

type BoardCell = { cell: number; rowTag: string; colTag: string; pair: string; answers: number };
type PairCounts = { today: Map<string, number>; todayTotal: number; history: Map<string, number>; historyTotal: number };

function boardCells(board: StoredBoard): BoardCell[] {
  const cells: BoardCell[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const rowTag = board.rows[row].id;
      const colTag = board.cols[col].id;
      cells.push({ cell: row * 3 + col + 1, rowTag, colTag, pair: pairKey(rowTag, colTag), answers: board.counts?.[row * 3 + col] ?? 50 });
    }
  }
  return cells;
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

export function createPlay(deps: { db: Database; catalog: Catalog; now?: () => Date; cacheMs?: number }) {
  const { db, catalog } = deps;
  const now = deps.now ?? (() => new Date());
  const cacheMs = deps.cacheMs ?? 30_000;
  const cache = new Map<string, { at: number; counts: Map<string, PairCounts> }>();
  const today = () => gameDay(now());

  function boardFor(day: string): StoredBoard {
    const board = getBoard(db, day, today());
    if (!board || board.rows.length !== 3 || board.cols.length !== 3) throw new ApiError(404, "not_found");
    return board;
  }

  function computeCounts(day: string, cells: BoardCell[]) {
    const pairs = cells.map((c) => c.pair);
    const result = new Map<string, PairCounts>(pairs.map((pair) => [pair, { today: new Map(), todayTotal: 0, history: new Map(), historyTotal: 0 }]));
    const todayRows = db
      .query(`SELECT pair_key, product_id, COUNT(*) AS n FROM cell_results
              WHERE day = ? AND practice = 0 AND product_id IS NOT NULL AND pair_key IN (${placeholders(pairs.length)})
              GROUP BY pair_key, product_id`)
      .all(day, ...pairs) as Array<{ pair_key: string; product_id: string; n: number }>;
    // History: everything guessed before this day for the same pair, except a
    // practice row from a player who also solved that cell for real.
    const historyRows = db
      .query(`SELECT r.pair_key, r.product_id, COUNT(*) AS n FROM cell_results r
              WHERE r.pair_key IN (${placeholders(pairs.length)}) AND r.played_day < ? AND r.product_id IS NOT NULL
                AND NOT (r.practice = 1 AND EXISTS (
                  SELECT 1 FROM cell_results x WHERE x.day = r.day AND x.player = r.player AND x.cell = r.cell
                    AND x.practice = 0 AND x.product_id IS NOT NULL))
              GROUP BY r.pair_key, r.product_id`)
      .all(...pairs, day) as Array<{ pair_key: string; product_id: string; n: number }>;
    for (const row of todayRows) {
      const counts = result.get(row.pair_key)!;
      counts.today.set(row.product_id, row.n);
      counts.todayTotal += row.n;
    }
    for (const row of historyRows) {
      const counts = result.get(row.pair_key)!;
      counts.history.set(row.product_id, row.n);
      counts.historyTotal += row.n;
    }
    return result;
  }

  function countsFor(day: string, cells: BoardCell[]) {
    const hit = cache.get(day);
    if (hit && cacheMs > 0 && now().getTime() - hit.at < cacheMs) return hit.counts;
    const counts = computeCounts(day, cells);
    cache.set(day, { at: now().getTime(), counts });
    return counts;
  }

  function scoreFor(counts: PairCounts, answers: number, productNumber: string, misses: number, practice: boolean) {
    // A practice pick isn't in today's counts; score it as if it were.
    const self = practice ? 1 : 0;
    const c = {
      today: (counts.today.get(productNumber) ?? 0) + self,
      todayTotal: counts.todayTotal + self,
      history: counts.history.get(productNumber) ?? 0,
      historyTotal: counts.historyTotal,
      answers,
    };
    const share = pickShare(c);
    return { share, score: cellScore(share, misses), unicorn: isUnicorn(c) };
  }

  function playerBoard(day: string, players: string[], practice = false): BoardResult {
    const cells = boardCells(boardFor(day));
    const counts = countsFor(day, cells);
    const rows = players.length
      ? (db
          .query(`SELECT cell, product_id, misses FROM cell_results WHERE day = ? AND practice = ? AND player IN (${placeholders(players.length)})`)
          .all(day, practice ? 1 : 0, ...players) as Array<{ cell: number; product_id: string | null; misses: number }>)
      : [];
    const byCell = new Map<number, { productNumber: string | null; misses: number }>();
    for (const row of rows) {
      const previous = byCell.get(row.cell);
      byCell.set(row.cell, {
        productNumber: previous?.productNumber ?? row.product_id ?? null,
        misses: Math.max(previous?.misses ?? 0, row.misses),
      });
    }
    const results: CellResult[] = cells.map((c) => {
      const mine = byCell.get(c.cell);
      if (!mine?.productNumber) {
        return { cell: c.cell, productNumber: null, product: null, misses: mine?.misses ?? 0, score: null, share: null, unicorn: false };
      }
      const scored = scoreFor(counts.get(c.pair)!, c.answers, mine.productNumber, mine.misses, practice);
      return { cell: c.cell, productNumber: mine.productNumber, product: catalog.getKnown(mine.productNumber), misses: mine.misses, ...scored };
    });
    const solved = results.filter((r) => r.productNumber).length;
    const misses = results.reduce((sum, r) => sum + r.misses, 0);
    return {
      day,
      cells: results,
      score: results.reduce((sum, r) => sum + (r.score ?? 0), 0),
      solved,
      misses,
      unicorns: results.filter((r) => r.unicorn).length,
      finished: solved === 9,
      perfect: solved === 9 && misses === 0,
    };
  }

  // What "replaying the same guess id" resolves to, read fresh: correct if
  // the cell ended up solved with this product, otherwise miss. Used both by
  // the fast pre-check and, authoritatively, inside the write transaction
  // (where a concurrent in-flight duplicate may only just have landed).
  function cellRow(day: string, player: string, cell: number, flag: number) {
    return db
      .query("SELECT product_id FROM cell_results WHERE day = ? AND player = ? AND cell = ? AND practice = ?")
      .get(day, player, cell, flag) as { product_id: string | null } | null;
  }

  async function recordGuess(
    player: string,
    input: { id: string; day: string; cell: number; productNumber: string; practice: boolean },
  ): Promise<GuessOutcome> {
    const { id, day, cell, productNumber, practice } = input;
    if (!practice && day !== today()) throw new ApiError(400, "day_over");
    if (practice && day >= today()) throw new ApiError(400, "bad_request");
    const target = boardCells(boardFor(day))[cell - 1];
    const flag = practice ? 1 : 0;
    const seenId = `${player}:${id}`;

    // Fast pre-checks, before the (possibly slow) catalog lookup: skip it
    // outright when the answer is already known. These are optimizations
    // only — everything here is re-checked fresh inside the transaction
    // below, because another request for the same player can land while
    // this one is awaiting the lookup.
    const existing = cellRow(day, player, cell, flag);
    if (existing?.product_id === productNumber) return { verdict: "correct" };
    if (db.query("SELECT 1 FROM seen_guesses WHERE id = ?").get(seenId)) return { verdict: "miss" };

    const product = await catalog.get(productNumber); // CatalogUnavailable propagates (→ 503)
    if (!product) return { verdict: "rejected", reason: "not_playable" };

    const matchesRow = doesProductMatchTagId(product, target.rowTag);
    const matchesCol = doesProductMatchTagId(product, target.colTag);
    const verdict: GuessVerdict = matchesRow && matchesCol ? "correct" : matchesRow || matchesCol ? "near" : "miss";
    const playedDay = today();

    const outcome = db.transaction((): GuessOutcome => {
      // The catalog lookup above can be slow enough to straddle the 04:00
      // rollover. Re-check fresh, inside the transaction, that the day
      // hasn't ended underneath this guess — write nothing if it has.
      if (!practice && day !== today()) throw new ApiError(400, "day_over");

      // A duplicate id that's already been recorded (its insert landed while
      // we were awaiting the lookup, or a concurrent call for the exact same
      // id just committed) is a replay: report the stored effect, write
      // nothing.
      const inserted = db.run("INSERT OR IGNORE INTO seen_guesses (id, day) VALUES (?, ?)", [seenId, playedDay]);
      if (inserted.changes === 0) {
        const row = cellRow(day, player, cell, flag);
        return { verdict: row?.product_id === productNumber ? "correct" : "miss" };
      }

      // Re-check the cell and "already used" rules against current state —
      // a concurrent guess (different id) may have solved this cell, or
      // claimed this product elsewhere, while we were awaiting the lookup.
      // This applies whatever this guess's own verdict would be: a bottle
      // already placed on the board can't be placed again, even where it
      // would otherwise only be a near or a flat miss.
      const row = cellRow(day, player, cell, flag);
      if (row?.product_id === productNumber) return { verdict: "correct" };
      if (row?.product_id) return { verdict: "rejected" };
      const used = db
        .query("SELECT cell FROM cell_results WHERE day = ? AND player = ? AND practice = ? AND product_id = ? AND cell <> ?")
        .get(day, player, flag, productNumber, cell) as { cell: number } | null;
      if (used) return { verdict: "rejected", reason: "already_used", usedInCell: used.cell };

      if (verdict === "correct") {
        const result = db.run(
          `INSERT INTO cell_results (day, player, cell, practice, pair_key, product_id, misses, played_day, solved_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
           ON CONFLICT(day, player, cell, practice) DO UPDATE SET product_id = excluded.product_id,
             solved_at = excluded.solved_at, played_day = excluded.played_day
           WHERE cell_results.product_id IS NULL`,
          [day, player, cell, flag, target.pair, productNumber, playedDay, nowIso(now())],
        );
        if (result.changes === 0) {
          // The guard above refused the write after all (belt and
          // suspenders for the re-check just above); report what's
          // actually there rather than claim a write that didn't happen.
          const after = cellRow(day, player, cell, flag);
          return after?.product_id === productNumber ? { verdict: "correct" } : { verdict: "rejected" };
        }
        return { verdict };
      }

      db.run(
        `INSERT INTO cell_results (day, player, cell, practice, pair_key, product_id, misses, played_day)
         VALUES (?, ?, ?, ?, ?, NULL, 1, ?)
         ON CONFLICT(day, player, cell, practice) DO UPDATE SET misses = misses + 1`,
        [day, player, cell, flag, target.pair, playedDay],
      );
      return verdict === "near" ? { verdict, matchedTagId: matchesRow ? target.rowTag : target.colTag } : { verdict };
    })();

    cache.delete(day);
    return outcome;
  }

  function productName(productNumber: string) {
    const product = catalog.getKnown(productNumber);
    return product ? [product.productNameBold, product.productNameThin].filter(Boolean).join(" ") : productNumber;
  }

  function answers(day: string, players: string[]): CellAnswers[] {
    const cells = boardCells(boardFor(day));
    const counts = countsFor(day, cells);
    const playerCount = (db.query("SELECT COUNT(DISTINCT player) AS n FROM cell_results WHERE day = ? AND practice = 0").get(day) as { n: number }).n;
    const mine = playerBoard(day, players).cells;
    return cells.map((c) => {
      const k = counts.get(c.pair)!;
      const ranked = [...k.today.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const entry = ([productNumber, n]: [string, number]) => ({ productNumber, name: productName(productNumber), share: k.todayTotal ? n / k.todayTotal : 0 });
      return {
        cell: c.cell,
        solvedShare: playerCount ? k.todayTotal / playerCount : 0,
        top: ranked.slice(0, 5).map(entry),
        rarest: ranked.length ? entry(ranked[ranked.length - 1]) : null,
        mine: mine[c.cell - 1].productNumber,
      };
    });
  }

  function claim(userId: string, deviceId: string) {
    const day = today();
    const user = `u:${userId}`;
    const device = `d:${deviceId}`;
    db.transaction(() => {
      const deviceRows = db
        .query("SELECT cell FROM cell_results WHERE day = ? AND player = ? AND practice = 0")
        .all(day, device) as Array<{ cell: number }>;
      for (const { cell } of deviceRows) {
        const taken = db.query("SELECT 1 FROM cell_results WHERE day = ? AND player = ? AND cell = ? AND practice = 0").get(day, user, cell);
        if (taken) continue;
        db.run("UPDATE cell_results SET player = ? WHERE day = ? AND player = ? AND cell = ? AND practice = 0", [user, day, device, cell]);
      }
    })();
    cache.delete(day);
  }

  return {
    today,
    recordGuess,
    playerBoard,
    answers,
    claim,
    hasBoard: (day: string) => Boolean(getBoard(db, day, today())),
  };
}

export type Play = ReturnType<typeof createPlay>;
