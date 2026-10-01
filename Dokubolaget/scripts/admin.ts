// Admin commands for club themes and unlock codes. In the container:
//   docker exec dokubolaget bun run admin <command>
// Locally (against data/local.sqlite):
//   bun run admin <command>
import type { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import QRCode from "qrcode";
import { ApiError } from "../server/auth";
import { createCode, formatCode, listCodes, revokeCode } from "../server/codes";
import { openDb } from "../server/db";
import { checkThemeFolder, loadThemePacks, setHidden } from "../server/themePacks";

export type AdminContext = {
  db: Database;
  out: (line: string) => void;
  clubDir: string;
  qrDir: string;
  publicUrl: string | null;
};

const USAGE = `Usage: bun run admin <command>
  themes check [<dir>]          Validate club theme folders (default: every folder in club-themes/)
  themes load                   Load club-themes/ into the database now (also happens at startup)
  themes list                   List club themes with version, hidden state and scans
  themes hide <id> | show <id>  Hide a theme from the list (players who have it keep it), or show it again
  codes create <themeId> --label <text> [--expires <ISO date>] [--max-uses <n>]
                                Make an unlock code; prints the link and writes a QR image
  codes list [<themeId>]        List codes (the codes themselves are never shown again)
  codes revoke <id>             Stop a code from working`;

function option(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
}

function themeFolders(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isDirectory()).sort();
  } catch {
    return [];
  }
}

async function themes(argv: string[], ctx: AdminContext): Promise<number> {
  const [sub, arg] = argv;
  if (sub === "check") {
    const dirs = arg ? [arg] : themeFolders(ctx.clubDir).map((name) => join(ctx.clubDir, name));
    if (dirs.length === 0) {
      ctx.out(`No club theme folders in ${ctx.clubDir}`);
      return 1;
    }
    let failed = 0;
    for (const dir of dirs) {
      const check = checkThemeFolder(dir);
      if (check.pack) ctx.out(`ok    ${check.pack.id} (version ${check.pack.version}${check.logo ? ", logo" : ", no logo"})`);
      else {
        failed++;
        ctx.out(`FAIL  ${dir}`);
        for (const error of check.errors) ctx.out(`      ${error}`);
      }
    }
    return failed ? 1 : 0;
  }
  if (sub === "load") {
    const result = loadThemePacks(ctx.db, ctx.clubDir, ctx.out);
    ctx.out(`loaded ${result.loaded.length}, unchanged ${result.skipped.length}, broken ${Object.keys(result.errors).length}`);
    return Object.keys(result.errors).length ? 1 : 0;
  }
  if (sub === "list") {
    const rows = ctx.db
      .query(
        `SELECT p.id, p.version, p.hidden_at, (SELECT COUNT(*) FROM code_redemptions r JOIN unlock_codes c ON c.id = r.code_id WHERE c.theme_id = p.id) AS scans
         FROM theme_packs p ORDER BY p.id`,
      )
      .all() as Array<{ id: string; version: number; hidden_at: string | null; scans: number }>;
    if (rows.length === 0) ctx.out("No club themes loaded.");
    for (const row of rows) ctx.out(`${row.id.padEnd(20)} v${row.version}  ${row.hidden_at ? "hidden " : "listed "}  ${row.scans} scans`);
    return 0;
  }
  if ((sub === "hide" || sub === "show") && arg) {
    if (!setHidden(ctx.db, arg, sub === "hide")) {
      ctx.out(`No club theme called ${arg}`);
      return 1;
    }
    ctx.out(`${arg} is now ${sub === "hide" ? "hidden" : "listed"}`);
    return 0;
  }
  ctx.out(USAGE);
  return 2;
}

async function codes(argv: string[], ctx: AdminContext): Promise<number> {
  const [sub, arg] = argv;
  if (sub === "create" && arg) {
    if (!ctx.publicUrl) {
      ctx.out("Set PUBLIC_URL first: the QR code links to PUBLIC_URL/scan/<code>.");
      return 1;
    }
    const label = option(argv, "--label");
    if (!label) {
      ctx.out("Give the code a --label, e.g. --label \"Bar poster\".");
      return 2;
    }
    const expires = option(argv, "--expires");
    const maxUses = option(argv, "--max-uses");
    const expiresAt = expires ? new Date(expires) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      ctx.out(`Can't read --expires ${expires}; use e.g. 2026-10-10T02:00:00+02:00`);
      return 2;
    }
    if (maxUses && !(Number.isInteger(Number(maxUses)) && Number(maxUses) > 0)) {
      ctx.out("--max-uses must be a whole number above 0");
      return 2;
    }
    let created: { id: number; code: string };
    try {
      created = createCode(ctx.db, { themeId: arg, label, expiresAt: expiresAt?.toISOString() ?? null, maxUses: maxUses ? Number(maxUses) : null });
    } catch (error) {
      if (error instanceof ApiError) {
        ctx.out(`No club theme called ${arg}. Run "themes list".`);
        return 1;
      }
      throw error;
    }
    const link = `${ctx.publicUrl.replace(/\/+$/, "")}/scan/${formatCode(created.code)}`;
    mkdirSync(ctx.qrDir, { recursive: true });
    const qrPath = join(ctx.qrDir, `code-${created.id}-${arg}.svg`);
    writeFileSync(qrPath, await QRCode.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 2 }));
    ctx.out(`Code ${created.id} for ${arg} (${label})`);
    ctx.out(`  code: ${formatCode(created.code)}   <- shown only now`);
    ctx.out(`  link: ${link}`);
    ctx.out(`  QR:   ${qrPath}`);
    return 0;
  }
  if (sub === "list") {
    const rows = listCodes(ctx.db, arg);
    if (rows.length === 0) ctx.out("No codes yet.");
    for (const row of rows) {
      const state = row.revokedAt ? "revoked" : row.expiresAt && row.expiresAt <= new Date().toISOString() ? "expired" : "active";
      ctx.out(
        `#${row.id}  ${row.themeId}  "${row.label}"  ${state}  ${row.uses}${row.maxUses ? `/${row.maxUses}` : ""} uses` +
          (row.expiresAt ? `  until ${row.expiresAt}` : ""),
      );
    }
    return 0;
  }
  if (sub === "revoke" && arg) {
    if (!revokeCode(ctx.db, Number(arg))) {
      ctx.out(`No active code #${arg}`);
      return 1;
    }
    ctx.out(`Code #${arg} revoked`);
    return 0;
  }
  ctx.out(USAGE);
  return 2;
}

export async function runAdmin(argv: string[], ctx: AdminContext): Promise<number> {
  const [group, ...rest] = argv;
  if (group === "themes") return themes(rest, ctx);
  if (group === "codes") return codes(rest, ctx);
  ctx.out(USAGE);
  return 2;
}

if (import.meta.main) {
  const dbPath = process.env.DB_PATH || join(import.meta.dir, "..", "data", "local.sqlite");
  const db = openDb(dbPath);
  const exitCode = await runAdmin(process.argv.slice(2), {
    db,
    out: (line) => console.log(line),
    clubDir: process.env.CLUB_THEMES_DIR || join(import.meta.dir, "..", "..", "club-themes"),
    qrDir: join(dirname(dbPath), "qr"),
    publicUrl: process.env.PUBLIC_URL || null,
  });
  process.exit(exitCode);
}
