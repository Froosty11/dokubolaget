# A desktop layout for the web app

Status: approved in chat (2026-10-07). The owner chose each layout from browser mockups.

## Goal

On a wide browser window the web app is the phone layout stretched out:
- the menu rows on Home run 1400px wide
- the board floats in empty space under a big logo
- the leaderboard is a full-width beige box
- a phone-style tab bar sits at the bottom of a laptop screen

Success means that a wide browser gets a layout made for it, and that phones look exactly as they do today, whether in the native app or in a phone browser.

## Decisions already made

- **When it switches.** The desktop layout is used when `Platform.OS === "web"` and the window is at least 1024px wide. Native apps never use it, including iPad in landscape. It follows window resizes live.
- **Navigation is a left sidebar**, like Instagram's web app. It replaces the bottom tab bar on wide screens.
- **Home is Wordle-minimal (mockup D).** It has a centered logo, title and tagline, a **Play** button and a **How to play** button, today's date, and a footer with the support link and the responsible-drinking note. Nothing else.
- **Play has no side panel.** The board takes the content area. The sidebar shrinks to an icon rail on this page only (mockup P2).
- **Leaderboard is a table plus a "You" card (mockup L2).** The period dropdown becomes tabs.

Mockups are in `.superpowers/brainstorm/` (not committed).

## Architecture

### `useWideLayout()`

The rule is a pure `isWideLayout(os, width)` in `src/layout.ts`, alongside `WIDE_MIN_WIDTH = 1024` and the sidebar and rail widths. Keeping it free of React Native means `bun test` can run it. The hook in `src/useWideLayout.ts` wraps it. Every wide-only branch in the app goes through this hook.

### The sidebar wraps the navigator

On wide screens the root layout (`src/app/_layout.tsx`) renders a row with the sidebar on the left and the existing `Stack` on the right. On narrow screens it renders the `Stack` alone, as today.

- **Tabs.** On wide screens the tabs layout hides its tab bar (`tabBarStyle: { display: "none" }`).
- **Themes and Pub stamps.** On wide screens these open as regular pages (`presentation: "card"`) inside the content area, so the sidebar stays visible. On narrow screens they stay modals.
- **Search.** It stays a transparent modal. Because it lives inside the Stack, it covers only the content area.
- **URLs and mobile routing** don't change.

Two alternatives were rejected:
- **A custom tab bar on the left of the tab navigator.** It loses the sidebar on Themes and Stamps unless those move into the tab group, which would change how they behave on phones.
- **Separate `.web.tsx` screens.** Every screen would be duplicated.

### `Sidebar` (`src/components/Sidebar.tsx`)

- **Top:** `ThemeLogo`.
- **Nav items:** Home `/`, Play `/gameplay`, Leaderboard `/leaderboard`, Themes `/themes`, Pub stamps `/stamps`. Each item uses the existing SVG icon set.
  - The active item comes from `usePathname()`.
  - Pressing an item plays the `tap` haptic and calls `router.navigate`.
- **Bottom, logged out:** "Log in / Sign up" opens `AuthDialog`.
- **Bottom, logged in:** the nickname, then "Log out" (`handleLogoutACB`) and a "Delete account" link.
- **Colours:** it uses the theme's `surface`, `divider`, `accent` and `ink`, so every theme recolours it.
- **Rail mode** is used on `/gameplay`, and on `/search`, which opens over the board. It is 64px wide and shows only the icons and a small logo. The labels appear as a hover label beside the icon and stay as accessibility labels.

## Pages on wide screens

### Home

Home is built from the existing pieces in a centered column:
- `ThemeLogo` (large)
- "Dokubolaget"
- the tagline "Get nine bottles in the grid. A new board every day at 04:00."
- buttons: **Play** (`router.navigate("/gameplay")`) and **How to play**
- today's date
- footer: `SupportLink` and `ResponsibleNote`

The menu rows and the login block are not rendered because the sidebar covers them. `AgeGate` is unchanged.

The tutorial dialog and its text move out of `gameplayView.tsx` into `src/components/HowToPlayDialog.tsx`. Play and Home both use it. The dialog content is capped at 480px wide.

### Play

- The logo is not rendered because it's in the rail.
- The board size comes from the content area: window width minus the rail, and window height minus padding, with no tab bar. The current 720px cap stays.
- The ⓘ corner button, practice label, toast and Prislista slip are unchanged.

### Leaderboard

- **Tabs.** The period selector renders as segmented tabs: Today / This week / All time / Streak.
- **Table.** The results table sits on the left, with the page content capped at about 960px. The player's own row is highlighted.
- **"You" card**, on the right:
  - **Rank and value for the selected period**, from the leaderboard response's `me`.
  - **Current streak, longest streak, boards finished and unicorns**, from `/me` stats.
  - **Logged out**, it shows "Log in to see your rank, your streak and the unicorns you've found." and a login button.
- **Refetching.** The leaderboard refetches when the player logs in or out, so their own row follows the account.
- **Getting the stats.** `/me` stats reach the page through `setStats` on the model. `serverSync` already calls `model.setStats?.()`, so the model only needs a `stats` field and the setter.

### Themes and Pub stamps

- They open as pages. The ✕ close button is hidden on wide screens.
- Their content is already capped at 560px.

### Dialogs

Login, board complete, theme unlock and the product dossier are already width-capped. They only need to center inside the content area.

## Out of scope

- Phone layouts. Any visible change on a narrow screen is a bug.
- Native tablets.
- New data or endpoints. Everything shown already exists on the client or in `/me`.

## Testing

- **Unit (`bun test`):**
  - `isWideLayout` at 1023 and 1024px, on web and on native.
  - `/me` stats reach `model.setStats`, and are cleared when logged out (`serverSync.test.ts`).
- **Visual:** Puppeteer screenshots of Home, Play, Leaderboard, Themes and Stamps.
  - **Sizes:** 1440×900, 1024×768 and 390×844.
  - **Themes:** Prislista and Cyberwave.
  - **Narrow check:** at 390×844 the screens must match the screenshots taken before the change.
