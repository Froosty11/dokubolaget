import { reaction } from "mobx";
import { api, type Account } from "./api";
import { boardKey, type BoardProgress } from "./progress";
import { applyAccountThemeData } from "./theme/accountSync";

type SyncedModel = Parameters<typeof applyAccountThemeData>[0] & {
  account: Account | null;
  setAccount(account: Account | null): void;
  practiceBoard: boolean;
  boardDate: string;
  topCategories: Array<{ id: string }>;
  sideCategories: Array<{ id: string }>;
  filledCellCount: number;
  selectedProductsByCell: Record<number, any>;
  missesByCell: Record<number, number>;
  rejectedByCell: Record<number, string[]>;
  applyProgress(progress: BoardProgress): void;
};

function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

// Keeps the logged-in player's account data (theme, unlocks, today's
// progress) in step with the server. Logged out, everything stays on the
// device as before. Call refresh() once device prefs are loaded, and again
// after logging in.
export function connectToServer(model: SyncedModel) {
  // Writes start only after the account has been read, so this device's
  // defaults never overwrite what the account already has.
  let synced = false;

  function pushPrefs() {
    if (!synced) return;
    api.putPrefs({ theme: model.themeId, unlockedThemes: model.unlockedThemes }).catch((error) =>
      console.warn("Saving theme failed:", error?.message ?? error),
    );
  }

  function pushProgress() {
    if (!synced || model.practiceBoard || model.filledCellCount === 0) return;
    api
      .putProgress({
        date: model.boardDate,
        boardKey: boardKey(model),
        data: {
          selectedProductsByCell: model.selectedProductsByCell,
          missesByCell: model.missesByCell,
          rejectedByCell: model.rejectedByCell,
        },
      })
      .catch((error) => console.warn("Saving progress failed:", error?.message ?? error));
  }

  async function refresh() {
    try {
      const me = await api.me();
      model.setAccount(me.user);
      model.setLoggedIn(Boolean(me.user));
      if (!me.user) {
        synced = false;
        return;
      }
      applyAccountThemeData(
        model,
        { theme: me.prefs?.theme ?? undefined, unlockedThemes: me.prefs?.unlockedThemes ?? [] },
        // Streaks arrive with scoring (step 2).
        { longestStreak: 0 },
      );
      // Another device got further on today's board: continue from there.
      const remote = me.progress;
      if (
        remote &&
        !model.practiceBoard &&
        remote.date === model.boardDate &&
        remote.boardKey === boardKey(model) &&
        Object.keys(remote.data?.selectedProductsByCell ?? {}).length > model.filledCellCount
      ) {
        model.applyProgress(remote.data);
      }
      synced = true;
      pushPrefs();
      pushProgress();
    } catch (error: any) {
      // Offline or server down: keep playing logged out on this device.
      synced = false;
      console.warn("Couldn't reach the server:", error?.message ?? error);
    }
  }

  reaction(() => [model.themeId, model.unlockedThemes.join(",")], debounce(pushPrefs, 800));
  reaction(
    () => [model.selectedProductsByCell, model.missesByCell, model.rejectedByCell],
    debounce(pushProgress, 800),
  );

  return {
    refresh,
    async logout() {
      synced = false;
      await api.logout().catch(() => {});
      model.setAccount(null);
      model.setLoggedIn(false);
    },
  };
}
