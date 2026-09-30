// API configuration for Systembolaget

export const SYSTEMBOLAGET_API_BASE =
  "https://api-extern.systembolaget.se/sb-api-ecommerce/v1";

export const SYSTEMBOLAGET_WEBSITE = "https://www.systembolaget.se";

// NOTE: EXPO_PUBLIC_* values must be read as literal `process.env.EXPO_PUBLIC_X`
// expressions. Expo inlines them at build time only in that exact form; any
// indirection (destructuring, globalThis lookups) silently yields undefined.

// CORS proxy used on web. In development this is the standalone devProxy.js
// (run: bun run proxy). In the Docker image it's the same-origin /proxy route
// served by server.js, set at build time via EXPO_PUBLIC_CORS_PROXY.
export const CORS_PROXY =
  process.env.EXPO_PUBLIC_CORS_PROXY || "http://localhost:8787/proxy?url=";

function parseBooleanEnvACB(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return undefined;
}

export const SYSTEMBOLAGET_DEBUG =
  parseBooleanEnvACB(process.env.EXPO_PUBLIC_SYSTEMBOLAGET_DEBUG) ?? false;

// Optional override. If missing we auto-extract key from the public website bundle.
export const SYSTEMBOLAGET_API_KEY =
  process.env.EXPO_PUBLIC_SYSTEMBOLAGET_API_KEY || "";

export const DEFAULT_PAGE_SIZE = 20;
