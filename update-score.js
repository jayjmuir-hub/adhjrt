// This function runs on Netlify's servers, not in the browser.
// It's the only piece of the site that's allowed to write to the Google Sheet.
//
// It does two checks before touching any data:
//   1. Is there a valid, logged-in Netlify Identity user attached to this request?
//   2. Does the request body actually contain a row number and two scores?
// If either check fails, it refuses and returns an error instead of writing anything.

const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // 1. Require a logged-in Netlify Identity user.
  // Netlify automatically decodes the "Authorization: Bearer <token>" header
  // sent from the browser and populates context.clientContext.user for you,
  // but only if the token is valid and unexpired.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'You must be logged in as an organizer to submit a score.' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  // 2. Validate the payload.
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { row, scoreA, scoreB } = payload;
  const rowNum = Number(row);
  const a = Number(scoreA);
  const b = Number(scoreB);

  if (!rowNum || rowNum < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid row number.' }) };
  }
  if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Scores must be numbers of 0 or more.' }) };
  }

  // 3. Write the two score cells for that match's row.
  // Sheet columns are assumed to be, left to right:
  //   A: Division | B: Time | C: Field | D: TeamA | E: TeamB | F: ScoreA | G: ScoreB
  // If you rearrange your columns, update the range below to match.
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Sheet1!F${rowNum}:G${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[a, b]] }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, updatedBy: user.email, row: rowNum })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Could not write to the sheet: ' + err.message })
    };
  }
};
