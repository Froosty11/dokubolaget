import type { PackSummary } from "./theme/packSchema";
import type { ThemeId } from "./theme/types";

export type Stamp = {
  summary: PackSummary;
  collected: boolean;
  wearing: boolean;
  // Collected and downloaded, so it can be worn right now.
  available: boolean;
};

// The pub stamps screen: collected clubs first, then the ones still to
// scan, each group in the server's order.
export function buildStamps(
  summaries: PackSummary[],
  unlocked: readonly ThemeId[],
  activeId: ThemeId,
  registeredIds: ReadonlySet<string>,
): Stamp[] {
  const stamps = summaries.map((summary) => {
    const collected = unlocked.includes(summary.id);
    return { summary, collected, wearing: activeId === summary.id, available: collected && registeredIds.has(summary.id) };
  });
  return [...stamps.filter((s) => s.collected), ...stamps.filter((s) => !s.collected)];
}
