import { observable } from "mobx";
import { CLUB_THEME_ID } from "./packSchema";
import { BUILT_IN_THEME_IDS, type BuiltInThemeId, type Lang, type Theme, type ThemeId } from "./types";
import { modern } from "./themes/modern";
import { prislista } from "./themes/prislista";
import { midsommar } from "./themes/midsommar";
import { cyberwave } from "./themes/cyberwave";
import { speakeasy } from "./themes/speakeasy";

// Order here is the order in the theme picker.
export const THEMES: Theme[] = [prislista, midsommar, cyberwave, speakeasy, modern];

export const DEFAULT_THEME_ID: ThemeId = "prislista";

// Replaced by the Swedish/English work; every theme already ships both.
export const UI_LANG: Lang = "en";

export function isBuiltInThemeId(value: unknown): value is BuiltInThemeId {
  return typeof value === "string" && (BUILT_IN_THEME_IDS as readonly string[]).includes(value);
}

export function isThemeId(value: unknown): value is ThemeId {
  return isBuiltInThemeId(value) || (typeof value === "string" && CLUB_THEME_ID.test(value));
}

// Club themes downloaded from the server (see clubThemes.ts). Observable, so
// screens and the theme list update when one arrives.
const clubThemes = observable.map<string, Theme>({}, { deep: false });

export function registerClubTheme(theme: Theme) {
  clubThemes.set(theme.id, theme);
}

export function clubTheme(id: ThemeId): Theme | undefined {
  return clubThemes.get(id);
}

export function registeredClubThemeIds(): ThemeId[] {
  return [...clubThemes.keys()].sort() as ThemeId[];
}

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? clubThemes.get(id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}
