// netlify/functions/get-result-history.js
//
// Who set a match's score, and what it was before — for the table.
// Spec: claude/specs/spec-pitch-marshals-sep-2026.md § 4.
//
// GET ?matchId=<id>, Authorization: Bearer <session token>
//   manager for that group or organiser
//   -> { ok, current: entry|null, history: [entry, …] }   newest first
//
// A marshal token is refused: a marshal sees the current score on the sheet
// and the first name of who set it (marshal-info.js), never the history.

const { resolveSession, sessionRefusal, hasAgeGroupAccess, blobStore } = require('./_auth');
const { readMatch, readResultHistory } = require('./_results');

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const auth = await resolveSession(event);
    if (!auth.ok) return sessionRefusal(auth);
    const session = auth.session;
    if (session.role !== 'manager' && session.role !== 'organizer') return json(403, { ok: false, error: 'Not allowed.' });
    const matchId = String((event.queryStringParameters || {}).matchId || '').trim();
    if (!matchId) return json(400, { ok: false, error: 'Missing matchId.' });
    const agId = matchId.split(':')[0];
    if (!hasAgeGroupAccess(session, agId)) return json(403, { ok: false, error: 'You can only see the history for your own age group.' });

    const store = blobStore('results');
    let current = null;
    try { current = await readMatch(store, matchId); } catch (e) { current = null; }
    const history = await readResultHistory(store, matchId);
    return json(200, { ok: true, current, history });
  } catch (err) {
    console.error('get-result-history error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
