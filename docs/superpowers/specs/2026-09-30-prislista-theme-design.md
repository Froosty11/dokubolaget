# Prislista 1986 theme, with Modern as an option

Date: 2026-09-30
Status: approved in conversation, awaiting written-spec review

## Goal

Give Dokubolaget a second look modelled on Systembolaget's printed price lists from the 1980s ("Prislista 1986"), and let players switch between it and today's look ("Modern") at any time. New players start on Prislista 1986. Both looks share every layout, animation and feature; only styling differs.

Success means: every screen, dialog and effect renders correctly in both looks on a 375 px phone and a 1440×640 laptop, in OS light and dark mode; switching is instant with no reload; the choice survives reloads and follows a logged-in player to a new device.

## Visual language: Prislista 1986

- **Paper.** Cream newsprint background with a faint paper grain. Cards read as catalogue columns: thin black rules, square corners, no drop shadows.
- **Type.** A period serif for headings and product names, a condensed grotesk for category headers, a monospace with tabular figures for product numbers, prices and the case files.
- **Colour.** Black ink and Systembolaget green. Yellow only as a highlight, as in the printed lists.
- **Board.** A ruled table like a price-list page. Solved cells show the product number and short name in print, with the bottle photo as a small inset instead of filling the cell.
- **Search results.** Catalogue entries: product number, name, dotted leader, price with the ":-" suffix, e.g. `9483 La Rioja Alta 890 .......... 1995:-`.
- **Existing features.** The case-file dossier stays as is. Confetti becomes small torn paper price tags in green, black and cream. The board-complete card becomes a stamped receipt.
- **Modern.** Today's look, pixel-for-pixel unchanged.

## Architecture

### Tokens: `src/theme/`

- `tokens.ts` defines a `Theme` type and two objects, `prislista` and `modern`, with identical shape:
  - `colors`: paper, ink, inkMuted, accent, highlight, cellFill, cellBorder, correct, nearMiss, miss, overlay, and the dialog surface/text pair.
  - `fonts`: display, body, condensed, mono. Each value is a font family name with a system fallback.
  - `borders`: rule width, cell border width; `radii`: card, cell, button.
  - `flags`: `ruled` (thin black rules vs rounded cards), `dottedLeaderPrices`, `paperTagConfetti`, `productNumberCells`.
- `modern` is built by lifting today's literal values out of the views, so Modern renders identically.
- `ThemeProvider.tsx` holds the active theme name in React state, exposes `useTheme()` returning `{ theme, name, setName }`.
- Views build their `StyleSheet` from tokens through a memoised `makeStyles(theme)` per view, so a switch restyles without reload and without rebuilding styles every render.
- The three Tamagui dialogs (tutorial, age gate, login) receive colours and fonts explicitly as props or inline styles, since they render through portals outside the normal style flow.

### Fonts

Bundled as files under `assets/fonts/` with their OFL licence text, loaded in the existing `useFonts` call in `src/app/_layout.tsx`:

- Libre Baskerville (regular, bold): headings and product names.
- Barlow Condensed (medium, semibold): category headers.
- IBM Plex Mono (regular, medium): product numbers, prices, case files.

Until the fonts load, text uses the system serif / monospace fallback so nothing renders blank.

### Persistence

- Device: AsyncStorage key `dokubolaget.theme`, which is localStorage on web. Written on every change, read at startup before first paint where possible.
- Account: a `theme` field in the existing private profile document `users/{uid}/private/profile`, written through the existing save path in `firestoreModel.ts`. On login the account value wins over the device value and is written back to the device.
- Parsing: anything other than `"prislista"` or `"modern"` falls back to `"prislista"`.
- Existing players with no saved choice are treated as new and land on Prislista 1986.

### Toggle

A two-position switch on the Home tab labelled "Prislista 1986" and "Modern", with a short page-turn transition built on React Native's Animated API (as the rest of the app's animations are).

### Web details

The page background and the `theme-color` meta tag follow the active theme, so there is no white flash and the phone status bar matches. The static default in `src/app/+html.tsx` is the Prislista paper colour, since that is the default theme.

## Scope of touched files

Every screen's styling: Home (`indexView`), Play (`gameplayView`, `boardAnimations`), Search (`searchView`), Leaderboard (`leaderboardResultView`, `leaderboardFormView`), the login and age-gate dialogs (`authDialogView`, `indexView`), the tutorial dialog (`gameplayView`), `boardCompleteView`, `Confetti`, `Dossier`, the tab bar (`app/(tabs)/_layout.tsx`), `AppStyles.tsx`, and `app/_layout.tsx` for the provider and fonts. About 60 hard-coded colours and 6 files of font names move to tokens. No layout, animation or game-logic changes.

## Error handling

- Fonts not yet loaded: system fallback fonts.
- Corrupt or unknown stored theme value: default theme.
- Account write fails (offline, rules): device value still applies; the failure is logged like other persistence errors.

## Testing

- Add Bun's built-in test runner (no new dependency) with a `test` script, covering pure logic:
  - both themes define every token in the `Theme` type (also enforced by TypeScript);
  - text-on-background colour pairs meet WCAG AA contrast in both themes;
  - theme-name parsing handles missing, unknown and malformed values.
- Visual verification: Argent on the dokubolaget-iPhone simulator and headless Chrome at 375 px and 1440×640, every screen in both looks, with the Mac in light and dark mode. Includes dialogs, dossier, board-complete celebration and confetti.
- Type check stays at the existing baseline error count.

## Rollout

Built in steps, each leaving the app working:

1. Tokens and provider, with only Modern defined.
2. Fonts bundled and loaded.
3. Screens migrated one at a time to tokens, with Modern visually identical.
4. Prislista 1986 tokens and the retro-only touches (rules, dotted leaders, paper-tag confetti, product-number cells, stamped receipt).
5. Toggle and persistence.

Then rebuild the container, run the full screenshot pass, and commit.

## Out of scope

- Replacing the two Systembolaget-lookalike fonts (`monopol.ttf`, `bolagetMediumCondensed.ttf`) in Modern. It is a trademark and font-licensing risk worth its own follow-up.
- Native (App Store / Play) builds. The design uses nothing web-only, so it carries over.
