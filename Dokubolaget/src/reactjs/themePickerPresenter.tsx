import { router } from "expo-router";
import { useState } from "react";
import { haptics, saveHapticsSetting } from "../theme/haptics";
import { observer } from "mobx-react-lite";
import { THEMES } from "../theme/registry";
import { useTheme } from "../theme/ThemeProvider";
import type { ThemeId } from "../theme/types";
import { themeCardState } from "../theme/unlocks";
import { ThemePickerView } from "../views/themePickerView";

type ThemePickerModel = {
  unlockedThemes: ThemeId[];
  longestStreak: number;
  loggedIn: boolean;
};

export const ThemePicker = observer(function ThemePicker({ model }: { model: ThemePickerModel }) {
  const { id, setId, available } = useTheme();
  const ctx = { unlocked: model.unlockedThemes, longestStreak: model.longestStreak, loggedIn: model.loggedIn };
  const cards = THEMES.map((theme) => ({ theme, card: themeCardState(theme, ctx, id, available) }));
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
    />
  );
});
