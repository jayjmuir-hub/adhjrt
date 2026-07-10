// netlify/functions/get-registrations.js
//
// TEMPLATE — not wired up yet. Once you've completed the service-account
// setup described in submission-created.js's header comment, this function
// lets Organizer.dc.html fetch real registrations without the sheets
// themselves ever being public.
//
// It expects a POST body of { username, password } and checks it against
// an ORGANIZER_ACCOUNTS env var — a JSON array like:
//   [{"username":"jay","password":"...","name":"Jay Muir","role":"Tournament Director"}, ...]
// Set that in Netlify alongside the GOOGLE_SERVICE_ACCOUNT_* and
// GOOGLE_SHEET_ID_* vars already documented in submission-created.js.
// (For real production use, store hashed passwords and check with
// bcrypt/scrypt instead of a plain-text comparison — this mirrors the
// simple demo-account style already used elsewhere in the prototype.)
//
// Once this is live, swap organizer-data.js's login()/getRegistrations()
// mocks for fetch('/.netlify/functions/get-registrations', ...) calls.

const { google } = require('googleapis');

function checkCredentials(username, password) {
  let accounts = [];
  try { accounts = JSON.parse(process.env.ORGANIZER_ACCOUNTS || '[]'); } catch (e) {}
  return accounts.find((a) => a.username === username && a.password === password) || null;
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

async function readSheet(auth, spreadsheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const [header, ...rows] = res.data.values || [[]];
  return rows.map((row) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { username, password } = JSON.parse(event.body || '{}');
    const account = checkCredentials(username, password);
    if (!account) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect username or password.' }) };

    const auth = getAuth();

    const [teams, players] = await Promise.all([
      readSheet(auth, process.env.GOOGLE_SHEET_ID_TEAMS, 'Sheet1!A:M'),
      readSheet(auth, process.env.GOOGLE_SHEET_ID_PLAYERS, 'Sheet1!A:P'),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        session: { username: account.username, name: account.name, role: account.role },
        teams, players,
      }),
    };
  } catch (err) {
    console.error('get-registrations error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
