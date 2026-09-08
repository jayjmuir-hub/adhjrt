// netlify/functions/draw-history.js
//
// An organiser's view of a group's draft history, and the way back.
// Spec: claude/specs/spec-draw-rights-sep-2026.md § 7. Storage: _drawHistory.js.
//
// GET  ?ageGroupId=<id>            -> { ok, entries: [{ savedAt, savedBy, cleared, pools, teams, slots }] }
// POST { ageGroupId, savedAt }     -> restores that entry as the DRAFT, filing the
//                                     current draft as history first, so a
//                                     restore is itself undoable.
//
// ORGANISER-ONLY, both ways. The organiser is the person who will be asked
// "what happened to my draw"; a manager has no history and no restore. A
// restore writes the DRAFT only — the published copy is untouched until an
// organiser publishes again.

const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { draftKey } = require('./_publish');
const { fileHistory, listHistory, readHistory } = require('./_drawHistory');

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

exports.handler = async (event) => {
  try {
    const auth = await resolveSession(event);
    if (!auth.ok) return sessionRefusal(auth);
    const session = auth.session;
    if (session.role !== 'organizer') return json(403, { ok: false, error: 'Only tournament organisers can see or restore draw history.' });

    const store = blobStore('schedules');

    if (event.httpMethod === 'GET') {
      const ageGroupId = (event.queryStringParameters || {}).ageGroupId;
      if (!ageGroupId) return json(400, { ok: false, error: 'Missing ageGroupId.' });
      return json(200, { ok: true, entries: await listHistory(store, ageGroupId) });
    }

    if (event.httpMethod === 'POST') {
      const { ageGroupId, savedAt } = JSON.parse(event.body || '{}');
      if (!ageGroupId) return json(400, { ok: false, error: 'Missing ageGroupId.' });
      const entry = await readHistory(store, ageGroupId, savedAt);
      if (!entry) return json(404, { ok: false, error: 'That version is no longer in the history.' });
      /* A `cleared` entry is the draw that a reset WIPED — restoring it is
         exactly the undo somebody at the desk will ask for. Only an entry
         with no schedule at all has nothing to give back. */
      if (!entry.schedule) return json(400, { ok: false, error: 'That entry holds no draw to restore.' });

      /* The current draft goes into history FIRST, so the restore can be undone. */
      const current = await store.get(draftKey(ageGroupId), { type: 'json' });
      if (current) await fileHistory(store, ageGroupId, current, { savedBy: session.username });
      await store.setJSON(draftKey(ageGroupId), entry.schedule);
      return json(200, { ok: true, restored: entry.savedAt });
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    console.error('draw-history error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
