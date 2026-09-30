// API configuration for Systembolaget

export const SYSTEMBOLAGET_API_BASE =
  "https://api-extern.systembolaget.se/sb-api-ecommerce/v1";

export const SYSTEMBOLAGET_WEBSITE = "https://www.systembolaget.se";

// Local CORS proxy for development (run: bun run proxy)
export const CORS_PROXY = "http://localhost:8787/proxy?url=";

const env = (globalThis as any)?.process?.env || {};

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
  parseBooleanEnvACB(env.EXPO_PUBLIC_SYSTEMBOLAGET_DEBUG) ?? false;

// Optional override. If missing we auto-extract key from the public website bundle.
export const SYSTEMBOLAGET_API_KEY =
  env.EXPO_PUBLIC_SYSTEMBOLAGET_API_KEY || "";

export const DEFAULT_PAGE_SIZE = 20;
