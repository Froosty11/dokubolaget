import * as Font from "expo-font";
import { useEffect, useState } from "react";
import type { ThemeFonts, ThemeId } from "./types";
import { LibreBaskerville_400Regular } from "@expo-google-fonts/libre-baskerville/400Regular";
import { LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville/700Bold";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono/600SemiBold";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { Fraunces_900Black } from "@expo-google-fonts/fraunces/900Black";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";

// Loaded at startup by app/_layout.tsx, so always safe to fall back to.
export const FALLBACK_FONTS: ThemeFonts = {
  logo: "Monopol", display: "Monopol", body: "InterVariable", bodyStrong: "InterVariable",
  condensed: "BolagetMediumCondensed", mono: "InterVariable",
};

// Each theme registers { familyName: fontModule } here. Loaded on demand the
// first time the theme is used, so the first page load doesn't grow.
export const THEME_FONT_LOADERS: Partial<Record<ThemeId, () => Record<string, any>>> = {
  prislista: () => ({
    LibreBaskerville_400Regular, LibreBaskerville_700Bold, BarlowCondensed_600SemiBold,
    IBMPlexMono_400Regular, IBMPlexMono_600SemiBold,
  }),
  midsommar: () => ({ Fraunces_700Bold, Fraunces_900Black, Nunito_600SemiBold, Nunito_800ExtraBold }),
};

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
