import { describe, expect, test } from "bun:test";
import { RANGE_BANDS, doesProductMatchTagId } from "./boardTags";

describe("range categories include their upper bound", () => {
  test.each([
    ["alcohol:strong", { alcoholPercentage: 13 }],
    ["alcohol:veryStrong", { alcoholPercentage: 13 }],
    ["alcohol:medium", { alcoholPercentage: 10 }],
    ["price:fancy", { price: 700 }],
    ["price:mid", { price: 200 }],
    ["volume:party", { volume: 750 }],
    ["volume:large", { volume: 750 }],
    ["volume:standard", { volume: 500 }],
  ])("%s accepts %o", (tagId, product) => {
    expect(doesProductMatchTagId(product, tagId)).toBe(true);
  });

  test("open-ended bands keep their strict edge", () => {
    expect(doesProductMatchTagId({ price: 100 }, "price:budget")).toBe(false);
    expect(doesProductMatchTagId({ alcoholPercentage: 5 }, "alcohol:light")).toBe(false);
  });

  test("the generator uses the same bands as the game", () => {
    expect(RANGE_BANDS.alcohol.strong(13)).toBe(true);
    expect(RANGE_BANDS.volume.party(750)).toBe(true);
    expect(RANGE_BANDS.price.fancy(701)).toBe(false);
  });
});
