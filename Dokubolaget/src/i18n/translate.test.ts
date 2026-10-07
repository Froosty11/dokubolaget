import { expect, test } from "bun:test";
import { translate } from "./translate";

const table = {
  en: { hi: "Hi", greet: "Hi {name}", onlyEn: "English" },
  sv: { hi: "Hej", greet: "Hej {name}" },
};

test("returns the string for the chosen language", () => {
  expect(translate(table, "sv", "hi")).toBe("Hej");
  expect(translate(table, "en", "hi")).toBe("Hi");
});

test("falls back to English when a key is missing, then to the key", () => {
  expect(translate(table, "sv", "onlyEn")).toBe("English");
  expect(translate(table, "sv", "missing")).toBe("missing");
});

test("interpolates {params}", () => {
  expect(translate(table, "sv", "greet", { name: "Bo" })).toBe("Hej Bo");
  expect(translate(table, "en", "greet", { name: 7 })).toBe("Hi 7");
});
