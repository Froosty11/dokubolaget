import { expect, test } from "bun:test";
import { unannounced } from "./announced";

test("first run remembers everything without announcing", () => {
  expect(unannounced(["cyberwave", "midsommar"], null)).toEqual({ announce: [], remember: ["cyberwave", "midsommar"] });
});

test("earned themes not yet announced are announced once", () => {
  expect(unannounced(["cyberwave", "modern"], ["cyberwave"])).toEqual({ announce: ["modern"], remember: ["cyberwave", "modern"] });
  expect(unannounced(["cyberwave", "club-tmeit"], ["cyberwave"])).toEqual({ announce: [], remember: ["cyberwave", "club-tmeit"] });
});
