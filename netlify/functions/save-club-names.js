// netlify/functions/save-club-names.js
//
// The organiser's OFFICIAL club names — the curation behind the public sign-up
// dropdown (JRT-7). One small config blob mapping a NORMALISED declared club
// name to the official name an organiser typed on the Clubs tab.
//
// GET  (organisers only) -> { ok, names, rev, savedAt, savedBy }
// POST (organisers only)
//   { club, officialName, rev }  -> set/replace one club's official name
//   { club, clear:true, rev }    -> remove one club's official name
//
// ⚠️ ORGANISER-ONLY on every method — this WRITES the list the public dropdown
//    reads. The PUBLIC read is a different endpoint (registered-clubs.js), which
//    returns names only. The two must never converge (cf. club-link.js).
//
// ⚠️ NAMES ONLY IN THE MAP. The value is the official name string; the KEY is
//    the normalised declared name. No contact detail is ever stored here, so the
//    public join has nothing personal to leak.
//
// ⚠️ CLEAR IS ITS OWN ACTION. A blank officialName is refused, never treated as
//    a delete — same doctrine as club-link.js, so emptying the box by accident
//    and pressing Save cannot un-name a club.
//
// ⚠️ OPTIMISTIC CONCURRENCY, NOT A LOCK. Netlify Blobs has no compare-and-set,
//    so two organisers saving at the same instant could still race in the few ms
//    between this server's read and its write. The `rev` guard shrinks the loss
//    window from a whole human edit to that, and the client re-applies its one
//    change and retries once on a 409. Enough for a couple of organisers; the
//    honest limit is recorded in the decision card.

const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { normaliseClubName, isRehearsal } = require('./_regstore');

const STORE = 'config';
const KEY = 'club-names';
const MAX_NAME = 80;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/* Organiser-only, on every method (like club-link.js). A dead/invalid session
   goes through sessionRefusal (which carries sessionEnded so the client signs
   out); a signed-in NON-organiser gets a plain 403 with NO sessionEnded, so a
   manager is refused without being logged out. */
async function requireOrganizer(event) {
  const auth = await resolveSession(event);
  if (!auth.ok) return { refusal: sessionRefusal(auth) };
  if (auth.session.role !== 'organizer') {
    return { refusal: json(403, { ok: false, error: 'Only tournament organisers can name clubs.' }) };
  }
  return { session: auth.session };
}

async function load() {
  try {
    const rec = await blobStore(STORE).get(KEY, { type: 'json' });
    if (rec && typeof rec === 'object' && rec.names && typeof rec.names === 'object') {
      return { v: 1, rev: rec.rev || 0, names: rec.names, savedAt: rec.savedAt || '', savedBy: rec.savedBy || '' };
    }
  } catch (err) {
    /* Message only, never the record. Fails soft to an empty map so the Clubs
       tab can still load. */
    console.error('save-club-names: could not read —', err && err.message);
  }
  return { v: 1, rev: 0, names: {}, savedAt: '', savedBy: '' };
}

const publicShape = (rec) => ({ ok: true, names: rec.names, rev: rec.rev, savedAt: rec.savedAt || '', savedBy: rec.savedBy || '' });

const hasControlChar = (s) => {
  for (let i = 0; i < s.length; i += 1) if (s.charCodeAt(i) < 32) return true;
  return false;
};

exports.handler = async (event) => {
  const gate = await requireOrganizer(event);
  if (gate.refusal) return gate.refusal;

  try {
    if (event.httpMethod === 'GET') return json(200, publicShape(await load()));

    if (event.httpMethod === 'POST') {
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

      /* The club identity is required for both set and clear. */
      if (typeof body.club !== 'string' || !body.club.trim()) {
        return json(400, { ok: false, error: 'Which club? A club name is required.' });
      }
      /* A rehearsal never gets a map entry at all — a pure string test, no store
         read, so it cannot become a name the public join would have to filter. */
      if (isRehearsal(body.club)) {
        return json(400, { ok: false, error: 'Rehearsal clubs are not named — they never appear in the public list.' });
      }
      const key = normaliseClubName(body.club);
      if (!key) return json(400, { ok: false, error: 'That club name is empty once tidied.' });

      const current = await load();

      /* Optimistic guard: a stale rev means someone else saved first. Hand back
         the fresh map and rev so the client re-applies its one change and Saves. */
      if (typeof body.rev === 'number' && body.rev !== current.rev) {
        return json(409, {
          ok: false, conflict: true, names: current.names, rev: current.rev,
          error: 'Someone else changed the club names — reloaded the latest, press Save again.',
        });
      }

      const names = { ...current.names };

      if (body.clear === true) {
        delete names[key];
      } else {
        /* VALIDATE, DON'T COERCE — a number/array/object is a mistake, not a name. */
        if (typeof body.officialName !== 'string') {
          return json(400, { ok: false, error: 'The official name must be text.' });
        }
        const official = body.officialName.trim();
        if (!official) return json(400, { ok: false, error: 'Type the official name, or use Clear to remove it.' });
        if (official.length > MAX_NAME) return json(400, { ok: false, error: 'Keep the official name under ' + MAX_NAME + ' characters.' });
        /* The official name is shown publicly and can land in a CSV export, so a
           leading =, +, - or @ (a spreadsheet formula trigger) is refused. */
        if (/^[=+@-]/.test(official)) return json(400, { ok: false, error: 'The official name cannot start with =, +, - or @.' });
        if (hasControlChar(official)) return json(400, { ok: false, error: 'The official name contains a control character.' });
        names[key] = official;
      }

      const rec = { v: 1, rev: current.rev + 1, names, savedAt: new Date().toISOString(), savedBy: gate.session.username };
      try {
        await blobStore(STORE).setJSON(KEY, rec);
      } catch (err) {
        console.error('save-club-names: could not save —', err && err.message);
        return json(503, { ok: false, error: 'Could not save just now. Please try again.' });
      }
      return json(200, publicShape(rec));
    }

    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('save-club-names: unexpected —', err && err.message);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
