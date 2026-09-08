// netlify/functions/hub-auth.js
//
// "Sign in with Quins Club Hub" — the tournament site's third and, from the
// October 2026 season, main way in. Spec: claude/specs/spec-club-hub-sign-in-sep-2026.md
//
// FLOW
//   1. /signin sends the person to the club hub's /connect/tournament screen.
//   2. The club hub sends them back to /signin#hub_token=<access token>.
//   3. /signin POSTs { hubToken } here.
//   4. _hubAuth.js checks the token against the club hub's PUBLIC key. If it
//      is genuine, this file looks the person up by hubSub:
//        - found + approved   -> a session, byte-identical to login.js's
//        - found + pending    -> 403 { pending: true }
//        - not found          -> a PENDING account is created with NO role,
//                                and 403 { pending: true }. An organiser gives
//                                it a role on the Accounts tab (accounts-admin
//                                'approve' now takes role + ageGroupId).
//
// ⚠️ MATCH ON hubSub, NEVER ON EMAIL. Same ruling google-auth.js made about
// googleSub, for the same reason: an email match is a weaker proof than the
// signature that just verified, and the club hub's own onboarding trap (an
// invite at a work address, a signup at a personal one) is exactly what
// email matching produces. Existing manager accounts are therefore NOT
// linked automatically — the organiser re-approves each person once, which
// for fifteen managers is one morning.
//
// ⚠️ THE LOGIN LIMITER, NOT THE SIGNUP ONE. A verified token is a sign-in.
// Only FAILED verifications count, against the connection bucket only,
// because fifteen managers behind one venue address must never share a
// budget that a correct sign-in spends (see login.js for the history).
//
// ⚠️ THE ISSUER AND KEY URL ARE CONSTANTS IN _hubAuth.js — there is nothing
// to configure in Netlify for this file except SESSION_SECRET, which every
// other auth function already needs.

const { loadAccounts, saveAccounts, sign, blobStore } = require('./_auth');
const { peekRate, recordFailure, tooManyResponse } = require('./_ratelimit');
const { recordSignIn } = require('./_signins');
const { verifyHubToken } = require('./_hubAuth');

const CONNECTION_RATE_OPTS = { max: 50, windowMs: 15 * 60 * 1000 };
const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';
const connectionBucket = (event) => `${clientIp(event)}:hub`;

/* The same sessionFor() switch login.js and google-auth.js use — the three
   files must agree, or which door somebody came in through starts to matter
   to every downstream reader. test-hub-auth.js asserts this copy is
   character-for-character the one in login.js. */
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

/* A username from the email's local part — `jane.smith@x` -> `jane.smith`.
   Usernames are the key every other store uses (sessionsValidFrom, sign-ins,
   submittedBy), so a hub account still needs one. Letters, digits, dots and
   hyphens only; anything else is dropped rather than encoded. */
function usernameFromEmail(email) {
  const local = String(email || '').split('@')[0].toLowerCase();
  const clean = local.replace(/[^a-z0-9.-]/g, '').replace(/^[.-]+|[.-]+$/g, '');
  return clean || 'hub-user';
}

function uniqueUsername(base, accounts) {
  const taken = new Set(accounts.map((a) => a.username));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

const PENDING = { ok: false, pending: true, error: 'You’re in. A tournament organiser will give you a role shortly.' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { hubToken } = JSON.parse(event.body || '{}');
    const store = blobStore('config');
    const now = Date.now();

    /* PEEK, do not count: reading the counter costs a correct sign-in nothing. */
    const perConnection = await peekRate(store, connectionBucket(event), now, CONNECTION_RATE_OPTS);
    if (!perConnection.ok) return tooManyResponse(perConnection);

    const verified = await verifyHubToken(hubToken, { now });
    if (!verified.ok) {
      await recordFailure(store, connectionBucket(event), now, CONNECTION_RATE_OPTS);
      /* One sentence for every refusal. Naming the reason ("expired",
         "wrong issuer") would tell a forger which check they got past. */
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Club Hub sign-in could not be verified. Please try again from the Club Hub.' }) };
    }
    const identity = verified.payload;

    const accounts = await loadAccounts();
    const existing = accounts.find((a) => a.hubSub === identity.sub);

    if (existing) {
      if (!existing.approved || !existing.role) {
        return { statusCode: 403, body: JSON.stringify(PENDING) };
      }
      await recordSignIn(existing.username);
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...sessionFor(existing) }) };
    }

    /* First time through the hub door: a pending account with NO role. The
       organiser decides the role at approval — nothing about a club hub login
       says whether this person runs an age group or the desk. */
    const account = {
      username: uniqueUsername(usernameFromEmail(identity.email), accounts),
      hubSub: identity.sub,
      email: identity.email,
      name: identity.name || identity.email,
      role: null,
      approved: false,
      source: 'hub',
      createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    await saveAccounts(accounts);
    return { statusCode: 403, body: JSON.stringify(PENDING) };
  } catch (err) {
    console.error('hub-auth error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
