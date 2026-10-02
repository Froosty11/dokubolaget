import { expect, test } from "bun:test";
import { addDays, formatShortDay, gameDay, nextRollover, rolloverInstant, weekStart } from "./gameDay";

const at = (iso: string) => new Date(iso);

test("summer time: the day turns at 04:00 CEST (02:00 UTC)", () => {
  expect(gameDay(at("2026-10-02T01:59:59Z"))).toBe("2026-10-01");
  expect(gameDay(at("2026-10-02T02:00:00Z"))).toBe("2026-10-02");
});

test("winter time: the day turns at 04:00 CET (03:00 UTC)", () => {
  expect(gameDay(at("2026-12-01T02:59:59Z"))).toBe("2026-11-30");
  expect(gameDay(at("2026-12-01T03:00:00Z"))).toBe("2026-12-01");
});

test("the nights the clocks change", () => {
  // 25 Oct 2026: 03:00 CEST becomes 02:00 CET at 01:00 UTC; 04:00 CET is 03:00 UTC.
  expect(gameDay(at("2026-10-25T02:59:59Z"))).toBe("2026-10-24");
  expect(gameDay(at("2026-10-25T03:00:00Z"))).toBe("2026-10-25");
  // 28 Mar 2027: 02:00 CET becomes 03:00 CEST at 01:00 UTC; 04:00 CEST is 02:00 UTC.
  expect(gameDay(at("2027-03-28T01:59:59Z"))).toBe("2027-03-27");
  expect(gameDay(at("2027-03-28T02:00:00Z"))).toBe("2027-03-28");
});

test("rollover instants follow the local clock", () => {
  expect(rolloverInstant("2026-10-02").toISOString()).toBe("2026-10-03T02:00:00.000Z");
  expect(rolloverInstant("2026-10-24").toISOString()).toBe("2026-10-25T03:00:00.000Z");
  expect(rolloverInstant("2027-03-27").toISOString()).toBe("2027-03-28T02:00:00.000Z");
  expect(nextRollover(at("2026-10-02T12:00:00Z")).toISOString()).toBe("2026-10-03T02:00:00.000Z");
  expect(nextRollover(at("2026-10-02T01:00:00Z")).toISOString()).toBe("2026-10-02T02:00:00.000Z");
});

test("date helpers", () => {
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  expect(weekStart("2026-10-02")).toBe("2026-09-28"); // Friday → Monday
  expect(weekStart("2026-09-28")).toBe("2026-09-28");
  expect(weekStart("2026-10-04")).toBe("2026-09-28"); // Sunday
  expect(formatShortDay("2026-10-02")).toBe("2 Oct");
});
