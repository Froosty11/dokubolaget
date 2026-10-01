import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { packToTheme } from "./clubThemes";
import { FALLBACK_FONTS, FONT_KIT_FONTS, fontKitFor, themeWithFonts } from "./fontKits";
import { modern } from "./themes/modern";
import { prislista } from "./themes/prislista";

const pack = JSON.parse(readFileSync(new URL("../../server/fixtures/club-themes/sample/theme.json", import.meta.url), "utf8"));

test("built-in themes load their own fonts; club themes load their font set", () => {
  expect(fontKitFor(prislista)).toBe("prislista");
  expect(fontKitFor(modern)).toBeNull();
  expect(fontKitFor(packToTheme({ ...pack, fontKit: "pixel" }))).toBe("pixel");
});

test("until a font set has loaded, text uses the always-loaded fonts", () => {
  const club = packToTheme({ ...pack, fontKit: "poppins" });
  expect(themeWithFonts(club, false).fonts).toEqual(FALLBACK_FONTS);
  expect(themeWithFonts(club, true).fonts).toEqual(FONT_KIT_FONTS.poppins);
  expect(themeWithFonts(club, false).colors).toBe(club.colors);
});
