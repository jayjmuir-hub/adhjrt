// netlify/functions/accounts-admin.js
//
// Lets a signed-in Organizer view every account (organizer + manager)
// and approve or reject pending signups. Requires an Authorization:
// Bearer <token> header minted by login.js, google-auth.js or
// organizer-signup.js
// — any organizer can approve/reject any account, including other
// organizers (this is a small trusted team, not a public product).
//
// GET  -> { ok, accounts: [{ username, name, role, title, ageGroupId, approved, createdAt }] }
// POST -> { action: 'approve'|'reject'|'revoke', username }
//      -> { action: 'create',   role, name, username, password, ageGroupId?, title? }
//      -> { action: 'password', username, password }        reset someone else's
//      -> { action: 'changeMine', currentPassword, password } change your own
//
// 'create' mints a login directly — already approved, ready to sign in —
// instead of the invite-code self-signup plus approval loop.
//
//   role:'manager'   needs ageGroupId. This is how it has always worked.
//   role:'organizer' needs no age group; takes an optional free-text title.
//                    ADDED 27 Jul 2026. Before it, there was no way to make an
//                    organizer except sharing ORGANIZER_INVITE_CODE and then
//                    approving them — one code for everybody, no expiry, no
//                    revoking it for one person, and no record of who used it.
//                    With this here, that variable WAS deleted from Netlify
//                    (3 Aug 2026), and organizer-signup.js now refuses every
//                    signup on its own — it 401s while the variable is absent
//                    — which also shut the first-organizer-auto-approved
//                    bootstrap. THIS IS NOW THE ONLY WAY TO MAKE AN ORGANISER.
//
// 'password' and 'changeMine' BOTH EXISTED IN THE UI AND NOWHERE ELSE until
// 27 Jul 2026. Organizer.dc.html called api.resetAccountPassword() and
// api.changeMyPassword(); neither function existed in organizer-data.js and
// neither action existed here. Both dialogs opened, took a new password,
// closed, and did nothing — the TypeError went to the browser console and the
// screen showed no error at all. If you are adding another action, add the
// data-layer function in the same commit; test-accounts.js now checks every
// api.* the page calls actually exists.

const { loadAccounts, saveAccounts, hashPassword, verifyPassword, resolveSession, sessionRefusal, passwordProblem, signInMethodOf } = require('./_auth');
const { readSignIns } = require('./_signins');

// Age-group ids a created manager may be bound to. Mirrors AGE_GROUPS in
// scores-data.js. '*' is the special "all age groups" admin-manager.
const VALID_AGE_GROUP_IDS = new Set([
  'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u12g', 'u13',
  'u14b', 'u14g', 'u16b', 'u16g', 'u18b', 'u18g', '*',
]);

/* ⚠️ resolveSession, NOT verify. This door in particular has to re-read the
   account: a revoked organiser holding a still-signed token used to pass here
   and could then re-approve themselves and create a fresh organiser account,
   which made revocation reversible by the person being revoked. See _auth.js. */
async function requireOrganizer(event) {
  const r = await resolveSession(event);
  if (!r.ok) return r;
  if (r.session.role !== 'organizer') {
    return { ok: false, status: 403, error: 'Only tournament organisers can manage accounts.' };
  }
  return r;
}

exports.handler = async (event) => {
  const auth = await requireOrganizer(event);
  if (!auth.ok) return sessionRefusal(auth);
  const session = auth.session;

  try {
    if (event.httpMethod === 'GET') {
      const accounts = await loadAccounts();
      /* Last sign-in per account, from the separate store. Read here rather
         than by a second call from the page: the card's other-person mode
         renders this listing and nothing else, so one round trip keeps it one
         round trip. A store that cannot be read yields nulls, not an error —
         the Accounts tab must not go blank over a display field. */
      const signIns = await readSignIns(accounts.map((a) => a.username));
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          // googleSub is an internal Google account id, not meant for display —
          // stripped the same way passwordHash is. signInMethod is a display-only
          // convenience, now rendered on the My account card in other-person
          // mode. ⚠️ It comes from _auth.js's signInMethodOf() and must NOT be
          // derived here: the local version this replaced could not return
          // 'Both', so a password login with Google linked read as "Google
          // only" — see the comment on that function.
          accounts: accounts.map(({ passwordHash, googleSub, ...rest }) => ({ ...rest, signInMethod: signInMethodOf({ passwordHash, googleSub }), lastSignInAt: signIns[rest.username] || null })),
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
        /* Defaults to manager, because that is what every existing caller
           meant before organizers could be created here. */
        const role = (payload.role || 'manager').trim();
        const ageGroupId = (payload.ageGroupId || '').trim();

        if (role !== 'manager' && role !== 'organizer') {
          return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'A login is either a manager or an organiser.' }) };
        }
        if (!name || !newUname || !password) {
          return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Name, username and password are all required.' }) };
        }
        const pwErr = passwordProblem(password);
        if (pwErr) return { statusCode: 400, body: JSON.stringify({ ok: false, error: pwErr }) };

        /* An age group is what SCOPES a manager — it is the only thing standing
           between them and every other group's registrations, and the signed
           token carries it. An organizer has no age group because they see
           everything, so requiring one would be theatre. */
        if (role === 'manager') {
          if (!ageGroupId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'A manager login needs an age group.' }) };
          if (!VALID_AGE_GROUP_IDS.has(ageGroupId)) {
            return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown age group.' }) };
          }
        }

        const all = await loadAccounts();
        if (all.some((a) => a.username === newUname)) {
          return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };
        }
        const passwordHash = await hashPassword(password);
        const account = {
          username: newUname, passwordHash, name, role,
          approved: true, createdAt: new Date().toISOString(), createdBy: session.username,
        };
        if (role === 'manager') account.ageGroupId = ageGroupId;
        else account.title = (payload.title || '').trim() || 'Organizer';
        all.push(account);
        await saveAccounts(all);
        return { statusCode: 200, body: JSON.stringify({ ok: true, role }) };
      }

      /* Change your OWN password. The current one has to be given and is
         checked against the stored hash — a stolen session should not be enough
         to lock the real owner out of their own account. */
      /* 'changeMine' MOVED OUT on 3 Aug 2026, to my-account.js. Changing your
         OWN password is not an administrative act, and behind this file's
         requireOrganizer door a manager could never reach it — they had no way
         to change their own password at all. Two ways to do it would be two
         rules that drift, so this one went rather than being kept. Everything
         below stays: acting on SOMEONE ELSE'S account is genuinely an organiser
         power and belongs behind that door. */

      const username = payload.username;
      const uname = (username || '').trim().toLowerCase();
      const accounts = await loadAccounts();
      const idx = accounts.findIndex((a) => a.username === uname);
      if (idx === -1) return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'Account not found.' }) };

      /* Reset SOMEONE ELSE'S password. No current password, because the whole
         point is that they have lost theirs — the authority is the organizer
         session that got this far. Never emailed and never shown again: the
         organizer typed it and hands it over themselves. */
      if (action === 'password') {
        const pwErr = passwordProblem(payload.password || '');
        if (pwErr) return { statusCode: 400, body: JSON.stringify({ ok: false, error: pwErr }) };
        accounts[idx].passwordHash = await hashPassword(payload.password);
        accounts[idx].passwordChangedAt = new Date().toISOString();
        accounts[idx].passwordChangedBy = session.username;
        /* ⚠️ A RESET MUST END THE OLD SESSIONS, or it is not a recovery — it is
           just a second way in. The reason to reset someone's password is
           usually that it, or their phone, is in the wrong hands; leaving the
           tokens minted from the old one alive for six months hands that person
           exactly what the reset was meant to take away. */
        accounts[idx].sessionsValidFrom = Date.now();
        await saveAccounts(accounts);
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      if (action === 'approve') {
        accounts[idx].approved = true;
        /* Approving a REVOKED account is a restore, so the mark comes off and
           it goes back to the ordinary list. Their old tokens stay dead:
           sessionsValidFrom is deliberately NOT cleared here. */
        delete accounts[idx].revokedAt;
      } else if (action === 'reject') {
        /* Deleting the record is enough on its own now: resolveSession 401s a
           token whose account it cannot find. It did NOT used to be. */
        accounts.splice(idx, 1);
      } else if (action === 'revoke') {
        accounts[idx].approved = false;
        /* Belt and braces. `approved: false` is what resolveSession checks, but
           stamping the clock too means a later re-approval does not silently
           resurrect the tokens this revocation was meant to kill. */
        accounts[idx].sessionsValidFrom = Date.now();
        /* ⚠️ REVOKED AND NEVER-APPROVED ARE TWO DIFFERENT THINGS, AND UNTIL
           11 Aug 2026 THEY WERE ONE BOOLEAN. The pending queue is
           `filter(a => !a.approved)`, so revoking somebody filed them under
           "Waiting for access" beside genuine new signups — offering Approve,
           which silently reinstates the person just revoked, and Reject, which
           DELETES the record outright. Jay pressed Reject by accident doing
           exactly this, describing it as dismissing a stray row, which is
           precisely how it reads on a queue of requests. A destructive,
           unrecoverable action sat one natural click after a routine one.

           ⚠️ IT IS ITS OWN FIELD RATHER THAN BEING DERIVED FROM
           sessionsValidFrom, WHICH LOOKS TEMPTING AND IS WRONG: a password
           reset stamps that same field, so an account that had been reset and
           was later unapproved would read as revoked. Two facts, two fields. */
        accounts[idx].revokedAt = new Date().toISOString();
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
