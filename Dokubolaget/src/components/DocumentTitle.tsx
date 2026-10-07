// Keeps the browser tab title branded per route on web. Expo Router clears the
// static <title> on hydration and doesn't apply route titles here, so we set
// document.title ourselves from the current path. Renders nothing; no-op on
// native. Rendered last in the root layout so its effect wins over Expo's.
import { useEffect } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { documentTitleFor } from "../documentTitle";

export function DocumentTitle() {
  const pathname = usePathname();
  const { copy } = useTheme();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = documentTitleFor(pathname, {
      home: copy.tabHome,
      play: copy.tabPlay,
      leaderboard: copy.tabLeaderboard,
      search: copy.searchTitle,
    });
  }, [pathname, copy]);
  return null;
}
