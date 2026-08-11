/* netlify/functions/club-link.js — the Club invite link box on /organizer.
   ===========================================================================
   Spec: claude/specs/spec-club-invite-link.md

   Stores the silent club-registration link so it lives somewhere findable
   rather than in one person's sent mail, and reports whether it still works.

   ⚠️⚠️ GET IS ORGANISER-ONLY, AND THAT IS THE WHOLE SECURITY OF THIS FILE.
   registration-window.js — the endpoint this is otherwise modelled on — has a
   PUBLIC GET, because when the entry forms open is a public fact. The club link
   carries CLUB_FORM_KEY, which is the only thing protecting that form: the page
   being unlisted is not protection, since this repo is public and the path is
   readable in the source. Copying that endpoint's shape wholesale would publish
   the key to anybody who asked for it. The two files look alike on purpose and
   must NOT be made consistent.

   ⚠️ CLUB_FORM_KEY ITSELF IS NEVER RETURNED, LOGGED OR ECHOED IN AN ERROR. The
   only thing said about it is a status string derived from a comparison made
   here, on the server, which is the only place that knows the real value.

   ⚠️ WHY THE STATUS EXISTS AT ALL. The key now lives in two places — Netlify's
   environment variable and this blob — and they can disagree. The dangerous
   direction is silent: rotate the key in Netlify and the saved link goes on
   LOOKING fine while being dead, so it gets emailed to twenty clubs and the
   failure surfaces when they cannot submit. */

const { resolveSession, sessionRefusal, blobStore } = require('./_auth');

const STORE = 'config';
const KEY = 'club-link';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/* The `k` value out of a stored link, or '' if there is not one. Deliberately
   tolerant: this reads whatever an organiser pasted, and a link that cannot be
   parsed is reported as broken rather than throwing. */
function keyOf(link) {
  const m = String(link || '').match(/[?&]k=([^&#\s]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* ⚠️ FOUR STATES, NOT TWO, and the fourth is the one that matters most.
   'off' is not a broken link — it means the form is switched off at the
   Netlify end, which is Jay's deliberate off switch, and saying "this link no
   longer works" there would send him looking for the wrong problem. */
function statusOf(link) {
  const expected = process.env.CLUB_FORM_KEY || '';
  if (!link) return 'empty';
  if (!expected) return 'off';
  return keyOf(link) === expected ? 'working' : 'stale';
}

async function load() {
  try {
    const rec = await blobStore(STORE).get(KEY, { type: 'json' });
    return (rec && typeof rec === 'object') ? rec : null;
  } catch (err) {
    /* ⚠️ The message only, never the record — a thrown blob error can carry the
       value it failed on. Fails SOFT: a card that cannot load must not take the
       Clubs tab down with it. */
    console.error('club-link: could not read the stored link —', err && err.message);
    return null;
  }
}

/* Organiser-only, on every method. Returns the session or a ready-made refusal. */
async function requireOrganizer(event) {
  const auth = await resolveSession(event);
  if (!auth.ok) return { refusal: sessionRefusal(auth) };
  if (auth.session.role !== 'organizer') {
    return {
      refusal: json(403, {
        ok: false,
        error: 'Only tournament organisers can see or change the club invite link.',
      }),
    };
  }
  return { session: auth.session };
}

exports.handler = async (event) => {
  const gate = await requireOrganizer(event);
  if (gate.refusal) return gate.refusal;

  try {
    if (event.httpMethod === 'GET') {
      const rec = await load();
      const link = (rec && rec.link) || '';
      return json(200, {
        ok: true, link, status: statusOf(link),
        savedAt: (rec && rec.savedAt) || '', savedBy: (rec && rec.savedBy) || '',
      });
    }

    if (event.httpMethod === 'POST') {
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

      /* Clearing is its OWN action, never "save an empty box". Emptying the
         field by accident and pressing Save must not wipe it silently. */
      if (body.clear) {
        try { await blobStore(STORE).delete(KEY); } catch (e) { /* already gone */ }
        return json(200, { ok: true, link: '', status: 'empty', savedAt: '', savedBy: '' });
      }

      const link = String(body.link || '').trim();
      if (!link) return json(400, { ok: false, error: 'Paste the link, or use Clear to remove it.' });
      if (!/^https:\/\/[^\s]+\/register-club\?[^\s]*\bk=[^\s&#]+/.test(link)) {
        return json(400, {
          ok: false,
          error: 'That does not look like the club link. It should be the https://…/register-club address with ?k= on the end.',
        });
      }

      /* ⚠️ A WRONG KEY IS ACCEPTED ON PURPOSE. Refusing one would turn this
         endpoint into an oracle for guessing CLUB_FORM_KEY, and a wrong key is
         a state this card is built to REPORT rather than prevent — see the GET
         status above. */
      const rec = { link, savedAt: new Date().toISOString(), savedBy: gate.session.username };
      try {
        await blobStore(STORE).setJSON(KEY, rec);
      } catch (err) {
        console.error('club-link: could not save —', err && err.message);
        return json(503, { ok: false, error: 'Could not save just now. Please try again.' });
      }
      return json(200, { ok: true, link, status: statusOf(link), savedAt: rec.savedAt, savedBy: rec.savedBy });
    }

    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('club-link: unexpected —', err && err.message);
    return json(500, { ok: false, error: 'Something went wrong.' });
  }
};

/* Exported for the tests, which drive the states rather than grepping them. */
module.exports.statusOf = statusOf;
module.exports.keyOf = keyOf;
