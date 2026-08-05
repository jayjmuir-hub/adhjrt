// netlify/functions/manager-signup.js
//
// Creates a new age-group Manager account. Which age group the account
// can enter scores for is decided entirely by which invite code was
// used — there's no dropdown, so a manager can never accidentally sign
// up for (or be tricked into) the wrong group. The account is created
// pending until an organizer approves it from the Organizer dashboard's
// Accounts tab (see accounts-admin.js) — they cannot sign in until then.
//
// ONE-TIME SETUP: in Netlify -> Site configuration -> Environment
// variables, add:
//   MANAGER_INVITE_CODES = a JSON map of age-group id -> its own code, e.g.
//     {"u8":"quins-u8-2026","u9":"quins-u9-2026", ..., "*":"quins-master-2026"}
//   (age-group ids must match the `id` fields in AGE_GROUPS in scores-data.js:
//    u6,u7,u8,u9,u10,u11,u12,u12g,u13,u14b,u14g,u16b,u16g,u18b,u18g)
//
//   ⚠️ THE MASTER KEY MUST BE NAMED "*" — A LITERAL ASTERISK. THIS COMMENT
//   SAID "admin" UNTIL 5 AUG 2026 AND THAT DOES NOT WORK.
//   The handler below stores whichever KEY NAME matched the code as the
//   account's ageGroupId, and the all-groups test in _auth.js is
//   `session.ageGroupId === '*'`. A key called "admin" therefore mints a
//   manager scoped to an age group that does not exist — an account with
//   access to NOTHING, which signs in fine and then shows an empty dashboard.
//   It fails CLOSED, so it was never a security hole; it is worse in a
//   quieter way, because setting up a master code by following the old
//   instruction produced a broken account and no error message anywhere.
//   Nothing validates that these key names are real age-group ids either, so
//   an ordinary typo fails the same silent way.
//   Share the "*" code only with the tournament admin(s).
// SESSION_SECRET must also be set (shared with the other auth functions).
// Share each age group's code only with that group's manager(s).

const { loadAccounts, saveAccounts, hashPassword, sign, passwordProblem, blobStore } = require('./_auth');
const { checkSignupRate, tooManyResponse } = require('./_ratelimit');

function codesMap() {
  try { return JSON.parse(process.env.MANAGER_INVITE_CODES || '{}'); } catch (e) { return {}; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    // Same guard as organizer-signup.js, same bucket - see _ratelimit.js.
    const rate = await checkSignupRate(blobStore('config'), event, Date.now());
    if (!rate.ok) return tooManyResponse(rate);
    const { name, username, password, inviteCode } = JSON.parse(event.body || '{}');
    if (!name || !username || !password || !inviteCode) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'All fields are required.' }) };
    }
    const pwErr = passwordProblem(password);
    if (pwErr) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: pwErr }) };
    }

    const codes = codesMap();
    const ageGroupId = Object.keys(codes).find((id) => codes[id] === inviteCode);
    if (!ageGroupId) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect invite code.' }) };
    }

    const uname = username.trim().toLowerCase();
    const accounts = await loadAccounts();
    if (accounts.some((a) => a.username === uname)) {
      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };
    }

    const passwordHash = await hashPassword(password);
    const account = {
      username: uname, passwordHash, name, role: 'manager',
      ageGroupId, approved: false, createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    await saveAccounts(accounts);

    return { statusCode: 200, body: JSON.stringify({ ok: true, pending: true, message: 'Account created. A tournament organizer needs to approve you before you can sign in.' }) };
  } catch (err) {
    console.error('manager-signup error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
