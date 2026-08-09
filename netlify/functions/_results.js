// netlify/functions/_results.js
//
// Shared storage layer for match results. Not an HTTP endpoint — required by
// submit-result.js (writes) and get-results.js (reads). Both go through here so
// the read and write shapes can never drift apart.
//
// ---------------------------------------------------------------------------
// ONE BLOB PER MATCH — and why the two earlier layouts were not enough
// ---------------------------------------------------------------------------
// @netlify/blobs v8 has no compare-and-set and no conditional write at all
// (SetOptions carries only `metadata`). A write is a plain overwrite. So ANY
// layout that makes two people write the same key is a layout where one of them
// silently loses, and the loser is told the save succeeded.
//
// Layout 1 — one blob called 'all'. read-modify-write of every result in the
// tournament. Two managers in different age groups collided.
//
// Layout 2 — one blob per age group, 'ag:<agId>'. Removed the cross-group
// collision, and that was a real improvement, but it kept the read-modify-write
// and so kept two defects that a code review found in Aug 2026:
//
//   (a) A FAILED READ DESTROYED THE GROUP. readGroup swallowed a read error and
//       fell through to the legacy slice — empty, since the migration. The
//       caller then wrote that back as the WHOLE group. Fourteen U16B results
//       stored, one transient blob timeout while saving the fifteenth, and the
//       blob became {match15}. The verifier only checked its own entry, so it
//       passed, and the manager got a green tick. Nothing but a console.warn.
//
//   (b) TWO WRITERS BOTH GOT A GREEN TICK. The retry loop only caught "someone
//       overwrote me BEFORE my read-back". In the ordinary interleaving —
//       A reads, B reads, A writes, A verifies OK, B writes, B verifies OK —
//       A's result is gone and both managers saw success. A manager plus an
//       organiser scoring the same group is exactly the anticipated case.
//
// Layout 3, this one — ONE BLOB PER MATCH, 'm:<matchId>'. A save writes exactly
// one key: its own. There is no read-modify-write anywhere on the write path,
// so there is nothing to lose. Two people saving the SAME match still means
// last-write-wins, which is correct and always was — that is one match, one
// score, and the second person genuinely is correcting the first.
//
// The same move was already made for sign-ins; see _signins.js.
//
// ---------------------------------------------------------------------------
// MIGRATION — there isn't one, on purpose
// ---------------------------------------------------------------------------
// Nothing is copied, rewritten or deleted on deploy. Both older layouts are
// left exactly as they are and are read as FALLBACKS, in increasing order of
// authority:
//
//     'all'            (layout 1)  — lowest
//     'ag:<agId>'      (layout 2)
//     'm:<matchId>'    (layout 3)  — highest, wins whenever present
//
// A result recorded before this change keeps being served from wherever it
// already lives, until someone edits that match — at which point its own blob
// appears and takes over for that match alone. Nothing is ever in flight, there
// is no window where a result is in neither place, and rolling this commit back
// loses only the results saved while it was live.
//
// ⚠️ THIS IS WHY CLEARING WRITES A TOMBSTONE RATHER THAN DELETING. If clearing
// merely deleted 'm:<matchId>', the next read would fall through to the older
// layouts and RESURRECT the very result that was just cleared. `{ cleared: true }`
// is how "deliberately removed" is distinguished from "never written here".
// Tombstones are small and permanent; that is the price of not needing a
// migration.

const LEGACY_KEY = 'all';

const groupKey = (agId) => `ag:${agId}`;
const matchKey = (matchId) => `m:${matchId}`;
const groupOf = (matchId) => String(matchId || '').split(':')[0];

/* ⚠️ The trailing colon is load-bearing. Match ids start with the age-group id
   followed by ':', so a prefix of 'm:u12' would also list every 'm:u12g:…'
   blob and hand U12G's scores to U12. With the colon it cannot. */
const matchPrefix = (agId) => `m:${agId}:`;

/* A stored value that means "this match was deliberately cleared". Readers must
   treat it as absent rather than as a result. */
const isTombstone = (v) => !!v && typeof v === 'object' && v.cleared === true;

async function readLegacy(store) {
  try {
    return (await store.get(LEGACY_KEY, { type: 'json' })) || {};
  } catch (err) {
    console.warn('results: legacy read failed —', err.message);
    return {};
  }
}

/* One match, from the most authoritative place it exists.
   Returns null when the match has no result — including when it has a
   tombstone, which is the whole point of tombstones. */
async function readMatch(store, matchId) {
  try {
    const own = await store.get(matchKey(matchId), { type: 'json' });
    if (isTombstone(own)) return null;
    if (own && typeof own === 'object') return own;
  } catch (err) {
    /* ⚠️ RE-THROWN, NOT SWALLOWED. Defect (a) above was a swallowed read error
       being treated as "no data". A caller that cannot read must be told so and
       must refuse, never quietly carry on with an empty answer. */
    throw new Error(`could not read ${matchKey(matchId)}: ${err.message}`);
  }
  const older = await readGroup(store, groupOf(matchId));
  return older[matchId] || null;
}

/* Everything recorded for one age group, merged across the three layouts.
   Used by the public reader and by the clear path; NOT by the write path, which
   no longer reads anything it is about to overwrite. */
async function readGroup(store, agId) {
  const merged = {};

  const legacy = await readLegacy(store);
  Object.keys(legacy).forEach((id) => { if (groupOf(id) === agId) merged[id] = legacy[id]; });

  try {
    const own = await store.get(groupKey(agId), { type: 'json' });
    /* ⚠️ REPLACES THE LEGACY SLICE, DOES NOT MERGE OVER IT. A group blob is the
       WHOLE truth for its age group — that was the layout-2 contract and
       readAll below still honours it. My first rewrite of this function merged
       instead, so a result CLEARED under layout 2 (removed from 'ag:u16b',
       still present in 'all') came back from the dead here while staying
       correctly gone in the public view. Two readers, two answers, and the
       manager's own dashboard was the wrong one. Caught by asserting readGroup
       and readAll agree, which nothing did until Aug 2026. */
    if (own && typeof own === 'object') {
      Object.keys(merged).forEach((id) => delete merged[id]);
      Object.assign(merged, own);
    }
  } catch (err) {
    /* Read failure on the layout-2 blob is survivable HERE because this is a
       read path with no write behind it: better to serve the legacy slice than
       to blank an age group's table mid-tournament. The write path does not
       call this, which is what makes that safe now and did not before. */
    console.warn('results: group read failed —', agId, err.message);
  }

  await eachMatchBlob(store, matchPrefix(agId), (matchId, value) => {
    if (isTombstone(value)) delete merged[matchId];
    else merged[matchId] = value;
  });

  return merged;
}

/* Walks every per-match blob under a prefix and hands each to `onOne`.
   ⚠️ A LIST FAILURE THROWS. An empty list and an unreadable list look identical
   to a caller that ignores the difference, and treating "I could not ask" as
   "there is nothing there" is how defect (a) happened. */
async function eachMatchBlob(store, prefix, onOne) {
  let keys = [];
  try {
    const listed = await store.list({ prefix });
    keys = ((listed && listed.blobs) || []).map((b) => b.key);
  } catch (err) {
    throw new Error(`could not list ${prefix}: ${err.message}`);
  }

  const entries = await Promise.all(keys.map(async (key) => {
    try {
      return [key.slice('m:'.length), await store.get(key, { type: 'json' })];
    } catch (err) {
      throw new Error(`could not read ${key}: ${err.message}`);
    }
  }));

  entries.forEach(([matchId, value]) => {
    if (value && typeof value === 'object') onOne(matchId, value);
  });
}

/* Every result across every age group, for the public endpoint.
   Precedence as documented at the top: legacy, then group blobs, then
   per-match blobs, with tombstones removing.

   ⚠️ THE PUBLIC READER IS THE ONE PLACE THAT STAYS FORGIVING. A failure here
   degrades to whatever could be read, because the alternative is a blank
   Standings page on a tournament afternoon. That is the opposite of the write
   path's rule, and the asymmetry is deliberate: serving a stale score is
   recoverable, storing over a real one is not. */
async function readAll(store) {
  const merged = { ...(await readLegacy(store)) };

  try {
    const listed = await store.list({ prefix: 'ag:' });
    const keys = ((listed && listed.blobs) || []).map((b) => b.key);
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
  } catch (err) {
    console.warn('results: group list failed, serving legacy only —', err.message);
  }

  try {
    await eachMatchBlob(store, 'm:', (matchId, value) => {
      if (isTombstone(value)) delete merged[matchId];
      else merged[matchId] = value;
    });
  } catch (err) {
    console.warn('results: per-match list failed, serving older layouts only —', err.message);
  }

  return merged;
}

/* Write one match. Touches exactly one key — no read, no merge, nothing else
   can be lost by it. */
async function writeMatch(store, matchId, entry) {
  await store.setJSON(matchKey(matchId), entry);
}

/* Clear one match. A tombstone, never a delete — see the note at the top. */
async function clearMatch(store, matchId) {
  await store.setJSON(matchKey(matchId), { cleared: true, clearedAt: new Date().toISOString() });
}

module.exports = {
  readGroup, readAll, readMatch, writeMatch, clearMatch,
  groupKey, matchKey, matchPrefix, groupOf, isTombstone, LEGACY_KEY,
};
