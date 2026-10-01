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

test("a local build with unlockAll offers every theme", () => {
  const s = createThemeState({ unlockAll: true });
  expect(s.availableThemeIds.length).toBe(5);
  expect(s.setThemeId("modern")).toBe(true);
  expect(createThemeState().availableThemeIds).not.toContain("modern");
});

import { getTheme, registerClubTheme } from "./registry";
import { prislista } from "./themes/prislista";

const clubTheme = (id: `club-${string}`) => ({ ...prislista, id, unlock: { kind: "scan" as const } });



test("a registered, unlocked club theme can be worn, and was announced as a scan", () => {
  registerClubTheme(clubTheme("club-reg"));
  const s = createThemeState();
  expect(s.setThemeId("club-reg")).toBe(false);
  s.addUnlocks(["club-reg"], "scan");
  expect(s.pendingSources["club-reg"]).toBe("scan");
  expect(s.setThemeId("club-reg")).toBe(true);
  expect(s.activeThemeId).toBe("club-reg");
});

test("getTheme finds registered club themes and falls back for unknown ones", () => {
  registerClubTheme(clubTheme("club-found"));
  expect(getTheme("club-found").id).toBe("club-found");
  expect(getTheme("club-missing").id).toBe("prislista");
});

test("unlock-all builds also offer registered club themes", () => {
  registerClubTheme(clubTheme("club-all"));
  expect(createThemeState({ unlockAll: true }).availableThemeIds).toContain("club-all");
});

test("an unlocked club theme can be chosen before it downloads, and shows once it arrives", () => {
  const s = createThemeState();
  expect(s.setThemeId("club-later")).toBe(false);
  s.addUnlocks(["club-later"], "scan");
  // Chosen (e.g. the account's choice from another device), not yet worn.
  expect(s.setThemeId("club-later")).toBe(true);
  expect(s.themeId).toBe("club-later");
  expect(s.activeThemeId).toBe("prislista");
  registerClubTheme(clubTheme("club-later"));
  expect(s.activeThemeId).toBe("club-later");
});
