import { expect, test } from "bun:test";
import { observable } from "mobx";
import { createOutbox } from "./outbox";
import { createPlaySync } from "./playSync";
import { ApiRequestError } from "../api";

function memory() {
  const data = new Map<string, string>();
  return { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
}
const emptyBoard = (day: string) => ({
  day, cells: Array.from({ length: 9 }, (_, i) => ({ cell: i + 1, productNumber: null, product: null, misses: 0, score: null, share: null, unicorn: false })),
  score: 0, solved: 0, misses: 0, unicorns: 0, finished: false, perfect: false,
});

function fakeModel() {
  return observable({
    boardDate: "2026-10-02", playMode: "daily" as const, practiceDay: null as string | null, boardStatus: "ready" as const,
    guessListener: null as any, applied: [] as any[], responses: [] as any[], unlocks: [] as string[],
    applyServerBoard(board: any, pending: Set<number>) { this.applied.push({ board, pending: [...pending] }); },
    applyGuessResponse(cell: number, res: any) { this.responses.push({ cell, res }); },
    addUnlocks(ids: string[]) { this.unlocks.push(...ids); return ids; },
  });
}

test("a guess goes to the outbox and is sent; the response reaches the model", async () => {
  const model = fakeModel();
  const outbox = createOutbox(memory());
  const sent: any[] = [];
  const api = {
    guess: async (g: any) => (sent.push(g), { verdict: "correct", cell: { cell: g.cell }, board: emptyBoard("2026-10-02"), newUnlocks: ["cyberwave"] }),
    playToday: async () => emptyBoard("2026-10-02"),
  };
  const sync = createPlaySync({ api: api as any, outbox, model: model as any, today: () => "2026-10-02" });
  await sync.start();
  model.guessListener!({ cell: 1, productNumber: "1001" });
  await sync.flush();
  expect(sent.map((g) => [g.day, g.cell, g.productNumber, g.practice])).toEqual([["2026-10-02", 1, "1001", false]]);
  expect(model.responses[0].cell).toBe(1);
  expect(model.unlocks).toEqual(["cyberwave"]);
  expect(outbox.items()).toEqual([]);
});

test("offline: the guess stays queued; a 400 drops it (review focus 1 and 2)", async () => {
  const model = fakeModel();
  const outbox = createOutbox(memory());
  let mode: "offline" | "day_over" = "offline";
  const api = {
    guess: async () => { throw new ApiRequestError(mode === "offline" ? 0 : 400, mode === "offline" ? undefined : "day_over"); },
    playToday: async () => emptyBoard("2026-10-02"),
  };
  const sync = createPlaySync({ api: api as any, outbox, model: model as any, today: () => "2026-10-02" });
  await sync.start();
  model.guessListener!({ cell: 1, productNumber: "1001" });
  await sync.flush();
  expect(outbox.items()).toHaveLength(1);
  mode = "day_over";
  await sync.flush();
  expect(outbox.items()).toHaveLength(0);
});

test("refresh reconciles with the server, telling the model which cells are still pending", async () => {
  const model = fakeModel();
  const outbox = createOutbox(memory());
  const api = {
    guess: async () => { throw new ApiRequestError(503, "catalog_unavailable"); },
    playToday: async () => emptyBoard("2026-10-02"),
  };
  const sync = createPlaySync({ api: api as any, outbox, model: model as any, today: () => "2026-10-02" });
  await sync.start();
  model.guessListener!({ cell: 4, productNumber: "1001" });
  await sync.refresh();
  expect(model.applied.at(-1).pending).toEqual([4]);
});

test("archive practice guesses carry the past day and practice flag", async () => {
  const model = fakeModel();
  model.playMode = "archive" as any;
  model.practiceDay = "2026-09-20";
  const outbox = createOutbox(memory());
  const sent: any[] = [];
  const api = { guess: async (g: any) => (sent.push(g), { verdict: "miss", cell: {}, board: emptyBoard("2026-09-20"), newUnlocks: [] }), playToday: async () => emptyBoard("2026-10-02") };
  const sync = createPlaySync({ api: api as any, outbox, model: model as any, today: () => "2026-10-02" });
  await sync.start();
  model.guessListener!({ cell: 2, productNumber: "1001" });
  await sync.flush();
  expect(sent[0]).toMatchObject({ day: "2026-09-20", practice: true });
});
