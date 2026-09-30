import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  limit as limitQuery,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { app } from "../firestoreModel";
import { LeaderBoardFormView } from "../views/leaderboardFormView";
import { LeaderBoardResultView } from "../views/leaderboardResultView";

type LeaderboardEntry = {
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("TODAY");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("TOTAL_SCORE");
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const filterMeta = getFilterMetadataACB(timeFilter, categoryFilter);

  useEffect(
    function loadLeaderboardACB() {
      let isMounted = true;
      const db = getFirestore(app);

      const usersQuery = query(
        collection(db, "users"),
        orderBy(filterMeta.categoryField, "desc"),
        limitQuery(limit),
      );

      setLoading(true);

      getDocs(usersQuery)
        .then(function toTopUsersACB(snapshot) {
          const rows = snapshot.docs.map(function docToRowACB(doc) {
            const data = doc.data() as any;
            const label =
              (typeof data.displayName === "string" && data.displayName.trim()) ||
              "Player " + (doc.id ? doc.id.slice(0, 6) : "????");

            return {
              label,
              value: filterMeta.displayValue(data),
              detail: doc.id,
            };
          });

          if (isMounted) {
            setTopUsers(rows);
          }
        })
        .catch(function leaderboardErrorACB(error) {
          console.log("Failed to load leaderboard:", error?.message || error);
          if (isMounted) {
            setTopUsers([]);
          }
        })
        .finally(function leaderboardFinallyACB() {
          if (isMounted) {
            setLoading(false);
          }
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
              label: "No scores yet",
              value: "--",
              detail: "No user docs found",
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

const style = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
