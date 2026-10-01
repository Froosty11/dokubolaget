import { Image, Text, View } from "react-native";
import { api } from "../api";
import DokubolagetLogo from "../../assets/Dokubolaget3.svg";
import { useTheme } from "./ThemeProvider";

// Modern and Prislista use the octagon logo; the other themes set the name in
// their own logo face.
// With `fill`, the octagon logo fills its parent box instead of sizing itself.
export function ThemeLogo({ height, fill = false }: { height: number; fill?: boolean }) {
  const { theme } = useTheme();
  // Club themes wear the club's own logo, in a round badge.
  if (theme.logo) {
    const size = height * 1.05;
    return (
      <View
        accessibilityRole="header"
        accessibilityLabel={`Dokubolaget, ${theme.copy.en.name}`}
        style={{
          width: size, height: size, borderRadius: size / 2, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center",
          borderWidth: 3, borderColor: theme.colors.accent, overflow: "hidden", alignSelf: "center",
        }}
      >
        <Image source={{ uri: api.logoUrl({ logoUrl: theme.logo.url }) ?? undefined }} resizeMode="contain" style={{ width: size * 0.78, height: size * 0.78 }} />
      </View>
    );
  }
  if (theme.id === "modern" || theme.id === "prislista") {
    return (
      <View style={fill ? { width: "100%", height: "100%" } : { height, width: (height * 496) / 283 }}>
        <DokubolagetLogo width="100%" height="100%" />
      </View>
    );
  }
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: theme.fonts.logo,
        fontSize: height * 0.36,
        lineHeight: height * 0.42,
        textAlign: "center",
        // Neon logos are light tubes with a coloured glow; others are printed in the accent.
        color: theme.glow ? theme.colors.inkStrong : theme.colors.accent,
        // Neon glows; everything else gets a soft halo so the name stays
        // readable over backdrop artwork.
        ...(theme.glow
          ? { textShadowColor: theme.glow.color, textShadowRadius: theme.glow.radius }
          : { textShadowColor: theme.colors.page, textShadowRadius: 8 }),
      }}
    >
      {"DOKU\nBOLAGET"}
    </Text>
  );
}
