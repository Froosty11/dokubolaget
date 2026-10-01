// Small pure helpers for search and the board, kept free of React and
// Firebase so they can be unit tested.

// Records a wrongly guessed product for a cell. Returns the same map when
// nothing changes, so MobX doesn't see a pointless update.
export function addRejected(map: Record<number, string[]>, cell: number, productId: string) {
  if (!productId) return map;
  const current = map[cell] || [];
  if (current.includes(productId)) return map;
  return { ...map, [cell]: [...current, productId] };
}

// 1995 → "1 995", 89.9 → "89:90" (Systembolaget's price style).
export function formatKronor(price: number | undefined | null): string {
  if (price == null || !Number.isFinite(Number(price))) return "";
  const value = Number(price);
  const hasDecimals = value % 1 !== 0;
  const [integer, fraction] = value.toFixed(hasDecimals ? 2 : 0).split(".");
  const spaced = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return hasDecimals ? `${spaced}:${fraction}` : spaced;
}

export type GroupHeader = { kind: "header"; id: string; label: string };

const OTHER_TYPE = "Övrigt";

// Groups results by product type (categoryLevel2) with a header per group.
// Types sort alphabetically; results keep their relevance order within a group.
export function groupResultsByType<T extends { raw?: any }>(results: T[]): Array<T | GroupHeader> {
  const groups = new Map<string, T[]>();
  for (const result of results) {
    const type = String(result.raw?.categoryLevel2 || OTHER_TYPE);
    groups.set(type, [...(groups.get(type) || []), result]);
  }
  const types = [...groups.keys()].sort((a, b) =>
    a === OTHER_TYPE ? 1 : b === OTHER_TYPE ? -1 : a.localeCompare(b, "sv"),
  );
  return types.flatMap((type) => [{ kind: "header" as const, id: `h-${type}`, label: type }, ...groups.get(type)!]);
}

// "A1 7412 Marqués de Vargas" per solved cell, in board order. Columns are
// A–C left to right, rows 1–3 top to bottom.
export function receiptLines(selectedProductsByCell: Record<number, any>): string[] {
  return Object.keys(selectedProductsByCell)
    .map(Number)
    .sort((a, b) => a - b)
    .map((cell) => {
      const product = selectedProductsByCell[cell];
      const name = "ABC"[(cell - 1) % 3] + String(Math.floor((cell - 1) / 3) + 1);
      return [name, product?.raw?.productNumber, product?.name].filter(Boolean).join(" ");
    });
}

// The cell (other than `exceptCell`) already filled with this product, if any.
// One product may only be used once per board.
export function cellUsingProduct(
  selectedProductsByCell: Record<number, any>,
  productId: string,
  exceptCell: number,
): number | null {
  if (!productId) return null;
  for (const [cell, product] of Object.entries(selectedProductsByCell)) {
    const id = String(product?.id ?? product?.raw?.productId ?? "");
    if (Number(cell) !== exceptCell && id === productId) return Number(cell);
  }
  return null;
}

export type RowFieldKey = "type" | "country" | "volume" | "strength" | "price";
export type RowField = { key: RowFieldKey; text: string; hidden: boolean; length: number };

// Which info-sheet redaction key hides each search-row fact.
const ROW_FIELD_REDACTION: Record<RowFieldKey, string[]> = {
  type: ["style"],
  country: ["country", "region"],
  volume: ["volume"],
  strength: ["strength"],
  price: ["price"],
};

// The facts a search row shows, with the ones the cell asks about hidden.
// Hidden fields drop their text entirely (only its length is kept for the
// bar), so the answer can't be read from the page.
export function rowFields(raw: any, redact: ReadonlySet<string>): RowField[] {
  const values: Array<[RowFieldKey, string]> = [
    ["type", [raw?.categoryLevel2, raw?.categoryLevel3].filter(Boolean).join(" · ")],
    ["country", String(raw?.country ?? "")],
    ["volume", String(raw?.volumeText ?? "")],
    ["strength", raw?.alcoholPercentage != null ? `${raw.alcoholPercentage} %` : ""],
    ["price", formatKronor(raw?.price)],
  ];
  return values
    .filter(([, text]) => text)
    .map(([key, text]) => {
      const hidden = ROW_FIELD_REDACTION[key].some((redactionKey) => redact.has(redactionKey));
      return { key, text: hidden ? "" : text, hidden, length: text.length };
    });
}
