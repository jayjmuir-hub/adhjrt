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
// Rate limiting: TWO buckets, `${ip}:${username}:login` and `${ip}:login`, and
// ONLY FAILED ATTEMPTS COUNT AGAINST EITHER. Both kept separate from the
// registration and signup buckets. This is what stands between a public
// password check and a script working through an account that can read every
// registrant's DOB and medical notes.
//
// ⚠️ It was one bucket, keyed on the address alone, incremented BEFORE the
// password was checked — so ten correct sign-ins exhausted it as fast as ten
// wrong ones, and the whole venue shared one budget because every manager at
// Zayed Sports City comes from one x-nf-client-connection-ip. On tournament
// morning that locks out the eleventh manager to arrive. See _ratelimit.js.
//
// ⚠️ No password-length check here, ever. The floor applies when a password
// is SET (see _password.js), never at login — a length check here would lock
// out every account whose password predates the current floor.

const { loadAccounts, verifyPassword, sign, blobStore } = require('./_auth');
const { peekRate, recordFailure, forget, tooManyResponse } = require('./_ratelimit');
const { recordSignIn } = require('./_signins');

/* ⚠️ TWO BUCKETS, AND ONLY FAILURES COUNT AGAINST EITHER. There used to be one,
   keyed on the connection address alone, incremented before the password was
   even looked at. Every manager at Zayed Sports City shares one
   x-nf-client-connection-ip, so on the morning of 7 November the eleventh
   manager to sign in — correctly, first time — would have been refused, and any
   mistyped password brought that forward. Ten CORRECT sign-ins exhausted it
   exactly as fast as ten wrong ones.

   PER ACCOUNT (ip + username, 10 per 15 min) is the one that does the real work.
   It is what stands between a script and one manager's password, and because it
   is per account, one person fumbling cannot lock out the fourteen people
   sitting next to them.

   PER CONNECTION (50 per 15 min) is the backstop against someone working
   through a LIST of usernames, which the per-account bucket cannot see. The
   ceiling is deliberately far above ordinary use: it counts only failures, so
   fifteen managers signing in correctly never touch it at all, while a script
   reaches it in seconds.

   ⚠️ A CORRECT PASSWORD CLEARS THE PER-ACCOUNT BUCKET (forget below). Four
   fumbles then a success must leave a clean slate, or a manager walks around all
   morning one mistake away from a lockout they already recovered from. */
const ACCOUNT_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };
const CONNECTION_RATE_OPTS = { max: 50, windowMs: 15 * 60 * 1000 };

const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';
const accountBucket = (event, uname) => `${clientIp(event)}:${uname}:login`;
const connectionBucket = (event) => `${clientIp(event)}:login`;

/* ⚠️ A DUMMY HASH, NOT A SECRET — it is the bcrypt of a throwaway string and is
   published in this file on purpose. Without it, `!account || !passwordHash ||
   await verifyPassword(...)` short-circuits: bcrypt only runs when the username
   EXISTS, so a real username answers in tens of milliseconds and an unknown one
   in well under one. The body and the status are identical, the timing is not,
   and that is enough to sort a wordlist into "real accounts" and "everything
   else" before spending a single guess on a password. Comparing against this
   makes both paths do the same work. */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

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
    const { username, password } = JSON.parse(event.body || '{}');
    const uname = (username || '').trim().toLowerCase();

    /* ⚠️ PEEK, DO NOT COUNT. The body has to be parsed first because the
       per-account bucket needs the username — which is why this moved below the
       JSON.parse. Reading a counter has no side effect, so nothing is spent by
       an attempt that turns out to be correct. */
    const store = blobStore('config');
    const now = Date.now();
    const perAccount = await peekRate(store, accountBucket(event, uname), now, ACCOUNT_RATE_OPTS);
    if (!perAccount.ok) return tooManyResponse(perAccount);
    const perConnection = await peekRate(store, connectionBucket(event), now, CONNECTION_RATE_OPTS);
    if (!perConnection.ok) return tooManyResponse(perConnection);

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
    /* ⚠️ ALWAYS RUN bcrypt, EVEN WHEN THERE IS NOTHING TO CHECK AGAINST — see
       DUMMY_HASH above. The `||` chain that used to be here short-circuited, so
       an unknown username answered far faster than a known one. */
    const ok = await verifyPassword(password || '', (account && account.passwordHash) || DUMMY_HASH);
    if (!account || !account.passwordHash || !ok) {
      /* Counted HERE and nowhere else: a wrong password is the only thing that
         should cost anybody anything. Both buckets, because the per-account one
         cannot see a script working through a list of usernames. */
      await recordFailure(store, accountBucket(event, uname), now, ACCOUNT_RATE_OPTS);
      await recordFailure(store, connectionBucket(event), now, CONNECTION_RATE_OPTS);
      /* ⚠️ THE EMAIL SENTENCE IS NOT PADDING. Jay - who built this site - could
         not sign in to a deploy preview because he typed his email address, and
         "Incorrect username or password." gave him nothing to work with. A
         browser autofills an email into any field that looks like a login, so
         the label saying USERNAME is not enough on its own.

         ⚠️ AND THE HINT CANNOT BE "use your email instead" FOR SOME PEOPLE.
         Only Google-created accounts store an email at all (google-auth.js);
         password accounts have none, so accepting an email would work for some
         managers and fail for others with the same message - worse than this.
         One rule, true for everybody: it is always the username.

         ⚠️ Still says nothing about WHICH half was wrong. Naming the username
         as valid would confirm to a guesser that the account exists. */
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect username or password. Sign in with your username, not your email address.' }) };
    }

    /* The password was right. Clear the fumbles that came before it — but NOT
       the connection bucket, which is watching for a username sweep and must
       not be resettable by knowing one correct password. */
    await forget(store, accountBucket(event, uname));

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
