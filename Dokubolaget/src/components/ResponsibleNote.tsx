import { Linking, Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

// Alkoholhjälpen (formerly Alkohollinjen) is the national, free and anonymous
// support line, run by Beroendecentrum Stockholm for Folkhälsomyndigheten.
export const SUPPORT_URL = "https://alkoholhjalpen.se/";
export const SUPPORT_PHONE = "020-84\u00A044\u00A048";

type Props = { color?: string };

// A permanent reminder that this is a game about the range, not about drinking.
export function ResponsibleNote({ color }: Props) {
  const { theme, t } = useTheme();
  const ink = color ?? theme.colors.inkMuted;
  const text = { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 17, color: ink, textAlign: "center" as const };

  return (
    <View style={{ maxWidth: 340, gap: 2 }}>
      <Text style={{ ...text, fontFamily: theme.fonts.bodyStrong }}>{t("responsible.moderation")}</Text>
      <Text style={text}>
        {t("responsible.worried", { phone: SUPPORT_PHONE })}
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t("responsible.websiteLabel")}
        onPress={() => Linking.openURL(SUPPORT_URL)}
        hitSlop={8}
        style={{ alignSelf: "center" }}
      >
        <Text style={{ ...text, textDecorationLine: "underline" }}>alkoholhjalpen.se</Text>
      </Pressable>
    </View>
  );
}
