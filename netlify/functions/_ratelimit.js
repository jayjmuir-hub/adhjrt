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
/* ⚠️ windowMs IS A PARAMETER, AND USED TO BE THE MODULE CONSTANT. Every caller
   that passes its own `opts.windowMs` — login (15 min) and signup (15 min) —
   had its expiry measured against the registration gateway's ONE HOUR instead,
   because this line read `>= WINDOW_MS`. checkRate's retryAfterSecs was
   computed from the caller's window, so a locked-out person was told to try
   again in 15 minutes and was then refused for 45 more. Found in Aug 2026 by a
   test that filled a max-3 bucket, advanced the clock past its OWN window, and
   expected it clear. Nothing had ever advanced a clock here before. */
function readWindow(value, now, windowMs) {
  if (!value || typeof value !== 'object') return null;
  const count = Number(value.count);
  const windowStart = Number(value.windowStart);
  if (!Number.isFinite(count) || !Number.isFinite(windowStart)) return null;
  if (windowStart > now) return null;
  if (now - windowStart >= (windowMs || WINDOW_MS)) return null;
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
    current = readWindow(await store.get(key, { type: 'json' }), now, windowMs);
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

/* ---------------------------------------------------------------------- *
   SIGNUP ATTEMPTS (added 3 Aug 2026).

   organizer-signup.js, manager-signup.js and google-auth.js's signup branch
   all check an INVITE CODE with a plain string compare, and until now none of
   them counted attempts at all — so the codes took unlimited guesses from
   anyone, and an organiser account reads every registrant's name, date of
   birth and medical notes. The site-wide Netlify password hid this, but that
   comes off about 20 days before the tournament.

   ⚠️ ONE BUCKET ACROSS ALL THREE, for the same reason login.js has one:
   three endpoints guessing the same secrets with three budgets is one budget
   three times over. `${ip}:signup`, kept apart from `:login` (a person
   mistyping their password must not eat a new manager's signup budget) and
   from the registration bucket.

   Numbers match login.js — 10 per 15 minutes. A real person signs up once;
   ten is far past a fumbled code and far short of useful to a script.

   Fails OPEN, like every other use of this module: losing a genuine signup
   to a hiccuping blob read is worse than the guessing it would have stopped.
   Whoever gets in still lands as PENDING and needs an organiser's approval.  */
const SIGNUP_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };

function signupBucket(event) {
  /* Netlify's own header, never x-forwarded-for — that one is caller-supplied,
     so an attacker could pick their own bucket and the limit would be theatre. */
  return `${(event && event.headers || {})['x-nf-client-connection-ip'] || ''}:signup`;
}

function checkSignupRate(store, event, now) {
  return checkRate(store, signupBucket(event), now, SIGNUP_RATE_OPTS);
}

/* ---------------------------------------------------------------------- *
   PEEK / RECORD — for counting FAILURES rather than attempts (Aug 2026).

   checkRate() reads and increments in one call, which is right for the
   registration gateway: there, every submission is a submission and counting
   it is the point.

   ⚠️ IT IS WRONG FOR A PASSWORD FORM, and login.js used it anyway. Two
   consequences, both found by a code review:

   1. SUCCESSFUL LOGINS ATE THE BUDGET. The counter went up before the password
      was ever checked, so ten correct sign-ins exhausted it exactly as fast as
      ten wrong ones.
   2. THE BUCKET WAS THE WHOLE VENUE. It was keyed on the connection address
      alone, and every manager at Zayed Sports City shares one
      x-nf-client-connection-ip. Fifteen managers, ten sign-ins: managers 11-15
      could not get in on the morning of 14 November, and any mistyped password
      brought that forward.

   Splitting read from write fixes both: peek before checking the password,
   record only when it was wrong. A person who signs in correctly never touches
   the counter at all.

   forget() is what makes a correct password FORGIVING — it clears the
   per-account counter, so four fumbles then a success leaves a clean slate
   rather than a manager one mistake away from a lockout they did not earn. */

/* Read a bucket WITHOUT counting against it.
   Fails open like everything else here: an unreadable counter allows. */
async function peekRate(store, address, now, opts) {
  const max = (opts && opts.max) || MAX_PER_WINDOW;
  const windowMs = (opts && opts.windowMs) || WINDOW_MS;
  try {
    if (!store || typeof store.get !== 'function') throw new Error('no store');
    const win = readWindow(await store.get(keyFor(address), { type: 'json' }), now, windowMs);
    if (!win || win.count < max) return { ok: true };
    const left = win.windowStart + windowMs - now;
    return { ok: false, retryAfterSecs: Math.max(1, Math.ceil(left / 1000)) };
  } catch (err) {
    console.warn('rate limit: could not read the counter, allowing -', err && err.message);
    return { ok: true, degraded: true };
  }
}

/* Count one failure against a bucket. Never refuses anything itself — the
   refusal is peekRate's job on the NEXT attempt — so its only failure mode is
   not counting, which is the fail-open direction. */
async function recordFailure(store, address, now, opts) {
  try {
    if (!store || typeof store.get !== 'function') throw new Error('no store');
    const key = keyFor(address);
    /* ⚠️ THE SAME windowMs THE PEEK USED. Reading with a different window to the
       one that will refuse means the count can be revived from a bucket the peek
       already considers expired, or reset while the peek still counts it. */
    const windowMs = (opts && opts.windowMs) || WINDOW_MS;
    const win = readWindow(await store.get(key, { type: 'json' }), now, windowMs) || { count: 0, windowStart: now };
    await store.setJSON(key, { count: win.count + 1, windowStart: win.windowStart });
  } catch (err) {
    console.warn('rate limit: could not record the failure -', err && err.message);
  }
}

/* Wipe a bucket — a correct password forgives the fumbles that came before it. */
async function forget(store, address) {
  try {
    if (!store || typeof store.delete !== 'function') return;
    await store.delete(keyFor(address));
  } catch (err) {
    console.warn('rate limit: could not clear the counter -', err && err.message);
  }
}

/* One copy of the sentence. It was written out in login.js and would have been
   written out three more times here; two copies of one rule drift, and the
   drift is invisible until somebody reads both. */
function tooManyResponse(rate) {
  return {
    statusCode: 429,
    body: JSON.stringify({ ok: false, error: 'Too many attempts from this connection. Please try again shortly.', retryAfterSecs: rate.retryAfterSecs }),
  };
}

module.exports = {
  checkRate, keyFor, MAX_PER_WINDOW, WINDOW_MS,
  checkSignupRate, signupBucket, tooManyResponse, SIGNUP_RATE_OPTS,
  peekRate, recordFailure, forget,
};
