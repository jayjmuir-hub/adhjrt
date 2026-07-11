// netlify/functions/get-results.js
//
// Public endpoint: returns every recorded match result so the Standings
// page (and any manager's dashboard) can compute tables/brackets
// client-side. No auth needed — these are final scores, not personal
// data. Writes happen only through submit-result.js, which does require
// a signed-in manager.

const { blobStore } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const store = blobStore('results');
    const results = (await store.get('all', { type: 'json' })) || {};
    return { statusCode: 200, body: JSON.stringify({ ok: true, results }) };
  } catch (err) {
    console.error('get-results error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
