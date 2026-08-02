// netlify/functions/login.js
//
// ONE sign-in for both roles (added Aug 2026 — claude/specs/spec-unified-login.md).
// The password twin of google-auth.js: look the account up by username alone,
// no role filter, and mint the session/token from the account's OWN stored
// role. The shapes are character-for-character the ones organizer-login.js
// and manager-login.js produce — test-unified-login.js asserts the parity
// against those files directly, which is also what pins the two older
// endpoints (kept, but no longer called by any page) against drift until
// they are retired in a commit of their own.
//
// Rate limiting: same options AND the same `${ip}:login` bucket as the two
// older endpoints, so the attempt budget stays one pool — nobody gets extra
// guesses by alternating endpoints.
//
// ⚠️ No password-length check here, ever. The floor applies when a password
// is SET (see _password.js), never at login — a length check here would lock
// out every account whose password predates the current floor.

const { loadAccounts, verifyPassword, sign, blobStore } = require('./_auth');
const { checkRate } = require('./_ratelimit');

const LOGIN_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };
const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';

/* The same per-role shapes organizer-login.js / manager-login.js return —
   and the same sessionFor() switch google-auth.js already uses. */
function sessionFor(account) {
  if (account.role === 'organizer') {
    return {
      session: { username: account.username, name: account.name, role: account.title || 'Organizer', _role: 'organizer' },
      token: sign({ username: account.username, role: 'organizer' }),
    };
  }
  return {
    session: { username: account.username, name: account.name, ageGroupId: account.ageGroupId },
    token: sign({ username: account.username, role: 'manager', ageGroupId: account.ageGroupId }),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const rate = await checkRate(blobStore('config'), `${clientIp(event)}:login`, Date.now(), LOGIN_RATE_OPTS);
    if (!rate.ok) {
      return {
        statusCode: 429,
        body: JSON.stringify({ ok: false, error: 'Too many attempts from this connection. Please try again shortly.', retryAfterSecs: rate.retryAfterSecs }),
      };
    }
    const { username, password } = JSON.parse(event.body || '{}');
    const uname = (username || '').trim().toLowerCase();
    const accounts = await loadAccounts();
    // By username alone — usernames are unique across BOTH roles (every
    // signup path checks the whole list), so no role filter is needed and
    // none is wanted: the role filter is exactly what forced the two-endpoint
    // fallback chains this endpoint replaces.
    const account = accounts.find((a) => a.username === uname);
    // A Google-created account has no passwordHash at all (see google-auth.js)
    // — check for one before ever calling verifyPassword, so someone who
    // signed up with Google and tries the password form by mistake gets the
    // same clean "incorrect" answer as a wrong password, not a 500.
    if (!account || !account.passwordHash || !(await verifyPassword(password || '', account.passwordHash))) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect username or password.' }) };
    }
    if (!account.approved) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Your account is still pending approval from a tournament organizer.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...sessionFor(account) }) };
  } catch (err) {
    console.error('login error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
