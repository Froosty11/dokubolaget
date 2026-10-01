import { DEFAULT_THEME_ID, THEMES, clubTheme, isBuiltInThemeId, registeredClubThemeIds } from "./registry";
import type { ThemeId } from "./types";

// Where an unlock was earned decides where it is announced: board unlocks
// after the celebration on Play, streak unlocks on Home.
export type UnlockSource = "board" | "streak" | "scan";
import { availableThemeIds, mergeUnlocked, resolveActiveThemeId, unlocksForStreak } from "./unlocks";

function isAlwaysAvailable(id: ThemeId) {
  return THEMES.find((theme) => theme.id === id)?.unlock.kind === "always";
}

// Local test builds only: `EXPO_PUBLIC_UNLOCK_ALL_THEMES=true` at build time
// offers every theme. Production builds never set it.
const UNLOCK_ALL_FROM_BUILD = process.env.EXPO_PUBLIC_UNLOCK_ALL_THEMES === "true";

// Theme choice and unlocks. A plain object with getters, merged into the MobX
// model (see dokuModel.ts), so it stays testable without React or the network.
export function createThemeState({ unlockAll = UNLOCK_ALL_FROM_BUILD }: { unlockAll?: boolean } = {}) {
  return {
    themeId: DEFAULT_THEME_ID as ThemeId,
    unlockedThemes: [] as ThemeId[],
    loggedIn: false,
    longestStreak: 0,
    pendingUnlocks: [] as ThemeId[],
    pendingSources: {} as Partial<Record<ThemeId, UnlockSource>>,

    get availableThemeIds(): ThemeId[] {
      if (unlockAll) return [...THEMES.map((theme) => theme.id), ...registeredClubThemeIds()];
      const builtIn = availableThemeIds(THEMES, {
        unlocked: this.unlockedThemes,
        longestStreak: this.longestStreak,
        loggedIn: this.loggedIn,
      });
      // Club themes count once they're unlocked and downloaded.
      const clubs = this.unlockedThemes.filter((id) => !isBuiltInThemeId(id) && clubTheme(id));
      return [...builtIn, ...clubs];
    },
    get activeThemeId(): ThemeId {
      return resolveActiveThemeId(this.themeId, this.availableThemeIds, DEFAULT_THEME_ID);
    },
    // An unlocked club theme can be chosen before it has downloaded (the
    // account's choice from another device); it's worn once it arrives, and
    // activeThemeId falls back to the default until then.
    setThemeId(id: ThemeId): boolean {
      const unlockedClub = !isBuiltInThemeId(id) && this.unlockedThemes.includes(id);
      if (!this.availableThemeIds.includes(id) && !unlockedClub) return false;
      this.themeId = id;
      return true;
    },
    // Records unlocks and returns the ones that are new. With `announce`, the
    // new ones queue up for the "New theme unlocked" card (`true` = board).
    addUnlocks(ids: ThemeId[], announce: boolean | UnlockSource): ThemeId[] {
      const fresh = ids.filter((id) => !isAlwaysAvailable(id) && !this.unlockedThemes.includes(id));
      if (fresh.length === 0) return [];
      this.unlockedThemes = mergeUnlocked(this.unlockedThemes, fresh);
      if (announce) {
        const source: UnlockSource = announce === true ? "board" : announce;
        this.pendingUnlocks = [...this.pendingUnlocks, ...fresh];
        this.pendingSources = { ...this.pendingSources, ...Object.fromEntries(fresh.map((id) => [id, source])) };
      }
      return fresh;
    },
    applyStreak(longest: number) {
      this.longestStreak = Number.isFinite(longest) ? longest : 0;
      this.addUnlocks(unlocksForStreak(THEMES, { longestStreak: this.longestStreak, loggedIn: this.loggedIn }), "streak");
    },
    hasPendingUnlock(source?: UnlockSource): boolean {
      return this.pendingUnlocks.some((id) => !source || this.pendingSources[id] === source);
    },
    setLoggedIn(value: boolean) {
      this.loggedIn = value;
      if (!value) this.longestStreak = 0;
    },
    // Takes the next pending unlock, optionally only one earned in `source`.
    shiftPendingUnlock(source?: UnlockSource): ThemeId | null {
      const next = this.pendingUnlocks.find((id) => !source || this.pendingSources[id] === source);
      if (!next) return null;
      this.pendingUnlocks = this.pendingUnlocks.filter((id) => id !== next);
      return next;
    },
  };
}
