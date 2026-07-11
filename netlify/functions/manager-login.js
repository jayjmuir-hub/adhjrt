// netlify/functions/manager-login.js
//
// Signs in an existing Manager account (created via manager-signup.js).
// Returns a session token that submit-result.js checks on every write —
// see _auth.js for how tokens work.

const { loadAccounts, verifyPassword, sign } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { username, password } = JSON.parse(event.body || '{}');
    const uname = (username || '').trim().toLowerCase();
    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.username === uname && a.role === 'manager');
    if (!account || !(await verifyPassword(password || '', account.passwordHash))) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Wrong username or password.' }) };
    }
    if (!account.approved) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Your account is still pending approval from a tournament organizer.' }) };
    }
    const session = { username: account.username, name: account.name, ageGroupId: account.ageGroupId };
    const token = sign({ username: account.username, role: 'manager', ageGroupId: account.ageGroupId });
    return { statusCode: 200, body: JSON.stringify({ ok: true, session, token }) };
  } catch (err) {
    console.error('manager-login error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
