import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "../server/db";
import { addDaysUtc, seedBoards } from "../server/boards";

/*
Reads the generated-boards.json output of `bun run generate:board` and stores
boards in the app database (DB_PATH) as one board per date.

When --days > 1, cycles through the pool round-robin so each date gets a
board even if the pool is smaller than the date range.

Usage:
  bun run seed:boards -- --date 2026-05-06
  bun run seed:boards -- --date 2026-05-06 --days 30
  bun run seed:boards -- --date 2026-05-06 --days 30 --boards-file data/generated-boards.json
*/

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function parseArgs() {
  const today = new Date().toISOString().slice(0, 10);
  const args = { date: addDaysUtc(today, 1), days: 1, boardsFile: path.resolve(projectRoot, "data", "generated-boards.json") };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const next = argv[i + 1];
    if (argv[i] === "--date" && next) (args.date = next), (i += 1);
    else if (argv[i] === "--days" && next) (args.days = Number(next)), (i += 1);
    else if (argv[i] === "--boards-file" && next) (args.boardsFile = path.isAbsolute(next) ? next : path.resolve(projectRoot, next)), (i += 1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error(`--date must be YYYY-MM-DD, got "${args.date}"`);
  if (!Number.isInteger(args.days) || args.days < 1) throw new Error("--days must be a positive integer");
  return args;
}

const args = parseArgs();
if (!fs.existsSync(args.boardsFile)) {
  throw new Error(`Boards file not found at ${args.boardsFile}. Run \`bun run generate:board\` first.`);
}
const boards = JSON.parse(fs.readFileSync(args.boardsFile, "utf8")).boards;
if (!Array.isArray(boards) || boards.length === 0) throw new Error(`No boards found in ${args.boardsFile}`);
if (args.days > boards.length) {
  console.warn(`Pool has ${boards.length} board(s); cycling round-robin across ${args.days} day(s).`);
}

const dbPath = process.env.DB_PATH || path.resolve(projectRoot, "data", "local.sqlite");
const db = openDb(dbPath);
for (const date of seedBoards(db, boards, args.date, args.days)) console.log(`Stored board for ${date}`);
db.close();
