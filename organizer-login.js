// netlify/functions/get-schedule-override.js
//
// Public endpoint: returns the saved custom draw (pool membership + match
// slots with times) for one age group, if a manager/organizer has ever
// edited it via save-schedule-override.js. Returns { ok, schedule: null }
// if nobody has customized this age group yet — the app then falls back
// to its deterministic auto-generated draw (see scores-data.js), so every
// untouched age group behaves exactly as before.

const { blobStore } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const ageGroupId = (event.queryStringParameters || {}).age;
    if (!ageGroupId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing age.' }) };
    const store = blobStore('schedules');
    const schedule = await store.get(ageGroupId, { type: 'json' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, schedule: schedule || null }) };
  } catch (err) {
    console.error('get-schedule-override error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
