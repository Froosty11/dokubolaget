import React from "react";
import { useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useWideLayout } from "../useWideLayout";

type LeaderboardEntry = {
  key?: string;
  label: string;
  value: string | number;
  detail?: string;
};

type LeaderboardResultViewProps = {
  title: string;
  subtitle: string;
  rows: LeaderboardEntry[];
};

export function LeaderBoardResultView({
  title,
  subtitle,
  rows,
}: LeaderboardResultViewProps) {
  const style = useThemedStyles(makeStyle);
  // On wide screens the page sets the margins, and the player's row stands out.
  const wide = useWideLayout();
  function keyExtractorACB(item: LeaderboardEntry, index: number) {
    return String(item.key || item.label || index);
  }

  function renderItemACB({ item }: { item: LeaderboardEntry }) {
    return (
      <View style={[style.row, wide && item.detail === "You" ? style.rowMe : null]}>
        <View>
          <Text style={style.rowLabel}>{item.label}</Text>
          {item.detail ? <Text style={style.rowDetail}>{item.detail}</Text> : null}
        </View>
        <Text style={style.rowValue}>{item.value}</Text>
      </View>
    );
  }

  return (
    <View style={[style.resultsRoot, wide ? style.resultsRootWide : null]}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractorACB}
        renderItem={renderItemACB}
        style={[style.list, wide ? style.listWide : null]}
        contentContainerStyle={style.listContent}
        ListHeaderComponent={
          <View style={style.sectionHeader}>
            <Text style={style.sectionTitle}>{title}</Text>
            <Text style={style.sectionSubtitle}>{subtitle}</Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyle = (theme: Theme) => ({
  resultsRoot: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    zIndex: 1,
  },
  resultsRootWide: {
    flex: 0,
    flexShrink: 1,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  listWide: {
    flexGrow: 0,
  },
  rowMe: {
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
  },
  sectionHeader: {
    padding: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bodyStrong,
    color: theme.colors.inkStrong,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  sectionSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.inkMuted,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  rowLabel: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.inkStrong,
  },
  rowDetail: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.inkFaint,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 14,
    fontWeight: "700" as const,
    color: theme.colors.inkStrong,
  },
});
