// netlify/functions/accounts-admin.js
//
// Lets a signed-in Organizer view every account (organizer + manager)
// and approve or reject pending signups. Requires an Authorization:
// Bearer <token> header from organizer-login.js / organizer-signup.js
// — any organizer can approve/reject any account, including other
// organizers (this is a small trusted team, not a public product).
//
// GET  -> { ok, accounts: [{ username, name, role, title, ageGroupId, approved, createdAt }] }
// POST -> { action: 'approve'|'reject'|'revoke', username }
//      -> { action: 'create', name, username, password, ageGroupId }  (new)
//
// The 'create' action lets an organizer mint an age-group Manager login
// directly — already approved, ready to sign in — instead of the invite-code
// self-signup + approval loop. Handy for testing the site, and for onboarding
// a manager without sharing invite codes. Organizer-only, like everything here.

const { loadAccounts, saveAccounts, hashPassword, verify, getBearerToken } = require('./_auth');

// Age-group ids a created manager may be bound to. Mirrors AGE_GROUPS in
// scores-data.js. '*' is the special "all age groups" admin-manager.
const VALID_AGE_GROUP_IDS = new Set([
  'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u12g', 'u13',
  'u14b', 'u14g', 'u16b', 'u16g', 'u18b', 'u18g', '*',
]);

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
      const payload = JSON.parse(event.body || '{}');
      const action = payload.action;

      // Create a brand-new, already-approved manager login. The age group is
      // set explicitly by the trusted organizer making the call.
      if (action === 'create') {
        const name = (payload.name || '').trim();
        const newUname = (payload.username || '').trim().toLowerCase();
        const password = payload.password || '';
        const ageGroupId = (payload.ageGroupId || '').trim();
        if (!name || !newUname || !password || !ageGroupId) {
          return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Name, username, password and age group are all required.' }) };
        }
        if (password.length < 6) {
          return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Password must be at least 6 characters.' }) };
        }
        if (!VALID_AGE_GROUP_IDS.has(ageGroupId)) {
          return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown age group.' }) };
        }
        const all = await loadAccounts();
        if (all.some((a) => a.username === newUname)) {
          return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };
        }
        const passwordHash = await hashPassword(password);
        all.push({
          username: newUname, passwordHash, name, role: 'manager', ageGroupId,
          approved: true, createdAt: new Date().toISOString(), createdBy: session.username,
        });
        await saveAccounts(all);
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      const username = payload.username;
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
