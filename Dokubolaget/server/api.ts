import type { Database } from "bun:sqlite";
import { THEME_IDS } from "../src/theme/types";
import {
  ApiError, RateLimiter, SESSION_DAYS, createResetToken, deleteAccount, login, logout, resetPassword, sessionUser, setNickname, signup,
  type SessionUser,
} from "./auth";
import { getBoard } from "./boards";
import { normalizeCode, redeemCode } from "./codes";
import { nowIso } from "./db";
import { getLogo, getPack, getPackSummary, knownClubIds, listPacks } from "./themePacks";

export type ApiRequest = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string;
  ip: string;
};
export type ApiResponse = { status: number; headers: Record<string, string>; body: string | Uint8Array };

export type ApiDeps = {
  db: Database;
  mail: { sendReset(to: string, link: string): Promise<void> };
  sbKey: { get(): Promise<string> };
  now?: () => Date;
  trustProxy?: boolean;
  // Development only: accept http://localhost:* origins (Expo dev server).
  devOrigins?: boolean;
  // Base for links in emails; defaults to the request's own origin.
  publicUrl?: string;
  // Ko-fi (or similar) page shown as "Support Dokubolaget"; https only.
  supportUrl?: string;
  // Shown on the pub stamps screen as "Want your club here?".
  contactEmail?: string;
};

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function safeContactEmail(value: string | undefined): string | null {
  const email = value?.trim();
  return email && EMAIL.test(email) && email.length <= 254 ? email : null;
}

// Only plain https links reach the page, whatever ends up in the env file.
export function safeSupportUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const MAX_BODY_BYTES = 64 * 1024;
const COOKIE = "doku_session";
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function respond(status: number, data: unknown, headers: Record<string, string> = {}): ApiResponse {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
    body: JSON.stringify(data),
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function readCookie(header: string | undefined, name: string) {
  for (const part of String(header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return safeDecode(rest.join("="));
  }
  return null;
}

// Built-in themes in picker order, then club themes the server knows, sorted.
function parseUnlocked(value: unknown, knownClubs: Set<string>): string[] {
  let parsed: unknown = value;
  try {
    if (typeof value === "string") parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const ids = new Set(parsed.filter((id): id is string => typeof id === "string"));
  return [...THEME_IDS.filter((id) => ids.has(id)), ...[...ids].filter((id) => knownClubs.has(id)).sort()];
}

export function createApi(deps: ApiDeps) {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());
  const limiter = new RateLimiter(() => now().getTime());
  const today = () => now().toISOString().slice(0, 10);
  const yesterday = () => new Date(now().getTime() - 86_400_000).toISOString().slice(0, 10);
  // The public address, when configured: the only trusted origin and the only
  // base for links in emails (request headers can be forged).
  const publicOrigin = deps.publicUrl ? new URL(deps.publicUrl).origin : null;
  const supportUrl = safeSupportUrl(deps.supportUrl);
  const contactEmail = safeContactEmail(deps.contactEmail);

  function isHttps(req: ApiRequest) {
    return deps.trustProxy === true && String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https";
  }

  function sessionCookie(req: ApiRequest, token: string | null) {
    const parts = [
      `${COOKIE}=${token ? encodeURIComponent(token) : ""}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${token ? SESSION_DAYS * 86_400 : 0}`,
    ];
    if (isHttps(req) || publicOrigin?.startsWith("https:")) parts.push("Secure");
    return parts.join("; ");
  }

  function corsHeaders(req: ApiRequest): Record<string, string> {
    const origin = req.headers.origin;
    if (!deps.devOrigins || !origin || !DEV_ORIGIN.test(origin)) return {};
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, OPTIONS",
      vary: "Origin",
    };
  }

  // Writes must come from our own pages (or a non-browser client) and be JSON.
  function checkWrite(req: ApiRequest) {
    const origin = req.headers.origin;
    if (origin) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {}
      // With PUBLIC_URL set, only that origin counts (a proxy may rewrite Host).
      const ours = publicOrigin ? origin === publicOrigin : host !== "" && host === req.headers.host;
      if (!ours && !(deps.devOrigins && DEV_ORIGIN.test(origin))) throw new ApiError(403, "forbidden_origin");
    } else {
      const site = req.headers["sec-fetch-site"];
      if (site && site !== "same-origin" && site !== "none") throw new ApiError(403, "forbidden_origin");
    }
    if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      throw new ApiError(400, "bad_request");
    }
  }

  function parseBody(req: ApiRequest): any {
    if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) throw new ApiError(413, "too_large");
    if (!req.body) return {};
    try {
      const value = JSON.parse(req.body);
      if (typeof value !== "object" || value === null) throw new Error();
      return value;
    } catch {
      throw new ApiError(400, "bad_request");
    }
  }

  function limit(key: string, max: number, windowMs: number) {
    if (!limiter.hit(key, max, windowMs)) throw new ApiError(429, "rate_limited");
  }

  function requireUser(req: ApiRequest): SessionUser {
    const user = sessionUser(db, readCookie(req.headers.cookie, COOKIE), now());
    if (!user) throw new ApiError(401, "unauthorized");
    return user;
  }

  function prefsFor(userId: string) {
    const row = db.query("SELECT theme, unlocked_themes FROM prefs WHERE user_id = ?").get(userId) as
      | { theme: string | null; unlocked_themes: string }
      | null;
    return { theme: row?.theme ?? null, unlockedThemes: parseUnlocked(row?.unlocked_themes ?? "[]", knownClubIds(db)) };
  }

  function isKnownTheme(id: string) {
    return (THEME_IDS as readonly string[]).includes(id) || knownClubIds(db).has(id);
  }

  // Unlocks only ever grow, so a device that knows fewer can't erase any.
  function saveUnlocks(userId: string, theme: string | null, ids: unknown) {
    const merged = parseUnlocked([...prefsFor(userId).unlockedThemes, ...parseUnlocked(ids, knownClubIds(db))], knownClubIds(db));
    db.run(
      `INSERT INTO prefs (user_id, theme, unlocked_themes) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET theme = COALESCE(excluded.theme, prefs.theme), unlocked_themes = excluded.unlocked_themes`,
      [userId, theme, JSON.stringify(merged)],
    );
  }

  function progressFor(userId: string) {
    const row = db.query("SELECT date, board_key, data FROM progress WHERE user_id = ? AND date = ?").get(userId, today()) as
      | { date: string; board_key: string; data: string }
      | null;
    return row ? { date: row.date, boardKey: row.board_key, data: JSON.parse(row.data) } : null;
  }

  // Links in emails never come from request headers, which an attacker can
  // set: PUBLIC_URL, or during development the (allow-listed) dev origin.
  function linkBase(req: ApiRequest): string | null {
    if (publicOrigin) return publicOrigin;
    const origin = req.headers.origin;
    if (deps.devOrigins && origin && DEV_ORIGIN.test(origin)) return origin;
    return null;
  }

  async function route(req: ApiRequest): Promise<ApiResponse> {
    const { method, path } = req;
    if (WRITE_METHODS.has(method)) checkWrite(req);

    if (method === "POST" && path === "/api/auth/signup") {
      limit(`signup:${req.ip}`, 10, 60_000);
      const { token } = await signup(db, parseBody(req));
      return respond(200, { user: sessionUser(db, token, now()) }, { "set-cookie": sessionCookie(req, token) });
    }
    if (method === "POST" && path === "/api/auth/login") {
      limit(`login:${req.ip}`, 10, 60_000);
      const { token } = await login(db, parseBody(req));
      return respond(200, { user: sessionUser(db, token, now()) }, { "set-cookie": sessionCookie(req, token) });
    }
    if (method === "POST" && path === "/api/auth/logout") {
      logout(db, readCookie(req.headers.cookie, COOKIE));
      return respond(200, { ok: true }, { "set-cookie": sessionCookie(req, null) });
    }
    if (method === "POST" && path === "/api/auth/reset-request") {
      limit(`reset:${req.ip}`, 10, 60_000);
      const email = String(parseBody(req).email ?? "").trim().toLowerCase();
      // Same answer whether or not the account exists.
      if (email && limiter.hit(`reset-email:${email}`, 3, 3_600_000)) {
        const base = linkBase(req);
        if (!base) {
          console.error("Password reset requested but PUBLIC_URL is not set; no link sent.");
        } else {
          const reset = createResetToken(db, email, now());
          if (reset) {
            const link = `${base}/reset-password?token=${encodeURIComponent(reset.token)}`;
            deps.mail.sendReset(email, link).catch((error) => console.error("Reset email failed:", error));
          }
        }
      }
      return respond(200, { ok: true });
    }
    if (method === "POST" && path === "/api/auth/reset") {
      limit(`reset:${req.ip}`, 10, 60_000);
      const body = parseBody(req);
      await resetPassword(db, body.token, body.password, now());
      return respond(200, { ok: true });
    }

    // Works logged out too (email and password), so the web page for deleting
    // an account doesn't need the app.
    if (method === "POST" && path === "/api/auth/delete-account") {
      limit(`login:${req.ip}`, 10, 60_000);
      await deleteAccount(db, parseBody(req));
      return respond(200, { ok: true }, { "set-cookie": sessionCookie(req, null) });
    }

    if (method === "GET" && path === "/api/me") {
      const user = sessionUser(db, readCookie(req.headers.cookie, COOKIE), now());
      if (!user) return respond(200, { user: null, prefs: null, progress: null });
      return respond(200, { user, prefs: prefsFor(user.id), progress: progressFor(user.id) });
    }
    if (method === "PATCH" && path === "/api/me") {
      const user = requireUser(req);
      limit(`nickname:${user.id}`, 10, 60_000);
      setNickname(db, user.id, parseBody(req).nickname);
      return respond(200, { user: sessionUser(db, readCookie(req.headers.cookie, COOKIE), now()) });
    }
    if (method === "PUT" && path === "/api/me/prefs") {
      const user = requireUser(req);
      limit(`prefs:${user.id}`, 120, 60_000);
      const body = parseBody(req);
      const theme = body.theme == null ? null : String(body.theme);
      if (theme !== null && !isKnownTheme(theme)) throw new ApiError(400, "bad_request");
      saveUnlocks(user.id, theme, body.unlockedThemes);
      return respond(200, { prefs: prefsFor(user.id) });
    }
    if (method === "PUT" && path === "/api/me/progress") {
      const user = requireUser(req);
      limit(`progress:${user.id}`, 120, 60_000);
      const body = parseBody(req);
      const date = String(body.date ?? "");
      // Today's board (or yesterday's, for a tab left open over midnight).
      if ((date !== today() && date !== yesterday()) || typeof body.data !== "object" || body.data === null) {
        throw new ApiError(400, "bad_request");
      }
      db.run(
        `INSERT INTO progress (user_id, date, board_key, data, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET board_key = excluded.board_key, data = excluded.data, updated_at = excluded.updated_at`,
        [user.id, date, String(body.boardKey ?? ""), JSON.stringify(body.data), nowIso(now())],
      );
      return respond(200, { ok: true });
    }

    const boardMatch = /^\/api\/boards\/([^/]+)$/.exec(path);
    if (method === "GET" && boardMatch) {
      const board = getBoard(db, safeDecode(boardMatch[1]) ?? "", today());
      return board ? respond(200, board, { "cache-control": "public, max-age=300" }) : respond(404, { error: "not_found" });
    }
    if (method === "GET" && path === "/api/sb-key") {
      return respond(200, { key: await deps.sbKey.get() });
    }
    if (method === "GET" && path === "/api/config") {
      return respond(200, { supportUrl, contactEmail }, { "cache-control": "public, max-age=300" });
    }

    if (method === "POST" && path === "/api/scan") {
      // Guessing is limited by failed scans per address (20 a minute). Good
      // scans only meet a loose cap: a whole pub shares one Wi-Fi address.
      if (limiter.blocked(`scan-fail:${req.ip}`, 20)) throw new ApiError(429, "rate_limited");
      limit(`scan:${req.ip}`, 300, 60_000);
      const failed = (error: ApiError) => {
        limiter.hit(`scan-fail:${req.ip}`, 20, 60_000);
        return error;
      };
      const code = normalizeCode(parseBody(req).code);
      if (!code) throw failed(new ApiError(404, "invalid_code"));
      limit(`scan-code:${code}`, 120, 60_000);
      const user = sessionUser(db, readCookie(req.headers.cookie, COOKIE), now());
      let themeId: string;
      try {
        themeId = redeemCode(db, code, user?.id ?? null, now()).themeId;
      } catch (error) {
        throw error instanceof ApiError ? failed(error) : error;
      }
      if (user) saveUnlocks(user.id, null, [themeId]);
      return respond(200, { themeId, summary: getPackSummary(db, themeId) });
    }
    if (method === "GET" && path === "/api/themes") {
      return respond(200, { themes: listPacks(db) }, { "cache-control": "public, max-age=300" });
    }
    const themeMatch = /^\/api\/themes\/([^/]+)(\/logo)?$/.exec(path);
    if (method === "GET" && themeMatch) {
      const id = safeDecode(themeMatch[1]) ?? "";
      if (themeMatch[2]) {
        const logo = getLogo(db, id);
        if (!logo) return respond(404, { error: "not_found" });
        return {
          status: 200,
          headers: { "content-type": logo.type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
          body: logo.bytes,
        };
      }
      const pack = getPack(db, id);
      if (!pack) return respond(404, { error: "not_found" });
      const etag = `"v${pack.version}"`;
      const cache = { etag, "cache-control": "public, max-age=300" };
      if (req.headers["if-none-match"] === etag) return { status: 304, headers: cache, body: "" };
      return respond(200, pack, cache);
    }
    if (method === "GET" && path === "/api/leaderboard") {
      return respond(200, { rows: [] });
    }
    return respond(404, { error: "not_found" });
  }

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return { status: 204, headers: cors, body: "" };
    try {
      const res = await route(req);
      return { ...res, headers: { ...res.headers, ...cors } };
    } catch (error) {
      if (error instanceof ApiError) return respond(error.status, { error: error.code }, cors);
      console.error("API error:", error);
      return respond(500, { error: "server_error" }, cors);
    }
  };
}
