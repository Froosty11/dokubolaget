import { expect, test } from "bun:test";
import { applyAccountThemeData } from "./accountSync";
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
