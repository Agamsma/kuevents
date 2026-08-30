/*
 * Service worker for the gate scanner.
 *
 * Scope is deliberately narrow: cache the app shell so /scanner opens with no
 * signal, and get out of the way for everything else. Ticket and roster data
 * are NEVER cached here — they live in IndexedDB, where the app controls
 * freshness. A stale cached roster served by an over-eager service worker is
 * exactly how you double-admit someone.
 */

const CACHE = "ku-events-shell-v1";

const SHELL = ["/", "/scanner", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `addAll` rejects the whole install if any single URL 404s, so each
      // entry is added independently and failures are tolerated.
      .then((cache) =>
        Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only, and never the API — a cached /api/sync response would be
  // actively harmful.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first with a cache fallback: fresh when there is signal, still
  // usable when there is not.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // A navigation with nothing cached still needs *something* to render.
        if (request.mode === "navigate") {
          const shell = await caches.match("/scanner");
          if (shell) return shell;
        }

        return Response.error();
      }),
  );
});
