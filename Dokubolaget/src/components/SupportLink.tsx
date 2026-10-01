import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Props = { url: string | null; color?: string };

// "Support Dokubolaget" link to the Ko-fi page. Renders nothing until the
// server has a page configured (SUPPORT_URL).
export function SupportLink({ url, color }: Props) {
  const { theme } = useTheme();
  if (!url) return null;
  const ink = color ?? theme.colors.inkMuted;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Support Dokubolaget on Ko-fi"
      onPress={() => Linking.openURL(url)}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 6 }}
    >
      <MaterialCommunityIcons name="coffee-outline" size={16} color={ink} />
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: ink, textDecorationLine: "underline" }}>
        Enjoying Dokubolaget? Buy me a coffee
      </Text>
    </Pressable>
  );
}
