// Branded browser-tab title for the current route. Expo Router on web clears
// the static <title> on hydration and doesn't apply route titles here, so a
// web-only effect (see components/DocumentTitle) sets document.title from this.
const BRAND = "Dokubolaget";

export type TitleLabels = { home: string; play: string; leaderboard: string; search: string };

export function documentTitleFor(pathname: string, labels: TitleLabels): string {
  const p = pathname || "/";
  let label: string | null = null;
  if (p === "/") label = labels.home;
  else if (p.startsWith("/gameplay")) label = labels.play;
  else if (p.startsWith("/leaderboard")) label = labels.leaderboard;
  else if (p.startsWith("/search")) label = labels.search;
  return label ? `${label} · ${BRAND}` : BRAND;
}
