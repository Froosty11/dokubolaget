import { expect, test } from "bun:test";
import { buildShareText } from "./shareText";

test("score, misses, a rarity grid and the link", () => {
  const cells = [
    { solved: true, score: 85 }, { solved: true, score: 60 }, { solved: true, score: 92, unicorn: true },
    { solved: true, score: 55 }, { solved: true, score: 30 }, { solved: true, score: 81 },
    { solved: true, score: 90 }, { solved: true, score: 70 }, { solved: false, score: null },
  ];
  expect(buildShareText({ day: "2026-10-02", score: 563, misses: 2, cells, url: "https://dokubolaget.se" })).toBe(
    ["Dokubolaget 2 Oct · 563/900 · 2 misses", "🟪🟩🦄", "🟩🟨🟪", "🟪🟩⬛", "https://dokubolaget.se"].join("\n"),
  );
});

test("one miss is singular, none says no misses", () => {
  const cells = Array.from({ length: 9 }, () => ({ solved: true, score: 50 }));
  expect(buildShareText({ day: "2026-10-02", score: 450, misses: 1, cells, url: "x" }).split("\n")[0]).toContain("1 miss");
  expect(buildShareText({ day: "2026-10-02", score: 450, misses: 0, cells, url: "x" }).split("\n")[0]).toContain("no misses");
});
