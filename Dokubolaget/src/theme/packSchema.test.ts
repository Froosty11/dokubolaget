import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { validatePack } from "./packSchema";

const fixture = () => JSON.parse(readFileSync(new URL("../../server/fixtures/club-themes/sample/theme.json", import.meta.url), "utf8"));

function errorsFor(mutate: (pack: any) => void): string[] {
  const pack = fixture();
  mutate(pack);
  const result = validatePack(pack);
  return result.ok ? [] : result.errors;
}

describe("validatePack", () => {
  test("accepts the sample club theme", () => {
    const result = validatePack(fixture());
    expect(result.ok).toBe(true);
  });

  test.each([
    ["id", (p: any) => (p.id = "Club-X")],
    ["id", (p: any) => (p.id = "club-")],
    ["version", (p: any) => (p.version = 0)],
    ["version", (p: any) => (p.version = 1.5)],
    ["colors.ink", (p: any) => delete p.colors.ink],
    ["colors.accent", (p: any) => (p.colors.accent = "green")],
    ["fontKit", (p: any) => (p.fontKit = "comic")],
    ["decoration.kind", (p: any) => (p.decoration.kind = "lava")],
    ["haptics", (p: any) => (p.haptics = "x")],
    ["copy.sv.name", (p: any) => (p.copy.sv.name = " ")],
    ["copy.en.correctTitles", (p: any) => (p.copy.en.correctTitles = [])],
    ["club.venue", (p: any) => delete p.club.venue],
    ["dossier.borderStyle", (p: any) => (p.dossier.borderStyle = "wavy")],
    ["logo", (p: any) => (p.logo = { width: 0, height: 10 })],
  ])("rejects a bad %s", (field, mutate) => {
    const errors = errorsFor(mutate);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain(field);
  });

  test("rejects text that fails contrast, naming the pair", () => {
    const errors = errorsFor((p) => (p.colors.ink = p.colors.page));
    expect(errors.join("\n")).toContain("ink on page");
  });

  test("asks for hex where text sits on the colour, instead of crashing", () => {
    const errors = errorsFor((p) => (p.colors.page = "rgba(0, 0, 0, 0.5)"));
    expect(errors.join("\n")).toContain("colors.page");
  });

  test("collects every error, not just the first", () => {
    const errors = errorsFor((p) => {
      p.fontKit = "comic";
      p.haptics = "x";
    });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  test("accepts a theme without a logo", () => {
    const pack = fixture();
    pack.logo = null;
    expect(validatePack(pack).ok).toBe(true);
  });

  test("drops unknown keys instead of rejecting them", () => {
    const pack = fixture();
    pack.extra = "ignored";
    const result = validatePack(pack);
    expect(result.ok).toBe(true);
    if (result.ok) expect("extra" in result.pack).toBe(false);
  });

  test("rejects things that aren't objects", () => {
    expect(validatePack(null).ok).toBe(false);
    expect(validatePack("club-x").ok).toBe(false);
  });
});
