// Production server for Dokubolaget. One process does three jobs:
//
//   1. Serves the static Expo web build from ./dist
//   2. Proxies browser requests to Systembolaget on /proxy?url=... so the web
//      app can call their API without CORS trouble. Only the few Systembolaget
//      URLs the app needs are allowed (see proxyPolicy.js), so this is not an
//      open relay.
//   3. Runs the daily board pipeline (download catalog → find tags → generate
//      board → store in SQLite) once a day on a timer.
//   4. Serves the app's API on /api (accounts, saved prefs and progress,
//      boards; see server/api.ts) backed by one SQLite file, which is backed
//      up nightly.
//
// Runs under Bun (used in the Docker image): it loads the TypeScript modules
// in ./server directly.
//
// Environment:
//   PORT                          listen port (default 8080)
//   DB_PATH                       SQLite file (default ./data/local.sqlite)
//   PUBLIC_URL                    base URL for links in emails (default: request origin)
//   SMTP_URL / MAIL_FROM          send password reset emails (else logged)
//   SEED_ENABLED                  "false" to disable the nightly pipeline
//   SEED_ON_START                 "false" to skip the seed run at boot
//   SEED_ATTEMPTS                 generator attempts per board (default 3000)
//   CATALOG_URL                   product catalog source (default susbolaget)
//   TRUST_PROXY                   "true" when behind a reverse proxy, so rate
//                                 limiting keys on X-Forwarded-For
//   PROXY_RATE_LIMIT              proxy requests per client per minute (default 120)

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable, Transform } = require("node:stream");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const {
  isAllowedProxyTarget,
  proxiedContentType,
  PROXY_RESPONSE_HEADERS,
} = require("./proxyPolicy");
const { clientAddress } = require("./server/net.ts");

const APP_ROOT = __dirname;
const DIST_DIR = path.join(APP_ROOT, "dist");
const PRODUCTS_PATH = path.resolve(APP_ROOT, "..", "products.json");
const PORT = Number(process.env.PORT) || 8080;

const CATALOG_URL =
  process.env.CATALOG_URL || "https://susbolaget.emrik.org/v1/products";
const MIN_CATALOG_BYTES = 1_000_000;
const MAX_CATALOG_BYTES = 500_000_000;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(scope, message) {
  console.log(`${new Date().toISOString()} [${scope}] ${message}`);
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

// Returns null for paths that can't be decoded or that escape dist/.
const { resolveStaticFile: resolveInDist } = require("./server/staticRoutes.ts");

function resolveStaticFile(pathname) {
  return resolveInDist(DIST_DIR, pathname);
}

const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".map", ".svg", ".txt", ".webmanifest", ".ttf", ".otf"]);

function serveStatic(req, res, pathname) {
  const filePath = resolveStaticFile(pathname);
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const hashed = filePath.includes(`${path.sep}_expo${path.sep}`);
  const gzip =
    COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": hashed
      ? "public, max-age=31536000, immutable"
      : ext === ".html"
        ? "no-cache"
        : "public, max-age=3600",
    Vary: "Accept-Encoding",
    ...(gzip ? { "Content-Encoding": "gzip" } : {}),
    ...(ext === ".html" ? { "Content-Security-Policy": contentSecurityPolicy() } : {}),
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  const onError = (error) => {
    log("server", `Static stream failed for ${pathname}: ${error.message}`);
    res.destroy();
  };
  if (gzip) {
    pipeline(stream, zlib.createGzip(), res).catch(onError);
  } else {
    pipeline(stream, res).catch(onError);
  }
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

const BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

// Expo's static export puts a few small inline scripts in each HTML page (the
// router hydration flag, the service worker registration). Allow exactly those
// by hash, read from the built files once at startup.
function inlineScriptHashes() {
  const hashes = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) {
        const html = fs.readFileSync(full, "utf8");
        for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
          if (!match[1]) continue;
          const digest = crypto.createHash("sha256").update(match[1]).digest("base64");
          hashes.add(`'sha256-${digest}'`);
        }
      }
    }
  };
  walk(DIST_DIR);
  return [...hashes];
}

let cachedCsp = null;
function contentSecurityPolicy() {
  if (cachedCsp) return cachedCsp;
  cachedCsp = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes().join(" ")}`.trim(),
    // React Native Web injects its styles at runtime.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://product-cdn.systembolaget.se https://www.systembolaget.se https://flagcdn.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return cachedCsp;
}

// ---------------------------------------------------------------------------
// Systembolaget proxy
// ---------------------------------------------------------------------------

const DROPPED_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "cookie",
  "accept-encoding",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "forwarded",
]);

function forwardHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (DROPPED_REQUEST_HEADERS.has(name.toLowerCase())) continue;
    if (typeof value === "string") out[name] = value;
  }
  return out;
}

const MAX_PROXY_BYTES = 15_000_000;
const MAX_PROXY_REDIRECTS = 3;
const PROXY_TIMEOUT_MS = 15_000;
const PROXY_RATE_LIMIT = Number(process.env.PROXY_RATE_LIMIT) || 120;
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

// Fixed one-minute windows per client. Plenty for a player (a search is one
// request, key discovery is a few dozen once), tight enough to stop the proxy
// being used as free bandwidth.
const rateWindows = new Map();

function clientKey(req) {
  return clientAddress(req.headers, req.socket.remoteAddress, TRUST_PROXY);
}

function isRateLimited(req) {
  const now = Date.now();
  const key = clientKey(req);
  const current = rateWindows.get(key);
  if (!current || now - current.start >= 60_000) {
    rateWindows.set(key, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > PROXY_RATE_LIMIT;
}

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, window] of rateWindows) {
    if (window.start < cutoff) rateWindows.delete(key);
  }
}, 60_000).unref();

// Follows redirects by hand so every hop is checked against the allowlist.
async function fetchAllowed(target, init) {
  let url = target;
  for (let hop = 0; hop <= MAX_PROXY_REDIRECTS; hop++) {
    const response = await fetch(url, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }
    const next = new URL(location, url).toString();
    if (!isAllowedProxyTarget(next)) {
      throw new Error(`redirect to disallowed target ${next}`);
    }
    url = next;
  }
  throw new Error("too many redirects");
}

function byteLimit(max) {
  let seen = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      seen += chunk.length;
      if (seen > max) callback(new Error(`response larger than ${max} bytes`));
      else callback(null, chunk);
    },
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", ...PROXY_RESPONSE_HEADERS });
  res.end(JSON.stringify(body));
}

async function serveProxy(req, res, requestUrl) {
  // Same-origin only: the web app is served from this server, so no CORS
  // headers are sent and other sites can't read proxied responses.
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Only GET is proxied" });
    return;
  }

  if (isRateLimited(req)) {
    res.setHeader("Retry-After", "60");
    sendJson(res, 429, { error: "Too many requests" });
    return;
  }

  const target = requestUrl.searchParams.get("url");
  if (!target) {
    sendJson(res, 400, { error: "Missing required query param: url" });
    return;
  }

  if (!isAllowedProxyTarget(target)) {
    sendJson(res, 403, { error: "Target not allowed" });
    return;
  }

  try {
    const upstream = await fetchAllowed(target, {
      method: req.method,
      headers: forwardHeaders(req.headers),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (declaredLength > MAX_PROXY_BYTES) {
      throw new Error(`response larger than ${MAX_PROXY_BYTES} bytes`);
    }

    res.writeHead(upstream.status, {
      ...PROXY_RESPONSE_HEADERS,
      "Content-Type": proxiedContentType(upstream.headers.get("content-type")),
    });
    if (req.method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }
    await pipeline(Readable.fromWeb(upstream.body), byteLimit(MAX_PROXY_BYTES), res);
  } catch (error) {
    log("proxy", `Request for ${target} failed: ${error && error.message ? error.message : error}`);
    if (!res.headersSent) {
      sendJson(res, 502, { error: "Proxy request failed" });
    } else {
      res.destroy();
    }
  }
}

// ---------------------------------------------------------------------------
// API and database
// ---------------------------------------------------------------------------

const { openDb } = require("./server/db.ts");
const { createApi, MAX_BODY_BYTES } = require("./server/api.ts");
const { bundledBoardFor, getBoard, putBoard, seedBoards } = require("./server/boards.ts");
const { createMailer } = require("./server/mail.ts");
const { createSbKey } = require("./server/sbKey.ts");
const { backupDb } = require("./server/backup.ts");
const { loadThemePacks } = require("./server/themePacks.ts");
const { createCatalog, systembolagetLookup } = require("./server/catalog.ts");
const { createPlay } = require("./server/play.ts");
const { catchUpFreeze } = require("./server/stats.ts");
const { gameDay, nextRollover, addDays } = require("./src/gameDay.ts");

const DB_PATH = process.env.DB_PATH || path.join(APP_ROOT, "data", "local.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = openDb(DB_PATH);

const sbKey = createSbKey(db);
const catalog = createCatalog({ path: PRODUCTS_PATH, lookup: systembolagetLookup(sbKey) });
log("catalog", `${catalog.size} playable products loaded`);
const play = createPlay({ db, catalog });

// Club themes live in club-themes/<slug>/ next to the app (copied into the
// image). Loaded once at startup; a newer version replaces the stored one.
const CLUB_THEMES_DIR = process.env.CLUB_THEMES_DIR || path.join(APP_ROOT, "..", "club-themes");
const themeLoad = loadThemePacks(db, CLUB_THEMES_DIR, (line) => log("themes", line.replace(/^\[themes\] /, "")));
log("themes", `loaded ${themeLoad.loaded.length}, unchanged ${themeLoad.skipped.length}, broken ${Object.keys(themeLoad.errors).length} (${CLUB_THEMES_DIR})`);

const api = createApi({
  db,
  play,
  mail: createMailer(process.env),
  sbKey,
  trustProxy: TRUST_PROXY,
  // Development only (`bun run api`): the Expo dev server runs on another
  // localhost port. Never on in a deployed container.
  devOrigins: process.env.API_DEV_CORS === "true",
  publicUrl: process.env.PUBLIC_URL,
  supportUrl: process.env.SUPPORT_URL,
  contactEmail: process.env.CONTACT_EMAIL,
});

async function serveApi(req, res, requestUrl) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "too_large" }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  }
  const response = await api({
    method: req.method || "GET",
    path: requestUrl.pathname,
    query: requestUrl.search.slice(1),
    headers: req.headers,
    body: Buffer.concat(chunks).toString("utf8"),
    ip: clientKey(req),
  });
  res.writeHead(response.status, response.headers);
  res.end(response.body);
}

// ---------------------------------------------------------------------------
// Daily board seeding
// ---------------------------------------------------------------------------

const seedState = {
  enabled: false,
  running: false,
  lastRunAt: null,
  lastResult: null,
  lastError: null,
  nextRunAt: null,
};

function runStep(label, command, args) {
  return new Promise((resolve, reject) => {
    log("seed", `${label}: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: APP_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const forward = (stream, level) => {
      stream.on("data", (chunk) => {
        for (const line of chunk.toString().split("\n")) {
          if (line.trim()) console.log(`  ${level} ${line}`);
        }
      });
    };
    forward(child.stdout, "|");
    forward(child.stderr, "!");
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

async function downloadCatalog() {
  log("seed", `Downloading catalog from ${CATALOG_URL}`);
  const response = await fetch(CATALOG_URL, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Catalog download failed: HTTP ${response.status}`);
  }
  const tmpPath = `${PRODUCTS_PATH}.tmp`;
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_CATALOG_BYTES) {
    throw new Error(`Catalog too large (${declaredLength} bytes); aborting`);
  }
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      byteLimit(MAX_CATALOG_BYTES),
      fs.createWriteStream(tmpPath),
    );
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }
  const size = fs.statSync(tmpPath).size;
  if (size < MIN_CATALOG_BYTES) {
    fs.unlinkSync(tmpPath);
    throw new Error(`Catalog suspiciously small (${size} bytes); aborting`);
  }
  fs.renameSync(tmpPath, PRODUCTS_PATH);
  log("seed", `Catalog saved (${(size / 1e6).toFixed(1)} MB)`);
}

// Generates and stores `days` boards starting at `startDate` (a game-day string).
async function runSeedPipeline(startDate, days) {
  if (seedState.running) {
    log("seed", "A run is already in progress; skipping");
    return;
  }
  seedState.running = true;
  seedState.lastRunAt = new Date().toISOString();
  const attempts = process.env.SEED_ATTEMPTS || "3000";
  const start = startDate;

  try {
    await downloadCatalog();
    catalog.reload();
    await runStep("find tags", "bun", ["run", "scripts/findTags.ts", "--min-cell", "4"]);
    await runStep("generate boards", "bun", [
      "run",
      "scripts/generateBoard.ts",
      // Not the bundled pool (data/generated-boards.json), which stays the
      // fallback the app also uses offline.
      "--out",
      "data/nightly-boards.json",
      "--seed",
      start,
      "--boards",
      String(days),
      "--attempts",
      attempts,
    ]);
    const generated = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "nightly-boards.json"), "utf8"));
    seedBoards(db, generated.boards, start, days, gameDay());
    seedState.lastResult = `ok: ${days} board(s) from ${start}`;
    seedState.lastError = null;
    log("seed", seedState.lastResult);
  } catch (error) {
    seedState.lastResult = "failed";
    seedState.lastError = error && error.message ? error.message : String(error);
    log("seed", `FAILED: ${seedState.lastError}`);
    throw error;
  } finally {
    seedState.running = false;
  }
}

function runBackup() {
  try {
    const file = backupDb(db, path.join(path.dirname(DB_PATH), "backups"), gameDay());
    log("backup", `Wrote ${file}`);
  } catch (error) {
    log("backup", `FAILED: ${error && error.message ? error.message : error}`);
  }
}

const BOARDS_AHEAD = 3;

// Every day from today to BOARDS_AHEAD days out has a board. Missing days get
// the bundled pick (the app uses the same pick offline). Days that have
// started are never replaced.
function ensureBoardsAhead() {
  try {
    const pool = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "data", "generated-boards.json"), "utf8")).boards;
    const today = gameDay();
    for (let offset = 0; offset <= BOARDS_AHEAD; offset += 1) {
      const date = addDays(today, offset);
      if (!getBoard(db, date, "9999-12-31")) {
        putBoard(db, date, bundledBoardFor(date, pool), { today });
        log("seed", `Stored bundled board for ${date}`);
      }
    }
  } catch (error) {
    log("seed", `Bundled boards unavailable: ${error && error.message ? error.message : error}`);
  }
}

function freezeEndedDays() {
  try {
    const frozen = catchUpFreeze(db, play, gameDay());
    if (frozen.length) log("scores", `Froze ${frozen.join(", ")}`);
  } catch (error) {
    log("scores", `Freeze FAILED: ${error && error.message ? error.message : error}`);
  }
}

// 04:00 Stockholm: freeze the day that ended, refresh the catalogue and the
// coming boards, back up. A minute's margin so gameDay() has turned.
function scheduleNightly() {
  const at = nextRollover(new Date()).getTime() + 60_000;
  seedState.nextRunAt = new Date(at).toISOString();
  log("seed", `Next nightly run at ${seedState.nextRunAt}`);
  setTimeout(async () => {
    freezeEndedDays();
    if (seedState.enabled) {
      try {
        await runSeedPipeline(addDays(gameDay(), 1), BOARDS_AHEAD);
      } catch {
        log("seed", "Retrying in 30 minutes");
        setTimeout(() => runSeedPipeline(addDays(gameDay(), 1), BOARDS_AHEAD).catch(() => {}), 30 * 60 * 1000);
      }
    }
    ensureBoardsAhead();
    runBackup();
    scheduleNightly();
  }, at - Date.now());
}

function startSeeding() {
  freezeEndedDays();
  ensureBoardsAhead();
  if (process.env.SEED_ENABLED === "false") {
    log("seed", "Disabled via SEED_ENABLED=false; serving bundled boards");
  } else {
    seedState.enabled = true;
    if (process.env.SEED_ON_START !== "false") {
      // Fresh boards for the coming days only; today's is never replaced.
      runSeedPipeline(addDays(gameDay(), 1), BOARDS_AHEAD).catch(() => {});
    }
  }
  scheduleNightly();
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function handleRequest(req, res) {
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }

  let requestUrl;
  try {
    requestUrl = new URL(req.url || "/", "http://localhost");
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }

  if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")) {
    serveApi(req, res, requestUrl).catch((error) => handleRequestError(res, error));
    return;
  }

  if (requestUrl.pathname === "/proxy") {
    serveProxy(req, res, requestUrl).catch((error) => handleRequestError(res, error));
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    // Public, so it reports liveness only. Seed details go to the logs.
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, seedEnabled: seedState.enabled, seedRunning: seedState.running }));
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return;
  }

  serveStatic(req, res, requestUrl.pathname);
}

function handleRequestError(res, error) {
  log("server", `Request failed: ${error && error.stack ? error.stack : error}`);
  if (!res.headersSent) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal error");
  } else {
    res.destroy();
  }
}

const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res);
  } catch (error) {
    handleRequestError(res, error);
  }
});

// A bad request must never take the whole site down. Log and keep serving.
process.on("unhandledRejection", (error) => {
  log("server", `Unhandled rejection: ${error && error.stack ? error.stack : error}`);
});

if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  log("server", `WARNING: ${DIST_DIR}/index.html not found. Run \`bun run build:web\` first.`);
}

server.listen(PORT, () => {
  log("server", `Dokubolaget listening on http://0.0.0.0:${PORT}`);
  startSeeding();
});
