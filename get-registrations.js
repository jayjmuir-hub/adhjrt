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

// The tab inside each spreadsheet is not necessarily called "Sheet1" — Google
// names it after the account locale, and anyone can rename it. Hardcoding the
// name produces "Unable to parse range: Sheet1!A:P". Ask the API for the first
// tab's real name instead, so renaming a tab can never break this again.
async function firstSheetName(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const title = ((meta.data.sheets || [])[0] || {}).properties?.title;
  if (!title) throw new Error('Spreadsheet has no tabs: ' + spreadsheetId);
  return title;
}

const { verify, getBearerToken } = require('./_auth');

// Reads the service account private key from the environment and repairs the
// two ways it commonly arrives broken:
//   1. wrapped in the double quotes copied straight out of the JSON key file
//      — the leading " sits in front of "-----BEGIN PRIVATE KEY-----" and the
//      PEM parser rejects it with ERR_OSSL_UNSUPPORTED
//   2. newlines still written as the two characters \ and n rather than real
//      line breaks
// Handles a correctly-pasted key unchanged, so it is safe either way.
function privateKey() {
  let k = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  if (k.length > 1 && ((k[0] === '"' && k[k.length - 1] === '"') || (k[0] === "'" && k[k.length - 1] === "'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, '\n');
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey(),
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

async function readRows(auth, spreadsheetId, columns) {
  const sheets = google.sheets({ version: 'v4', auth });
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

    const auth = getAuth();
    const [teamRows, playerRows] = await Promise.all([
      readRows(auth, process.env.GOOGLE_SHEET_ID_TEAMS, 'A:M'),
      readRows(auth, process.env.GOOGLE_SHEET_ID_PLAYERS, 'A:P'),
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
