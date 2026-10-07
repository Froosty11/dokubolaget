import type { Lang } from "../theme/types";

export type Dict = Record<string, string>;
// A catalog holds the same keys in both languages (enforced by a completeness
// test). Per-area catalog files are merged into one table in ./index.
export type Catalog = Record<Lang, Dict>;

export type TParams = Record<string, string | number>;

// Looks up a key for a language, falling back to English and then the key
// itself, with {param} interpolation.
export function translate(table: Catalog, lang: Lang, key: string, params?: TParams): string {
  const raw = table[lang]?.[key] ?? table.en?.[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
