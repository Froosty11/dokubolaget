import { describe, expect, test } from "bun:test";
import type { Theme } from "./types";
import { modern } from "./themes/modern";
import {
  availableThemeIds, mergeUnlocked, parseThemeId, parseUnlocked,
  resolveActiveThemeId, unlockProgress, unlocksForBoard, unlocksForStreak,
} from "./unlocks";

const t = (id: Theme["id"], unlock: Theme["unlock"]): Theme => ({ ...modern, id, unlock });
const ALL = [
  t("prislista", { kind: "always" }), t("midsommar", { kind: "always" }),
  t("cyberwave", { kind: "firstBoard" }), t("speakeasy", { kind: "perfectBoard" }),
  t("modern", { kind: "streak", days: 7 }),
];
const none = { unlocked: [], longestStreak: 0, loggedIn: false };

describe("availableThemeIds", () => {
  test("new player gets the always-available themes", () =>
    expect(availableThemeIds(ALL, none)).toEqual(["prislista", "midsommar"]));
  test("earned unlocks count, in registry order", () =>
    expect(availableThemeIds(ALL, { ...none, unlocked: ["speakeasy", "cyberwave"] }))
      .toEqual(["prislista", "midsommar", "cyberwave", "speakeasy"]));
  test("streak theme needs login", () => {
    expect(availableThemeIds(ALL, { ...none, longestStreak: 9 })).not.toContain("modern");
    expect(availableThemeIds(ALL, { ...none, longestStreak: 9, loggedIn: true })).toContain("modern");
  });
  test("a recorded streak unlock survives logout", () =>
    expect(availableThemeIds(ALL, { ...none, unlocked: ["modern"] })).toContain("modern"));
});

describe("unlocksForBoard", () => {
  test("any finished board unlocks the first-board theme", () =>
    expect(unlocksForBoard(ALL, { misses: 3 })).toEqual(["cyberwave"]));
  test("a perfect board unlocks both", () =>
    expect(unlocksForBoard(ALL, { misses: 0 })).toEqual(["cyberwave", "speakeasy"]));
});

describe("unlocksForStreak", () => {
  test("6 days is not enough", () => expect(unlocksForStreak(ALL, { longestStreak: 6, loggedIn: true })).toEqual([]));
  test("7 days unlocks", () => expect(unlocksForStreak(ALL, { longestStreak: 7, loggedIn: true })).toEqual(["modern"]));
  test("logged out never unlocks", () => expect(unlocksForStreak(ALL, { longestStreak: 30, loggedIn: false })).toEqual([]));
});

describe("unlockProgress", () => {
  test("streak progress is capped at the target", () => {
    expect(unlockProgress(ALL[4], { ...none, longestStreak: 5, loggedIn: true })).toEqual({ current: 5, target: 7 });
    expect(unlockProgress(ALL[4], { ...none, longestStreak: 12, loggedIn: true })).toEqual({ current: 7, target: 7 });
  });
  test("non-streak themes have no progress", () => expect(unlockProgress(ALL[2], none)).toBeNull());
});

describe("parsing", () => {
  test("parseThemeId accepts known ids only", () => {
    expect(parseThemeId("cyberwave")).toBe("cyberwave");
    expect(parseThemeId("neon")).toBeNull();
    expect(parseThemeId(null)).toBeNull();
    expect(parseThemeId(42)).toBeNull();
  });
  test("parseUnlocked accepts arrays and JSON strings, drops junk and duplicates", () => {
    expect(parseUnlocked(["cyberwave", "bogus", "cyberwave"])).toEqual(["cyberwave"]);
    expect(parseUnlocked('["speakeasy","modern"]')).toEqual(["speakeasy", "modern"]);
    expect(parseUnlocked("{not json")).toEqual([]);
    expect(parseUnlocked(undefined)).toEqual([]);
  });
});

describe("mergeUnlocked", () => {
  test("is a union in canonical order", () =>
    expect(mergeUnlocked(["modern", "cyberwave"], ["cyberwave", "speakeasy"])).toEqual(["cyberwave", "speakeasy", "modern"]));
});

describe("resolveActiveThemeId", () => {
  test("keeps an available stored theme", () =>
    expect(resolveActiveThemeId("midsommar", ["prislista", "midsommar"], "prislista")).toBe("midsommar"));
  test("falls back when the stored theme is locked", () =>
    expect(resolveActiveThemeId("modern", ["prislista", "midsommar"], "prislista")).toBe("prislista"));
  test("falls back when nothing is stored", () =>
    expect(resolveActiveThemeId(null, ["prislista"], "prislista")).toBe("prislista"));
});

import { themeCardState } from "./unlocks";

describe("themeCardState", () => {
  const ctx = { unlocked: [], longestStreak: 5, loggedIn: true };
  test("active, available and locked", () => {
    expect(themeCardState(ALL[0], ctx, "prislista")).toEqual({ state: "active", progress: null });
    expect(themeCardState(ALL[1], ctx, "prislista")).toEqual({ state: "available", progress: null });
    expect(themeCardState(ALL[2], ctx, "prislista")).toEqual({ state: "locked", progress: null });
  });
  test("a locked streak theme reports progress", () => {
    expect(themeCardState(ALL[4], ctx, "prislista")).toEqual({ state: "locked", progress: { current: 5, target: 7 } });
  });
  test("logged-out players see no streak progress", () => {
    expect(themeCardState(ALL[4], { ...ctx, loggedIn: false }, "prislista").progress).toBeNull();
  });
});
