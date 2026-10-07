import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { USE_NATIVE_DRIVER } from "../animation";
import { ClubLogo } from "../components/ClubLogo";
import { Confetti } from "../components/Confetti";
import { useReducedMotion, useTheme } from "../theme/ThemeProvider";
import { useThemeFonts } from "../theme/fonts";
import { themeWithFonts } from "../theme/fontKits";
import type { ClubInfo } from "../theme/packSchema";
import type { Theme } from "../theme/types";

type Props = {
  // The club theme just unlocked: the whole card is drawn in its colours.
  theme: Theme;
  club: ClubInfo;
  logoUrl: string | null;
  onWear: () => void;
  onLater: () => void;
};

// "Stamp collected": the club's logo stamps down onto a screen in the club's
// own colours, with confetti.
export function ClubUnlockView({ theme: clubTheme, club, logoUrl, onWear, onLater }: Props) {
  // The club's fonts aren't loaded yet (its theme isn't active), so load them here.
  const theme = themeWithFonts(clubTheme, useThemeFonts(clubTheme));
  const { lang } = useTheme();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const stamp = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const [confettiSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const { colors, fonts, radii } = theme;

  useEffect(() => {
    if (reducedMotion) return;
    Animated.timing(stamp, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.6)), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [reducedMotion]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.page, alignItems: "center", justifyContent: "center", padding: 28, zIndex: 70 }]}>
      {reducedMotion ? null : (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height: 0 }}>
          <Confetti mode="burst" seed={confettiSeed} count={60} x={width / 2} y={260} shape={theme.confetti.shape} colors={theme.confetti.colors} />
        </View>
      )}
      <View accessibilityRole="alert" style={{ alignItems: "center", gap: 12, maxWidth: 360, width: "100%" }}>
        <Text style={{ fontFamily: fonts.bodyStrong, fontSize: 13, letterSpacing: 3, color: colors.accent }}>STAMP COLLECTED</Text>
        <Animated.View
          style={{
            marginVertical: 8,
            opacity: stamp,
            transform: [
              { scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) },
              { rotate: stamp.interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "-6deg"] }) },
            ],
          }}
        >
          <ClubLogo club={club} logoUrl={logoUrl} theme={theme} size={196} />
        </Animated.View>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.inkStrong, textAlign: "center" }}>{club.name}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 17, color: colors.ink, textAlign: "center" }}>
          {club.pubNight} at {club.venue}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkMuted, textAlign: "center" }}>
          “{theme.copy[lang].name}”: {theme.copy[lang].description}
        </Text>
        <Pressable
          onPress={onWear}
          accessibilityRole="button"
          style={{ alignSelf: "stretch", marginTop: 14, backgroundColor: colors.accent, borderRadius: Math.max(radii.button, 4), paddingVertical: 15, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonts.bodyStrong, fontSize: 17, color: colors.accentInk }}>Wear it now</Text>
        </Pressable>
        <Pressable onPress={onLater} accessibilityRole="button" hitSlop={10}>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink, textDecorationLine: "underline" }}>Keep my theme</Text>
        </Pressable>
      </View>
    </View>
  );
}
