import { afterEach, expect, test } from "bun:test";
import { observable } from "mobx";
import { createThemeState } from "./theme/themeState";
import { connectToServer } from "./serverSync";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function makeModel() {
  const base = { account: null as any, setAccount(a: any) { this.account = a; } };
  return observable(Object.defineProperties(base, Object.getOwnPropertyDescriptors(createThemeState())) as any);
}

function stubServer(unlocked: string[], longestStreak: number) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    if (String(url).endsWith("/api/me")) {
      return new Response(JSON.stringify({
        user: { id: "u", email: "a@b.se", nickname: "A" },
        prefs: { theme: null, unlockedThemes: unlocked },
        progress: null,
        stats: { currentStreak: longestStreak, longestStreak, finishedCount: longestStreak, unicorns: 0 },
      }));
    }
    return new Response(JSON.stringify({ ok: true, prefs: { theme: "prislista", unlockedThemes: unlocked }, board: null, newUnlocks: [] }));
  }) as any;
  return calls;
}

test("the account's streak comes from the server's stats", async () => {
  const model = makeModel();
  stubServer(["modern"], 9);
  const sync = connectToServer(model, { announced: { read: async () => ["modern"], write: async () => {} } });
  await sync.refresh();
  expect(model.longestStreak).toBe(9);
  expect(model.unlockedThemes).toContain("modern");
});

test("the player's stats reach the model for the leaderboard", async () => {
  const model = makeModel();
  model.stats = null;
  model.setStats = function (stats: any) { this.stats = stats; };
  stubServer([], 4);
  const sync = connectToServer(model, { announced: { read: async () => [], write: async () => {} } });
  await sync.refresh();
  expect(model.stats).toEqual({ currentStreak: 4, longestStreak: 4, finishedCount: 4, unicorns: 0 });

  globalThis.fetch = (async () => new Response(JSON.stringify({ user: null, prefs: null, progress: null, stats: null }))) as any;
  await sync.refresh();
  expect(model.stats).toBeNull();
});

test("earned themes the device hasn't announced are queued once", async () => {
  const model = makeModel();
  stubServer(["cyberwave", "modern"], 7);
  let stored: string[] = ["cyberwave"];
  const sync = connectToServer(model, { announced: { read: async () => stored, write: async (ids) => void (stored = ids) } });
  await sync.refresh();
  expect(model.shiftPendingUnlock()).toBe("modern");
  expect(stored).toEqual(["cyberwave", "modern"]);
});

test("logging in claims the device's board", async () => {
  const model = makeModel();
  const calls = stubServer([], 0);
  const sync = connectToServer(model, { announced: { read: async () => [], write: async () => {} } });
  await sync.afterLogin();
  expect(calls.some((c) => c.endsWith("/api/play/claim"))).toBe(true);
});

test("a theme announced during play isn't announced again on the next start", async () => {
  const model = makeModel();
  stubServer(["cyberwave"], 0);
  let stored: string[] | null = [];
  const announced = { read: async () => stored, write: async (ids: string[]) => void (stored = ids) };
  const sync = connectToServer(model, { announced });
  await sync.refresh();
  expect(model.shiftPendingUnlock()).toBe("cyberwave");
  // A finished board earns Speakeasy; the guess response announces it.
  model.addUnlocks(["speakeasy"], "board");
  expect(model.shiftPendingUnlock()).toBe("speakeasy");
  await new Promise((resolve) => setTimeout(resolve, 0));
  stubServer(["cyberwave", "speakeasy"], 0);
  const next = makeModel();
  await connectToServer(next, { announced }).refresh();
  expect(next.shiftPendingUnlock()).toBeNull();
});

test("logging out starts a clean board on the device instead of reverting the account's cells", async () => {
  const { createPlaySync } = await import("./play/playSync");
  const { createOutbox } = await import("./play/outbox");
  const data = new Map<string, string>();
  const storage = { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
  const model = makeModel();
  Object.assign(model, {
    boardDate: "2026-10-02", playMode: "daily", practiceDay: null, boardStatus: "ready", guessListener: null,
    selectedProductsByCell: { 1: { raw: { productNumber: "1001" } }, 2: { raw: { productNumber: "1002" } } },
    missesByCell: { 3: 1 }, cellInfo: { 1: { score: 80, share: 0.1, unicorn: false } }, serverBoard: null, syncNotice: null,
  });
  model.resetDailyBoard = function () {
    this.selectedProductsByCell = {};
    this.missesByCell = {};
    this.cellInfo = {};
    this.serverBoard = null;
  };
  // Like the real model: a filled cell the server doesn't have is reverted with a notice.
  model.applyServerBoard = function (board: any) {
    for (const cell of board.cells) if (!cell.productNumber && this.selectedProductsByCell[cell.cell]) this.syncNotice = "Couldn't verify a pick.";
    this.serverBoard = board;
  };
  model.applyGuessResponse = () => {};
  const day = "2026-10-02";
  const empty = { day, cells: Array.from({ length: 9 }, (_, i) => ({ cell: i + 1, productNumber: null, product: null, misses: 0, score: null, share: null, unicorn: false })), score: 0, solved: 0, misses: 0, unicorns: 0, finished: false, perfect: false };
  globalThis.fetch = (async (url: string) => {
    if (String(url).endsWith("/api/play/today")) return new Response(JSON.stringify(empty));
    if (String(url).endsWith("/api/play/guess")) return new Response(JSON.stringify({ error: "catalog_unavailable" }), { status: 503 });
    if (String(url).endsWith("/api/me")) return new Response(JSON.stringify({ user: null, prefs: null, progress: null, stats: null }));
    return new Response(JSON.stringify({ ok: true }));
  }) as any;
  const outbox = createOutbox(storage);
  const { api } = await import("./api");
  const play = createPlaySync({ api, outbox, model, today: () => day });
  await play.start();
  await outbox.add({ day, cell: 4, productNumber: "1004", practice: false });
  await outbox.add({ day: "2026-09-20", cell: 5, productNumber: "1005", practice: true });
  const sync = connectToServer(model, { announced: { read: async () => [], write: async () => {} }, play });
  await sync.logout();
  expect(model.selectedProductsByCell).toEqual({});
  expect(model.cellInfo).toEqual({});
  expect(model.syncNotice).toBe("Logged out. Today's board stays with your account.");
  expect(model.serverBoard?.day).toBe(day); // play was refreshed
  expect(outbox.items().map((i) => i.practice)).toEqual([true]);
});

test("logging out sends what it can for the account before the session ends", async () => {
  const model = makeModel();
  const order: string[] = [];
  globalThis.fetch = (async (url: string) => {
    order.push(String(url).replace(/^.*\/api/, "/api"));
    return new Response(JSON.stringify({ ok: true, user: null }));
  }) as any;
  const play = { forgetToday: async () => void order.push("forgetToday"), refresh: async () => void order.push("refresh") };
  const sync = connectToServer(model, { announced: { read: async () => [], write: async () => {} }, play });
  await sync.logout();
  expect(order.indexOf("forgetToday")).toBeLessThan(order.indexOf("/api/auth/logout"));
  expect(order.at(-1)).toBe("refresh");
});
