import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

type LeaderboardEntry = {
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
  function keyExtractorACB(item: LeaderboardEntry, index: number) {
    return String(item.detail || item.label || index);
  }

  function renderItemACB({ item }: { item: LeaderboardEntry }) {
    return (
      <View style={style.row}>
        <View>
          <Text style={style.rowLabel}>{item.label}</Text>
          {item.detail ? <Text style={style.rowDetail}>{item.detail}</Text> : null}
        </View>
        <Text style={style.rowValue}>{item.value}</Text>
      </View>
    );
  }

  return (
    <View style={style.resultsRoot}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractorACB}
        renderItem={renderItemACB}
        style={style.list}
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

const style = StyleSheet.create({
  resultsRoot: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    zIndex: 1,
  },
  sectionHeader: {
    padding: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  rowDetail: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
});
