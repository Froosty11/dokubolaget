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
