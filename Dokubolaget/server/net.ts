// The client address used for rate limits. Behind a reverse proxy
// (TRUST_PROXY) it's the rightmost X-Forwarded-For entry: the one our proxy
// appended. Entries to its left come from the client and can be forged.
export function clientAddress(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress: string | undefined,
  trustProxy: boolean,
): string {
  if (trustProxy) {
    const raw = headers["x-forwarded-for"];
    const entries = String(Array.isArray(raw) ? raw.join(",") : raw ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length > 0) return entries[entries.length - 1];
  }
  return remoteAddress || "unknown";
}
