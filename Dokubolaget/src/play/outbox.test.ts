import { expect, test } from "bun:test";
import { createOutbox, flushOutbox } from "./outbox";

function memory() {
  const data = new Map<string, string>();
  return { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
}

test("items survive a restart, in order", async () => {
  const storage = memory();
  const a = createOutbox(storage);
  await a.load();
  await a.add({ day: "2026-10-02", cell: 1, productNumber: "1", practice: false });
  await a.add({ day: "2026-10-02", cell: 2, productNumber: "2", practice: false });
  const b = createOutbox(storage);
  await b.load();
  expect(b.items().map((i) => i.cell)).toEqual([1, 2]);
  expect(new Set(b.items().map((i) => i.id)).size).toBe(2);
});

test("flush sends in order, stops on retry and drops rejected items", async () => {
  const outbox = createOutbox(memory());
  await outbox.load();
  for (const cell of [1, 2, 3]) await outbox.add({ day: "2026-10-02", cell, productNumber: String(cell), practice: false });
  const sent: number[] = [];
  const result = await flushOutbox(outbox, async (item) => {
    sent.push(item.cell);
    return item.cell === 1 ? "drop" : item.cell === 2 ? "retry" : "done";
  });
  expect(result).toBe("stopped");
  expect(sent).toEqual([1, 2]);
  expect(outbox.items().map((i) => i.cell)).toEqual([2, 3]);
});

test("guesses for a day that ended are dropped; practice ones stay (review focus 2)", async () => {
  const outbox = createOutbox(memory());
  await outbox.load();
  await outbox.add({ day: "2026-10-01", cell: 1, productNumber: "1", practice: false });
  await outbox.add({ day: "2026-09-20", cell: 1, productNumber: "1", practice: true });
  await outbox.add({ day: "2026-10-02", cell: 1, productNumber: "1", practice: false });
  expect(await outbox.dropEndedDays("2026-10-02")).toBe(1);
  expect(outbox.items().map((i) => i.day)).toEqual(["2026-09-20", "2026-10-02"]);
  expect(outbox.pendingFor("2026-10-02", 1, false)).toBe(true);
  expect(outbox.pendingFor("2026-10-02", 2, false)).toBe(false);
});

test("a corrupt store starts empty", async () => {
  const storage = memory();
  await storage.setItem("dokubolaget.outbox", "{not json");
  const outbox = createOutbox(storage);
  await outbox.load();
  expect(outbox.items()).toEqual([]);
});
