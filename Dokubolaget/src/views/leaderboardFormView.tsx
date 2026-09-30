import React from "react";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
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
  const style = useThemedStyles(makeStyle);
  const { theme } = useTheme();
  const labelStyle = { color: theme.colors.ink, fontFamily: theme.fonts.bodyStrong };
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
            style={labelStyle}
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
            style={labelStyle}
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
  const style = useThemedStyles(makeStyle);
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

const makeStyle = (theme: Theme) => ({
  formContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
    position: "relative" as const,
    zIndex: 40,
  },
  title: {
    fontFamily: theme.fonts.bodyStrong,
    color: theme.colors.inkStrong,
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 4,
    paddingTop: 40,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.inkMuted,
    marginBottom: 16,
  },
  selectWrapper: {
    position: "relative" as const,
    zIndex: 200,
  },
  trigger: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  triggerText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.inkStrong,
    flexShrink: 1,
  },
  chevron: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.inkMuted,
    marginLeft: 8,
  },
  dropdown: {
    position: "absolute" as const,
    top: 44,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    zIndex: 9999,
    elevation: 8,
    overflow: "hidden" as const,
  },
  dropdownItem: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  dropdownItemText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.inkStrong,
  },
  itemCheck: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 14,
    fontWeight: "700" as const,
    color: theme.colors.inkStrong,
  },
  friendsTag: {
    minWidth: 68,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    alignSelf: "flex-end" as const,
    opacity: 0.5,
    paddingHorizontal: 8,
  },
  friendsTagText: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 12,
    fontWeight: "600" as const,
    color: theme.colors.inkFaint,
  },
});
