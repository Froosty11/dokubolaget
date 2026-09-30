import { observable, reaction, configure } from "mobx";
import { model } from "./dokuModel";

import { connectToPersistence } from "./firestoreModel"
import { loadDeviceThemePrefs, saveDeviceThemePrefs } from "./theme/themeStorage"


configure({ enforceActions: "never" });

export const reactiveModel = observable(model);

// Theme choice and unlocks live on the device too, so they survive reloads
// for players who never log in.
let themePrefsLoaded = false;
loadDeviceThemePrefs().then(({ themeId, unlocked }) => {
    reactiveModel.addUnlocks(unlocked, false);
    if (themeId) reactiveModel.setThemeId(themeId);
    themePrefsLoaded = true;
});
reaction(
    () => [reactiveModel.themeId, reactiveModel.unlockedThemes.join(",")],
    () => {
        if (themePrefsLoaded) saveDeviceThemePrefs(reactiveModel.themeId, reactiveModel.unlockedThemes);
    },
);

if (__DEV__ && typeof window !== "undefined") {
    (window as any).__doku = reactiveModel; // screenshot tool + console debugging
}
reaction(checkACB,sideEffectACB);

// TODO - Impelement this
connectToPersistence(reactiveModel, reaction)

// Pull today's board from Firestore on app start. Falls back silently to the
// local generated-boards.json pick already in reactiveModel.topCategories /
// sideCategories if Firestore has no doc for today.
reactiveModel.loadDailyBoardFromFirestore();


function checkACB() {
    //TODO
    // return myModel.currentCell ?
    return true;
}

function sideEffectACB() {
    //TODO
    // myModel.currentCellEffect() ?

}
