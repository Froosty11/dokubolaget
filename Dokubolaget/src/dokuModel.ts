import type { PackSummary } from "./theme/packSchema";
import {
  searchByName,
  searchSystembolagetProducts,
} from "../src/systembolagetSource";
import { resolvePromise } from "./resolvePromise";
import generatedBoards from "../data/generated-boards.json";
import { doesProductMatchTagId } from "./boardTags";
import { formatTagLabel } from "./tagDisplay";
import { api, type Account } from "./api";
import { createThemeState } from "./theme/themeState";
import { THEMES } from "./theme/registry";
import { unlocksForBoard } from "./theme/unlocks";
import {
  addRejected,
  cellUsingProduct,
  onlyPlayable,
  productToResult,
  withImagesOnly,
  type SearchResult,
} from "./searchHelpers";
import { boardKey, type BoardProgress } from "./progress";
import { gameDay } from "./gameDay";
import { buildShareText as composeShareText } from "./shareText";
import type { BoardResult, GuessResponse } from "./play/types";
import { reconcileBoard, serverPick, type CellInfo } from "./play/reconcile";

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

// The game day (04:00 to 04:00 Stockholm). Kept under this name for the
// existing importers.
export function todayDateKey() {
  return gameDay();
}

// Fallback when the server has no board for the day (offline, new install
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

  const todayKey = gameDay();
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
// When set, the server's daily board is not loaded and nothing is sent.
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

export type { CellInfo };

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
  // "loading" until today's board is known; "offline" when the server and
  // the device's cache had nothing, so the bundled board is played as practice.
  boardStatus: "loading" as "loading" | "ready" | "offline",
  // "test" when ?board= picked a bundled board; "archive" while practising a
  // past day. Only the daily board scores.
  playMode: (boardOverrideIndex != null ? "test" : "daily") as "daily" | "archive" | "test",
  // The past day being practised in archive mode.
  practiceDay: null as string | null,
  // True for any board whose progress isn't the player's daily record (test,
  // archive or offline). Device progress isn't saved for it.
  get practiceBoard() {
    return this.playMode !== "daily" || this.boardStatus === "offline";
  },
  gameCells: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  selectedProductsByCell: {} as Record<number, any>,
  // The server's verdict per solved cell (score, share of players, unicorn).
  cellInfo: {} as Record<number, CellInfo>,
  // The server's last word on this board.
  serverBoard: null as BoardResult | null,
  // Set when a new day replaced an unfinished board; the board shows a toast.
  rolloverNotice: null as { score: number } | null,
  // A short message when the server overruled a pick.
  syncNotice: null as string | null,
  // Play sync (play/playSync.ts) listens here for every judged guess.
  guessListener: null as ((g: { cell: number; productNumber: string }) => void) | null,
  // Called by mobxReactiveModel with the device's cache of fetched boards.
  boardCache: null as null | {
    read(day: string): Promise<{ rows: any[]; cols: any[] } | null>;
    write(day: string, board: { rows: any[]; cols: any[] }): Promise<void>;
  },
  get boardScore() {
    return Object.values(this.cellInfo as Record<number, CellInfo>).reduce((sum, info) => sum + (info.score ?? 0), 0);
  },
  get boardMisses() {
    return Object.values(this.missesByCell as Record<number, number>).reduce((sum, n) => sum + Number(n || 0), 0);
  },
  get finished() {
    return this.filledCellCount === 9;
  },

  setBoard(board: { rows: any[]; cols: any[] }, status: "ready" | "offline") {
    const changed = boardKey({ topCategories: board.cols, sideCategories: board.rows }) !== boardKey(this);
    this.topCategories = board.cols;
    this.sideCategories = board.rows;
    if (changed) {
      this.clearProgress();
      this.cellInfo = {};
    }
    this.boardStatus = status;
    this.boardSettled = true;
  },

  // Loads today's board without swapping it later: the server's board, else
  // the one cached on the device, else the bundled pick played offline as
  // practice. Saved progress for it is restored by mobxReactiveModel.ts.
  async loadDailyBoard() {
    if (this.playMode === "test") {
      this.boardStatus = "ready";
      this.boardSettled = true;
      return;
    }
    const day = gameDay();
    this.boardDate = day;
    this.boardStatus = "loading";
    this.boardSettled = false;
    const board = await api.board(day).catch((error) => {
      console.warn("[BOARD] board fetch failed:", error?.message ?? error);
      return null;
    });
    if (day !== this.boardDate) return; // a rollover started meanwhile
    if (board) {
      this.boardCache?.write(day, board).catch(() => {});
      this.setBoard(board, "ready");
      return;
    }
    const cached = await this.boardCache?.read(day).catch(() => null);
    if (day !== this.boardDate) return;
    if (cached) {
      this.setBoard(cached, "ready");
      return;
    }
    // Offline with nothing cached: play the bundled board as practice.
    this.setBoard(pickLocalBoardForToday().board, "offline");
  },

  // True once today's board is final (the server's, the cached one, or the
  // bundled fallback when offline).
  boardSettled: false,

  // "Support Dokubolaget" page (Ko-fi), when the server has one configured.
  supportUrl: null as string | null,
  setSupportUrl(url: string | null) {
    this.supportUrl = url;
  },

  // "Want your club here?" address on the pub stamps screen.
  contactEmail: null as string | null,
  setContactEmail(email: string | null) {
    this.contactEmail = email;
  },

  // Every club theme the server lists (or the last saved list when offline).
  clubSummaries: [] as PackSummary[],
  setClubSummaries(summaries: PackSummary[]) {
    this.clubSummaries = summaries;
  },

  // The logged-in player, or null.
  account: null as Account | null,
  setAccount(account: Account | null) {
    this.account = account;
  },

  // The game day this board belongs to; the app rolls over when it changes.
  boardDate: gameDay(),

  // Set when progress was restored from storage, so the presenter doesn't
  // celebrate a board that was finished earlier. The presenter clears it.
  justRestored: false,

  applyProgress(progress: BoardProgress) {
    this.selectedProductsByCell = progress.selectedProductsByCell;
    this.missesByCell = progress.missesByCell;
    this.rejectedByCell = progress.rejectedByCell;
    this.justRestored = true;
  },

  clearProgress() {
    this.selectedProductsByCell = {};
    this.missesByCell = {};
    this.rejectedByCell = {};
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

  // Product ids guessed wrong per cell, so search can mark them as tried.
  rejectedByCell: {} as Record<number, string[]>,

  setCellResult(cell: any, result: any) {
    const asNumber = Number(cell);

    // One product per board. Not a miss: it says nothing about the categories.
    const usedIn = cellUsingProduct(
      this.selectedProductsByCell,
      String(result?.id ?? result?.raw?.productId ?? ""),
      asNumber,
    );
    if (usedIn != null) {
      const usedRow = this.sideCategories[Math.floor((usedIn - 1) / 3)];
      const usedCol = this.topCategories[(usedIn - 1) % 3];
      const reason = `Already used for ${formatTagLabel(usedRow)} × ${formatTagLabel(usedCol)}.`;
      this.lastFeedback = { kind: "miss", isCorrect: false, message: reason, cell: asNumber };
      return { isValid: false, kind: "used" as const, reason };
    }

    const validation = this.validateCellResult(cell, result);
    // Every judged guess (correct, near or miss) goes to the server too.
    const productNumber = String(result?.raw?.productNumber ?? "");

    if (!validation.isValid) {
      if (validation.kind === "near" || validation.kind === "miss") {
        this.missesByCell = {
          ...this.missesByCell,
          [asNumber]: (this.missesByCell[asNumber] || 0) + 1,
        };
        this.rejectedByCell = addRejected(
          this.rejectedByCell,
          asNumber,
          String(result?.id ?? result?.raw?.productId ?? ""),
        );
        if (productNumber) this.guessListener?.({ cell: asNumber, productNumber });
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
    if (productNumber) this.guessListener?.({ cell: asNumber, productNumber });

    return {
      isValid: true,
      kind: "correct" as const,
      reason: null,
    };
  },

  get filledCellCount() {
    return Object.keys(this.selectedProductsByCell).length;
  },

  // The server's record wins, except for cells with guesses still on their way.
  applyServerBoard(board: BoardResult, pendingCells: Set<number>) {
    const next = reconcileBoard(
      { products: this.selectedProductsByCell, info: this.cellInfo, misses: this.missesByCell },
      board,
      pendingCells,
    );
    // Cells filled from the account (another device) aren't celebrated here.
    if (next.added && Object.keys(next.products).length !== this.filledCellCount) this.justRestored = true;
    this.selectedProductsByCell = next.products;
    this.cellInfo = next.info;
    this.missesByCell = next.misses;
    this.serverBoard = board;
    if (next.reverted) this.syncNotice = "Couldn't verify a pick, so that cell is empty again. Try another bottle.";
  },

  applyGuessResponse(cell: number, res: GuessResponse) {
    if (res.verdict === "correct") {
      this.cellInfo = { ...this.cellInfo, [cell]: { score: res.cell.score, share: res.cell.share, unicorn: res.cell.unicorn } };
      // The server accepted a pick this device judged wrong: its verdict wins.
      if (!this.selectedProductsByCell[cell] && res.cell.productNumber) {
        this.selectedProductsByCell = { ...this.selectedProductsByCell, [cell]: serverPick(res.cell) };
      }
    } else if (
      this.selectedProductsByCell[cell] &&
      String(this.selectedProductsByCell[cell]?.raw?.productNumber ?? "") === String(res.cell?.productNumber ?? "__none")
    ) {
      // already solved with this product: keep it
    } else if (this.selectedProductsByCell[cell] && !res.cell?.productNumber) {
      const next = { ...this.selectedProductsByCell };
      delete next[cell];
      this.selectedProductsByCell = next;
      this.syncNotice =
        res.reason === "not_playable"
          ? "That bottle isn't on the regular shelves, so it doesn't count. Try another."
          : "Couldn't verify that pick. Try another bottle.";
    }
    this.serverBoard = res.board;
  },

  // Empties today's board on the device (after logging out, the board stays
  // with the account). In the archive, the daily board put aside is emptied.
  resetDailyBoard() {
    if (this.playMode === "archive" && this.dailySnapshot) {
      this.dailySnapshot = { ...this.dailySnapshot, products: {}, misses: {}, rejected: {}, info: {} };
      return;
    }
    this.clearProgress();
    this.cellInfo = {};
    this.serverBoard = null;
  },

  // Archive practice: the daily board is put aside and restored on exit.
  dailySnapshot: null as null | {
    top: any[];
    side: any[];
    products: Record<number, any>;
    misses: Record<number, number>;
    rejected: Record<number, string[]>;
    info: any;
  },
  enterArchive(day: string, board: { rows: any[]; cols: any[] }, practice: BoardResult) {
    if (this.playMode === "daily") {
      this.dailySnapshot = {
        top: this.topCategories,
        side: this.sideCategories,
        products: this.selectedProductsByCell,
        misses: this.missesByCell,
        rejected: this.rejectedByCell,
        info: this.cellInfo,
      };
    }
    this.playMode = "archive";
    this.practiceDay = day;
    this.topCategories = board.cols;
    this.sideCategories = board.rows;
    this.clearProgress();
    this.cellInfo = {};
    this.applyServerBoard(practice, new Set());
    this.justRestored = true;
  },
  exitArchive() {
    const snap = this.dailySnapshot;
    this.playMode = "daily";
    this.practiceDay = null;
    if (snap) {
      this.topCategories = snap.top;
      this.sideCategories = snap.side;
      this.selectedProductsByCell = snap.products;
      this.missesByCell = snap.misses;
      this.rejectedByCell = snap.rejected;
      this.cellInfo = snap.info;
      this.justRestored = true;
    }
    this.dailySnapshot = null;
  },

  // Share text for a finished (or partial) board, coloured by cell score.
  buildShareText() {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://dokubolaget.se";
    const cells = this.gameCells.map((cell) => ({
      solved: Boolean(this.selectedProductsByCell[cell]),
      score: this.cellInfo[cell]?.score ?? null,
      unicorn: this.cellInfo[cell]?.unicorn ?? false,
    }));
    return composeShareText({
      day: this.practiceDay ?? this.boardDate,
      score: this.boardScore,
      misses: this.boardMisses,
      cells,
      url: origin,
    });
  },

  clearLastFeedback() {
    this.lastFeedback = null;
  },

  // A new game day: note an unfinished board's score, then load the new board.
  generateGame() {
    if (this.playMode === "archive") this.exitArchive();
    if (this.boardStatus === "ready" && this.filledCellCount > 0 && !this.finished) {
      this.rolloverNotice = { score: this.boardScore };
    }
    this.selectedProductsByCell = {};
    this.missesByCell = {};
    this.rejectedByCell = {};
    this.cellInfo = {};
    this.serverBoard = null;
    this.loadDailyBoard();
  },

  /* ===== Search related props ===== */
  searchParams: {} as Record<string, any>,
  searchResultsPromiseState: {},

  setSearchQuery(query: string) {
    this.searchParams.query = query;
  },

  normalizeSearchResults(rawResponse: any): SearchResult[] {
    const products = Array.isArray(rawResponse?.products)
      ? rawResponse.products
      : [];

    return products
      .filter(function isProductACB(product: any) {
        return Boolean(product?.productNumber || product?.productNameBold);
      })
      .map((product: any, index: number) => productToResult(product, index));
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

    const searchPromise = searchByName(query, { pageSize: 30 })
      .then(this.normalizeSearchResults)
      .then((results: SearchResult[]) => onlyPlayable(results))
      .then(withImagesOnly);

    resolvePromise(searchPromise, this.searchResultsPromiseState);
  },

  // Called once when a real (non-practice) board reaches 9/9. Returns the
  // themes it newly unlocked. Logged-out players earn them on the device; for
  // accounts the server grants the same ones (addUnlocks ignores duplicates).
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
