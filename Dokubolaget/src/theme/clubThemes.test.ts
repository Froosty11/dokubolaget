import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { contrastProblems } from "./contrast";
import { createClubThemes, packToTheme } from "./clubThemes";
import { FONT_KIT_FONTS } from "./fontKits";
import type { PackSummary, ThemePack } from "./packSchema";
import { clubTheme } from "./registry";
import { createThemeState } from "./themeState";
import type { Theme } from "./types";

const fixture = (): ThemePack => JSON.parse(readFileSync(new URL("../../server/fixtures/club-themes/sample/theme.json", import.meta.url), "utf8"));
const withId = (id: string, version = 1): ThemePack => ({ ...fixture(), id: id as ThemePack["id"], version });
const summaryOf = (pack: ThemePack): PackSummary => ({
  id: pack.id, version: pack.version, name: pack.copy.en.name, club: pack.club,
  swatch: [pack.colors.page, pack.colors.accent, pack.colors.highlight], logoUrl: null,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: async (k: string) => data[k] ?? null, setItem: async (k: string, v: string) => void (data[k] = v) };
}

function fakeApi(packs: ThemePack[], fail = false) {
  const fetched: string[] = [];
  return {
    fetched,
    themes: async () => {
      if (fail) throw new Error("offline");
      return { themes: packs.map(summaryOf) };
    },
    theme: async (id: string) => {
      if (fail) throw new Error("offline");
      fetched.push(id);
      const pack = packs.find((p) => p.id === id);
      if (!pack) throw new Error("not found");
      return pack;
    },
  };
}

describe("packToTheme", () => {
  test("builds a normal theme that passes the same contrast checks", () => {
    const theme = packToTheme(fixture());
    expect(theme.id).toBe("club-sample");
    expect(theme.unlock).toEqual({ kind: "scan" });
    expect(theme.fonts).toEqual(FONT_KIT_FONTS.prislista);
    expect(theme.haptics).toBe("receipt");
    expect(theme.decoration).toEqual({ kind: "none", colors: [] });
    expect(contrastProblems(theme.colors)).toEqual([]);
  });

  test("carries the club's logo for the header, versioned so a new logo isn't cached", () => {
    expect(packToTheme({ ...fixture(), version: 3 }).logo).toEqual({ url: "/api/themes/club-sample/logo?v=3", width: 64, height: 64 });
    expect(packToTheme({ ...fixture(), logo: null }).logo).toBeNull();
  });
});

describe("club theme cache", () => {
  test("loadCache registers valid cached themes and drops broken ones", async () => {
    const broken = { ...withId("club-broken"), fontKit: "comic" };
    const storage = memoryStorage({ "dokubolaget.themePacks": JSON.stringify({ "club-c1": withId("club-c1"), "club-broken": broken }) });
    const registered: Theme[] = [];
    const store = createClubThemes({ storage, api: fakeApi([]), register: (t) => void registered.push(t) });
    await store.loadCache();
    expect(registered.map((t) => t.id)).toEqual(["club-c1"]);
    expect(store.get("club-broken")).toBeUndefined();
  });

  test("ensure downloads, caches and registers once", async () => {
    const storage = memoryStorage();
    const api = fakeApi([withId("club-e1")]);
    const store = createClubThemes({ storage, api, register: () => {} });
    expect(await store.ensure("club-e1")).toBe(true);
    expect(await store.ensure("club-e1")).toBe(true);
    expect(api.fetched).toEqual(["club-e1"]);
    expect(JSON.parse(storage.data["dokubolaget.themePacks"])["club-e1"].version).toBe(1);
    expect(await store.ensure("club-nope")).toBe(false);
  });

  test("refresh re-downloads unlocked themes only when the server has a newer version", async () => {
    const storage = memoryStorage({ "dokubolaget.themePacks": JSON.stringify({ "club-r1": withId("club-r1", 1), "club-r2": withId("club-r2", 1) }) });
    const api = fakeApi([withId("club-r1", 2), withId("club-r2", 1), withId("club-r3", 1)]);
    const store = createClubThemes({ storage, api, register: () => {} });
    await store.loadCache();
    const summaries = await store.refresh(["cyberwave", "club-r1", "club-r2"]);
    expect(summaries.map((s) => s.id)).toEqual(["club-r1", "club-r2", "club-r3"]);
    expect(api.fetched).toEqual(["club-r1"]);
    expect(store.get("club-r1")?.version).toBe(2);
    expect(JSON.parse(storage.data["dokubolaget.clubThemeSummaries"])).toHaveLength(3);
  });

  test("offline, refresh keeps the saved list", async () => {
    const saved = [summaryOf(withId("club-s1"))];
    const storage = memoryStorage({ "dokubolaget.clubThemeSummaries": JSON.stringify(saved) });
    const store = createClubThemes({ storage, api: fakeApi([], true), register: () => {} });
    await store.loadCache();
    expect((await store.refresh(["club-s1"])).map((s) => s.id)).toEqual(["club-s1"]);
    expect(store.offline()).toBe(true);
  });

  test("an active club theme whose cache was cleared falls back to the default", async () => {
    const store = createClubThemes({ storage: memoryStorage(), api: fakeApi([], true), register: () => {} });
    await store.loadCache();
    expect(await store.ensure("club-gone")).toBe(false);
    const state = createThemeState();
    state.addUnlocks(["club-gone"], false);
    state.themeId = "club-gone";
    expect(clubTheme("club-gone")).toBeUndefined();
    expect(state.activeThemeId).toBe("prislista");
  });
});
