// netlify/functions/_intake.js
//
// What happens to a registration between arriving and being stored: the sheet
// column order, the row builders, and the readers that turn a row back into the
// shape /organizer displays.
//
// ---------------------------------------------------------------------
// DEPENDENCY-FREE ON PURPOSE.
// ---------------------------------------------------------------------
// Nothing here requires googleapis, @netlify/blobs or bcryptjs. A fresh clone
// has no node_modules, so anything that reaches for a package cannot be
// required by a test at all — which is exactly why _password.js was split out
// of _auth.js. The real Sheets client is built by the caller and the rows are
// handed over as plain arrays.
//
// ---------------------------------------------------------------------
// WHY THIS FILE EXISTS AT ALL.
// ---------------------------------------------------------------------
// Until 28 July 2026 the column order was hardcoded THREE times, in three
// files, kept in step by hand:
//
//   submission-created.js    the writer, a positional array
//   get-registrations.js     TEAM_FIELDS + a positional destructure
//   get-my-registrations.js  the same, duplicated verbatim
//
// Each file was individually consistent, so a one-column drift between them
// would have looked correct in review and shown a parent's phone number in the
// emergency-contact box. The sheet is what somebody rings from at a tournament.
//
// The round-trip test — write a registration, read it back, get the same thing
// — is the check that catches that, and it could not be written at all while
// the two halves lived in different files.

/* ============================================================
   THE SHEET COLUMNS.
   ------------------------------------------------------------
   BOTH LIVE SHEETS ALREADY HAVE A HEADER ROW AND ROWS UNDER IT, so this order
   is not a preference. Changing it shifts every future row against everything
   already there and against the header, silently, with no error anywhere.

   'submittedAt' and 'team-code' are not form fields — they are generated
   server-side. Every other name is exactly the key the form submits.

   `preferred-pool` is LAST rather than next to `age-group`, where it reads as
   if it belongs, because it was added after the sheet already had rows in it.
   Leave it there.
   ============================================================ */
const TEAM_COLUMNS = [
  'submittedAt', 'club', 'team-code', 'age-group',
  'head-coach-name', 'head-coach-email', 'head-coach-phone',
  'manager-name', 'manager-email', 'manager-phone',
  'num-players', 'notes', 'players', 'preferred-pool',
];

/* The same fourteen, in the same order, under the names /organizer displays.
   Keeping them parallel is what turns mapTeamRow() into a zip instead of
   fourteen positional guesses. */
const TEAM_OUT = [
  'submittedAt', 'club', 'teamName', 'ageGroup',
  'headCoachName', 'headCoachEmail', 'headCoachMobile',
  'managerName', 'managerEmail', 'managerMobile',
  'numPlayers', 'notes', 'players', 'preferredPool',
];

const PLAYER_COLUMNS = [
  'submittedAt', 'player-first-name', 'player-last-name', 'dob',
  'club', 'age-group',
  'parent-first-name', 'parent-last-name', 'parent-email', 'parent-phone',
  'emergency-first-name', 'emergency-last-name', 'emergency-phone',
  'medical-notes', 'consent', 'play-up-consent',
];

/* A1 ranges, derived from the column counts rather than typed, so adding a
   column and forgetting the range cannot happen. A range narrower than the row
   makes Sheets drop the overflow without an error. */
const colLetter = (n) => String.fromCharCode('A'.charCodeAt(0) + n - 1);
const TEAM_RANGE = `A:${colLetter(TEAM_COLUMNS.length)}`;      // A:N
const PLAYER_RANGE = `A:${colLetter(PLAYER_COLUMNS.length)}`;  // A:P

/* ============================================================
   WRITING.
   ============================================================ */

/* Everything reaching the sheet is text. The append uses RAW — which stores
   exactly what it is handed — so a number or a null arriving here would land in
   the cell as a number or a blank of a different kind rather than as the text
   that was submitted. */
const cell = (v) => (v === undefined || v === null ? '' : String(v));

function rowFrom(columns, source) {
  return columns.map((key) => cell(source[key]));
}

/* `submittedAt` and `team-code` are spread AFTER the data, so a submission that
   supplies either of them cannot override the generated value. Anyone could
   otherwise stamp their own submission time, or claim a team code that already
   belongs to another club. */
function teamRow(data, teamCode, submittedAt) {
  return rowFrom(TEAM_COLUMNS, { ...(data || {}), submittedAt, 'team-code': teamCode });
}

function playerRow(data, submittedAt) {
  return rowFrom(PLAYER_COLUMNS, { ...(data || {}), submittedAt });
}

/* ============================================================
   READING.
   ------------------------------------------------------------
   Sheets does not pad a row: if the last cells are blank it returns a SHORT
   array. Every field has to come back as '' rather than undefined, or the
   dashboard renders the word "undefined" in a column.
   ============================================================ */

const at = (row, i) => cell((Array.isArray(row) ? row : [])[i]);

/* First and last name are two columns in the sheet and one field on screen.
   filter(Boolean) so a missing half does not leave a stray leading or trailing
   space — a blank name must read as blank, not as ' '. */
function joinName(row, columns, firstKey, lastKey) {
  return [at(row, columns.indexOf(firstKey)), at(row, columns.indexOf(lastKey))]
    .filter(Boolean).join(' ');
}

function mapTeamRow(row) {
  const obj = {};
  TEAM_OUT.forEach((name, i) => { obj[name] = at(row, i); });
  return obj;
}

function mapPlayerRow(row) {
  const col = (key) => at(row, PLAYER_COLUMNS.indexOf(key));
  return {
    submittedAt: col('submittedAt'),
    playerName: joinName(row, PLAYER_COLUMNS, 'player-first-name', 'player-last-name'),
    dob: col('dob'),
    club: col('club'),
    ageGroup: col('age-group'),
    parentName: joinName(row, PLAYER_COLUMNS, 'parent-first-name', 'parent-last-name'),
    parentEmail: col('parent-email'),
    parentMobile: col('parent-phone'),
    emergencyContact: joinName(row, PLAYER_COLUMNS, 'emergency-first-name', 'emergency-last-name'),
    emergencyMobile: col('emergency-phone'),
    medicalNotes: col('medical-notes'),
    consent: col('consent'),
    playUpConsent: col('play-up-consent'),
  };
}

module.exports = {
  TEAM_COLUMNS, TEAM_OUT, PLAYER_COLUMNS,
  TEAM_RANGE, PLAYER_RANGE,
  teamRow, playerRow,
  mapTeamRow, mapPlayerRow,
};
