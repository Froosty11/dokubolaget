import { describe, expect, test } from "bun:test";
import { boardKey, restoreProgress, serializeProgress } from "./progress";

const board = { topCategories: [{ id: "a" }, { id: "b" }, { id: "c" }], sideCategories: [{ id: "x" }, { id: "y" }, { id: "z" }] };
const state = {
  selectedProductsByCell: { 1: { id: "p1", name: "Wine" } },
  missesByCell: { 1: 2 },
  rejectedByCell: { 1: ["p0"] },
};

describe("progress", () => {
  test("round-trips today's progress for the same board", () => {
    const raw = serializeProgress("2026-10-01", boardKey(board), state);
    expect(restoreProgress(raw, "2026-10-01", boardKey(board))).toEqual(state);
  });
  test("ignores progress from another day", () => {
    const raw = serializeProgress("2026-09-30", boardKey(board), state);
    expect(restoreProgress(raw, "2026-10-01", boardKey(board))).toBeNull();
  });
  test("ignores progress from a different board the same day", () => {
    const raw = serializeProgress("2026-10-01", "other", state);
    expect(restoreProgress(raw, "2026-10-01", boardKey(board))).toBeNull();
  });
  test("ignores junk", () => {
    expect(restoreProgress("{nope", "2026-10-01", "k")).toBeNull();
    expect(restoreProgress(null, "2026-10-01", "k")).toBeNull();
    expect(restoreProgress(JSON.stringify({ date: "2026-10-01", board: "k", selectedProductsByCell: "x" }), "2026-10-01", "k")).toBeNull();
  });
  test("board key depends on every header", () => {
    expect(boardKey(board)).not.toBe(boardKey({ ...board, topCategories: [{ id: "a" }, { id: "b" }, { id: "q" }] }));
  });
});
