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
    /* Whole / halves / quarters, per pitch, for this day. THE SOURCE OF TRUTH —
       `pitches` below is derived from it and is only written out so the two
       DEFAULT_VENUE copies stay comparable and every existing reader of
       `day.pitches` keeps working untouched. validateVenue() rebuilds `pitches`
       from `splits` on every save, so the two cannot drift. */
    splits: { D5: 2, D4: 2, D3: 2, D2: 1, D1: 1, C4: 1, C5: 1, B1: 4, A1: 4 },
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
    splits: { D3: 1, D2: 1, D1: 1, C4: 2, C5: 1, B1: 2, A1: 2 },
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

/* ============================================================
   MAIN PITCHES, AND HOW EACH ONE IS SPLIT.
   ------------------------------------------------------------
   THE MODEL, in Jay's words: there are main pitches, and each one can be run
   whole, cut in half, or cut into quarters. That is the decision somebody
   actually makes on the ground — you mark a big pitch out into two small ones —
   so it is the thing that gets stored, and the playable surfaces are DERIVED
   from it.

   The fifteen are confirmed by Jay against the site (27 Jul 2026):
   D1–D5, C1–C5, B1, A1–A4. Note B1 only — B2 on the map is the softball pitch
   and is not ours. The order below is the order surfaces come out in, and it is
   the order the 2025 layout already used.

   WHAT THIS REPLACED. Pitches used to be a free-text list an organiser typed
   into. That is how `C4`, `c4` and `Pitch C4` became three different pitches to
   the clash check — recorded in CLAUDE.md as a bug that had to be dug out once
   already. With names derived from a fixed list plus a split, they cannot drift
   again: there is no box to type a name into.

   A SPLIT IS PER DAY, not per pitch. This is not a nicety — the weekend already
   runs that way, and a single split per pitch would break it:

     D3   halves on Saturday (D3A/D3B), WHOLE on Sunday
     C4   whole on Saturday,            HALVES on Sunday (C4A/C4B)
     B1   quarters on Saturday,         halves on Sunday
     A1   quarters on Saturday,         halves on Sunday

   A main pitch that is ABSENT from a day's `splits` is not in use that day.
   That is why absence means unused rather than a 0: "not on the map today" and
   "on the map, split into nothing" are not different states.
   ============================================================ */
const MAIN_PITCHES = ['D5', 'D4', 'D3', 'D2', 'D1', 'C4', 'C5', 'C3', 'C2', 'C1', 'B1', 'A1', 'A2', 'A3', 'A4'];

/* Whole, halves, quarters. Nothing else — thirds do not happen on a rectangle
   you are marking out with cones, and allowing them would put a third suffix
   letter into names that everything downstream parses. */
const SPLITS = [1, 2, 4];
const SPLIT_SUFFIXES = { 1: [''], 2: ['A', 'B'], 4: ['A', 'B', 'C', 'D'] };

/* splits -> the playable surface names, in MAIN_PITCHES order.
   { D3: 2, D2: 1 } -> ['D3A', 'D3B', 'D2']

   A whole pitch keeps the bare name, which is what makes this backwards
   compatible: every saved fixture on 'D2' still means D2. */
function derivePitches(splits) {
  const out = [];
  if (!splits || typeof splits !== 'object') return out;
  MAIN_PITCHES.forEach((main) => {
    const n = Number(splits[main]);
    if (SPLITS.indexOf(n) < 0) return;
    SPLIT_SUFFIXES[n].forEach((suffix) => out.push(main + suffix));
  });
  return out;
}

/* The other direction, for a layout saved before splits existed. Counts how
   many surfaces each main pitch has and infers the split, so an override
   already in the blob keeps working with nothing to migrate by hand.

   A count that is not 1, 2 or 4 rounds UP to the next legal split rather than
   dropping surfaces: three surfaces on one pitch is somebody's half-finished
   edit, and inventing a fourth is recoverable where deleting a third is not. */
function splitsFromPitches(pitches) {
  const counts = {};
  (Array.isArray(pitches) ? pitches : []).forEach((p) => {
    const name = typeof p === 'string' ? p.trim().toUpperCase() : '';
    if (!name) return;
    const m = name.match(/^(.*[0-9])([A-Z])?$/);
    const main = m ? m[1] : name;
    if (MAIN_PITCHES.indexOf(main) < 0) return;
    counts[main] = (counts[main] || 0) + 1;
  });
  const out = {};
  Object.keys(counts).forEach((main) => {
    const n = counts[main];
    out[main] = n <= 1 ? 1 : (n <= 2 ? 2 : 4);
  });
  return out;
}

/* Renaming caused by a split change, e.g. { D3: ['D3A', 'D3B'] } when D3 goes
   from whole to halves.

   THE INVARIANT: a group keeps the same GROUND, only the names change. Split a
   pitch a group had whole and it gets both halves — it had all of it before and
   it has all of it now. Merge halves back and a group that had either one gets
   the whole pitch, because there is now only one pitch and they are on it.

   Anything else means an organiser silently loses an allocation to a naming
   change, which is the sort of thing nobody notices until a team turns up. */
function remapGroupPitches(list, oldSplits, newSplits) {
  const kept = [];
  const add = (name) => { if (!kept.includes(name)) kept.push(name); };
  (Array.isArray(list) ? list : []).forEach((p) => {
    const name = typeof p === 'string' ? p.trim().toUpperCase() : '';
    if (!name) return;
    const m = name.match(/^(.*[0-9])([A-Z])?$/);
    const main = m ? m[1] : name;
    const before = Number((oldSplits || {})[main]);
    const after = Number((newSplits || {})[main]);
    if (SPLITS.indexOf(after) < 0) return;            // the pitch left the day
    if (before === after) { add(name); return; }      // untouched
    SPLIT_SUFFIXES[after].forEach((suffix) => add(main + suffix));
  });
  return kept;
}

/* ============================================================
   WHERE EACH BLOCK SITS ON THE MAP IMAGE.
   ------------------------------------------------------------
   Percentages of assets/venue-map.png's width and height, measured to the
   CENTRE of the block. Percentages rather than pixels because the map is
   rendered responsively — a pixel offset would be wrong on every screen but
   the one it was placed on.

   WHY THIS IS A SEPARATE KEY rather than a field on the venue layout: the
   layout is validated by validateVenue(), which rebuilds each day from a known
   list of fields. An extra field would be silently DROPPED on the next save —
   the position work would appear to save and then quietly vanish. Keeping it in
   its own key at `config`/`venue-positions` also matches what it is: the layout
   is configuration that changes what the site does, this is presentation that
   changes what one back-office screen looks like.

   ONE POSITION PER BLOCK FOR THE WHOLE WEEKEND, not one per day. D3 is the same
   field on Saturday as on Sunday; only which age group is on it changes.

   These defaults are EYEBALLED off the map image and are a starting point, not
   a survey. That is exactly why the back office lets an organiser drag them:
   Jay knows where these pitches actually are and the code does not. Anything an
   organiser drags replaces the guess. A block with no position at all is drawn
   in a tray beside the map rather than dumped at 0,0.
   ============================================================ */
const DEFAULT_POSITIONS = {
  D5: { x: 12.4, y: 20.1 },
  D4: { x: 20.0, y: 21.6 },
  D3: { x: 28.4, y: 20.5 },
  D2: { x: 38.5, y: 20.1 },
  D1: { x: 49.2, y: 19.2 },
  C4: { x: 11.1, y: 63.0 },
  C5: { x: 20.2, y: 64.0 },
  C1: { x: 29.9, y: 68.6 },
  C3: { x: 8.6,  y: 75.9 },
  C2: { x: 8.6,  y: 84.1 },
  B2: { x: 54.9, y: 79.5 },
  B1: { x: 71.7, y: 80.4 },
  A1: { x: 93.0, y: 69.5 },
  A2: { x: 85.9, y: 71.3 },
  A3: { x: 84.0, y: 59.4 },
  A4: { x: 91.8, y: 58.5 },
};

/* Block names are derived from pitch names, which are free text, so this caps
   how much junk a hand-edited blob can carry. Sixteen blocks exist; 200 is far
   past any real layout and far short of a problem. */
const MAX_POSITIONS = 200;

/* A saved map REPLACES the defaults for the blocks it mentions and leaves the
   rest alone. Unlike a day's pitch list there is nothing here that a merge makes
   unreachable — dragging a block always writes an entry, and "no entry" is a
   meaningful state the UI handles (the block goes in the tray). */
function mergePositions(saved) {
  const out = { ...DEFAULT_POSITIONS };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  Object.keys(saved).forEach((raw) => {
    const key = String(raw || '').trim().toUpperCase();
    const p = saved[raw];
    if (!key || !p || typeof p !== 'object') return;
    const x = Number(p.x), y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    out[key] = { x, y };
  });
  return out;
}

/* Checks a map an organiser is trying to save. Refused with a reason rather
   than coerced, same contract as validateVenue — the panel clamps while
   dragging, so anything out of range got here by hand and guessing what was
   meant would be worse than saying no. */
function validatePositions(input) {
  const errors = [];
  if (input === null || input === undefined) return { ok: true, errors: [], positions: null };
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['The block positions are not a map of names to coordinates.'] };

  const keys = Object.keys(input);
  if (keys.length > MAX_POSITIONS) return { ok: false, errors: [`That is ${keys.length} block positions; the most that can be stored is ${MAX_POSITIONS}.`] };

  const out = {};
  keys.forEach((raw) => {
    const key = String(raw || '').trim().toUpperCase();
    if (!key) { errors.push('A block position has no block name.'); return; }
    const p = input[raw];
    if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push(`"${key}" has no coordinates.`); return; }
    const x = Number(p.x), y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { errors.push(`"${key}" has a position that is not a pair of numbers.`); return; }
    if (x < 0 || x > 100 || y < 0 || y > 100) { errors.push(`"${key}" is at ${x}, ${y} — positions are percentages of the map and must be between 0 and 100.`); return; }
    // Rounded: a tenth of a percent is under a pixel on the real image, and it
    // keeps the stored blob readable.
    out[key] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], positions: out };
}

/* No cache, unlike the layout. This is read once when the back office opens the
   Venue tab and never on a request path anyone is waiting on. */
async function loadPositions(blobStore) {
  try {
    return mergePositions(await blobStore('config').get('venue-positions', { type: 'json' }));
  } catch (err) {
    console.warn('_venue: could not read the block positions, using defaults -', err && err.message);
    return { ...DEFAULT_POSITIONS };
  }
}

/* A saved override REPLACES a day wholesale rather than merging field by field.
   Merging pitch lists would make removing a pitch impossible — the default
   would keep putting it back — and merging `groups` would make moving an age
   group off a day impossible for the same reason. Anything the override does
   not mention falls back to the default day intact. */
function mergeVenue(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_VENUE;
  const out = {};
  for (const d of DAY_IDS) {
    const src = saved[d];
    const usable = src && typeof src === 'object' && src.groups && typeof src.groups === 'object'
      && (src.splits || Array.isArray(src.pitches));
    if (!usable) { out[d] = DEFAULT_VENUE[d]; continue; }
    /* A blob saved before splits existed carries only `pitches`; infer the
       splits back out of it so nothing needs migrating by hand. */
    const splits = normaliseSplits(src.splits) || splitsFromPitches(src.pitches);
    out[d] = {
      date:  typeof src.date === 'string' ? src.date : DEFAULT_VENUE[d].date,
      label: typeof src.label === 'string' ? src.label : DEFAULT_VENUE[d].label,
      short: typeof src.short === 'string' ? src.short : DEFAULT_VENUE[d].short,
      splits,
      /* ALWAYS derived, never taken from the blob. If the two ever disagreed
         the site would be reading one and the panel editing the other. */
      pitches: derivePitches(splits),
      groups: src.groups,
    };
  }
  return out;
}

/* Keeps only the main pitches this venue has, at a split it can actually be
   run at. Returns null for anything unusable so the caller can fall back. */
function normaliseSplits(splits) {
  if (!splits || typeof splits !== 'object' || Array.isArray(splits)) return null;
  const out = {};
  Object.keys(splits).forEach((raw) => {
    const main = String(raw || '').trim().toUpperCase();
    const n = Number(splits[raw]);
    if (MAIN_PITCHES.indexOf(main) >= 0 && SPLITS.indexOf(n) >= 0) out[main] = n;
  });
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
    if (!src.groups || typeof src.groups !== 'object' || Array.isArray(src.groups)) {
      errors.push(`${def.label} has no age groups.`); continue;
    }

    /* Splits are the input. A payload with only `pitches` is accepted and
       converted, so an older client — or a blob edited by hand — still saves. */
    let splits = normaliseSplits(src.splits);
    if (!splits || !Object.keys(splits).length) {
      if (Array.isArray(src.pitches)) splits = splitsFromPitches(src.pitches);
      else { errors.push(`${def.label} has no pitches.`); continue; }
    }

    /* Anything the panel could not have sent is named rather than dropped —
       silently ignoring a pitch nobody recognises is how a layout ends up
       missing a surface an organiser thinks they set. */
    if (src.splits && typeof src.splits === 'object' && !Array.isArray(src.splits)) {
      Object.keys(src.splits).forEach((raw) => {
        const main = String(raw || '').trim().toUpperCase();
        const n = Number(src.splits[raw]);
        if (MAIN_PITCHES.indexOf(main) < 0) errors.push(`"${raw}" is not one of the ${MAIN_PITCHES.length} main pitches.`);
        else if (SPLITS.indexOf(n) < 0) errors.push(`${main} on ${def.label} is set to "${src.splits[raw]}" — a pitch is whole, halves or quarters.`);
      });
    }

    const pitches = derivePitches(splits);
    const known = new Set(pitches.map((p) => p.toLowerCase()));

    const groups = {};
    Object.keys(src.groups).forEach((ag) => {
      if (!AGE_IDS.includes(ag)) { errors.push(`"${ag}" is not one of the 15 age groups.`); return; }
      const list = Array.isArray(src.groups[ag]) ? src.groups[ag] : [];
      const kept = [];
      list.forEach((p) => {
        const name = typeof p === 'string' ? p.trim() : '';
        if (!name) return;
        if (!known.has(name.toLowerCase())) {
          errors.push(`${ag.toUpperCase()} is assigned "${name}", which is not a surface on ${def.label}.`);
          return;
        }
        const canonical = pitches.find((x) => x.toLowerCase() === name.toLowerCase());
        if (!kept.includes(canonical)) kept.push(canonical);
      });
      groups[ag] = kept;
    });

    out[d] = {
      date:  typeof src.date === 'string' && src.date.trim() ? src.date.trim() : def.date,
      label: typeof src.label === 'string' && src.label.trim() ? src.label.trim() : def.label,
      short: typeof src.short === 'string' && src.short.trim() ? src.short.trim() : def.short,
      splits,
      pitches,
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
  DEFAULT_POSITIONS, MAX_POSITIONS,
  mergePositions, validatePositions, loadPositions,
  MAIN_PITCHES, SPLITS, SPLIT_SUFFIXES,
  derivePitches, splitsFromPitches, normaliseSplits, remapGroupPitches,
};
