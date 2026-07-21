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

const CACHE = 'adhjrt-v1';

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
        // Only cache successful, basic responses.
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
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
