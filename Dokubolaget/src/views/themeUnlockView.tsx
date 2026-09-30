import { Pressable, StyleSheet, Text, View } from "react-native";
import { UI_LANG, getTheme } from "../theme/registry";
import { useTheme } from "../theme/ThemeProvider";
import { ThemeSwatch } from "../theme/ThemeSwatch";
import type { ThemeId } from "../theme/types";

type ThemeUnlockViewProps = {
  themeId: ThemeId;
  onTry: () => void;
  onLater: () => void;
};

// "New theme unlocked" card, shown after the celebration. The swatch uses the
// unlocked theme's own colours; the card itself uses the current theme.
export function ThemeUnlockView({ themeId, onTry, onLater }: Readonly<ThemeUnlockViewProps>) {
  const { theme } = useTheme();
  const unlocked = getTheme(themeId);
  const copy = unlocked.copy[UI_LANG];
  const { colors, fonts, radii } = theme;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.celebrationOverlay, alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }]}>
      <View
        accessibilityRole="alert"
        style={{ width: "100%", maxWidth: 340, backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 2, borderColor: colors.highlight, padding: 22, alignItems: "center", gap: 10 }}
      >
        <Text style={{ fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 2, color: colors.accent }}>NEW THEME UNLOCKED</Text>
        <View style={{ borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: colors.divider }}>
          <ThemeSwatch theme={unlocked} width={160} height={110} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.inkStrong, textAlign: "center" }}>{copy.name}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textAlign: "center" }}>{copy.description}</Text>
        <Pressable
          onPress={onTry}
          accessibilityRole="button"
          style={{ backgroundColor: colors.accent, borderRadius: radii.button, paddingVertical: 12, paddingHorizontal: 26, marginTop: 6 }}
        >
          <Text style={{ fontFamily: fonts.bodyStrong, fontSize: 16, fontWeight: "600", color: colors.accentInk }}>Try it now</Text>
        </Pressable>
        <Pressable onPress={onLater} accessibilityRole="button" hitSlop={10}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textDecorationLine: "underline" }}>Later</Text>
        </Pressable>
      </View>
    </View>
  );
}
