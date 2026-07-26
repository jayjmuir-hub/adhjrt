// netlify/functions/_venue.js
//
// WHERE THE TOURNAMENT IS PLAYED, AND ON WHICH DAY.
//
// Two facts live here and nowhere else:
//   1. the named playing surfaces available on each day, and
//   2. which age groups play on each day, and which pitches each one gets.
//
// Fact 2 used to be a hardcoded array called SATURDAY inside app.html, which
// drifted out of step with reality — it had U12G on Saturday and left U18B and
// U18G off it entirely, so both fell through to Sunday. Deriving the day from
// the pitch allocation removes the possibility: an age group is on Saturday
// because Saturday is where it has pitches.
//
// DEFAULTS ONLY. An organiser can change any of it from the back office
// without a deploy; overrides are stored in Netlify Blobs and merged over this
// table by loadVenue(). Same pattern as _scoring.js.
//
// ⚠️ KEEP IN STEP WITH scores-data.js's DEFAULT_VENUE. The front end needs the
// same table for its offline/local fallback path, so the default exists in two
// files. test-venue.js asserts they are identical — if you change one and not
// the other, that test fails.

/* Read off Pitch maps_Final.pdf (Saturday 25 / Sunday 26 October 2025), which
   Jay confirmed on 26 July 2026 is the same running order for 2026.

   Sub-pitch letters (B1A..B1D, A1A..A1D, D3A/D3B, C4A/C4B, D4A/D4B, D5A/D5B)
   are OURS. The map draws the boxes inside one red outline and does not name
   them individually, so these names have to match whatever goes on the printed
   pitch flags. Confirm before the signage is ordered.

   D4 and D5 are TIME-SHARED on Saturday: U5/6 in the morning, U7 in the
   afternoon. That needs no special case — it is two pools on one pitch with
   different start times, which the clash check reads correctly. */
const DEFAULT_VENUE = {
  day1: {
    date: '2026-11-07',
    label: 'Saturday 7 November',
    short: 'Sat',
    pitches: ['D5A', 'D5B', 'D4A', 'D4B', 'D3A', 'D3B', 'D2', 'D1',
      'C4', 'C5', 'B1A', 'B1B', 'B1C', 'B1D', 'A1A', 'A1B', 'A1C', 'A1D'],
    groups: {
      u6:   ['D4A', 'D4B', 'D5A', 'D5B'],   // morning
      u7:   ['D4A', 'D4B', 'D5A', 'D5B'],   // afternoon, the same four
      u8:   ['B1A', 'B1B', 'B1C', 'B1D'],
      u9:   ['A1A', 'A1B', 'A1C', 'A1D'],
      u10:  ['C5'],
      u11:  ['C4'],
      u12:  ['D3A', 'D3B'],
      u18b: ['D2'],
      u18g: ['D1'],
    },
  },
  day2: {
    date: '2026-11-08',
    label: 'Sunday 8 November',
    short: 'Sun',
    pitches: ['D3', 'D2', 'D1', 'C4A', 'C4B', 'C5', 'B1A', 'B1B', 'A1A', 'A1B'],
    groups: {
      u12g: ['B1A', 'B1B'],
      u13:  ['C4A', 'C4B'],
      u14b: ['D3'],
      u14g: ['A1A', 'A1B'],
      u16b: ['D2', 'D1'],
      u16g: ['C5'],
    },
  },
};

const DAY_IDS = ['day1', 'day2'];

/* A saved override REPLACES a day wholesale rather than merging field by field.
   Merging pitch lists would make removing a pitch impossible — the default
   would keep putting it back — and merging `groups` would make moving an age
   group off a day impossible for the same reason. Anything the override does
   not mention falls back to the default day intact. */
function mergeVenue(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_VENUE;
  const out = {};
  for (const d of DAY_IDS) {
    const s = saved[d];
    out[d] = (s && typeof s === 'object' && Array.isArray(s.pitches) && s.groups && typeof s.groups === 'object')
      ? {
        date:  typeof s.date === 'string' ? s.date : DEFAULT_VENUE[d].date,
        label: typeof s.label === 'string' ? s.label : DEFAULT_VENUE[d].label,
        short: typeof s.short === 'string' ? s.short : DEFAULT_VENUE[d].short,
        pitches: s.pitches.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim()),
        groups: s.groups,
      }
      : DEFAULT_VENUE[d];
  }
  return out;
}

/* Cached per function instance. The layout is decided weeks out and read on
   every fixtures request, so re-reading the blob each time buys nothing. A
   cold start picks up a change; that is fast enough for a setting nobody
   touches on match day. */
let CACHED = null;

async function loadVenue(blobStore) {
  if (CACHED) return CACHED;
  try {
    const saved = await blobStore('config').get('venue', { type: 'json' });
    CACHED = mergeVenue(saved);
  } catch (err) {
    // A config read failing must never take the fixtures down with it.
    console.warn('_venue: could not read the saved layout, using defaults -', err && err.message);
    CACHED = DEFAULT_VENUE;
  }
  return CACHED;
}

/* 'day1' | 'day2' | null. Null means the layout does not list this age group on
   either day, which is a real configuration problem — callers should say so
   rather than quietly picking a day.

   Listed with an EMPTY pitch array still counts as being on that day. "Which
   day" and "which pitches" are two separate questions, and a group can legally
   be scheduled for Sunday before anyone has decided where it plays.

   If a group somehow ends up on both days, day1 wins here. Nothing should be
   able to save that state; the back office refuses it. */
function dayIdOf(venue, ageGroupId) {
  for (const d of DAY_IDS) {
    if (venue[d] && venue[d].groups && venue[d].groups[ageGroupId]) return d;
  }
  return null;
}

module.exports = { DEFAULT_VENUE, DAY_IDS, mergeVenue, loadVenue, dayIdOf };
