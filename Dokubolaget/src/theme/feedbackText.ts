import type { ThemeCopy } from "./types";

// The model says what happened; the theme decides how it's announced.
export function composeFeedbackText(
  feedback: { kind: "correct" | "near" | "miss"; message: string },
  copy: ThemeCopy,
  random: () => number = Math.random,
): string {
  if (feedback.kind === "correct") {
    const titles = copy.correctTitles;
    return titles[Math.min(titles.length - 1, Math.floor(random() * titles.length))];
  }
  if (feedback.kind === "near") return `${copy.nearMissTitle} ${feedback.message}`;
  return feedback.message;
}
