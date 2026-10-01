import { api } from "./api";

// The public Systembolaget API key, cached by our server (it scrapes the key
// from systembolaget.se so players don't each have to).
export async function readCachedSystembolagetApiKeyACB() {
  return (await api.sbKey()).key.trim();
}

// The server keeps its own cache fresh; nothing to write from the app.
export async function writeCachedSystembolagetApiKeyACB(_apiKey: string, _source = "scraper") {}
