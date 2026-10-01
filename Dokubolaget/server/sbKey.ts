import type { Database } from "bun:sqlite";
import { nowIso } from "./db";

const SITE = "https://www.systembolaget.se";
const CACHE_KEY = "systembolaget_api_key";
const MAX_AGE_MS = 12 * 3_600_000;

export function parseBundlePaths(html: string): string[] {
  const pattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const paths = new Set<string>();
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) paths.add(match[1]);
  return [...paths];
}

export function parseApiKey(bundle: string): string | null {
  return /NEXT_PUBLIC_API_KEY_APIM\s*[:=]\s*"([^"]+)"/.exec(bundle)?.[1] ?? null;
}

// The public key Systembolaget's own website uses for its product API,
// scraped from their Next.js bundles and cached so players don't each scrape.
export function createSbKey(db: Database, fetchFn: typeof fetch = fetch, now: () => Date = () => new Date()) {
  let inflight: Promise<string> | null = null;

  async function scrape(): Promise<string> {
    const html = await (await fetchFn(`${SITE}/`)).text();
    const candidates = parseBundlePaths(html)
      .filter((p) => /\.js($|\?)/.test(p))
      .sort((a, b) => Number(/_next|chunk|app/.test(b)) - Number(/_next|chunk|app/.test(a)));
    for (const candidate of candidates) {
      const url = candidate.startsWith("http") ? candidate : `${SITE}${candidate}`;
      if (!url.startsWith(`${SITE}/`)) continue;
      try {
        const key = parseApiKey(await (await fetchFn(url)).text());
        if (key && /^[A-Za-z0-9]{16,64}$/.test(key)) return key;
      } catch {}
    }
    throw new Error("Systembolaget API key not found in any bundle");
  }

  return {
    async get(): Promise<string> {
      const row = db.query("SELECT value, updated_at FROM app_config WHERE key = ?").get(CACHE_KEY) as
        | { value: string; updated_at: string }
        | null;
      if (row && now().getTime() - new Date(row.updated_at).getTime() < MAX_AGE_MS) return row.value;
      inflight ??= scrape()
        .then((key) => {
          db.run(
            "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            [CACHE_KEY, key, nowIso(now())],
          );
          return key;
        })
        .catch((error) => {
          // A stale key beats none; the app retries on 401 anyway.
          if (row) return row.value;
          throw error;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
  };
}
