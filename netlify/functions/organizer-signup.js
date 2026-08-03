// netlify/functions/organizer-signup.js
//
// ⚠️ THIS ENDPOINT IS DELIBERATELY INERT AS OF 3 AUG 2026, AND THAT IS NOT
// A BUG. Jay deleted ORGANIZER_INVITE_CODE in Netlify that day, and the guard
// below refuses EVERY signup while the variable is absent. Organiser accounts
// are made in the back office instead: /organizer -> Accounts -> Create a
// login -> Organiser (accounts-admin.js, action 'create'), which approves
// immediately and records createdBy.
//
// WHY, in one line: a shared code has no expiry, cannot be revoked for one
// person, and leaves no record of who used it. A named account has all three.
// Deleting the variable also shut the first-organizer-auto-approved bootstrap
// below, which would otherwise hand an approved organiser account — and
// children's medical notes — to whoever signed up first if the accounts blob
// were ever lost.
//
// The file is KEPT, not deleted, because it is the recovery path: if every
// organiser account were ever lost there would be no way back in. Re-add
// ORGANIZER_INVITE_CODE in Netlify, sign up (the first organiser
// auto-approves), then delete the variable again. No deploy either way — the
// variable is read per request.
//
// test-accounts.js's "a missing invite code refuses every signup" is what
// keeps that true; it is now load-bearing rather than a nice-to-have.
//
// What this function does when the variable IS set: creates an Organizer
// account — full access to team & player registrations, including medical
// notes — requiring BOTH the code AND approval by an existing organizer
// afterwards. Accounts live in Netlify Blobs (see _auth.js).
//
// SESSION_SECRET must be set regardless (any long random string, shared with
// every other auth function; see _auth.js).

const { loadAccounts, saveAccounts, hashPassword, sign, passwordProblem, blobStore } = require('./_auth');
const { checkSignupRate, tooManyResponse } = require('./_ratelimit');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    // Before anything is parsed or compared: the invite code below is checked
    // with a plain string compare, so without this it took unlimited guesses.
    const rate = await checkSignupRate(blobStore('config'), event, Date.now());
    if (!rate.ok) return tooManyResponse(rate);
    const { name, title, username, password, inviteCode } = JSON.parse(event.body || '{}');
    if (!name || !username || !password || !inviteCode) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'All fields are required.' }) };
    }
    if (!process.env.ORGANIZER_INVITE_CODE || inviteCode !== process.env.ORGANIZER_INVITE_CODE) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect invite code.' }) };
    }
    const pwErr = passwordProblem(password);
    if (pwErr) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: pwErr }) };
    }

    const uname = username.trim().toLowerCase();
    const accounts = await loadAccounts();
    if (accounts.some((a) => a.username === uname)) {
      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };
    }

    const isFirstOrganizer = !accounts.some((a) => a.role === 'organizer');
    const passwordHash = await hashPassword(password);
    const account = {
      username: uname, passwordHash, name, role: 'organizer',
      title: title || 'Organizer', approved: isFirstOrganizer, createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    await saveAccounts(accounts);

    if (!account.approved) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, pending: true, message: 'Account created. A tournament organizer needs to approve you before you can sign in.' }) };
    }
    const session = { username: uname, name, role: title || 'Organizer', _role: 'organizer' };
    const token = sign({ username: uname, role: 'organizer' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, session, token }) };
  } catch (err) {
    console.error('organizer-signup error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
