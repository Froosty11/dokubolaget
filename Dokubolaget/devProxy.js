//node cors reverse proxy. gpt 5.3 generated. cant be arsed since it's temporary. 

const http = require("http");
const { URL } = require("url");

const PORT = 8787;

function writeCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
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
      lower === "content-length"
    ) {
      return;
    }

    out[name] = headers[name];
  });

  return out;
}

const server = http.createServer(async function handler(req, res) {
  writeCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const incomingUrl = new URL(req.url, "http://localhost:" + PORT);

  if (incomingUrl.pathname !== "/proxy") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const target = incomingUrl.searchParams.get("url");
  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing required query param: url" }));
    return;
  }

  try {
    const upstreamRes = await fetch(target, {
      method: req.method,
      headers: filterOutgoingHeaders(req.headers),
    });

    res.statusCode = upstreamRes.status;

    // Preserve content type for JSON and text responses.
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(bodyBuffer);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Proxy request failed",
        details: error && error.message ? error.message : String(error),
      }),
    );
  }
});

server.listen(PORT, function onListen() {
  console.log("Local proxy listening on http://localhost:" + PORT);
});
