import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Label, XStack, YStack } from "tamagui";
import * as Haptics from "expo-haptics"

export type TimeFilter = "TODAY" | "WEEK" | "MONTH" | "ALL_TIME";
export type CategoryFilter =
  | "TOTAL_SCORE"
  | "STREAK"
  | "LARGEST_STREAK"
  | "UNIQUENESS";

type SelectItemLike = {
  label: string;
  value: TimeFilter | CategoryFilter;
};

type LeaderBoardFormViewProps = {
  timeFilter: TimeFilter;
  onTimeFilterChange: (time: TimeFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (category: CategoryFilter) => void;
};

const timeOptions: { label: string; value: TimeFilter }[] = [
  { label: "Today", value: "TODAY" },
  { label: "This Week", value: "WEEK" },
  { label: "This Month", value: "MONTH" },
  { label: "All Time", value: "ALL_TIME" },
];

const categoryOptions: { label: string; value: CategoryFilter }[] = [
  { label: "Total Score", value: "TOTAL_SCORE" },
  { label: "Current Streak", value: "STREAK" },
  { label: "Largest Streak", value: "LARGEST_STREAK" },
  { label: "Uniqueness", value: "UNIQUENESS" },
];

export function LeaderBoardFormView({
  timeFilter,
  onTimeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
}: LeaderBoardFormViewProps) {
  return (
    <View style={style.formContainer}>
        <Text style={style.title}>Leaderboards</Text>
        <Text style={style.subtitle}>See how you rank</Text>

    <View style={style.formContainer}>
      <XStack gap="$3" marginBottom="$3">
        <YStack flex={1}>
          <Label
            size="$2"
            htmlFor="time-select"
            fontWeight="600"
            marginBottom="$1"
          >
            Time
          </Label>
          <LeaderboardSelect
            id="time-select"
            value={timeFilter}
            onValueChange={(value) => onTimeFilterChange(value as TimeFilter)}
            items={timeOptions}
            placeholder="Select time"
          />
        </YStack>

        <YStack flex={1}>
          <Label
            size="$2"
            htmlFor="category-select"
            fontWeight="600"
            marginBottom="$1"
          >
            Category
          </Label>
          <LeaderboardSelect
            id="category-select"
            value={categoryFilter}
            onValueChange={(value) =>
              onCategoryFilterChange(value as CategoryFilter)
            }
            items={categoryOptions}
            placeholder="Select category"
          />
        </YStack>
      </XStack>
    </View>
    </View>
  );
}

function LeaderboardSelect({
  id,
  value,
  onValueChange,
  items,
  placeholder,
}: {
  id: string;
  value: TimeFilter | CategoryFilter;
  onValueChange: (value: string) => void;
  items: SelectItemLike[];
  placeholder: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel =
    items.find((item) => item.value === value)?.label || placeholder;

  function onSelectACB(nextValue: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    
      <View style={style.selectWrapper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={id}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setOpen((prev) => !prev)
          }}
          style={style.trigger}
        >
          <Text style={style.triggerText}>{selectedLabel}</Text>
          <Text style={style.chevron}>▾</Text>
        </Pressable>

      {open ? (
        <View style={style.dropdown}>
          {items.map((item) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                key={item.value}
                onPress={() => onSelectACB(item.value)}
                style={style.dropdownItem}
              >
                <Text style={style.dropdownItemText}>{item.label}</Text>
                {isSelected ? <Text style={style.itemCheck}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const style = StyleSheet.create({
  formContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    position: "relative",
    zIndex: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
    paddingTop: 40,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  selectWrapper: {
    position: "relative",
    zIndex: 200,
  },
  trigger: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    fontSize: 14,
    color: "#111",
    flexShrink: 1,
  },
  chevron: {
    fontSize: 14,
    color: "#555",
    marginLeft: 8,
  },
  dropdown: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fff",
    zIndex: 9999,
    elevation: 8,
    overflow: "hidden",
  },
  dropdownItem: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111",
  },
  itemCheck: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  friendsTag: {
    minWidth: 68,
    height: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
    opacity: 0.5,
    paddingHorizontal: 8,
  },
  friendsTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
});
