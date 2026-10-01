import type { createThemeState } from "./themeState";
import { parseThemeId, parseUnlocked } from "./unlocks";

type ThemeState = ReturnType<typeof createThemeState>;

// Applies the account's theme data after login. Order matters: unlocks from
// the account merge first, so the account's theme is selectable and a streak
// unlock the account already has isn't announced again.
export function applyAccountThemeData(
  state: ThemeState,
  privateData: { theme?: unknown; unlockedThemes?: unknown },
  publicData: { longestStreak?: unknown },
) {
  state.addUnlocks(parseUnlocked(privateData.unlockedThemes), false);
  state.applyStreak(Number(publicData.longestStreak) || 0);
  const accountTheme = parseThemeId(privateData.theme);
  if (accountTheme) state.setThemeId(accountTheme);
}
