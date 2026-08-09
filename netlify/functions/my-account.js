// netlify/functions/my-account.js
//
// SELF-SERVICE FOR THE ACCOUNT YOU ARE SIGNED IN AS — both roles.
// Design: claude/specs/spec-my-account.md
//
//   GET                                                -> your own account, safe fields
//   POST { action:'password',   currentPassword, password } -> change your own password
//   POST { action:'linkGoogle', idToken }                   -> attach a Google identity to your own login
//
// ⚠️ THE DOOR IS ANY VALID SESSION, NOT AN ORGANISER SESSION, and that is the
// whole reason this is not in accounts-admin.js — that file's requireOrganizer
// gate applies to every action behind it, so a manager gets a 401 there. A
// manager changing their own password or linking their own Google account is
// not an administrative act.
//
// ⚠️ THE ACCOUNT ACTED ON IS ALWAYS THE ONE IN THE VERIFIED TOKEN, NEVER A
// USERNAME FROM THE BODY. Standing rule in this codebase, and here it is the
// only thing between "link my Google account" and "link my Google account to
// somebody else's login". There is deliberately no code path that reads a
// username, id or role off the request.
//
// WHY LINKING EXISTS AT ALL: google-auth.js finds an existing account exactly
// one way, `accounts.find((a) => a.googleSub === identity.sub)`, and nothing
// sets googleSub except signing up THROUGH Google. So an account created in
// the back office — which, since ORGANIZER_INVITE_CODE was deleted on 3 Aug
// 2026, is every new organiser — could never use the Google button. Linking
// closes that by making the person prove BOTH halves: the account, by holding
// a session for it, and the Google identity, by producing a valid token.
// google-auth.js still never attaches itself to anyone silently.

const { loadAccounts, saveAccounts, hashPassword, verifyPassword, resolveSession, passwordProblem, signInMethodOf } = require('./_auth');
const { verifyGoogleIdToken } = require('./_googleAuth');
const { readSignIn } = require('./_signins');

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const fail = (statusCode, error) => json(statusCode, { ok: false, error });

/* Safe fields only. passwordHash never leaves, and neither does googleSub —
   it is an internal Google account id, the caller has no use for it, and
   accounts-admin.js already strips it from its own listing for the same
   reason. signInMethod is the derived boolean the card actually needs. */
function publicView(a) {
  return {
    name: a.name || '',
    username: a.username,
    role: a.role,
    title: a.title || '',
    ageGroupId: a.ageGroupId || '',
    approved: !!a.approved,
    createdAt: a.createdAt || '',
    passwordChangedAt: a.passwordChangedAt || '',
    // ⚠️ From _auth.js — the ONE copy. accounts-admin.js's listing derives the
    // same field for the same card in other-person mode; when each had its own
    // they disagreed. See signInMethodOf().
    signInMethod: signInMethodOf(a),
  };
}

exports.handler = async (event) => {
  const auth = await resolveSession(event);
  if (!auth.ok) return fail(auth.status, auth.error);
  const session = auth.session;

  try {
    const all = await loadAccounts();
    const me = all.findIndex((a) => a.username === session.username);
    /* resolveSession already proved this account exists, so reaching here means
       it was deleted between the two reads. Kept rather than trusted away: it
       is one comparison, and every index below depends on it. */
    if (me === -1) return fail(404, 'Your account no longer exists.');

    if (event.httpMethod === 'GET') {
      /* Last sign-in comes from its own store, not the account record — see
         _signins.js for why. null means "no record", which the card renders
         as Never; it is never allowed to fail the whole GET. */
      const lastSignInAt = await readSignIn(all[me].username);
      return json(200, { ok: true, account: { ...publicView(all[me]), lastSignInAt } });
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

    const payload = JSON.parse(event.body || '{}');

    /* Change your OWN password. The current one is required — a session alone
       must not be enough to set a new password, or a borrowed laptop is a
       permanent takeover. (Contrast accounts-admin.js's 'password' action,
       where an organiser resets SOMEONE ELSE'S and there is no current
       password to give, because the whole point is that it is lost.) */
    if (payload.action === 'password') {
      const current = payload.currentPassword || '';
      const next = payload.password || '';
      if (!current) return fail(400, 'Enter your current password.');
      // The floor applies when a password is SET, never when one is checked.
      const pwErr = passwordProblem(next);
      if (pwErr) return fail(400, pwErr);
      /* A Google-only account has no passwordHash at all. Answer it the same
         way a wrong password is answered rather than letting verifyPassword
         take a null and turn a foreseeable state into a 500. */
      if (!all[me].passwordHash || !(await verifyPassword(current, all[me].passwordHash))) {
        return fail(401, 'That is not your current password.');
      }
      all[me].passwordHash = await hashPassword(next);
      all[me].passwordChangedAt = new Date().toISOString();
      await saveAccounts(all);
      return json(200, { ok: true, account: publicView(all[me]) });
    }

    if (payload.action === 'linkGoogle') {
      const identity = await verifyGoogleIdToken(payload.idToken);
      if (!identity) return fail(401, 'Google sign-in could not be verified. Please try again.');

      /* ⚠️ ALREADY ON ANOTHER ACCOUNT -> REFUSE. The one that really matters.
         google-auth.js resolves a sign-in with find(), so two accounts sharing
         an identity resolve to whichever comes first in the list — a silent
         account mix-up in a system holding children's dates of birth and
         medical notes. Compared against every account, not just this one. */
      const clash = all.findIndex((a) => a.googleSub === identity.sub);
      if (clash !== -1 && clash !== me) {
        return fail(409, 'That Google account is already linked to a different login.');
      }

      /* Re-linking the SAME identity is a no-op success, so a double-click or
         a retry after a dropped connection is harmless. */
      if (all[me].googleSub === identity.sub) {
        return json(200, { ok: true, alreadyLinked: true, account: publicView(all[me]) });
      }

      /* ⚠️ REFUSE, DO NOT REPLACE. Replacing would let a stolen session swap
         the Google identity to the attacker's own — a way back in that
         survives the real owner changing their password. There is deliberately
         no unlink and no move; if that is ever needed it belongs behind the
         organiser door as an explicit clear, not hidden inside a link. */
      if (all[me].googleSub) {
        return fail(409, 'This login already has a different Google account linked. Ask a tournament organizer.');
      }

      all[me].googleSub = identity.sub;
      // Only fill the email in if there isn't one — never overwrite what the
      // account was created with.
      if (!all[me].email && identity.email) all[me].email = identity.email;
      all[me].googleLinkedAt = new Date().toISOString();
      await saveAccounts(all);
      return json(200, { ok: true, account: publicView(all[me]) });
    }

    return fail(400, 'Unknown action.');
  } catch (err) {
    console.error('my-account error:', err);
    return fail(500, 'Server error.');
  }
};
