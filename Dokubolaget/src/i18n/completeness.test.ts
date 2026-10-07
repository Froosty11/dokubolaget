import { expect, test } from "bun:test";
import { AREAS, translations } from "./index";

test("every key exists in both English and Swedish", () => {
  const en = Object.keys(translations.en).sort();
  const sv = Object.keys(translations.sv).sort();
  const missingSv = en.filter((k) => !(k in translations.sv));
  const missingEn = sv.filter((k) => !(k in translations.en));
  expect({ missingSv, missingEn }).toEqual({ missingSv: [], missingEn: [] });
});

test("no key is defined in more than one catalog", () => {
  for (const lang of ["en", "sv"] as const) {
    const counts = new Map<string, number>();
    for (const area of AREAS) {
      for (const key of Object.keys(area[lang])) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    expect(dupes).toEqual([]);
  }
});

test("no string is left untranslated (identical en/sv) unless intentionally shared", () => {
  // Brand/proper nouns that are the same in both languages are allowed here.
  const allowedIdentical = new Set(["lang.en", "lang.sv", "common.ok"]);
  const identical = Object.keys(translations.en).filter(
    (k) => !allowedIdentical.has(k) && translations.en[k] === translations.sv[k],
  );
  expect(identical).toEqual([]);
});
