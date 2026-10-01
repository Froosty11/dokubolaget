import type { Database } from "bun:sqlite";
import { ApiError, hashToken } from "./auth";
import { nowIso } from "./db";

// Crockford base32: no I, L, O or U, so codes survive being read aloud or
// typed from a poster.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 10;

// The code as stored and hashed: upper case, no dashes or spaces, O read as
// 0 and I/L as 1. Null when it can't be a code.
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (code.length !== CODE_LENGTH || [...code].some((ch) => !ALPHABET.includes(ch))) return null;
  return code;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

function newCode(): string {
  // 256 is a multiple of 32, so taking each byte mod 32 stays uniform.
  return [...crypto.getRandomValues(new Uint8Array(CODE_LENGTH))].map((b) => ALPHABET[b % 32]).join("");
}

export function createCode(
  db: Database,
  opts: { themeId: string; label: string; expiresAt?: string | null; maxUses?: number | null },
  now = new Date(),
): { id: number; code: string } {
  if (!db.query("SELECT 1 FROM theme_packs WHERE id = ?").get(opts.themeId)) throw new ApiError(400, "bad_request");
  const code = newCode();
  const result = db.run(
    "INSERT INTO unlock_codes (code_hash, theme_id, label, created_at, expires_at, max_uses) VALUES (?, ?, ?, ?, ?, ?)",
    [hashToken(code), opts.themeId, opts.label, nowIso(now), opts.expiresAt ?? null, opts.maxUses ?? null],
  );
  return { id: Number(result.lastInsertRowid), code };
}

type CodeRow = { id: number; theme_id: string; expires_at: string | null; max_uses: number | null; uses: number; revoked_at: string | null };

// Redeems a code for a theme. A logged-in player who already redeemed it gets
// it again without using up another use.
export function redeemCode(db: Database, input: unknown, userId: string | null, now = new Date()): { themeId: string; codeId: number } {
  const code = normalizeCode(input);
  if (!code) throw new ApiError(404, "invalid_code");
  return db.transaction(() => {
    const row = db
      .query("SELECT id, theme_id, expires_at, max_uses, uses, revoked_at FROM unlock_codes WHERE code_hash = ?")
      .get(hashToken(code)) as CodeRow | null;
    if (!row || row.revoked_at) throw new ApiError(404, "invalid_code");
    if (row.expires_at && row.expires_at <= nowIso(now)) throw new ApiError(410, "code_expired");
    if (userId && db.query("SELECT 1 FROM code_redemptions WHERE code_id = ? AND user_id = ?").get(row.id, userId)) {
      return { themeId: row.theme_id, codeId: row.id };
    }
    const claimed = db.run("UPDATE unlock_codes SET uses = uses + 1 WHERE id = ? AND (max_uses IS NULL OR uses < max_uses)", [row.id]);
    if (claimed.changes !== 1) throw new ApiError(410, "code_used_up");
    db.run("INSERT INTO code_redemptions (code_id, user_id, at) VALUES (?, ?, ?)", [row.id, userId, nowIso(now)]);
    return { themeId: row.theme_id, codeId: row.id };
  })();
}

export type CodeListing = {
  id: number; themeId: string; label: string; createdAt: string;
  expiresAt: string | null; maxUses: number | null; uses: number; revokedAt: string | null;
};

// Never includes the codes: only their hashes are stored.
export function listCodes(db: Database, themeId?: string): CodeListing[] {
  const rows = db
    .query(
      `SELECT id, theme_id, label, created_at, expires_at, max_uses, uses, revoked_at FROM unlock_codes
       ${themeId ? "WHERE theme_id = ?" : ""} ORDER BY id`,
    )
    .all(...(themeId ? [themeId] : [])) as Array<CodeRow & { label: string; created_at: string }>;
  return rows.map((row) => ({
    id: row.id, themeId: row.theme_id, label: row.label, createdAt: row.created_at,
    expiresAt: row.expires_at, maxUses: row.max_uses, uses: row.uses, revokedAt: row.revoked_at,
  }));
}

export function revokeCode(db: Database, id: number, now = new Date()): boolean {
  return db.run("UPDATE unlock_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [nowIso(now), id]).changes === 1;
}
