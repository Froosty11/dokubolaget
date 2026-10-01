import type { DossierLook, ThemeColors } from "./types";

// WCAG 2.x contrast ratio between two opaque #rrggbb colours.
function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected #rrggbb, got ${hex}`);
  const n = parseInt(match[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}


// Text/background pairs that must meet WCAG AA (4.5:1) in every theme,
// built in or delivered by the server.
export const CONTRAST_PAIRS: Array<[keyof ThemeColors, keyof ThemeColors]> = [
  ["ink", "page"], ["ink", "surface"], ["ink", "cellFill"], ["inkStrong", "surface"],
  ["inkMuted", "page"], ["inkMuted", "surface"], ["inkFaint", "surface"], ["inkFaint", "surfaceAlt"],
  ["hint", "page"], ["hint", "surface"], ["accentInk", "accent"],
  ["correct", "correctBg"], ["nearMiss", "nearMissBg"], ["miss", "missBg"],
  ["dialogInk", "dialogSurface"], ["dialogButtonInk", "dialogButton"], ["ink", "headerLabelBg"],
];

function shortfall(label: string, fg: string, bg: string, min: number): string | null {
  const ratio = contrastRatio(fg, bg);
  return ratio >= min ? null : `${label}: ${ratio.toFixed(2)} < ${min}`;
}

// Every pair that falls short, as "ink on page: 3.21 < 4.5".
export function contrastProblems(colors: ThemeColors): string[] {
  return CONTRAST_PAIRS.map(([fg, bg]) => shortfall(`${fg} on ${bg}`, colors[fg], colors[bg], 4.5)).filter(
    (line): line is string => line !== null,
  );
}

// The info sheet: text at AA, stamps at 3:1 (large graphic text).
export function dossierContrastProblems(d: DossierLook): string[] {
  return [
    shortfall("dossier ink on paper", d.ink, d.paper, 4.5),
    shortfall("dossier label on paper", d.label, d.paper, 4.5),
    shortfall("dossier stampHidden on paper", d.stampHidden, d.paper, 3),
    shortfall("dossier stampRevealed on paper", d.stampRevealed, d.paper, 3),
  ].filter((line): line is string => line !== null);
}
