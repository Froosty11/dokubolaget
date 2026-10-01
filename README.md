# Dokubolaget

This app is a daily game in the same vein as PokeDoku, etc. The general idea is that the user plays on a 3x3 grid and tries to come up with products from Systembolaget that match the two categories of the intersection of the selected square. The answer is scored on uniqueness, and the player can compete with other users to get the top score on the leaderboard.

## Feedback we implemented based on user-testing:

- We had forgotten a "No results" message when search yielded no results
- A user mentioned that showing the categories in the search view would be helpful so we added the category props to the search view
- There was no Haptics at the time of user-testing (an oversight due to the group mainly developing on desktop using emulator) so the user had a hard time determining if their clicks always went through

## Future possible additions:

- Share results board - Similar to Wordle and Connections which contributed to those two games' virality.
- Leaderboard - If you're logged in maybe you can see your own score in comparison to the selected leaderboard
- Search - Systembolaget does some black magic when determining which category laabel/labels to show. Currently it shows the categoryLabel3, which seems to be (but not always) the most verbose category
- Gameplay - Pressing a category redirects to Systembolaget's page for that category, in PokeDoku it directs to the Bulbapedia (pokemon wiki)

### From user feedback (that we didn't have time to implement)

- More work in balacing the game difficulty, alternatively the option to re-roll a column / row category or a hint system.
- Systembolaget also shows flags for country of origin of products, breaks up the information heavy nature of search view

## How to run the app (locally)

Dokubolaget makes use of a proxy to access Systembolagets api so it needs two terminal instances to run.

Run the following commands in the `Dokubolaget` directory:

**Building the app**
```bash
bun install
```

**Terminal 1 - Running the proxy**
```
bun run proxy
```

**Terminal 2 - Running the app**
```
bun run dev
```

## Deploying (Docker, one container)

The whole thing runs as a single container (see `Dokubolaget/server.js`):

- the static web build
- the app's API on `/api` (accounts, saved themes and progress, daily boards; see `Dokubolaget/server/`) backed by one SQLite file
- the Systembolaget proxy (same origin, `/proxy?url=`, limited to the few Systembolaget URLs the app needs; see `Dokubolaget/proxyPolicy.js`)
- the nightly board pipeline, which stores tomorrow's board in the database

```bash
cp .env.example .env      # optional: SMTP settings for password reset emails
docker compose up -d --build
```

The container listens on port 8080, bound to `127.0.0.1` on the host by default (change with `PORT` and `BIND_ADDRESS` in `.env`). Put a TLS reverse proxy such as Caddy in front of it for `https://dokubolaget.se`, and keep `TRUST_PROXY=true` so rate limits see real client addresses and the login cookie is marked secure.

- **Data.** Everything lives in the `dokubolaget-data` volume at `/data`: the database `dokubolaget.sqlite` and nightly backups in `/data/backups` (the last 7). Back up the volume.
- **Boards.** On boot the container stores today's and tomorrow's boards (bundled ones if the pipeline hasn't run), then runs the pipeline every night at 00:05 UTC. `GET /healthz` reports liveness; run details are in the container logs.
- **Password reset.** Set `PUBLIC_URL` (required: links are only ever built from it) plus `SMTP_URL` and `MAIL_FROM` to send reset emails. Without SMTP, reset links are printed to the container log (`docker logs dokubolaget`).

### Local development

```bash
cd Dokubolaget
bun run api      # API + database on http://localhost:8090 (data/local.sqlite)
bun run proxy    # Systembolaget dev proxy on :8787
bun run dev      # Expo; the web app talks to the API on :8090
bun test src server
```

## Themes

The app ships five looks. Players switch between the ones they have in **Home → Themes**:

| Theme | How you get it |
|---|---|
| Prislista 1986 | Everyone, the default: a parody of the old printed price list |
| Midsommar | Everyone |
| Cyberwave | Finish your first board |
| Speakeasy | A perfect board: all nine cells with no misses |
| Modern | A 7-day streak (logged in). Modern ships Systembolaget's own fonts, so it is the hardest reward. |

Unlocks are permanent. They're saved on the device and, when logged in, merged into the account on the server. Practice boards (`?board=`) never unlock anything.

**Where things live** (all under `Dokubolaget/src/theme/`):

- `themes/*.ts`: one token file per theme (colours, fonts, radii, flags, confetti, unlock rule, Swedish and English flavour copy).
- `registry.ts`: the theme list, the default theme and the UI language.
- `unlocks.ts` and `themeState.ts`: unlock rules and the theme part of the MobX model.
- `fonts.ts`: fonts per theme, loaded on demand from `@expo-google-fonts/*` (OFL).
- `decorations/`: per-theme artwork behind screens and above the celebration.

**Adding a theme:**

1. Add a token file and list it in `registry.ts`.
2. Add a font loader entry to `fonts.ts`.
3. Optionally, register decorations in `decorations/index.ts`.
4. Add its id to `THEME_IDS` in `types.ts` (the API validates against it).

Then run the checks:

```bash
cd Dokubolaget && bun test src                                   # tokens, contrast (WCAG AA), unlock rules
node tools/themeScreens.mjs --theme <id> --out /tmp/shots/<id>   # screenshots of every screen (needs the web dev server + proxy)
```

### Club themes and unlock codes

Student pub clubs get their own theme, unlocked by scanning a QR code at their pub. Club themes are data, not app code: each one is a folder in `club-themes/<slug>/` (repo root) with a `theme.json` and an optional `logo.png` or `logo.webp`. The server loads them into the database when it starts, so adding or changing a club is a commit and a deploy, not an app release. Bump `version` in `theme.json` whenever you change one, or the server keeps the old copy.

Manage codes with the admin script. In the container:

```bash
docker exec dokubolaget bun run admin themes check            # validate every club theme folder
docker exec dokubolaget bun run admin themes list             # loaded club themes and how often they were scanned
docker exec dokubolaget bun run admin codes create club-qmisk --label "Bar poster"
docker exec dokubolaget bun run admin codes create club-tmeit --label "Tentagasque" --expires 2026-10-10T03:00:00+02:00 --max-uses 300
docker cp dokubolaget:/data/qr ./qr                           # the QR images for the posters
docker exec dokubolaget bun run admin codes list
docker exec dokubolaget bun run admin codes revoke 3          # e.g. a poster code that leaked
```

A code is shown once, when it's made; the database only keeps its hash. To replace a leaked code, revoke it and make a new one. Players who already unlocked the theme keep it. `codes create` needs `PUBLIC_URL`, because the QR code links to `PUBLIC_URL/scan/<code>`. Locally, run the same commands with `bun run admin …` from `Dokubolaget/` (they use `data/local.sqlite`).

## File structure (with `Dokubolaget` as root)

### `/assets`

Contains fonts, vector icons and the logo

### `/data`

- `board-tags.json` - Viable board categories based on API fields
- `generated-boards.json` - fallback boards if the parsing on Github Cloud fails.
- 

### `/scripts`

The 3-step (+1) board pipeline run nightly by `server.js` inside the Docker container (also runnable locally). See [README](Dokubolaget/scripts/README.md) for full usage.

- `findTags.ts` - Step 1: mines viable tags from `products.json` and writes `data/board-tags.json`
- `generateBoard.ts` - Step 2: picks 3x3 boards from viable tags and writes `data/generated-boards.json`
- `confirmBoard.ts` - Step 3 (dev only): recomputes and prints the exact solution count for each of the 9 cells of a generated board
- `seedBoards.ts` - Step 4: stores the generated board(s) in the app database at their dates (`DB_PATH`)
- `README.md` - script-by-script usage, flags, and recommended daily run
- In production the pipeline is scheduled by `server.js`; check `GET /healthz` or the container logs for the last run.

### `/src`

- `boardTags.ts`- generates and maintains tags used for boardgeneration
- `categories.js`- Handles the different category data used on the board
- `dokuModel.ts`- Model that stores data relevant for the gameplay and functionality of the app
- `api.ts` - Client for the container's `/api`
- `serverSync.ts` - Keeps the logged-in player's theme, unlocks and today's progress in step with the server
- `mobxReactiveModel.ts`- reactive model
- `resolvePromise.tsx`- promise resolution for API
- `systembolagetCache.ts` - Reads the Systembolaget API key cached by the server
- `systembolagetSource.tsx` - Wraps the Systembolaget API: handles the API key (env/cache/storage), CORS proxy on web, and exposes search helpers used by the model
- `../server.js` - Production server: static web build + Systembolaget proxy + nightly board seeding in one process
- `../devProxy.js` - Standalone CORS proxy for local development only
- `utilities.ts`- not relevant, disregard

### `/src/app`

- `_layout.tsx` - App root, also loads custom fonts
- `search.tsx` - For opening the searchView stacked on the app when looking for products in-game

### `/src/app/(tabs)`

- `_layout.tsx` - Tabs root
- `gameplay.tsx` - Tab for `gameplayView`
- `index.tsx` - Tab for `indexView` (homepage)
- `leaderboard.tsx` - Tab for `leaderboardView`

### `/src/reactjs` (presenters)

- `authPresenter.tsx` - Handles the data relevant to login 
- `gameplayPresenter.tsx` - Handles the data relevant to gameplay and sends it down to the gameplayView 
- `indexPresenter.tsx` - Handles data relevant to indexView
- `leaderboardPresenter.tsx` - Handles data relevant to leaderboardView, leaderboardFormView and leaderboardResultView
- `searchPresenter.tsx` -Handles data relevant to the search functionality and searchView.

### `/src/views`
  
- `authDialogView.tsx` - The content that is displayed when performing login/sign up. Is displayed as a dialog in indexView
- `gameplayView.tsx`- The content that is displayed for gameplay, handles events that are relevant to gameplay.
- `indexView.tsx`- The content that is displayed on indexpage, handles authentication and displays the leaderboard
- `leaderboardFormView.tsx`- The content relevant for setting preferd style of leadreboard data
- `leaderboardResultView.tsx`- The content that is relevant for the resulting leaderboard data
- `leaderboardView.tsx`- The compounded content of the leaderboard result and form view
- `searchView.tsx`- The content relevant for searching for data in the API during gameplay.