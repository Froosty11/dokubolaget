// initialize Firebase app
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
} from "firebase/auth";
import { deleteField, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

// uncomment the following lines when you have your firebaseConfig. Understand what the lines are doing!
import { firebaseConfig } from "./firebaseConfig";

// typescript type sh*t
declare global {
  interface Window {
    db: any;
    doc: any;
    setDoc: any;
  }
}

export const app = initializeApp(firebaseConfig);

// Initialize auth with persistence based on platform --e
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

const db = getFirestore(app);

if (typeof window !== "undefined") {
  window.db = db;
  // make doc and setDoc available at the Console for testing
  window.doc = doc;
  window.setDoc = setDoc;
}

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

type LeaderboardStats = {
  scoreHistory: ScoreHistoryEntry[];
  dailyScore: number;
  weeklyScore: number;
  monthlyScore: number;
  totalScore: number;
  currentStreak: number;
  longestStreak: number;
  uniquenessPercent: number;
};

function getDateKeyACB(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseDateKeyACB(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

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

function deriveLeaderboardStatsACB(
  history: ScoreHistoryEntry[],
  currentScore: number,
): LeaderboardStats {
  const todayKey = getDateKeyACB();
  const normalizedHistory = normalizeHistoryACB(history);
  const historyByDate = new Map<string, number>();

  normalizedHistory.forEach(function addHistoryEntryACB(entry) {
    historyByDate.set(
      entry.date,
      (historyByDate.get(entry.date) || 0) +
        Math.max(0, Number(entry.score) || 0),
    );
  });

  const scoreHistory = Array.from(historyByDate.entries())
    .map(function toHistoryEntryACB([date, score]) {
      return { date, score };
    })
    .sort(function sortHistoryACB(a, b) {
      return a.date.localeCompare(b.date);
    });

  const todayDate = parseDateKeyACB(todayKey);
  const last7DaysStart = new Date(todayDate);
  last7DaysStart.setUTCDate(last7DaysStart.getUTCDate() - 6);
  const last30DaysStart = new Date(todayDate);
  last30DaysStart.setUTCDate(last30DaysStart.getUTCDate() - 29);

  let dailyScore = 0;
  let weeklyScore = 0;
  let monthlyScore = 0;
  let totalScore = 0;
  let longestStreak = 0;
  let currentStreak = 0;
  let previousDate = null as Date | null;
  let lastScoringDate = null as Date | null;

  scoreHistory.forEach(function accumulateScoresACB(entry) {
    const entryDate = parseDateKeyACB(entry.date);
    const score = Math.max(0, Number(entry.score) || 0);

    totalScore += score;

    if (entry.date === todayKey) {
      dailyScore += score;
    }

    if (entryDate >= last7DaysStart) {
      weeklyScore += score;
    }

    if (entryDate >= last30DaysStart) {
      monthlyScore += score;
    }

    const isConsecutiveDay =
      previousDate !== null &&
      (entryDate.getTime() - previousDate.getTime()) / 86400000 === 1;
    if (score > 0 && (previousDate === null || isConsecutiveDay)) {
      currentStreak += 1;
    } else if (score > 0) {
      currentStreak = 1;
    } else {
      currentStreak = 0;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    if (score > 0) {
      lastScoringDate = entryDate;
    }

    previousDate = entryDate;
  });

  const currentStreakGapDays =
    lastScoringDate === null
      ? Number.POSITIVE_INFINITY
      : Math.floor(
          (todayDate.getTime() - lastScoringDate.getTime()) / 86400000,
        );

  const currentStreakValue = currentStreakGapDays <= 1 ? currentStreak : 0;

  const uniquenessPercent =
    scoreHistory.length === 0
      ? 0
      : (scoreHistory.filter(function scoredEntriesACB(entry) {
          return Number(entry.score) > 0;
        }).length /
          scoreHistory.length) *
        100;

  return {
    scoreHistory,
    dailyScore,
    weeklyScore,
    monthlyScore,
    totalScore,
    currentStreak: currentStreakValue,
    longestStreak,
    uniquenessPercent,
  };
}

export function connectToPersistence(model: any, watchFunction: any) {
  let publicDocACB: any = null;
  let privateDocACB: any = null;

  function checkACB() {
    return [model.gameCells, model.scoreHistory];
  }
  function effectACB() {
    if (!model.ready || !publicDocACB || !privateDocACB) {
      return;
    }
    const stats = deriveLeaderboardStatsACB(model.scoreHistory, model.score);
    setDoc(
      publicDocACB,
      {
        scoreHistory: stats.scoreHistory,
        dailyScore: stats.dailyScore,
        weeklyScore: stats.weeklyScore,
        monthlyScore: stats.monthlyScore,
        totalScore: stats.totalScore,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        uniquenessPercent: stats.uniquenessPercent,
      },
      { merge: true },
    ).catch(errorACB);
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

    const publicSeed = setDoc(
      publicDocACB,
      {
        displayName: user.displayName || user.email || "",
        // Scrub fields written by older clients before the public/private split.
        email: deleteField(),
        gameCells: deleteField(),
        currentCell: deleteField(),
        score: deleteField(),
      },
      { merge: true },
    ).then(function readPublicACB() {
      return getDoc(publicDocACB).then(applyPublicACB);
    });

    const privateSeed = setDoc(
      privateDocACB,
      { email: user.email || "" },
      { merge: true },
    ).then(function readPrivateACB() {
      return getDoc(privateDocACB).then(applyPrivateACB);
    });

    Promise.all([publicSeed, privateSeed])
      .catch(errorACB)
      .then(modelReadyACB);
  });
}
