// Only bottles on the shelves count: the regular range, the local/craft range
// and seasonal releases. Order-only (Ordervaror), temporary (Tillfälligt) and
// web launches are left out of search, guesses, answer counts and rarity.
export const PLAYABLE_ASSORTMENTS = ["Fast sortiment", "Lokalt & Småskaligt", "Säsong"] as const;
const PLAYABLE = new Set(PLAYABLE_ASSORTMENTS.map((text) => text.toLowerCase()));

export function isPlayable(product: any): boolean {
  return PLAYABLE.has(String(product?.assortmentText ?? "").trim().toLowerCase());
}
