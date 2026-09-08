/*
 * Service worker for the gate scanner.
 *
 * Scope is deliberately narrow: cache the app shell so /scanner opens with no
 * signal, and get out of the way for everything else. Ticket and roster data
 * are NEVER cached here — they live in IndexedDB, where the app controls
 * freshness. A stale cached roster served by an over-eager service worker is
 * exactly how you double-admit someone.
 */

// Bumped whenever the caching or fallback behaviour changes: `activate` deletes
// every cache whose name is not this one, so a version bump is what actually
// evicts shells saved under the old rules from browsers already in the wild.
//
// v4 is not optional. Under v2 a signed-out visit to any protected route stored
// the login page under that route's key, and those entries are sitting in real
// browsers right now. Nothing in the new code deletes them by itself — only the
// rename does.
const CACHE = "ku-events-shell-v4";

const SHELL = ["/", "/scanner", "/manifest.webmanifest", "/icon.svg"];

/**
 * Precache one shell URL, refusing anything that came back from a redirect.
 *
 * NOT `cache.add()`. That does its own fetch, follows redirects, and stores the
 * result under the URL asked for — so precaching "/scanner" while signed out
 * fetched it, was bounced to /login by the proxy, and cached the *login page*
 * as the gate's offline shell. The one screen whose whole purpose is working
 * with no signal had a sign-in form saved as its offline copy.
 *
 * `cache.add` also never passes through the fetch handler, so the redirect
 * guard there cannot help; this has to be done here too.
 *
 * Caching nothing is the right failure. A protected shell fetched while signed
 * out has no cacheable content, and the fetch handler will store the real thing
 * on the first visit that actually reaches it.
 */
async function precache(cache, url) {
  try {
    const response = await fetch(url);
    if (!response.ok || response.redirected) return;
    await cache.put(url, response);
  } catch {
    // Offline during install, or the URL 404s. Tolerated: a missing shell entry
    // degrades the offline experience, a failed install removes it entirely.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Each entry is added independently: `addAll` rejects the whole install
      // if any single URL fails.
      .then((cache) => Promise.all(SHELL.map((url) => precache(cache, url))))
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

  /*
   * Leave React Server Component payloads alone.
   *
   * A client-side navigation asks for the same pathname with `?_rsc=<hash>`
   * and expects a flight stream, not HTML. Caching those means a later request
   * can be answered with a payload built against a different build id, which
   * the router cannot reconcile — it fails in a way that looks like a routing
   * bug rather than a caching one. The hash also changes every deploy, so the
   * entries are near-useless anyway.
   */
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  // Network-first with a cache fallback: fresh when there is signal, still
  // usable when there is not.
  event.respondWith(
    fetch(request)
      .then((response) => {
        /*
         * A followed redirect is NOT this URL's content.
         *
         * `fetch()` follows redirects by default, so requesting a protected
         * route while signed out returns `200 basic` — for the *login page*,
         * because `proxy.ts` bounced it. Caching that under the requested key
         * stored the login screen as if it were /tickets, and every later visit
         * was served a sign-in form for a page the user was signed in to.
         *
         * `response.redirected` is the only thing that distinguishes them: the
         * status is 200 and the type is `basic` either way.
         *
         * Handing a redirected response to a navigation is also invalid per the
         * service worker spec, so navigations get a real redirect instead and
         * the browser's URL bar follows it honestly.
         */
        if (response.redirected) {
          if (request.mode === "navigate") {
            return Response.redirect(response.url, 302);
          }
          return response;
        }

        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          /*
           * Fall back to the shell for the section being visited.
           *
           * This used to serve `/scanner` for *every* failed navigation, which
           * meant a student who lost signal on an event page was handed the
           * gate marshal's check-in console — a screen for admitting people,
           * shown to someone trying to read about an event. The scanner shell
           * is only right for scanner routes; everything else gets the
           * landing page, which is what an offline visitor should see.
           */
          const shell = url.pathname.startsWith("/scanner")
            ? await caches.match("/scanner")
            : await caches.match("/");

          if (shell) return shell;

          // Nothing cached at all. Say so in words rather than handing back
          // `Response.error()`, which renders as the browser's generic network
          // failure page and logs "the promise was resolved with an error
          // response object" — neither of which tells anyone they are offline.
          return new Response(
            "<!doctype html><meta charset=utf-8>" +
              "<meta name=viewport content='width=device-width,initial-scale=1'>" +
              "<title>Offline — KU Events</title>" +
              "<body style=\"margin:0;display:grid;place-items:center;min-height:100dvh;" +
              'background:#0a0708;color:#f2eae4;font:16px/1.6 system-ui,sans-serif">' +
              "<div style=\"text-align:center;padding:2rem\"><h1 style='font-size:1.5rem;margin:0 0 .5rem'>" +
              "You&rsquo;re offline</h1><p style='margin:0;opacity:.7'>" +
              "This page hasn&rsquo;t been saved for offline use. Reconnect and try again.</p></div>",
            { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        // Sub-resources get the honest network error; there is nothing useful
        // to substitute for a script or an image.
        return Response.error();
      }),
  );
});
