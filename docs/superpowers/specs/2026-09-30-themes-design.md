# Themes: Modern, Midsommar, Cyberwave, Speakeasy and Prislista 1986

Date: 2026-09-30
Status: revised after mockup review, awaiting written-spec review

## Goal

Give Dokubolaget a set of switchable looks, most of them earned by playing, so themes double as rewards that bring players back. Every theme shares the same layouts, animations and features; only styling, decorative artwork and a little flavour copy differ.

Success means:

- Every screen, dialog and effect renders correctly in all five themes on a 375 px phone and a 1440×640 laptop, with the OS in light and dark mode.
- Switching is instant, with no reload.
- The choice and the unlocks survive reloads and follow a logged-in player to a new device.
- Unlocking a theme is a visible, celebrated moment.

Mockups: `assets/2026-09-30-theme-prislista-1986.jpg`, `assets/2026-09-30-theme-neon-themes.jpg` (Cyberwave is direction A; Neon Dynasty was dropped), `assets/2026-09-30-theme-midsommar-speakeasy.jpg`.

## The themes

### Modern (everyone, default)

Today's look, pixel-for-pixel unchanged. New players start here.

### Midsommar (everyone)

Bright Swedish summer folk art.

- **Palette.** Sky blue `#bfe0f5`, cream paper `#fbf6e4`, navy ink `#1f3a5f`, Dala red `#c8102e`, butter yellow `#ffd23f`, meadow green `#2e6b3e`, near-miss amber `#e08a00`.
- **Type.** Fraunces for headings and product names, Nunito for UI text.
- **Board.** Rounded cards. Headers have a dashed cross-stitch outline: red for columns, green for rows. Empty cells show a faint flower. Solved cells get a green border and a small flower wreath.
- **Artwork.** A sun and rolling meadow behind the header. The board-complete card sits under a maypole with two wreaths.
- **Effects.** Confetti becomes flower petals.

### Cyberwave (unlock: finish your first board)

80s outrun.

- **Palette.** Deep violet `#0b0221` / `#1d0442`, magenta `#ff2ec4`, cyan `#00f0ff`, sunset yellow `#ffe45e` and orange `#ff8a3d`, near-miss amber `#ffb13d`.
- **Type.** Monoton for the logo, Orbitron for headers and labels, Share Tech Mono for body text.
- **Board.** Translucent dark cells with thin neon borders: cyan for columns, magenta for rows. Solved cells glow cyan, with the price in sunset yellow.
- **Artwork.** A striped sunset sun behind a chrome logo, and a horizon line with a perspective grid floor under the board. The grid scrolls slowly unless the player prefers reduced motion.
- **Effects.** Confetti becomes neon sparks.

### Speakeasy (unlock: a perfect board, all nine cells with no misses)

1920s Prohibition art deco.

- **Palette.** Near-black `#0e0d0b`, gold `#d4af37`, cream `#efe3c2`, near-miss copper `#c7722d`.
- **Type.** Limelight for the logo and big titles, Poiret One for display lines (large sizes only), Josefin Sans for UI text.
- **Board.** Stepped gold frames with chamfered inner rules. Solved cells are dark gold with a glass icon. The help button is a gold diamond.
- **Artwork.** An art deco sunburst fan behind the logo and a faint pinstripe background. Search is styled as "The Menu", with results grouped by type and gold dotted leaders to the price.
- **Effects.** Confetti becomes gold flecks. The board-complete card is a gold members' card.
- **Vocabulary.** Guesses are "pours".

### Prislista 1986 (unlock: 7-day streak)

The 1980s Systembolaget printed price list.

- **Palette.** Cream newsprint `#f1e9d2` with a paper grain, black ink `#1d1b17`, Systembolaget green `#0d6b3a`, and yellow `#f3c63f` for highlights only.
- **Type.** Libre Baskerville for headings and names, Barlow Condensed for category headers, IBM Plex Mono for product numbers, prices and case files.
- **Board.** A ruled table with thin black rules and square corners. Solved cells print the product number, short name and price with the ":-" suffix, with a small bottle inset instead of the full photo. Flags are printed in greyscale. A near miss appears as a typed slip under the board.
- **Search.** Catalogue entries: number, name, dotted leader, price. The wine type is shown on every line, and a rejected guess gets a rubber stamp.
- **Effects.** Confetti becomes torn paper price tags. The board-complete card is a stamped receipt.

This theme leans on Systembolaget's visual identity. Locking it behind a streak makes it a reward. It does not reduce trademark exposure, because the theme still ships in the public repo and bundle.

## Unlocks

- **Rules.** Modern and Midsommar are always available. Cyberwave unlocks on the first completed board. Speakeasy unlocks on the first board completed with zero misses. Prislista 1986 unlocks when the player's best streak reaches 7 days.
- **Permanence.** Unlocks are permanent.
- **Where unlocks come from.** Board-based unlocks are detected on the device when the board-complete celebration fires. They are stored on the device and, when logged in, merged into the account. The streak unlock is read from `longestStreak` on the player's public profile, so it needs a login. Streaks are frozen until server-side scoring lands, so Prislista is reachable today only for players whose existing best streak is already 7 or more.
- **Cheating.** Unlocks are cosmetic, so tracking them on the client is acceptable. A player who edits local storage gets a theme, nothing more.
- **The unlock moment.** When a theme unlocks, the celebration is followed by a "New theme unlocked" card with a live preview swatch and two buttons, "Try it now" and "Later".
- **Locked themes in the picker.** They stay visible with their swatch dimmed, a lock, the unlock condition, and progress where it's measurable, for example "5 of 7 days".

## Architecture

### Tokens: `src/theme/`

- **`tokens.ts`.** Defines a `Theme` type and one object per theme (`modern`, `midsommar`, `cyberwave`, `speakeasy`, `prislista`), all with identical shape:
  - `colors`: page, surface, ink, inkMuted, accent, accentAlt, highlight, cellFill, cellBorder, headerCol, headerRow, correct, nearMiss, miss, overlay, dialogSurface, dialogInk.
  - `fonts`: logo, display, body, condensed, mono. Each has a system fallback.
  - `borders`, `radii`, and `glow`, an optional shadow recipe for the neon look.
  - `flags`: `ruledTable`, `dottedLeaderPrices`, `productNumberCells`, `greyscaleFlags`, `groupResultsByType`.
  - `confetti`: `dots`, `petals`, `sparks`, `flecks` or `priceTags`.
  - `copy`: the theme's flavour strings in Swedish and English. The keys are `nearMissTitle`, `correctTitle`, `completeTitle`, `guessesLabel`, `searchTitle` and the tab labels. The app-wide Swedish/English work (separate spec) decides which language is shown. Until it lands, English is shown.
- **`modern`.** Built by lifting today's literal values out of the views, so Modern renders identically.
- **`unlocks.ts`.** A pure function `availableThemes({ unlocked, longestStreak, loggedIn })` and `unlockEventsForBoard({ completed, misses })` returning theme ids. It has no React or Firebase dependency.
- **`ThemeProvider.tsx`.** Holds the active theme id and the unlocked set. It exposes `useTheme()` returning `{ theme, id, setId, available, unlocked }`. `setId` refuses locked themes.
- **Styles.** Views build their styles with a memoised `makeStyles(theme)`, so a switch restyles without reload or per-render rebuilds.
- **Dialogs.** The Tamagui dialogs (tutorial, age gate, login) take colours and fonts explicitly, because they render through portals.

### Decorations: `src/theme/decorations/`

Each theme's bespoke artwork is a small component, for example `CyberwaveBackdrop`, `MidsommarMeadow`, `SpeakeasyFan` and `PaperGrain`, built with react-native-svg (already a dependency) and the Animated API. A `ThemeBackdrop` component picks the right one. Modern has none. Views only place `ThemeBackdrop` and `ThemeCelebrationArt`; they never reference a theme by name.

### Fonts

- **Licences.** All open-licensed (OFL), bundled under `assets/fonts/<theme>/` with their licence text.
- **Loading.** Modern's fonts load at startup as today. Other themes' fonts load on demand the first time the theme is selected or previewed, so first load doesn't grow. While they load, text uses the system fallback.

### Persistence

- **Device.** AsyncStorage keys `dokubolaget.theme` and `dokubolaget.unlockedThemes`.
- **Account.** `theme` and `unlockedThemes` fields in `users/{uid}/private/profile`. On login the two unlock sets are merged (union) and written back to both. The account's theme choice wins if it is available.
- **Parsing.** An unknown, corrupt or locked stored theme falls back to Modern.

### Firestore rules

`users/{uid}/private/profile` additionally allows `unlockedThemes`: a list of at most 10 strings, each one of the known theme ids. `theme` must also be a known theme id. The rules tests in `firestore-tests/` cover both.

### Picker

"Themes" on the Home tab opens a picker screen listing all five themes as cards with a swatch, name, one-line description and state (active, available, or locked with its condition and progress). Picking an available theme switches immediately with a short cross-fade.

### Web details

The page background and the `theme-color` meta tag follow the active theme, so there's no white flash and the phone status bar matches. The static default in `src/app/+html.tsx` stays Modern.

## Scope of touched files

- **Every screen's styling.** Home (`indexView`), Play (`gameplayView`, `boardAnimations`), Search (`searchView`), Leaderboard (`leaderboardResultView`, `leaderboardFormView`), the dialogs (`authDialogView`, the age gate in `indexView`, the tutorial in `gameplayView`), `boardCompleteView`, `Confetti`, `Dossier`, the tab bar (`app/(tabs)/_layout.tsx`), `AppStyles.tsx`, and `app/_layout.tsx` for the provider.
- **Other changes.** A new picker route, the unlock card, and the `firestoreModel.ts` persistence fields.
- **Not changed.** No layout or game-logic changes beyond detecting the unlock moments.

## Error handling

- Fonts not yet loaded: system fallback fonts.
- Stored theme corrupt, unknown or locked: Modern.
- Account write fails (offline or rules): device values still apply; the failure is logged like other persistence errors.
- A theme decoration throws: an error boundary around `ThemeBackdrop` drops the decoration and keeps the screen.

## Accessibility

- Text-on-background pairs meet WCAG AA in every theme. Glow never counts toward contrast.
- Poiret One and Monoton are used only at large sizes.
- Moving decorations (the Cyberwave grid, petals, sparks) respect reduced-motion settings.
- Locked cards announce their unlock condition to screen readers.

## Testing

- **Unit tests.** Add Bun's built-in test runner (no new dependency) with a `test` script, covering:
  - every theme defines every token (also enforced by TypeScript), including both languages in `copy`;
  - text-on-background pairs meet WCAG AA in every theme;
  - `availableThemes` and `unlockEventsForBoard` for each rule, including logged-out players and permanence;
  - stored-value parsing for missing, unknown, locked and malformed values.
- **Firestore rules.** New cases for `theme` and `unlockedThemes` in the emulator tests.
- **Visual.** Argent on the dokubolaget-iPhone simulator and headless Chrome at 375 px and 1440×640. Screenshot every screen in every theme, including the dialogs, dossier, celebration, confetti, picker and unlock card.
- **Type check.** Stays at the existing baseline error count.

## Rollout

Built in steps, each leaving the app working:

1. Tokens, provider and `unlocks.ts`, with only Modern defined.
2. Screens migrated one at a time to tokens, with Modern visually identical.
3. Picker, unlock detection, the unlock card and persistence, including the rules change.
4. Midsommar.
5. Cyberwave.
6. Speakeasy.
7. Prislista 1986.

Each theme step bundles its fonts, adds its tokens, copy, decorations and confetti style, and gets its own screenshot pass. The container is rebuilt and checked at the end.

## Dependencies and follow-ups

- **Swedish/English support** is its own spec. This spec only provides both languages for the theme flavour strings.
- **Prislista unlock.** It becomes reachable for everyone once server-side scoring and streaks land (the next spec after these).
- **Modern's fonts.** Replacing the two Systembolaget-lookalike fonts (`monopol.ttf`, `bolagetMediumCondensed.ttf`) stays a separate follow-up.
- **Out of scope.** Native (App Store / Play) builds. Nothing here is web-only.
