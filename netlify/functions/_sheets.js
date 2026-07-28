// netlify/functions/_sheets.js
//
// The Google Sheets client: service-account auth and the one API quirk that
// has already broken this site twice.
//
// WHY IT IS ITS OWN FILE. privateKey(), getAuth() and firstSheetName() were
// written out THREE times — submission-created.js and both readers — and the
// submission gateway would have made it four. The private-key repair below is
// the kind of thing you fix once, at 2am, and must never have to fix again in
// a copy somebody forgot about.
//
// ⚠️ NOT TESTABLE IN THIS REPO. It requires googleapis, and a fresh clone has
// no node_modules, so no test can load it. That is precisely why it contains
// no decisions: everything that decides anything lives in _intake.js, which is
// dependency-free. Keep it that way.
//
// Env var NAMES only, never values:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
//   GOOGLE_SHEET_ID_TEAMS, GOOGLE_SHEET_ID_PLAYERS

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/* Read-only auth, for the two dashboard readers. A narrower scope than the
   writer's, so a bug in a reader cannot write. */
function getReadAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function sheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

module.exports = { privateKey, getAuth, getReadAuth, firstSheetName, sheetsClient };
