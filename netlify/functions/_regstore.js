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
const { TEAM_COLUMNS } = require('./_intake');

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

async function listPrefix(store, prefix) {
  const res = await store.list({ prefix: prefix + '/' });
  const keys = ((res && res.blobs) || []).map((b) => b.key).sort();
  const out = [];
  for (const key of keys) {
    const record = await store.get(key, { type: 'json' });
    if (record && typeof record === 'object' && Array.isArray(record.row)) out.push({ key, record });
  }
  return out;
}

/* Live records for one form: every record, minus any that a later record
   names in `supersedes`. */
async function listRecords(store, form) {
  const prefix = PREFIX[form];
  if (!prefix) throw new Error('unknown form: ' + form);
  const all = await listPrefix(store, prefix);
  const superseded = new Set(all.map((e) => e.record.supersedes).filter(Boolean));
  return all.filter((e) => !superseded.has(e.key));
}

/* EVERYTHING, superseded included — the snapshot must carry the full history
   so a restore puts back exactly what was there. */
async function listAll(store) {
  const out = [];
  for (const prefix of Object.values(PREFIX)) out.push(...(await listPrefix(store, prefix)));
  return out;
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

module.exports = {
  STORE_NAME, PREFIX, TEAM_COLUMNS_CLUB_INDEX: TEAM_COLUMNS.indexOf('club'),
  isRehearsal, makeKey, buildRecord, writeOnce, listRecords, listAll,
  teamRowsForNumbering, shapeForReaders,
};
