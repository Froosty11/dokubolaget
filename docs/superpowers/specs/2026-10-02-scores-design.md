# Scores, the daily rhythm and the archive

Status: draft, awaiting the owner's review (2026-10-02)

This is sub-project 1 of 5 from the pre-launch UX review (`docs/superpowers/reviews/2026-10-02-ux-review.md`). The five sub-projects are:

1. scores and the daily rhythm (this spec)
2. store readiness
3. the UX fix pass
4. Swedish and English
5. extras: reminders, themed icons, club rankings, friends, compare with a friend

## Goal

Make Dokubolaget a game people come back to every day. Today it's missing the basics:
- a real score
- a Hi-score tab with real data in it
- streaks
- boards that stay put
- something to do after finishing

Success means:
- After finishing, a player sees a score that means something: rarer bottles score more. They can share it as text or as an image, and they can see what everyone else picked.
- The Hi-score tab ranks real players today, this week, all time and by streak.
- Finishing 7 boards in a row unlocks Modern, the Systembolaget look. Modern stays a reward you earn.
- A player never loses a half-done board to a restart, a deploy or an early rollover.
- Picks are verified by the server, so a score can't be faked.
- Past boards can be browsed and played as practice.

Review findings this covers:
- **Scores:** S1–S9
- **Game:** G1 (How to play), G9 (share)
- **Themes:** T2 (lost unlock announcements) and T3 (part: Modern hint)
- **Accounts:** A6 (part: the board after login)

## Decisions already made

- **Guesses are unlimited.** Each miss in a cell takes 10 off that cell's score, but a solved cell never scores below 10.
- **Rarity scoring.** A solved cell is worth more the fewer players picked the same bottle. The formula is below.
- **Scores are live and final at 04:00.** A provisional score shows straight away and is frozen when the day ends.
- **A game day runs 04:00–04:00 Europe/Stockholm.** A night out counts as one day.
- **Logged-out players get a score but aren't ranked.** Their picks count toward rarity anonymously. Logging in later the same day moves today's board onto the account.
- **The Hi-score tab ranks Today, This week, All time and Streaks.**
- **Only the shelf ranges count.** Playable products are those in Fast sortiment, Lokalt & Småskaligt and Säsong: about 7,450 of the catalogue's 27,295. Ordervaror (16,619), Tillfälligt sortiment (3,120) and Webblanseringar (111) are excluded from search, guesses, answer counts and rarity.
- **History counts toward rarity.** Earlier boards with the same two categories feed into rarity, so scores are sensible from the first player of the day. The owner proposed this.
- **Also in this sub-project:** a share image, a link to the bottle, the archive of previous days, unicorn picks and per-cell stats.
- **Postponed to sub-project 5:** club rankings, friends, compare with a friend, and reminders. Players will be linked to clubs through the stamps they already collect by scanning: each player picks one "home club" from their stamps.

## Rules

### The game day

`gameDay(now)` is the Europe/Stockholm calendar date of `now − 4 hours`, formatted `YYYY-MM-DD`.
- It's a pure function in `src/` that both the app and the server use.
- It handles summer time through `Intl.DateTimeFormat` with `timeZone: "Europe/Stockholm"`.
- Everything that used to say "today" uses it: boards, progress, rate windows, the nightly job and the rollover check in the app.
- `nextRollover(now)` gives the next 04:00 in Stockholm, for the countdown.

### Playable products

`isPlayable(product)` is true when `assortmentText` is one of `Fast sortiment`, `Lokalt & Småskaligt` or `Säsong`. It's a pure function in `src/` and is applied in four places:

| Where | Effect |
|---|---|
| App search | Products that aren't playable are dropped from results. |
| Server guess check | A product that isn't playable is rejected with `not_playable`. |
| Board generator (`scripts/generateBoard.ts`, nightly seed) | Answer counts per cell (`V`) count only playable products. A cell needs at least 5 playable answers. |
| Bundled boards (`data/generated-boards.json`) | Recounted. A board with any cell under 5 is dropped from the pool. |

### Cell score

For a solved cell:

```
pct   = (t_b + ½·h_b + k/V) / (t + ½·h + k)
score = max(10, round(100 − 100·pct) − 10·misses)
```

The terms:
- `t_b` is the number of today's players who solved this cell with this bottle, you included.
- `t` is the number of today's players who solved this cell.
- `h_b` and `h` are the same counts across every earlier day whose board had the same pair of categories, in either order. Practice play on past boards counts here as well.
- `k = 3` is a neutral prior spread over the cell's `V` playable answers.
- `misses` is the number of wrong guesses in this cell.

An unsolved cell scores 0, so a board scores at most 900.

The formula is a pure function in `src/scoring.ts`. Without the prior, the first solver of a new pair would score `max(10, 0)`. With it, the first solver of a pair with 200 answers scores about 75, and the score settles as people play.

### Unicorns

A solved cell is a **unicorn** when nobody else, today or on an earlier day with the same pair, picked that bottle (`t_b = 1` and `h_b = 0`).
- During the day it shows as "Unicorn (so far)".
- The 04:00 freeze confirms it.
- It's a badge only and doesn't change the score.

### Finished, perfect and streaks

- **Finished:** all 9 cells solved before 04:00.
- **Perfect:** finished with no misses.
- **Streak:** the number of consecutive game days with a finished board. It's counted for logged-in players, from the server's records.
  - The current streak stays alive through today until 04:00 as long as yesterday was finished.
  - The longest streak is the best run ever.

### Unlocks, granted by the server

The server records these in `prefs.unlocked_themes` the moment the board is verified, and the guess response includes `newUnlocks` so the app can announce them.

| Theme | Earned by |
|---|---|
| Cyberwave | your first finished board |
| Speakeasy | your first perfect board |
| Modern (the Systembolaget look) | a longest streak of 7 |

- `PUT /api/me/prefs` stops accepting these three IDs. It still accepts club theme IDs, since those come from scans and are cosmetic.
- A player who isn't logged in keeps earning Cyberwave and Speakeasy on their own device. When they log in, the claim (see Endpoints) checks the device's own records before copying them to the account.
- On every start, the app compares the account's unlocks with a list it keeps of unlocks already announced, and shows any it hasn't announced yet (fixes T2).

### Stable boards

- **No overwriting:** a board is never regenerated once its game day has started. `putBoard` refuses to overwrite such a date, and the startup seed only creates missing days, never today.
- **Generated ahead:** the nightly job keeps the next 3 days generated.
- **The app waits for the server's board:**
  - It shows a short loading state on a cold start instead of swapping boards.
  - It stops a second, accidental swap from happening.
  - The board is cached on the device once fetched.
- **Offline with nothing cached:** the app falls back to the bundled pool. The board is labelled **"Practice (offline)"**, and guesses on it aren't sent and don't score.

## Server

### Catalogue

`server/catalog.ts` loads `products.json`, keeps only playable products and indexes them by `productId`. It reloads after each nightly catalogue download.
- **A product the mirror doesn't have yet** (a new release) is looked up once from Systembolaget through the same upstream the proxy uses, then cached for the day.
- **An unknown or non-playable product** is rejected.

The tag matcher (`src/boardTags.ts` `doesProductMatchTagId`) is shared with the app unchanged.

### Identity

Every request from the app carries `X-Doku-Device: <uuid v4>`. This is a random ID, created once on each device and kept there; it contains no personal data. The player is:
- the logged-in user, if there's a session
- otherwise the device

### Tables (migration 3)

```sql
CREATE TABLE cell_results (
  day TEXT NOT NULL,            -- game day
  player TEXT NOT NULL,         -- 'u:<userId>' or 'd:<deviceId>'
  cell INTEGER NOT NULL,        -- 1..9
  pair_key TEXT NOT NULL,       -- the two tag ids, sorted, joined by '|'
  product_id TEXT,              -- null until solved
  misses INTEGER NOT NULL DEFAULT 0,
  practice INTEGER NOT NULL DEFAULT 0,  -- 1 for archive play
  solved_at TEXT,
  PRIMARY KEY (day, player, cell, practice)
);
CREATE INDEX cell_results_pair ON cell_results (pair_key, product_id);
CREATE INDEX cell_results_day ON cell_results (day, cell, product_id);

CREATE TABLE daily_scores (
  day TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  solved INTEGER NOT NULL,
  misses INTEGER NOT NULL,
  unicorns INTEGER NOT NULL,
  finished INTEGER NOT NULL,
  perfect INTEGER NOT NULL,
  PRIMARY KEY (day, user_id)
);
```

- **Who's counted:**
  - Practice rows count toward history (`h`) but never toward `t`, scores or streaks.
  - A practice row is ignored for history when the same player solved that cell for real on that day, so nobody is counted twice.
  - Rarity counts every player, logged in or not.
- **Account deletion** also deletes that user's `cell_results` rows. The `daily_scores` rows go by cascade.

### Endpoints

All of these use the same JSON and write checks as the existing API.

| Route | What it does |
|---|---|
| `POST /api/play/guess` `{day, cell, productId, practice?}` | Rules on one guess. `day` must be today, or a past day when `practice` is set. Checks: the product is playable, it matches both of the cell's tags, the cell isn't already solved, and the product isn't used in another cell of this board. Returns `{verdict: "correct"\|"near"\|"miss"\|"rejected", reason?, matchedTagId?, cell: {score, pct, unicorn}, board: {score, solved, misses}, newUnlocks}`. A miss increments `misses`. A "rejected" verdict (already used, not playable) changes nothing. |
| `GET /api/play/today` | Your cells for today (product, misses, score, pct, unicorn), the board total, and whether you've finished. Device and account rows are merged cell by cell. |
| `GET /api/play/answers?day=` | Per cell: the top 5 bottles with percentages, the rarest solved bottle, your pick, and the percentage of players who solved the cell. For today it's only available once you've finished. For past days it's always available. |
| `POST /api/play/claim` | Called right after login or sign-up. Moves today's `d:` rows onto `u:`, cell by cell, skipping cells the account already has. It also grants board unlocks that the device's own records support. |
| `GET /api/leaderboard?period=today\|yesterday\|week\|all\|streak` | Top 50 plus your own row with your rank. Today is computed live; the other periods use `daily_scores`. This week runs from Monday 04:00 Stockholm and includes today's provisional score. All time counts final scores only. Streak ranks by current streak, then by longest. |
| `GET /api/archive?month=YYYY-MM` | Every past day in that month that has a board, plus your result (score, finished, perfect) if you have one. |
| `GET /api/archive/:day` | That day's board, your cells and the answers. |
| `GET /api/me` | Gains `stats: {currentStreak, longestStreak, finishedCount, unicorns}`. |

- **Retired:** `PUT /api/me/progress` and the `progress` table, after a release where the app no longer calls them. The old leaderboard stub is replaced.
- **Rate limits:**
  - Guesses: 120 per minute per player, plus a loose 1,200 per minute per IP, because a whole pub shares one address.
  - Reads: the general limits.
- **Caching:** for today, the per-(cell, product) counts are cached in memory for 30 seconds, so the Hi-score and the answers stay cheap.

### The nightly job at 04:00 Stockholm

This replaces the 00:05 UTC schedule:
1. Freeze the day that just ended: write `daily_scores` for every user with a solved cell, using the final counts.
2. Recompute streaks. They're derived from `daily_scores`, so nothing extra is stored.
3. Download the catalogue, reload `server/catalog.ts`, and generate any missing boards for the next 3 days.

It's idempotent: running it twice gives the same result. If the server was down at 04:00, it runs at startup for any days that haven't been frozen.

## App

### Guesses and syncing

- **Judging:** guesses are still judged on the device first, so feedback stays instant and works offline. Each guess goes into an **outbox** saved in AsyncStorage and is sent in order when there's a connection.
- **If the server disagrees** (rare: catalogue drift), the cell goes back to empty with "Couldn't verify that pick. Try another bottle." The server's verdict wins.
- **Board state:**
  - The board comes from `GET /api/play/today` merged with the outbox.
  - It refreshes on start, on login, and when the app comes back to the front, which fixes the two-device issue S9.
  - The whole-board blob sync is removed.
  - On the device, the app keeps only this game day's outbox, the "tried" list and the cached board.
- **Rollover:** when the app notices the game day has changed, it loads the new board. If the old one wasn't finished, it shows a toast: "New board! Yesterday's ended at 540 points."

### Board and results

- **Score badges:** each solved cell gets a small score badge in the theme's style, with 🦄 for unicorns.
- **Header stats:** after finishing, each header shows the share of today's players who solved its cell.
- **Results panel:** once the board is finished, a panel stays below it. It contains:
  - the score and misses, marked "Provisional until 04:00" or "Final"
  - your rank today, if you're logged in
  - a countdown to the next board
  - **Share**
  - **See today's answers**
  - **Previous days**
  - for logged-out players: "Log in to get on the Hi-score and keep a streak"
- **The finish celebration** stays as the one-off moment, and its share buttons use the new share flow.
- **Today's answers:** a sheet with, per cell, the top picks and their percentages, the rarest pick, and your pick highlighted. Each bottle links to Systembolaget.

### Sharing

**Text:**

```
Dokubolaget 2 Oct · 712/900 · 2 misses
🟪🟩🦄
🟩🟨🟪
🟪🟩⬛
dokubolaget.se
```

The squares show the cell score: 🟪 80+, 🟩 50–79, 🟨 under 50, ⬛ unsolved, 🦄 unicorn. The wording follows the UI language, which sub-project 4 decides. Until then it's English.

**Image:**
- A `ShareCard` component draws your board in the current theme: logo, date, score, misses, the grid and `dokubolaget.se`.
- In the app it's captured with `react-native-view-shot` and opened with `expo-sharing`, so it reaches stories and chats.
- On the web it's shared through `navigator.share({files})` where supported, which includes iPhone Safari. Otherwise the image downloads and the text is copied.
- Cancelling the share sheet shows no error (G9).

### Link to the bottle

- **The link:** "View on Systembolaget" opens the product page, built from the product number. The plan confirms the exact URL format; a search URL is the fallback.
- **When it shows:** in the info sheet for a solved cell, in the answers, and in the archive. It never appears for an unsolved cell on today's board, because the page shows the facts the cell asks about.

### Archive (Previous days)

- **Where:** a new `/archive` screen, opened from Home and from the results panel.
- **The calendar:** a month view, starting from the first board and ending yesterday. Each day is marked:
  - not played
  - played (with your score)
  - finished
  - perfect
- **A day:** the board with your picks, your score and the answers.
- **Practice play:** "Play this board" opens practice mode, with the same board UI and a "Practice" label. Guesses are checked by the server with `practice: true`; they feed rarity history but never scores or streaks.
- **Logged-out players:** they see the calendar and answers, and their device's own results.

### Hi-score tab

- **Layout:**
  - Four tabs: **Today · Week · All time · Streaks**. Today can also show yesterday's final results.
  - The old dropdown filters are removed.
  - Rows show rank, nickname and score (or streak days).
  - Your row is highlighted, and pinned at the bottom if you're outside the top 50.
- **Labels:** Today is marked "Provisional until 04:00".
- **States:**
  - loading
  - empty: "No finished boards yet today. Be the first!"
  - error, with a retry
  - logged out, with a login banner
- **The page title** follows the theme's tab label.

### How to play

The new text, in three short points:
1. **Fill the grid.** Find a bottle that matches both its row and its column. Only bottles from Systembolaget's regular, local and seasonal ranges count.
2. **Rarer scores more.** The fewer players who picked your bottle, the more it's worth. Each miss costs 10 points.
3. **A new board every day at 04:00.**

It opens automatically once per device (remembered in AsyncStorage), and again from the help icon on the board.

### Themes

- **The Modern card:** "Log in and finish 7 boards in a row", with real progress (for example 3/7) from `stats`.
- **The streak line in the picker** comes from `stats` instead of a hard-coded 0.

## Error handling

- **Server down or offline:**
  - Guesses wait in the outbox.
  - The results panel shows "Score pending, waiting for connection".
  - The Hi-score and archive show their error state with a retry.
- **Outbox reaches a new day:** guesses for a game day that has already ended are dropped, with a toast if any were pending.
- **Rejected guesses:**
  - `not_playable`: "That bottle isn't on the regular shelves, try another."
  - `already_used`: names the cell by its two headers, which fixes G7.
- **The nightly job fails partway:** it's idempotent and runs again on startup for any day that wasn't frozen.

## Testing

- **Pure unit tests:**
  - `gameDay` and `nextRollover`, including both summer-time changes and the 03:59/04:00 boundary
  - `isPlayable`
  - the score formula: the prior, history weighting, misses and the floor
  - unicorn detection
  - streak computation from `daily_scores` rows
- **Server tests (`bun test`):**
  - the guess endpoint for each verdict and rejection
  - the cell-by-cell merge and claim
  - the leaderboard periods and your own row
  - archive month and day
  - the nightly freeze, including idempotency and catching up on startup
  - `putBoard` refusing to overwrite a day that has started
  - unlock grants, and the prefs endpoint refusing the three earned themes
  - the migration from version 2
- **App unit tests:**
  - the outbox: ordering, persistence, dropping guesses at the day boundary, and reverting on disagreement
  - announcing unannounced unlocks
- **End to end:**
  - Headless Chrome at phone size: play a board to the end, then check the results panel, the answers, the share text, the Hi-score tabs and the archive.
  - Argent on the Android emulator and iOS simulator: the same flow plus the native share sheet with the image.

## Out of scope (later sub-projects)

- **Sub-project 2:** the privacy page (it will mention the device ID), the age gate copy, nickname rules, app links.
- **Sub-project 3:** the rest of the UX review.
- **Sub-project 4:** the Swedish UI.
- **Sub-project 5:** club rankings (home club from stamps), friends, compare with a friend, daily reminders, themed icons.
