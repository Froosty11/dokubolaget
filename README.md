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

The whole thing runs as a single container: the static web build, the Systembolaget proxy (same origin, `/proxy?url=`, locked to `systembolaget.se` hosts) and the nightly board pipeline that writes tomorrow's board to Firestore. See `Dokubolaget/server.js`.

```bash
cp .env.example .env      # paste the Firebase service account JSON on one line
docker compose up -d --build
```

The container listens on port 8080 (change the host port with `PORT` in `.env`). Put a TLS reverse proxy such as Caddy in front of it for `https://dokubolaget.se`.

- With no `FIREBASE_SERVICE_ACCOUNT_KEY` set, the app still runs and plays the bundled fallback boards.
- On boot the container seeds today's and tomorrow's board, then runs every night at 00:05 UTC. `GET /healthz` shows the last run.
- After moving domains, add the new domain under **Authentication → Settings → Authorized domains** in the Firebase console or login will fail.
- To point the web build at a different Firebase project, set the `EXPO_PUBLIC_FIREBASE_*` build args in `.env` and rebuild.

## File structure (with `Dokubolaget` as root)

### `/assets`

Contains fonts, vector icons and the logo

### `/data`

- `board-tags.json` - Viable board categories based on API fields
- `generated-boards.json` - fallback boards if the parsing on Github Cloud fails.
- 

### `/scripts`

The 3-step (+1) board pipeline run nightly by `server.js` inside the Docker container (also runnable locally). See [README](Dokubolaget/scripts/README.md) for full usage and [SEED-BOARD-PROD-SETUP.md](Dokubolaget/scripts/SEED-BOARD-PROD-SETUP.md) for the production enablement checklist.

- `findTags.ts` - Step 1: mines viable tags from `products.json` and writes `data/board-tags.json`
- `generateBoard.ts` - Step 2: picks 3x3 boards from viable tags and writes `data/generated-boards.json`
- `confirmBoard.ts` - Step 3 (dev only): recomputes and prints the exact solution count for each of the 9 cells of a generated board
- `seedFirestoreBoard.ts` - Step 4: uploads the generated board(s) to Firestore at `boards/{YYYY-MM-DD}` (used by CI and ad-hoc seeding)
- `README.md` - script-by-script usage, flags, and recommended daily run
- `SEED-BOARD-PROD-SETUP.md` - end-to-end checklist for enabling the nightly cron in production
- In production the pipeline is scheduled by `server.js`; check `GET /healthz` or the container logs for the last run.

### `/src`

- `boardTags.ts`- generates and maintains tags used for boardgeneration
- `categories.js`- Handles the different category data used on the board
- `dokuModel.ts`- Model that stores data relevevant for the gameplay and functionality of the app (persisted to Firebase if logged in)
- `firebaseConfig.ts`- firebase config file
- `firebaseModel.ts`- firebase file for model data on server
- `mobxReactiveModel.ts`- reactive model
- `resolvePromise.tsx`- promise resolution for API
- `systembolagetCache.ts` - Reads/writes the Systembolaget API key in Firestore so all clients can share a working key without redeploying
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