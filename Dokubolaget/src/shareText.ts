import { formatShortDay } from "./gameDay";
import { rarityEmoji } from "./scoring";
import { translations } from "./i18n";
import { translate } from "./i18n/translate";
import type { Lang } from "./theme/types";

export type ShareInput = {
  day: string;
  score: number;
  misses: number;
  cells: Array<{ solved: boolean; score: number | null; unicorn?: boolean }>;
  url: string;
};

export function buildShareText({ day, score, misses, cells, url }: ShareInput, lang: Lang = "en"): string {
  const missText =
    misses === 0
      ? translate(translations, lang, "boardComplete.shareNoMisses")
      : misses === 1
        ? translate(translations, lang, "boardComplete.shareOneMiss")
        : translate(translations, lang, "boardComplete.shareMisses", { misses });
  const rows = [0, 1, 2].map((row) => cells.slice(row * 3, row * 3 + 3).map(rarityEmoji).join(""));
  return [`Dokubolaget ${formatShortDay(day)} · ${score}/900 · ${missText}`, ...rows, url].join("\n");
}
