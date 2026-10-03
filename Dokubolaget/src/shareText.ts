import { formatShortDay } from "./gameDay";
import { rarityEmoji } from "./scoring";

export type ShareInput = {
  day: string;
  score: number;
  misses: number;
  cells: Array<{ solved: boolean; score: number | null; unicorn?: boolean }>;
  url: string;
};

export function buildShareText({ day, score, misses, cells, url }: ShareInput): string {
  const missText = misses === 0 ? "no misses" : misses === 1 ? "1 miss" : `${misses} misses`;
  const rows = [0, 1, 2].map((row) => cells.slice(row * 3, row * 3 + 3).map(rarityEmoji).join(""));
  return [`Dokubolaget ${formatShortDay(day)} · ${score}/900 · ${missText}`, ...rows, url].join("\n");
}
