// netlify/functions/submit-result.js
//
// Records one match result. Requires an Authorization: Bearer <token>
// header minted by login.js, google-auth.js or manager-signup.js, OR an
// Organizer token from the same places — organizers can
// submit for any age group; a manager only for their own (the special
// "admin" manager invite code's accounts can act on any group too —
// see hasAgeGroupAccess in _auth.js). Never trust the client for this
// check; it's re-verified here from the signed token.
//
// Results are stored in Netlify Blobs, one JSON object per AGE GROUP,
// keyed by matchId inside it — see _results.js for the storage layout and
// why it is split that way. Requires the same SESSION_SECRET as the other
// auth functions.

const { resolveSession, hasAgeGroupAccess, blobStore } = require('./_auth');
const { scoringFor, totalFor, loadRules, FESTIVAL_AGE_IDS } = require('./_scoring');
const { readGroup, writeGroup } = require('./_results');
const { MAX_FIELD_CHARS } = require('./_intake');

// 30 Jul: every free-text field on the public registration form is capped at
// MAX_FIELD_CHARS (see _intake.js) before it's ever stored — this was the one
// free-text field a manager can write that skipped that cap entirely, and
// get-results.js serves it back to every visitor of the public Standings
// page, unauthenticated. Same cap, same reasoning.
const clip = (s) => String(s || '').trim().slice(0, MAX_FIELD_CHARS) || null;

const WALKOVER_SCORE = 20;

/* Netlify Blobs has no compare-and-set - a write is a plain overwrite of the
   whole object. Splitting results one blob per age group (see _results.js)
   means a save can now only ever collide with another save in the SAME group,
   which on a tournament day is one manager plus maybe an organiser. The window
   that remains is: both read the group, both write, and the second write -
   which never saw the first one's score - silently drops it.

   Closing it properly needs an atomic compare-and-set the platform doesn't
   offer, so do the next best thing: write, then read the group back and check
   our own entry actually survived. If it didn't, someone overwrote us - read
   the CURRENT group, merge our score into that, write again. Three attempts,
   then give up and TELL the manager it didn't save. Returning a false OK is the
   one outcome that must never happen: a score reported as saved but missing
   isn't noticed until the standings are wrong.

   `submittedAt` is the fingerprint checked for - it is our own timestamp, so
   finding it back proves OUR write is the one that stuck, not merely that
   somebody stored something for this match.

   Cost: one extra blob read per save. At ~600 matches over two days, nothing. */
const SAVE_ATTEMPTS = 3;

async function writeAndVerify(store, agId, apply, isDone) {
  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
    const results = await readGroup(store, agId);
    apply(results);
    await writeGroup(store, agId, results);
    const after = await readGroup(store, agId);
    if (isDone(after)) return true;
    console.warn(`submit-result: ${agId} write did not stick (attempt ${attempt} of ${SAVE_ATTEMPTS}) - retrying`);
  }
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const auth = await resolveSession(event);
    if (!auth.ok) {
      return { statusCode: auth.status, body: JSON.stringify({ ok: false, error: auth.error }) };
    }
    const session = auth.session;
    if (session.role !== 'manager' && session.role !== 'organizer') {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Not allowed.' }) };
    }

    const { matchId, data } = JSON.parse(event.body || '{}');
    if (!matchId || !data) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing matchId or data.' }) };
    const agId = matchId.split(':')[0];
    if (!hasAgeGroupAccess(session, agId)) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'You can only enter scores for your own age group.' }) };
    }

    /* U6 and U7 are non-competitive festival groups: no scores, no standings.
       The manager area hides score entry for them entirely, but that was the
       ONLY thing stopping a result being stored - a POST straight to this
       endpoint was accepted with 200 OK and written to the blob, where it sat
       as data no screen would ever show. Enforce it here too.

       Clearing is deliberately still allowed: a stray result stored before this
       check existed has to remain removable. */
    if (FESTIVAL_AGE_IDS.includes(agId) && data.clear !== true) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'This age group is a festival — no scores are kept for it.' }) };
    }

    /* Results are stored one blob per age group — see _results.js for why.
       readGroup returns only this age group's results, so a save here can never
       clobber a manager saving a different group at the same moment. */
    const store = blobStore('results');

    /* Clearing has to REMOVE the entry, not write zeros. A 0-0 draw is a real
       rugby result worth two league points each, so an emptied form saved as
       0-0 would quietly award points for a match that was never played. */
    if (data.clear === true) {
      const existing = await readGroup(store, agId);
      if (!existing[matchId]) return { statusCode: 200, body: JSON.stringify({ ok: true, cleared: true }) };
      const gone = await writeAndVerify(
        store, agId,
        (r) => { delete r[matchId]; },
        (r) => !r[matchId],
      );
      if (!gone) {
        return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'Could not confirm the result was cleared. Reload and try again.' }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, cleared: true }) };
    }
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

    const entry = {
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
      spiritNomineeHome: clip(data.spiritNomineeHome),
      spiritNomineeAway: clip(data.spiritNomineeAway),
      submittedBy: session.username, submittedAt: new Date().toISOString(),
    };

    const saved = await writeAndVerify(
      store, agId,
      (r) => { r[matchId] = entry; },
      (r) => !!r[matchId] && r[matchId].submittedAt === entry.submittedAt,
    );
    if (!saved) {
      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'Could not confirm the score was saved. Reload the match and enter it again.' }) };
    }

    /* Hand the STORED figures back so the screen can show the manager what the
       server actually holds, rather than echoing what they typed. The totals
       are computed here from the tries and kicks, so this is also the only
       place the real score exists before the next fetch. */
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        stored: { homeScore: entry.homeScore, awayScore: entry.awayScore, walkover: entry.walkover },
      }),
    };
  } catch (err) {
    console.error('submit-result error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
