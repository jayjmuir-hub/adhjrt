// netlify/functions/get-my-registrations.js
//
// Manager-scoped read of team & player registrations. A signed-in MANAGER
// gets back ONLY the registrations for their own age group. The group is
// taken from their login token, never from anything the browser sends — so
// a manager cannot request another group's children by editing the request.
//
// Organizers (and the special "*" admin-manager) get everything, exactly
// like get-registrations.js. This endpoint simply applies the same
// own-age-group rule the rest of the backend already uses.
//
// Reuses the same GOOGLE_* / SESSION_SECRET environment variables as
// get-registrations.js and submission-created.js, and is read-only on the
// sheets (spreadsheets.readonly scope).

const { resolveSession, sessionRefusal } = require('./_auth');
/* Service-account auth and the private-key repair, in one place — they used
   to be written out in this file and two others. See _sheets.js. */
const { getReadAuth, firstSheetName, sheetsClient } = require('./_sheets');

/* The sheet column order, the field names /organizer expects, and the two row
   mappers. All three used to be written out by hand in this file AND in the
   other reader AND in submission-created.js — see _intake.js. */
const { mapTeamRow, mapPlayerRow, TEAM_RANGE, PLAYER_RANGE } = require('./_intake');

// Age-group id -> public name. This MUST mirror AGE_GROUPS in scores-data.js
// and AGE_GROUP_INFO in "Quins JRT.dc.html". The registration form submits
// the NAME (e.g. "U14B Contact"), and submission-created.js writes that name
// straight into the sheet's age-group column. A manager's token carries the
// ID (e.g. "u14b"), so we translate here. Keep in sync if a group is ever
// renamed or added.
const AGE_GROUP_NAME_BY_ID = {
  u6: 'U6 Tag', u7: 'U7 Tag', u8: 'U8 Tag',
  u9: 'U9 Mixed Contact', u10: 'U10 Mixed Contact', u11: 'U11 Mixed Contact',
  u12: 'U12 Mixed Contact', u12g: 'U12G QR', u13: 'U13 Mixed Contact',
  u14b: 'U14B Contact', u14g: 'U14G QR',
  u16b: 'U16B Contact', u16g: 'U16G Contact',
  u18b: 'U18B Contact', u18g: 'U18G Contact',
};

const norm = (s) => String(s || '').trim().toLowerCase();

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
      return sessionRefusal(sess);
    }
    const session = sess.session;

    // Decide what this session may see, from the TOKEN only. Organizers and
    // the "*" admin-manager see every group; an ordinary manager sees exactly
    // one, resolved to the age-group NAME stored in the sheet.
    const seesEverything = session.role === 'organizer' || session.ageGroupId === '*';
    const allowedName = seesEverything ? null : AGE_GROUP_NAME_BY_ID[session.ageGroupId];
    if (!seesEverything && !allowedName) {
      // Manager token with no / unknown age group — fail closed, show nothing.
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'No age group is set on this account.' }) };
    }

    const auth = getReadAuth();
    const [teamRows, playerRows] = await Promise.all([
      readRows(auth, process.env.GOOGLE_SHEET_ID_TEAMS, TEAM_RANGE),
      readRows(auth, process.env.GOOGLE_SHEET_ID_PLAYERS, PLAYER_RANGE),
    ]);

    const keep = (row) => seesEverything || norm(row.ageGroup) === norm(allowedName);
    const teams = teamRows.map(mapTeamRow).filter(keep);
    const players = playerRows.map(mapPlayerRow).filter(keep);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, scope: allowedName || 'all', teams, players }),
    };
  } catch (err) {
    console.error('get-my-registrations error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
