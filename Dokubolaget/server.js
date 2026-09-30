// Production server for Dokubolaget. One process does three jobs:
//
//   1. Serves the static Expo web build from ./dist
//   2. Proxies browser requests to Systembolaget on /proxy?url=... so the web
//      app can call their API without CORS trouble. Only systembolaget.se
//      hosts are allowed, so this is not an open relay.
//   3. Runs the daily board pipeline (download catalog → find tags → generate
//      board → write to Firestore) once a day on a timer, if Firebase
//      credentials are present.
//
// Runs under Bun (used in the Docker image) or Node 20+. No dependencies.
//
// Environment:
//   PORT                          listen port (default 8080)
//   FIREBASE_SERVICE_ACCOUNT_KEY  service account JSON; enables seeding
//   GOOGLE_APPLICATION_CREDENTIALS path to a service account file; alternative
//   SEED_ENABLED                  "false" to disable seeding even with creds
//   SEED_ON_START                 "false" to skip the seed run at boot
//   SEED_HOUR_UTC / SEED_MINUTE_UTC  daily run time (default 00:05 UTC)
//   SEED_ATTEMPTS                 generator attempts per board (default 3000)
//   CATALOG_URL                   product catalog source (default susbolaget)

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

const APP_ROOT = __dirname;
const DIST_DIR = path.join(APP_ROOT, "dist");
const PRODUCTS_PATH = path.resolve(APP_ROOT, "..", "products.json");
const PORT = Number(process.env.PORT) || 8080;

const CATALOG_URL =
  process.env.CATALOG_URL || "https://susbolaget.emrik.org/v1/products";
const MIN_CATALOG_BYTES = 1_000_000;

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

function resolveStaticFile(urlPath) {
  // Never let the request escape dist/.
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const base = path.join(DIST_DIR, safe);
  if (!base.startsWith(DIST_DIR)) {
    return null;
  }

  const candidates = [base, `${base}.html`, path.join(base, "index.html")];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Client-side route: expo-router handles it from the shell page.
  const fallback = path.join(DIST_DIR, "index.html");
  return fs.existsSync(fallback) ? fallback : null;
}

function serveStatic(req, res) {
  const filePath = resolveStaticFile(req.url || "/");
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const hashed = filePath.includes(`${path.sep}_expo${path.sep}`);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": hashed
      ? "public, max-age=31536000, immutable"
      : ext === ".html"
        ? "no-cache"
        : "public, max-age=3600",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// Systembolaget proxy
// ---------------------------------------------------------------------------

function isAllowedProxyTarget(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return host === "systembolaget.se" || host.endsWith(".systembolaget.se");
}

const DROPPED_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "cookie",
  "accept-encoding",
]);

function forwardHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (DROPPED_REQUEST_HEADERS.has(name.toLowerCase())) continue;
    if (typeof value === "string") out[name] = value;
  }
  return out;
}

async function serveProxy(req, res, requestUrl) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Only GET is proxied" }));
    return;
  }

  const target = requestUrl.searchParams.get("url");
  if (!target) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing required query param: url" }));
    return;
  }

  if (!isAllowedProxyTarget(target)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Only systembolaget.se targets are allowed" }));
    return;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders(req.headers),
      redirect: "follow",
    });

    const contentType = upstream.headers.get("content-type");
    res.writeHead(upstream.status, {
      ...(contentType ? { "Content-Type": contentType } : {}),
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(
      JSON.stringify({
        error: "Proxy request failed",
        details: error && error.message ? error.message : String(error),
      }),
    );
  }
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

function hasFirebaseCredentials() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function utcDatePlusDays(days) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

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
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tmpPath));
  const size = fs.statSync(tmpPath).size;
  if (size < MIN_CATALOG_BYTES) {
    fs.unlinkSync(tmpPath);
    throw new Error(`Catalog suspiciously small (${size} bytes); aborting`);
  }
  fs.renameSync(tmpPath, PRODUCTS_PATH);
  log("seed", `Catalog saved (${(size / 1e6).toFixed(1)} MB)`);
}

// Generates and uploads `days` boards starting at `startDate`.
async function runSeedPipeline(startDate, days) {
  if (seedState.running) {
    log("seed", "A run is already in progress; skipping");
    return;
  }
  seedState.running = true;
  seedState.lastRunAt = new Date().toISOString();
  const attempts = process.env.SEED_ATTEMPTS || "3000";
  const start = dateKey(startDate);

  try {
    await downloadCatalog();
    await runStep("find tags", "bun", ["run", "scripts/findTags.ts", "--min-cell", "4"]);
    await runStep("generate boards", "bun", [
      "run",
      "scripts/generateBoard.ts",
      "--seed",
      start,
      "--boards",
      String(days),
      "--attempts",
      attempts,
    ]);
    await runStep("upload to Firestore", "bun", [
      "run",
      "scripts/seedFirestoreBoard.ts",
      "--date",
      start,
      "--days",
      String(days),
    ]);
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

function msUntilNextRun() {
  const hour = Number(process.env.SEED_HOUR_UTC ?? 0);
  const minute = Number(process.env.SEED_MINUTE_UTC ?? 5);
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0),
  );
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  seedState.nextRunAt = next.toISOString();
  return next.getTime() - now.getTime();
}

function scheduleDailySeed() {
  const delay = msUntilNextRun();
  log("seed", `Next scheduled run at ${seedState.nextRunAt}`);
  setTimeout(async () => {
    // Seed tomorrow's board so it's in place before the next Stockholm midnight.
    try {
      await runSeedPipeline(utcDatePlusDays(1), 1);
    } catch {
      // Retry once after 30 minutes; the catalog mirror is occasionally down.
      log("seed", "Retrying in 30 minutes");
      setTimeout(() => runSeedPipeline(utcDatePlusDays(1), 1).catch(() => {}), 30 * 60 * 1000);
    }
    scheduleDailySeed();
  }, delay);
}

function startSeeding() {
  if (process.env.SEED_ENABLED === "false") {
    log("seed", "Disabled via SEED_ENABLED=false");
    return;
  }
  if (!hasFirebaseCredentials()) {
    log("seed", "No Firebase credentials found; daily seeding is off. The app falls back to bundled boards.");
    return;
  }
  seedState.enabled = true;

  if (process.env.SEED_ON_START !== "false") {
    // Cover today and tomorrow on boot so a fresh deploy never serves a stale
    // fallback board while waiting for the first scheduled run.
    runSeedPipeline(utcDatePlusDays(0), 2).catch(() => {});
  }
  scheduleDailySeed();
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (requestUrl.pathname === "/proxy") {
    serveProxy(req, res, requestUrl);
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, seed: seedState }));
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return;
  }

  serveStatic(req, res);
});

if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  log("server", `WARNING: ${DIST_DIR}/index.html not found. Run \`bun run build:web\` first.`);
}

server.listen(PORT, () => {
  log("server", `Dokubolaget listening on http://0.0.0.0:${PORT}`);
  startSeeding();
});
