import { observer } from "mobx-react-lite";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { useThemeFonts } from "./fonts";
import { themeWithFonts } from "./fontKits";
import { setActiveHapticPattern } from "./haptics";
import { getTheme } from "./registry";
import type { Lang, Theme, ThemeCopy, ThemeId } from "./types";
import { translations } from "../i18n";
import { translate, type TParams } from "../i18n/translate";

type ThemeContextValue = {
  theme: Theme;
  id: ThemeId;
  copy: ThemeCopy;
  lang: Lang;
  setLang: (lang: Lang) => void;
  // Translates a catalog key for the active language (see src/i18n).
  t: (key: string, params?: TParams) => string;
  available: ThemeId[];
  unlocked: ThemeId[];
  setId: (id: ThemeId) => boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeModel = {
  activeThemeId: ThemeId;
  lang: Lang;
  setLang: (lang: Lang) => void;
  availableThemeIds: ThemeId[];
  unlockedThemes: ThemeId[];
  setThemeId: (id: ThemeId) => boolean;
};

export const ThemeProvider = observer(function ThemeProvider({
  model,
  children,
}: {
  model: ThemeModel;
  children: ReactNode;
}) {
  const id = model.activeThemeId;
  const base = getTheme(id);
  const fontsReady = useThemeFonts(base);
  // Until a theme's fonts arrive, text uses fonts that are always loaded.
  const theme = useMemo(() => themeWithFonts(base, fontsReady), [base, fontsReady]);
  useWebChrome(theme);
  // Vibration follows the active theme.
  setActiveHapticPattern(base.haptics);

  const available = model.availableThemeIds;
  const unlocked = model.unlockedThemes;
  const lang = model.lang;
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      id,
      copy: theme.copy[lang],
      lang,
      setLang: (next) => model.setLang(next),
      t: (key, params) => translate(translations, lang, key, params),
      available,
      unlocked,
      setId: (next) => model.setThemeId(next),
    }),
    [theme, id, lang, available.join(), unlocked.join()],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
});

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

// `factory` must be a module-level function so styles rebuild only when the
// theme changes.
export function useThemedStyles<T extends Record<string, any>>(factory: (theme: Theme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme) as any) as T, [theme, factory]);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}

// On web, the page background and the browser/status-bar colour follow the theme.
function useWebChrome(theme: Theme) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.body.style.backgroundColor = theme.colors.page;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.page);
    document.documentElement.style.colorScheme = theme.dark ? "dark" : "light";
  }, [theme]);
}
