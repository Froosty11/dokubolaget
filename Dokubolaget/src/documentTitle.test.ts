import { expect, test } from "bun:test";
import { documentTitleFor } from "./documentTitle";

const labels = { home: "Home", play: "Play", leaderboard: "Leaderboard", search: "Search" };

test("home is branded", () => {
  expect(documentTitleFor("/", labels)).toBe("Home · Dokubolaget");
  expect(documentTitleFor("", labels)).toBe("Home · Dokubolaget");
});

test("gameplay, leaderboard and search map to their labels", () => {
  expect(documentTitleFor("/gameplay", labels)).toBe("Play · Dokubolaget");
  expect(documentTitleFor("/leaderboard", labels)).toBe("Leaderboard · Dokubolaget");
  expect(documentTitleFor("/search", labels)).toBe("Search · Dokubolaget");
});

test("unknown routes fall back to the bare brand", () => {
  expect(documentTitleFor("/themes", labels)).toBe("Dokubolaget");
  expect(documentTitleFor("/stamps", labels)).toBe("Dokubolaget");
});
