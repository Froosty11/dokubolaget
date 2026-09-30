// initialize Firebase app
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

// uncomment the following lines when you have your firebaseConfig. Understand what the lines are doing!
import { firebaseConfig } from "./firebaseConfig";

export const app = initializeApp(firebaseConfig);

// Initialize auth with persistence based on platform --e
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

const db = getFirestore(app);

const USERS_COLLECTION = "users";
const BOARDS_COLLECTION = "boards";

export type FirestoreBoard = {
  rows: Array<{ id: string; label: string; family: string }>;
  cols: Array<{ id: string; label: string; family: string }>;
  // Cell counts in row-major order — flat array of 9 (rows 0,1,2 of cols 0,1,2).
  // Stored flat because Firestore rejects nested arrays.
  counts?: number[];
  score?: number;
  seed?: string;
};

// Reads boards/{dateKey} written by the seed-board GitHub Action. Returns null
// if the document is missing, malformed, or the call fails — caller falls back
// to the local generated-boards.json bundle.
export async function fetchBoardForDateACB(
  dateKey: string,
): Promise<FirestoreBoard | null> {
  console.log("[BOARD] fetchBoardForDateACB getDoc boards/" + dateKey);
  try {
    const snap = await getDoc(doc(db, BOARDS_COLLECTION, dateKey));
    if (!snap.exists()) {
      console.log("[BOARD] boards/" + dateKey + " does not exist in Firestore");
      return null;
    }

    const data = snap.data() as any;
    const rows = Array.isArray(data?.rows) ? data.rows : null;
    const cols = Array.isArray(data?.cols) ? data.cols : null;
    if (!rows || !cols) {
      console.warn(
        "[BOARD] boards/" + dateKey +
          " exists but is malformed (missing rows/cols arrays). Raw data:",
        data,
      );
      return null;
    }
    return {
      rows,
      cols,
      counts: Array.isArray(data?.counts) ? (data.counts as number[]) : undefined,
      score: typeof data?.score === "number" ? data.score : undefined,
      seed: typeof data?.seed === "string" ? data.seed : undefined,
    };
  } catch (error) {
    console.warn("[BOARD] fetchBoardForDateACB failed for boards/" + dateKey + ":", error);
    return null;
  }
}

type ScoreHistoryEntry = {
  date: string;
  score: number;
};

function normalizeHistoryACB(history: any): ScoreHistoryEntry[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(function toHistoryEntryACB(entry: any) {
      if (!entry || typeof entry.date !== "string") {
        return null;
      }

      const score = Number(entry.score);
      return {
        date: entry.date,
        score: Number.isFinite(score) ? score : 0,
      };
    })
    .filter(function isHistoryEntryACB(entry): entry is ScoreHistoryEntry {
      return entry !== null;
    })
    .sort(function sortHistoryACB(a: ScoreHistoryEntry, b: ScoreHistoryEntry) {
      return a.date.localeCompare(b.date);
    });
}

// Public display names must never be an email address: the users collection
// is world-readable for the leaderboard.
const DISPLAY_NAME_PATTERN = /^[^@<>]{2,24}$/;

export function normalizeDisplayName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().replace(/\s+/g, " ");
  return DISPLAY_NAME_PATTERN.test(trimmed) ? trimmed : null;
}

function fallbackDisplayName(uid: string) {
  return "Spelare " + uid.slice(0, 4).toUpperCase();
}

// Set by the sign-up flow just before the account is created, so the first
// profile write already carries the chosen nickname.
let pendingNickname: string | null = null;

export function setPendingNickname(name: string | null) {
  pendingNickname = normalizeDisplayName(name);
}

export function connectToPersistence(model: any, watchFunction: any) {
  let publicDocACB: any = null;
  let privateDocACB: any = null;

  function checkACB() {
    return [model.gameCells, model.currentCell];
  }
  // Only private game progress is written from the client. Leaderboard stats
  // (scores, streaks) are read-only here; the Firestore rules reject client
  // writes to them so scores can't be forged from the browser.
  function effectACB() {
    if (!model.ready || !privateDocACB || model.practiceBoard) {
      return;
    }
    setDoc(
      privateDocACB,
      {
        gameCells: model.gameCells,
        currentCell: model.currentCell || null,
      },
      { merge: true },
    ).catch(errorACB);
  }

  function applyPublicACB(snapshot: any) {
    const data = snapshot.data() || {};
    model.scoreHistory = normalizeHistoryACB(data.scoreHistory);
  }

  function applyPrivateACB(snapshot: any) {
    const data = snapshot.data() || {};
    const hasValidGameCells =
      Array.isArray(data.gameCells) && data.gameCells.length > 0;
    model.gameCells = hasValidGameCells
      ? data.gameCells
      : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    model.currentCell = !data.currentCell ? null : data.currentCell;
    model.score = 0;
  }

  function errorACB(error: any) {
    console.log(
      "Firestore persistence error:",
      error?.message || error.toString(),
    );
  }

  function modelReadyACB() {
    model.ready = true;
    effectACB();
  }

  // Picks the public name: a nickname from sign-up, then the auth profile name,
  // then whatever valid name is already stored, then an anonymous fallback.
  // Replaces any stored name that is an email address.
  function syncDisplayNameACB(user: any, publicDoc: any) {
    return getDoc(publicDoc).then(function chooseNameACB(snapshot: any) {
      const stored = snapshot.exists() ? snapshot.data()?.displayName : undefined;
      const wanted =
        pendingNickname ||
        normalizeDisplayName(user.displayName) ||
        normalizeDisplayName(stored) ||
        fallbackDisplayName(user.uid);
      pendingNickname = null;
      if (wanted !== stored) {
        return setDoc(publicDoc, { displayName: wanted }, { merge: true }).then(
          function rereadACB() {
            return getDoc(publicDoc);
          },
        );
      }
      return snapshot;
    });
  }

  watchFunction(checkACB, effectACB);
  model.ready = false;

  onAuthStateChanged(auth, function authStateACB(user) {
    if (!user) {
      model.ready = false;
      publicDocACB = null;
      privateDocACB = null;
      return;
    }

    model.ready = false;
    publicDocACB = doc(db, USERS_COLLECTION, user.uid);
    privateDocACB = doc(db, USERS_COLLECTION, user.uid, "private", "profile");

    const publicSeed = syncDisplayNameACB(user, publicDocACB).then(applyPublicACB);
    const privateSeed = getDoc(privateDocACB).then(applyPrivateACB);

    Promise.all([publicSeed, privateSeed])
      .catch(errorACB)
      .then(modelReadyACB);
  });
}
