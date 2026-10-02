import * as Font from "expo-font";
import { useEffect, useState } from "react";
import { fontKitFor } from "./fontKits";
import type { FontKitId } from "./packSchema";
import type { Theme } from "./types";
import { LibreBaskerville_400Regular } from "@expo-google-fonts/libre-baskerville/400Regular";
import { LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville/700Bold";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono/600SemiBold";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { Fraunces_900Black } from "@expo-google-fonts/fraunces/900Black";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Monoton_400Regular } from "@expo-google-fonts/monoton/400Regular";
import { Orbitron_700Bold } from "@expo-google-fonts/orbitron/700Bold";
import { ShareTechMono_400Regular } from "@expo-google-fonts/share-tech-mono/400Regular";
import { Limelight_400Regular } from "@expo-google-fonts/limelight/400Regular";
import { PoiretOne_400Regular } from "@expo-google-fonts/poiret-one/400Regular";
import { JosefinSans_400Regular } from "@expo-google-fonts/josefin-sans/400Regular";
import { JosefinSans_700Bold } from "@expo-google-fonts/josefin-sans/700Bold";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black/400Regular";
import { Archivo_400Regular } from "@expo-google-fonts/archivo/400Regular";
import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p/400Regular";
import { Lato_400Regular } from "@expo-google-fonts/lato/400Regular";
import { Lato_700Bold } from "@expo-google-fonts/lato/700Bold";
import { Lato_900Black } from "@expo-google-fonts/lato/900Black";
import { Oswald_400Regular } from "@expo-google-fonts/oswald/400Regular";
import { Oswald_600SemiBold } from "@expo-google-fonts/oswald/600SemiBold";
import { Oswald_700Bold } from "@expo-google-fonts/oswald/700Bold";
import { SpaceGrotesk_400Regular } from "@expo-google-fonts/space-grotesk/400Regular";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { AlfaSlabOne_400Regular } from "@expo-google-fonts/alfa-slab-one/400Regular";
import { Bitter_400Regular } from "@expo-google-fonts/bitter/400Regular";
import { Bitter_700Bold } from "@expo-google-fonts/bitter/700Bold";
import { PirataOne_400Regular } from "@expo-google-fonts/pirata-one/400Regular";
import { IMFellEnglishSC_400Regular } from "@expo-google-fonts/im-fell-english-sc/400Regular";
import { EBGaramond_500Medium } from "@expo-google-fonts/eb-garamond/500Medium";
import { EBGaramond_600SemiBold } from "@expo-google-fonts/eb-garamond/600SemiBold";
import { EBGaramond_700Bold } from "@expo-google-fonts/eb-garamond/700Bold";

export { FALLBACK_FONTS } from "./fontKits";

// Each font set registers { familyName: fontModule } here. Loaded on demand
// the first time a theme using it is shown, so the first page load doesn't grow.
export const FONT_KIT_LOADERS: Record<FontKitId, () => Record<string, any>> = {
  prislista: () => ({
    LibreBaskerville_400Regular, LibreBaskerville_700Bold, BarlowCondensed_600SemiBold,
    IBMPlexMono_400Regular, IBMPlexMono_600SemiBold,
  }),
  midsommar: () => ({ Fraunces_700Bold, Fraunces_900Black, Nunito_600SemiBold, Nunito_800ExtraBold }),
  cyberwave: () => ({ Monoton_400Regular, Orbitron_700Bold, ShareTechMono_400Regular }),
  speakeasy: () => ({ Limelight_400Regular, PoiretOne_400Regular, JosefinSans_400Regular, JosefinSans_700Bold }),
  poppins: () => ({ PlayfairDisplay_700Bold, Poppins_400Regular, Poppins_600SemiBold, IBMPlexMono_400Regular }),
  archivo: () => ({ ArchivoBlack_400Regular, Archivo_400Regular, Archivo_800ExtraBold }),
  pixel: () => ({ PressStart2P_400Regular, Lato_400Regular, Lato_700Bold, Lato_900Black }),
  broadcast: () => ({ Oswald_400Regular, Oswald_600SemiBold, Oswald_700Bold }),
  grotesk: () => ({ SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold }),
  slab: () => ({ AlfaSlabOne_400Regular, Bitter_400Regular, Bitter_700Bold }),
  chart: () => ({ IMFellEnglishSC_400Regular, EBGaramond_500Medium, EBGaramond_600SemiBold, EBGaramond_700Bold, IBMPlexMono_400Regular }),
  pirate: () => ({ PirataOne_400Regular, Poppins_400Regular, Poppins_600SemiBold, IBMPlexMono_400Regular }),
};

// True once the theme's fonts are loaded. Stays false if loading fails, so
// text keeps the always-loaded fonts (see themeWithFonts). Read from expo-font
// on every render: a family must never reach a Text before it's registered,
// because Android measures the text with a stand-in font and keeps that size.
export function useThemeFonts(theme: Theme): boolean {
  const id = theme.id;
  const kit = fontKitFor(theme);
  const loader = kit ? FONT_KIT_LOADERS[kit] : null;
  const families = loader ? loader() : {};
  const allLoaded = Object.keys(families).every((name) => Font.isLoaded(name));
  const [, setLoadedCount] = useState(0);

  useEffect(() => {
    if (allLoaded) return;
    let cancelled = false;
    Font.loadAsync(families)
      .then(() => {
        if (!cancelled) setLoadedCount((count) => count + 1);
      })
      .catch((error) => console.warn(`Fonts for theme ${id} failed to load:`, error));
    return () => {
      cancelled = true;
    };
  }, [id, kit, allLoaded]);

  return allLoaded;
}
