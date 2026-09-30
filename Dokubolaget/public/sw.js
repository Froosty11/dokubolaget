// Minimal service worker. It deliberately caches nothing: the app is small,
// the board changes daily and stale bundles would be worse than a reload.
// Its only job is to make the app installable ("Add to Home Screen") in
// browsers that still require a registered worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
