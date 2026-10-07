import { Pressable, Text, View } from "react-native";
import type { LeaderRow, UserStats } from "../play/types";
import { useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";

type Props = {
  // The logged-in player's nickname, or null.
  nickname: string | null;
  // Which board is shown ("Today", "Streak", ...) and what its values count.
  periodTitle: string;
  unit: string;
  me: LeaderRow | null;
  stats: UserStats | null;
  onLogin: () => void;
};

// The player's own numbers beside the leaderboard on wide screens.
export function LeaderboardYouView({ nickname, periodTitle, unit, me, stats, onLogin }: Readonly<Props>) {
  const style = useThemedStyles(makeStyle);

  if (!nickname) {
    return (
      <View style={style.card}>
        <Text style={style.label}>You</Text>
        <Text style={style.lead}>Log in to see your rank, your streak and the unicorns you've found.</Text>
        <Pressable accessibilityRole="button" onPress={onLogin} style={style.button}>
          <Text style={style.buttonText}>Log in / Sign up</Text>
        </Pressable>
      </View>
    );
  }

  const tiles: Array<{ value: string; label: string }> = [
    { value: me && me.value > 0 ? `#${me.rank}` : "–", label: `rank, ${periodTitle.toLowerCase()}` },
    { value: String(me?.value ?? 0), label: unit },
    { value: String(stats?.currentStreak ?? 0), label: "day streak" },
    { value: String(stats?.longestStreak ?? 0), label: "longest streak" },
    { value: String(stats?.finishedCount ?? 0), label: "boards finished" },
    { value: String(stats?.unicorns ?? 0), label: "unicorns 🦄" },
  ];

  return (
    <View style={style.card}>
      <Text style={style.label}>You</Text>
      <Text numberOfLines={1} style={style.name}>{nickname}</Text>
      <View style={style.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={style.tile} accessibilityLabel={`${tile.value} ${tile.label}`}>
            <Text style={style.tileValue}>{tile.value}</Text>
            <Text style={style.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyle = (theme: Theme) => ({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 18,
    gap: 10,
  },
  label: {
    fontFamily: theme.fonts.condensed,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: theme.colors.inkMuted,
  },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: theme.colors.inkStrong,
  },
  lead: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.ink,
  },
  button: {
    alignSelf: "flex-start" as const,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontFamily: theme.fonts.bodyStrong,
    color: theme.colors.accentInk,
  },
  tiles: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    rowGap: 14,
  },
  tile: {
    width: "50%" as const,
  },
  tileValue: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 24,
    fontWeight: "700" as const,
    color: theme.colors.inkStrong,
  },
  tileLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.inkMuted,
  },
});
