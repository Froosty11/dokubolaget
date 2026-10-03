import { reaction } from "mobx";
import { api, type Account } from "./api";
import type { UserStats } from "./play/types";
import { applyAccountThemeData } from "./theme/accountSync";
import { unannounced } from "./theme/announced";

type SyncedModel = Parameters<typeof applyAccountThemeData>[0] & {
  account: Account | null;
  setAccount(account: Account | null): void;
  setStats?(stats: UserStats | null): void;
  queueAnnouncements(ids: any[]): void;
  resetDailyBoard?(): void;
  syncNotice?: string | null;
};

// Play sync, as far as account sync needs it (play/playSync.ts).
type PlayHooks = { forgetToday(): Promise<void>; refresh(): Promise<void> };

// The device's list of earned themes it has already announced.
type AnnouncedStore = { read(): Promise<string[] | null>; write(ids: string[]): Promise<void> };

function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

// Keeps the logged-in player's account data (theme, unlocks, stats) in step
// with the server. Guesses go through play sync (play/playSync.ts) whether
// logged in or not. Call refresh() once device prefs are loaded, and
// afterLogin() after logging in or signing up.
export function connectToServer(model: SyncedModel, options: { announced: AnnouncedStore; play?: PlayHooks }) {
  // Writes start only after the account has been read, so this device's
  // defaults never overwrite what the account already has.
  let synced = false;
  // Reads and writes of the announced list run one at a time.
  let announcedChain: Promise<unknown> = Promise.resolve();
  function withAnnounced(fn: () => Promise<void>) {
    const next = announcedChain.then(fn, fn);
    announcedChain = next.catch(() => {});
    return next;
  }

  function pushPrefs() {
    if (!synced) return;
    api.putPrefs({ theme: model.themeId, unlockedThemes: model.unlockedThemes }).catch((error) =>
      console.warn("Saving theme failed:", error?.message ?? error),
    );
  }

  // Logged out, the device is its own player again and today's board stays
  // with the account, so the device starts clean (not a confusing revert).
  async function startCleanBoard() {
    await options.play?.forgetToday().catch(() => {});
    model.resetDailyBoard?.();
    model.syncNotice = "Logged out. Today's board stays with your account.";
    await options.play?.refresh().catch(() => {});
  }

  async function refresh() {
    try {
      const me = await api.me();
      model.setAccount(me.user);
      model.setLoggedIn(Boolean(me.user));
      if (!me.user) {
        synced = false;
        model.setStats?.(null);
        return;
      }
      applyAccountThemeData(
        model,
        { theme: me.prefs?.theme ?? undefined, unlockedThemes: me.prefs?.unlockedThemes ?? [] },
        { longestStreak: me.stats?.longestStreak ?? 0 },
      );
      model.setStats?.(me.stats ?? null);
      await withAnnounced(async () => {
        const announced = await options.announced.read();
        const { announce, remember } = unannounced(model.unlockedThemes, announced);
        if (announce.length) model.queueAnnouncements(announce);
        await options.announced.write(remember);
      });
      synced = true;
      pushPrefs();
    } catch (error: any) {
      // Offline or server down: keep playing logged out on this device.
      synced = false;
      console.warn("Couldn't reach the server:", error?.message ?? error);
    }
  }

  reaction(() => [model.themeId, model.unlockedThemes.join(",")], debounce(pushPrefs, 800));
  // Unlocks announced during play (a finished board, a streak) are
  // remembered too, so the next start doesn't announce them again.
  reaction(
    () => model.pendingUnlocks.join(","),
    () => {
      const ids = [...model.pendingUnlocks];
      if (ids.length === 0) return;
      withAnnounced(async () => {
        const announced = await options.announced.read();
        // Never read with an account yet: the first refresh remembers everything.
        if (announced === null) return;
        const { remember } = unannounced(ids, announced);
        if (remember.length !== announced.length) await options.announced.write(remember);
      }).catch(() => {});
    },
  );

  return {
    refresh,
    // Moves today's board played on this device onto the account, then reads
    // the account.
    async afterLogin() {
      await api.claim().catch(() => null);
      await refresh();
    },
    async logout() {
      synced = false;
      await api.logout().catch(() => {});
      model.setAccount(null);
      model.setLoggedIn(false);
      model.setStats?.(null);
      await startCleanBoard();
    },
    // The server also ends the session. The theme saved on this device stays,
    // as it would for any logged-out player; today's board starts clean.
    async deleteAccount(email: string, password: string) {
      await api.deleteAccount(email, password);
      synced = false;
      model.setAccount(null);
      model.setLoggedIn(false);
      model.setStats?.(null);
      await startCleanBoard();
    },
  };
}
