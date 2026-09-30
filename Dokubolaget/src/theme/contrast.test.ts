import { describe, expect, test } from "bun:test";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  test("black on white is 21", () => expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1));
  test("is symmetric", () => expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#767676"), 5));
  test("#767676 on white just passes AA", () => expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5));
  test("rejects non-hex input", () => expect(() => contrastRatio("red", "#ffffff")).toThrow());
});
