import { expect, test } from "bun:test";
import { buildStamps } from "./stamps";
import type { PackSummary } from "./theme/packSchema";

const summary = (id: string): PackSummary => ({
  id: id as PackSummary["id"], version: 1, name: id,
  club: { name: id, fullName: id, section: "s", campus: "c", venue: "v", pubNight: "p", website: "w" },
  swatch: ["#000000", "#111111", "#222222"], logoUrl: null,
});

test("collected stamps come first in server order, then the missing ones", () => {
  const stamps = buildStamps(
    [summary("club-a"), summary("club-b"), summary("club-c"), summary("club-d")],
    ["cyberwave", "club-c", "club-a"],
    "club-c",
    new Set(["club-a", "club-c"]),
  );
  expect(stamps.map((s) => [s.summary.id, s.collected, s.wearing])).toEqual([
    ["club-a", true, false], ["club-c", true, true], ["club-b", false, false], ["club-d", false, false],
  ]);
});

test("a collected theme that isn't downloaded yet can't be worn", () => {
  const [stamp] = buildStamps([summary("club-a")], ["club-a"], "prislista", new Set());
  expect([stamp.collected, stamp.available]).toEqual([true, false]);
});
