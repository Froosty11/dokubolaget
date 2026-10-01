import { beforeEach, describe, expect, test } from "bun:test";
import { openDb } from "./db";
import { putBoard } from "./boards";
import { createApi, type ApiRequest } from "./api";
import { join } from "path";
import { createCode } from "./codes";
import { loadThemePacks } from "./themePacks";

let db: ReturnType<typeof openDb>;
let mails: Array<{ to: string; link: string }>;
let api: ReturnType<typeof createApi>;
const TODAY = "2026-10-01";

beforeEach(() => {
  db = openDb(":memory:");
  mails = [];
  api = createApi({
    db,
    mail: { sendReset: async (to, link) => void mails.push({ to, link }) },
    sbKey: { get: async () => "abc123" },
    now: () => new Date(`${TODAY}T12:00:00Z`),
    trustProxy: false,
    devOrigins: false,
    publicUrl: "https://dokubolaget.se",
  });
});

function req(method: string, path: string, body?: unknown, extra: Partial<ApiRequest> & { cookie?: string } = {}): ApiRequest {
  return {
    method,
    path,
    ip: extra.ip ?? "1.2.3.4",
    body: body === undefined ? "" : JSON.stringify(body),
    headers: {
      host: "dokubolaget.se",
      origin: "https://dokubolaget.se",
      "content-type": "application/json",
      ...(extra.cookie ? { cookie: extra.cookie } : {}),
      ...(extra.headers ?? {}),
    },
  };
}
const json = (res: { body: string }) => JSON.parse(res.body || "null");
const cookieFrom = (res: { headers: Record<string, string> }) => res.headers["set-cookie"]?.split(";")[0] ?? "";
const user = { email: "anna@example.se", password: "hemligt123", nickname: "Anna" };

async function signedIn() {
  const res = await api(req("POST", "/api/auth/signup", user));
  return cookieFrom(res);
}

describe("auth", () => {
  test("signup sets a cookie and /api/me returns the user", async () => {
    const res = await api(req("POST", "/api/auth/signup", user));
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toContain("HttpOnly");
    expect(res.headers["set-cookie"]).toContain("SameSite=Lax");
    const me = json(await api(req("GET", "/api/me", undefined, { cookie: cookieFrom(res) })));
    expect(me.user).toEqual({ id: expect.any(String), email: "anna@example.se", nickname: "Anna" });
  });
  test("/api/me without a session returns user null", async () => {
    expect(json(await api(req("GET", "/api/me"))).user).toBeNull();
  });
  test("login, then logout clears the session", async () => {
    await signedIn();
    const login = await api(req("POST", "/api/auth/login", { email: "ANNA@example.se", password: "hemligt123" }));
    const cookie = cookieFrom(login);
    expect(login.status).toBe(200);
    const out = await api(req("POST", "/api/auth/logout", {}, { cookie }));
    expect(out.headers["set-cookie"]).toContain("Max-Age=0");
    expect(json(await api(req("GET", "/api/me", undefined, { cookie }))).user).toBeNull();
  });
  test("errors come back as codes", async () => {
    await signedIn();
    const res = await api(req("POST", "/api/auth/signup", user));
    expect(res.status).toBe(409);
    expect(json(res)).toEqual({ error: "email_taken" });
    const bad = await api(req("POST", "/api/auth/login", { email: user.email, password: "wrongwrong" }));
    expect([bad.status, json(bad).error]).toEqual([401, "bad_credentials"]);
  });
  test("the 11th login attempt in a minute is rate limited", async () => {
    let last;
    for (let i = 0; i < 11; i++) last = await api(req("POST", "/api/auth/login", { email: "x@y.se", password: "wrongwrong" }));
    expect([last!.status, json(last!).error]).toEqual([429, "rate_limited"]);
  });
});

describe("request checks", () => {
  test("a foreign origin is rejected", async () => {
    const res = await api(req("POST", "/api/auth/signup", user, { headers: { origin: "https://evil.example" } }));
    expect([res.status, json(res).error]).toEqual([403, "forbidden_origin"]);
  });
  test("a cross-site fetch without Origin is rejected", async () => {
    const res = await api(req("POST", "/api/auth/signup", user, { headers: { origin: "", "sec-fetch-site": "cross-site" } }));
    expect(res.status).toBe(403);
  });
  test("non-JSON writes are rejected", async () => {
    const res = await api(req("POST", "/api/auth/signup", user, { headers: { "content-type": "text/plain" } }));
    expect([res.status, json(res).error]).toEqual([400, "bad_request"]);
  });
  test("bodies over 64 KB are rejected", async () => {
    const cookie = await signedIn();
    const big = { date: TODAY, boardKey: "k", data: { blob: "x".repeat(70_000) } };
    const res = await api(req("PUT", "/api/me/progress", big, { cookie }));
    expect([res.status, json(res).error]).toEqual([413, "too_large"]);
  });
  test("unknown routes are 404", async () => {
    expect((await api(req("GET", "/api/nope"))).status).toBe(404);
  });
});

describe("password reset", () => {
  test("always answers ok, mails only real accounts, and the link works once", async () => {
    await signedIn();
    expect(json(await api(req("POST", "/api/auth/reset-request", { email: "nobody@x.se" })))).toEqual({ ok: true });
    expect(mails).toHaveLength(0);
    await api(req("POST", "/api/auth/reset-request", { email: "Anna@example.se" }));
    expect(mails).toHaveLength(1);
    expect(mails[0].link).toStartWith("https://dokubolaget.se/reset-password?token=");
    const token = new URL(mails[0].link).searchParams.get("token");
    expect((await api(req("POST", "/api/auth/reset", { token, password: "nyttlosen456" }))).status).toBe(200);
    expect((await api(req("POST", "/api/auth/reset", { token, password: "nyttlosen456" }))).status).toBe(400);
    expect((await api(req("POST", "/api/auth/login", { email: user.email, password: "nyttlosen456" }))).status).toBe(200);
  });
  test("an email can only request 3 resets an hour", async () => {
    await signedIn();
    for (let i = 0; i < 5; i++) await api(req("POST", "/api/auth/reset-request", { email: user.email }, { ip: `9.9.9.${i}` }));
    expect(mails).toHaveLength(3);
  });
});

describe("account data", () => {
  test("prefs validate theme ids and merge unlocks", async () => {
    const cookie = await signedIn();
    await api(req("PUT", "/api/me/prefs", { theme: "cyberwave", unlockedThemes: ["cyberwave", "speakeasy"] }, { cookie }));
    const res = await api(req("PUT", "/api/me/prefs", { theme: "prislista", unlockedThemes: ["modern", "bogus"] }, { cookie }));
    expect(json(res).prefs).toEqual({ theme: "prislista", unlockedThemes: ["cyberwave", "speakeasy", "modern"] });
    const bad = await api(req("PUT", "/api/me/prefs", { theme: "hacker", unlockedThemes: [] }, { cookie }));
    expect(bad.status).toBe(400);
    expect(json(await api(req("GET", "/api/me", undefined, { cookie }))).prefs.unlockedThemes).toContain("speakeasy");
  });
  test("progress round-trips for today only", async () => {
    const cookie = await signedIn();
    const data = { selectedProductsByCell: { 1: { id: "p1" } }, missesByCell: {}, rejectedByCell: {} };
    await api(req("PUT", "/api/me/progress", { date: TODAY, boardKey: "k", data }, { cookie }));
    expect(json(await api(req("GET", "/api/me", undefined, { cookie }))).progress).toEqual({ date: TODAY, boardKey: "k", data });
    expect((await api(req("PUT", "/api/me/progress", { date: "2099-01-01", boardKey: "k", data }, { cookie }))).status).toBe(400);
  });
  test("account routes need a session", async () => {
    expect((await api(req("PUT", "/api/me/prefs", { theme: "prislista", unlockedThemes: [] }))).status).toBe(401);
  });
  test("nickname changes", async () => {
    const cookie = await signedIn();
    const res = await api(req("PATCH", "/api/me", { nickname: "Annika" }, { cookie }));
    expect(json(res).user.nickname).toBe("Annika");
  });
});

describe("boards and misc", () => {
  test("today's board is readable, tomorrow's is not", async () => {
    putBoard(db, TODAY, { rows: [{ id: "a", label: "A", family: "f" }], cols: [] });
    putBoard(db, "2026-10-02", { rows: [], cols: [] });
    expect(json(await api(req("GET", `/api/boards/${TODAY}`))).rows[0].id).toBe("a");
    expect((await api(req("GET", "/api/boards/2026-10-02"))).status).toBe(404);
  });
  test("sb-key and leaderboard", async () => {
    expect(json(await api(req("GET", "/api/sb-key")))).toEqual({ key: "abc123" });
    expect(json(await api(req("GET", "/api/leaderboard")))).toEqual({ rows: [] });
  });
});

describe("review fixes", () => {
  function prodApi(publicUrl?: string) {
    return createApi({
      db,
      mail: { sendReset: async (to, link) => void mails.push({ to, link }) },
      sbKey: { get: async () => "k" },
      now: () => new Date(`${TODAY}T12:00:00Z`),
      devOrigins: false,
      publicUrl,
    });
  }

  test("reset links always use PUBLIC_URL, whatever Host/Origin say", async () => {
    const prod = prodApi("https://dokubolaget.se");
    await prod(req("POST", "/api/auth/signup", user));
    await prod(req("POST", "/api/auth/reset-request", { email: user.email }, { headers: { host: "evil.example", origin: "" } }));
    expect(mails).toHaveLength(1);
    expect(mails[0].link).toStartWith("https://dokubolaget.se/reset-password?token=");
  });
  test("without PUBLIC_URL in production no reset link is sent", async () => {
    const prod = prodApi(undefined);
    await prod(req("POST", "/api/auth/signup", user));
    const res = await prod(req("POST", "/api/auth/reset-request", { email: user.email }));
    expect(json(res)).toEqual({ ok: true });
    expect(mails).toHaveLength(0);
  });
  test("with PUBLIC_URL, Origin must match it even if a proxy rewrote Host", async () => {
    const prod = prodApi("https://dokubolaget.se");
    const ok = await prod(req("POST", "/api/auth/signup", user, { headers: { host: "127.0.0.1:8080" } }));
    expect(ok.status).toBe(200);
    const bad = await prod(req("POST", "/api/auth/login", user, { headers: { host: "evil.example", origin: "https://evil.example" } }));
    expect(bad.status).toBe(403);
  });
  test("progress only for today or yesterday", async () => {
    const cookie = await signedIn();
    const data = { selectedProductsByCell: {}, missesByCell: {}, rejectedByCell: {} };
    expect((await api(req("PUT", "/api/me/progress", { date: "0001-01-01", boardKey: "k", data }, { cookie }))).status).toBe(400);
    expect((await api(req("PUT", "/api/me/progress", { date: "2026-09-30", boardKey: "k", data }, { cookie }))).status).toBe(200);
  });
  test("a malformed cookie or path is not a server error", async () => {
    expect((await api(req("GET", "/api/me", undefined, { cookie: "doku_session=%E0%A4%A" }))).status).toBe(200);
    expect((await api(req("GET", "/api/boards/%E0%A4%A"))).status).toBe(404);
  });
});

describe("account deletion", () => {
  test("deletes the account and everything stored for it", async () => {
    const cookie = await signedIn();
    await api(req("PUT", "/api/me/prefs", { theme: "midsommar", unlockedThemes: ["cyberwave"] }, { cookie }));
    await api(req("PUT", "/api/me/progress", { date: TODAY, boardKey: "k", data: { selectedProductsByCell: {} } }, { cookie }));
    await api(req("POST", "/api/auth/reset-request", { email: user.email }));

    const res = await api(req("POST", "/api/auth/delete-account", { email: user.email, password: user.password }, { cookie }));
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toContain("Max-Age=0");
    expect(json(await api(req("GET", "/api/me", undefined, { cookie }))).user).toBeNull();
    for (const table of ["users", "sessions", "password_resets", "prefs", "progress"]) {
      expect((db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n).toBe(0);
    }
    // The email and nickname are free again.
    expect((await api(req("POST", "/api/auth/signup", user))).status).toBe(200);
  });
  test("needs the right password, and leaves other accounts alone", async () => {
    await signedIn();
    await api(req("POST", "/api/auth/signup", { email: "bo@example.se", password: "hemligt456", nickname: "Bo" }));
    const bad = await api(req("POST", "/api/auth/delete-account", { email: user.email, password: "wrongwrong" }));
    expect([bad.status, json(bad).error]).toEqual([401, "bad_credentials"]);
    const ok = await api(req("POST", "/api/auth/delete-account", { email: "BO@example.se", password: "hemligt456" }));
    expect(ok.status).toBe(200);
    expect((db.query("SELECT nickname FROM users").all() as Array<{ nickname: string }>).map((u) => u.nickname)).toEqual(["Anna"]);
  });
  test("is blocked from other sites", async () => {
    await signedIn();
    const res = await api(
      req("POST", "/api/auth/delete-account", { email: user.email, password: user.password }, { headers: { origin: "https://evil.example" } }),
    );
    expect(res.status).toBe(403);
  });
});

describe("support link", () => {
  test("is null until configured", async () => {
    expect(json(await api(req("GET", "/api/config"))).supportUrl).toBeNull();
  });
  test("passes https links and drops anything else", async () => {
    const make = (supportUrl: string) =>
      createApi({ db, mail: { sendReset: async () => {} }, sbKey: { get: async () => "" }, supportUrl });
    expect(json(await make("https://ko-fi.com/dokubolaget")(req("GET", "/api/config"))).supportUrl).toBe("https://ko-fi.com/dokubolaget");
    expect(json(await make("javascript:alert(1)")(req("GET", "/api/config"))).supportUrl).toBeNull();
    expect(json(await make("http://ko-fi.com/x")(req("GET", "/api/config"))).supportUrl).toBeNull();
  });
});

describe("club themes and scanning", () => {
  beforeEach(() => {
    loadThemePacks(db, join(import.meta.dir, "fixtures", "club-themes"), () => {});
  });
  const scan = (code: string, extra: Partial<ApiRequest> & { cookie?: string } = {}) =>
    api(req("POST", "/api/scan", { code }, extra));

  test("a good code returns the theme and its summary", async () => {
    const { code } = createCode(db, { themeId: "club-sample", label: "Poster" });
    const res = await scan(code);
    expect(res.status).toBe(200);
    expect(json(res).themeId).toBe("club-sample");
    expect(json(res).summary.club.venue).toBe("Testpuben");
  });

  test("a logged-in scan is saved to the account by the server", async () => {
    const cookie = await signedIn();
    const { code } = createCode(db, { themeId: "club-sample", label: "Poster" });
    await scan(code, { cookie });
    expect(json(await api(req("GET", "/api/me", undefined, { cookie }))).prefs.unlockedThemes).toEqual(["club-sample"]);
  });

  test("bad and expired codes get their own errors", async () => {
    const bad = await scan("AAAA-AAAA-AA");
    expect([bad.status, json(bad).error]).toEqual([404, "invalid_code"]);
    const { code } = createCode(db, { themeId: "club-sample", label: "x", expiresAt: "2020-01-01T00:00:00.000Z" });
    const expired = await scan(code);
    expect([expired.status, json(expired).error]).toEqual([410, "code_expired"]);
  });

  test("the 21st scan in a minute from one address is rate limited", async () => {
    let last;
    for (let i = 0; i < 21; i++) last = await scan("AAAA-AAAA-AA", { ip: "9.9.9.9" });
    expect([last!.status, json(last!).error]).toEqual([429, "rate_limited"]);
  });

  test("scans from other sites are refused", async () => {
    const res = await scan("AAAA-AAAA-AA", { headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  test("the club theme list, the theme itself and its logo", async () => {
    const list = json(await api(req("GET", "/api/themes")));
    expect(list.themes.map((t: any) => t.id)).toEqual(["club-sample"]);
    const theme = await api(req("GET", "/api/themes/club-sample"));
    expect(theme.status).toBe(200);
    expect(theme.headers.etag).toBe('"v1"');
    expect(json(theme).fontKit).toBe("prislista");
    const cached = await api(req("GET", "/api/themes/club-sample", undefined, { headers: { "if-none-match": '"v1"' } }));
    expect([cached.status, cached.body]).toEqual([304, ""]);
    const logo = await api(req("GET", "/api/themes/club-sample/logo"));
    expect(logo.headers["content-type"]).toBe("image/png");
    expect(logo.headers["x-content-type-options"]).toBe("nosniff");
    expect(logo.body instanceof Uint8Array).toBe(true);
    expect((await api(req("GET", "/api/themes/club-ghost"))).status).toBe(404);
  });

  test("saved unlocks keep known club themes and drop unknown ones", async () => {
    const cookie = await signedIn();
    await api(req("PUT", "/api/me/prefs", { theme: "club-sample", unlockedThemes: ["club-sample", "club-ghost", "cyberwave"] }, { cookie }));
    const prefs = json(await api(req("GET", "/api/me", undefined, { cookie }))).prefs;
    expect(prefs.unlockedThemes).toEqual(["cyberwave", "club-sample"]);
    expect(prefs.theme).toBe("club-sample");
  });
});

describe("contact email", () => {
  const make = (contactEmail?: string) =>
    createApi({ db, mail: { sendReset: async () => {} }, sbKey: { get: async () => "" }, contactEmail });
  test("is passed on when it looks like an email", async () => {
    expect(json(await make("e@dokubolaget.se")(req("GET", "/api/config"))).contactEmail).toBe("e@dokubolaget.se");
    expect(json(await make("not an email")(req("GET", "/api/config"))).contactEmail).toBeNull();
    expect(json(await make()(req("GET", "/api/config"))).contactEmail).toBeNull();
  });
});
