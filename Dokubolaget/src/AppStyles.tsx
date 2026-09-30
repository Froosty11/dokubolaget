import type { Theme } from "./theme/types";

export function makeAppStyles(theme: Theme) {
  return {
    body: {
      flexDirection: "column" as const,
      alignItems: "center" as const,
      padding: 16,
      width: "100%" as const,
      height: "100%" as const,
      justifyContent: "center" as const,
      gap: 10,
      backgroundColor: theme.colors.page,
    },
    cellCard: {
      flex: 1,
      flexDirection: "column" as const,
      width: "100%" as const,
      rowGap: 3,
      borderRadius: theme.radii.cell,
      backgroundColor: theme.colors.cellFill,
      padding: 5,
      borderWidth: theme.borders.cell,
      borderColor: theme.colors.cellBorder,
    },
    cellImage: {
      flex: 1,
      resizeMode: "contain" as const,
    },
    button: {
      width: "100%" as const,
      padding: 5,
      backgroundColor: theme.colors.surface,
      flexDirection: "row" as const,
      gap: 5,
      height: 35,
    },
  };
}

// Legacy static styles for views not yet on theme tokens; removed once the
// last one migrates.
import { StyleSheet } from "react-native";
import { modern } from "./theme/themes/modern";
export const Style = StyleSheet.create(makeAppStyles(modern));
