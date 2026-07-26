// netlify/functions/venue-layout.js
//
// The pitch and day layout for the weekend.
//
// GET (public)
//   -> { ok, venue: { day1: {...}, day2: {...} }, defaults: {...} }
//
//   Public on purpose. Which day an age group plays and which pitch a match is
//   on is printed on the website, on the fixtures list and on the signage — it
//   is configuration, not personal data. The phone app needs it before it can
//   turn a kick-off time into a real date, which is what makes "kick-off in 24
//   minutes" possible, so it must be readable without signing in.
//
// Writing is NOT implemented here yet. The back-office editor is the next step
// (see claude/spec-pitches-and-clash-detection.md, Step 2); until it lands
// there is no way to write this key, so every reader gets the built-in default
// in _venue.js.

const { blobStore } = require('./_auth');
const { loadVenue, DEFAULT_VENUE } = require('./_venue');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed.' });
    const venue = await loadVenue(blobStore);
    return json(200, { ok: true, venue, defaults: DEFAULT_VENUE });
  } catch (err) {
    console.error('venue-layout error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
