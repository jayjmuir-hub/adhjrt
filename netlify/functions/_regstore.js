// netlify/functions/_regstore.js
//
// THE REGISTRATION STORE — one write-once record per accepted submission.
// Spec: claude/specs/spec-registration-store-sep-2026.md (§ 3 the record,
// § 5 the readers). Replaces the three Google Sheets as the place a
// registration lives; the sheet COLUMN ORDER survives inside each record so
// nothing downstream had to learn a new layout.
//
// ⚠️ THERE IS NO UPDATE HERE, ON PURPOSE. writeOnce() refuses a key that
// already exists and nothing in this module can overwrite. A correction is a
// NEW record carrying `supersedes: <old key>`; listRecords() hides the old one.
// This is what makes restore safe (it can only ever add) and what makes a bug
// that overwrites a child's registration impossible by construction.
//
// Dependency-free: the store is passed in, so tests run without node_modules.
// The store has @netlify/blobs' shape — get(key, {type:'json'}), setJSON,
// list({prefix}) → {blobs:[{key}]}, delete(key).

const crypto = require('crypto');
const { TEAM_COLUMNS, CLUB_COLUMNS } = require('./_intake');

const STORE_NAME = 'registrations';

const PREFIX = {
  'team-registration': 'team',
  'player-registration': 'player',
  'club-registration': 'club',
};

/* A club whose name STARTS with the word "Rehearsal" is a rehearsal. Whole
   word and case-insensitive: "Rehearsal Quins" yes, "Rehearsals FC" no. The
   flag is stored on the record so the delete tool can remove rehearsal
   records alone and the snapshot subject can shout REHEARSAL. */
function isRehearsal(club) {
  return /^\s*rehearsal\b/i.test(String(club || ''));
}

/* '<prefix>/<ISO stamp with : and . replaced>-<6 random chars>'. Sorts in
   arrival order; the suffix stops two submissions in one millisecond colliding.
   `rand` is a parameter only so a test can pin the key. */
function makeKey(form, nowMs, rand) {
  const prefix = PREFIX[form];
  if (!prefix) throw new Error('unknown form: ' + form);
  const stamp = new Date(nowMs).toISOString().replace(/[:.]/g, '-');
  const r = rand || crypto.randomBytes(4).toString('hex').slice(0, 6);
  return `${prefix}/${stamp}-${r}`;
}

function buildRecord({ form, row, nowMs, club, supersedes }) {
  if (!PREFIX[form]) throw new Error('unknown form: ' + form);
  if (!Array.isArray(row)) throw new Error('row must be an array');
  const rec = {
    v: 1,
    form,
    receivedAt: new Date(nowMs).toISOString(),
    row: row.slice(),
    rehearsal: isRehearsal(club),
  };
  if (supersedes) rec.supersedes = String(supersedes);
  return rec;
}

/* Refuses if the key exists. The key's random suffix is what makes collisions
   improbable; this check is the guard that makes overwriting impossible even
   if a caller reuses a key by mistake. */
async function writeOnce(store, key, record) {
  const existing = await store.get(key, { type: 'json' });
  if (existing !== null && existing !== undefined) throw new Error('exists: ' + key);
  await store.setJSON(key, record);
}

/* ⚠️ A RECORD THAT DOES NOT LOOK LIKE A RECORD IS NEVER SILENTLY FORGOTTEN.
   Returns BOTH halves: `entries` is what could be read as a record, `dropped`
   is the key of everything that could not. It used to return only the first
   half, which meant the snapshot — whose only source is listAll() — quietly
   left a corrupted record out of the backup and printed a count one lower,
   while tools/registrations-admin.js treated the identical condition as
   `unreadable` and refused the whole operation. Two halves of one safety
   story taking opposite decisions on the same input. The caller decides now;
   nothing decides by omission. */
async function listPrefix(store, prefix) {
  const res = await store.list({ prefix: prefix + '/' });
  const keys = ((res && res.blobs) || []).map((b) => b.key).sort();
  const entries = [];
  const dropped = [];
  for (const key of keys) {
    const record = await store.get(key, { type: 'json' });
    if (record && typeof record === 'object' && Array.isArray(record.row)) entries.push({ key, record });
    else dropped.push(key);
  }
  return { entries, dropped };
}

/* Live records for one form: every record, minus any that a later record
   names in `supersedes`.
   ⚠️ THIS ONE IS FORGIVING ON PURPOSE, AND IT DIFFERS FROM listAll() ON
   PURPOSE. The two reader endpoints call this to paint an organiser's or a
   manager's screen, and one corrupted record must not empty that screen — a
   reader that refuses shows nobody anything, which is worse than showing the
   rest. The BACKUP has the opposite duty (a snapshot that looks complete and
   is not is the failure mode this whole build exists to prevent), so listAll()
   surfaces `dropped` and runSnapshot() shouts about it. If you make one of
   these behave like the other, you have broken the one whose job you forgot. */
async function listRecords(store, form) {
  const prefix = PREFIX[form];
  if (!prefix) throw new Error('unknown form: ' + form);
  const { entries: all } = await listPrefix(store, prefix);
  const superseded = new Set(all.map((e) => e.record.supersedes).filter(Boolean));
  return all.filter((e) => !superseded.has(e.key));
}

/* EVERYTHING, superseded included — the snapshot must carry the full history
   so a restore puts back exactly what was there. Returns `{ entries, dropped }`:
   `dropped` is every key that exists in the store but could not be read as a
   record, and runSnapshot() turns a non-empty `dropped` into an INCOMPLETE
   subject line naming the count. */
async function listAll(store) {
  const entries = [];
  const dropped = [];
  for (const prefix of Object.values(PREFIX)) {
    const part = await listPrefix(store, prefix);
    entries.push(...part.entries);
    dropped.push(...part.dropped);
  }
  return { entries, dropped };
}

/* nextTeamCode() in _teams.js reads rows positionally — club at 1, code at 2,
   age group at 3 — which is the TEAM_COLUMNS order, and the record's row IS
   that order. Superseded rows are excluded: a corrected team must not keep
   its old code alive for numbering. */
async function teamRowsForNumbering(store) {
  const live = await listRecords(store, 'team-registration');
  return live.map((e) => e.record.row);
}

/* Shapes store entries into what the two reader functions have always
   returned, through the SAME mappers the sheet rows went through. Adds
   `rehearsal` so the organiser page can mark a rehearsal row. */
function shapeForReaders(entries, mappers) {
  const tag = (mapper) => (e) => ({ ...mapper(e.record.row), rehearsal: e.record.rehearsal === true });
  return {
    teams: (entries.teams || []).map(tag(mappers.mapTeamRow)),
    players: (entries.players || []).map(tag(mappers.mapPlayerRow)),
    clubs: (entries.clubs || []).map(tag(mappers.mapClubRow)),
  };
}

/* ⚠️ CLUB-NAME NORMALISATION — a copy of the browser function in
   Organizer.dc.html (the reconcileClubs helper, JRT-7). Both MUST agree, or the
   organiser's Clubs tab would GROUP two spellings as one club while the public
   dropdown KEYED them as two. test-club-name-drift.js runs a battery against
   both copies and fails if they diverge; if that anchor rots, repoint it, never
   delete (CLAUDE.md rule 6). Never "tidy" one copy alone. */
const CLUB_SUFFIX_RE = /\s+(rugby football club|rugby club|rufc|rfc|rc|fc)$/;
function normaliseClubName(raw) {
  let v = String(raw == null ? '' : raw).toLowerCase();
  try { v = v.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* older engine: skip */ }
  v = v.replace(/['’]/g, '');
  v = v.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  v = v.replace(CLUB_SUFFIX_RE, '').trim();
  return v;
}

const CLUB_COLUMNS_CLUB_INDEX = CLUB_COLUMNS.indexOf('club');

/* ⚠️ THE PUBLIC DROPDOWN JOIN AND THE HIDDEN-UNTIL-NAMED GATE (JRT-7).
   Given the live club-registration records and the organiser's official-name
   map ({ <normalised declared name>: "<official name>" }), returns the distinct
   OFFICIAL names of clubs that are BOTH registered AND named — and nothing else.
   A club with no official name, a rehearsal, or a superseded record is HIDDEN
   (listRecords already drops superseded; the rehearsal flag is checked BEFORE
   the name lookup so a stray map entry for a rehearsal is still excluded).
   ⚠️ NAMES ONLY: the declared name is a lookup key and is DISCARDED; no contact
   field, team count or note is ever read, so none can leak to the public page.
   Pure (no store) so a test drives it directly. */
function publicClubNames(clubRecords, namesMap) {
  const names = (namesMap && typeof namesMap === 'object') ? namesMap : {};
  const seen = new Map();
  for (const e of (Array.isArray(clubRecords) ? clubRecords : [])) {
    if (!e || !e.record || e.record.rehearsal === true) continue;
    const declared = (e.record.row || [])[CLUB_COLUMNS_CLUB_INDEX];
    const official = names[normaliseClubName(declared)];
    if (typeof official !== 'string') continue;
    const trimmed = official.trim();
    if (!trimmed) continue;
    const k = trimmed.toLowerCase();
    if (!seen.has(k)) seen.set(k, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

module.exports = {
  STORE_NAME, PREFIX, TEAM_COLUMNS_CLUB_INDEX: TEAM_COLUMNS.indexOf('club'),
  isRehearsal, makeKey, buildRecord, writeOnce, listRecords, listAll,
  teamRowsForNumbering, shapeForReaders,
  normaliseClubName, CLUB_SUFFIX_RE, CLUB_COLUMNS_CLUB_INDEX, publicClubNames,
};
