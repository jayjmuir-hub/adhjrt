// netlify/functions/google-auth.js
//
// One endpoint for BOTH "sign in with Google" and "sign up with Google", for
// BOTH organizer and manager accounts. Google sign-in is an ADDITIONAL way
// in, not a replacement — the password path (login.js, plus the two signup
// endpoints) is untouched, existing username/password accounts work exactly
// as before, and every session this issues has the identical shape login.js
// produces, so nothing
// downstream (get-registrations.js, submit-result.js, accounts-admin.js,
// hasAgeGroupAccess in _auth.js) needed to change.
//
// THE ONE THING THIS DOES NOT DO: link a Google identity onto an EXISTING
// password account. A Google sign-in either matches an account already
// created via Google (by its stored googleSub), or creates a brand new one —
// it never silently attaches itself to someone's existing password login,
// even if the email happens to match. That would mean trusting an email
// match as proof of identity, which is a weaker guarantee than the invite
// code + approval gate every other account goes through. If this is wanted
// later it should be an explicit "connect your Google account" action taken
// while already signed in with a password, not automatic.
//
// FLOW
//   1. Client gets an ID token from Google Identity Services, POSTs it here
//      along with { role }.
//   2. Token verifies -> look up an account with a matching googleSub.
//        - found + approved   -> session, byte-identical to login.js's.
//        - found + not approved -> pending message, same as the others.
//        - not found          -> respond { needsSignup: true, name } so the
//          client can show an invite-code step, prefilling the Google name.
//   3. Client resubmits with { role, inviteCode, username, name } (username
//      is client-derived from the Google name via the SAME usernameFromName()
//      + retry-on-409 loop Organizer.dc.html/Scores & Standings.dc.html
//      already use for password signup — no new dedupe logic here).
//   4. Invite code validates exactly like manager-signup.js/organizer-signup.js
//      (same env vars, same bootstrap-first-organizer rule), account is
//      created with googleSub/email instead of a passwordHash, and the
//      response is pending-or-session exactly like every other signup path.
//
// ONE-TIME SETUP: GOOGLE_CLIENT_ID must be set (see _googleAuth.js).
// MANAGER_INVITE_CODES / ORGANIZER_INVITE_CODE / SESSION_SECRET are the same
// variables manager-signup.js/organizer-signup.js already use — nothing new
// to configure there.

const { loadAccounts, saveAccounts, sign } = require('./_auth');
const { verifyGoogleIdToken } = require('./_googleAuth');

function managerCodesMap() {
  try { return JSON.parse(process.env.MANAGER_INVITE_CODES || '{}'); } catch (e) { return {}; }
}

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
    const body = JSON.parse(event.body || '{}');
    const { idToken, role, inviteCode, username, name, title } = body;

    const identity = await verifyGoogleIdToken(idToken);
    if (!identity) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Google sign-in could not be verified. Please try again.' }) };
    }

    const accounts = await loadAccounts();
    const existing = accounts.find((a) => a.googleSub === identity.sub);

    if (existing) {
      if (!existing.approved) {
        return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Your account is still pending approval from a tournament organizer.' }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...sessionFor(existing) }) };
    }

    // No account linked to this Google identity yet. Without an invite code
    // we can't create one — tell the client to prompt for it rather than
    // erroring, since "no account yet" is an expected first-time state, not
    // a failure.
    if (!inviteCode) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, needsSignup: true, name: identity.name }) };
    }

    if (role !== 'organizer' && role !== 'manager') {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'A login is either a manager or an organiser.' }) };
    }
    const uname = (username || '').trim().toLowerCase();
    if (!uname) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'A username is required.' }) };
    }
    if (accounts.some((a) => a.username === uname)) {
      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };
    }

    let ageGroupId;
    if (role === 'manager') {
      const codes = managerCodesMap();
      ageGroupId = Object.keys(codes).find((id) => codes[id] === inviteCode);
      if (!ageGroupId) {
        return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect invite code.' }) };
      }
    } else {
      if (!process.env.ORGANIZER_INVITE_CODE || inviteCode !== process.env.ORGANIZER_INVITE_CODE) {
        return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect invite code.' }) };
      }
    }

    const isFirstOrganizer = role === 'organizer' && !accounts.some((a) => a.role === 'organizer');
    const account = {
      username: uname,
      passwordHash: null, // signed in with Google, not a password — see verifyPassword callers, none of which this account ever reaches
      name: (name || identity.name || '').trim() || identity.email,
      role,
      // Same default-to-'Organizer' rule as organizer-signup.js — a blank
      // title box must land the same way a password signup's blank box does.
      ...(role === 'manager' ? { ageGroupId } : { title: title || 'Organizer' }),
      approved: role === 'organizer' ? isFirstOrganizer : false,
      createdAt: new Date().toISOString(),
      googleSub: identity.sub,
      email: identity.email,
    };
    accounts.push(account);
    await saveAccounts(accounts);

    if (!account.approved) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, pending: true, message: 'Account created. A tournament organizer needs to approve you before you can sign in.' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...sessionFor(account) }) };
  } catch (err) {
    console.error('google-auth error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
