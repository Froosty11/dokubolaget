import { expect, test } from "bun:test";
import { openDb } from "./db";

const TABLES = ["users", "sessions", "password_resets", "prefs", "progress", "boards", "app_config", "schema_version"];

test("creates every table", () => {
  const db = openDb(":memory:");
  const names = db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row: any) => row.name);
  for (const table of TABLES) expect(names).toContain(table);
});

test("running migrations twice is a no-op", () => {
  const db = openDb(":memory:");
  const version = (db.query("SELECT MAX(version) AS v FROM schema_version").get() as any).v;
  // openDb on the same handle path again must not fail or re-apply.
  const { migrate } = require("./db");
  migrate(db);
  expect((db.query("SELECT MAX(version) AS v FROM schema_version").get() as any).v).toBe(version);
  expect((db.query("SELECT COUNT(*) AS c FROM schema_version").get() as any).c).toBe(version);
});

test("foreign keys are enforced", () => {
  const db = openDb(":memory:");
  expect((db.query("PRAGMA foreign_keys").get() as any).foreign_keys).toBe(1);
  expect(() => db.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('t', 'nobody', 'x', 'y')")).toThrow();
});
