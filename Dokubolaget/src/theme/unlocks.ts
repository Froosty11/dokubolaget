import { isThemeId } from "./registry";
import { THEME_IDS, type Theme, type ThemeId } from "./types";

export type UnlockContext = { unlocked: readonly ThemeId[]; longestStreak: number; loggedIn: boolean };

export function isThemeAvailable(theme: Theme, ctx: UnlockContext): boolean {
  const rule = theme.unlock;
  if (rule.kind === "always") return true;
  if (ctx.unlocked.includes(theme.id)) return true;
  return rule.kind === "streak" && ctx.loggedIn && ctx.longestStreak >= rule.days;
}

export function availableThemeIds(themes: Theme[], ctx: UnlockContext): ThemeId[] {
  return themes.filter((theme) => isThemeAvailable(theme, ctx)).map((theme) => theme.id);
}

export function unlocksForBoard(themes: Theme[], board: { misses: number }): ThemeId[] {
  return themes
    .filter((theme) => theme.unlock.kind === "firstBoard" || (theme.unlock.kind === "perfectBoard" && board.misses === 0))
    .map((theme) => theme.id);
}

export function unlocksForStreak(themes: Theme[], ctx: { longestStreak: number; loggedIn: boolean }): ThemeId[] {
  if (!ctx.loggedIn) return [];
  return themes
    .filter((theme) => theme.unlock.kind === "streak" && ctx.longestStreak >= theme.unlock.days)
    .map((theme) => theme.id);
}

export function unlockProgress(theme: Theme, ctx: UnlockContext) {
  if (theme.unlock.kind !== "streak") return null;
  const target = theme.unlock.days;
  return { current: Math.min(target, Math.max(0, Math.floor(ctx.longestStreak))), target };
}

export function parseThemeId(raw: unknown): ThemeId | null {
  return isThemeId(raw) ? raw : null;
}

// Accepts an array or its JSON string (AsyncStorage stores strings).
export function parseUnlocked(raw: unknown): ThemeId[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return mergeUnlocked([], value.filter(isThemeId));
}

export function mergeUnlocked(a: readonly ThemeId[], b: readonly ThemeId[]): ThemeId[] {
  const all = new Set<ThemeId>([...a, ...b]);
  return THEME_IDS.filter((id) => all.has(id));
}

export function resolveActiveThemeId(stored: ThemeId | null, available: readonly ThemeId[], fallback: ThemeId): ThemeId {
  return stored && available.includes(stored) ? stored : fallback;
}
