import { useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../api";
import { LeaderBoardFormView } from "../views/leaderboardFormView";
import { LeaderBoardResultView } from "../views/leaderboardResultView";

type LeaderboardEntry = {
  key?: string;
  label: string;
  value: string | number;
  detail?: string;
};

type LeaderboardSection = {
  title: string;
  subtitle: string;
  rows: LeaderboardEntry[];
};

type leaderboardProps = {
  limit?: number;
};

type TimeFilter = "TODAY" | "WEEK" | "MONTH" | "ALL_TIME";
type CategoryFilter =
  | "TOTAL_SCORE"
  | "STREAK"
  | "LARGEST_STREAK"
  | "UNIQUENESS";

type FilterMetadata = {
  timeField: string;
  categoryField: string;
  displayValue: (data: any) => string | number;
  sectionTitle: string;
  sectionSubtitle: string;
};

function getFilterMetadataACB(
  time: TimeFilter,
  category: CategoryFilter,
): FilterMetadata {
  const timeLabels: Record<TimeFilter, string> = {
    TODAY: "Today",
    WEEK: "This Week",
    MONTH: "This Month",
    ALL_TIME: "All Time",
  };

  const categoryLabels: Record<CategoryFilter, string> = {
    TOTAL_SCORE: "Total Score",
    STREAK: "Current Streak",
    LARGEST_STREAK: "Largest Streak",
    UNIQUENESS: "Uniqueness",
  };

  let timeField = "dailyScore";
  if (time === "WEEK") timeField = "weeklyScore";
  if (time === "MONTH") timeField = "monthlyScore";
  if (time === "ALL_TIME") timeField = "totalScore";

  let categoryField = "totalScore";
  if (category === "STREAK") categoryField = "currentStreak";
  if (category === "LARGEST_STREAK") categoryField = "longestStreak";
  if (category === "UNIQUENESS") categoryField = "uniquenessPercent";
  if (category === "TOTAL_SCORE") categoryField = timeField;

  let displayValue: (data: any) => string | number = (data) => "--";
  if (category === "UNIQUENESS") {
    displayValue = (data) => {
      const uniq = Number(data.uniquenessPercent);
      return Number.isFinite(uniq) ? uniq.toFixed(2) + "%" : "--";
    };
  } else {
    displayValue = (data) => Number(data[categoryField] || 0);
  }

  const timeLabel = timeLabels[time];
  const categoryLabel = categoryLabels[category];

  //u4@test.se
  return {
    timeField,
    categoryField,
    displayValue,
    sectionTitle: `${categoryLabel} - ${timeLabel}`,
    sectionSubtitle: `Users ranked by ${categoryLabel.toLowerCase()}`,
  };
}

function Leaderboard({limit = 20 }: leaderboardProps) {
  const style = useThemedStyles(makeStyle);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("TODAY");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("TOTAL_SCORE");
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const filterMeta = getFilterMetadataACB(timeFilter, categoryFilter);

  useEffect(
    function loadLeaderboardACB() {
      let isMounted = true;
      setLoading(true);

      // Scores arrive with the scoring update; until then the list is empty.
      api
        .leaderboard()
        .then(function toTopUsersACB(result) {
          const rows = result.rows.map(function toRowACB(row, index) {
            return { key: `${row.nickname}-${index}`, label: row.nickname, value: row.score };
          });
          if (isMounted) setTopUsers(rows);
        })
        .catch(function leaderboardErrorACB(error) {
          console.log("Failed to load leaderboard:", error?.message || error);
          if (isMounted) setTopUsers([]);
        })
        .finally(function leaderboardFinallyACB() {
          if (isMounted) setLoading(false);
        });

      return function cleanupACB() {
        isMounted = false;
      };
    },
    [timeFilter, categoryFilter],
  );

  const section: LeaderboardSection = {
    title: filterMeta.sectionTitle,
    subtitle: filterMeta.sectionSubtitle,
    rows: loading
      ? [{ label: "Loading...", value: "", detail: "Fetching users" }]
      : topUsers.length
        ? topUsers
        : [
            {
              label: "Scores are coming soon",
              value: "",
              detail: "Rarity scores and streaks arrive with the next update.",
            },
          ],
  };

  return (
    <View style={style.page}>
      <LeaderBoardFormView
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />
      <LeaderBoardResultView
        title={section.title}
        subtitle={section.subtitle}
        rows={section.rows}
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
