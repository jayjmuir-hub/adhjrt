// netlify/functions/_signins.js
//
// WHEN EACH ACCOUNT LAST SIGNED IN. Displayed on the My account card (added
// Aug 2026) — on your own it is mostly trivia, on somebody else's it answers
// the question an organiser actually has: has this manager ever got in?
//
// ⚠️ WHY THIS IS ITS OWN STORE AND NOT A FIELD ON THE ACCOUNT.
// Every account lives in ONE blob under the key `list`, and saveAccounts()
// writes the whole array back. Netlify Blobs has no compare-and-set, so a
// write is a whole-object overwrite. Today that is tolerable because the
// accounts blob is written rarely — create, approve, reject, revoke, a
// password change, a Google link. Stamping a sign-in onto the account record
// would make it a write on EVERY LOGIN, and then on tournament morning
// fifteen managers signing in inside a minute, while an organiser approves
// somebody, means one of those writes silently discards the other. The
// approval would just quietly not have happened.
//
// That is not hypothetical: it is exactly the bug that lost match results in
// July 2026 and forced the results store to be split one blob per age group.
// See "Results storage" in CLAUDE.md. One key per person here means two people
// signing in at the same moment touch two different keys and cannot collide at
// all, and no sign-in can ever damage an account record.
//
// ⚠️ AND IT FAILS OPEN, BOTH WAYS. recordSignIn() swallows everything: a
// display nicety must never cost somebody a sign-in on the one morning it
// matters. readSignIn() answers null rather than throwing, so a card whose
// stamps cannot be read still renders every other fact about the account.

const { blobStore } = require('./_auth');

const STORE = 'signins';

/* The username is already lowercased and trimmed by every signup path, but it
   still decides a blob key, so it is sanitised the same way _ratelimit.js
   sanitises the client address — a name containing a slash must not be able to
   write to a key of its own choosing. */
function keyFor(username) {
  const raw = String(username || '');
  return raw.replace(/[^0-9a-zA-Z._-]/g, '_').slice(0, 60) || 'unknown';
}

/* Call AFTER a sign-in has succeeded, never before — a failed attempt is not a
   sign-in, and stamping one would let anyone move somebody else's "last signed
   in" just by guessing at their username. */
async function recordSignIn(username, whenIso) {
  try {
    if (!username) return;
    await blobStore(STORE).setJSON(keyFor(username), {
      at: whenIso || new Date().toISOString(),
    });
  } catch (e) {
    /* Deliberately silent. See the header: this must never break a sign-in. */
  }
}

// The ISO stamp, or null if this account has never signed in (or the store
// could not be read — the card renders both as "Never", which is honest: we
// have no record either way).
async function readSignIn(username) {
  try {
    if (!username) return null;
    const rec = await blobStore(STORE).get(keyFor(username), { type: 'json' });
    return (rec && rec.at) || null;
  } catch (e) {
    return null;
  }
}

/* Many at once, for the organiser's Accounts listing. One read per account,
   run together rather than in sequence — the list is ~18 people, so this is a
   handful of parallel reads, not a fan-out worth batching differently. Returns
   a plain object keyed by the username as GIVEN, not the sanitised key, so the
   caller can look its own names up. */
async function readSignIns(usernames) {
  const names = Array.isArray(usernames) ? usernames : [];
  const out = Object.create(null);
  await Promise.all(names.map(async (u) => { out[u] = await readSignIn(u); }));
  return out;
}

module.exports = { recordSignIn, readSignIn, readSignIns, keyFor, STORE };
