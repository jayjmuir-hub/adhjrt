// netlify/functions/marshal-links.js
//
// The Marshals tab on /manager: issue, revoke and list the pitch links for
// one age group. Spec: claude/specs/spec-pitch-marshals-sep-2026.md § 1.
//
// POST { action: 'issue',  ageGroupId, pitch }  -> { ok, url, token, day, dayLabel, issuedAt }
// POST { action: 'revoke', ageGroupId, pitch }  -> { ok }
// GET  ?ageGroupId=<id>                          -> { ok, day, dayLabel, links: [{ pitch, issuedAt, issuedBy, revokedAt, live }] }
//
// A manager for their own group (hasAgeGroupAccess) or an organiser. `pitch`
// must be one the group holds on its day in the saved layout; `day` is
// derived from that layout, never supplied. Festival groups keep no scores,
// so there is nothing for a marshal to enter and issuing is refused.
//
// ⚠️ THE TOKEN IS RETURNED ONCE, in the issue response, and never stored or
// listed. What the listing shows is enough to say "live since 08:40" and
// "revoked", not enough to reproduce the link.

const { resolveSession, sessionRefusal, hasAgeGroupAccess, blobStore } = require('./_auth');
const { loadVenue, dayIdOf, DEFAULT_VENUE } = require('./_venue');
const { FESTIVAL_AGE_IDS } = require('./_scoring');
const { issue, revoke, readRecord, dayWindow } = require('./_marshal');

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

async function pitchesOf(ageGroupId) {
  let venue = DEFAULT_VENUE;
  try { venue = await loadVenue(blobStore); } catch (e) { /* code's layout */ }
  const day = dayIdOf(venue, ageGroupId);
  if (!day) return { day: null, pitches: [] };
  const list = venue[day].groups[ageGroupId];
  return { day, pitches: Array.isArray(list) ? list.slice() : [] };
}

exports.handler = async (event) => {
  try {
    const auth = await resolveSession(event);
    if (!auth.ok) return sessionRefusal(auth);
    const session = auth.session;
    if (session.role !== 'manager' && session.role !== 'organizer') return json(403, { ok: false, error: 'Not allowed.' });

    const params = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const ageGroupId = String(body.ageGroupId || params.ageGroupId || '').trim();
    if (!ageGroupId) return json(400, { ok: false, error: 'Missing ageGroupId.' });
    if (!hasAgeGroupAccess(session, ageGroupId)) return json(403, { ok: false, error: 'You can only manage marshals for your own age group.' });

    const { day, pitches } = await pitchesOf(ageGroupId);
    if (!day) return json(400, { ok: false, error: 'This age group is not on either tournament day in the venue layout.' });
    const window = dayWindow(day);

    if (event.httpMethod === 'GET') {
      const links = [];
      for (const pitch of pitches) {
        const r = await readRecord(ageGroupId, day, pitch);
        links.push({ pitch, issuedAt: r ? r.issuedAt : null, issuedBy: r ? r.issuedBy : null, revokedAt: r ? r.revokedAt : null, live: !!(r && !r.revokedAt) });
      }
      return json(200, { ok: true, day, dayLabel: window.label, pitches, links });
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

    const pitch = String(body.pitch || '').trim();
    if (!pitches.includes(pitch)) return json(400, { ok: false, error: 'That pitch is not one this age group holds on its day.' });

    if (body.action === 'issue') {
      if (FESTIVAL_AGE_IDS.includes(ageGroupId)) return json(400, { ok: false, error: 'U6 and U7 keep no scores, so there is nothing for a marshal to enter.' });
      const { token, record } = await issue(ageGroupId, day, pitch, session.username);
      const origin = (event.headers && (event.headers['x-forwarded-host'] || event.headers.host)) || 'adhjrt.com';
      const proto = (event.headers && event.headers['x-forwarded-proto']) || 'https';
      return json(200, { ok: true, token, url: `${proto}://${origin}/app#marshal=${encodeURIComponent(token)}`, day, dayLabel: window.label, issuedAt: record.issuedAt });
    }
    if (body.action === 'revoke') {
      const r = await revoke(ageGroupId, day, pitch, session.username);
      return json(200, { ok: true, revoked: !!r });
    }
    return json(400, { ok: false, error: 'Unknown action.' });
  } catch (err) {
    console.error('marshal-links error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
