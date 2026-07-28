// netlify/functions/_ratelimit.js
//
// A per-address submission counter, in a blob.
//
// WHY IT EXISTS. Netlify Forms was doing three jobs nobody chose and nobody
// wrote down: spam filtering, standing between the public and a Google Sheet,
// and throttling. The submission gateway takes all three away. What is left
// without this is a public, unauthenticated endpoint that:
//
//   * appends unbounded rows to a sheet holding children's names, dates of
//     birth and medical notes, and
//   * sends unbounded mail from admin@adhjrt.com to an address taken out of
//     the request body — a relay on our own domain.
//
// ---------------------------------------------------------------------
// ⚠️ IT FAILS OPEN.
// ---------------------------------------------------------------------
// If the counter cannot be read or written, the submission is ALLOWED. Losing a
// real registration because a blob read hiccupped is far worse than the abuse it
// would have prevented, and the whole site is still behind a Netlify password
// while this is proven. That is a deliberate trade, it is asserted in
// test-intake.js, and it should not be quietly reversed.
//
// Dependency-free: the store is passed in, so this can be tested without
// node_modules. Same reason as _intake.js and _password.js.

/* Twenty submissions per address per hour.
   A club secretary entering a whole age group by hand is the legitimate heavy
   user, and the biggest squad in the tournament is 18. Twenty an hour is
   comfortably past that and far short of anything useful to an abuser. */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000;

/* This store also holds the venue layout, the registration window and the map
   block positions, so the counters are namespaced.

   The address comes from a request header, so it is caller-influenced and is
   NOT a free-form key: anything that is not a plain address character is
   replaced, or a header containing a slash could write to a key of its
   choosing. An empty address collapses to one shared bucket rather than
   skipping the check — skipping would make "send no address" the way round the
   limit. */
function keyFor(address) {
  const raw = typeof address === 'string' ? address : '';
  const safe = raw.replace(/[^0-9a-zA-Z.:_-]/g, '_').slice(0, 60) || 'unknown';
  return `ratelimit/${safe}`;
}

/* Anything that is not a window we wrote is treated as no window at all —
   junk in the store starts a fresh hour rather than throwing on a shape nobody
   put there.

   A windowStart in the FUTURE is treated as stale too. A clock skew between
   instances, or a stored value from a machine running fast, must not be able to
   lock somebody out for longer than the window. */
function readWindow(value, now) {
  if (!value || typeof value !== 'object') return null;
  const count = Number(value.count);
  const windowStart = Number(value.windowStart);
  if (!Number.isFinite(count) || !Number.isFinite(windowStart)) return null;
  if (windowStart > now) return null;
  if (now - windowStart >= WINDOW_MS) return null;
  return { count, windowStart };
}

/* Returns { ok, retryAfterSecs, degraded }.
     ok         — whether this submission may proceed
     retryAfter — whole seconds until the window rolls over, only when refused
     degraded   — the counter was unavailable and this is a fail-open allow */
async function checkRate(store, address, now, opts) {
  const max = (opts && opts.max) || MAX_PER_WINDOW;
  const windowMs = (opts && opts.windowMs) || WINDOW_MS;
  const key = keyFor(address);

  let current;
  try {
    if (!store || typeof store.get !== 'function') throw new Error('no store');
    current = readWindow(await store.get(key, { type: 'json' }), now);
  } catch (err) {
    /* FAIL OPEN. Logged by message only — nothing about the submission itself
       goes anywhere near a log. */
    console.warn('rate limit: could not read the counter, allowing -', err && err.message);
    return { ok: true, degraded: true };
  }

  const win = current || { count: 0, windowStart: now };

  if (win.count >= max) {
    const left = win.windowStart + windowMs - now;
    return { ok: false, retryAfterSecs: Math.max(1, Math.ceil(left / 1000)) };
  }

  try {
    await store.setJSON(key, { count: win.count + 1, windowStart: win.windowStart });
  } catch (err) {
    /* The read worked and the write did not, so this submission is not counted.
       Refusing here would cost a real registration to protect a counter, which
       is the wrong way round. */
    console.warn('rate limit: could not record the submission, allowing -', err && err.message);
    return { ok: true, degraded: true };
  }

  return { ok: true };
}

module.exports = { checkRate, keyFor, MAX_PER_WINDOW, WINDOW_MS };
