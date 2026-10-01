# Own Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Firebase with an API and a SQLite database inside the existing single container.

**Architecture:** Bun-native TypeScript modules under `Dokubolaget/server/`. `api.ts` is a pure `handle(request) → response` function so it can be tested without HTTP. `server.js` adapts Node HTTP to it. The app talks to `/api` through `src/api.ts`, and `src/serverSync.ts` replaces `firestoreModel.ts`.

**Tech Stack:** Bun (`bun:sqlite`, `Bun.password` argon2id, `bun test`), nodemailer (reset emails), Expo/React Native web, MobX.

**Spec:** `docs/superpowers/specs/2026-10-01-own-backend-design.md`

## Global Constraints

- No Firebase package, import or request remains anywhere.
- Error codes are exactly: `email_taken`, `nickname_taken`, `weak_password`, `bad_nickname`, `bad_email`, `bad_credentials`, `unauthorized`, `forbidden_origin`, `rate_limited`, `not_found`, `too_large`, `bad_request`, `invalid_token`.
- Sessions last 90 days and reset tokens 1 hour. Passwords need at least 8 characters. Nicknames are 2–24 characters with no `@ < >`, and are unique regardless of case.
- Tokens are stored only as SHA-256 hashes.
- Commits carry no AI attribution.
- The type check stays at the existing baseline. That baseline is re-measured at the start, because removing Firebase types may change it.

## Review Focus

1. **Login by email ignores case:** signing up as `A@x.se` and logging in as `a@x.se` must work.
2. **Expired sessions stop working:** after 90 days, `/api/me` returns `user: null` and the row is cleaned up.
3. **A reset token works once:** reuse gives `invalid_token`, and a successful reset logs out every other session.
4. **Unlocks are never lost:** saving prefs from a device with fewer unlocks must not remove any.
5. **Changes come only from the app's own origin:** a state-changing request from another origin is rejected, and a request with no `Origin` header is allowed only from a non-browser client, using `Sec-Fetch-Site` when it is present.

## Tasks

### Task 1: `server/db.ts`: open the database and run migrations
- **Produces:** `openDb(path: string): Database`, which runs the migrations, turns on WAL and foreign keys, and creates every table in the spec. Also `nowIso()`.
- **Tests (`server/db.test.ts`):**
  - running migrations again does nothing
  - every table exists
  - `PRAGMA foreign_keys` is on
- **Then:** change `package.json`'s `test` script to `bun test src server`.

### Task 2: `server/auth.ts`: accounts, sessions and password reset
- **Produces:**
  - `signup(db, {email, password, nickname})`, which returns `{userId, token}` or throws `ApiError`
  - `login(db, {email, password})`, which returns `{userId, token}`
  - `sessionUser(db, token)`, which returns the user or null and deletes expired sessions
  - `logout(db, token)`
  - `createResetToken(db, email)`, which returns `{token, userId} | null`
  - `resetPassword(db, token, password)`
  - `setNickname(db, userId, nickname)`
  - `RateLimiter` with `hit(key, limit, windowMs)`, returning a boolean
  - `ApiError(status, code)`
- **Tests (`server/auth.test.ts`):**
  - signup works, and a duplicate email (in any case) is rejected
  - a duplicate nickname (in any case) is rejected
  - weak passwords are rejected
  - bad nicknames are rejected, including email-like ones
  - bad emails are rejected
  - login works, with case-insensitive email
  - a wrong password or unknown email gives `bad_credentials`
  - expired sessions return null
  - logout invalidates the session
  - a reset token works once, expires after 1 hour, and the reset ends other sessions
  - the rate limiter's window works

### Task 3: `server/boards.ts` and `scripts/seedBoards.ts`
- **Produces:**
  - `putBoard(db, date, board)`
  - `getBoard(db, date, today)`, which returns the board or null and refuses dates after `today`
  - `seedBoards(db, boards, startDate, days)`, which assigns boards round-robin, just like the old seeder
- **Tests:**
  - a board round-trips
  - future dates give null
  - seeding over several days cycles through the boards
- **Script:** `scripts/seedBoards.ts` takes the same CLI flags as the old seeder (`--date --days --boards-file`) and writes to `DB_PATH`.

### Task 4: `server/api.ts`: the router
- **Produces:** `createApi({db, mail, sbKey, now, trustProxy, devOrigins})`, which returns `handle(req: ApiRequest): Promise<ApiResponse>`.
  - `ApiRequest` is `{method, path, headers, body: string, ip}`.
  - `ApiResponse` is `{status, headers, body}`.
- **Covers:** every route in the spec, the cookie, the origin and CSRF check, JSON parsing, the 64 KB limit, and the rate limits.
- **Tests (`server/api.test.ts`), driven entirely through `handle`:**
  - signup sets a cookie, and `/api/me` with that cookie returns the user
  - logout clears it
  - a wrong `Origin` gives 403
  - a request that isn't JSON gives 400
  - the 11th login in a minute gives 429
  - `reset-request` answers `ok` even for an unknown email, and the mail stub receives a link only when the account exists
  - a reset through the API works
  - prefs: theme ids are validated and unlocks are merged
  - progress is saved and returned for the matching date only, and anything over 64 KB gives 413
  - boards: today's is readable and tomorrow's gives 404
  - `/api/leaderboard` returns `{rows: []}`

### Task 5: `server/mail.ts`, `server/sbKey.ts` and `server/backup.ts`
- **`createMailer(env)`:** when `SMTP_URL` is set it sends through nodemailer; otherwise it logs the link.
- **`createSbKey(db, fetchFn)`:** scrapes the key and caches it for 12 hours. Its tests use a stubbed `fetchFn` whose HTML points to a bundle containing `NEXT_PUBLIC_API_KEY_APIM:"…"`.
- **`backupDb(db, dir, date)`:** runs `VACUUM INTO` and keeps the newest 7 copies. Tested in a temporary directory.

### Task 6: wire up the server and Docker
- **`server.js`:**
  - `/api/*` goes through `createApi`, adapted from Node HTTP, with the body read up to 64 KB
  - development CORS for localhost origins with credentials
  - the CSP drops `*.googleapis.com`
  - seeding calls `seedBoards` and no longer needs credentials
  - a backup runs after each seeding run
- **Dockerfile:**
  - the runtime installs `nodemailer`
  - it copies `server/`
  - `DB_PATH=/data/dokubolaget.sqlite`
  - `/data` is owned by the `bun` user
- **Compose:** a named volume at `/data`.
- **`.env.example`:** gets the SMTP variables and loses the Firebase ones.

### Task 7: the app moves to the API
- **`src/api.ts`:** a fetch client.
- **`src/serverSync.ts`:** `connectToServer(model, reaction)`, with debounced saves of prefs and progress.
- **The model:** gains `account`, set through `setAccount`.
- **`authPresenter` and `utilities`:** call the API.
- **The login dialog:** friendly error text, plus "Forgot password?".
- **New route `src/app/reset-password.tsx`:** takes the new password.
- **Home:** reads `model.account`.
- **The leaderboard:** shows a placeholder.
- **`systembolagetSource`:** reads the cached key through `/api/sb-key`.
- **`dokuModel`:** fetches boards through `/api/boards`.
- **Tests:** an `src/api.test.ts` covering the error-code-to-message mapping.

### Task 8: remove Firebase
- **Packages:** remove `firebase` and `firebase-admin`.
- **Files:** delete the Firebase files listed in the spec.
- **Checks:** `grep -ri firebase src server scripts` shows nothing that matters.
- **Docs:** update the README sections on deploying, the Firestore rules and the scripts.

### Task 9: verify
- **Browser check (dev server plus local API):**
  - sign up, reload and stay logged in
  - change the theme and see it on a second profile after logging in there
  - log out
  - request a reset and use the link from the log
- **Container check:** rebuild with a volume, sign up, `docker restart`, still logged in, and seeding writes today's board.
- **Final review:** done by a fresh reviewer.
