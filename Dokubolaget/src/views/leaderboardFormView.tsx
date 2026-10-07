import React from "react";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptics } from "../theme/haptics";

// The four leaderboards the server actually serves (server/stats.ts Period,
// minus "yesterday" which the UI doesn't expose). The values are passed to
// api.leaderboard() unchanged.
export type LeaderboardPeriod = "today" | "week" | "all" | "streak";

type LeaderBoardFormViewProps = {
  period: LeaderboardPeriod;
  onPeriodChange: (period: LeaderboardPeriod) => void;
};

const periodOptions: { label: string; value: LeaderboardPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "All Time", value: "all" },
  { label: "Streak", value: "streak" },
];

export function LeaderBoardFormView({
  period,
  onPeriodChange,
}: LeaderBoardFormViewProps) {
  const style = useThemedStyles(makeStyle);
  return (
    <View style={style.formContainer}>
      <Text style={style.title}>Leaderboards</Text>
      <Text style={style.subtitle}>See how you rank</Text>

      <View style={style.formContainer}>
        <Text style={style.fieldLabel}>Leaderboard</Text>
        <LeaderboardSelect
          id="period-select"
          value={period}
          onValueChange={(value) => onPeriodChange(value as LeaderboardPeriod)}
          items={periodOptions}
          placeholder="Select leaderboard"
        />
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
  value: LeaderboardPeriod;
  onValueChange: (value: string) => void;
  items: { label: string; value: LeaderboardPeriod }[];
  placeholder: string;
}) {
  const style = useThemedStyles(makeStyle);
  const [open, setOpen] = React.useState(false);
  const selectedLabel =
    items.find((item) => item.value === value)?.label || placeholder;

  function onSelectACB(nextValue: string) {
    haptics.play("tap")
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
      <View style={style.selectWrapper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={id}
          onPress={() => {
            haptics.play("tap");
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
  fieldLabel: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 13,
    fontWeight: "600" as const,
    color: theme.colors.ink,
    marginBottom: 6,
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
});
