import {
  searchByName,
  searchSystembolagetProducts,
} from "../src/systembolagetSource";
import { resolvePromise } from "./resolvePromise";
import generatedBoards from "../data/generated-boards.json";
import { doesProductMatchTagId } from "./boardTags";
import { formatTagLabel } from "./tagDisplay";
import { fetchBoardForDateACB } from "./firestoreModel";
import { createThemeState } from "./theme/themeState";
import { THEMES } from "./theme/registry";
import { unlocksForBoard } from "./theme/unlocks";

export type BoardTag = {
  id: string;
  label: string;
  family: string;
};

type GeneratedBoard = {
  rows: BoardTag[];
  cols: BoardTag[];
  counts: number[][];
  score: number;
};

type GeneratedBoardFile = {
  seed: string;
  boards: GeneratedBoard[];
};

const generatedBoardsFile = generatedBoards as GeneratedBoardFile;

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

// Fallback when Firestore has no document for the day (offline, new install
// before first sync, or a date the cron hasn't reached yet). Picks
// deterministically from the bundled pool so two players on the same date
// still see the same board.
function pickLocalBoardForToday() {
  const boards = Array.isArray(generatedBoardsFile?.boards)
    ? generatedBoardsFile.boards
    : [];

  if (boards.length === 0) {
    return {
      board: { rows: [], cols: [] },
      boardIndex: 0,
    };
  }

  const todayKey = todayDateKey();
  let hash = 0;
  for (let index = 0; index < todayKey.length; index += 1) {
    const codePoint = todayKey.codePointAt(index) ?? 0;
    hash = (hash * 31 + codePoint) >>> 0;
  }

  const boardIndex = hash % boards.length;
  return {
    board: boards[boardIndex],
    boardIndex,
  };
}

// Test hook for trying out generated boards locally: open the web app with
// ?board=<n> (1-based) to play a specific bundled board, or ?board=random.
// When set, the Firestore daily board is not loaded over it.
function readBoardOverride(boardCount: number): number | null {
  if (typeof window === "undefined" || !window.location || boardCount === 0) {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("board");
  if (!raw) return null;
  if (raw === "random") return Math.floor(Math.random() * boardCount);
  const asNumber = Number(raw);
  if (!Number.isInteger(asNumber) || asNumber < 1) return null;
  return (asNumber - 1) % boardCount;
}

const bundledBoardCount = Array.isArray(generatedBoardsFile?.boards)
  ? generatedBoardsFile.boards.length
  : 0;
const boardOverrideIndex = readBoardOverride(bundledBoardCount);

function pickInitialBoard() {
  if (boardOverrideIndex != null) {
    return {
      board: generatedBoardsFile.boards[boardOverrideIndex],
      boardIndex: boardOverrideIndex,
    };
  }
  return pickLocalBoardForToday();
}

const initialBoardPick = pickInitialBoard();

export type GuessFeedback = {
  kind: "correct" | "near" | "miss";
  isCorrect: boolean;
  message: string;
  cell: number;
  // For a near miss: the header that did match, so the board can light it up.
  matchedTagId?: string;
};

function doesProductMatchTag(product: any, tag: BoardTag | undefined) {
  if (!tag || !product) {
    return false;
  }
  return doesProductMatchTagId(product, String(tag.id || ""));
}

function getProductThumbnailUrlACB(product: any) {
  const hasImageMetadata =
    Array.isArray(product?.images) && product.images.length > 0;

  if (!hasImageMetadata) {
    return null;
  }

  const productId = String(
    product?.productId || product?.productNumber || "",
  ).trim();

  if (!productId) {
    return null;
  }

  return (
    "https://product-cdn.systembolaget.se/productimages/" +
    productId +
    "/" +
    productId +
    "_100.webp"
  );
}

/* 
   The Model keeps the state of the application (Application State). 
   It is an abstract object, i.e. it knows nothing about graphics and interaction.
*/
const modelBody = {
  /* ===== Gameplay related props ===== */
  currentCell: null,
  topCategories: initialBoardPick.board.cols,
  sideCategories: initialBoardPick.board.rows,
  currentBoardIndex: initialBoardPick.boardIndex,
  bundledBoardCount,
  boardSource: "local" as "local" | "firestore",
  // True when ?board= picked a test board. Progress on it is never saved, so
  // it can't overwrite today's real board in the player's profile.
  practiceBoard: boardOverrideIndex != null,
  gameCells: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  selectedProductsByCell: {} as Record<number, any>,
  score: 0,
  scoreHistory: [] as Array<{ date: string; score: number }>,

  // Pulls boards/{today} from Firestore (written by the seed-board GH Action)
  // and replaces the locally-picked board. No-op if Firestore has nothing yet.
  // Safe to call repeatedly; later calls just overwrite topCategories/sideCategories.
  async loadDailyBoardFromFirestore() {
    if (boardOverrideIndex != null) {
      console.log("[BOARD] ?board override active; skipping Firestore board");
      resolvePromise(Promise.resolve("local"), this.boardLoadPromiseState);
      return;
    }
    const dateKey = todayDateKey();
    console.log("[BOARD] loadDailyBoardFromFirestore start, dateKey=" + dateKey);
    const boardPromise = fetchBoardForDateACB(dateKey);
    // SuspenseView treats a null result as "still loading", so a missing
    // Firestore board would spin forever. Resolve the tracked promise with
    // the source label instead: null → we keep the bundled local board.
    resolvePromise(
      boardPromise.then((board) => (board ? "firestore" : "local")),
      this.boardLoadPromiseState,
    );

    const board = await boardPromise;
    if (!board) {
      console.log(
        "[BOARD] no Firestore doc at boards/" + dateKey +
          " — staying on local fallback (boardSource=" + this.boardSource + ")",
      );
      return;
    }
    this.topCategories = board.cols;
    this.sideCategories = board.rows;
    this.boardSource = "firestore";
  },

  setCurrentCell(cell: any) {
    this.currentCell = cell;
  },

  validateCellResult(cell: any, result: any) {
    const asNumber = Number(cell);
    if (!Number.isInteger(asNumber) || asNumber < 1 || asNumber > 9) {
      return {
        isValid: false,
        reason: "Invalid cell",
      };
    }

    const rowIndex = Math.floor((asNumber - 1) / 3);
    const colIndex = (asNumber - 1) % 3;
    const rowTag = this.sideCategories?.[rowIndex];
    const colTag = this.topCategories?.[colIndex];
    const product = result?.raw ?? result;

    if (!rowTag || !colTag) {
      return {
        isValid: false,
        reason: "Missing board categories",
      };
    }

    const matchesRow = doesProductMatchTag(product, rowTag);
    const matchesCol = doesProductMatchTag(product, colTag);

    if (matchesRow !== matchesCol) {
      const matched = matchesRow ? rowTag : colTag;
      const missing = matchesRow ? colTag : rowTag;
      return {
        isValid: false,
        kind: "near" as const,
        matchedTagId: String(matched.id),
        reason: `${formatTagLabel(matched)}, but not ${formatTagLabel(missing)}.`,
      };
    }

    if (!matchesRow && !matchesCol) {
      return {
        isValid: false,
        kind: "miss" as const,
        reason: `Neither ${formatTagLabel(rowTag)} nor ${formatTagLabel(colTag)}.`,
      };
    }

    return {
      isValid: true,
      kind: "correct" as const,
      reason: null,
    };
  },

  lastFeedback: null as GuessFeedback | null,

  // Wrong guesses per cell before it was solved. Drives the share grid
  // (green = first try, yellow = got there eventually).
  missesByCell: {} as Record<number, number>,

  setCellResult(cell: any, result: any) {
    const validation = this.validateCellResult(cell, result);
    const asNumber = Number(cell);

    if (!validation.isValid) {
      if (validation.kind === "near" || validation.kind === "miss") {
        this.missesByCell = {
          ...this.missesByCell,
          [asNumber]: (this.missesByCell[asNumber] || 0) + 1,
        };
      }
      this.lastFeedback = {
        kind: validation.kind === "near" ? "near" : "miss",
        isCorrect: false,
        message: String(validation.reason),
        cell: asNumber,
        matchedTagId: validation.kind === "near" ? validation.matchedTagId : undefined,
      };
      return {
        isValid: false,
        kind: validation.kind,
        reason: validation.reason,
      };
    }

    this.selectedProductsByCell = {
      ...this.selectedProductsByCell,
      [asNumber]: result,
    };

    this.lastFeedback = {
      kind: "correct",
      isCorrect: true,
      // The presenter picks the theme's cheer (composeFeedbackText).
      message: "",
      cell: asNumber,
    };

    return {
      isValid: true,
      kind: "correct" as const,
      reason: null,
    };
  },

  get filledCellCount() {
    return Object.keys(this.selectedProductsByCell).length;
  },

  // Wordle-style grid for sharing a finished (or partial) board.
  buildShareText() {
    const rows: string[] = [];
    for (let row = 0; row < 3; row += 1) {
      let line = "";
      for (let col = 0; col < 3; col += 1) {
        const cell = row * 3 + col + 1;
        if (!this.selectedProductsByCell[cell]) line += "⬜";
        else line += (this.missesByCell[cell] || 0) === 0 ? "🟩" : "🟨";
      }
      rows.push(line);
    }
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://dokubolaget.se";
    return [
      `Dokubolaget ${todayDateKey()} ${this.filledCellCount}/9`,
      ...rows,
      origin,
    ].join("\n");
  },

  clearLastFeedback() {
    this.lastFeedback = null;
  },

  generateGame() {
    if (this.score > 0) {
      this.scoreHistory = [
        ...this.scoreHistory,
        { date: new Date().toISOString().slice(0, 10), score: this.score },
      ];
    }

    this.gameCells = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    this.selectedProductsByCell = {};
    this.missesByCell = {};
    this.score = 0;

    const pickedBoard = pickInitialBoard();
    this.currentBoardIndex = pickedBoard.boardIndex;
    this.topCategories = pickedBoard.board.cols;
    this.sideCategories = pickedBoard.board.rows;
    this.boardSource = "local";

    // Refresh from Firestore in the background; updates topCategories/sideCategories
    // if the seeded daily board differs from the local fallback.
    this.loadDailyBoardFromFirestore();
  },

  boardLoadPromiseState: {},

  /* ===== Search related props ===== */
  searchParams: {} as Record<string, any>,
  searchResultsPromiseState: {},

  setSearchQuery(query: string) {
    this.searchParams.query = query;
  },

  normalizeSearchResults(rawResponse: any) {
    const products = Array.isArray(rawResponse?.products)
      ? rawResponse.products
      : [];

    return products
      .filter(function isProductACB(product: any) {
        return Boolean(product?.productNumber || product?.productNameBold);
      })
      .map(function mapProductACB(product: any, index: number) {
        const id =
          product?.productId ||
          product?.productNumber ||
          product?.id ||
          String(index);

        const name =
          product?.productNameBold ||
          product?.productNameThin ||
          product?.productName ||
          "Unknown";

        const producer = product?.producerName || product?.supplierName || "";
        const country = product?.country || product?.originLevel1 || "";

        return {
          id: String(id),
          name,
          producer,
          country,
          image: getProductThumbnailUrlACB(product),
          raw: product,
        };
      });
  },

  doSearch(params: any) {
    const query = String(params?.query ?? this.searchParams.query ?? "").trim();
    const cell = params?.cell;

    this.searchParams = {
      ...this.searchParams,
      ...params,
      query,
      cell,
    };

    if (!query) {
      resolvePromise(Promise.resolve([]), this.searchResultsPromiseState);
      return;
    }

    const searchPromise = searchByName(query, { pageSize: 30 }).then(
      this.normalizeSearchResults,
    );

    resolvePromise(searchPromise, this.searchResultsPromiseState);
  },

  // Called once when a real (non-practice) board reaches 9/9. Returns the
  // themes it newly unlocked.
  recordBoardComplete(this: any) {
    if (this.practiceBoard) return [];
    const misses = Object.values(this.missesByCell as Record<number, number>).reduce(
      (sum, count) => sum + Number(count || 0),
      0,
    );
    return this.addUnlocks(unlocksForBoard(THEMES, { misses }), true);
  },
};

// Theme state is merged by property descriptor so its getters stay getters
// (MobX turns them into computeds).
export const model = Object.defineProperties(
  modelBody,
  Object.getOwnPropertyDescriptors(createThemeState()),
) as typeof modelBody & ReturnType<typeof createThemeState>;

// expose Systembolaget API to the browser console for debugging
if (__DEV__ && globalThis.window) {
  (globalThis.window as any).__sb = {
    searchByName,
    searchSystembolagetProducts,
    model,
  };
  console.log("Systembolaget API available in debug console! :))");
}
