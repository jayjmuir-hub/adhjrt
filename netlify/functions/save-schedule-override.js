// netlify/functions/save-schedule-override.js
//
// Lets a signed-in Manager (their own age group, or the "admin" invite
// code) or any Organizer save a custom draw for one age group — which
// teams are in which pool, and each match slot's home/away teams, kickoff
// time, and pitch. Requires an Authorization: Bearer <token> header;
// re-verified server-side via hasAgeGroupAccess (see _auth.js) so a
// manager can never edit another group's draw from the client.
//
// POST { ageGroupId, schedule: { pools:[{id,name,teams}], slots:[{id,poolId,home,away,startMins,pitch}] } }
//   -> saves it (overwrites any previous save for that age group).
// POST { ageGroupId, reset: true }
//   -> deletes the saved draft, reverting the editor to the auto-generated draw.
//
// IMPORTANT: saving here does NOT make anything public. It writes the draft
// only; publish-schedule.js is what puts a draw in front of parents. This is
// deliberate — before it existed, one drag in the fixture editor changed the
// live site instantly.

const { resolveSession, sessionRefusal, hasAgeGroupAccess, blobStore } = require('./_auth');
const { draftKey } = require('./_publish');
const { saveDenialReason, strandedResults, strandedMessage } = require('./_drawRights');
const { readGroup } = require('./_results');
const { loadVenue, DEFAULT_VENUE } = require('./_venue');
const { fileHistory } = require('./_drawHistory');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const auth = await resolveSession(event);
    if (!auth.ok) {
      return sessionRefusal(auth);
    }
    const session = auth.session;
    if (session.role !== 'manager' && session.role !== 'organizer') {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Not allowed.' }) };
    }

    const { ageGroupId, schedule, reset } = JSON.parse(event.body || '{}');
    if (!ageGroupId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing ageGroupId.' }) };
    if (!hasAgeGroupAccess(session, ageGroupId)) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'You can only edit your own age group\u2019s fixtures.' }) };
    }

    if (!reset && (!schedule || !Array.isArray(schedule.pools) || !Array.isArray(schedule.slots))) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid schedule payload.' }) };
    }

    /* Draw rights (Sep 2026, spec-draw-rights). Organisers pass straight
       through. A manager is checked against the STORED draft — which fields
       changed, whether a first draft exists, and whether the group's match day
       has started — by _drawRights.js, which is the one place that rule lives.
       The Draw tab greys out what a manager cannot change, so an honest one
       never sees this 403; it exists for the dishonest one. */
    const store = blobStore('schedules');
    /* Read for everyone now (Sep 2026): the rights comparison needs it for a
       manager, and history needs it for anybody — the PREVIOUS draft is what
       gets filed before this save overwrites it. */
    const stored = await store.get(draftKey(ageGroupId), { type: 'json' });
    if (session.role === 'manager') {
      let venue = DEFAULT_VENUE;
      /* loadVenue takes the store factory; the saved layout decides which
         DAY a group plays, which decides when its freeze starts. */
      try { venue = await loadVenue(blobStore); } catch (e) { /* fall back to the code's layout */ }
      const denied = saveDenialReason(session, ageGroupId, { stored, incoming: schedule, reset: !!reset, venue });
      if (denied) return { statusCode: 403, body: JSON.stringify({ ok: false, error: denied }) };
    }

    /* ⚠️ NO SAVE MAY STRAND A RECORDED RESULT (JRT-6 and JRT-26, 11 Sep 2026).
       Results live under the match id and carry no team codes. So a save that
       drops a scored slot, or keeps its id but changes its teams, loses or
       mis-attributes that score. That is true whether it comes from a pool
       rebuild, an import in replace mode, or a hand-built request, so the rule
       is enforced HERE, for organisers too; the Draw tab's own checks close no
       door. The deliberate route is to clear the score first, which result
       history records. A failed read REFUSES the save: "could not check" must
       never be read as "nothing recorded".
       Only checked against a stored draft. With none there is no saved
       pairing to compare against; see the decision card for that gap. */
    if (stored) {
      let recorded;
      try {
        recorded = await readGroup(blobStore('results'), ageGroupId);
      } catch (e) {
        console.warn('save-schedule-override: could not read results -', e && e.message);
        return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'Could not check the scores already recorded for this group, so nothing was saved. Try again in a moment.' }) };
      }
      const stranded = strandedResults(stored, reset ? null : schedule, recorded);
      if (stranded.length) {
        return { statusCode: 409, body: JSON.stringify({ ok: false, error: strandedMessage(stranded), stranded: stranded.map((s) => s.id) }) };
      }
    }

    /* Saves go to the DRAFT only. Nothing here changes what the public sees —
       that needs publish-schedule.js. Reset clears the draft; any published
       copy stays live until it is explicitly unpublished. */
    /* History (spec-draw-rights § 7): the draft being replaced is filed
       BEFORE the overwrite, ten deep; a reset files a `cleared` entry so
       "who wiped the draw" is answerable. Filing failing must not lose the
       save itself, so it is best-effort and logged. */
    if (stored) {
      try { await fileHistory(store, ageGroupId, stored, { savedBy: session.username, cleared: !!reset }); } catch (e) { console.warn('save-schedule-override: could not file history -', e && e.message); }
    }
    if (reset) {
      await store.delete(draftKey(ageGroupId));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    // schedule.knockout (custom knockout-stage slots) is optional — when
    // absent, readers fall back to auto-seeding the bracket from live
    // standings, same as before this feature existed.
    await store.setJSON(draftKey(ageGroupId), schedule);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('save-schedule-override error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
