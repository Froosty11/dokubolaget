// Sends guesses to the server through the outbox and keeps the board in step
// with the server's record of it (which wins: it checks every pick).
import { ApiRequestError } from "../api";
import type { BoardResult, GuessRequest, GuessResponse } from "./types";
import { flushOutbox, type Outbox, type OutboxItem } from "./outbox";

type PlayApi = { guess(g: GuessRequest): Promise<GuessResponse>; playToday(): Promise<BoardResult> };
type PlayModel = {
  boardDate: string;
  playMode: "daily" | "archive" | "test";
  practiceDay: string | null;
  boardStatus: "loading" | "ready" | "offline";
  guessListener: ((g: { cell: number; productNumber: string }) => void) | null;
  applyServerBoard(board: BoardResult, pendingCells: Set<number>): void;
  applyGuessResponse(cell: number, res: GuessResponse): void;
  addUnlocks(ids: any[], announce: boolean | "board" | "streak" | "scan"): unknown;
};

// Worth sending again later: offline, rate limited, or the server (or the
// catalogue behind it) briefly unavailable. Anything else is final.
const RETRY = new Set([0, 429, 502, 503, 504]);

export function createPlaySync(deps: { api: PlayApi; outbox: Outbox; model: PlayModel; today: () => string }) {
  const { api, outbox, model } = deps;
  let flushing: Promise<void> | null = null;

  async function send(item: OutboxItem) {
    try {
      const res = await api.guess(item);
      // The player may have moved on (another archive day, a new day) while
      // the guess was on its way; only the board it belongs to takes the answer.
      const mine = item.practice
        ? model.playMode === "archive" && model.practiceDay === item.day
        : model.playMode === "daily" && model.boardDate === item.day;
      if (mine) model.applyGuessResponse(item.cell, res);
      if (res.newUnlocks?.length) model.addUnlocks(res.newUnlocks, "board");
      return "done" as const;
    } catch (error) {
      if (error instanceof ApiRequestError && RETRY.has(error.status)) return "retry" as const;
      // A 400 such as day_over: the server changed nothing, so drop it.
      return "drop" as const;
    }
  }

  function flush() {
    flushing ??= (async () => {
      await outbox.dropEndedDays(deps.today());
      await flushOutbox(outbox, send);
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  async function refresh() {
    await flush();
    if (model.playMode !== "daily" || model.boardStatus !== "ready") return;
    try {
      const board = await api.playToday();
      if (board.day !== model.boardDate) return;
      const pending = new Set(outbox.items().filter((i) => !i.practice && i.day === board.day).map((i) => i.cell));
      model.applyServerBoard(board, pending);
    } catch {
      // Offline: the device's own record stands until the next refresh.
    }
  }

  async function start() {
    await outbox.load();
    model.guessListener = ({ cell, productNumber }) => {
      // Test boards and the bundled offline board don't score.
      if (model.playMode === "test") return;
      if (model.playMode === "daily" && model.boardStatus !== "ready") return;
      const practice = model.playMode === "archive";
      const day = practice ? model.practiceDay : model.boardDate;
      if (!day) return;
      outbox
        .add({ day, cell, productNumber, practice })
        .then(() => flush())
        .catch((error) => console.warn("Sending a guess failed:", error?.message ?? error));
    };
  }

  return { start, flush, refresh };
}
