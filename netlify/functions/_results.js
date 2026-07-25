// netlify/functions/_results.js
//
// Shared storage layer for match results. Not an HTTP endpoint — required by
// submit-result.js (writes) and get-results.js (reads). Both go through here so
// the read and write shapes can never drift apart.
//
// ---------------------------------------------------------------------------
// WHY RESULTS ARE SPLIT BY AGE GROUP
// ---------------------------------------------------------------------------
// Every result used to live in a single blob called 'all'. submit-result read
// that whole object, set one key, and wrote the whole thing back:
//
//     const results = await store.get('all', { type: 'json' });
//     results[matchId] = { ... };
//     await store.setJSON('all', results);
//
// There is no lock and no compare-and-set — @netlify/blobs v8 has no
// conditional write at all (SetOptions carries only `metadata`, checked
// against the installed typings). So two managers saving at the same moment
// both read the same snapshot, and whichever wrote second silently discarded
// the other's result. No error, nothing in the log, and the manager who lost
// their score saw a success message.
//
// On 7–8 November up to fifteen managers enter scores simultaneously across
// fifteen age groups, pitch-side, on phones. On one shared key that collision
// was close to certain.
//
// Splitting the store one blob per age group removes the cross-group
// contention completely, and that is the realistic case: a manager account is
// scoped to exactly one age group, so two managers never write the same key.
// Two people scoring the SAME group can still collide, but that is one pair of
// people at one pitch rather than the whole tournament.
//
// ---------------------------------------------------------------------------
// MIGRATION — the legacy blob is never written and never deleted
// ---------------------------------------------------------------------------
// 'all' is left exactly as it is, permanently, for two reasons: it is the
// fallback for any age group not yet written since this change, and it is an
// untouched backup of everything recorded before it. Nothing here can lose a
// result that was already stored.
//
// The existence of a group's own blob is the migration marker:
//   - group blob exists  -> it is the whole truth for that age group
//   - group blob absent  -> fall back to that group's slice of 'all'
// The first write to a group seeds its blob from the legacy slice, so no
// history is dropped at the moment of the switch.

const LEGACY_KEY = 'all';

const groupKey = (agId) => `ag:${agId}`;
const groupOf = (matchId) => String(matchId || '').split(':')[0];

async function readLegacy(store) {
  try {
    return (await store.get(LEGACY_KEY, { type: 'json' })) || {};
  } catch (err) {
    console.warn('results: legacy read failed —', err.message);
    return {};
  }
}

/* Everything recorded for one age group, ready to be mutated and written back.
   Falls back to the group's slice of the legacy blob until the group has a blob
   of its own, so the first write after this change carries the history with
   it. */
async function readGroup(store, agId) {
  let own = null;
  try {
    own = await store.get(groupKey(agId), { type: 'json' });
  } catch (err) {
    console.warn('results: group read failed —', agId, err.message);
  }
  if (own && typeof own === 'object') return own;

  const legacy = await readLegacy(store);
  const slice = {};
  Object.keys(legacy).forEach((id) => { if (groupOf(id) === agId) slice[id] = legacy[id]; });
  return slice;
}

async function writeGroup(store, agId, results) {
  await store.setJSON(groupKey(agId), results);
}

/* Every result across every age group, for the public endpoint.
   A group's own blob supersedes the legacy slice for that group — otherwise a
   result cleared after the switch would be resurrected by the fallback.

   Note the deliberate asymmetry on failure: a group blob that fails to READ is
   skipped and its legacy slice is kept. Better to serve a stale score than to
   blank an age group's table mid-tournament because of one failed request. */
async function readAll(store) {
  const merged = { ...(await readLegacy(store)) };

  let keys = [];
  try {
    const listed = await store.list({ prefix: 'ag:' });
    keys = ((listed && listed.blobs) || []).map((b) => b.key);
  } catch (err) {
    console.warn('results: list failed, serving legacy only —', err.message);
    return merged;
  }

  const groups = await Promise.all(keys.map(async (key) => {
    try {
      const data = await store.get(key, { type: 'json' });
      return data && typeof data === 'object' ? [key.slice(groupKey('').length), data] : null;
    } catch (err) {
      console.warn('results: read failed —', key, err.message);
      return null;
    }
  }));

  groups.filter(Boolean).forEach(([agId, own]) => {
    Object.keys(merged).forEach((id) => { if (groupOf(id) === agId) delete merged[id]; });
    Object.assign(merged, own);
  });

  return merged;
}

module.exports = { readGroup, writeGroup, readAll, groupKey, groupOf, LEGACY_KEY };
