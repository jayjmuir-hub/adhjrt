// netlify/functions/get-results.js
//
// Public endpoint: returns every recorded match result so the Standings
// page (and any manager's dashboard) can compute tables/brackets
// client-side. No auth needed — these are final scores, not personal
// data. Writes happen only through submit-result.js, which does require
// a signed-in manager.

const { blobStore } = require('./_auth');
const { readAll } = require('./_results');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    /* Merges the per-age-group blobs over the legacy 'all' blob — see
       _results.js. The response shape is unchanged: one flat object keyed by
       matchId, exactly as every caller already expects. */
    const store = blobStore('results');
    const results = await readAll(store);
    return { statusCode: 200, body: JSON.stringify({ ok: true, results }) };
  } catch (err) {
    console.error('get-results error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
