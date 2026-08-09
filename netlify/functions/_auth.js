// netlify/functions/_auth.js
//
// Shared helpers for the account system — not an HTTP endpoint itself,
// just required by the functions that are. Handles:
//   - the Netlify Blobs "accounts" store (one JSON list of every
//     organizer + manager account, across both roles)
//   - password hashing/verification (bcrypt)
//   - signing/verifying session tokens (HMAC-SHA256, stateless — no
//     session table needed; anyone holding a valid token is trusted
//     for whatever role/ageGroupId is embedded in it)
//
// Requires the SESSION_SECRET environment variable — any long random
// string. Set it once in Netlify (Site configuration -> Environment
// variables) before any signup/login function is used; changing it
// later invalidates every existing session (forces re-login), which is
// fine and sometimes useful (e.g. if you ever suspect it leaked).

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getStore } = require('@netlify/blobs');

// Netlify is supposed to auto-inject Blobs config (site ID + token) into
// every function's environment, but on some sites/deploys that auto-wiring
// doesn't kick in and getStore('name') throws MissingBlobsEnvironmentError.
// Falling back to explicit siteID/token (from env vars you set once in
// Netlify — see README note below) works around that unconditionally.
//
// ONE-TIME SETUP (only needed if you see MissingBlobsEnvironmentError in a
// function's log): in Netlify -> Project configuration -> General ->
// Project information, copy "Project ID". Then User settings (click your
// avatar) -> Applications -> Personal access tokens -> New access token,
// generate one. Add both as environment variables:
//   BLOBS_SITE_ID = (the Project ID)
//   BLOBS_TOKEN   = (the personal access token)
function blobStore(name) {
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({ name, siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
  }
  return getStore(name);
}

function accountsStore() {
  return blobStore('accounts');
}

async function loadAccounts() {
  const store = accountsStore();
  const list = await store.get('list', { type: 'json' });
  return list || [];
}

async function saveAccounts(list) {
  const store = accountsStore();
  await store.setJSON('list', list);
}

/* The password-length rule lives in _password.js — policy, not cryptography,
   and dependency-free so a test can require it without bcrypt. Re-exported
   below so every existing `require('./_auth')` keeps working. */
const { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT, passwordProblem } = require('./_password');

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/* 30 Jul: a token used to be valid forever — nothing ever checked `iat`
   against the current time, so the only way to end a lost/stolen session was
   rotating SESSION_SECRET for every signed-in person at once. Originally set
   to 14 days; Jay asked (same day, after the first deploy of this check
   signed everyone already logged in out once) for six months instead —
   organizers and managers keep their season-long sign-in without
   re-entering a password, while a token found on a lost or resold phone
   still stops working eventually rather than lasting forever. */
const SESSION_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000; // ~6 months

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret || !token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    // A token with no `iat` at all predates this check (or is malformed) —
    // treat it as expired rather than trusting it forever.
    if (!Number.isFinite(payload.iat) || Date.now() - payload.iat > SESSION_MAX_AGE_MS) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getBearerToken(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

/* ⚠️ verify() ALONE IS NOT A DOOR. It proves the token was signed by us and is
   under six months old — nothing more. It cannot know that the account was
   revoked, rejected, demoted, or had its password reset ten minutes ago,
   because a token is a signed snapshot of what was true when it was minted and
   this system keeps no session table.

   Until Aug 2026 every guarded endpoint called verify() and stopped there. So
   an organiser pressing Revoke changed the accounts blob and changed NOTHING
   ELSE: the revoked person's phone kept working for up to 182 days — still
   posting scores, still publishing fixtures, still reading their age group's
   children's dates of birth and medical notes. `reject`, which deletes the
   account outright, was equally cosmetic. And a revoked ORGANISER's token still
   passed requireOrganizer, so they could re-approve themselves and mint a fresh
   organiser account — revocation was not merely delayed, it was reversible by
   the person being revoked. The only real remedy was rotating SESSION_SECRET,
   which signs the whole committee out at once.

   resolveSession() is that missing half. It costs one small blob read per
   authenticated request, which is the price of Revoke meaning anything.

   ⚠️ ROLE AND AGE GROUP ARE RE-DERIVED FROM THE ACCOUNT, NOT READ OFF THE
   TOKEN. That is what makes a DEMOTION take effect too — moving a manager from
   u16b to u12, or an organiser down to manager, used to leave the old powers
   signed into the old token until it aged out.

   ⚠️ IT FAILS CLOSED, AND DISTINGUISHES THE TWO REASONS. A blob read that
   ERRORS gives 503 "try again", never 401 — a 401 would sign a manager out
   mid-tournament over a transient blip and send them hunting for a password
   they have not typed since August. A token that is genuinely revoked gives
   401/403 and says so. The one thing it must never do is fall through to
   "allowed" on an error; see _ratelimit.js for what fail-open costs. */
async function resolveSession(event) {
  const payload = verify(getBearerToken(event));
  if (!payload) return { ok: false, status: 401, error: 'Not signed in.' };

  let accounts;
  try {
    accounts = await loadAccounts();
  } catch (err) {
    console.error('auth: could not read accounts to check the session —', err && err.message);
    return { ok: false, status: 503, error: 'Could not check your sign-in just now. Please try again.' };
  }

  const account = accounts.find((a) => a.username === payload.username);
  if (!account) return { ok: false, status: 401, error: 'This login no longer exists. Ask a tournament organizer.' };
  if (!account.approved) return { ok: false, status: 403, error: 'This login has been revoked. Ask a tournament organizer.' };

  /* Stamped by accounts-admin.js when an account is revoked or has its password
     reset. Absent on every account created before Aug 2026, so a missing stamp
     MUST read as "no stamp" or the whole committee is signed out on deploy.
     ⚠️ The `|| 0` is not what carries that, and I checked rather than assumed:
     Number(undefined) is NaN, and `anything < NaN` is already false, so an
     absent stamp is permissive by JavaScript's own rules with or without it.
     It is here to make the intent explicit and to stop the next person
     "tidying" it into something with a live default — `|| Date.now()` would
     sign everyone out on every request, and reads almost identically. */
  const validFrom = Number(account.sessionsValidFrom) || 0;
  if (payload.iat < validFrom) {
    return { ok: false, status: 401, error: 'You have been signed out. Please sign in again.' };
  }

  return {
    ok: true,
    session: {
      ...payload,
      username: account.username,
      role: account.role,
      ageGroupId: account.role === 'manager' ? (account.ageGroupId || '') : '',
    },
  };
}

/* The same check for the endpoints that treat a session as OPTIONAL — the
   public gets an answer either way, a signed-in person gets more. Returns the
   session or null, never an error, because there is nothing to report: a bad,
   revoked or unverifiable token simply means "answer as the public".
   ⚠️ Note the deliberate asymmetry with resolveSession's 503: here a blob blip
   downgrades to the PUBLIC answer, which is safe, rather than erroring. */
async function optionalSession(event) {
  const r = await resolveSession(event);
  return r.ok ? r.session : null;
}

// True if a decoded session token may edit/submit for the given age group.
// Organizers (full access to everything) and the special "admin" manager
// invite code (ageGroupId === '*') can act on any age group; an ordinary
// manager only on their own.
function hasAgeGroupAccess(session, ageGroupId) {
  if (!session) return false;
  if (session.role === 'organizer') return true;
  if (session.role === 'manager') return session.ageGroupId === '*' || session.ageGroupId === ageGroupId;
  return false;
}

/* How an account can sign in, as one word, for display only.
   ⚠️ ONE COPY ON PURPOSE. accounts-admin.js's listing and my-account.js's own
   view both need this, and until Aug 2026 they each had their own: the listing
   said `googleSub ? 'Google' : 'Password'`, which CANNOT EVER SAY 'Both' and
   so reported a password login with Google linked as "Google only". That was
   invisible while nothing displayed the field; the My account card displays it
   as one of five facts about you, and linking made 'Both' an ordinary state
   rather than an impossible one. Two copies of one rule drift — this is the
   one copy, and a test asserts neither file derives it for itself again. */
function signInMethodOf(account) {
  const a = account || {};
  if (a.passwordHash && a.googleSub) return 'Both';
  if (a.googleSub) return 'Google';
  return 'Password';
}

module.exports = { loadAccounts, saveAccounts, hashPassword, verifyPassword, sign, verify, getBearerToken, hasAgeGroupAccess, blobStore,
  resolveSession, optionalSession,
  MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT, passwordProblem, signInMethodOf };
