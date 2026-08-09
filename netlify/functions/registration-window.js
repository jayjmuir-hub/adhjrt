// netlify/functions/registration-window.js
//
// When the registration forms are open.
//
// GET (public)
//   -> { ok, settings, state, defaults, warnings, now }
//
//   Public on purpose, and it has to be: the homepage decides whether to show
//   "Register a team" before a visitor has done anything, and there is nobody to
//   sign in as. It carries no personal data — two dates and a mode.
//
//   `state` is this server's own answer for its own `now`. The front end does
//   not use it to decide anything (it recomputes from `settings` every second,
//   so the phase flips on a page that is left open), but having the server's
//   reading on the wire makes a disagreement visible instead of theoretical.
//
// POST (organisers only)
//   { settings: { opensAt, closesAt, mode } }  -> validate, save, return it
//   { reset: true }                            -> delete the override
//
//   Managers deliberately cannot write here. When registration opens is a
//   tournament-wide decision, not a per-age-group one — same reasoning as
//   venue-layout.js and scoring-rules.js.
//
// This file itself is display only — it decides what the site SHOWS, nothing
// more. The actual gate is enforced elsewhere: submit-registration.js calls
// registrationState() before writing anything and refuses with a real error
// outside the window (see _intake.js, step 4). That was still the plan when
// this comment was first written; it's since been built — noted 30 Jul so
// the next reader doesn't re-open a decision that's already done.

const { resolveSession, blobStore } = require('./_auth');
const {
  DEFAULT_REGISTRATION,
  loadRegistration, validateSettings, registrationWarnings, registrationState,
} = require('./_registration');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/* One shape for every successful reply, so the panel and the homepage never
   have to care which branch produced it. */
const reply = (settings, extra) => {
  const now = Date.now();
  return json(200, {
    ok: true,
    settings,
    state: registrationState(settings, now),
    defaults: DEFAULT_REGISTRATION,
    warnings: registrationWarnings(settings, now),
    now,
    ...(extra || {}),
  });
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      return reply(await loadRegistration(blobStore));
    }

    if (event.httpMethod === 'POST') {
      const auth = await resolveSession(event);
      if (!auth.ok) return json(auth.status, { ok: false, error: auth.error });
      const session = auth.session;
      if (session.role !== 'organizer') {
        return json(403, {
          ok: false,
          error: 'Only tournament organisers can change the registration window — it affects every age group.',
        });
      }

      const store = blobStore('config');
      const body = JSON.parse(event.body || '{}');

      /* Reset DELETES the key rather than writing the defaults back, so a later
         change to DEFAULT_REGISTRATION reaches a reset site instead of being
         masked by a stale copy of the old defaults. Same rule as venue-layout. */
      if (body.reset) {
        await store.delete('registration');
        return reply({ ...DEFAULT_REGISTRATION }, { reset: true });
      }

      const result = validateSettings(body.settings);
      if (!result.ok) return json(400, { ok: false, error: result.errors[0], errors: result.errors });

      await store.setJSON('registration', result.settings);
      return reply(result.settings);
    }

    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('registration-window error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
