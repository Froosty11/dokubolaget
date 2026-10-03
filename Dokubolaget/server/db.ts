import { Database } from "bun:sqlite";

// Numbered migrations; each runs once, in order, recorded in schema_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE TABLE prefs (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT,
    unlocked_themes TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    board_key TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE boards (
    date TEXT PRIMARY KEY,
    rows TEXT NOT NULL,
    cols TEXT NOT NULL,
    counts TEXT,
    score REAL,
    difficulty REAL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  // 2: club themes (loaded from club-themes/ at startup) and their unlock codes.
  `
  CREATE TABLE theme_packs (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    logo BLOB,
    logo_type TEXT,
    hidden_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE unlock_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    theme_id TEXT NOT NULL REFERENCES theme_packs(id),
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    revoked_at TEXT
  );
  CREATE TABLE code_redemptions (
    code_id INTEGER NOT NULL REFERENCES unlock_codes(id),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX code_redemptions_code ON code_redemptions(code_id, user_id);
  `,
  // 3: scores. One row per player per cell; practice rows (archive play) are
  // kept apart. played_day is the game day the guess was made, so history for
  // a day only counts what came before it.
  `
  CREATE TABLE cell_results (
    day TEXT NOT NULL,
    player TEXT NOT NULL,
    cell INTEGER NOT NULL,
    practice INTEGER NOT NULL DEFAULT 0,
    pair_key TEXT NOT NULL,
    product_id TEXT,
    misses INTEGER NOT NULL DEFAULT 0,
    played_day TEXT NOT NULL,
    solved_at TEXT,
    PRIMARY KEY (day, player, cell, practice)
  );
  CREATE INDEX cell_results_pair ON cell_results (pair_key, played_day, product_id);
  CREATE INDEX cell_results_day ON cell_results (day, practice, pair_key, product_id);
  CREATE INDEX cell_results_player ON cell_results (player, practice, day);
  CREATE TABLE daily_scores (
    day TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    solved INTEGER NOT NULL,
    misses INTEGER NOT NULL,
    unicorns INTEGER NOT NULL,
    finished INTEGER NOT NULL,
    perfect INTEGER NOT NULL,
    PRIMARY KEY (day, user_id)
  );
  CREATE INDEX daily_scores_user ON daily_scores (user_id, day);
  CREATE TABLE frozen_days (day TEXT PRIMARY KEY, frozen_at TEXT NOT NULL);
  CREATE TABLE seen_guesses (id TEXT PRIMARY KEY, day TEXT NOT NULL);
  `,
];

export function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

export function migrate(db: Database) {
  db.run("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const current = (db.query("SELECT COALESCE(MAX(version), 0) AS v FROM schema_version").get() as { v: number }).v;
  MIGRATIONS.forEach((sql, index) => {
    const version = index + 1;
    if (version <= current) return;
    db.transaction(() => {
      db.exec(sql);
      db.run("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)", [version, nowIso()]);
    })();
  });
}

export function openDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}
