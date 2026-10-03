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
