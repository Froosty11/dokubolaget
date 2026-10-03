// Frozen daily scores, streaks, the Hi-score lists and the archive calendar.
import type { Database } from "bun:sqlite";
import { addDays, weekStart } from "../src/gameDay";
import { streaks } from "../src/scoring";
import { nowIso } from "./db";
import type { Play } from "./play";

export type DayScore = { userId: string; score: number; solved: number; misses: number; unicorns: number; finished: boolean; perfect: boolean };
export type Period = "today" | "yesterday" | "week" | "all" | "streak";
export type LeaderRow = { rank: number; nickname: string; value: number; longest?: number };
export type Leaderboard = { period: Period; provisional: boolean; rows: LeaderRow[]; me: LeaderRow | null };
export type UserStats = { currentStreak: number; longestStreak: number; finishedCount: number; unicorns: number };

const TOP = 50;

export function liveDayScores(db: Database, play: Play, day: string): DayScore[] {
  if (!play.hasBoard(day)) return [];
  const players = db
    .query("SELECT DISTINCT player FROM cell_results WHERE day = ? AND practice = 0 AND player LIKE 'u:%'")
    .all(day) as Array<{ player: string }>;
  return players.map(({ player }) => {
    const board = play.playerBoard(day, [player]);
    return { userId: player.slice(2), score: board.score, solved: board.solved, misses: board.misses, unicorns: board.unicorns, finished: board.finished, perfect: board.perfect };
  });
}

export function freezeDay(db: Database, play: Play, day: string) {
  const scores = liveDayScores(db, play, day);
  db.transaction(() => {
    db.run("DELETE FROM daily_scores WHERE day = ?", [day]);
    for (const s of scores) {
      if (!db.query("SELECT 1 FROM users WHERE id = ?").get(s.userId)) continue;
      db.run(
        "INSERT INTO daily_scores (day, user_id, score, solved, misses, unicorns, finished, perfect) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [day, s.userId, s.score, s.solved, s.misses, s.unicorns, s.finished ? 1 : 0, s.perfect ? 1 : 0],
      );
    }
    db.run("INSERT OR REPLACE INTO frozen_days (day, frozen_at) VALUES (?, ?)", [day, nowIso()]);
  })();
}

export function catchUpFreeze(db: Database, play: Play, today: string): string[] {
  const days = (db
    .query(`SELECT DISTINCT day FROM cell_results WHERE practice = 0 AND day < ?
            AND day NOT IN (SELECT day FROM frozen_days) ORDER BY day`)
    .all(today) as Array<{ day: string }>).map((r) => r.day);
  for (const day of days) freezeDay(db, play, day);
  db.run("DELETE FROM seen_guesses WHERE day < ?", [addDays(today, -2)]);
  return days;
}

function finishedDays(db: Database, play: Play, userId: string, today: string): string[] {
  const frozen = (db.query("SELECT day FROM daily_scores WHERE user_id = ? AND finished = 1").all(userId) as Array<{ day: string }>).map((r) => r.day);
  const live = play.hasBoard(today) ? play.playerBoard(today, [`u:${userId}`]) : null;
  return live?.finished ? [...frozen, today] : frozen;
}

export function userStats(db: Database, play: Play, userId: string, today: string): UserStats {
  const days = finishedDays(db, play, userId, today);
  const { current, longest } = streaks(days, today);
  const frozenUnicorns = (db.query("SELECT COALESCE(SUM(unicorns), 0) AS n FROM daily_scores WHERE user_id = ?").get(userId) as { n: number }).n;
  const todayUnicorns = play.hasBoard(today) ? play.playerBoard(today, [`u:${userId}`]).unicorns : 0;
  return { currentStreak: current, longestStreak: longest, finishedCount: new Set(days).size, unicorns: frozenUnicorns + todayUnicorns };
}

function nicknames(db: Database, ids: string[]): Map<string, string> {
  if (ids.length === 0) return new Map();
  const rows = db.query(`SELECT id, nickname FROM users WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) as Array<{ id: string; nickname: string }>;
  return new Map(rows.map((r) => [r.id, r.nickname]));
}

// Highest first; a shared rank requires both value and longest to match (streak
// ties break on longest); names break ties for a stable order. A zero-value
// entry never appears in rows, but if it's the caller's own entry it still
// surfaces as `me`, ranked just after the last real row.
function rank(values: Map<string, { value: number; longest?: number }>, db: Database, userId: string | null) {
  const names = nicknames(db, [...values.keys()]);
  const all = [...values.entries()]
    .filter(([id]) => names.has(id))
    .map(([id, v]) => ({ id, nickname: names.get(id)!, ...v }));
  const entries = all
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || (b.longest ?? 0) - (a.longest ?? 0) || a.nickname.localeCompare(b.nickname));
  let lastValue: number | null = null;
  let lastLongest: number | null = null;
  let lastRank = 0;
  const ranked = entries.map((e, index) => {
    if (e.value !== lastValue || (e.longest ?? 0) !== lastLongest) {
      lastRank = index + 1;
      lastValue = e.value;
      lastLongest = e.longest ?? 0;
    }
    return { id: e.id, row: { rank: lastRank, nickname: e.nickname, value: e.value, ...(e.longest != null ? { longest: e.longest } : {}) } };
  });
  const rows = ranked.slice(0, TOP).map((r) => r.row);
  const mine = ranked.find((r) => r.id === userId)?.row ?? ownZeroRow(all, ranked.length, userId);
  return { rows, me: mine };
}

function ownZeroRow(all: Array<{ id: string; nickname: string; value: number; longest?: number }>, rankedCount: number, userId: string | null) {
  const own = userId ? all.find((e) => e.id === userId && e.value === 0) : undefined;
  return own ? { rank: rankedCount + 1, nickname: own.nickname, value: 0, ...(own.longest != null ? { longest: own.longest } : {}) } : null;
}

function frozenSums(db: Database, where: string, params: string[]) {
  const rows = db.query(`SELECT user_id, SUM(score) AS total FROM daily_scores WHERE ${where} GROUP BY user_id`).all(...params) as Array<{ user_id: string; total: number }>;
  return new Map(rows.map((r) => [r.user_id, r.total]));
}

export function leaderboard(db: Database, play: Play, period: Period, today: string, userId: string | null): Leaderboard {
  const values = new Map<string, { value: number; longest?: number }>();
  if (period === "today") {
    for (const s of liveDayScores(db, play, today)) values.set(s.userId, { value: s.score });
    return { period, provisional: true, ...rank(values, db, userId) };
  }
  if (period === "yesterday") {
    const day = addDays(today, -1);
    const frozen = db.query("SELECT 1 FROM frozen_days WHERE day = ?").get(day);
    const scores = frozen
      ? (db.query("SELECT user_id AS userId, score FROM daily_scores WHERE day = ?").all(day) as Array<{ userId: string; score: number }>)
      : liveDayScores(db, play, day);
    for (const s of scores) values.set(s.userId, { value: s.score });
    return { period, provisional: false, ...rank(values, db, userId) };
  }
  if (period === "week") {
    for (const [id, total] of frozenSums(db, "day >= ? AND day < ?", [weekStart(today), today])) values.set(id, { value: total });
    for (const s of liveDayScores(db, play, today)) values.set(s.userId, { value: (values.get(s.userId)?.value ?? 0) + s.score });
    return { period, provisional: true, ...rank(values, db, userId) };
  }
  if (period === "all") {
    for (const [id, total] of frozenSums(db, "1 = 1", [])) values.set(id, { value: total });
    return { period, provisional: false, ...rank(values, db, userId) };
  }
  const ids = new Set([
    ...(db.query("SELECT DISTINCT user_id FROM daily_scores WHERE finished = 1").all() as Array<{ user_id: string }>).map((r) => r.user_id),
    ...liveDayScores(db, play, today).filter((s) => s.finished).map((s) => s.userId),
  ]);
  for (const id of ids) {
    const { current, longest } = streaks(finishedDays(db, play, id, today), today);
    values.set(id, { value: current, longest });
  }
  return { period, provisional: true, ...rank(values, db, userId) };
}

export function archiveMonth(db: Database, play: Play, month: string, today: string, players: string[], userId: string | null) {
  const days = (db.query("SELECT date FROM boards WHERE date LIKE ? AND date < ? ORDER BY date").all(`${month}-%`, today) as Array<{ date: string }>).map((r) => r.date);
  return days.map((day) => {
    const frozen = userId
      ? (db.query("SELECT score, solved, finished, perfect FROM daily_scores WHERE day = ? AND user_id = ?").get(day, userId) as any)
      : null;
    if (frozen) return { day, result: { score: frozen.score, solved: frozen.solved, finished: Boolean(frozen.finished), perfect: Boolean(frozen.perfect) } };
    const played = players.length && db.query(`SELECT 1 FROM cell_results WHERE day = ? AND practice = 0 AND player IN (${players.map(() => "?").join(",")})`).get(day, ...players);
    if (!played) return { day, result: null };
    const board = play.playerBoard(day, players);
    return { day, result: { score: board.score, solved: board.solved, finished: board.finished, perfect: board.perfect } };
  });
}
