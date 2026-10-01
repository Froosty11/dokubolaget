import { observer } from "mobx-react-lite";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { FALLBACK_FONTS, useThemeFonts } from "./fonts";
import { setActiveHapticPattern } from "./haptics";
import { UI_LANG, getTheme } from "./registry";
import type { Theme, ThemeCopy, ThemeId } from "./types";

type ThemeContextValue = {
  theme: Theme;
  id: ThemeId;
  copy: ThemeCopy;
  available: ThemeId[];
  unlocked: ThemeId[];
  setId: (id: ThemeId) => boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeModel = {
  activeThemeId: ThemeId;
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
  const fontsReady = useThemeFonts(id);
  const base = getTheme(id);
  // Until a theme's fonts arrive, text uses fonts that are always loaded.
  const theme = useMemo(() => (fontsReady ? base : { ...base, fonts: FALLBACK_FONTS }), [base, fontsReady]);
  useWebChrome(theme);
  // Vibration follows the active theme.
  setActiveHapticPattern(base.haptics);

  const available = model.availableThemeIds;
  const unlocked = model.unlockedThemes;
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      id,
      copy: theme.copy[UI_LANG],
      available,
      unlocked,
      setId: (next) => model.setThemeId(next),
    }),
    [theme, id, available.join(), unlocked.join()],
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
