import { expect, test } from "bun:test";
import { reconcileBoard } from "./reconcile";

const cell = (n: number, over: Record<string, any> = {}) => ({ cell: n, productNumber: null, product: null, misses: 0, score: null, share: null, unicorn: false, ...over });
const board = (cells: any[]) => ({
  day: "2026-10-02", cells: Array.from({ length: 9 }, (_, i) => cells.find((c) => c.cell === i + 1) ?? cell(i + 1)),
  score: 0, solved: 0, misses: 0, unicorns: 0, finished: false, perfect: false,
});
const local = (productNumber: string) => ({ id: `p${productNumber}`, name: "Vin", raw: { productNumber } });

test("a server-solved cell without product details stays solved (review finding 2)", () => {
  const out = reconcileBoard(
    { products: { 1: local("1001") }, info: {}, misses: {} },
    board([cell(1, { productNumber: "1001", score: 70 }), cell(2, { productNumber: "2002", score: 40 })]),
    new Set(),
  );
  expect(out.reverted).toBe(false);
  expect(out.products[1]).toEqual(local("1001"));
  expect(out.products[2].raw.productNumber).toBe("2002");
  expect(out.info[2]).toEqual({ score: 40, share: null, unicorn: false });
  expect(out.added).toBe(true);
});

test("a cell the server doesn't have is reverted unless a guess for it is pending", () => {
  const current = { products: { 1: local("1001"), 2: local("1002") }, info: { 2: { score: 50, share: 0.3, unicorn: false } }, misses: {} };
  const out = reconcileBoard(current, board([]), new Set([2]));
  expect(Object.keys(out.products)).toEqual(["2"]);
  expect(out.info[2]).toEqual({ score: 50, share: 0.3, unicorn: false });
  expect(out.reverted).toBe(true);
});
