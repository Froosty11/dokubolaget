// Sends guesses to the server through the outbox and keeps the board in step
// with the server's record of it (which wins: it checks every pick).
import { reaction } from "mobx";
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
  syncNotice?: string | null;
};

export const DROPPED_NOTICE = "A few guesses from the last board couldn't be sent before 04:00.";
export const GUESS_LOST_NOTICE = "That guess couldn't be saved, so it wasn't counted. Check your connection and try again.";

// Worth sending again later: offline, rate limited, or the server (or the
// catalogue behind it) briefly unavailable. Anything else is final.
const RETRY = new Set([0, 429, 502, 503, 504]);

export function createPlaySync(deps: { api: PlayApi; outbox: Outbox; model: PlayModel; today: () => string }) {
  const { api, outbox, model } = deps;
  let flushing: Promise<void> | null = null;
  // Bumped whenever a daily guess is queued or answered, per cell, so a
  // refresh can tell which cells moved on while it waited for the server.
  let guessSeq = 0;
  const touched = new Map<number, number>();
  const touch = (cell: number) => touched.set(cell, ++guessSeq);

  async function send(item: OutboxItem) {
    try {
      const res = await api.guess(item);
      // The player may have moved on (another archive day, a new day) while
      // the guess was on its way; only the board it belongs to takes the answer.
      const mine = item.practice
        ? model.playMode === "archive" && model.practiceDay === item.day
        : model.playMode === "daily" && model.boardDate === item.day;
      if (!item.practice) touch(item.cell);
      if (mine) model.applyGuessResponse(item.cell, res);
      if (res.newUnlocks?.length) model.addUnlocks(res.newUnlocks, "board");
      return "done" as const;
    } catch (error) {
      if (error instanceof ApiRequestError && RETRY.has(error.status)) return "retry" as const;
      // A 400 such as day_over means the server deliberately rejected the guess
      // without changing anything, so drop it quietly. Any other final error —
      // a 401 from a lapsed session, a 403 from a misconfigured origin — means
      // the guess was lost unexpectedly; tell the player rather than eat it.
      const benign = error instanceof ApiRequestError && error.status === 400;
      if (!benign) model.syncNotice = GUESS_LOST_NOTICE;
      return "drop" as const;
    }
  }

  // Sends the queue in order. Guesses queued while a pass is running go out
  // in the same flush; a pass stopped by a retryable error waits for the next
  // trigger (a guess, a resume, coming back online or the periodic retry).
  function flush() {
    flushing ??= (async () => {
      for (;;) {
        if ((await outbox.dropEndedDays(deps.today())) > 0) model.syncNotice = DROPPED_NOTICE;
        const result = await flushOutbox(outbox, send);
        if (result === "stopped" || outbox.items().length === 0) break;
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  const dailyPending = (day: string) =>
    outbox.items().filter((i) => !i.practice && i.day === day).map((i) => i.cell);

  async function refresh() {
    await flush();
    if (model.playMode !== "daily" || model.boardStatus !== "ready") return;
    const startDay = model.boardDate;
    const startSeq = guessSeq;
    const pendingAtStart = dailyPending(startDay);
    try {
      const board = await api.playToday();
      // The player may have moved on while the request was out.
      if (model.playMode !== "daily" || model.boardStatus !== "ready") return;
      if (board.day !== model.boardDate || board.day !== startDay) return;
      // Cells with a guess queued, or queued or answered since the request
      // went out, keep the device's state: the response may predate them.
      const pending = new Set([...pendingAtStart, ...dailyPending(board.day)]);
      for (const [cell, seq] of touched) if (seq > startSeq) pending.add(cell);
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
      if (!practice) touch(cell);
      outbox
        .add({ day, cell, productNumber, practice })
        .then(() => flush())
        .catch((error) => console.warn("Sending a guess failed:", error?.message ?? error));
    };
    // A new board, a new day or back from the archive: catch up with the server.
    reaction(
      () => [model.boardStatus, model.boardDate, model.playMode],
      () => {
        refresh();
      },
    );
  }

  // After logging out, today's board belongs to the account: guesses for it
  // still waiting here are dropped (archive practice ones are kept).
  // Called before the session ends, so what can still be sent for the
  // account is sent first.
  async function forgetToday() {
    await flush().catch(() => {});
    const today = deps.today();
    for (const item of outbox.items().filter((i) => !i.practice && i.day === today)) await outbox.remove(item.id);
  }

  return { start, flush, refresh, forgetToday };
}
