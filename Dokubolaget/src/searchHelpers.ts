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
