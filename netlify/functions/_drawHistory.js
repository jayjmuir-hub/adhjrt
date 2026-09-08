// netlify/functions/_drawHistory.js
//
// Draft history for an age group's draw — the only undo the blob store will
// ever have. Spec: claude/specs/spec-draw-rights-sep-2026.md § 7.
//
// Every successful save in save-schedule-override.js files the PREVIOUS
// draft under `hist:<ageGroupId>:<ISO timestamp>` before overwriting, and a
// reset files one too, so "who wiped the draw" is answerable. The newest
// KEEP entries survive; older ones are deleted in the same call. Ten, not
// unlimited (Jay, 8 Sep 2026): the list is read on every History open and a
// group edited three hundred times should not slow it.
//
// Blobs has no compare-and-set, so two organisers saving the same group in
// the same second can still lose one save. History makes that RECOVERABLE
// rather than impossible, which is the most this store can offer.

const KEEP = 10;
const PREFIX = (ageGroupId) => `hist:${ageGroupId}:`;
const histKey = (ageGroupId, savedAt) => `${PREFIX(ageGroupId)}${savedAt}`;

/* Keys for one group, newest first. list({prefix}) is Netlify's filter; the
   startsWith is belt and braces for a store that ignores it. */
async function historyKeys(store, ageGroupId) {
  const prefix = PREFIX(ageGroupId);
  let blobs = [];
  try {
    const res = await store.list({ prefix });
    blobs = (res && res.blobs) || [];
  } catch (e) {
    return [];
  }
  return blobs.map((b) => b.key).filter((k) => typeof k === 'string' && k.startsWith(prefix)).sort().reverse();
}

/* Files `schedule` as a history entry and prunes to KEEP. `savedBy` is the
   username whose save is being superseded is unknown, so it is the username
   of the person who wrote the entry now being replaced — passed by the
   caller from the stored draft's own stamp where it has one, else the
   current writer. `cleared: true` marks a reset. */
async function fileHistory(store, ageGroupId, schedule, meta = {}) {
  const savedAt = new Date().toISOString();
  await store.setJSON(histKey(ageGroupId, savedAt), {
    schedule: schedule || null,
    cleared: !!meta.cleared,
    savedBy: meta.savedBy || null,
    savedAt,
  });
  const keys = await historyKeys(store, ageGroupId);
  for (const k of keys.slice(KEEP)) {
    try { await store.delete(k); } catch (e) { /* a leftover entry is not worth failing a save over */ }
  }
  return savedAt;
}

/* Metadata only, newest first — the schedules themselves stay in the store
   until a restore asks for one. */
async function listHistory(store, ageGroupId) {
  const keys = await historyKeys(store, ageGroupId);
  const out = [];
  for (const k of keys) {
    const e = await store.get(k, { type: 'json' });
    if (!e) continue;
    const s = e.schedule || {};
    out.push({
      savedAt: e.savedAt || k.slice(PREFIX(ageGroupId).length),
      savedBy: e.savedBy || null,
      cleared: !!e.cleared,
      pools: Array.isArray(s.pools) ? s.pools.length : 0,
      teams: Array.isArray(s.pools) ? s.pools.reduce((n, p) => n + ((p.teams || []).length), 0) : 0,
      slots: Array.isArray(s.slots) ? s.slots.length : 0,
    });
  }
  return out;
}

async function readHistory(store, ageGroupId, savedAt) {
  if (!savedAt || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(savedAt)) return null;
  return store.get(histKey(ageGroupId, savedAt), { type: 'json' });
}

module.exports = { KEEP, histKey, historyKeys, fileHistory, listHistory, readHistory };
