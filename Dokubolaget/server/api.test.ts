import { beforeEach, describe, expect, test } from "bun:test";
import { openDb } from "./db";
import { putBoard } from "./boards";
import { createApi, type ApiRequest } from "./api";
import { join } from "path";
import { createCatalog } from "./catalog";
import { createCode } from "./codes";
import { createPlay } from "./play";
import { loadThemePacks } from "./themePacks";
import { grantUnlocks } from "./unlocks";

let db: ReturnType<typeof openDb>;
let mails: Array<{ to: string; link: string }>;
let api: ReturnType<typeof createApi>;
let clock: Date;
const TODAY = "2026-10-01";

beforeEach(() => {
  db = openDb(":memory:");
  mails = [];
  clock = new Date(`${TODAY}T12:00:00Z`);
  const play = createPlay({ db, catalog: createCatalog({ path: join(import.meta.dir, "fixtures", "products.json") }), now: () => clock, cacheMs: 0 });
  api = createApi({
    db,
    play,
    mail: { sendReset: async (to, link) => void mails.push({ to, link }) },
    sbKey: { get: async () => "abc123" },
    now: () => clock,
    trustProxy: false,
    devOrigins: false,
    publicUrl: "https://dokubolaget.se",
  });
});

function req(method: string, pathWithQuery: string, body?: unknown, extra: Partial<ApiRequest> & { cookie?: string } = {}): ApiRequest {
  const [path, query = ""] = pathWithQuery.split("?");
  return {
    method,
    path,
    query,
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
    await api(req("PUT", "/api/me/prefs", { theme: "midsommar", unlockedThemes: ["prislista"] }, { cookie }));
    const res = await api(req("PUT", "/api/me/prefs", { theme: "prislista", unlockedThemes: ["midsommar", "bogus"] }, { cookie }));
    expect(json(res).prefs).toEqual({ theme: "prislista", unlockedThemes: ["prislista", "midsommar"] });
    const bad = await api(req("PUT", "/api/me/prefs", { theme: "hacker", unlockedThemes: [] }, { cookie }));
    expect(bad.status).toBe(400);
    expect(json(await api(req("GET", "/api/me", undefined, { cookie }))).prefs.unlockedThemes).toContain("midsommar");
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
    expect(json(await api(req("GET", "/api/leaderboard?period=today")))).toEqual({ period: "today", provisional: true, rows: [], me: null });
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

  test("a whole pub scanning one poster from the same Wi-Fi isn't blocked", async () => {
    const { code } = createCode(db, { themeId: "club-sample", label: "Poster" });
    const statuses = [];
    for (let i = 0; i < 25; i++) statuses.push((await scan(code, { ip: "8.8.8.8" })).status);
    expect(statuses.every((status) => status === 200)).toBe(true);
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

  test("saved unlocks keep known club themes and drop unknown and earned ones", async () => {
    const cookie = await signedIn();
    await api(req("PUT", "/api/me/prefs", { theme: "club-sample", unlockedThemes: ["club-sample", "club-ghost", "cyberwave"] }, { cookie }));
    const prefs = json(await api(req("GET", "/api/me", undefined, { cookie }))).prefs;
    expect(prefs.unlockedThemes).toEqual(["club-sample"]);
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

describe("play", () => {
  const DEVICE = "0b6f2a54-4c1e-4a8b-9d3e-1f2a3b4c5d6e";
  const T = (id: string) => ({ id, label: id, family: "f" });
  const BOARD = {
    rows: [T("Country:Spanien"), T("Country:Frankrike"), T("Country:Sverige")],
    cols: [T("Beverage:Rött vin"), T("Beverage:Vitt vin"), T("Beverage:Rosévin")],
    counts: [[200, 50, 10], [100, 80, 5], [20, 30, 5]],
  };
  const dev = { headers: { "x-doku-device": DEVICE } };
  beforeEach(() => {
    putBoard(db, "2026-09-30", BOARD);
    putBoard(db, TODAY, BOARD);
  });

  test("a guess needs a device id or a session", async () => {
    const res = await api(req("POST", "/api/play/guess", { id: "g1", day: TODAY, cell: 1, productNumber: "1001" }));
    expect([res.status, json(res).error]).toEqual([400, "no_player"]);
    const bad = await api(req("POST", "/api/play/guess", { id: "g1", day: TODAY, cell: 1, productNumber: "1001" }, { headers: { "x-doku-device": "not-a-uuid" } }));
    expect(bad.status).toBe(400);
  });

  test("a correct guess scores and shows on today's board", async () => {
    const res = json(await api(req("POST", "/api/play/guess", { id: "g1", day: TODAY, cell: 1, productNumber: "1001" }, dev)));
    expect(res.verdict).toBe("correct");
    expect(res.cell).toMatchObject({ cell: 1, productNumber: "1001", score: 75, unicorn: true });
    expect(res.board).toMatchObject({ solved: 1, score: 75 });
    const today = json(await api(req("GET", "/api/play/today", undefined, dev)));
    expect(today.cells[0].product.productNameBold).toBe("Rioja Test");
  });

  test("bad input is a 400; an ended day is day_over", async () => {
    for (const body of [{ id: "g", day: TODAY, cell: 0, productNumber: "1001" }, { id: "g", day: TODAY, cell: 1, productNumber: "abc" }, { day: TODAY, cell: 1, productNumber: "1001" }]) {
      expect((await api(req("POST", "/api/play/guess", body, dev))).status).toBe(400);
    }
    const ended = await api(req("POST", "/api/play/guess", { id: "g", day: "2026-09-30", cell: 1, productNumber: "1001" }, dev));
    expect(json(ended).error).toBe("day_over");
  });

  test("the catalogue being down is a 503 the app can retry (review focus 3)", async () => {
    const down = createApi({
      db,
      play: createPlay({ db, catalog: createCatalog({ path: null, lookup: async () => { throw new Error("down"); } }), now: () => clock }),
      mail: { sendReset: async () => {} },
      sbKey: { get: async () => "k" },
      now: () => clock,
      publicUrl: "https://dokubolaget.se",
    });
    const res = await down(req("POST", "/api/play/guess", { id: "g", day: TODAY, cell: 1, productNumber: "1001" }, dev));
    expect([res.status, json(res).error]).toEqual([503, "catalog_unavailable"]);
  });

  test("answers for today unlock once your board is finished", async () => {
    const res = await api(req("GET", `/api/play/answers?day=${TODAY}`, undefined, dev));
    expect([res.status, json(res).error]).toEqual([403, "not_finished"]);
    const past = await api(req("GET", "/api/play/answers?day=2026-09-30", undefined, dev));
    expect(json(past).answers).toHaveLength(9);
  });

  test("claim after login moves the device's board and /api/me has stats", async () => {
    await api(req("POST", "/api/play/guess", { id: "g1", day: TODAY, cell: 1, productNumber: "1001" }, dev));
    const cookie = await signedIn();
    const claimed = json(await api(req("POST", "/api/play/claim", {}, { cookie, ...dev })));
    expect(claimed.board.cells[0].productNumber).toBe("1001");
    const me = json(await api(req("GET", "/api/me", undefined, { cookie })));
    expect(me.stats).toEqual({ currentStreak: 0, longestStreak: 0, finishedCount: 0, unicorns: 1 });
  });

  test("prefs can no longer claim earned themes", async () => {
    const cookie = await signedIn();
    const res = json(await api(req("PUT", "/api/me/prefs", { theme: null, unlockedThemes: ["cyberwave", "modern", "midsommar"] }, { cookie })));
    expect(res.prefs.unlockedThemes).not.toContain("cyberwave");
    expect(res.prefs.unlockedThemes).not.toContain("modern");
  });

  test("leaderboard periods and the archive", async () => {
    expect((await api(req("GET", "/api/leaderboard?period=nonsense"))).status).toBe(400);
    const month = json(await api(req("GET", "/api/archive?month=2026-09", undefined, dev)));
    expect(month.days.map((d: any) => d.day)).toEqual(["2026-09-30"]);
    const day = json(await api(req("GET", "/api/archive/2026-09-30", undefined, dev)));
    expect(day.board.rows).toHaveLength(3);
    expect(day.answers).toHaveLength(9);
    expect((await api(req("GET", `/api/archive/${TODAY}`, undefined, dev))).status).toBe(404);
  });

  test("the device header is allowed through CORS in development", async () => {
    const devApi = createApi({ db, play: createPlay({ db, catalog: createCatalog({ path: null }) }), mail: { sendReset: async () => {} }, sbKey: { get: async () => "k" }, devOrigins: true });
    const res = await devApi({ method: "OPTIONS", path: "/api/play/guess", headers: { origin: "http://localhost:8081" }, body: "", ip: "1" });
    expect(res.headers["access-control-allow-headers"]).toContain("x-doku-device");
  });

  test("prefs refuse an unearned earned theme, but allow one the account holds", async () => {
    const cookie = await signedIn();
    const bad = await api(req("PUT", "/api/me/prefs", { theme: "cyberwave", unlockedThemes: [] }, { cookie }));
    expect(bad.status).toBe(400);
    const me = json(await api(req("GET", "/api/me", undefined, { cookie })));
    grantUnlocks(db, me.user.id, ["cyberwave"]);
    const ok = await api(req("PUT", "/api/me/prefs", { theme: "cyberwave", unlockedThemes: [] }, { cookie }));
    expect(json(ok).prefs.theme).toBe("cyberwave");
  });

  test("finishing today's board on the last correct guess unlocks cyberwave", async () => {
    const cookie = await signedIn();
    const guesses: Array<[number, string]> = [
      [1, "1001"], [2, "1004"], [3, "1009"], [4, "1010"], [5, "1003"], [6, "1011"], [7, "1006"], [8, "1007"], [9, "1008"],
    ];
    let last;
    for (const [cell, productNumber] of guesses) {
      last = await api(req("POST", "/api/play/guess", { id: `fin${cell}`, day: TODAY, cell, productNumber }, { cookie }));
    }
    expect(json(last!).newUnlocks).toContain("cyberwave");
  });

  test("the 121st guess in a minute from one player returns 429 rate_limited", async () => {
    let last;
    for (let i = 0; i < 121; i++) {
      // A miss (wrong country and category) on the same cell, so no distinct
      // products are needed to exhaust the per-player guess budget.
      last = await api(req("POST", "/api/play/guess", { id: `m${i}`, day: TODAY, cell: 1, productNumber: "1003" }, dev));
    }
    expect([last!.status, json(last!).error]).toEqual([429, "rate_limited"]);
  });

  test("the 301st read in a minute from one IP returns 429 on /api/leaderboard", async () => {
    let last;
    for (let i = 0; i < 301; i++) {
      last = await api(req("GET", "/api/leaderboard?period=today", undefined, { ip: "7.7.7.7" }));
    }
    expect([last!.status, json(last!).error]).toEqual([429, "rate_limited"]);
  });
});
