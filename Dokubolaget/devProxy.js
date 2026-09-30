// Local development CORS proxy for the web app (bun run proxy). Production
// uses the same-origin /proxy route in server.js instead.
//
// Same allowlist as production, and it only listens on and answers to
// localhost, so it can't be used as a relay from the network or other sites.

const http = require("http");
const { URL } = require("url");
const {
  isAllowedProxyTarget,
  proxiedContentType,
  PROXY_RESPONSE_HEADERS,
} = require("./proxyPolicy");

const PORT = 8787;
const HOST = "127.0.0.1";
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function writeCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
  }
}

function filterOutgoingHeaders(headers) {
  const out = {};

  Object.keys(headers || {}).forEach(function eachHeader(name) {
    const lower = name.toLowerCase();

    // Hop-by-hop / browser-managed headers should not be forwarded.
    if (
      lower === "host" ||
      lower === "origin" ||
      lower === "referer" ||
      lower === "connection" ||
      lower === "content-length" ||
      lower === "cookie"
    ) {
      return;
    }

    out[name] = headers[name];
  });

  return out;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const server = http.createServer(async function handler(req, res) {
  writeCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  let incomingUrl;
  try {
    incomingUrl = new URL(req.url, "http://localhost:" + PORT);
  } catch {
    sendJson(res, 400, { error: "Bad request" });
    return;
  }

  if (incomingUrl.pathname !== "/proxy") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Only GET is proxied" });
    return;
  }

  const target = incomingUrl.searchParams.get("url");
  if (!target) {
    sendJson(res, 400, { error: "Missing required query param: url" });
    return;
  }

  if (!isAllowedProxyTarget(target)) {
    sendJson(res, 403, { error: "Target not allowed" });
    return;
  }

  try {
    const upstreamRes = await fetch(target, {
      method: "GET",
      headers: filterOutgoingHeaders(req.headers),
      redirect: "manual",
    });

    res.statusCode = upstreamRes.status;
    for (const [name, value] of Object.entries(PROXY_RESPONSE_HEADERS)) {
      res.setHeader(name, value);
    }
    res.setHeader("Content-Type", proxiedContentType(upstreamRes.headers.get("content-type")));

    const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(bodyBuffer);
  } catch (error) {
    console.log("Proxy request failed:", error && error.message ? error.message : error);
    sendJson(res, 502, { error: "Proxy request failed" });
  }
});

server.listen(PORT, HOST, function onListen() {
  console.log("Local proxy listening on http://" + HOST + ":" + PORT);
});
