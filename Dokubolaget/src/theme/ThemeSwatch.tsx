import * as Font from "expo-font";
import { Text, View } from "react-native";
import { FALLBACK_FONTS } from "./fonts";
import type { Theme } from "./types";

// A small preview drawn from a theme's own tokens, so every theme gets a
// swatch for free.
export function ThemeSwatch({ theme, width = 96, height = 72 }: { theme: Theme; width?: number; height?: number }) {
  const { colors } = theme;
  const nameFont = Font.isLoaded(theme.fonts.logo) ? theme.fonts.logo : FALLBACK_FONTS.display;
  const cell = { width: width * 0.22, height: height * 0.3, backgroundColor: colors.cellFill, borderColor: colors.cellBorder, borderWidth: 1, borderRadius: Math.min(theme.radii.cell, 4) };
  return (
    <View style={{ width, height, backgroundColor: colors.page, padding: 8, justifyContent: "space-between", overflow: "hidden" }}>
      <View
        style={{
          width: "70%", height: height * 0.3, backgroundColor: colors.accent, borderColor: colors.highlight,
          borderWidth: 2, borderRadius: Math.min(theme.radii.button, 6), justifyContent: "center", paddingHorizontal: 4,
          ...(theme.glow ? { shadowColor: theme.glow.color, shadowRadius: 6, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } } : {}),
        }}
      >
        <Text numberOfLines={1} style={{ fontFamily: nameFont, fontSize: 10, color: colors.accentInk }}>
          DOKU
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 4 }}>
        <View style={cell} />
        <View style={[cell, { backgroundColor: colors.correctBg, borderColor: colors.correct }]} />
        <View style={cell} />
      </View>
    </View>
  );
}
