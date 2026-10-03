import { expect, test } from "bun:test";
import { cellScore, isUnicorn, pairKey, pickShare, rarityEmoji, streaks } from "./scoring";

test("pair keys ignore order", () => {
  expect(pairKey("Country:Spanien", "Beverage:Rött vin")).toBe(pairKey("Beverage:Rött vin", "Country:Spanien"));
});

test("the first solver of a new pair gets a sensible score, not zero", () => {
  const share = pickShare({ today: 1, todayTotal: 1, history: 0, historyTotal: 0, answers: 200 });
  expect(cellScore(share, 0)).toBe(75);
});

test("popular bottles score lower; history counts half", () => {
  const popular = pickShare({ today: 5, todayTotal: 10, history: 0, historyTotal: 0, answers: 100 });
  expect(cellScore(popular, 0)).toBe(61);
  const known = pickShare({ today: 1, todayTotal: 1, history: 20, historyTotal: 20, answers: 100 });
  expect(cellScore(known, 0)).toBeLessThan(15);
});

test("misses cost 5 each, at most 20, and a solved cell keeps at least 10", () => {
  expect(cellScore(0.25, 1)).toBe(70);
  expect(cellScore(0.25, 10)).toBe(55);
  expect(cellScore(0.95, 4)).toBe(10);
});

test("a unicorn is a bottle nobody else ever picked for that pair", () => {
  expect(isUnicorn({ today: 1, todayTotal: 9, history: 0, historyTotal: 40, answers: 50 })).toBe(true);
  expect(isUnicorn({ today: 1, todayTotal: 9, history: 1, historyTotal: 40, answers: 50 })).toBe(false);
  expect(isUnicorn({ today: 2, todayTotal: 9, history: 0, historyTotal: 40, answers: 50 })).toBe(false);
});

test("share squares", () => {
  expect(rarityEmoji({ solved: false, score: null })).toBe("⬛");
  expect(rarityEmoji({ solved: true, score: 91, unicorn: true })).toBe("🦄");
  expect(rarityEmoji({ solved: true, score: 80 })).toBe("🟪");
  expect(rarityEmoji({ solved: true, score: 50 })).toBe("🟩");
  expect(rarityEmoji({ solved: true, score: 49 })).toBe("🟨");
  expect(rarityEmoji({ solved: true, score: null })).toBe("🟩");
});

test("streaks: consecutive finished days, alive until today ends", () => {
  expect(streaks([], "2026-10-02")).toEqual({ current: 0, longest: 0 });
  expect(streaks(["2026-09-29", "2026-09-30", "2026-10-01"], "2026-10-02")).toEqual({ current: 3, longest: 3 });
  expect(streaks(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"], "2026-10-02")).toEqual({ current: 4, longest: 4 });
  expect(streaks(["2026-09-20", "2026-09-21", "2026-09-30"], "2026-10-02")).toEqual({ current: 0, longest: 2 });
  expect(streaks(["2026-10-01", "2026-10-01"], "2026-10-02")).toEqual({ current: 1, longest: 1 });
});
