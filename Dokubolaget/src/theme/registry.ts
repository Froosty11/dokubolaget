import { THEME_IDS, type Lang, type Theme, type ThemeId } from "./types";
import { modern } from "./themes/modern";
import { prislista } from "./themes/prislista";
import { midsommar } from "./themes/midsommar";
import { cyberwave } from "./themes/cyberwave";

// Order here is the order in the theme picker.
export const THEMES: Theme[] = [prislista, midsommar, cyberwave, modern];

export const DEFAULT_THEME_ID: ThemeId = "prislista";

// Replaced by the Swedish/English work; every theme already ships both.
export const UI_LANG: Lang = "en";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}
