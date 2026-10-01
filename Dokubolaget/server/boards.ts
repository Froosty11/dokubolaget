import type { Database } from "bun:sqlite";
import { nowIso } from "./db";

export type BoardTag = { id: string; label: string; family: string };
export type StoredBoard = {
  date: string;
  rows: BoardTag[];
  cols: BoardTag[];
  counts?: number[];
  score?: number;
  difficulty?: number;
};
type GeneratedBoard = {
  rows: any[];
  cols: any[];
  counts?: number[][] | number[];
  score?: number;
  difficulty?: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addDaysUtc(dateKey: string, offset: number) {
  const base = new Date(`${dateKey}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

const stripTag = (tag: any): BoardTag => ({ id: String(tag.id), label: String(tag.label), family: String(tag.family) });

export function putBoard(db: Database, date: string, board: GeneratedBoard) {
  if (!DATE.test(date)) throw new Error(`Bad board date ${date}`);
  db.run(
    `INSERT INTO boards (date, rows, cols, counts, score, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET rows = excluded.rows, cols = excluded.cols, counts = excluded.counts,
       score = excluded.score, difficulty = excluded.difficulty, created_at = excluded.created_at`,
    [
      date,
      JSON.stringify(board.rows.map(stripTag)),
      JSON.stringify(board.cols.map(stripTag)),
      board.counts ? JSON.stringify((board.counts as any[]).flat()) : null,
      board.score ?? null,
      board.difficulty ?? null,
      nowIso(),
    ],
  );
}

// Boards are readable once their (UTC) day has started, never earlier.
export function getBoard(db: Database, date: string, today: string): StoredBoard | null {
  if (!DATE.test(date) || date > today) return null;
  const row = db.query("SELECT * FROM boards WHERE date = ?").get(date) as any;
  if (!row) return null;
  return {
    date: row.date,
    rows: JSON.parse(row.rows),
    cols: JSON.parse(row.cols),
    ...(row.counts ? { counts: JSON.parse(row.counts) } : {}),
    ...(row.score != null ? { score: row.score } : {}),
    ...(row.difficulty != null ? { difficulty: row.difficulty } : {}),
  };
}

// Writes `days` boards starting at `startDate`, cycling through the pool.
export function seedBoards(db: Database, boards: GeneratedBoard[], startDate: string, days: number) {
  if (boards.length === 0) throw new Error("No boards to seed");
  const written: string[] = [];
  db.transaction(() => {
    for (let offset = 0; offset < days; offset += 1) {
      const date = addDaysUtc(startDate, offset);
      putBoard(db, date, boards[offset % boards.length]);
      written.push(date);
    }
  })();
  return written;
}
