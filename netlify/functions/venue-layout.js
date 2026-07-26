// netlify/functions/venue-layout.js
//
// The pitch and day layout for the weekend.
//
// GET (public)
//   -> { ok, venue, defaults, warnings }
//
//   Public on purpose. Which day an age group plays and which pitch a match is
//   on is printed on the website, on the fixtures list and on the signage — it
//   is configuration, not personal data. The phone app needs it before it can
//   turn a kick-off time into a real date, which is what makes "kick-off in 24
//   minutes" possible, so it must be readable without signing in.
//
// GET ?usage=1  (organisers only)
//   -> also { usage: { day1: { 'C4': 12, … }, day2: { … } } }
//
//   How many saved match slots sit on each pitch. The back office shows it next
//   to each pitch so renaming or removing one is not a silent way to orphan
//   twelve fixtures. Organiser-only because it counts DRAFT fixtures too, which
//   are deliberately not public.
//
// POST (organisers only)
//   { venue: { day1: {...}, day2: {...} } }   -> validate, save, return it
//   { reset: true }                           -> delete the override
//
//   Managers deliberately cannot write here. Which day a group plays and which
//   pitches it owns affect every other age group, so this is a tournament-wide
//   decision — same reasoning as scoring-rules.js.

const { verify, getBearerToken, blobStore } = require('./_auth');
const {
  DEFAULT_VENUE,
  loadVenue, validateVenue, venueWarnings, setCachedVenue, countPitchUsage,
} = require('./_venue');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const venue = await loadVenue(blobStore);
      const body = { ok: true, venue, defaults: DEFAULT_VENUE, warnings: venueWarnings(venue) };

      if ((event.queryStringParameters || {}).usage === '1') {
        const session = verify(getBearerToken(event));
        if (session && session.role === 'organizer') body.usage = await countPitchUsage(blobStore('schedules'), venue);
      }
      return json(200, body);
    }

    if (event.httpMethod === 'POST') {
      const session = verify(getBearerToken(event));
      if (!session) return json(401, { ok: false, error: 'Not signed in.' });
      if (session.role !== 'organizer') {
        return json(403, {
          ok: false,
          error: 'Only tournament organisers can change the pitch and day layout — it affects every age group.',
        });
      }

      const store = blobStore('config');
      const body = JSON.parse(event.body || '{}');

      /* Reset deletes the override rather than writing the defaults back, so a
         later change to DEFAULT_VENUE reaches a reset site instead of being
         masked by a stale copy of the old defaults. */
      if (body.reset) {
        await store.delete('venue');
        setCachedVenue(DEFAULT_VENUE);
        return json(200, {
          ok: true, venue: DEFAULT_VENUE, defaults: DEFAULT_VENUE,
          warnings: venueWarnings(DEFAULT_VENUE), reset: true,
        });
      }

      const result = validateVenue(body.venue);
      if (!result.ok) return json(400, { ok: false, error: result.errors[0], errors: result.errors });

      await store.setJSON('venue', result.venue);
      setCachedVenue(result.venue);
      return json(200, {
        ok: true, venue: result.venue, defaults: DEFAULT_VENUE,
        warnings: venueWarnings(result.venue),
      });
    }

    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('venue-layout error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
