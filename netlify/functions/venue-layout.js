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
  DEFAULT_VENUE, DEFAULT_POSITIONS,
  loadVenue, validateVenue, venueWarnings, setCachedVenue, countPitchUsage,
  loadPositions, validatePositions,
} = require('./_venue');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const [venue, positions] = await Promise.all([loadVenue(blobStore), loadPositions(blobStore)]);
      /* `positions` is where each block sits on assets/venue-map.png, placed by
         hand in the back office. It rides on this endpoint rather than one of
         its own because it is the same concern, the same permissions and the
         same page load — but it is stored under its OWN blob key, because
         validateVenue() rebuilds a day from known fields and would silently
         drop an extra one. See _venue.js. */
      const body = {
        ok: true, venue, positions,
        defaults: DEFAULT_VENUE, defaultPositions: DEFAULT_POSITIONS,
        warnings: venueWarnings(venue),
      };

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
          ok: true, venue: DEFAULT_VENUE, positions: await loadPositions(blobStore),
          defaults: DEFAULT_VENUE, defaultPositions: DEFAULT_POSITIONS,
          warnings: venueWarnings(DEFAULT_VENUE), reset: true,
        });
      }

      /* Resetting the pitch layout and resetting where blocks sit on the map
         are different intentions and get different buttons. Putting a group on
         a different day has nothing to do with the map image, and someone
         fixing one should not lose the other. */
      if (body.resetPositions) {
        await store.delete('venue-positions');
        const venue = await loadVenue(blobStore);
        return json(200, {
          ok: true, venue, positions: DEFAULT_POSITIONS,
          defaults: DEFAULT_VENUE, defaultPositions: DEFAULT_POSITIONS,
          warnings: venueWarnings(venue), resetPositions: true,
        });
      }

      /* Both are validated BEFORE either is written. A layout that saves while
         its positions bounce would leave the two halves of one Save disagreeing
         with each other, and the panel would have nothing sensible to show. */
      const result = validateVenue(body.venue);
      if (!result.ok) return json(400, { ok: false, error: result.errors[0], errors: result.errors });

      const posResult = validatePositions(body.positions);
      if (!posResult.ok) return json(400, { ok: false, error: posResult.errors[0], errors: posResult.errors });

      await store.setJSON('venue', result.venue);
      setCachedVenue(result.venue);
      if (posResult.positions) await store.setJSON('venue-positions', posResult.positions);

      return json(200, {
        ok: true, venue: result.venue,
        positions: await loadPositions(blobStore),
        defaults: DEFAULT_VENUE, defaultPositions: DEFAULT_POSITIONS,
        warnings: venueWarnings(result.venue),
      });
    }

    return json(405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('venue-layout error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
