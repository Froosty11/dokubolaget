import * as Font from "expo-font";
import { useEffect, useState } from "react";
import type { ThemeFonts, ThemeId } from "./types";

// Loaded at startup by app/_layout.tsx, so always safe to fall back to.
export const FALLBACK_FONTS: ThemeFonts = {
  logo: "Monopol", display: "Monopol", body: "InterVariable", bodyStrong: "InterVariable",
  condensed: "BolagetMediumCondensed", mono: "InterVariable",
};

// Each theme registers { familyName: fontModule } here. Loaded on demand the
// first time the theme is used, so the first page load doesn't grow.
export const THEME_FONT_LOADERS: Partial<Record<ThemeId, () => Record<string, any>>> = {};

export function useThemeFonts(id: ThemeId): boolean {
  const loader = THEME_FONT_LOADERS[id];
  const families = loader ? loader() : {};
  const allLoaded = Object.keys(families).every((name) => Font.isLoaded(name));
  const [ready, setReady] = useState(allLoaded);

  useEffect(() => {
    if (allLoaded) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    Font.loadAsync(families)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error) => console.warn(`Fonts for theme ${id} failed to load:`, error));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return ready;
}
