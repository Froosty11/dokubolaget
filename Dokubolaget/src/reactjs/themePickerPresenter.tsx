import { router } from "expo-router";
import { useState } from "react";
import { haptics, saveHapticsSetting } from "../theme/haptics";
import { observer } from "mobx-react-lite";
import { THEMES, clubTheme, isBuiltInThemeId } from "../theme/registry";
import type { PackSummary } from "../theme/packSchema";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemeId } from "../theme/types";
import { UNLOCK_ALL_FROM_BUILD } from "../theme/themeState";
import { themeCardState } from "../theme/unlocks";
import { ThemePickerView } from "../views/themePickerView";

type ThemePickerModel = {
  unlockedThemes: ThemeId[];
  clubSummaries: PackSummary[];
  longestStreak: number;
  loggedIn: boolean;
};

export const ThemePicker = observer(function ThemePicker({ model }: { model: ThemePickerModel }) {
  const { id, setId, available } = useTheme();
  const ctx = { unlocked: model.unlockedThemes, longestStreak: model.longestStreak, loggedIn: model.loggedIn };
  const cards = THEMES.map((theme) => ({ theme, card: themeCardState(theme, ctx, id, available) }));
  // Unlocked club themes after the built-in ones; any not downloaded yet are
  // listed by name. Unlock-all test builds list every club theme.
  const unlockedClubs = model.unlockedThemes.filter((unlocked) => !isBuiltInThemeId(unlocked));
  const clubIds = UNLOCK_ALL_FROM_BUILD
    ? [...new Set([...unlockedClubs, ...model.clubSummaries.map((summary) => summary.id)])]
    : unlockedClubs;
  const clubCards = clubIds.flatMap((clubId) => {
    const theme = clubTheme(clubId);
    return theme ? [{ theme, card: themeCardState(theme, ctx, id, available) }] : [];
  });
  const downloading = clubIds
    .filter((clubId) => !clubTheme(clubId))
    .map((clubId) => model.clubSummaries.find((s) => s.id === clubId)?.name ?? clubId);
  const streakLine = model.loggedIn ? `Best streak: ${model.longestStreak} days` : "Log in to earn streak rewards";

  function onPick(next: ThemeId) {
    if (setId(next)) haptics.play("tap");
  }

  const [hapticsOn, setHapticsOn] = useState(haptics.enabled);
  function onToggleHaptics(on: boolean) {
    saveHapticsSetting(on);
    setHapticsOn(on);
    if (on) haptics.play("tap");
  }

  function onClose() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <ThemePickerView
      cards={cards}
      streakLine={streakLine}
      onPick={onPick}
      onClose={onClose}
      hapticsOn={hapticsOn}
      onToggleHaptics={onToggleHaptics}
      clubCards={clubCards}
      downloading={downloading}
      onOpenStamps={() => router.push("/stamps")}
    />
  );
});
