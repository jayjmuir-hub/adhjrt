// netlify/functions/get-results.js
//
// Returns every recorded match result so the Standings page (and the
// dashboards) can compute tables and brackets client-side.
//
// ⚠️ THE PUBLIC ANSWER CARRIES SCORING FIELDS ONLY (8 Sep 2026,
// spec-pitch-marshals § 5). Until then this returned each record whole,
// which meant the USERNAME of whichever manager entered a score
// (`submittedBy`) and the two Spirit-of-Rugby NOMINEES — children's names
// typed by a manager — went to every visitor of the public Standings page.
// CLAUDE.md rule 11 says neither may be public. With pitch marshals the
// record also carries a volunteer parent's first name (`enteredBy.name`).
//
// A caller holding a MANAGER or ORGANISER session gets the full record: the
// Spirit award tab on /manager needs the nominees, and the Results tab shows
// who entered a score. A marshal token is not a session and gets the public
// shape. The strip is a positive allow-list, so a field added to the record
// later is private until somebody decides otherwise.

const { blobStore, optionalSession } = require('./_auth');
const { readAll } = require('./_results');

const PUBLIC_FIELDS = [
  'homeScore', 'awayScore', 'homeTries', 'awayTries',
  'homeConversions', 'awayConversions', 'homePenalties', 'awayPenalties',
  'homeDrops', 'awayDrops', 'homeCards', 'awayCards', 'walkover', 'submittedAt',
];

function publicView(entry) {
  const out = {};
  for (const k of PUBLIC_FIELDS) if (entry && entry[k] !== undefined) out[k] = entry[k];
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    /* Merges the per-age-group blobs over the legacy 'all' blob — see
       _results.js. The response shape is unchanged: one flat object keyed by
       matchId, exactly as every caller already expects. */
    const store = blobStore('results');
    const results = await readAll(store);

    const session = await optionalSession(event);
    const trusted = !!(session && (session.role === 'manager' || session.role === 'organizer'));
    if (trusted) return { statusCode: 200, body: JSON.stringify({ ok: true, results }) };

    const stripped = {};
    for (const id of Object.keys(results)) stripped[id] = publicView(results[id]);
    return { statusCode: 200, body: JSON.stringify({ ok: true, results: stripped }) };
  } catch (err) {
    console.error('get-results error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};

module.exports.PUBLIC_FIELDS = PUBLIC_FIELDS;
