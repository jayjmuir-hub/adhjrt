// netlify/functions/_password.js
//
// HOW LONG A PASSWORD HAS TO BE. One rule, one place.
//
// It lives apart from _auth.js on purpose. This is policy, not cryptography —
// it needs no bcrypt and no Netlify Blobs — and keeping it dependency-free is
// what lets tests/test-accounts.js require it directly. _auth.js pulls it in
// and re-exports it, so every existing `require('./_auth')` keeps working and
// nothing else had to change.
//
// It was 6, written out separately in three functions, for accounts that read
// children's names, dates of birth and medical notes. An organizer sees every
// registration; a manager sees their own age group's in full, medical notes
// included — so both get the same floor, because both reach the same class of
// data.
//
// Ten, not sixteen: these are volunteers who will pick something they can
// remember, and a floor high enough to force a sticky note on a clipboard makes
// things worse rather than better.
//
// ⚠️ IT APPLIES WHEN A PASSWORD IS SET, NEVER AT LOGIN. Raising it must not lock
// out an existing account whose password is shorter — that would take the whole
// committee out on the morning somebody needed to get in. Do NOT add a length
// check to manager-login.js or organizer-login.js; test-accounts.js asserts
// neither of them has one.

const MIN_PASSWORD_LENGTH = 10;

/* One sentence, used everywhere a password is refused, so the rule reads the
   same wherever someone meets it. */
const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

/* -> a reason to refuse, or null if it is fine. Anything that is not a string
   is refused rather than coerced: a number reaching here would have a .length
   of undefined and sail straight through a naive check. */
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT;
  return null;
}

module.exports = { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT, passwordProblem };
