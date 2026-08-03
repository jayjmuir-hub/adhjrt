// netlify/functions/get-registrations.js
//
// Returns the live team & player registrations from the two Google
// Sheets, for a signed-in Organizer. Requires an Authorization: Bearer
// <token> header minted by login.js, google-auth.js or organizer-signup.js
// — the
// token is verified here (see _auth.js), so the sheets themselves never
// need to be public.
//
// Setup: the same GOOGLE_SERVICE_ACCOUNT_* / GOOGLE_SHEET_ID_* vars as
// submission-created.js, plus SESSION_SECRET (see organizer-signup.js).
const { verify, getBearerToken } = require('./_auth');

/* Service-account auth and the private-key repair, in one place — they used
   to be written out in this file and two others. See _sheets.js. */
const { getReadAuth, firstSheetName, sheetsClient } = require('./_sheets');

/* The sheet column order, the field names /organizer expects, and the two row
   mappers. All three used to be written out by hand in this file AND in the
   other reader AND in submission-created.js — see _intake.js. */
const { mapTeamRow, mapPlayerRow, TEAM_RANGE, PLAYER_RANGE } = require('./_intake');


async function readRows(auth, spreadsheetId, columns) {
  const sheets = sheetsClient(auth);
  const range = `${await firstSheetName(sheets, spreadsheetId)}!${columns}`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const [, ...rows] = res.data.values || [[]]; // skip header row
  return rows;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const session = verify(getBearerToken(event));
    if (!session || session.role !== 'organizer') {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Not signed in.' }) };
    }

    const auth = getReadAuth();
    const [teamRows, playerRows] = await Promise.all([
      readRows(auth, process.env.GOOGLE_SHEET_ID_TEAMS, TEAM_RANGE),
      readRows(auth, process.env.GOOGLE_SHEET_ID_PLAYERS, PLAYER_RANGE),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        teams: teamRows.map(mapTeamRow),
        players: playerRows.map(mapPlayerRow),
      }),
    };
  } catch (err) {
    console.error('get-registrations error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
