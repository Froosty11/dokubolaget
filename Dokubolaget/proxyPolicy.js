// Which Systembolaget URLs the /proxy route may fetch. Shared by server.js
// (production) and devProxy.js (local development) so both enforce the same
// allowlist.
//
// The web app only ever needs three things through the proxy:
//   - the systembolaget.se homepage, to find its Next.js bundles
//   - those bundles under /_next/static/, to read the public API key
//   - the product search API on api-extern.systembolaget.se

const ALLOWED_TARGETS = [
  {
    host: "www.systembolaget.se",
    allowPath: (p) => p === "/" || p.startsWith("/_next/static/"),
  },
  {
    host: "api-extern.systembolaget.se",
    allowPath: (p) => p.startsWith("/sb-api-ecommerce/v1/"),
  },
];

function isAllowedProxyTarget(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  // Reject dot-segments outright rather than trusting URL normalisation.
  if (/(^|\/)\.\.?(\/|$)/.test(decodeURIComponentSafe(url.pathname))) {
    return false;
  }
  return ALLOWED_TARGETS.some(
    (rule) => rule.host === host && rule.allowPath(url.pathname),
  );
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// JSON passes through as JSON. Everything else (the homepage HTML and the JS
// bundles) is only ever read as text by the app, so it's served as plain text
// and can never render or execute as a page on our origin.
function proxiedContentType(upstreamType) {
  if (upstreamType && /^application\/(problem\+)?json\b/i.test(upstreamType)) {
    return upstreamType;
  }
  return "text/plain; charset=utf-8";
}

const PROXY_RESPONSE_HEADERS = {
  "Content-Security-Policy": "sandbox; default-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

module.exports = {
  isAllowedProxyTarget,
  proxiedContentType,
  PROXY_RESPONSE_HEADERS,
};
