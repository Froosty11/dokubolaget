import type { Database } from "bun:sqlite";
import { nowIso } from "./db";

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export type SessionUser = { id: string; email: string; nickname: string };

export const SESSION_DAYS = 90;
const RESET_MINUTES = 60;
const NICKNAME = /^[^@<>]{2,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Raw tokens only ever leave the server; the database keeps their hashes.
export function hashToken(token: string) {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function newToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

function normalizeEmail(email: unknown) {
  const value = String(email ?? "").trim().toLowerCase();
  if (!EMAIL.test(value) || value.length > 254) throw new ApiError(400, "bad_email");
  return value;
}

function normalizeNickname(nickname: unknown) {
  const value = String(nickname ?? "").trim().replace(/\s+/g, " ");
  if (!NICKNAME.test(value)) throw new ApiError(400, "bad_nickname");
  return value;
}

function checkPassword(password: unknown) {
  const value = String(password ?? "");
  if (value.length < 8 || value.length > 200) throw new ApiError(400, "weak_password");
  return value;
}

function createSession(db: Database, userId: string, now = new Date()) {
  const token = newToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  db.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
    hashToken(token), userId, nowIso(now), nowIso(expires),
  ]);
  return token;
}

export async function signup(db: Database, input: { email: unknown; password: unknown; nickname: unknown }) {
  const email = normalizeEmail(input.email);
  const nickname = normalizeNickname(input.nickname);
  const password = checkPassword(input.password);
  if (db.query("SELECT 1 FROM users WHERE email = ?").get(email)) throw new ApiError(409, "email_taken");
  if (db.query("SELECT 1 FROM users WHERE nickname = ?").get(nickname)) throw new ApiError(409, "nickname_taken");
  const userId = crypto.randomUUID();
  const hash = await Bun.password.hash(password, "argon2id");
  db.run("INSERT INTO users (id, email, nickname, password_hash, created_at) VALUES (?, ?, ?, ?, ?)", [
    userId, email, nickname, hash, nowIso(),
  ]);
  return { userId, token: createSession(db, userId) };
}

// Verified against when the email is unknown, so both failures take as long.
let dummyHash: Promise<string> | null = null;

export async function login(db: Database, input: { email: unknown; password: unknown }) {
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const user = db.query("SELECT id, password_hash FROM users WHERE email = ?").get(email) as
    | { id: string; password_hash: string }
    | null;
  if (!user) {
    dummyHash ??= Bun.password.hash("not-a-real-password", "argon2id");
    await Bun.password.verify(password, await dummyHash);
    throw new ApiError(401, "bad_credentials");
  }
  if (!(await Bun.password.verify(password, user.password_hash))) throw new ApiError(401, "bad_credentials");
  return { userId: user.id, token: createSession(db, user.id) };
}

export function sessionUser(db: Database, token: string | null | undefined, now = new Date()): SessionUser | null {
  if (!token) return null;
  const row = db
    .query(
      "SELECT s.expires_at, u.id, u.email, u.nickname FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    )
    .get(hashToken(token)) as { expires_at: string; id: string; email: string; nickname: string } | null;
  if (!row) return null;
  if (row.expires_at <= nowIso(now)) {
    db.run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
    return null;
  }
  return { id: row.id, email: row.email, nickname: row.nickname };
}

export function logout(db: Database, token: string | null | undefined) {
  if (token) db.run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export function createResetToken(db: Database, email: unknown, now = new Date()) {
  const user = db.query("SELECT id FROM users WHERE email = ?").get(String(email ?? "").trim().toLowerCase()) as
    | { id: string }
    | null;
  if (!user) return null;
  const token = newToken();
  db.run("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    hashToken(token), user.id, nowIso(new Date(now.getTime() + RESET_MINUTES * 60_000)),
  ]);
  return { token, userId: user.id };
}

export async function resetPassword(db: Database, token: unknown, password: unknown, now = new Date()) {
  const row = db
    .query("SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?")
    .get(hashToken(String(token ?? ""))) as { user_id: string; expires_at: string; used_at: string | null } | null;
  if (!row || row.used_at || row.expires_at <= nowIso(now)) throw new ApiError(400, "invalid_token");
  const hash = await Bun.password.hash(checkPassword(password), "argon2id");
  db.transaction(() => {
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, row.user_id]);
    db.run("UPDATE password_resets SET used_at = ? WHERE token_hash = ?", [nowIso(now), hashToken(String(token))]);
    // A reset means the old password may be known to someone else.
    db.run("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);
  })();
}

export function setNickname(db: Database, userId: string, nickname: unknown) {
  const value = normalizeNickname(nickname);
  const taken = db.query("SELECT 1 FROM users WHERE nickname = ? AND id != ?").get(value, userId);
  if (taken) throw new ApiError(409, "nickname_taken");
  db.run("UPDATE users SET nickname = ? WHERE id = ?", [value, userId]);
}

// Fixed-window counter per key, e.g. "login:1.2.3.4".
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();
  constructor(private now: () => number = Date.now) {}

  hit(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();
    const current = this.windows.get(key);
    if (!current || now - current.start >= windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      if (this.windows.size > 10_000) this.prune(now, windowMs);
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  }

  private prune(now: number, windowMs: number) {
    for (const [key, window] of this.windows) if (now - window.start >= windowMs) this.windows.delete(key);
  }
}
