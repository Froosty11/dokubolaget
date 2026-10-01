import { observable, reaction, configure } from "mobx";
import { model } from "./dokuModel";

import { connectToServer } from "./serverSync"
import { loadDeviceThemePrefs, saveDeviceThemePrefs } from "./theme/themeStorage"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AppState, Platform } from "react-native"
import { todayDateKey } from "./dokuModel"
import { boardKey, restoreProgress, serializeProgress } from "./progress"


configure({ enforceActions: "never" });

export const reactiveModel = observable(model);

// Theme choice and unlocks live on the device too, so they survive reloads
// for players who never log in.
let themePrefsLoaded = false;
loadDeviceThemePrefs().then(({ themeId, unlocked }) => {
    reactiveModel.addUnlocks(unlocked, false);
    if (themeId) reactiveModel.setThemeId(themeId);
    themePrefsLoaded = true;
    if (typeof window !== "undefined") serverSync.refresh();
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
                if (progress && boardKey(reactiveModel) === key) reactiveModel.applyProgress(progress);
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
