// netlify/functions/submit-registration.js
//
// THE FRONT DOOR for team and player registrations.
//
// POST { form: 'team-registration' | 'player-registration', data: { … } }
//   200 { ok: true, teamCode? }   accepted, row written, confirmation sent
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
const { getAuth, firstSheetName, sheetsClient } = require('./_sheets');
const { loadRegistration, registrationState } = require('./_registration');
const { FORMS, handleSubmission } = require('./_intake');

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

      /* Read for the team numbering only. A failure here costs the tidy number,
         never the registration — handleSubmission catches it. */
      readTeamsSheet: async () => {
        const sheets = sheetsClient(getAuth());
        const id = process.env.GOOGLE_SHEET_ID_TEAMS;
        const name = await firstSheetName(sheets, id);
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${name}!${FORMS['team-registration'].range}` });
        const [, ...rows] = res.data.values || [[]];   // drop the header
        return rows;
      },

      appendRow: async (form, row) => {
        const spec = FORMS[form];
        const sheets = sheetsClient(getAuth());
        const id = process.env[spec.sheetEnv];
        const name = await firstSheetName(sheets, id);
        await sheets.spreadsheets.values.append({
          spreadsheetId: id,
          range: `${name}!${spec.range}`,
          /* RAW, never USER_ENTERED. USER_ENTERED parses each value as if a
             human had typed it, which did two bad things: a leading "+" starts
             a formula, so "+971501234567" was stored as a number and the
             country code silently vanished; and anything a registrant typed
             beginning with "=" landed as a LIVE formula in a sheet holding
             children's names, dates of birth and medical notes — IMPORTDATA in
             a free-text box could read them out to somebody else's server.
             This was found and fixed once already. Do not change it. */
          valueInputOption: 'RAW',
          requestBody: { values: [row] },
        });
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
