import { observable, reaction, configure } from "mobx";
import { model } from "./dokuModel";

import { connectToServer } from "./serverSync"
import { api, setDeviceIdProvider } from "./api"
import { createDeviceId } from "./deviceId"
import { createOutbox } from "./play/outbox"
import { createPlaySync } from "./play/playSync"
import { gameDay } from "./gameDay"
import { loadDeviceThemePrefs, saveDeviceThemePrefs } from "./theme/themeStorage"
import { UNLOCK_ALL_FROM_BUILD } from "./theme/themeState"
import { loadHapticsSetting } from "./theme/haptics"
import { createClubThemes } from "./theme/clubThemes"
import { registerClubTheme } from "./theme/registry"
import { CLUB_THEME_ID, type ClubThemeId } from "./theme/packSchema"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AppState, Platform } from "react-native"
import { boardKey, restoreProgress, serializeProgress } from "./progress"


configure({ enforceActions: "never" });

export const reactiveModel = observable(model);

// Every API call carries this install's random ID, so a player who isn't
// logged in still gets a score. Set before anything talks to the server.
setDeviceIdProvider(createDeviceId(AsyncStorage));

// Boards fetched from the server are cached, so a cold start offline still
// gets today's real board.
reactiveModel.boardCache = {
    read: async (day) => {
        const raw = await AsyncStorage.getItem(`dokubolaget.board.${day}`);
        return raw ? JSON.parse(raw) : null;
    },
    write: async (day, board) =>
        AsyncStorage.setItem(`dokubolaget.board.${day}`, JSON.stringify({ rows: board.rows, cols: board.cols })),
};

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

// Today's board progress survives reloads and app switches (a device cache of
// the daily board; the server's record wins once play sync reaches it).
const PROGRESS_KEY = "dokubolaget.progress";
const canUseStorage = Platform.OS !== "web" || typeof window !== "undefined";
const notDailyBoard = () => reactiveModel.playMode !== "daily" || reactiveModel.boardStatus !== "ready";
const progressKey = () => `${reactiveModel.boardDate}|${boardKey(reactiveModel)}`;
// Saves wait until saved progress for the board on screen has been read, so a
// freshly cleared board never overwrites it first.
let progressReadFor: string | null = null;

// Whenever the board is ready (startup, a new day, back from the archive),
// restore any saved progress for exactly that board.
reaction(
    () => [progressKey(), reactiveModel.boardStatus, reactiveModel.playMode].join("#"),
    () => {
        if (!canUseStorage || notDailyBoard()) return;
        const key = progressKey();
        if (reactiveModel.filledCellCount > 0) {
            progressReadFor = key;
            return;
        }
        progressReadFor = null;
        AsyncStorage.getItem(PROGRESS_KEY)
            .then((raw) => {
                if (progressKey() !== key) return;
                progressReadFor = key;
                const progress = restoreProgress(raw, reactiveModel.boardDate, boardKey(reactiveModel));
                // Re-check after the async read: the server's record may have
                // landed meanwhile, and a smaller device copy mustn't replace it.
                if (progress && Object.keys(progress.selectedProductsByCell).length > reactiveModel.filledCellCount) {
                    reactiveModel.applyProgress(progress);
                }
            })
            .catch((error) => {
                progressReadFor = key;
                console.warn("Progress read failed:", error);
            });
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
        if (!canUseStorage || notDailyBoard() || progressReadFor !== progressKey()) return;
        const raw = serializeProgress(reactiveModel.boardDate, boardKey(reactiveModel), {
            selectedProductsByCell: reactiveModel.selectedProductsByCell,
            missesByCell: reactiveModel.missesByCell,
            rejectedByCell: reactiveModel.rejectedByCell,
        });
        AsyncStorage.setItem(PROGRESS_KEY, raw).catch((error) => console.warn("Progress write failed:", error));
    },
);

// Guesses go to the server through a queue kept on the device; the board is
// reconciled with the server's record whenever it's ready or the app resumes.
export const playSync = createPlaySync({ api, outbox: createOutbox(AsyncStorage), model: reactiveModel, today: () => gameDay() });
if (typeof window !== "undefined") {
    playSync.start().then(() => playSync.refresh());
    reaction(() => [reactiveModel.boardStatus, reactiveModel.boardDate], () => playSync.refresh());
}

// A new day (04:00) while the app is open or resumed: start the new board
// instead of staying on yesterday's.
function rollOverIfNewDay() {
    if (reactiveModel.playMode !== "test" && reactiveModel.boardDate !== gameDay()) {
        reactiveModel.generateGame();
    }
}
function onResume() {
    rollOverIfNewDay();
    // Started offline: try for the real board again now the connection may be back.
    if (reactiveModel.playMode === "daily" && reactiveModel.boardStatus === "offline") reactiveModel.loadDailyBoard();
    playSync.refresh();
}
AppState.addEventListener("change", (state) => {
    if (state === "active") onResume();
});
if (Platform.OS === "web" && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") onResume();
    });
}
if (typeof window !== "undefined") setInterval(rollOverIfNewDay, 60_000);

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
// Account sync with the server. Starts after the device's theme prefs are
// read (above), so the account's theme wins over the device default.
const ANNOUNCED_KEY = "dokubolaget.announcedUnlocks";
export const serverSync = connectToServer(reactiveModel, {
    // After logging out, today's guesses and the device's saved copy of the
    // account's board are dropped, so the account's cells never come back.
    play: {
        forgetToday: async () => {
            await playSync.forgetToday();
            await AsyncStorage.removeItem(PROGRESS_KEY).catch(() => {});
        },
        refresh: () => playSync.refresh(),
    },
    announced: {
        read: async () => {
            const raw = await AsyncStorage.getItem(ANNOUNCED_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return Array.isArray(parsed) ? parsed : null;
        },
        write: async (ids) => AsyncStorage.setItem(ANNOUNCED_KEY, JSON.stringify(ids)),
    },
});

// Today's board: the server's, else the device's cached copy, else the
// bundled pick played offline as practice. Never swapped once shown.
reactiveModel.loadDailyBoard();
