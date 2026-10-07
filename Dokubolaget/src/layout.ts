// The web app gets a desktop layout (sidebar, wider pages) on wide windows.
// Phones and the native apps always keep the phone layout. Pure, so it can be
// tested; components use useWideLayout() (src/useWideLayout.ts).
export const WIDE_MIN_WIDTH = 1024;

// Width of the sidebar, and of the icon rail it shrinks to on the board.
export const SIDEBAR_WIDTH = 220;
export const RAIL_WIDTH = 64;

export function isWideLayout(os: string, width: number) {
  return os === "web" && width >= WIDE_MIN_WIDTH;
}
