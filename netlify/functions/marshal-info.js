// netlify/functions/marshal-info.js
//
// What a pitch marshal's phone needs to draw pitch mode, in one call.
// Spec: claude/specs/spec-pitch-marshals-sep-2026.md § 2 and § 4.
//
// GET, Authorization: Bearer <marshal token>
//   -> 200 { ok, ageGroupId, ageGroupName, pitch, day, dayLabel, expiresAt,
//            matches: [{ id, home, away, startMins, pitch, poolName|round }],
//            scoredBy: { <matchId>: 'Sam' | 'the table' } }
//   -> 401 { ok:false, error } when the link is revoked, reissued, or not today.
//
// The matches are that pitch's slots from the PUBLISHED draw — parents' view,
// nothing more — and `scoredBy` is first names only, from enteredBy on the
// stored results (Jay, 8 Sep 2026: a marshal may see who did a match). This
// is the only path a marshal has to any name, scoped to their own pitch, and
// the public get-results never carries it.

const { blobStore } = require('./_auth');
const { verifyMarshal, dayWindow, NOT_LIVE } = require('./_marshal');
const { publishedKey } = require('./_publish');
const { readMatch } = require('./_results');
const { AGE_GROUPS } = require('./_agegroups');

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const nameOf = (id) => ((AGE_GROUPS.find((g) => g.id === id) || {}).name) || String(id || '').toUpperCase();

/* First name only, however the table typed it. */
const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const v = await verifyMarshal(event);
    if (!v.ok) return json(401, { ok: false, error: NOT_LIVE });
    const { ageGroupId, day, pitch } = v.marshal;
    const window = dayWindow(day);

    const pub = await blobStore('schedules').get(publishedKey(ageGroupId), { type: 'json' });
    const schedule = (pub && pub.schedule) || null;
    const pools = new Map(((schedule && schedule.pools) || []).map((p) => [p.id, p.name]));
    const slots = [
      ...((schedule && schedule.slots) || []).map((s) => ({ id: s.id, home: s.home || '', away: s.away || '', startMins: s.startMins, pitch: s.pitch || '', poolName: pools.get(s.poolId) || '', round: '' })),
      ...((schedule && schedule.knockout) || []).map((s) => ({ id: s.id, home: s.home || '', away: s.away || '', startMins: s.startMins, pitch: s.pitch || '', poolName: '', round: s.round || 'Knockout' })),
    ].filter((s) => s.id && s.pitch === pitch).sort((a, b) => a.startMins - b.startMins);

    const results = blobStore('results');
    const scoredBy = {};
    const teamNames = (schedule && schedule.teamNames) || {};
    for (const s of slots) {
      let r = null;
      try { r = await readMatch(results, s.id); } catch (e) { r = null; }
      if (!r) continue;
      const by = r.enteredBy || {};
      scoredBy[s.id] = by.kind === 'marshal' ? (firstName(by.name) || 'a marshal') : 'the table';
    }

    return json(200, {
      ok: true, ageGroupId, ageGroupName: nameOf(ageGroupId), pitch, day, dayLabel: window ? window.label : day,
      expiresAt: window ? new Date(window.end).toISOString() : null,
      matches: slots, teamNames, scoredBy,
    });
  } catch (err) {
    console.error('marshal-info error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
