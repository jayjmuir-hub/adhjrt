// netlify/functions/organizer-signup.js
//
// Creates a new Organizer account — full access to team & player
// registrations (including medical notes), so signup is gated by a
// shared invite code rather than being open to anyone with the URL.
// Accounts live in Netlify Blobs (see _auth.js), no separate database.
//
// ONE-TIME SETUP: in Netlify -> Site configuration -> Environment
// variables, add:
//   ORGANIZER_INVITE_CODE = (any code you choose)
//   SESSION_SECRET        = (any long random string — shared with every
//                            other auth function; see _auth.js)
// Then privately share ORGANIZER_INVITE_CODE with whoever should be
// able to create their own organizer login.

const { loadAccounts, saveAccounts, hashPassword, sign } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { name, title, username, password, inviteCode } = JSON.parse(event.body || '{}');
    if (!name || !username || !password || !inviteCode) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'All fields are required.' }) };
    }
    if (!process.env.ORGANIZER_INVITE_CODE || inviteCode !== process.env.ORGANIZER_INVITE_CODE) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect invite code.' }) };
    }
    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Password must be at least 6 characters.' }) };
    }

    const uname = username.trim().toLowerCase();
    const accounts = await loadAccounts();
    if (accounts.some((a) => a.username === uname)) {
      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };
    }

    const passwordHash = await hashPassword(password);
    const account = {
      username: uname, passwordHash, name, role: 'organizer',
      title: title || 'Organizer', createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    await saveAccounts(accounts);

    const session = { username: uname, name, role: title || 'Organizer', _role: 'organizer' };
    const token = sign({ username: uname, role: 'organizer' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, session, token }) };
  } catch (err) {
    console.error('organizer-signup error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
