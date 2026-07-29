// netlify/functions/google-config.js
//
// Public, unauthenticated. Hands the browser the Google OAuth Client ID so
// Organizer.dc.html and Scores & Standings.dc.html don't need to hardcode it
// or run any build step to inject it. The Client ID is not a secret —
// Google's own docs are explicit that it's meant to be visible in
// client-side code. The real security boundary is the audience check in
// _googleAuth.js on every verify, plus the Authorized JavaScript origins
// configured against this ID in Google Cloud Console.
//
// GET -> { ok: true, clientId: string|null }
// clientId is null until GOOGLE_CLIENT_ID is set in Netlify — the page
// treats null as "don't show the Google button yet" rather than erroring.

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, clientId: process.env.GOOGLE_CLIENT_ID || null }),
  };
};
