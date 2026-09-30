import { DEFAULT_THEME_ID, THEMES } from "./registry";
import type { ThemeId } from "./types";
import { availableThemeIds, mergeUnlocked, resolveActiveThemeId, unlocksForStreak } from "./unlocks";

function isAlwaysAvailable(id: ThemeId) {
  return THEMES.find((theme) => theme.id === id)?.unlock.kind === "always";
}

// Theme choice and unlocks. A plain object with getters, merged into the MobX
// model (see dokuModel.ts), so it stays testable without React or Firebase.
export function createThemeState() {
  return {
    themeId: DEFAULT_THEME_ID as ThemeId,
    unlockedThemes: [] as ThemeId[],
    loggedIn: false,
    longestStreak: 0,
    pendingUnlocks: [] as ThemeId[],

    get availableThemeIds(): ThemeId[] {
      return availableThemeIds(THEMES, {
        unlocked: this.unlockedThemes,
        longestStreak: this.longestStreak,
        loggedIn: this.loggedIn,
      });
    },
    get activeThemeId(): ThemeId {
      return resolveActiveThemeId(this.themeId, this.availableThemeIds, DEFAULT_THEME_ID);
    },
    setThemeId(id: ThemeId): boolean {
      if (!this.availableThemeIds.includes(id)) return false;
      this.themeId = id;
      return true;
    },
    // Records unlocks and returns the ones that are new. With `announce`, the
    // new ones queue up for the "New theme unlocked" card.
    addUnlocks(ids: ThemeId[], announce: boolean): ThemeId[] {
      const fresh = ids.filter((id) => !isAlwaysAvailable(id) && !this.unlockedThemes.includes(id));
      if (fresh.length === 0) return [];
      this.unlockedThemes = mergeUnlocked(this.unlockedThemes, fresh);
      if (announce) this.pendingUnlocks = [...this.pendingUnlocks, ...fresh];
      return fresh;
    },
    applyStreak(longest: number) {
      this.longestStreak = Number.isFinite(longest) ? longest : 0;
      this.addUnlocks(unlocksForStreak(THEMES, { longestStreak: this.longestStreak, loggedIn: this.loggedIn }), true);
    },
    setLoggedIn(value: boolean) {
      this.loggedIn = value;
      if (!value) this.longestStreak = 0;
    },
    shiftPendingUnlock(): ThemeId | null {
      const [next, ...rest] = this.pendingUnlocks;
      this.pendingUnlocks = rest;
      return next ?? null;
    },
  };
}
