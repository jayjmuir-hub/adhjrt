// netlify/functions/submit-result.js
//
// Records one match result. Requires an Authorization: Bearer <token>
// header from manager-login.js / manager-signup.js OR an Organizer
// token (organizer-login.js / organizer-signup.js) — organizers can
// submit for any age group; a manager only for their own (the special
// "admin" manager invite code's accounts can act on any group too —
// see hasAgeGroupAccess in _auth.js). Never trust the client for this
// check; it's re-verified here from the signed token.
//
// Results are stored in Netlify Blobs as one JSON object keyed by
// matchId, shared by every reader (see get-results.js). Requires the
// same SESSION_SECRET as the other auth functions.

const { verify, getBearerToken, hasAgeGroupAccess, blobStore } = require('./_auth');

const WALKOVER_SCORE = 20;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const session = verify(getBearerToken(event));
    if (!session || (session.role !== 'manager' && session.role !== 'organizer')) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Not signed in.' }) };
    }

    const { matchId, data } = JSON.parse(event.body || '{}');
    if (!matchId || !data) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing matchId or data.' }) };
    const agId = matchId.split(':')[0];
    if (!hasAgeGroupAccess(session, agId)) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'You can only enter scores for your own age group.' }) };
    }

    const store = blobStore('results');
    const results = (await store.get('all', { type: 'json' })) || {};
    results[matchId] = {
      homeScore: data.walkover === 'home' ? WALKOVER_SCORE : (data.walkover === 'away' ? 0 : Number(data.homeScore)),
      awayScore: data.walkover === 'away' ? WALKOVER_SCORE : (data.walkover === 'home' ? 0 : Number(data.awayScore)),
      homeTries: data.walkover === 'home' ? 4 : (data.walkover === 'away' ? 0 : Number(data.homeTries || 0)),
      awayTries: data.walkover === 'away' ? 4 : (data.walkover === 'home' ? 0 : Number(data.awayTries || 0)),
      homeCards: Number(data.homeCards || 0), awayCards: Number(data.awayCards || 0),
      walkover: data.walkover || null,
      spiritNomineeHome: (data.spiritNomineeHome || '').trim() || null,
      spiritNomineeAway: (data.spiritNomineeAway || '').trim() || null,
      submittedBy: session.username, submittedAt: new Date().toISOString(),
    };
    await store.setJSON('all', results);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('submit-result error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
