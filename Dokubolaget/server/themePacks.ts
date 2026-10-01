import type { Database } from "bun:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, join } from "path";
import { validatePack, type PackSummary, type ThemePack } from "../src/theme/packSchema";
import { nowIso } from "./db";
import { imageInfo } from "./imageInfo";

export const MAX_LOGO_BYTES = 300 * 1024;
export const MAX_LOGO_SIDE = 1024;
const LOGO_FILES = ["logo.png", "logo.webp"];

export type FolderCheck = { pack: ThemePack | null; logo: { bytes: Uint8Array; type: string } | null; errors: string[] };

// Validates one club-themes/<slug>/ folder without writing anything.
export function checkThemeFolder(folder: string): FolderCheck {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(folder, "theme.json"), "utf8"));
  } catch (error: any) {
    return { pack: null, logo: null, errors: [`theme.json: ${error?.code === "ENOENT" ? "missing" : "not valid JSON"}`] };
  }
  const result = validatePack(raw);
  if (!result.ok) return { pack: null, logo: null, errors: result.errors };
  const pack = result.pack;

  if (pack.id !== `club-${basename(folder)}`) errors.push(`folder: "${basename(folder)}" must be named after the id without club- ("${pack.id.slice(5)}")`);

  let logo: FolderCheck["logo"] = null;
  const logoFile = LOGO_FILES.map((name) => join(folder, name)).find((path) => existsSync(path));
  if (logoFile) {
    const bytes = readFileSync(logoFile);
    const info = imageInfo(bytes);
    if (!info) errors.push("logo: must be a PNG or WebP image (SVG is not allowed)");
    else {
      if (bytes.length > MAX_LOGO_BYTES) errors.push(`logo: ${Math.round(bytes.length / 1024)} KB is over the 300 KB limit`);
      if (info.width > MAX_LOGO_SIDE || info.height > MAX_LOGO_SIDE) errors.push(`logo: ${info.width}×${info.height} is over 1024 px`);
      if (!pack.logo) errors.push("logo: theme.json says logo: null but there is a logo file");
      else if (pack.logo.width !== info.width || pack.logo.height !== info.height) {
        errors.push(`logo: theme.json says ${pack.logo.width}×${pack.logo.height} but the file is ${info.width}×${info.height}`);
      }
      logo = { bytes, type: info.type };
    }
  } else if (pack.logo) {
    errors.push("logo: theme.json gives a logo size but there is no logo.png or logo.webp");
  }
  return { pack: errors.length ? null : pack, logo: errors.length ? null : logo, errors };
}

// Loads every club-themes/<slug>/ folder into the database. A newer version
// replaces the stored one; a broken folder is reported and skipped, and the
// previously stored version stays in use.
export function loadThemePacks(db: Database, dir: string, log: (line: string) => void) {
  const result = { loaded: [] as string[], skipped: [] as string[], errors: {} as Record<string, string[]> };
  if (!existsSync(dir)) return result;
  const folders = readdirSync(dir).filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isDirectory()).sort();
  for (const name of folders) {
    const check = checkThemeFolder(join(dir, name));
    if (!check.pack) {
      result.errors[name] = check.errors;
      log(`[themes] ${name}: skipped, ${check.errors.join("; ")}`);
      continue;
    }
    const { pack, logo } = check;
    const stored = db.query("SELECT version FROM theme_packs WHERE id = ?").get(pack.id) as { version: number } | null;
    if (stored && stored.version >= pack.version) {
      result.skipped.push(pack.id);
      continue;
    }
    db.run(
      `INSERT INTO theme_packs (id, version, data, logo, logo_type, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET version = excluded.version, data = excluded.data, logo = excluded.logo,
         logo_type = excluded.logo_type, updated_at = excluded.updated_at`,
      [pack.id, pack.version, JSON.stringify(pack), logo?.bytes ?? null, logo?.type ?? null, nowIso()],
    );
    result.loaded.push(pack.id);
    log(`[themes] ${pack.id}: loaded version ${pack.version}`);
  }
  return result;
}

type Row = { id: string; version: number; data: string; logo_type: string | null };

function summary(row: Row): PackSummary {
  const pack = JSON.parse(row.data) as ThemePack;
  return {
    id: pack.id,
    version: row.version,
    name: pack.copy.en.name,
    club: pack.club,
    swatch: [pack.colors.page, pack.colors.accent, pack.colors.highlight],
    logoUrl: row.logo_type ? `/api/themes/${pack.id}/logo?v=${row.version}` : null,
  };
}

export function listPacks(db: Database): PackSummary[] {
  const rows = db.query("SELECT id, version, data, logo_type FROM theme_packs WHERE hidden_at IS NULL ORDER BY id").all() as Row[];
  return rows.map(summary);
}

export function getPackSummary(db: Database, id: string): PackSummary | null {
  const row = db.query("SELECT id, version, data, logo_type FROM theme_packs WHERE id = ?").get(id) as Row | null;
  return row ? summary(row) : null;
}

// Hidden themes stay fetchable for players who already unlocked them.
export function getPack(db: Database, id: string): ThemePack | null {
  const row = db.query("SELECT data FROM theme_packs WHERE id = ?").get(id) as { data: string } | null;
  return row ? (JSON.parse(row.data) as ThemePack) : null;
}

export function getLogo(db: Database, id: string): { type: string; bytes: Uint8Array } | null {
  const row = db.query("SELECT logo, logo_type FROM theme_packs WHERE id = ? AND logo IS NOT NULL").get(id) as
    | { logo: Uint8Array; logo_type: string }
    | null;
  return row ? { type: row.logo_type, bytes: row.logo } : null;
}

export function setHidden(db: Database, id: string, hidden: boolean): boolean {
  return db.run("UPDATE theme_packs SET hidden_at = ? WHERE id = ?", [hidden ? nowIso() : null, id]).changes === 1;
}

export function knownClubIds(db: Database): Set<string> {
  return new Set((db.query("SELECT id FROM theme_packs").all() as Array<{ id: string }>).map((row) => row.id));
}
