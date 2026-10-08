import { Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { APP_VERSION } from "../version";

// Small, unobtrusive build version in the bottom-right corner. Anchors to its
// parent, so drop it inside a screen's root View.
export function VersionTag() {
  const { theme } = useTheme();
  return (
    <Text
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        right: 8,
        bottom: 6,
        fontSize: 11,
        fontFamily: theme.fonts.mono,
        color: theme.colors.inkFaint,
        opacity: 0.8,
      }}
    >
      v{APP_VERSION}
    </Text>
  );
}
