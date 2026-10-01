import { describe, expect, test } from "bun:test";
import { CONTRAST_PAIRS, contrastRatio, dossierContrastProblems } from "./contrast";
import { DEFAULT_THEME_ID, THEMES, getTheme } from "./registry";
import type { ThemeCopy } from "./types";

const COPY_KEYS: Array<keyof ThemeCopy> = [
  "name", "description", "unlockHint", "correctTitles", "nearMissTitle", "completeTitle",
  "searchTitle", "tabHome", "tabPlay", "tabLeaderboard",
];

describe.each(THEMES.map((theme) => [theme.id, theme] as const))("theme %s", (_id, theme) => {
  test.each(CONTRAST_PAIRS)("%s on %s meets AA", (fg, bg) => {
    expect(contrastRatio(theme.colors[fg], theme.colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test("copy is complete in both languages", () => {
    for (const lang of ["sv", "en"] as const) {
      for (const key of COPY_KEYS) {
        const value = theme.copy[lang][key];
        expect(Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0).toBe(true);
      }
    }
  });

  test("confetti has colours", () => expect(theme.confetti.colors.length).toBeGreaterThan(0));
});

test("theme ids are unique", () => {
  expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
});

test("default theme is registered and always available", () => {
  expect(getTheme(DEFAULT_THEME_ID).id).toBe(DEFAULT_THEME_ID);
  expect(getTheme(DEFAULT_THEME_ID).unlock.kind).toBe("always");
});

test("themes appear in picker order", () => {
  expect(THEMES.map((t) => t.id)).toEqual(["prislista", "midsommar", "cyberwave", "speakeasy", "modern"]);
});

describe.each(THEMES.map((theme) => [theme.id, theme] as const))("info sheet for %s", (_id, theme) => {
  test("text on the sheet meets AA", () => {
    expect(dossierContrastProblems(theme.dossier)).toEqual([]);
  });
  test("has its own wording in both languages", () => {
    for (const lang of ["sv", "en"] as const) {
      const c = theme.copy[lang];
      for (const key of ["dossierTitle", "dossierSubject", "dossierNotes", "stampHidden", "stampRevealed"] as const) {
        expect(String(c[key]).trim().length).toBeGreaterThan(0);
      }
    }
  });
});
