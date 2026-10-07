import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Lang, ThemeId } from "./types";
import { parseThemeId, parseUnlocked } from "./unlocks";

export const THEME_KEY = "dokubolaget.theme";
export const UNLOCKS_KEY = "dokubolaget.unlockedThemes";
export const LANG_KEY = "dokubolaget.lang";

// The player's saved UI language, or null if they haven't chosen one (then the
// detected device language is used). Kept separate from theme prefs.
export async function loadDeviceLang(): Promise<Lang | null> {
  if (Platform.OS === "web" && typeof window === "undefined") return null;
  try {
    const raw = await AsyncStorage.getItem(LANG_KEY);
    return raw === "sv" || raw === "en" ? raw : null;
  } catch (error) {
    console.warn("Lang read failed:", error);
    return null;
  }
}

export function saveDeviceLang(lang: Lang) {
  AsyncStorage.setItem(LANG_KEY, lang).catch((error) => console.warn("Lang write failed:", error));
}

export async function loadDeviceThemePrefs(): Promise<{ themeId: ThemeId | null; unlocked: ThemeId[] }> {
  // The static web export renders once in Node, where there is no storage.
  if (Platform.OS === "web" && typeof window === "undefined") return { themeId: null, unlocked: [] };
  try {
    const [themeRaw, unlockedRaw] = await Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(UNLOCKS_KEY),
    ]);
    return { themeId: parseThemeId(themeRaw), unlocked: parseUnlocked(unlockedRaw) };
  } catch (error) {
    console.warn("Theme prefs read failed:", error);
    return { themeId: null, unlocked: [] };
  }
}

export function saveDeviceThemePrefs(themeId: ThemeId, unlocked: ThemeId[]) {
  AsyncStorage.setItem(THEME_KEY, themeId).catch((error) => console.warn("Theme write failed:", error));
  AsyncStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocked)).catch((error) =>
    console.warn("Unlocks write failed:", error),
  );
}
