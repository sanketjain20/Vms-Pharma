/* Service worker for the field-rep app (scope: /rep).
 *
 * Goal: once a rep has opened the app online a single time, it must still open
 * and work with no signal. So the app shell and every same-origin file it
 * loads are cached as they're fetched, and served from cache when the network
 * is unavailable.
 *
 * Strategy is network-first (fresh when online, cache when not) — simplest and
 * never serves a stale build to someone who has signal. API calls are NEVER
 * cached here: orders and the catalog live in IndexedDB, under the app's
 * control, not in an HTTP cache.
 */
const CACHE = "vms-rep-v1";
const SHELL = ["/rep", "/rep-manifest.webmanifest", "/logo192.png", "/logo512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vms-rep-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API on another origin: not ours
  if (url.pathname.startsWith("/api/")) return;     // never cache API responses
  if (url.pathname.includes("hot-update") || url.pathname.startsWith("/ws")) return; // dev server noise

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        // Opening/refreshing any /rep page offline → serve the cached SPA shell.
        if (req.mode === "navigate") {
          const shell = await caches.match("/rep");
          if (shell) return shell;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});
