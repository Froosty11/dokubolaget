import { Text, View } from "react-native";
import DokubolagetLogo from "../../assets/Dokubolaget3.svg";
import { useTheme } from "./ThemeProvider";

// Modern and Prislista use the octagon logo; the other themes set the name in
// their own logo face.
// With `fill`, the octagon logo fills its parent box instead of sizing itself.
export function ThemeLogo({ height, fill = false }: { height: number; fill?: boolean }) {
  const { theme } = useTheme();
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
        color: theme.colors.accent,
        ...(theme.glow ? { textShadowColor: theme.glow.color, textShadowRadius: theme.glow.radius } : {}),
      }}
    >
      {"DOKU\nBOLAGET"}
    </Text>
  );
}
