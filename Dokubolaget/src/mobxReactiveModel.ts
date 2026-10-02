import { observable, reaction, configure } from "mobx";
import { model } from "./dokuModel";

import { connectToServer } from "./serverSync"
import { api } from "./api"
import { loadDeviceThemePrefs, saveDeviceThemePrefs } from "./theme/themeStorage"
import { UNLOCK_ALL_FROM_BUILD } from "./theme/themeState"
import { loadHapticsSetting } from "./theme/haptics"
import { createClubThemes } from "./theme/clubThemes"
import { registerClubTheme } from "./theme/registry"
import { CLUB_THEME_ID, type ClubThemeId } from "./theme/packSchema"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AppState, Platform } from "react-native"
import { todayDateKey } from "./dokuModel"
import { boardKey, restoreProgress, serializeProgress } from "./progress"


configure({ enforceActions: "never" });

export const reactiveModel = observable(model);

// The vibration switch is a device setting.
loadHapticsSetting();

// Club themes downloaded from the server, cached on the device.
export const clubThemes = createClubThemes({ storage: AsyncStorage, api, register: registerClubTheme });

// Downloads unlocked club themes this device doesn't have yet (a scan on
// another device, or a cleared cache).
function ensureUnlockedClubThemes() {
    for (const id of reactiveModel.unlockedThemes) {
        if (CLUB_THEME_ID.test(id) && !clubThemes.get(id)) clubThemes.ensure(id as ClubThemeId);
    }
}

// Theme choice and unlocks live on the device too, so they survive reloads
// for players who never log in. Cached club themes load first, so a club
// theme chosen last time can be worn straight away.
let themePrefsLoaded = false;
(typeof window !== "undefined" ? clubThemes.loadCache() : Promise.resolve())
    .catch((error) => console.warn("Club theme cache failed:", error))
    .then(() => loadDeviceThemePrefs())
    .then(async ({ themeId, unlocked }) => {
        reactiveModel.addUnlocks(unlocked, false);
        if (themeId) reactiveModel.setThemeId(themeId);
        themePrefsLoaded = true;
        if (typeof window === "undefined") return;
        reactiveModel.setClubSummaries(clubThemes.summaries());
        await serverSync.refresh();
        reactiveModel.setClubSummaries(await clubThemes.refresh(reactiveModel.unlockedThemes));
        if (UNLOCK_ALL_FROM_BUILD) {
            for (const summary of reactiveModel.clubSummaries) clubThemes.ensure(summary.id);
        }
    });
reaction(() => reactiveModel.unlockedThemes.join(","), () => {
    if (themePrefsLoaded) ensureUnlockedClubThemes();
});
reaction(
    () => [reactiveModel.themeId, reactiveModel.unlockedThemes.join(",")],
    () => {
        if (themePrefsLoaded) saveDeviceThemePrefs(reactiveModel.themeId, reactiveModel.unlockedThemes);
    },
);

// Today's board progress survives reloads and app switches (device only).
const PROGRESS_KEY = "dokubolaget.progress";
const canUseStorage = Platform.OS !== "web" || typeof window !== "undefined";

// Whenever the board changes (startup, server board swap, new day), restore any
// saved progress for exactly that board.
reaction(
    () => boardKey(reactiveModel),
    (key) => {
        if (!canUseStorage || reactiveModel.practiceBoard || reactiveModel.filledCellCount > 0) return;
        AsyncStorage.getItem(PROGRESS_KEY)
            .then((raw) => {
                const progress = restoreProgress(raw, reactiveModel.boardDate, key);
                // Re-check after the async read: account progress may have
                // landed meanwhile, and a smaller device copy mustn't replace it.
                if (
                    progress &&
                    boardKey(reactiveModel) === key &&
                    Object.keys(progress.selectedProductsByCell).length > reactiveModel.filledCellCount
                ) {
                    reactiveModel.applyProgress(progress);
                }
            })
            .catch((error) => console.warn("Progress read failed:", error));
    },
    { fireImmediately: true },
);

reaction(
    () => [
        reactiveModel.selectedProductsByCell,
        reactiveModel.missesByCell,
        reactiveModel.rejectedByCell,
    ],
    () => {
        if (!canUseStorage || reactiveModel.practiceBoard) return;
        const raw = serializeProgress(reactiveModel.boardDate, boardKey(reactiveModel), {
            selectedProductsByCell: reactiveModel.selectedProductsByCell,
            missesByCell: reactiveModel.missesByCell,
            rejectedByCell: reactiveModel.rejectedByCell,
        });
        AsyncStorage.setItem(PROGRESS_KEY, raw).catch((error) => console.warn("Progress write failed:", error));
    },
);

// A new day while the app is open (or resumed from the background): start
// the new board instead of staying on yesterday's.
function rollOverIfNewDay() {
    if (!reactiveModel.practiceBoard && reactiveModel.boardDate !== todayDateKey()) {
        reactiveModel.generateGame();
    }
}
AppState.addEventListener("change", (state) => {
    if (state === "active") rollOverIfNewDay();
});
if (Platform.OS === "web" && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") rollOverIfNewDay();
    });
}

if (typeof window !== "undefined") {
    api.config()
        .then(({ supportUrl, contactEmail }) => {
            reactiveModel.setSupportUrl(supportUrl);
            reactiveModel.setContactEmail(contactEmail);
        })
        .catch(() => {});
}

if (__DEV__ && typeof window !== "undefined") {
    (window as any).__doku = reactiveModel; // screenshot tool + console debugging
}
reaction(checkACB,sideEffectACB);

// Account sync with the server. Starts after the device's theme prefs are
// read (below), so the account's theme wins over the device default.
export const serverSync = connectToServer(reactiveModel)

// Pull today's board from the server on app start. Falls back silently to the
// local generated-boards.json pick already in reactiveModel.topCategories /
// sideCategories if the server has no board for today.
reactiveModel.loadDailyBoard();


function checkACB() {
    //TODO
    // return myModel.currentCell ?
    return true;
}

function sideEffectACB() {
    //TODO
    // myModel.currentCellEffect() ?

}
