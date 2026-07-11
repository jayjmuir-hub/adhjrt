// netlify/functions/organizer-login.js
//
// Signs in an existing Organizer account (created via
// organizer-signup.js). Returns a session token that get-registrations.js
// checks on every request — see _auth.js for how tokens work.

const { loadAccounts, verifyPassword, sign } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { username, password } = JSON.parse(event.body || '{}');
    const uname = (username || '').trim().toLowerCase();
    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.username === uname && a.role === 'organizer');
    if (!account || !(await verifyPassword(password || '', account.passwordHash))) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect username or password.' }) };
    }
    const session = { username: account.username, name: account.name, role: account.title || 'Organizer', _role: 'organizer' };
    const token = sign({ username: account.username, role: 'organizer' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, session, token }) };
  } catch (err) {
    console.error('organizer-login error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
