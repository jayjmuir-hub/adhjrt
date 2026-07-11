// netlify/functions/accounts-admin.js
//
// Lets a signed-in Organizer view every account (organizer + manager)
// and approve or reject pending signups. Requires an Authorization:
// Bearer <token> header from organizer-login.js / organizer-signup.js
// — any organizer can approve/reject any account, including other
// organizers (this is a small trusted team, not a public product).
//
// GET  -> { ok, accounts: [{ username, name, role, title, ageGroupId, approved, createdAt }] }
// POST -> { action: 'approve'|'reject', username }

const { loadAccounts, saveAccounts, verify, getBearerToken } = require('./_auth');

function requireOrganizer(event) {
  const session = verify(getBearerToken(event));
  return session && session.role === 'organizer' ? session : null;
}

exports.handler = async (event) => {
  const session = requireOrganizer(event);
  if (!session) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Not signed in.' }) };

  try {
    if (event.httpMethod === 'GET') {
      const accounts = await loadAccounts();
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          accounts: accounts.map(({ passwordHash, ...rest }) => rest),
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      const { action, username } = JSON.parse(event.body || '{}');
      const uname = (username || '').trim().toLowerCase();
      const accounts = await loadAccounts();
      const idx = accounts.findIndex((a) => a.username === uname);
      if (idx === -1) return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'Account not found.' }) };

      if (action === 'approve') {
        accounts[idx].approved = true;
      } else if (action === 'reject') {
        accounts.splice(idx, 1);
      } else if (action === 'revoke') {
        accounts[idx].approved = false;
      } else {
        return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action.' }) };
      }
      await saveAccounts(accounts);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    console.error('accounts-admin error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
