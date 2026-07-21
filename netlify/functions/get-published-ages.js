// netlify/functions/get-published-ages.js
//
// Public endpoint: returns the ids of every age group whose fixtures have been
// published, e.g. { ok: true, ages: ["u8", "u14b"] }.
//
// The homepage uses this to decide whether to veil its Fixtures and Results
// sections with a "coming soon" overlay. Doing it in one call avoids the
// alternative of asking get-schedule-override about all fifteen age groups
// separately every time somebody loads the page.
//
// Published copies are stored under the "pub:" prefix in the schedules blob
// store (see _publish.js), so listing that prefix is the whole job. Only keys
// are read — never the schedules themselves — so this stays cheap.

const { blobStore } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const store = blobStore('schedules');
    const { blobs } = await store.list({ prefix: 'pub:' });
    const ages = (blobs || [])
      .map((b) => String(b.key || '').slice(4)) // strip "pub:"
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, ages }),
    };
  } catch (err) {
    console.error('get-published-ages error:', err);
    /* Fail closed: an error returns an empty list, so the site shows
       "coming soon" rather than risking placeholder fixtures appearing. */
    return { statusCode: 200, body: JSON.stringify({ ok: true, ages: [] }) };
  }
};
