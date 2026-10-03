import { beforeEach, expect, test } from "bun:test";
import { join } from "path";
import { openDb } from "./db";
import { putBoard } from "./boards";
import { createCatalog } from "./catalog";
import { createPlay } from "./play";

const FIXTURE = join(import.meta.dir, "fixtures", "products.json");
const T = (id: string) => ({ id, label: id, family: "f" });
// Rows: Spain, France, Sweden. Cols: red, white, rosé. Cell 1 = Spain × red.
const BOARD = {
  rows: [T("Country:Spanien"), T("Country:Frankrike"), T("Country:Sverige")],
  cols: [T("Beverage:Rött vin"), T("Beverage:Vitt vin"), T("Beverage:Rosévin")],
  counts: [[200, 50, 10], [100, 80, 5], [20, 30, 5]],
};

let db: ReturnType<typeof openDb>;
let clock: Date;
let play: ReturnType<typeof createPlay>;
let ids = 0;
const guess = (player: string, day: string, cell: number, productNumber: string, practice = false) =>
  play.recordGuess(player, { id: `g${++ids}`, day, cell, productNumber, practice });

beforeEach(() => {
  db = openDb(":memory:");
  clock = new Date("2026-10-02T12:00:00Z"); // game day 2026-10-02
  putBoard(db, "2026-10-01", BOARD);
  putBoard(db, "2026-10-02", BOARD);
  play = createPlay({ db, catalog: createCatalog({ path: FIXTURE }), now: () => clock, cacheMs: 0 });
});

test("verdicts: correct, near, miss and rejections", async () => {
  expect((await guess("d:a", "2026-10-02", 1, "1001")).verdict).toBe("correct");
  const near = await guess("d:a", "2026-10-02", 2, "1005"); // Spain, but red not white
  expect(near).toEqual({ verdict: "near", matchedTagId: "Country:Spanien" });
  expect((await guess("d:a", "2026-10-02", 5, "1005")).verdict).toBe("miss"); // France × white
  expect(await guess("d:a", "2026-10-02", 4, "1002")).toEqual({ verdict: "rejected", reason: "not_playable" });
  expect(await guess("d:a", "2026-10-02", 2, "1001")).toEqual({ verdict: "rejected", reason: "already_used", usedInCell: 1 });
});

test("a replayed guess is never counted twice (review focus 1)", async () => {
  await play.recordGuess("d:a", { id: "x1", day: "2026-10-02", cell: 5, productNumber: "1001", practice: false });
  await play.recordGuess("d:a", { id: "x1", day: "2026-10-02", cell: 5, productNumber: "1001", practice: false });
  expect(play.playerBoard("2026-10-02", ["d:a"]).cells[4].misses).toBe(1);
  await play.recordGuess("d:a", { id: "x2", day: "2026-10-02", cell: 1, productNumber: "1001", practice: false });
  expect((await play.recordGuess("d:a", { id: "x3", day: "2026-10-02", cell: 1, productNumber: "1001", practice: false })).verdict).toBe("correct");
});

test("a guess for a day that has ended is refused (review focus 2)", async () => {
  await expect(guess("d:a", "2026-10-01", 1, "1001")).rejects.toMatchObject({ status: 400, code: "day_over" });
  expect(play.playerBoard("2026-10-01", ["d:a"]).solved).toBe(0);
});

test("a guess whose catalogue lookup straddles the 04:00 rollover is refused, not written (fix round 1)", async () => {
  const real = createCatalog({ path: FIXTURE });
  let resolveLookup: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    resolveLookup = resolve;
  });
  const slowCatalog = {
    reload: real.reload,
    getKnown: real.getKnown,
    get size() {
      return real.size;
    },
    get: async (productNumber: string) => {
      await pending;
      return real.get(productNumber);
    },
  };
  clock = new Date("2026-10-03T01:59:00Z"); // 03:59 Stockholm: still game day 2026-10-02
  play = createPlay({ db, catalog: slowCatalog as any, now: () => clock, cacheMs: 0 });

  const pendingGuess = guess("d:a", "2026-10-02", 1, "1001");
  clock = new Date("2026-10-03T02:01:00Z"); // 04:01 Stockholm: game day has turned to 2026-10-03
  resolveLookup();

  await expect(pendingGuess).rejects.toMatchObject({ status: 400, code: "day_over" });
  expect(play.playerBoard("2026-10-02", ["d:a"]).solved).toBe(0);
});

test("scores: the first solver scores high; a crowd on one bottle lowers it", async () => {
  await guess("d:a", "2026-10-02", 1, "1001");
  expect(play.playerBoard("2026-10-02", ["d:a"]).cells[0].score).toBe(75);
  expect(play.playerBoard("2026-10-02", ["d:a"]).cells[0].unicorn).toBe(true);
  await guess("d:b", "2026-10-02", 1, "1001");
  await guess("d:c", "2026-10-02", 1, "1001");
  await guess("d:d", "2026-10-02", 1, "1005");
  const a = play.playerBoard("2026-10-02", ["d:a"]).cells[0];
  const d = play.playerBoard("2026-10-02", ["d:d"]).cells[0];
  expect(a.score!).toBeLessThan(d.score!);
  expect(a.unicorn).toBe(false);
  expect(d.unicorn).toBe(true);
});

test("history from earlier boards with the same pair counts at half weight", async () => {
  clock = new Date("2026-10-01T12:00:00Z");
  for (const p of ["d:h1", "d:h2", "d:h3", "d:h4"]) await guess(p, "2026-10-01", 1, "1001");
  clock = new Date("2026-10-02T12:00:00Z");
  await guess("d:a", "2026-10-02", 1, "1001");
  const cell = play.playerBoard("2026-10-02", ["d:a"]).cells[0];
  expect(cell.unicorn).toBe(false);
  expect(cell.score!).toBeLessThan(60);
});

test("a past day's score doesn't change after practice play on it", async () => {
  clock = new Date("2026-10-01T12:00:00Z");
  await guess("d:a", "2026-10-01", 1, "1001");
  const before = play.playerBoard("2026-10-01", ["d:a"]).cells[0].score;
  clock = new Date("2026-10-02T12:00:00Z");
  await guess("d:z", "2026-10-01", 1, "1001", true);
  expect(play.playerBoard("2026-10-01", ["d:a"]).cells[0].score).toBe(before);
  expect(play.playerBoard("2026-10-01", ["d:z"], true).cells[0].productNumber).toBe("1001");
});

test("board totals, finished and perfect", async () => {
  // Fill all nine cells with a matching fixture product where one exists; cells
  // without a fixture match stay unsolved, so finished is false.
  await guess("d:a", "2026-10-02", 1, "1001");
  await guess("d:a", "2026-10-02", 2, "1004");
  await guess("d:a", "2026-10-02", 5, "1003");
  const board = play.playerBoard("2026-10-02", ["d:a"]);
  expect(board.solved).toBe(3);
  expect(board.finished).toBe(false);
  expect(board.score).toBe(board.cells.reduce((sum, c) => sum + (c.score ?? 0), 0));
});

test("answers: top picks, the rarest and your own", async () => {
  await guess("d:a", "2026-10-02", 1, "1001");
  await guess("d:b", "2026-10-02", 1, "1001");
  await guess("d:c", "2026-10-02", 1, "1005");
  const cell1 = play.answers("2026-10-02", ["d:c"])[0];
  expect(cell1.top[0]).toMatchObject({ productNumber: "1001", share: 2 / 3 });
  expect(cell1.rarest!.productNumber).toBe("1005");
  expect(cell1.mine).toBe("1005");
  expect(cell1.solvedShare).toBe(1);
  expect(play.answers("2026-10-02", ["d:nobody"])[4]).toMatchObject({ top: [], rarest: null, mine: null });
});

test("claim moves today's device rows onto the account, cell by cell", async () => {
  await guess("d:dev", "2026-10-02", 1, "1001");
  await guess("d:dev", "2026-10-02", 2, "1004");
  await guess("u:anna", "2026-10-02", 2, "1004");
  play.claim("anna", "dev");
  const board = play.playerBoard("2026-10-02", ["u:anna"]);
  expect(board.cells[0].productNumber).toBe("1001");
  expect(board.cells[1].productNumber).toBe("1004");
  expect(play.playerBoard("2026-10-02", ["d:dev"]).cells[1].productNumber).toBe("1004"); // left behind, not duplicated
});

// A catalog whose lookup for "9001" (not in the mirror) takes 30ms, so a
// concurrent request can land in the middle of it — used to reproduce races
// across the `await catalog.get(...)` in recordGuess.
const slowCatalog = () =>
  createCatalog({
    path: FIXTURE,
    lookup: async (n: string) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return n === "9001" ? { productNumber: "9001", assortmentText: "Fast sortiment", country: "Spanien", categoryLevel2: "Rött vin" } : null;
    },
  });

test("a retry while the original guess is still in flight is not counted twice (race 1)", async () => {
  const racing = createPlay({ db, catalog: slowCatalog(), now: () => clock, cacheMs: 0 });
  // Cell 5 is France × white; "9001" is Spain × red, a flat miss there.
  // Two concurrent calls share the same id, as a client retry would.
  await Promise.all([
    racing.recordGuess("d:a", { id: "race1", day: "2026-10-02", cell: 5, productNumber: "9001", practice: false }),
    racing.recordGuess("d:a", { id: "race1", day: "2026-10-02", cell: 5, productNumber: "9001", practice: false }),
  ]);
  expect(racing.playerBoard("2026-10-02", ["d:a"]).cells[4].misses).toBe(1);
});

test("a solved cell can't be overwritten by a slower guess racing a faster one (race 2)", async () => {
  const racing = createPlay({ db, catalog: slowCatalog(), now: () => clock, cacheMs: 0 });
  // Both "9001" (slow lookup) and "1001" (already in the mirror, fast) fully
  // match cell 1 (Spain × red). "1001" resolves first; "9001" must find the
  // cell already solved and not clobber it.
  const [slow, fast] = await Promise.all([
    racing.recordGuess("d:a", { id: "slow", day: "2026-10-02", cell: 1, productNumber: "9001", practice: false }),
    racing.recordGuess("d:a", { id: "fast", day: "2026-10-02", cell: 1, productNumber: "1001", practice: false }),
  ]);
  expect(fast.verdict).toBe("correct");
  expect(slow.verdict).not.toBe("correct");
  expect(racing.playerBoard("2026-10-02", ["d:a"]).cells[0].productNumber).toBe("1001");
});
