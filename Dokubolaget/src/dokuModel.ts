import {
  searchByName,
  searchSystembolagetProducts,
} from "../src/systembolagetSource";
import { resolvePromise } from "./resolvePromise";
import generatedBoards from "../data/generated-boards.json";
import { doesProductMatchTagId } from "./boardTags";
import { formatTagLabel } from "./tagDisplay";
import { fetchBoardForDateACB } from "./firestoreModel";

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

const initialBoardPick = pickLocalBoardForToday();

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
export const model = {
  /* ===== Gameplay related props ===== */
  currentCell: null,
  topCategories: initialBoardPick.board.cols,
  sideCategories: initialBoardPick.board.rows,
  currentBoardIndex: initialBoardPick.boardIndex,
  boardSource: "local" as "local" | "firestore",
  gameCells: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  selectedProductsByCell: {} as Record<number, any>,
  score: 0,
  scoreHistory: [] as Array<{ date: string; score: number }>,

  // Pulls boards/{today} from Firestore (written by the seed-board GH Action)
  // and replaces the locally-picked board. No-op if Firestore has nothing yet.
  // Safe to call repeatedly; later calls just overwrite topCategories/sideCategories.
  async loadDailyBoardFromFirestore() {
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

    if (!matchesRow || !matchesCol) {
      return {
        isValid: false,
        reason: `Must match both "${formatTagLabel(rowTag)}" and "${formatTagLabel(colTag)}"`,
      };
    }

    return {
      isValid: true,
      reason: null,
    };
  },

  lastFeedback: null as { isCorrect: boolean; message: string } | null,

  setCellResult(cell: any, result: any) {
    const validation = this.validateCellResult(cell, result);
    if (!validation.isValid) {
      this.lastFeedback = {
        isCorrect: false,
        message: validation.reason,
      };
      return {
        isValid: false,
        reason: validation.reason,
      };
    }

    const asNumber = Number(cell);

    this.selectedProductsByCell = {
      ...this.selectedProductsByCell,
      [asNumber]: result,
    };

    this.lastFeedback = {
      isCorrect: true,
      message: "Great!",
    };

    return {
      isValid: true,
      reason: null,
    };
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
    this.score = 0;

    const pickedBoard = pickLocalBoardForToday();
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
};

// expose Systembolaget API to the browser console for debugging
if (__DEV__ && globalThis.window) {
  (globalThis.window as any).__sb = {
    searchByName,
    searchSystembolagetProducts,
    model,
  };
  console.log("Systembolaget API available in debug console! :))");
}
