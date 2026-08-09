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
// check to login.js, the one password endpoint; test-accounts.js asserts it
// has none. (This named manager-login.js/organizer-login.js until those were
// retired on 3 Aug 2026 — the rule moved with its subject, it did not lapse.)

const MIN_PASSWORD_LENGTH = 10;

/* ⚠️ AND A CEILING, ADDED AUG 2026, BECAUSE BCRYPT SILENTLY TRUNCATES AT 72
   BYTES. Everything past the 72nd byte is discarded before hashing — so a
   100-character passphrase and its first 72 characters are THE SAME PASSWORD,
   and the person who chose the long one believes they have more protection than
   they do. It is not a warning or an error; the extra characters simply stop
   existing.

   MEASURED, not taken from the documentation: with bcryptjs 3.0.2,
   compare('a'.repeat(72), hash('a'.repeat(80))) returns TRUE.

   72 BYTES, NOT 72 CHARACTERS. The limit is on the UTF-8 encoding, and one
   emoji or accented character is several bytes — so the check below counts
   bytes. A 60-character password of Arabic text can exceed 72 bytes.

   ⚠️ REFUSED, NOT TRIMMED. Silently cutting it to 72 would store a password the
   person cannot reproduce by typing what they chose. Tell them.

   ⚠️ AND THIS IS STILL A SET-TIME RULE ONLY. Same reasoning as the floor above:
   an existing account whose password is longer than this was already truncated
   at 72 by bcrypt, so it keeps working at login and must not be locked out. */
const MAX_PASSWORD_BYTES = 72;

/* One sentence, used everywhere a password is refused, so the rule reads the
   same wherever someone meets it. */
const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
const PASSWORD_TOO_LONG = `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer — bcrypt ignores anything past that, so a longer one is not actually longer.`;

/* Byte length, not string length. Buffer is a Node built-in, so this file stays
   dependency-free and testable without node_modules. */
const passwordBytes = (s) => Buffer.byteLength(String(s), 'utf8');

/* -> a reason to refuse, or null if it is fine. Anything that is not a string
   is refused rather than coerced: a number reaching here would have a .length
   of undefined and sail straight through a naive check. */
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT;
  if (passwordBytes(password) > MAX_PASSWORD_BYTES) return PASSWORD_TOO_LONG;
  return null;
}

module.exports = {
  MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES,
  PASSWORD_TOO_SHORT, PASSWORD_TOO_LONG,
  passwordProblem, passwordBytes,
};
