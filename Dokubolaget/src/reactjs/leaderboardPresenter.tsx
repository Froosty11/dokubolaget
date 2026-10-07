import { useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../api";
import { LeaderBoardFormView, type LeaderboardPeriod } from "../views/leaderboardFormView";
import { LeaderBoardResultView } from "../views/leaderboardResultView";

type LeaderboardEntry = {
  key?: string;
  label: string;
  value: string | number;
  detail?: string;
};

type leaderboardProps = {
  limit?: number;
};

const PERIOD_COPY: Record<LeaderboardPeriod, { title: string; subtitle: string; empty: string }> = {
  today: { title: "Today", subtitle: "Ranked by today's score", empty: "No scores yet today — be the first to finish the board." },
  week: { title: "This Week", subtitle: "Ranked by this week's score", empty: "No scores yet this week." },
  all: { title: "All Time", subtitle: "Ranked by total score", empty: "No scores recorded yet." },
  streak: { title: "Streak", subtitle: "Ranked by current streak", empty: "No streaks going yet." },
};

function Leaderboard(_props: leaderboardProps) {
  const style = useThemedStyles(makeStyle);
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(
    function loadLeaderboardACB() {
      let isMounted = true;
      setLoading(true);

      api
        .leaderboard(period)
        .then(function toRowsACB(result) {
          const meNickname = result.me?.nickname;
          const entries: LeaderboardEntry[] = result.rows.map(function toRowACB(row) {
            const isMe = row.nickname === meNickname;
            return {
              key: `${period}-${row.rank}-${row.nickname}`,
              label: `${row.rank}. ${row.nickname}`,
              value: row.value,
              detail: isMe ? "You" : undefined,
            };
          });
          // The server always returns the caller's own row, even beyond the top
          // list or at zero. Pin it to the bottom when it isn't already shown.
          if (result.me && meNickname && !result.rows.some((r) => r.nickname === meNickname)) {
            entries.push({
              key: `${period}-me`,
              label: `${result.me.rank}. ${result.me.nickname}`,
              value: result.me.value,
              detail: "You",
            });
          }
          if (isMounted) setRows(entries);
        })
        .catch(function leaderboardErrorACB(error) {
          console.log("Failed to load leaderboard:", error?.message || error);
          if (isMounted) setRows([]);
        })
        .finally(function leaderboardFinallyACB() {
          if (isMounted) setLoading(false);
        });

      return function cleanupACB() {
        isMounted = false;
      };
    },
    [period],
  );

  const copy = PERIOD_COPY[period];
  const displayRows: LeaderboardEntry[] = loading
    ? [{ label: "Loading…", value: "", detail: "Fetching the leaderboard" }]
    : rows.length
      ? rows
      : [{ label: "Nobody here yet", value: "", detail: copy.empty }];

  return (
    <View style={style.page}>
      <LeaderBoardFormView period={period} onPeriodChange={setPeriod} />
      <LeaderBoardResultView
        title={copy.title}
        subtitle={copy.subtitle}
        rows={displayRows}
      />
    </View>
  );
}

export default Leaderboard;

const makeStyle = (theme: Theme) => ({
  page: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
});
