// netlify/functions/submission-created.js
//
// Fires automatically after every Netlify Forms submission (both
// "team-registration" and "player-registration"). Appends a row to the
// matching Google Sheet so multiple people can view/manage registrations
// without needing Netlify dashboard access.
//
// Two sheets have already been created for you (in your "Quins JRT 2026" Drive folder):
//   Team Registrations:   https://docs.google.com/spreadsheets/d/1u1aGMMFFVsnbbw2atMQWOofGIG7gGMt0OK98ipwjAt8/edit
//   Player Registrations: https://docs.google.com/spreadsheets/d/1rrouliAtSlA2hqoVm8KG7Mke80oq6iBv4tJJkETi2jc/edit
// Each already has the correct header row in row 1. Share either sheet
// (Share button, top right) with anyone on your team who needs to see
// registrations — Viewer is enough, Editor if they should be able to
// correct entries by hand.
//
// ---------------------------------------------------------------------
// AUTH METHOD: Service account key
// ---------------------------------------------------------------------
// This function authenticates as a Google service account — a robot
// identity with its own email address (looks like
// name@project-id.iam.gserviceaccount.com). The two sheets above must be
// shared with that email (Share button, top right, Editor access) or the
// append calls below will fail with a 403.
//
// ONE-TIME SETUP:
// 1. https://console.cloud.google.com -> your project -> "APIs & Services"
//    -> Library -> enable the "Google Sheets API".
//
// 2. "IAM & Admin" -> "Service Accounts" -> Create service account (any
//    name, no project-level roles needed).
//
// 3. Open the service account -> "Keys" tab -> Add key -> Create new key
//    -> JSON. This downloads a JSON file — you should already have this.
//
// 4. Share both Google Sheets with the service account's email (the
//    `client_email` field in the JSON), Editor access.
//
// 5. In Netlify: Site configuration -> Environment variables -> add:
//      GOOGLE_SERVICE_ACCOUNT_EMAIL       = (the `client_email` field in the JSON)
//      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = (the `private_key` field in the JSON, quotes and all)
//      GOOGLE_SHEET_ID_TEAMS   = 1u1aGMMFFVsnbbw2atMQWOofGIG7gGMt0OK98ipwjAt8
//      GOOGLE_SHEET_ID_PLAYERS = 1rrouliAtSlA2hqoVm8KG7Mke80oq6iBv4tJJkETi2jc
//    The private key is multi-line — paste it exactly as it appears in the
//    JSON (including the literal "\n" sequences); the code below converts
//    those back into real newlines.
//
// 6. Make sure netlify.toml points at the functions folder, e.g.:
//      [build]
//        functions = "netlify/functions"
//
// 7. Deploy. From then on, every new form submission automatically
//    appends a row to the matching sheet.
// ---------------------------------------------------------------------

const { sendConfirmation } = require('./_email');
const { nextTeamCode } = require('./_teams');
/* The column order and the row builders. They used to be written out by hand
   here AND in both readers — three copies, kept in step by eye. See _intake.js
   for why that was worth ending. */
const I = require('./_intake');
/* Service-account auth and the private-key repair, in one place — they used
   to be written out in this file and two others. See _sheets.js. */
const { getAuth, firstSheetName, sheetsClient } = require('./_sheets');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { form_name: formName, data } = body.payload;

    const auth = getAuth();
    const sheets = sheetsClient(auth);

    let spreadsheetId, columns, values;
    const submittedAt = new Date().toISOString();

    if (formName === 'team-registration') {
      spreadsheetId = process.env.GOOGLE_SHEET_ID_TEAMS;
      columns = I.TEAM_RANGE;

      /* The team code (e.g. ADH1) is generated here rather than typed by the
         coach, so it is consistent everywhere it appears. It counts the club's
         existing entries in the same age group, which means the sheet has to
         be read before the row is appended. */
      const sheetName = await firstSheetName(sheets, spreadsheetId);
      let existingRows = [];
      try {
        const current = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!${I.TEAM_RANGE}`,
        });
        const [, ...rows] = current.data.values || [[]]; // drop header
        existingRows = rows;
      } catch (e) {
        /* If the read fails the registration still matters more than the code,
           so fall through with an empty list — the team just becomes <prefix>1
           and an organiser can renumber it in the sheet. */
        console.warn('could not read teams sheet for numbering:', e.message);
      }

      const teamCode = nextTeamCode(data.club, data['age-group'], existingRows);
      data['team-name'] = teamCode; // so the confirmation email shows it too

      values = [I.teamRow(data, teamCode, submittedAt)];
    } else if (formName === 'player-registration') {
      spreadsheetId = process.env.GOOGLE_SHEET_ID_PLAYERS;
      columns = I.PLAYER_RANGE;
      values = [I.playerRow(data, submittedAt)];
    } else {
      // Not one of our two forms (e.g. Netlify's own honeypot test) — ignore.
      return { statusCode: 200, body: 'ignored' };
    }

    const range = `${await firstSheetName(sheets, spreadsheetId)}!${columns}`;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      /* RAW, not USER_ENTERED. USER_ENTERED tells Sheets to parse each value
         as if a human had typed it, which did two bad things:
           1. a leading "+" starts a formula, so "+971501234567" was evaluated
              and stored as the number 971501234567 - the country-code prefix
              silently vanished from every phone number.
           2. the registration form is public, so anything a registrant typed
              beginning with "=" landed as a LIVE formula in a sheet holding
              children's names, DOBs and medical notes. IMPORTDATA/IMPORTXML in
              a free-text box could pull that data out to an external URL.
         RAW stores exactly what was submitted, as text. */
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    /* Confirmation email to whoever registered. Deliberately AFTER the sheet
       write and wrapped in its own try/catch: the row is the record that
       matters, so a mail failure must never cost us a registration, and must
       never make Netlify retry a submission that was already saved (which
       would duplicate the row). A failure here is logged and swallowed. */
    try {
      const result = await sendConfirmation(formName, data);
      if (result.sent) {
        console.log(`confirmation sent for ${formName} (${result.count} recipient(s))`);
      } else {
        console.warn(`confirmation not sent for ${formName}: ${result.reason}`);
      }
    } catch (mailErr) {
      console.error('confirmation email failed (registration WAS saved):', mailErr.message);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    // Netlify retries background functions on failure, and logs this in
    // the function's own log tab — check there if rows stop appearing.
    console.error('submission-created error:', err);
    return { statusCode: 500, body: 'error' };
  }
};
