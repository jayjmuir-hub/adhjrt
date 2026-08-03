// netlify/functions/login.js
//
// ONE sign-in for both roles (added Aug 2026 — claude/specs/spec-unified-login.md).
// The password twin of google-auth.js: look the account up by username alone,
// no role filter, and mint the session/token from the account's OWN stored
// role.
//
// THE ONLY PASSWORD ENDPOINT. organizer-login.js and manager-login.js were
// kept byte-identical and uncalled through the unification so the old tests
// could pass unchanged; they were retired on 3 Aug 2026 and test-unified-
// login.js now asserts they have not come back. The session and token shapes
// below started life as a character-for-character copy of theirs and are
// pinned by hardcoded literal — they are load-bearing downstream
// (isOrganiserSession() reads _role, manager code reads ageGroupId), and
// there is no second copy left to compare against.
//
// Rate limiting: the `${ip}:login` bucket, kept separate from the
// registration bucket. It was shared with the two older endpoints so nobody
// could buy extra guesses by alternating between them; with one endpoint
// left the bucket name no longer has to be shared, but it is still what
// stands between a public password check and a script working through an
// account that can read every registrant's DOB and medical notes.
//
// ⚠️ No password-length check here, ever. The floor applies when a password
// is SET (see _password.js), never at login — a length check here would lock
// out every account whose password predates the current floor.

const { loadAccounts, verifyPassword, sign, blobStore } = require('./_auth');
const { checkRate, tooManyResponse } = require('./_ratelimit');
const { recordSignIn } = require('./_signins');

const LOGIN_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };
const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';

/* The same sessionFor() switch google-auth.js already uses — the two files
   must agree, or which door somebody came in through starts to matter to
   every downstream reader. test-google-auth.js asserts both sides. */
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
    if (!rate.ok) return tooManyResponse(rate);
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
    /* ⚠️ AFTER the password and the approval check, never before — a failed
       attempt is not a sign-in, and stamping one would let anyone move
       somebody else's "last signed in" by guessing at their username. It goes
       to its OWN blob store, one key per person, NOT onto the account record:
       the accounts list is a single blob rewritten whole, so a write on every
       login would race the organiser approving somebody. See _signins.js. */
    await recordSignIn(account.username);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...sessionFor(account) }) };
  } catch (err) {
    console.error('login error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
