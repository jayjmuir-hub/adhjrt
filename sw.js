/* ADH JRT — service worker
 *
 * Deliberately minimal. Its main job is to make the site installable as an
 * app; the caching is a safety net for a weak signal at the ground, not a
 * performance layer.
 *
 * STRATEGY: network-first, always.
 *   - Online, you always get the live version. Nothing stale is ever served
 *     while the network is reachable, which matters on a site that is
 *     deployed to often and shows live scores.
 *   - Offline, you get the last copy of a page you visited, so a dropout at
 *     Zayed Sports City shows the last fixtures you looked at rather than a
 *     browser error page.
 *
 * Deliberately NOT cached: anything under /.netlify/functions/. Results,
 * standings and logins must never come from a cache — a manager seeing a
 * stale score would be worse than seeing none.
 */

/* ⚠️ BUMP THIS WHEN A CACHED ENTRY HAS TO GO. The activate handler deletes
   every cache whose name is not this one, so changing the string is the escape
   hatch for a poisoned entry — and it had never been changed, so that hatch had
   never once been exercised. It is dated now rather than numbered, because
   'v1 -> v2' invites the question "is this newer than what I have?" and a date
   answers it. */
const CACHE = 'adhjrt-2026-08-09';

/* ⚠️ WHAT MAY BE CACHED AT ALL, added Aug 2026. Before this, EVERY successful
   same-origin GET was stored with no cap and no eviction: one visit to the
   homepage wrote the hero photo plus 44 About-ring image variants into Cache
   Storage permanently. Network-first means that was never a staleness bug — it
   was a storage bug, and on a phone that is nearly full the browser evicts the
   WHOLE origin's storage rather than the oldest entry, taking the offline
   fallback with it.

   Pages and the shell are what the offline fallback is FOR. Photographs are
   not: a dropout at the ground should show the last fixtures you looked at,
   and it does not matter whether the hero image comes with them. */
const MAX_ENTRIES = 60;

function cacheable(request, url) {
  /* Navigations — the actual pages, which is the whole point of the fallback. */
  if (request.mode === 'navigate') return true;
  /* The shell: the scripts and styles a cached page needs to render at all. */
  if (/\.(?:js|css|webmanifest)$/.test(url.pathname)) return true;
  /* Everything else — images above all — is served from the network or not at
     all. They are already cached by HTTP for a year (see netlify.toml). */
  return false;
}

/* Oldest-first eviction. Cache Storage keeps insertion order, so the first
   keys are the least recently ADDED. Not least recently used — that would need
   bookkeeping this does not justify — but enough to bound the store. */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('install', (event) => {
  // Take over straight away rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions so a bumped CACHE name clears the lot.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs. Fonts, analytics and API writes pass through.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API — always live, or fail honestly.
  if (url.pathname.startsWith('/.netlify/')) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        // Only cache successful, basic responses — and only what cacheable()
        // allows, then trim. ⚠️ `await` the put: it used to be fire-and-forget,
        // so trim() could run against a cache the put had not yet landed in.
        if (fresh && fresh.status === 200 && fresh.type === 'basic' && cacheable(request, url)) {
          const cache = await caches.open(CACHE);
          await cache.put(request, fresh.clone());
          await trim(cache);
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Nothing cached and no network — let the browser show its own error.
        throw err;
      }
    })()
  );
});
