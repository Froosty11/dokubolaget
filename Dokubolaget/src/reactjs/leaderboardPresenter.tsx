import { useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../api";
import { reactiveModel } from "../mobxReactiveModel";
import type { LeaderRow } from "../play/types";
import { useWideLayout } from "../useWideLayout";
import AuthDialog from "../views/authDialogView";
import { LeaderBoardFormView, type LeaderboardPeriod } from "../views/leaderboardFormView";
import { LeaderBoardResultView } from "../views/leaderboardResultView";
import { LeaderboardYouView } from "../views/leaderboardYouView";

type LeaderboardEntry = {
  key?: string;
  label: string;
  value: string | number;
  detail?: string;
};

type leaderboardProps = {
  limit?: number;
};

const PERIOD_COPY: Record<LeaderboardPeriod, { title: string; subtitle: string; empty: string; unit: string }> = {
  today: { title: "Today", subtitle: "Ranked by today's score", empty: "No scores yet today — be the first to finish the board.", unit: "points today" },
  week: { title: "This Week", subtitle: "Ranked by this week's score", empty: "No scores yet this week.", unit: "points this week" },
  all: { title: "All Time", subtitle: "Ranked by total score", empty: "No scores recorded yet.", unit: "points in total" },
  streak: { title: "Streak", subtitle: "Ranked by current streak", empty: "No streaks going yet.", unit: "days in a row" },
};

const Leaderboard = observer(function Leaderboard(_props: leaderboardProps) {
  const style = useThemedStyles(makeStyle);
  const wide = useWideLayout();
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  // The caller's own row, for the "You" card on wide screens.
  const [me, setMe] = useState<LeaderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const account = reactiveModel.account;

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
          if (isMounted) {
            setRows(entries);
            setMe(result.me);
          }
        })
        .catch(function leaderboardErrorACB(error) {
          console.log("Failed to load leaderboard:", error?.message || error);
          if (isMounted) {
            setRows([]);
            setMe(null);
          }
        })
        .finally(function leaderboardFinallyACB() {
          if (isMounted) setLoading(false);
        });

      return function cleanupACB() {
        isMounted = false;
      };
    },
    [period, account?.id],
  );

  const copy = PERIOD_COPY[period];
  const displayRows: LeaderboardEntry[] = loading
    ? [{ label: "Loading…", value: "", detail: "Fetching the leaderboard" }]
    : rows.length
      ? rows
      : [{ label: "Nobody here yet", value: "", detail: copy.empty }];

  if (wide) {
    return (
      <View style={[style.page, style.widePage]}>
        <View style={style.wideBody}>
          <LeaderBoardFormView period={period} onPeriodChange={setPeriod} />
          <View style={style.wideColumns}>
            <View style={style.wideTable}>
              <LeaderBoardResultView
                title={copy.title}
                subtitle={copy.subtitle}
                rows={displayRows}
              />
            </View>
            <View style={style.wideSide}>
              <LeaderboardYouView
                nickname={account?.nickname ?? null}
                periodTitle={copy.title}
                unit={copy.unit}
                me={me}
                stats={reactiveModel.stats}
                onLogin={() => setShowLogin(true)}
              />
            </View>
          </View>
        </View>
        <AuthDialog open={showLogin} onOpenChange={setShowLogin} />
      </View>
    );
  }

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
});

export default Leaderboard;

const makeStyle = (theme: Theme) => ({
  page: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  widePage: {
    backgroundColor: theme.colors.page,
  },
  wideBody: {
    flex: 1,
    width: "100%" as const,
    maxWidth: 960,
    alignSelf: "center" as const,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
  },
  wideColumns: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 24,
  },
  // Sized to its rows, scrolling once it reaches the bottom of the page.
  wideTable: {
    flex: 1.6,
    maxHeight: "100%" as const,
  },
  wideSide: {
    flex: 1,
  },
});
