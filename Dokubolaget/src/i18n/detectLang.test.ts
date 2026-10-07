import { expect, test } from "bun:test";
import { detectLang } from "./detectLang";

test("Swedish locales resolve to sv", () => {
  expect(detectLang("sv")).toBe("sv");
  expect(detectLang("sv-SE")).toBe("sv");
  expect(detectLang("SV")).toBe("sv");
});

test("anything else defaults to English", () => {
  expect(detectLang("en-US")).toBe("en");
  expect(detectLang("de-DE")).toBe("en");
  expect(detectLang("")).toBe("en");
  expect(detectLang(undefined)).toBe("en");
});
