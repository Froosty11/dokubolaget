import { Image, Text, View } from "react-native";
import type { ClubInfo } from "../theme/packSchema";
import type { Theme } from "../theme/types";

type Props = {
  club: ClubInfo;
  // Absolute logo address, or null for clubs without one.
  logoUrl: string | null;
  // The club's own theme, for the monogram colours and font.
  theme: Theme;
  size: number;
  dimmed?: boolean;
};

// A club's logo in a round badge, or its initial when it has no logo yet.
export function ClubLogo({ club, logoUrl, theme, size, dimmed }: Props) {
  const initial = club.name.length <= 2 ? club.name : club.name.slice(0, 1);
  return (
    <View
      accessibilityLabel={`${club.name} logo`}
      style={{
        width: size, height: size, borderRadius: size / 2, overflow: "hidden",
        backgroundColor: logoUrl ? "#ffffff" : theme.colors.page,
        borderWidth: Math.max(2, size / 40), borderColor: theme.colors.accent,
        alignItems: "center", justifyContent: "center", opacity: dimmed ? 0.35 : 1,
      }}
    >
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} resizeMode="contain" style={{ width: size * 0.78, height: size * 0.78, ...(dimmed ? { tintColor: "#777777" } : null) }} />
      ) : (
        <Text style={{ fontFamily: theme.fonts.display, fontSize: size * 0.42, color: dimmed ? "#777777" : theme.colors.accent }}>{initial}</Text>
      )}
    </View>
  );
}
