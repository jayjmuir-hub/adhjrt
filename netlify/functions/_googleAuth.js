// netlify/functions/_googleAuth.js
//
// Verifies a Google Identity Services ID token and returns the identity it
// asserts (sub, email, name) — or null if it doesn't check out. This is the
// ONLY thing "Sign in with Google" trusts: the token is a JWT signed by
// Google, verified here against Google's own public keys AND against our
// own GOOGLE_CLIENT_ID (the audience), so a token minted for someone else's
// app cannot be replayed against this one.
//
// ONE-TIME SETUP: in Netlify -> Site configuration -> Environment variables,
// add GOOGLE_CLIENT_ID = the OAuth Client ID from Google Cloud Console
// (APIs & Services -> Credentials -> the "ADH JRT site" Web application
// client). This is NOT a secret — it's also handed to the browser by
// google-config.js so the page can render the Google button — but it still
// has to match here, or every token verification fails closed.
//
// Google sign-in is an ADDITIONAL way in, not a replacement. Existing
// username/password accounts are untouched by any of this; see
// google-auth.js for how a Google identity gets linked to an account.

const { OAuth2Client } = require('google-auth-library');

let client = null;
function getClient() {
  if (!client) client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return client;
}

// -> { sub, email, name } or null. Never throws — a malformed, expired, or
// wrong-audience token is exactly as untrusted as no token at all, and a
// thrown error here would 500 instead of cleanly refusing the sign-in.
async function verifyGoogleIdToken(idToken) {
  if (!idToken || !process.env.GOOGLE_CLIENT_ID) return null;
  try {
    const ticket = await getClient().verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) return null;
    // Google can issue a token for an email it hasn't itself verified (rare,
    // some Workspace setups). Refuse those rather than trust an email that
    // might not actually belong to whoever is holding this token.
    if (payload.email_verified === false) return null;
    return { sub: payload.sub, email: payload.email, name: payload.name || payload.email };
  } catch (e) {
    return null;
  }
}

module.exports = { verifyGoogleIdToken };
