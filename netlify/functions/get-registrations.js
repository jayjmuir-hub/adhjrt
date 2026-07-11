// netlify/functions/get-registrations.js
//
// Returns the live team & player registrations from the two Google
// Sheets, for a signed-in Organizer. Requires an Authorization: Bearer
// <token> header from organizer-login.js / organizer-signup.js — the
// token is verified here (see _auth.js), so the sheets themselves never
// need to be public.
//
// Setup: the same GOOGLE_SERVICE_ACCOUNT_* / GOOGLE_SHEET_ID_* vars as
// submission-created.js, plus SESSION_SECRET (see organizer-signup.js).

const { google } = require('googleapis');
const { verify, getBearerToken } = require('./_auth');

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// Sheet columns are read by position (matching the exact order
// submission-created.js appends them in), then mapped onto the
// camelCase field names the Organizer dashboard expects — combining
// first/last name pairs into single display fields.
const TEAM_FIELDS = ['submittedAt', 'club', 'teamName', 'ageGroup', 'headCoachName', 'headCoachEmail', 'headCoachMobile', 'managerName', 'managerEmail', 'managerMobile', 'numPlayers', 'notes', 'players'];

function mapPlayerRow(row) {
  const [submittedAt, playerFirst, playerLast, dob, club, ageGroup, parentFirst, parentLast, parentEmail, parentMobile, emergencyFirst, emergencyLast, emergencyMobile, medicalNotes, consent, playUpConsent] = row;
  return {
    submittedAt: submittedAt || '',
    playerName: [playerFirst, playerLast].filter(Boolean).join(' '),
    dob: dob || '', club: club || '', ageGroup: ageGroup || '',
    parentName: [parentFirst, parentLast].filter(Boolean).join(' '),
    parentEmail: parentEmail || '', parentMobile: parentMobile || '',
    emergencyContact: [emergencyFirst, emergencyLast].filter(Boolean).join(' '),
    emergencyMobile: emergencyMobile || '',
    medicalNotes: medicalNotes || '', consent: consent || '', playUpConsent: playUpConsent || '',
  };
}

function mapTeamRow(row) {
  const obj = {};
  TEAM_FIELDS.forEach((f, i) => { obj[f] = row[i] || ''; });
  return obj;
}

async function readRows(auth, spreadsheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth });
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

    const auth = getAuth();
    const [teamRows, playerRows] = await Promise.all([
      readRows(auth, process.env.GOOGLE_SHEET_ID_TEAMS, 'Sheet1!A:M'),
      readRows(auth, process.env.GOOGLE_SHEET_ID_PLAYERS, 'Sheet1!A:P'),
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
