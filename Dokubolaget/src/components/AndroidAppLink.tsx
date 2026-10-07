import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Platform, Pressable, Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { isIOS } from "../installNudge";

// "Get the Android app" link to the APK release page. Web only, and hidden on
// iOS (the APK is Android-only) and on native (already an app). The URL is
// baked at build time, defaulting to the repo's GitHub Releases.
const ANDROID_URL =
  process.env.EXPO_PUBLIC_ANDROID_URL || "https://github.com/Froosty11/dokubolaget/releases/latest";

type Props = { color?: string };

export function AndroidAppLink({ color }: Props) {
  const { theme } = useTheme();
  if (Platform.OS !== "web" || isIOS()) return null;
  const ink = color ?? theme.colors.inkMuted;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Download the Dokubolaget Android app"
      onPress={() => Linking.openURL(ANDROID_URL)}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 6 }}
    >
      <MaterialCommunityIcons name="android" size={16} color={ink} />
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: ink, textDecorationLine: "underline" }}>
        Get the Android app
      </Text>
    </Pressable>
  );
}
