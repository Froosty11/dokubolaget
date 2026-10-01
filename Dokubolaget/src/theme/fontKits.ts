// The font families each font set uses, by role. Club themes pick a set by
// id; the families are loaded on demand by fonts.ts. Pure data, so the
// club theme code that uses it stays testable.
import type { FontKitId } from "./packSchema";
import { cyberwave } from "./themes/cyberwave";
import { midsommar } from "./themes/midsommar";
import { prislista } from "./themes/prislista";
import { speakeasy } from "./themes/speakeasy";
import type { ThemeFonts } from "./types";

export const FONT_KIT_FONTS: Record<FontKitId, ThemeFonts> = {
  prislista: prislista.fonts,
  midsommar: midsommar.fonts,
  cyberwave: cyberwave.fonts,
  speakeasy: speakeasy.fonts,
  poppins: {
    logo: "PlayfairDisplay_700Bold", display: "PlayfairDisplay_700Bold", body: "Poppins_400Regular",
    bodyStrong: "Poppins_600SemiBold", condensed: "Poppins_600SemiBold", mono: "IBMPlexMono_400Regular",
  },
  archivo: {
    logo: "ArchivoBlack_400Regular", display: "ArchivoBlack_400Regular", body: "Archivo_400Regular",
    bodyStrong: "Archivo_800ExtraBold", condensed: "Archivo_800ExtraBold", mono: "Archivo_400Regular",
  },
  pixel: {
    logo: "PressStart2P_400Regular", display: "PressStart2P_400Regular", body: "Lato_400Regular",
    bodyStrong: "Lato_900Black", condensed: "Lato_700Bold", mono: "PressStart2P_400Regular",
  },
  broadcast: {
    logo: "Oswald_700Bold", display: "Oswald_700Bold", body: "Oswald_400Regular",
    bodyStrong: "Oswald_600SemiBold", condensed: "Oswald_600SemiBold", mono: "Oswald_400Regular",
  },
  grotesk: {
    logo: "SpaceGrotesk_700Bold", display: "SpaceGrotesk_700Bold", body: "SpaceGrotesk_400Regular",
    bodyStrong: "SpaceGrotesk_600SemiBold", condensed: "SpaceGrotesk_600SemiBold", mono: "SpaceGrotesk_400Regular",
  },
  slab: {
    logo: "AlfaSlabOne_400Regular", display: "AlfaSlabOne_400Regular", body: "Bitter_400Regular",
    bodyStrong: "Bitter_700Bold", condensed: "Bitter_700Bold", mono: "Bitter_400Regular",
  },
};
