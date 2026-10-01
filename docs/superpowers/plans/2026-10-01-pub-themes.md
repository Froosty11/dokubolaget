# Pub Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Club themes are delivered by the server and unlocked by scanning a QR link. This plan also adds vibration patterns per theme, the unlock moment, a pub stamps screen and event codes.

**Architecture:**
- **One shared validator.** `src/theme/packSchema.ts` is pure TypeScript with no React Native. It defines and validates a club theme file, and both the server and the app use it.
- **Server.** It loads `club-themes/<slug>/` into SQLite at startup (`server/themePacks.ts`), stores hashed unlock codes (`server/codes.ts`) and adds four API routes.
- **App.**
  - It caches club theme files and turns them into normal `Theme` objects (`src/theme/clubThemes.ts`), so the screens keep using `useTheme()` unchanged.
  - A kit of font sets, decorations and vibration patterns ships in the app, and club themes pick from it.

**Tech Stack:** Bun (`bun:sqlite`, `bun test`), Expo 55, React Native Web, expo-router, MobX, `expo-haptics`, `@expo-google-fonts/*`, `qrcode` (admin only).

**Spec:** `docs/superpowers/specs/2026-10-01-pub-themes-design.md`. Mockups are in `docs/superpowers/specs/assets/2026-10-01-pub-themes*.jpg`.

## Global Constraints

- **Commits:** no AI attribution, no `Co-Authored-By` lines.
- **Theme ids:**
  - Club theme ids match `^club-[a-z0-9-]{2,32}$`.
  - Built-in ids are unchanged: `prislista`, `midsommar`, `cyberwave`, `speakeasy`, `modern`.
- **Codes:**
  - A code is 10 Crockford base32 characters (alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`), shown as `XXXX-XXXX-XX`.
  - Only the SHA-256 hash is stored, and no command ever prints a code again after `codes create`.
  - Normalising a code: uppercase it, drop `-` and whitespace, map `O→0`, `I→1`, `L→1`.
- **Error codes this feature adds:** `invalid_code` (404), `code_expired` (410), `code_used_up` (410). Existing codes are reused: `rate_limited`, `bad_request`, `not_found`.
- **Rate limits:**
  - `/api/scan`: 20 per minute per client address, and 120 per minute per code.
  - Club theme reads have no extra limit.
- **Logos:** optional. A logo is PNG or WebP, at most 300 KB and at most 1024 px on each side. SVG is never accepted. With no logo, the app draws the club's initial in its colours (a monogram).
- **Contrast:** every club theme passes the same WCAG AA checks as the built-in themes, using `contrastProblems()` (Task 1).
- **Device storage keys:**
  - `dokubolaget.themePacks` (cached club theme files)
  - `dokubolaget.haptics` (`"on"` or `"off"`)
  - `dokubolaget.clubThemeSummaries` (the last fetched club list)
- **Language:** UI text is English (`UI_LANG = "en"`). Theme copy may use Swedish flavour, as the built-in themes do.
- **Tests:** `bun test src server` passes after every task.
- **Type check:** the error count stays at the baseline measured in Task 1, Step 1. Today that's 5 errors, all in `leaderboardFormView`, `gameplayView:397` and `(tabs)/index.tsx`.
- **Container:**
  - The runtime image gains only `qrcode` alongside `nodemailer`, with versions pinned in both `package.json` and the Dockerfile.
  - The runtime `package.json` gets `"scripts": {"admin": "bun scripts/admin.ts"}`, so `docker exec dokubolaget bun run admin …` works.

## Review Focus

These are the five failure modes most likely to hurt a real player that no basic test covers. Each has a test in the task that owns the code.

1. **A cold scan.** The first page a new player ever loads is `/scan/<code>`. Home never ran, nothing is cached and the ID check hasn't been answered. The unlock must still be saved to the device before the unlock moment shows, so closing the tab right after keeps it. Test owned by Task 11.
2. **A club theme that disappears.** The active theme is a club theme whose cached file is missing, for example after cleared storage or Safari private mode, or one that was hidden on the server. The app falls back to the default theme without crashing, and the picker and stamps show "Downloading…" or "Unavailable". Tests owned by Tasks 2 and 9.
3. **Codes from logged-out play, synced later.** A logged-out player scans, then logs in on the same device. The union sync uploads `club-x`, and the server must keep it because the club theme exists. Unknown club ids must still be dropped. Test owned by Task 5.
4. **Codes typed by hand.** `7kq4-m2xr-9t`, `7KQ4 M2XR 9T` and `7KQ4-M2XR-9T` all redeem, and an `O` typed for `0` works too. Test owned by Task 4.
5. **Fonts that don't load.** A club font set fails to load (offline on first use). Text must use the fallback fonts, never blank text. `useThemeFonts` already does this for built-in ids, and font sets must go through the same path. Test owned by Task 10.

---

## Tasks

### Task 1: The club theme schema, validation and shared contrast pairs

**Files:**
- Create: `src/theme/packSchema.ts`, `src/theme/packSchema.test.ts`, `server/fixtures/club-themes/club-sample/theme.json`, `server/fixtures/club-themes/club-sample/logo.png` (a 64×64 PNG)
- Modify: `src/theme/contrast.ts` (move `CONTRAST_PAIRS` here and add `contrastProblems`), `src/theme/theme.test.ts` (import the pairs from `contrast.ts`)

**Interfaces:**
- **Produces:**
  ```ts
  export const CLUB_THEME_ID = /^club-[a-z0-9-]{2,32}$/;
  export type ClubThemeId = `club-${string}`;
  export const FONT_KIT_IDS = ["prislista","midsommar","cyberwave","speakeasy","poppins","archivo","pixel","broadcast","grotesk","slab"] as const;
  export type FontKitId = (typeof FONT_KIT_IDS)[number];
  export const DECORATION_KINDS = ["none","dancefloor","arcade","colorbars","circuit","candlelight","cellar"] as const;
  export type DecorationKind = (typeof DECORATION_KINDS)[number];
  export const HAPTIC_PATTERN_IDS = ["classic","receipt","neon","bass","arcade","toast"] as const;
  export type HapticPatternId = (typeof HAPTIC_PATTERN_IDS)[number];
  export type ClubInfo = { name: string; fullName: string; section: string; campus: string; venue: string; pubNight: string; website: string };
  export type ThemePack = {
    id: ClubThemeId; version: number; club: ClubInfo; dark: boolean;
    colors: ThemeColors; fontKit: FontKitId;
    radii: Theme["radii"]; borders: Theme["borders"]; typeScale: Theme["typeScale"]; glow: Theme["glow"];
    flags: Theme["flags"]; confetti: Theme["confetti"];
    decoration: { kind: DecorationKind; colors: string[] };
    haptics: HapticPatternId;
    copy: Record<Lang, ThemeCopy>; dossier: DossierLook;
    logo: { width: number; height: number } | null;
  };
  export function validatePack(raw: unknown): { ok: true; pack: ThemePack } | { ok: false; errors: string[] };
  // What /api/themes lists; used by the server (Task 3) and the app (Tasks 9, 12).
  export type PackSummary = { id: ClubThemeId; version: number; name: string; club: ClubInfo; swatch: [string, string, string]; logoUrl: string | null };
  ```
  In `contrast.ts`:
  - `export const CONTRAST_PAIRS: Array<[keyof ThemeColors, keyof ThemeColors]>` (moved unchanged from `theme.test.ts`)
  - `export function contrastProblems(colors: ThemeColors): string[]`, which returns lines like `"ink on page: 3.21 < 4.5"`

  `validatePack` must import only `./types` and `./contrast`, never React Native, because the server imports it.

- [ ] **Step 1: Measure the type check baseline.** Run `npx tsc --noEmit -p . 2>&1 | grep -cE "^src"` and write the number in the ledger.
- [ ] **Step 2: Write the failing tests.** In `packSchema.test.ts`:
  - The fixture validates (`ok: true`).
  - Each of these is rejected with a message naming the field:
    - an id of `"Club-X"` or `"club-"`
    - `version: 0` or `1.5`
    - a missing `colors.ink`
    - a colour that isn't `#rrggbb`
    - `fontKit: "comic"`
    - `decoration.kind: "lava"`
    - `haptics: "x"`
    - empty `copy.sv.name`
    - empty `copy.en.correctTitles`
  - Text that fails contrast (`ink` = `page`) is rejected, and the error contains `"ink on page"`.
  - `logo: null` is accepted.
  - Unknown extra keys are ignored, not rejected.
- [ ] **Step 3: Run the tests and see them fail:** `bun test src/theme/packSchema.test.ts`.
- [ ] **Step 4: Implement `validatePack`.**
  - Check every field by hand, with no schema library.
  - Collect every error instead of stopping at the first.
  - Copy-key and dossier-key checks use the same key lists as `theme.test.ts` (`COPY_KEYS` plus every `DossierLook` field).
  - Return a fresh object containing only the known keys.
- [ ] **Step 5:** Move the pairs into `contrast.ts`. `theme.test.ts` now imports `CONTRAST_PAIRS`.
- [ ] **Step 6:** Run `bun test src server`, and check that the type check count is unchanged.
- [ ] **Step 7: Commit:** "Add the club theme file format and its validator".

### Task 2: Theme ids that include club themes

**Files:**
- Modify:
  - `src/theme/types.ts`
  - `src/theme/registry.ts`
  - `src/theme/unlocks.ts`
  - `src/theme/themeState.ts`
  - `src/theme/themeStorage.ts` (only the types)
  - `server/api.ts` (built-in ids for now; club ids follow in Task 5)
- Test: `src/theme/unlocks.test.ts`, `src/theme/themeState.test.ts`

**Interfaces:**
- **Produces:**
  - `types.ts`:
    - `BUILT_IN_THEME_IDS` (renamed from `THEME_IDS`, plus an alias `export const THEME_IDS = BUILT_IN_THEME_IDS`, so nothing else breaks)
    - `BuiltInThemeId`
    - `ThemeId = BuiltInThemeId | ClubThemeId`
  - `UnlockRule` gains `{ kind: "scan" }`, and `Theme` gains `haptics: HapticPatternId`.
  - `registry.ts`:
    - `registerClubTheme(theme: Theme)` and `clubTheme(id): Theme | undefined`, kept in a module-level `Map`
    - `isThemeId` accepts built-in ids or `CLUB_THEME_ID`
    - `isBuiltInThemeId(id)`
    - `getTheme(id)`: built-in, then a registered club theme, then the default
  - `unlocks.ts`:
    - `mergeUnlocked` returns built-in ids in `THEMES` order, then club ids sorted
    - `parseUnlocked` keeps valid club ids
    - `isThemeAvailable` treats a `scan` theme as available only when unlocked
  - `themeState.ts`:
    - `availableThemeIds` = the built-in ones available, plus unlocked club ids **that have a registered theme**
    - `unlockAll` also adds every registered club theme
    - `UnlockSource` gains `"scan"`
- Every built-in theme file gets a `haptics` value: Prislista `receipt`, Midsommar `classic`, Cyberwave `neon`, Speakeasy `toast`, Modern `classic`.

- [ ] **Step 1: Write the failing tests.**
  - `parseUnlocked('["club-tmeit","cyberwave","nope","club-"]')` returns `["cyberwave","club-tmeit"]`.
  - `mergeUnlocked(["club-b"], ["club-a","speakeasy"])` returns `["speakeasy","club-a","club-b"]`.
  - **Review Focus 2:** with `themeId = "club-x"` and no registered theme, `activeThemeId` is `"prislista"` and `setThemeId("club-x")` returns false. After `registerClubTheme(fakeTheme("club-x"))` and `addUnlocks(["club-x"], "scan")`, it's available and `pendingSources["club-x"] === "scan"`.
  - `getTheme("club-missing")` returns the default theme.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement. Keep `THEME_IDS` as an alias of the built-in list so `server/api.ts` and `fonts.ts` still compile.
- [ ] **Step 4:** Run `bun test src server` and the type check against the baseline.
- [ ] **Step 5: Commit:** "Let theme ids include club themes".

### Task 3: Club themes on the server

**Files:**
- Create: `server/themePacks.ts`, `server/imageInfo.ts`, `server/themePacks.test.ts`
- Modify: `server/db.ts` (migration 2)

**Interfaces:**
- **Migration 2** (append to `MIGRATIONS`):
  ```sql
  CREATE TABLE theme_packs (
    id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL,
    logo BLOB, logo_type TEXT, hidden_at TEXT, updated_at TEXT NOT NULL
  );
  CREATE TABLE unlock_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code_hash TEXT NOT NULL UNIQUE,
    theme_id TEXT NOT NULL REFERENCES theme_packs(id), label TEXT NOT NULL,
    created_at TEXT NOT NULL, expires_at TEXT, max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0, revoked_at TEXT
  );
  CREATE TABLE code_redemptions (
    code_id INTEGER NOT NULL REFERENCES unlock_codes(id),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL, at TEXT NOT NULL
  );
  CREATE INDEX code_redemptions_code ON code_redemptions(code_id, user_id);
  ```
- **`imageInfo(buf: Uint8Array): { type: "image/png" | "image/webp"; width: number; height: number } | null`**
  - PNG: the signature `89 50 4E 47 0D 0A 1A 0A`, then the IHDR width and height as big-endian 32-bit integers at bytes 16 and 20.
  - WebP: `RIFF....WEBP`, with:
    - `VP8 `: 14-bit width and height at bytes 26 and 28, `& 0x3fff`
    - `VP8L`: from bits at byte 21
    - `VP8X`: 24-bit little-endian values +1 at bytes 24 and 27
  - Anything else returns `null`.
- **`loadThemePacks(db, dir: string, log: (line: string) => void): { loaded: string[]; skipped: string[]; errors: Record<string, string[]> }`**
  - It reads every subfolder: `theme.json`, plus an optional `logo.png` or `logo.webp`.
  - It validates with `validatePack`, plus the logo rules from Global Constraints. The logo's `width` and `height` in `theme.json` must match the file.
  - It upserts only when the file's `version` is greater than the stored one.
  - A folder name that doesn't equal the id minus `club-` is an error.
- **Also produces:**
  - `listPacks(db): PackSummary[]` (type from Task 1), for themes that aren't hidden. `name` is `copy.en.name`, `swatch` is `[page, accent, highlight]`, and `logoUrl` is `/api/themes/<id>/logo?v=<version>` or null
  - `getPack(db, id): ThemePack | null`, which also returns hidden ones, for players who already unlocked them
  - `getLogo(db, id): { type, bytes } | null`
  - `setHidden(db, id, hidden: boolean)`
  - `knownClubIds(db): Set<string>`, which includes hidden ones

- [ ] **Step 1: Write the failing tests.**
  - `imageInfo` reads the fixture PNG as 64×64, and returns null for `<svg …>` bytes.
  - Loading the fixture folder stores the theme.
  - Loading again with the same version is skipped.
  - Bumping the version in a temp copy replaces it.
  - A broken `theme.json` lands in `errors` and the previously stored version stays.
  - A 2000×10 PNG, a 400 KB file and an SVG named `logo.png` are each rejected.
  - A `club-other` id in folder `sample` is rejected.
  - `listPacks` leaves out hidden themes, and `getPack` still returns them.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement. Use `fs.readdirSync` and `readFileSync`, and run each folder's upsert in its own transaction.
- [ ] **Step 4:** Run `bun test src server`.
- [ ] **Step 5: Commit:** "Load club themes into the database at startup".

### Task 4: Unlock codes

**Files:**
- Create: `server/codes.ts`, `server/codes.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export function normalizeCode(input: unknown): string | null; // 10 valid chars or null
  export function formatCode(code: string): string;              // "XXXX-XXXX-XX"
  export function createCode(db, opts: { themeId: string; label: string; expiresAt?: string | null; maxUses?: number | null }, now?: Date): { id: number; code: string };
  export function redeemCode(db, input: unknown, userId: string | null, now?: Date): { themeId: string; codeId: number };
  export function listCodes(db, themeId?: string): Array<{ id; themeId; label; createdAt; expiresAt; maxUses; uses; revokedAt }>;
  export function revokeCode(db, id: number, now?: Date): boolean;
  ```
- **Code generation:** `crypto.getRandomValues` over the 32-character alphabet, with rejection sampling not needed since 256 divides evenly by 32. Store `hashToken(code)`, using the normalised code.
- **`createCode`** throws `ApiError(400, "bad_request")` if `themeId` isn't in `theme_packs`.
- **`redeemCode`** runs in one transaction:
  1. Look up the code by hash. If there's no row, or it's revoked, throw `invalid_code` (404).
  2. If it has expired (`expires_at <= now`), throw `code_expired` (410).
  3. If this is a logged-in user who already redeemed this code, return success without counting it again.
  4. If it's at its limit (`uses >= max_uses`), throw `code_used_up` (410).
  5. Otherwise run `UPDATE … SET uses = uses + 1 WHERE id = ? AND (max_uses IS NULL OR uses < max_uses)`, require `changes === 1` (otherwise `code_used_up`), then insert into `code_redemptions`.
- [ ] **Step 1: Write the failing tests.**
  - **Review Focus 4:** `normalizeCode` turns `"7kq4-m2xr-9t"`, `" 7KQ4 M2XR 9T "` and `"7KQ4-M2XR-9T"` into the same value, maps `"O"` to `"0"` and `"l"` to `"1"`, and rejects `"U"` (not in the alphabet) and wrong lengths.
  - A created code redeems to its theme. Its hash is in the database and the plain code is nowhere in the database.
  - Revoked → `invalid_code`.
  - `expiresAt` in the past → `code_expired`.
  - With `maxUses: 2`, two logged-out redeems work and the third gets `code_used_up`. The same logged-in user redeeming twice counts as one use.
  - `listCodes` never contains a `code` field.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test src server`.
- [ ] **Step 5: Commit:** "Add unlock codes with expiry, use limits and revocation".

### Task 5: API routes for scanning and club themes

**Files:**
- Modify: `server/api.ts`, `server/api.test.ts`

**Interfaces:**
- **Consumes:** `redeemCode` and `normalizeCode` (Task 4); `listPacks`, `getPack`, `getLogo` and `knownClubIds` (Task 3).
- **`ApiDeps`** gains `contactEmail?: string`. `GET /api/config` now returns `{ supportUrl, contactEmail }`, where `contactEmail` must match the existing email regex or is null.
- **Routes:**
  - **`POST /api/scan`** (a write, so it goes through `checkWrite`):
    - limits `scan:${ip}` to 20 per minute
    - normalises the code; an invalid one gets `invalid_code` straight away, still counted against the address limit
    - limits `scan-code:${normalized}` to 120 per minute
    - runs `redeemCode`
    - if there's a session, merges the theme into `prefs.unlocked_themes`, using the same merge as `PUT /api/me/prefs`
    - responds `200 { themeId, summary }`
  - **`GET /api/themes`** returns `{ themes: PackSummary[] }` with `cache-control: public, max-age=300`.
  - **`GET /api/themes/:id`** returns the theme or 404, with `ETag: "v<version>"`. A matching `If-None-Match` gets a 304 with an empty body. `respond` needs a raw variant for this.
  - **`GET /api/themes/:id/logo`** returns the raw bytes with the stored content type, `cache-control: public, max-age=31536000, immutable` and `x-content-type-options: nosniff`.
    - `ApiResponse.body` becomes `string | Uint8Array`, and `server.js`'s `serveApi` must write either kind.
- **Prefs:** `parseUnlocked` in `api.ts` gets an extra argument, a set of known club ids. `PUT /api/me/prefs` and `prefsFor` keep built-in ids plus club ids in `knownClubIds(db)`, built-ins first, then club ids sorted.

- [ ] **Step 1: Write the failing tests.**
  - A scan with a good code returns 200 and the theme id.
  - A logged-in scan shows up in `GET /api/me` prefs.
  - Bad code → 404 `invalid_code`. Expired → 410 `code_expired`.
  - The 21st scan in a minute from one address → 429.
  - A scan from another origin → 403.
  - `GET /api/themes` lists the fixture theme.
  - `GET /api/themes/club-sample` with `If-None-Match: "v1"` → 304.
  - The logo has `content-type: image/png` and `nosniff`.
  - **Review Focus 3:** `PUT /api/me/prefs` with `unlockedThemes: ["club-sample", "club-ghost", "cyberwave"]` stores `["cyberwave","club-sample"]`.
  - `/api/config` includes `contactEmail` when configured, and is null for `"not an email"`.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement. Load the fixture in the test setup with `loadThemePacks(db, "server/fixtures/club-themes", () => {})`.
- [ ] **Step 4:** Run `bun test src server`.
- [ ] **Step 5: Commit:** "Add the scan and club theme API".

### Task 6: Wiring up the container

**Files:**
- Modify: `server.js`, `../Dockerfile`, `../.env.example`, `package.json` (add `qrcode` and its types to devDependencies)

**Interfaces:**
- **`server.js`:**
  - `CLUB_THEMES_DIR = process.env.CLUB_THEMES_DIR || path.join(APP_ROOT, "..", "club-themes")`
  - calls `loadThemePacks(db, CLUB_THEMES_DIR, log)` once at startup, before listening; logs `[themes] loaded …, skipped …` and every error
  - passes `contactEmail: process.env.CONTACT_EMAIL` to `createApi`
  - `serveApi` writes `Uint8Array` bodies as they are
- **Dockerfile runtime stage:**
  - `COPY club-themes /app/club-themes`, since `../club-themes` relative to `/app/Dokubolaget` resolves there
  - `COPY Dokubolaget/src/theme/packSchema.ts Dokubolaget/src/theme/contrast.ts ./src/theme/`
  - the runtime `package.json` gets `"scripts":{"admin":"bun scripts/admin.ts"}`, and `bun add nodemailer@10.0.13 qrcode@<pinned>`
- **`.env.example`:** document `CONTACT_EMAIL=e@dokubolaget.se` and `CLUB_THEMES_DIR`.

- [ ] **Step 1:** Make the changes.
- [ ] **Step 2: Check.**
  - Restart the dev API (`bun run api`). The log shows `[themes] loaded` for each folder in `club-themes/`, or zero folders before Task 13.
  - `curl localhost:8090/api/themes` returns JSON.
- [ ] **Step 3: Commit:** "Load club themes in the container and pass the contact email".

### Task 7: The admin script

**Files:**
- Create: `scripts/admin.ts`, `server/admin.test.ts`
- Modify: `package.json` (`"admin": "bun scripts/admin.ts"`), `README.md` (an Admin section)

**Interfaces:**
- **`export async function runAdmin(argv: string[], ctx: { db: Database; out: (line: string) => void; clubDir: string; qrDir: string; publicUrl: string | null }): Promise<number>`** returns the exit code.
- **Commands:**

  | Command | Behaviour |
  |---|---|
  | `themes check [<dir>]` | Validates without writing, using `validatePack`, `imageInfo` and the same checks as `loadThemePacks`. It's refactored into `checkThemeFolder(dir)` in `themePacks.ts`. |
  | `themes list` | Prints id, version, hidden and unlock count. |
  | `themes hide <id>` / `themes show <id>` | Hides a theme or shows it again. |
  | `codes create <themeId> --label <text> [--expires <ISO>] [--max-uses N]` | Prints the formatted code, the link `${publicUrl}/scan/${code}` and the QR path. It writes `${qrDir}/code-<id>-<themeId>.svg` with `QRCode.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 2 })`. If `publicUrl` is null, it refuses with "Set PUBLIC_URL first". |
  | `codes list [<themeId>]` | Lists codes. |
  | `codes revoke <id>` | Revokes a code. |

- **Entry point.** At the bottom, under `import.meta.main`:
  - open `DB_PATH` (default `./data/local.sqlite`)
  - `clubDir` = `CLUB_THEMES_DIR` or `../club-themes`
  - `qrDir` = `${dirname(DB_PATH)}/qr`
  - `publicUrl` = `PUBLIC_URL`
  - exit with the returned code
- [ ] **Step 1: Write the failing tests** with an in-memory db and the fixture.
  - `themes check server/fixtures/club-themes` returns 0.
  - `codes create club-sample --label Poster` prints a link matching `/scan/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/` and writes an SVG starting with `<svg`.
  - That code then redeems with `redeemCode`.
  - `codes list` doesn't contain the code.
  - `codes revoke <id>` makes the code `invalid_code`.
  - An unknown command prints usage and returns 2.
- [ ] **Step 2:** Run the tests and see them fail. **Step 3:** Implement. **Step 4:** Run `bun test src server`.
- [ ] **Step 5:** Write the README Admin section: the `docker exec dokubolaget bun run admin codes create club-qmisk --label "Bar poster"` example, `docker cp dokubolaget:/data/qr ./qr`, and how to replace a code (revoke, then create).
- [ ] **Step 6: Commit:** "Add the admin script for club themes and codes".

### Task 8: Vibration per theme

**Files:**
- Create: `src/theme/haptics.ts`, `src/theme/haptics.test.ts`
- Modify:
  - every call site in `src/reactjs/gameplayPresenter.tsx`, `searchPresenter.tsx`, `indexPresenter.tsx`, `themePickerPresenter.tsx`, `src/app/(tabs)/_layout.tsx`, `src/views/indexView.tsx` and `leaderboardFormView.tsx`
  - `src/views/themePickerView.tsx` (the switch)
  - `src/mobxReactiveModel.ts` (loading the setting)

**Interfaces:**
- **Produces:**
  ```ts
  export type HapticEvent = "tap" | "correct" | "nearMiss" | "miss" | "complete" | "unlock";
  type Step = { kind: "impact"; style: "light" | "medium" | "heavy" } | { kind: "notify"; type: "success" | "warning" | "error" } | { kind: "wait"; ms: number };
  export const HAPTIC_PATTERNS: Record<HapticPatternId, Record<HapticEvent, Step[]>>;
  export type HapticDriver = { impact(style): void; notify(type): void; vibrate(ms: number[]): void; wait(ms: number): Promise<void>; isWeb: boolean };
  export function createHaptics(driver: HapticDriver, getPattern: () => HapticPatternId): { play(event: HapticEvent): Promise<void>; playPattern(pattern: HapticPatternId, event: HapticEvent): Promise<void>; setEnabled(on: boolean): void; readonly enabled: boolean };
  export const haptics; // created with the real expo-haptics/navigator driver and the active theme's pattern
  export async function loadHapticsSetting(): Promise<void>; // reads dokubolaget.haptics
  export function saveHapticsSetting(on: boolean): void;
  ```
- **On the web**, each pattern becomes one `navigator.vibrate([...])` array: a light impact is 10 ms, medium 20, heavy 35, success `[15,40,15]`, warning `[25,60,25]`, error `[40,40,40]`, and a wait is a gap. If `navigator.vibrate` doesn't exist, nothing happens.
- **Patterns.** `classic` reproduces today's calls exactly: tap = medium; correct = success; nearMiss = warning; miss = error; complete = success; unlock = success then heavy.

  | Pattern | tap | correct | nearMiss | miss | complete | unlock |
  |---|---|---|---|---|---|---|
  | `receipt` | light | light, 60, light, 60, light | light, 120, light | medium | light ×5, 50 apart, then success | success, 80, light ×3 |
  | `neon` | light | light, 70, light | light, 70, medium | medium, 70, medium | light, 60, light, 60, success | heavy, 90, light, 60, light |
  | `bass` | medium | heavy | medium, 90, medium | heavy, 120, heavy | heavy, 250, heavy, 80, heavy (the "drop") | heavy, 120, heavy, 120, success |
  | `arcade` | light | light, 50, light, 50, light | light, 50, medium | error | light ×4, 40 apart, then heavy (level-up) | success, 60, light ×4, 40 apart |
  | `toast` | medium | medium, 140, light (the clink) | light, 140, light | warning | medium, 140, light, 140, success | success, 140, light, 140, light |

- **Theme switch.** A "Vibration" row with a `Switch` at the bottom of `ThemePickerView` (see mockup 4), with props `hapticsOn: boolean` and `onToggleHaptics(on)`.
- [ ] **Step 1: Write the failing tests** with a fake driver that records calls.
  - `classic` reproduces today's calls.
  - `setEnabled(false)` means no calls at all.
  - With `isWeb: true`, `bass` `complete` is one `vibrate` call with the right array.
  - `wait` is awaited between steps.
  - Every pattern id has every event.
- [ ] **Step 2:** Run the tests and see them fail. **Step 3:** Implement.
- [ ] **Step 4: Replace call sites.**
  - Every `Haptics.*` and `Vibration.vibrate` call in `src/` becomes `haptics.play(...)`: button taps → `tap`; right, near miss and wrong answers on the board → `correct`, `nearMiss` and `miss`; board finished → `complete`.
  - Check with `grep -rnE "Haptics\.|Vibration\.vibrate" src | grep -v src/theme/haptics.ts`, which must print nothing.
- [ ] **Step 5:** Add the switch to the Themes screen, saving the setting to the device. Run `bun test src server` and the type check.
- [ ] **Step 6: Commit:** "Give every theme its own vibration pattern and add an off switch".

### Task 9: Club themes in the app: cache, conversion and refresh

**Files:**
- Create: `src/theme/clubThemes.ts`, `src/theme/clubThemes.test.ts`
- Modify:
  - `src/api.ts` (`scan`, `themes`, `theme` and `logoUrl`, plus messages for the new codes)
  - `src/dokuModel.ts` (`clubSummaries`, `clubThemesReady`)
  - `src/mobxReactiveModel.ts` (load the cache before device prefs are applied, then refresh)
  - `src/theme/fonts.ts` (font sets, Task 10)

**Interfaces:**
- **Consumes:** `validatePack` (Task 1), `registerClubTheme` (Task 2).
- **Produces:**
  ```ts
  export function packToTheme(pack: ThemePack): Theme; // fonts = fontKitFonts(pack.fontKit); unlock = { kind: "scan" }
  export type ClubThemeStore = { get(id): ThemePack | undefined; all(): ThemePack[] };
  export function createClubThemes(deps: { storage: { getItem(k): Promise<string | null>; setItem(k, v): Promise<void> }; api: { themes(): Promise<{ themes: PackSummary[] }>; theme(id): Promise<ThemePack> }; register: (t: Theme) => void }): {
    loadCache(): Promise<void>;                    // reads dokubolaget.themePacks, validates each, registers the valid ones
    ensure(id: ClubThemeId): Promise<boolean>;     // downloads, validates, caches and registers; true when it can be used
    refresh(unlocked: ThemeId[]): Promise<PackSummary[]>; // fetches the list, re-downloads unlocked ones with a newer version, saves summaries
    summaries(): PackSummary[];                    // last fetched or cached list
  };
  ```
  `api.ts` additions:
  - `scan(code)` → `{ themeId, summary }`
  - `themes()`
  - `theme(id)`
  - `logoUrl(summary)`, which builds `${API_BASE}${summary.logoUrl}`
  - messages: `invalid_code` "That code doesn't exist. Check the poster or scan again.", `code_expired` "This code has expired.", `code_used_up` "This code has been used up."
- **Startup order** in `mobxReactiveModel.ts`:
  1. `clubThemes.loadCache()`
  2. `loadDeviceThemePrefs()`, which applies `themeId`, now possibly a club id
  3. `serverSync.refresh()`
  4. `clubThemes.refresh(reactiveModel.unlockedThemes)`
  5. for every unlocked club id not cached yet, `ensure(id)`
- [ ] **Step 1: Write the failing tests** with fake storage and api.
  - `packToTheme(fixture)` passes the same contrast checks and has the `scan` unlock.
  - `loadCache` registers valid cached themes and drops invalid ones, with a warning and no exception.
  - `ensure` caches and registers.
  - `refresh` re-downloads only when the server version is higher.
  - **Review Focus 2:** with a cached theme active, a cleared cache plus an api that throws means `loadCache` registers nothing, and `themeState.activeThemeId` falls back to `"prislista"` with no exception.
- [ ] **Step 2:** Run the tests and see them fail. **Step 3:** Implement. **Step 4:** Run `bun test src server` and the type check.
- [ ] **Step 5: Commit:** "Cache club themes on the device and turn them into themes".

### Task 10: The kit: font sets and decorations

**Files:**
- Modify: `package.json`, adding:
  - `@expo-google-fonts/poppins`
  - `@expo-google-fonts/playfair-display`
  - `@expo-google-fonts/archivo-black`
  - `@expo-google-fonts/archivo`
  - `@expo-google-fonts/press-start-2p`
  - `@expo-google-fonts/lato`
  - `@expo-google-fonts/oswald`
  - `@expo-google-fonts/space-grotesk`
  - `@expo-google-fonts/alfa-slab-one`
  - `@expo-google-fonts/bitter`
- Modify: `src/theme/fonts.ts`, `src/theme/decorations/registry.ts`, `src/theme/decorations/ThemeBackdrop.tsx`
- Create: `src/theme/decorations/kit/{Dancefloor,Arcade,ColorBars,Circuit,Candlelight,Cellar}.tsx`

**Interfaces:**
- **`fonts.ts`:**
  - `FONT_KITS: Record<FontKitId, { fonts: ThemeFonts; load: () => Record<string, any> }>`
    - The built-in kit ids reuse the existing `THEME_FONT_LOADERS` and fonts from the theme files.
    - New kits:

      | Kit | display | body | bodyStrong | mono | condensed |
      |---|---|---|---|---|---|
      | `poppins` | Playfair Display 700 | Poppins 400 | Poppins 600 | IBM Plex Mono (already loaded with prislista) | Poppins 600 |
      | `archivo` | Archivo Black | Archivo 400 | Archivo 800 | Archivo 400 | Archivo 800 |
      | `pixel` | Press Start 2P | Lato 400 | Lato 900 | Press Start 2P | Lato 700 |
      | `broadcast` | Oswald 700 | Oswald 400 | Oswald 600 | Oswald 400 | Oswald 600 |
      | `grotesk` | Space Grotesk 700 | Space Grotesk 400 | Space Grotesk 600 | Space Grotesk 400 | Space Grotesk 600 |
      | `slab` | Alfa Slab One | Bitter 400 | Bitter 700 | Bitter 400 | Bitter 700 |

  - `fontKitFonts(kit): ThemeFonts`
  - `useThemeFonts(id)` resolves the kit for club ids through `getTheme(id)`, so both kinds go through the same load-or-fall-back path.
- **Decorations:** `DECORATIONS: Record<Exclude<DecorationKind, "none">, ComponentType<DecorationProps & { colors: string[] }>>`. `ThemeBackdrop` uses `BACKDROPS[id]` for built-in themes. For a club theme it uses `DECORATIONS[pack.decoration.kind]` with `colors`. To make that possible, `packToTheme` stores `decoration` on the `Theme` as an optional `theme.decoration`.
- **What each decoration draws** (react-native-svg and `Animated`, reduced motion means still):

  | Decoration | Drawing |
  |---|---|
  | Dancefloor | a perspective tile grid at the bottom, tiles cycling through `colors` every 1.2 s, plus two blurred light beams |
  | Arcade | scanlines (repeating 2 px lines at 3.5% white), a double pixel frame, a "17:17" clock badge top right |
  | ColorBars | a 10 px SMPTE bar strip under the status bar, plus an "● ON AIR" pill top right |
  | Circuit | copper traces with node dots at the corners; a pulse dot travels along one trace |
  | Candlelight | two candles with flickering flame opacity and warm radial glows |
  | Cellar | a brick pattern at 16% opacity and a hanging lamp with a warm glow |

  Each one runs inside `DecorationBoundary` and uses `useId` for SVG ids, as Cyberwave does.
- [ ] **Step 1: Write the failing test** (`fonts.test.ts`, **Review Focus 5**). For a club theme whose kit loader rejects, `useThemeFonts`' underlying `loadKit` reports "not ready" and the provider falls back to `FALLBACK_FONTS`. To make this testable, extract the decision into `fontsFor(theme, ready)` and test that function.
- [ ] **Step 2:** Implement the font sets, install the packages with `bun add`, and implement the decorations.
- [ ] **Step 3: Visual check.** Temporarily register the fixture with each decoration kind in turn and screenshot Home with `tools/themeScreens.mjs`. No layout breaks, and nothing covers the board.
- [ ] **Step 4: Commit:** "Add the font sets and decorations club themes can use".

### Task 11: The scan page, the shared age gate and the unlock moment

**Files:**
- Create:
  - `src/components/AgeGate.tsx` (moved out of `indexView.tsx` along with its styles)
  - `src/app/scan/[code].tsx`
  - `src/reactjs/scanPresenter.tsx`
  - `src/views/clubUnlockView.tsx`
  - `src/components/ClubLogo.tsx` (the logo image, or the monogram when there's no logo)
- Modify: `src/views/indexView.tsx`, `src/reactjs/indexPresenter.tsx` (use `AgeGate`), `src/app/_layout.tsx` (register `scan/[code]` without a header)

**Interfaces:**
- **`AgeGate`:** `{ isOpen, onAccept, onReject }`, with the same text and buttons as today. A `useAgeGate()` hook holds the AsyncStorage logic that's in `indexPresenter` today, so both pages share it.
- **`ClubLogo`:** `{ summary: PackSummary | ThemePack-like; size: number; dimmed?: boolean }`.
  - The monogram is the club name's first letter, or the whole name when it's 2 characters or fewer.
  - It's drawn in the theme's `accent` on `page`, in its `display` font, inside a circle.
- **`ClubUnlockView`:** `{ theme: Theme; club: ClubInfo; logo: ReactNode; onWear(); onLater() }`.
  - It draws with the given theme's colours, not the current theme's.
  - The stamp animation is scale 1.6→1 and rotate −14°→−6° with `Animated.spring`, plus `Confetti` (burst) in `theme.confetti.colors`, plus `haptics.play("unlock")` with the club theme's pattern. Pass the pattern explicitly with `haptics.playPattern(pattern, "unlock")` (Task 8).
  - With reduced motion it's static and has no confetti.
- **The scan presenter's states:** `"gate" | "redeeming" | "unlocked" | "error" | "offline"`.
  1. If the age gate isn't answered, show `AgeGate` first. Rejecting goes to the same under-20 page as Home.
  2. `api.scan(code)`
  3. `clubThemes.ensure(themeId)`
  4. `addUnlocks([themeId], "scan")`
  5. **Save the unlock to the device straight away**, with `saveDeviceThemePrefs`, before any animation.
  6. Show `ClubUnlockView`.
  - "Wear it now" calls `setThemeId(themeId)` and goes to `router.replace("/")`. "Keep my theme" goes to `router.replace("/")`.
  - On `ApiRequestError` the page shows the message, plus a "Back to Home" link. On status 0 it shows "You're offline. Connect and try again." with a Retry button.
  - If `ensure` fails after a successful scan, the unlock is still saved and the page says "Unlocked. The theme will download next time you're online."
- [ ] **Step 1: Write the failing end-to-end check** (**Review Focus 1**), `tools/scanCheck.mjs`, a headless Chrome script in the style of `tools/themeScreens.mjs`.
  1. Create a code with `bun scripts/admin.ts codes create club-sample --label e2e` against the dev database. Set `CLUB_THEMES_DIR=server/fixtures/club-themes` for the dev API.
  2. Open `/scan/<code>` in a fresh profile and expect the age gate.
  3. Accept, and expect "Stamp collected".
  4. **Before clicking anything**, read `localStorage["dokubolaget.unlockedThemes"]` and expect it to contain `club-sample`.
  5. Click "Wear it now", reload `/`, and expect the active theme to be `club-sample` (`window.__doku.activeThemeId`).
  6. Open `/scan/AAAA-AAAA-AA` and expect "That code doesn't exist".
- [ ] **Step 2:** Run it and see it fail. **Step 3:** Implement. **Step 4:** Run it and see it pass. Run `bun test src server` and the type check.
- [ ] **Step 5: Commit:** "Add the scan page, the shared age gate and the club unlock moment".

### Task 12: Pub stamps and club themes on the Themes screen

**Files:**
- Create: `src/app/stamps.tsx`, `src/reactjs/stampsPresenter.tsx`, `src/views/stampsView.tsx`
- Modify:
  - `src/reactjs/themePickerPresenter.tsx` and `src/views/themePickerView.tsx` (a "Pub themes" section and a "Pub stamps ›" link)
  - `src/views/indexView.tsx` (a "Pub stamps" menu entry)
  - `src/app/_layout.tsx` (register `stamps` as a modal like `themes`)
  - `src/dokuModel.ts` (`contactEmail`, from `/api/config`)

**Interfaces:**
- **`StampsView` props:** `{ stamps: Array<{ summary: PackSummary; collected: boolean; wearing: boolean; available: boolean }>; collectedCount: number; offline: boolean; contactEmail: string | null; onWear(id); onClose() }`.
  - **Collected:** the logo in colour, a "SAMLAD" tag, and a "WEAR IT" or "WEARING" button.
  - **Missing:** a dashed border, the logo greyed out, and "Scan the code at `<venue>`, `<pubNight>`".
  - **Collected but not cached:** a "Downloading…" button, disabled.
  - **Footer:** "Want your club here? `<email>`" as a `mailto:` link, only when `contactEmail` is set.
  - **Offline:** "You're offline – showing the stamps saved on this device."
- **Themes screen:** after the built-in cards, a "Pub themes" heading with "Pub stamps ›" on the right. Below it, one card per unlocked club theme, using `ThemeSwatch` with the converted theme, and "Downloading…" when it isn't registered.
- **Home:** an `IndexOption` "Pub stamps" between Themes and Login.
- [ ] **Step 1: Write the failing test** (`src/stamps.test.ts`) for the pure helper `buildStamps(summaries, unlocked, activeId, registeredIds)`. Collected comes first in server order, then missing; `available` is false when collected but not registered.
- [ ] **Step 2:** Implement the helper and the screens.
- [ ] **Step 3: Visual check:** screenshot `/stamps` and `/themes` in Prislista and Cyberwave and compare with mockups 3 and 4.
- [ ] **Step 4: Commit:** "Add the pub stamps screen and club themes on the Themes screen".

### Task 13: The six club themes

**Files:**
- Create: `club-themes/{tmeit,qmisk,dkm,mkm,pr,fisq}/theme.json`
- Modify: `club-themes/README.md` (mark which values are provisional)

Follow the concepts and colours in `club-themes/README.md` and the mockup `2026-10-01-pub-themes.jpg`.

| Theme | Font set | Decoration | Vibration | Feedback | Confetti |
|---|---|---|---|---|---|
| tmeit | `poppins` | `candlelight` | `toast` | overlay | `sparks` |
| qmisk | `archivo` | `dancefloor` | `bass` | overlay | `dots` |
| dkm | `pixel` | `arcade` | `arcade` | overlay | `flecks` |
| mkm | `broadcast` | `colorbars` | `neon` | overlay | `sparks` |
| pr | `grotesk` | `circuit` | `neon` | slip | `flecks` |
| fisq | `slab` | `cellar` | `toast` | slip | `dots` |

- **Logos:** `logo: null` everywhere until the clubs send files.
- **Copy:** in both `en` and `sv`. Use the mockup's titles and toasts, e.g. QMISK `nearMissTitle` "QLOSE!" and tabs "Hem / Qör / Ranqs". No line may encourage drinking.
- **`club` fields:** from the README table. TMEIT is Fridays at Kistan 2.0.
- [ ] **Step 1:** Write the six files.
- [ ] **Step 2:** `bun scripts/admin.ts themes check` returns 0. Fix any contrast failures by adjusting colours, never by weakening the check.
- [ ] **Step 3: Visual check:** restart the dev API, unlock each theme with a code, and screenshot Home, the board, search, the dossier and the board-finished screen. Compare with the mockup.
- [ ] **Step 4: Commit:** "Add the TMEIT, QMISK, DKM, MKM, PR and FISQ themes".

### Task 14: Full check and documentation

- [ ] **Step 1:** Run `bun test src server`. Check the type check against the baseline. Run `tools/scanCheck.mjs` and `tools/themeScreens.mjs` for all six club themes.
- [ ] **Step 2: Docker check.**
  - Build: `docker build --build-arg EXPO_PUBLIC_UNLOCK_ALL_THEMES=true -t dokubolaget .`
  - Run with a test volume. The log shows six `[themes] loaded` lines.
  - Create a code with `docker exec … bun run admin codes create club-qmisk --label test`, copy the QR out, and open the link in the browser. The unlock works.
  - Remove the test container and volume.
- [ ] **Step 3: README.** Document club themes (the folder format, versioning, `themes check`), codes and posters, `CONTACT_EMAIL`, and the vibration switch.
- [ ] **Step 4:** Do a final review of the whole branch, with a fresh reviewer on the most capable model, against the spec and this plan's Review Focus.
- [ ] **Step 5:** Before pushing, check the outgoing diff and commit messages for anything that must stay private. Club names are fine.
