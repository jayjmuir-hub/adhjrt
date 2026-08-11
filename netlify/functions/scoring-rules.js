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

const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { loadRules, cleanRules, BY_AGE, POINTS, VALID } = require('./_scoring');

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
      const auth = await resolveSession(event);
      if (!auth.ok) return sessionRefusal(auth);
      const session = auth.session;
      if (session.role !== 'organizer') {
        return json(403, { ok: false, error: 'Only tournament organisers can change the scoring rules.' });
      }

      const { rules } = JSON.parse(event.body || '{}');
      if (!rules || typeof rules !== 'object') {
        return json(400, { ok: false, error: 'Missing rules.' });
      }

      /* ⚠️ VALIDATE, DO NOT COERCE. cleanRules() turns anything it does not
         recognise into ['tries'] — which is right for a blob READ, where the
         alternative is a broken tournament, and wrong here, where somebody is
         telling us what the rules ARE.

         Before this check: POST {"rules":{"u16b":"tries,conversions"}} — a
         string rather than an array, an ordinary client bug — answered
         200 {ok:true} and stored u16b:['tries']. From that moment every U16B
         result totalled tries only; conversions, penalties and drop goals
         scored zero. The manager saw the stored figures echoed back, so it
         looked deliberate, and nothing anywhere distinguished it from a real
         rule change.

         Wrong-cased or unknown keys were worse: {"u16B":[...]} wrote a key
         nothing ever reads and left U16B on the defaults, also with 200 ok. */
      const groups = Object.keys(BY_AGE);
      for (const ag of Object.keys(rules)) {
        if (!groups.includes(ag)) {
          return json(400, { ok: false, error: `Unknown age group: ${ag}` });
        }
        if (!Array.isArray(rules[ag])) {
          return json(400, { ok: false, error: `Scoring for ${ag} must be a list, not ${typeof rules[ag]}.` });
        }
        const unknown = rules[ag].filter((k) => !VALID.includes(k));
        if (unknown.length) {
          return json(400, { ok: false, error: `Unknown scoring component(s) for ${ag}: ${unknown.join(', ')}` });
        }
        /* An empty list is a real choice nobody can mean: cleanRules would turn
           it into ['tries'] and report success, so the organiser would believe
           they had switched scoring OFF for that group. */
        if (!rules[ag].length) {
          return json(400, { ok: false, error: `${ag} must score at least one thing.` });
        }
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
