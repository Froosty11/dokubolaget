import { describe, expect, test } from "bun:test";
import { addRejected, formatKronor, groupResultsByType } from "./searchHelpers";

describe("addRejected", () => {
  test("adds a product id to its cell once", () => {
    const once = addRejected({}, 2, "p1");
    expect(once).toEqual({ 2: ["p1"] });
    expect(addRejected(once, 2, "p1")).toBe(once);
    expect(addRejected(once, 2, "p2")).toEqual({ 2: ["p1", "p2"] });
  });
  test("ignores empty ids", () => {
    const map = { 1: ["x"] };
    expect(addRejected(map, 1, "")).toBe(map);
  });
});

describe("formatKronor", () => {
  test("groups thousands with spaces and keeps öre", () => {
    expect(formatKronor(1995)).toBe("1 995");
    expect(formatKronor(89.9)).toBe("89:90");
  });
  test("tolerates missing prices", () => expect(formatKronor(undefined)).toBe(""));
});

describe("groupResultsByType", () => {
  const r = (id: string, type?: string) => ({ id, raw: { categoryLevel2: type } });
  test("sorts by type and inserts one header per group, keeping order within a group", () => {
    const grouped = groupResultsByType([r("a", "Vitt vin"), r("b", "Rött vin"), r("c", "Vitt vin"), r("d")]);
    expect(grouped.map((x: any) => (x.kind === "header" ? `#${x.label}` : x.id))).toEqual([
      "#Rött vin", "b", "#Vitt vin", "a", "c", "#Övrigt", "d",
    ]);
  });
});

import { receiptLines } from "./searchHelpers";

describe("receiptLines", () => {
  test("one line per solved cell in board order, named A1..C3", () => {
    const p = (n: string, name: string) => ({ name, raw: { productNumber: n } });
    expect(receiptLines({ 5: p("7719", "Chablis"), 1: p("7412", "Marqués de Vargas") })).toEqual([
      "A1 7412 Marqués de Vargas",
      "B2 7719 Chablis",
    ]);
  });
});
