// netlify/functions/manager-login.js
//
// Signs in an existing Manager account (created via manager-signup.js).
// Returns a session token that submit-result.js checks on every write —
// see _auth.js for how tokens work.

const { loadAccounts, verifyPassword, sign, blobStore } = require('./_auth');
const { checkRate } = require('./_ratelimit');

// See organizer-login.js for why this exists and why the numbers are what
// they are — same fix, same reasoning, applied here too.
const LOGIN_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };
const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const rate = await checkRate(blobStore('config'), `${clientIp(event)}:login`, Date.now(), LOGIN_RATE_OPTS);
    if (!rate.ok) {
      return {
        statusCode: 429,
        body: JSON.stringify({ ok: false, error: 'Too many attempts from this connection. Please try again shortly.', retryAfterSecs: rate.retryAfterSecs }),
      };
    }
    const { username, password } = JSON.parse(event.body || '{}');
    const uname = (username || '').trim().toLowerCase();
    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.username === uname && a.role === 'manager');
    if (!account || !account.passwordHash || !(await verifyPassword(password || '', account.passwordHash))) {
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
