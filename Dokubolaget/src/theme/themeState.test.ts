import { expect, test } from "bun:test";
import { createThemeState } from "./themeState";

test("setThemeId refuses locked themes", () => {
  const s = createThemeState();
  expect(s.setThemeId("cyberwave")).toBe(false);
  expect(s.activeThemeId).toBe(s.themeId);
});

test("addUnlocks announces only fresh unlocks, once", () => {
  const s = createThemeState();
  expect(s.addUnlocks(["cyberwave"], true)).toEqual(["cyberwave"]);
  expect(s.addUnlocks(["cyberwave"], true)).toEqual([]);
  expect(s.pendingUnlocks).toEqual(["cyberwave"]);
  expect(s.shiftPendingUnlock()).toBe("cyberwave");
  expect(s.shiftPendingUnlock()).toBeNull();
});

test("always-available themes are never recorded as unlocks", () => {
  const s = createThemeState();
  expect(s.addUnlocks([s.activeThemeId], true)).toEqual([]);
});

test("a player stored on Modern without the streak lands on Prislista", () => {
  const s = createThemeState();
  s.themeId = "modern";
  expect(s.activeThemeId).toBe("prislista");
  s.setLoggedIn(true);
  s.applyStreak(7);
  expect(s.activeThemeId).toBe("modern");
  expect(s.pendingUnlocks).toEqual(["modern"]);
});

test("new players start on Prislista 1986", () => {
  expect(createThemeState().activeThemeId).toBe("prislista");
});

test("board unlocks wait for the board; Home only takes streak unlocks", () => {
  const s = createThemeState();
  s.addUnlocks(["cyberwave"], "board");
  expect(s.shiftPendingUnlock("streak")).toBeNull();
  expect(s.shiftPendingUnlock("board")).toBe("cyberwave");
});
