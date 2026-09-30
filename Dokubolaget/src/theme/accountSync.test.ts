import { expect, test } from "bun:test";
import { applyAccountThemeData, themeFieldsForAccount } from "./accountSync";
import { createThemeState } from "./themeState";

test("account unlocks merge before the streak is applied, so nothing is re-announced", () => {
  const s = createThemeState();
  s.setLoggedIn(true);
  applyAccountThemeData(s, { unlockedThemes: ["modern"], theme: "modern" }, { longestStreak: 9 });
  expect(s.unlockedThemes).toContain("modern");
  expect(s.pendingUnlocks).toEqual([]);
  expect(s.activeThemeId).toBe("modern");
});

test("a streak earned elsewhere is announced once", () => {
  const s = createThemeState();
  s.setLoggedIn(true);
  applyAccountThemeData(s, {}, { longestStreak: 7 });
  expect(s.pendingUnlocks).toEqual(["modern"]);
});

test("theme fields are written as a union, never replacing the account's list", () => {
  const s = createThemeState();
  s.addUnlocks(["cyberwave"], false);
  const union = (...ids: string[]) => ({ union: ids });
  expect(themeFieldsForAccount(s, union)).toEqual({ theme: "prislista", unlockedThemes: { union: ["cyberwave"] } });
});
