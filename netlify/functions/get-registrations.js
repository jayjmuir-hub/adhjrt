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
const { resolveSession } = require('./_auth');

/* Service-account auth and the private-key repair, in one place — they used
   to be written out in this file and two others. See _sheets.js. */
const { getReadAuth, firstSheetName, sheetsClient } = require('./_sheets');

/* The sheet column order, the field names /organizer expects, and the two row
   mappers. All three used to be written out by hand in this file AND in the
   other reader AND in submission-created.js — see _intake.js. */
const { mapTeamRow, mapPlayerRow, mapClubRow, TEAM_RANGE, PLAYER_RANGE, CLUB_RANGE } = require('./_intake');


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
    /* `sess`, not `auth` — getReadAuth() below already owns that name here. */
    const sess = await resolveSession(event);
    if (!sess.ok) {
      return { statusCode: sess.status, body: JSON.stringify({ ok: false, error: sess.error }) };
    }
    if (sess.session.role !== 'organizer') {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Only tournament organisers can see every age group’s registrations.' }) };
    }

    const auth = getReadAuth();

    /* ⚠️ THE CLUBS SHEET IS READ SEPARATELY AND FAILS SOFT, unlike the other
       two. Club declarations are a planning nicety; teams and players are the
       tournament. GOOGLE_SHEET_ID_CLUBS is the newest of the three variables
       and the club feature has already been added, removed and restored once —
       if that sheet is missing, renamed or unshared, an organiser must still
       get their Teams and Players tables rather than an empty dashboard and a
       500. Everything else here stays fail-hard on purpose. */
    const readClubs = async () => {
      try {
        if (!process.env.GOOGLE_SHEET_ID_CLUBS) return [];
        return await readRows(auth, process.env.GOOGLE_SHEET_ID_CLUBS, CLUB_RANGE);
      } catch (err) {
        /* The message only, and never a row — this sheet holds contact details. */
        console.error('get-registrations: clubs sheet unreadable -', err && err.message);
        return null;                                     // null = could not read
      }
    };

    const [teamRows, playerRows, clubRows] = await Promise.all([
      readRows(auth, process.env.GOOGLE_SHEET_ID_TEAMS, TEAM_RANGE),
      readRows(auth, process.env.GOOGLE_SHEET_ID_PLAYERS, PLAYER_RANGE),
      readClubs(),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        teams: teamRows.map(mapTeamRow),
        players: playerRows.map(mapPlayerRow),
        clubs: (clubRows || []).map(mapClubRow),
        /* ⚠️ Told apart from "no club has declared yet". An empty list and a
           broken sheet look identical on screen, and the Clubs tab would
           cheerfully report "0 declared" for a tournament where twenty clubs
           had declared — the loading-vs-empty trap the dataError banner exists
           for, one level down. */
        clubsUnavailable: clubRows === null,
      }),
    };
  } catch (err) {
    console.error('get-registrations error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
