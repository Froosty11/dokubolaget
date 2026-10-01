import type { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const KEEP = 7;

// A consistent copy of the live database (safe while it's in use), one per
// day, keeping the newest seven.
export function backupDb(db: Database, dir: string, date: string) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `dokubolaget-${date}.sqlite`);
  fs.rmSync(target, { force: true });
  db.run("VACUUM INTO ?", [target]);
  const backups = fs.readdirSync(dir).filter((file) => /^dokubolaget-\d{4}-\d{2}-\d{2}\.sqlite$/.test(file)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - KEEP))) fs.rmSync(path.join(dir, old), { force: true });
  return target;
}
