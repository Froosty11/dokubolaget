// Themes players earn by playing. Only the server grants these; clients can't
// claim them through PUT /api/me/prefs.
import type { Database } from "bun:sqlite";

export const EARNED_THEMES = ["cyberwave", "speakeasy", "modern"] as const;

export function readUnlocks(db: Database, userId: string): string[] {
  const row = db.query("SELECT unlocked_themes FROM prefs WHERE user_id = ?").get(userId) as { unlocked_themes: string } | null;
  try {
    const value = JSON.parse(row?.unlocked_themes ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function grantUnlocks(db: Database, userId: string, ids: string[]): string[] {
  const current = readUnlocks(db, userId);
  const fresh = [...new Set(ids)].filter((id) => !current.includes(id));
  if (fresh.length === 0) return [];
  db.run(
    `INSERT INTO prefs (user_id, theme, unlocked_themes) VALUES (?, NULL, ?)
     ON CONFLICT(user_id) DO UPDATE SET unlocked_themes = excluded.unlocked_themes`,
    [userId, JSON.stringify([...current, ...fresh])],
  );
  return fresh;
}

export function earnedUnlocks(state: { finished: boolean; perfect: boolean; longestStreak: number }): string[] {
  const ids: string[] = [];
  if (state.finished) ids.push("cyberwave");
  if (state.perfect) ids.push("speakeasy");
  if (state.longestStreak >= 7) ids.push("modern");
  return ids;
}

export function deviceHistoryUnlocks(db: Database, deviceId: string): string[] {
  const days = db
    .query(`SELECT COUNT(product_id) AS solved, SUM(misses) AS misses FROM cell_results
            WHERE player = ? AND practice = 0 GROUP BY day`)
    .all(`d:${deviceId}`) as Array<{ solved: number; misses: number }>;
  const finished = days.some((d) => d.solved === 9);
  const perfect = days.some((d) => d.solved === 9 && d.misses === 0);
  return earnedUnlocks({ finished, perfect, longestStreak: 0 });
}
