# Pub themes: club themes unlocked by scanning

Status: draft for review, 2026-10-01

## Goal

Student pub clubs ("klubbmästerier") get their own Dokubolaget theme. A player at a club's pub scans a QR code on a poster, and seconds later they're playing in that club's look. The clubs have given permission to use their names and likeness.

Success means:
- A first-time visitor scans a poster, gets through the ID check, sees the unlock moment and lands in the new theme.
- Someone who isn't at the pub can't guess a code.
- A new club can be added without an app release.
- No club names, logos or codes end up in this public repository.

These ship in the same piece of work:
- vibration patterns per theme, with a setting to turn vibration off
- the unlock moment
- the pub stamp collection
- event codes (codes that expire or have a use limit)

## Decisions already made

- **Scanning opens a link.** The QR code holds `PUBLIC_URL/scan/<code>`, which any phone camera can open. There's no in-app scanner. Once the store apps exist, the same link can open the app through universal/app links.
- **One fixed code per club, which can be replaced.** Replacing a code means revoking it and creating a new one. Players who already unlocked keep the theme.
- **Club themes are data the server delivers**, not code in this repo. The app ships a kit (fonts, decorations, vibration patterns). Each club theme is a small file that picks from that kit and adds its own colours, copy and logo.
- **Club material stays private.** It lives on the container's data volume, and its source files live outside this public repo.
- **Postponed:** codes that change every minute, grouping players by club, sounds per theme, and an app icon per theme.

## How unlocking works

### Theme ids

`ThemeId` becomes `BuiltInThemeId | ClubThemeId`:
- `BuiltInThemeId` is today's union: prislista, midsommar, cyberwave, speakeasy, modern.
- `ClubThemeId` is the template literal type `` `club-${string}` ``, matching `^club-[a-z0-9-]{2,32}$`.

Changes that follow from this:
- **`isThemeId`** accepts both forms.
- **`getTheme(id)`** returns the built-in theme, or the club theme from the device cache. If neither exists, it falls back to the default theme, the same as today for unknown ids.
- **`parseUnlocked`** keeps club ids even when their file isn't cached yet, so they're not lost before it arrives.
- **`mergeUnlocked`** keeps the order built-ins first, then club ids sorted.

### Codes

**Format.** A code is 10 characters of Crockford base32, which is about 50 bits of randomness. Only its SHA-256 hash is stored, the same way session tokens are stored. If a printed code is lost, it's replaced rather than looked up again.

**Table `unlock_codes`:**

| Column | Notes |
|---|---|
| `id` | integer primary key |
| `code_hash` | unique |
| `theme_id` | |
| `label` | |
| `created_at` | |
| `expires_at` | null = never expires |
| `max_uses` | null = no limit |
| `uses` | |
| `revoked_at` | |

**Table `code_redemptions`:** `code_id`, `user_id` (null when logged out), `at`. A logged-in player redeeming the same code twice counts once.

**`POST /api/scan {code}`:**
- Normalises the code: uppercase, drops `-` and spaces, maps `O→0` and `I/L→1`.
- Rate limit: 20 requests per minute per client address, plus a cap per code.
- Success returns `{ themeId, summary }`, where `summary` is the club card data (see below).
- Errors:

  | Case | Response |
  |---|---|
  | Unknown or revoked code | 404 `invalid_code` |
  | Expired code | 410 `code_expired` |
  | Use limit reached | 410 `code_used_up` |

- When the player is logged in, the server adds the theme to their unlocks itself, so the app isn't trusted for this step.
- Writes follow the same rules as other writes: Origin check and JSON only.

**Server-side unlock checks.** `PUT /api/me/prefs` and `/scan` accept club ids that exist in `theme_packs`, as well as built-in ids. Sending an id straight to `PUT /api/me/prefs` without scanning stays possible, the same as built-in unlocks today. This is accepted because themes are cosmetic.

### The scan page

The route is `/scan/[code]`:
1. **ID check.** If the player hasn't answered the age gate on this device, the page shows the same gate first. The gate moves from `indexView` into its own component that both pages use.
2. **Unlock.** The page calls `/api/scan`, fetches and caches the club theme file, then calls `addUnlocks([id], "scan")`.
3. **Errors.** Errors are shown in the current theme:
   - "This code has expired"
   - "This code doesn't exist. Check the poster or scan again."
   - When offline: "You're offline" with a retry button.
4. **Done.** "Wear it now" or "Later" both go to Home.

A player who isn't logged in keeps the unlock on the device, and it reaches their account the next time they log in (the existing union sync).

## Club themes as data

### Theme file

Each club theme is a JSON file, validated on the server when it's imported and again in the app when it's cached:

```
{
  id: "club-<slug>", version: 3,
  club: { name, fullName, section, campus, venue, pubNight, website },
  dark: boolean,
  colors: ThemeColors,              // the full set, every field required
  fontKit: FontKitId,               // from the app's kit list
  radii, borders, typeScale, glow,  // same shapes as Theme
  flags: { ruledTable, productNumberCells, dottedLeaderPrices, greyscaleFlags,
           groupResultsByType, feedbackPlacement, celebrationLayout },
  confetti: { shape: ConfettiShape, colors: string[] },
  decoration: { kind: DecorationKind, colors: string[] },
  haptics: HapticPatternId,
  copy: { en: ThemeCopy, sv: ThemeCopy },
  dossier: DossierLook,
  logo: { width, height }           // the image itself is uploaded separately
}
```

**On import** (`importThemePack(dir)`):
- Runs the same WCAG AA contrast checks as `theme.test.ts`, using `src/theme/contrast.ts`.
- Rejects unknown font kits, decorations and haptic patterns.
- Accepts only PNG or WebP logos, at most 300 KB and 1024 px. No SVG, since an SVG can carry scripts.
- Bumps `version` on every re-import.

**Table `theme_packs`:** `id`, `version`, `data` (the JSON), `logo` (BLOB), `logo_type`, `hidden_at`, `updated_at`. Club themes therefore end up in the nightly backups with everything else.

### API

| Endpoint | Returns | Cache |
|---|---|---|
| `GET /api/themes` | summaries of the club themes that aren't hidden: id, version, club fields, name, three swatch colours, logo URL | 5 minutes |
| `GET /api/themes/:id` | the full theme file | 5 minutes, `ETag` = version |
| `GET /api/themes/:id/logo?v=<version>` | the logo, with the right image content type | 1 year, immutable |

### In the app

- **Cache.** Club theme files are cached in AsyncStorage (`dokubolaget.themePacks`, keyed by id). The app loads the cache before the first render that needs it.
- **Refresh.** At startup, the app refreshes unlocked club themes in the background whenever the version on the server is newer.
- **Offline.** An unlocked club theme works with no connection after its first download.
- **Conversion.** `packToTheme(pack)` builds a normal `Theme`:
  - `fonts` comes from the font kit.
  - `unlock` is `{ kind: "scan" }`.
- **Rendering.** Screens don't change; they keep using `useTheme()`.

### The app's kit

**Font kits** load on demand, like today. Each kit fills in all six font roles: logo, display, body, bodyStrong, condensed and mono.
- Kits named after the built-in themes reuse their existing fonts: `prislista`, `midsommar`, `cyberwave`, `speakeasy`.
- New kits come from `@expo-google-fonts`: Poppins, Lato, a pixel or arcade face, and a heavy geometric display face. The exact kit list is settled in the plan.

**Decorations** are new components, drawn in the theme file's `decoration.colors`. Each one respects reduced motion and runs inside `DecorationBoundary`:

| Kind | Look |
|---|---|
| `dancefloor` | a lit floor grid that slowly cycles colours |
| `arcade` | a pixel border, a scanline and a "17:17" style clock |
| `colorbars` | a TV test card with RGB bars, and an "ON AIR" mark on the board |
| `circuit` | circuit-board traces with pulses running along them |
| `candlelight` | warm vignette, candle glow, and songbook rules on the dossier |
| `cellar` | brick texture and a warm lamp |

## Vibration per theme

**Module.** `src/theme/haptics.ts` exports:
- `playHaptic(event)`, where the event is `tap`, `correct`, `nearMiss`, `miss`, `complete` or `unlock`
- `setHapticsEnabled(on)`

**Patterns.** A pattern is a short sequence of `expo-haptics` calls with delays between them.

| Pattern | Feel |
|---|---|
| `classic` | today's behaviour |
| `receipt` | a single light tick; correct is a ticking pattern |
| `neon` | double light pulses |
| `bass` | heavy then medium; complete is a "drop" |
| `arcade` | three quick light taps; complete is a level-up run |
| `toast` | soft medium; complete is a "clink" made of two lights |

Built-in themes get a pattern each: Prislista `receipt`, Midsommar `classic`, Cyberwave `neon`, Speakeasy `toast`, Modern `classic`. Club themes name theirs in the theme file.

**On the web**, Android browsers use `navigator.vibrate`, with each pattern mapped to millisecond durations. iPhone browsers have no vibration API, so nothing happens there.

**Setting.** "Vibration: on/off" on the Themes screen, stored on the device as `dokubolaget.haptics`. It defaults to on, and `prefers-reduced-motion` doesn't change it.

**Call sites.** Every existing direct `Haptics.*` and `Vibration.vibrate` call in the presenters and views moves to `playHaptic`, so the off switch covers everything.

## The unlock moment

`ClubUnlockView` is a full-screen view drawn in the club theme's own colours, not the current theme's:
1. The logo "stamps" in: it scales from 1.6 to 1 with a slight rotation and a settle.
2. At the same moment, confetti in the theme's confetti colours bursts and the `unlock` vibration plays.
3. Text: "Stamp collected" / `<club name>` / "`<pubNight>` at `<venue>`".
4. Buttons: "Wear it now" and "Keep my theme".

With reduced motion, there's no animation and no confetti, but the vibration still plays if it's on.

Built-in unlocks keep the existing `ThemeUnlockView`.

## Pub stamps

The `/stamps` screen ("Pub stamps") opens from the Themes screen and from a new Home entry.
- **Layout.** A grid of every club theme from `/api/themes`.
- **Collected stamps** show the logo in colour, the club name and "Wear it". Tapping one switches to that theme.
- **Missing stamps** show the logo greyed out, with "Scan the code at `<venue>`, `<pubNight>`".
- **Footer.** "Want your club here? Email `<contact email>`". The address comes from `/api/config` (`CONTACT_EMAIL` in `.env`); without it, the line isn't shown.
- **Offline.** The screen lists cached club themes only and says that it's offline.
- **Themes screen.** It lists built-in themes as today, plus unlocked club themes after them.

## Admin

All admin work happens through a command-line script in the container:

```
docker exec dokubolaget bun run admin <command>
```

| Command | What it does |
|---|---|
| `themes import <dir>` | Imports `theme.json` and the logo from a folder, after `docker cp` into the container. Prints the result, or every validation error. |
| `themes list` | Lists club themes with id, version, hidden state and unlock count. |
| `themes hide <id>` / `themes show <id>` | Hides a theme or shows it again. Hidden themes leave the list, but players who already unlocked keep theirs. |
| `codes create <themeId> --label "<text>" [--expires <ISO>] [--max-uses N]` | Prints the link and writes a QR SVG to `/data/qr/<id>.svg`, which you copy out with `docker cp`. |
| `codes list [<themeId>]` | Lists codes with label, uses, expiry and state. Never shows the code itself. |
| `codes revoke <id>` | Revokes a code. |

QR images come from the `qrcode` package, which joins nodemailer as a container-only dependency.

Club source material (theme files, logos and the concept notes) lives in `club-themes/` at the repo root. That folder is in `.gitignore`, and a private repo is recommended as its long-term home. This public repo only has a made-up sample theme under `server/fixtures/` for tests.

## Errors and edge cases

| Situation | What happens |
|---|---|
| Code works, but the theme file fails to download | The unlock is still stored. The theme shows as "Downloading…" in the picker and stamps, and the app retries on the next start. |
| Club theme is hidden after a player unlocked it | It stays playable from the cache. A new device can't download it, so it shows as unavailable. |
| Theme file fails validation in the app (version mismatch) | It's ignored, and the default theme is used. |
| A pinned or cached older version | It works until the newer version arrives. |
| Many failed scans from one address | It hits the scan rate limit and gets `rate_limited`. |

## Testing

**Server:**
- the code lifecycle: create, scan, expiry, use limit, revoke
- the logged-in scan writing to prefs, and repeat scans counting once
- the rate limit
- validation rejecting a theme file with bad contrast, an unknown kit or an SVG logo
- the image content type of the logo response
- `PUT /api/me/prefs` accepting known club ids and dropping unknown ones

**App, unit tests:**
- `isThemeId`, `packToTheme` and `parseUnlocked` with club ids
- haptic pattern choice and the off switch
- themeState with club ids

**Admin script:** `themes import` with the made-up sample theme, then `codes create` printing a working link.

**End to end:**
1. Import the sample club theme into the dev database and create a code.
2. A fresh browser profile opens `/scan/<code>`, goes through the ID check and sees the unlock moment.
3. The theme becomes active.
4. The stamps screen shows it as collected.
5. Reloading while offline keeps the theme.

**Visual:** the screenshot tool covers every club theme: Home, board, search, dossier and celebration.

## Out of scope

- codes that change every minute, shown on a screen at the pub
- groups and leagues by club
- sound
- an app icon per theme
- universal/app links for the store apps (added with the store release)
- a web admin interface
