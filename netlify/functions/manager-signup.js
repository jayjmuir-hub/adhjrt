// netlify/functions/manager-signup.js
//
// Creates a new age-group Manager account. Which age group the account
// can enter scores for is decided entirely by which invite code was
// used — there's no dropdown, so a manager can never accidentally sign
// up for (or be tricked into) the wrong group.
//
// ONE-TIME SETUP: in Netlify -> Site configuration -> Environment
// variables, add:
//   MANAGER_INVITE_CODES = a JSON map of age-group id -> its own code, e.g.
//     {"u8":"quins-u8-2026","u9":"quins-u9-2026", ..., "admin":"quins-master-2026"}
//   (age-group ids must match the `id` fields in AGE_GROUPS in scores-data.js:
//    u6,u7,u8,u9,u10,u11,u12,u12g,u13,u14b,u14g,u16b,u16g,u18b,u18g)
//   The special "admin" key's code grants access to every age group at once —
//   share it only with the tournament admin(s).
// SESSION_SECRET must also be set (shared with the other auth functions).
// Share each age group's code only with that group's manager(s).

const { loadAccounts, saveAccounts, hashPassword, sign } = require('./_auth');

function codesMap() {
  try { return JSON.parse(process.env.MANAGER_INVITE_CODES || '{}'); } catch (e) { return {}; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { name, username, password, inviteCode } = JSON.parse(event.body || '{}');
    if (!name || !username || !password || !inviteCode) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'All fields are required.' }) };
    }
    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Password must be at least 6 characters.' }) };
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
      ageGroupId, createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    await saveAccounts(accounts);

    const session = { username: uname, name, ageGroupId };
    const token = sign({ username: uname, role: 'manager', ageGroupId });
    return { statusCode: 200, body: JSON.stringify({ ok: true, session, token }) };
  } catch (err) {
    console.error('manager-signup error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
