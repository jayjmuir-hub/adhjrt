// netlify/functions/scoring-rules.js
//
// What can be scored at each age group, and who may change it.
//
// GET  (public)
//   -> { ok, rules: { u10: ["tries"], u16b: ["tries","conversions",...] , ... } }
//   Public because the score entry forms build themselves from it, and the
//   fixtures pages use it to label things. It is configuration, not data.
//
// POST (organisers only)
//   { rules: { u12: ["tries","conversions"] } }
//   -> merges over what is stored. Send only the age groups you are changing.
//
// Managers deliberately cannot write here: a manager correcting their own
// group's laws mid-tournament would silently change how every score in that
// group totals.

const { verify, getBearerToken, blobStore } = require('./_auth');
const { loadRules, cleanRules, BY_AGE, POINTS } = require('./_scoring');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const rules = await loadRules(blobStore);
      return json(200, { ok: true, rules, points: POINTS, defaults: BY_AGE });
    }

    if (event.httpMethod === 'POST') {
      const session = verify(getBearerToken(event));
      if (!session) return json(401, { ok: false, error: 'Not signed in.' });
      if (session.role !== 'organizer') {
        return json(403, { ok: false, error: 'Only tournament organisers can change the scoring rules.' });
      }

      const { rules } = JSON.parse(event.body || '{}');
      if (!rules || typeof rules !== 'object') {
        return json(400, { ok: false, error: 'Missing rules.' });
      }

      const store = blobStore('config');
      const current = (await store.get('scoring', { type: 'json' })) || {};
      const next = cleanRules({ ...current, ...rules });
      await store.setJSON('scoring', next);

      return json(200, { ok: true, rules: { ...BY_AGE, ...next } });
    }

    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('scoring-rules error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
