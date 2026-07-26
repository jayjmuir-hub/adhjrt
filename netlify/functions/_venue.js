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

/* The 15 age group ids, taken from _scoring.js rather than typed again here.
   That file already has to list every group (it decides what can be scored in
   each), so borrowing it keeps the count in one place on the backend. */
const AGE_IDS = Object.keys(require('./_scoring').BY_AGE);

/* Checks a layout a human is trying to save. Returns { ok, errors, venue }.

   Everything here is a HARD error — a layout that fails one of these makes some
   part of the site wrong in a way nobody would notice until match day:

     - an age group on both days      -> dayIdOf() silently picks day1
     - an age group on neither day    -> it has no date, and the countdown breaks
     - a pitch that is not on its day -> the fixture editor offers a pitch that
                                         does not exist, and the clash check
                                         cannot reason about it
     - two pitches with the same name -> the clash check cannot tell them apart

   Notably NOT an error: an age group with an empty pitch list. "Which day" and
   "which pitches" are separate decisions and the day has to be settable first.
   The back office shows that as a warning instead. */
function validateVenue(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['No layout sent.'] };

  const out = {};
  for (const d of DAY_IDS) {
    const src = input[d];
    const def = DEFAULT_VENUE[d];
    if (!src || typeof src !== 'object') { errors.push(`${def.label} is missing from the layout.`); continue; }
    if (!Array.isArray(src.pitches)) { errors.push(`${def.label} has no list of pitches.`); continue; }
    if (!src.groups || typeof src.groups !== 'object' || Array.isArray(src.groups)) {
      errors.push(`${def.label} has no age groups.`); continue;
    }

    const pitches = src.pitches.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
    // Case-insensitive, because "C4" and "c4" being two pitches is never what
    // anyone meant and it would split a clash check in half.
    const seen = new Map();
    pitches.forEach((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) errors.push(`${def.label} lists "${p}" more than once.`);
      else seen.set(k, p);
    });

    const groups = {};
    Object.keys(src.groups).forEach((ag) => {
      if (!AGE_IDS.includes(ag)) { errors.push(`"${ag}" is not one of the 15 age groups.`); return; }
      const list = Array.isArray(src.groups[ag]) ? src.groups[ag] : [];
      const kept = [];
      list.forEach((p) => {
        const name = typeof p === 'string' ? p.trim() : '';
        if (!name) return;
        if (!seen.has(name.toLowerCase())) {
          errors.push(`${ag.toUpperCase()} is assigned "${name}", which is not a pitch on ${def.label}.`);
          return;
        }
        const canonical = seen.get(name.toLowerCase());
        if (!kept.includes(canonical)) kept.push(canonical);
      });
      groups[ag] = kept;
    });

    out[d] = {
      date:  typeof src.date === 'string' && src.date.trim() ? src.date.trim() : def.date,
      label: typeof src.label === 'string' && src.label.trim() ? src.label.trim() : def.label,
      short: typeof src.short === 'string' && src.short.trim() ? src.short.trim() : def.short,
      pitches: [...seen.values()],
      groups,
    };
  }

  if (out.day1 && out.day2) {
    AGE_IDS.forEach((ag) => {
      const on1 = ag in out.day1.groups, on2 = ag in out.day2.groups;
      if (on1 && on2) errors.push(`${ag.toUpperCase()} is on both days — pick one.`);
      if (!on1 && !on2) errors.push(`${ag.toUpperCase()} is not on either day.`);
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], venue: out };
}

/* Age groups on a day with no pitches yet. Not an error, but the back office
   says so, because a group with no pitches has nowhere for the fixture editor
   to put its pools. */
function venueWarnings(venue) {
  const out = [];
  for (const d of DAY_IDS) {
    const day = venue[d];
    if (!day) continue;
    Object.keys(day.groups || {}).forEach((ag) => {
      if (!day.groups[ag] || !day.groups[ag].length) {
        out.push(`${ag.toUpperCase()} is on ${day.label} but has no pitches yet.`);
      }
    });
    if (!day.pitches.length) out.push(`${day.label} has no pitches at all.`);
  }
  return out;
}

/* Called after a successful write so the instance that did the writing does not
   go on serving the layout it just replaced. Other warm instances still hold
   their own copy until they recycle — acceptable for a setting decided weeks
   out, and the back office shows the server's reply rather than its own guess. */
function setCachedVenue(venue) { CACHED = venue; }

/* How many saved match slots sit on each pitch, per day.
   -> { day1: { 'C4': 12, … }, day2: { … } }

   The back office shows this next to each pitch chip, so removing or renaming a
   pitch is not a silent way to leave twelve fixtures pointing at somewhere that
   no longer exists. Reads the DRAFT for each age group and falls back to the
   published copy, because the draft is what a change here is about to break. An
   age group with neither is skipped: its auto-generated draw has every slot on
   "TBD" and nothing is at risk.

   Takes the blob store as an argument rather than reaching for _auth's, so it
   can be tested against a fake store without the backend's dependencies.

   The counts are NOT public — a draft is deliberately not public — so the caller
   is responsible for checking the session first. */
async function countPitchUsage(store, venue) {
  const { draftKey, publishedKey } = require('./_publish');
  const usage = { day1: {}, day2: {} };

  const perGroup = await Promise.all(AGE_IDS.map(async (ag) => {
    try {
      const draft = await store.get(draftKey(ag), { type: 'json' });
      if (draft) return { ag, schedule: draft };
      const pub = await store.get(publishedKey(ag), { type: 'json' });
      return { ag, schedule: pub && pub.schedule ? pub.schedule : null };
    } catch (err) {
      // One unreadable age group must not cost the whole count.
      console.warn(`_venue: could not read the draw for ${ag} -`, err && err.message);
      return { ag, schedule: null };
    }
  }));

  perGroup.forEach(({ ag, schedule }) => {
    if (!schedule) return;
    const d = dayIdOf(venue, ag);
    if (!d) return;
    const slots = [...(schedule.slots || []), ...(schedule.knockout || [])];
    slots.forEach((s) => {
      const p = s && typeof s.pitch === 'string' ? s.pitch.trim() : '';
      if (!p || p === 'TBD') return;
      usage[d][p] = (usage[d][p] || 0) + 1;
    });
  });

  return usage;
}

module.exports = {
  DEFAULT_VENUE, DAY_IDS, AGE_IDS,
  mergeVenue, loadVenue, dayIdOf,
  validateVenue, venueWarnings, setCachedVenue, countPitchUsage,
};
