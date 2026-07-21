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
const { scoringFor, totalFor, loadRules } = require('./_scoring');

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
    /* The score is COMPUTED here from the tries and kicks, using the rules for
       this age group (see _scoring.js). The client's own total is ignored, so
       a typo or a tampered request can never store a score that disagrees with
       the detail recorded beside it. */
    /* Organisers can change what counts at each age group, so read the live
       rules rather than the compiled-in defaults. */
    const rules = await loadRules(blobStore);
    const allowed = rules[agId] || scoringFor(agId);
    const pick = (side) => {
      const out = {};
      allowed.forEach((k) => { out[k] = Math.max(0, Math.floor(Number(data[side + k.charAt(0).toUpperCase() + k.slice(1)]) || 0)); });
      return out;
    };
    const homeParts = pick('home');
    const awayParts = pick('away');

    const wo = data.walkover === 'home' || data.walkover === 'away' ? data.walkover : null;
    const homeTotal = wo === 'home' ? WALKOVER_SCORE : wo === 'away' ? 0 : totalFor(agId, homeParts, rules);
    const awayTotal = wo === 'away' ? WALKOVER_SCORE : wo === 'home' ? 0 : totalFor(agId, awayParts, rules);

    results[matchId] = {
      homeScore: homeTotal,
      awayScore: awayTotal,
      homeTries: wo === 'home' ? 4 : wo === 'away' ? 0 : (homeParts.tries || 0),
      awayTries: wo === 'away' ? 4 : wo === 'home' ? 0 : (awayParts.tries || 0),
      homeConversions: wo ? 0 : (homeParts.conversions || 0),
      awayConversions: wo ? 0 : (awayParts.conversions || 0),
      homePenalties: wo ? 0 : (homeParts.penalties || 0),
      awayPenalties: wo ? 0 : (awayParts.penalties || 0),
      homeDrops: wo ? 0 : (homeParts.drops || 0),
      awayDrops: wo ? 0 : (awayParts.drops || 0),
      homeCards: Number(data.homeCards || 0), awayCards: Number(data.awayCards || 0),
      walkover: wo,
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
