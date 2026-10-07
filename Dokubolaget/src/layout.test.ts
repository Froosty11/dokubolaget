import { expect, test } from "bun:test";
import { isWideLayout, WIDE_MIN_WIDTH } from "./layout";

test("a wide browser window gets the desktop layout", () => {
  expect(isWideLayout("web", WIDE_MIN_WIDTH)).toBe(true);
  expect(isWideLayout("web", 1440)).toBe(true);
});

test("a narrow browser window keeps the phone layout", () => {
  expect(isWideLayout("web", WIDE_MIN_WIDTH - 1)).toBe(false);
  expect(isWideLayout("web", 390)).toBe(false);
});

test("the native apps never get the desktop layout, however wide", () => {
  expect(isWideLayout("ios", 1366)).toBe(false);
  expect(isWideLayout("android", 1600)).toBe(false);
});
