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

const { verify, getBearerToken, hasAgeGroupAccess, blobStore } = require('./_auth');
const { draftKey } = require('./_publish');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const session = verify(getBearerToken(event));
    if (!session || (session.role !== 'manager' && session.role !== 'organizer')) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Not signed in.' }) };
    }

    const { ageGroupId, schedule, reset } = JSON.parse(event.body || '{}');
    if (!ageGroupId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing ageGroupId.' }) };
    if (!hasAgeGroupAccess(session, ageGroupId)) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'You can only edit your own age group\u2019s fixtures.' }) };
    }

    /* Saves go to the DRAFT only. Nothing here changes what the public sees —
       that needs publish-schedule.js. Reset clears the draft; any published
       copy stays live until it is explicitly unpublished. */
    const store = blobStore('schedules');
    if (reset) {
      await store.delete(draftKey(ageGroupId));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (!schedule || !Array.isArray(schedule.pools) || !Array.isArray(schedule.slots)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid schedule payload.' }) };
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
