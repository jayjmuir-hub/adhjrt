// netlify/functions/organizer-login.js
//
// Signs in an existing Organizer account (created via
// organizer-signup.js). Returns a session token that get-registrations.js
// checks on every request — see _auth.js for how tokens work.

const { loadAccounts, verifyPassword, sign, blobStore } = require('./_auth');
const { checkRate } = require('./_ratelimit');

/* 30 Jul: this endpoint had no rate limit at all — a public, unauthenticated
   password check with nothing between it and a script trying every guess it
   likes against an account that can see every registrant's name, DOB and
   medical notes. Reuses the same fail-open counter _intake.js uses for
   registrations (see _ratelimit.js), keyed separately from that bucket
   (":login" suffix) so a normal registration burst from the same address
   doesn't eat into the login attempt budget or vice versa. Tighter than the
   registration default (20/hour): 10 attempts per 15 minutes is still far more
   than a real person mistyping a password needs, comfortably short of being
   useful to a guessing script. */
const LOGIN_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };
const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';

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
    const account = accounts.find((a) => a.username === uname && a.role === 'organizer');
    // A Google-signup account has no passwordHash at all (see google-auth.js) —
    // check for one before ever calling verifyPassword, so someone who signed
    // up with Google and tries the password form by mistake gets the same
    // clean "incorrect" answer as a wrong password, not a 500.
    if (!account || !account.passwordHash || !(await verifyPassword(password || '', account.passwordHash))) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect username or password.' }) };
    }
    if (!account.approved) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Your account is still pending approval from a tournament organizer.' }) };
    }
    const session = { username: account.username, name: account.name, role: account.title || 'Organizer', _role: 'organizer' };
    const token = sign({ username: account.username, role: 'organizer' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, session, token }) };
  } catch (err) {
    console.error('organizer-login error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
