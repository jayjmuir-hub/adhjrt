// netlify/functions/submit-registration.js
//
// THE FRONT DOOR for team and player registrations.
//
// POST { form: 'team-registration' | 'player-registration', data: { … } }
//   200 { ok: true, teamCode? }   accepted, record stored, confirmation sent
//   400 { ok: false, error, field }  refused, with a sentence written for a coach
//   403 { ok: false, error }      registration is not open
//   429 { ok: false, error, retryAfterSecs }
//   500 { ok: false, error }      not saved; the submission is parked for replay
//
// ---------------------------------------------------------------------
// THIS FILE CONTAINS NO DECISIONS, DELIBERATELY.
// ---------------------------------------------------------------------
// It builds the real Google client, mailer and blob store, hands them to
// handleSubmission() in _intake.js, and turns the answer into an HTTP response.
// That split is not tidiness: a fresh clone has no node_modules, so anything
// requiring googleapis cannot be loaded by a test AT ALL. Everything that
// decides anything lives in _intake.js, which is dependency-free and has 400+
// checks against it. Keep it that way — a rule added here is a rule nothing can
// test.
//
// ---------------------------------------------------------------------
// WHAT THIS REPLACED, AND WHAT THAT COST.
// ---------------------------------------------------------------------
// Registrations used to POST straight to Netlify Forms, which caught them
// before any of our code ran — so there was nowhere to stand and refuse one.
// Netlify was also, without anybody choosing it, providing spam filtering and
// throttling, and standing between the public and a Google Sheet.
//
// This endpoint is public and unauthenticated. It writes rows into a sheet
// holding children's names, dates of birth and medical notes, and it sends mail
// from admin@adhjrt.com to an address taken out of the request body. The three
// guards that replace what Netlify was doing — the allow-list, the validation
// and the rate limit — are all in _intake.js and all run before any of that.
// Do not add a path through here that skips them.

const { blobStore } = require('./_auth');
const { sendConfirmation } = require('./_email');
const { loadRegistration, registrationState } = require('./_registration');
const { FORMS, handleSubmission } = require('./_intake');
const { STORE_NAME, makeKey, buildRecord, writeOnce, teamRowsForNumbering } = require('./_regstore');

/* The squad list is the only large field and it is capped at 8000 characters
   in _intake.js. 64 KB is far past any real submission and stops a megabyte
   being parsed before anything has had a chance to refuse it. */
const MAX_BODY_BYTES = 64 * 1024;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/* Netlify's own header. NOT x-forwarded-for, which is caller-supplied and
   would let anyone pick their own rate-limit bucket. */
const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

    const raw = event.body || '';
    if (Buffer.byteLength(raw, event.isBase64Encoded ? 'base64' : 'utf8') > MAX_BODY_BYTES) {
      return json(400, { ok: false, error: 'That submission is too large. Please email admin@adhjrt.com.' });
    }

    let body;
    try {
      body = JSON.parse(event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw);
    } catch (err) {
      return json(400, { ok: false, error: 'We could not read that submission.' });
    }

    const config = blobStore('config');

    const result = await handleSubmission(body, {
      now: Date.now(),
      ip: clientIp(event),
      rateStore: config,
      loadRegistration: () => loadRegistration(blobStore),
      registrationState,

      /* Team numbering reads the STORE (Sep 2026; it used to read the teams
         sheet). Live team records only — a superseded team must not keep its
         old code alive. A failure here REFUSES the submission, see _intake.js
         step 5: numbering from an empty list mints a duplicate code. */
      readTeamsSheet: async () => teamRowsForNumbering(blobStore(STORE_NAME)),

      /* THE RECORD (Sep 2026; it used to append a sheet row). One key per
         submission, write-once — _regstore.js refuses an existing key and has
         no update. The row keeps the sheet column order, so the readers'
         mappers are unchanged. The club is read out of the row by position so
         the rehearsal flag can be set without _intake.js knowing about it. */
      appendRow: async (form, row) => {
        const spec = FORMS[form];
        const club = row[spec.columns.indexOf('club')];
        const store = blobStore(STORE_NAME);
        const nowMs = Date.now();
        await writeOnce(store, makeKey(form, nowMs), buildRecord({ form, row, nowMs, club }));
      },

      sendConfirmation,

      /* The dead letter. When the sheet write fails, the submission is kept so
         it can be replayed by hand rather than simply lost — which is better
         than the Netlify Forms copy this replaces, because this one can be read
         programmatically.
         ⚠️ THIS BLOB HOLDS CHILDREN'S PERSONAL DATA. It is private to the
         site's Netlify account. Do not widen access to the `config` store, do
         not expose it through any endpoint, and clear it once entries have been
         replayed. */
      parkFailed: async (form, data, message) => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const suffix = Math.random().toString(36).slice(2, 8);
        await config.setJSON(`failed-submissions/${stamp}-${suffix}`, { form, data, error: message });
      },

      /* Field NAMES and counts only. Never a value — see _intake.js. */
      log: (message) => console.log(`submit-registration: ${message}`),
    });

    return json(result.status, result.body);
  } catch (err) {
    /* The message only. The submission itself never goes near a log. */
    console.error('submit-registration error:', err && err.message);
    return json(500, { ok: false, error: 'Something went wrong at our end — nothing has been registered. Please email admin@adhjrt.com.' });
  }
};
