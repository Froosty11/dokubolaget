import { expect, test } from "bun:test";
import { isPlayable } from "./playable";

test("the regular, local and seasonal ranges are playable", () => {
  expect(isPlayable({ assortmentText: "Fast sortiment" })).toBe(true);
  expect(isPlayable({ assortmentText: "Lokalt & Småskaligt" })).toBe(true);
  expect(isPlayable({ assortmentText: " lokalt & småskaligt " })).toBe(true);
  expect(isPlayable({ assortmentText: "Säsong" })).toBe(true);
});

test("order-only, temporary and web launches are not", () => {
  for (const text of ["Ordervaror", "Tillfälligt sortiment", "Webblanseringar", "", undefined]) {
    expect(isPlayable({ assortmentText: text })).toBe(false);
  }
  expect(isPlayable(null)).toBe(false);
});
