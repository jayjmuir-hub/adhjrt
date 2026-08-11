/* ============================================================
   ADH JRT — Scores & Standings data layer  (LIVE backend)
   ------------------------------------------------------------
   Every read/write the UI needs goes through the async functions
   exported at the bottom. Manager accounts, match results, and
   sessions are real — accounts self-signup via manager-signup.js
   (gated by an invite code per age group) and are stored server-side
   in Netlify Blobs; results are written via submit-result.js and read
   back (by anyone, including the public Standings page) via
   get-results.js. See those files in netlify/functions/ for the
   one-time setup (MANAGER_INVITE_CODES + SESSION_SECRET env vars).

   THE DRAW (which teams are in which pool, and each match's home/away
   teams + kickoff time + pitch) starts out auto-generated from the
   config below (see buildDefaultDraw) — identical for every visitor
   until someone customizes it. A signed-in manager (their own age
   group) or organizer (any age group) can drag teams into pools and
   match slots and edit times/pitches from the Manager area's Fixture
   Editor; saving persists a full override to Netlify Blobs (via
   save-schedule-override.js), which every reader — including this
   public Standings/Fixtures page and the main site's schedule display
   — then uses instead of the auto-generated version. "Reset" deletes
   the override and reverts to auto-generated.
   ============================================================ */

const STORE_KEY = 'adhjrt_results_v1';   // matchId -> result
/* ONE session key for BOTH roles (Aug 2026 — claude/specs/spec-unified-login.md).
   The stored object is exactly what the login endpoint returned plus the
   token: organizer-shaped ({... _role:'organizer'}) or manager-shaped
   ({... ageGroupId}). currentSession() below still hands organizer sessions
   to manager-side callers in the wrapped { ageGroupId:'*', isOrganizer:true }
   form, so nothing downstream changed. The two old keys are migrated once,
   on first read, and nobody gets signed out by this change. */
const SESSION_KEY = 'adhjrt_session_v2';
const OLD_MANAGER_SESSION_KEY = 'adhjrt_session_v1';        // pre-Aug-2026: the scores/manager pages' key
const OLD_ORG_SESSION_KEY = 'adhjrt_organizer_session';     // pre-Aug-2026: organizer-data.js's key

/* -------- Tournament configuration (pools & teams) --------
   "Build it flexible": age groups, pools, teams and how many
   advance are all data. Fill these in with the real draw later.
   hasStandings:false  → festival age groups (U6/U7), no table.
   This is only ever the STARTING POINT for a pool's team list — once a
   manager/organizer saves a custom draw for an age group, its saved
   pools (which can differ from this) take over everywhere. */
/* -------- Team identity --------
   A team is identified everywhere by its CODE (ADH1, DE1 …) — the same scheme
   netlify/functions/_teams.js assigns at registration. The code is what pools,
   fixtures, standings and brackets store, because it is short enough for a
   phone table and unambiguous when one club enters two teams in an age group
   ("Abu Dhabi Harlequins v Abu Dhabi Harlequins" is meaningless).

   TEAM_NAMES maps a code to the readable name, used wherever there is room —
   match detail, the fixture key, the team filter. Add new clubs here as they
   register; teamLabel() falls back to the raw code if one is missing, so an
   unknown team shows as itself rather than blank. */
const TEAM_NAMES = {
  ADH1: 'AD Harlequins 1',
  DE1:  'Dubai Exiles 1',
  DS1:  'Dubai Sharks 1',
  DH1:  'Dubai Hurricanes 1',
  BAR1: 'Barrelhouse 1',
  AAA1: 'Al Ain Amblers 1',
  DD1:  'Dubai Dragons 1',
  DT1:  'Dubai Tigers 1',
  ADSB1:'AD Small Blacks 1',
};

/* Each club's crest, keyed by CODE PREFIX (the letters before the number) —
   a club's logo is the same for its 1st and 2nd team in an age group, same
   as its name. Clubs not listed here (an "Other" free-text registration
   with no fixed prefix) simply show no logo, rather than a broken image. */
const TEAM_LOGOS = {
  ADH:  '/assets/logos/adh.png',
  DE:   '/assets/logos/de.png',
  DS:   '/assets/logos/ds.png',
  DH:   '/assets/logos/dh.png',
  DT:   '/assets/logos/dt.png',
  BAR:  '/assets/logos/bar.png',
  AAA:  '/assets/logos/aaa.png',
  DD:   '/assets/logos/dd.png',
  ADSB: '/assets/logos/adsb.png',
  DW:   '/assets/logos/dw.png',
};

/* Names that arrived with a draw (draw.teamNames, written by the fixture
   editor's "Import registered teams"). Keyed by AGE GROUP, because _teams.js
   numbers teams within an age group: ADH1 in U16B and ADH1 in U14B are
   different teams. One global code->name map would silently collide. */
const DRAW_NAMES = Object.create(null);

function rememberDrawNames(agId, draw) {
  if (agId && draw && draw.teamNames) DRAW_NAMES[agId] = draw.teamNames;
}

/* Best effort for callers with no age group to hand: answer only if every
   loaded draw that knows this code agrees on the name. Better to fall through
   to the bare code than to confidently name the wrong club. */
function nameAcrossDraws(code) {
  let found = null;
  for (const agId in DRAW_NAMES) {
    const n = DRAW_NAMES[agId][code];
    if (!n) continue;
    if (found && found !== n) return null;
    found = n;
  }
  return found;
}

/* The readable name. Pass agId whenever you have it. Resolution order: the
   draw's own map, then an unambiguous match across loaded draws, then the
   hardcoded TEAM_NAMES, then the raw string. Always shortens "Abu Dhabi" to
   "AD". Idempotent, so it is safe on a value that is already a name. */
export function teamLabel(code, agId) {
  if (!code) return '';
  const fromDraw = (agId && DRAW_NAMES[agId] && DRAW_NAMES[agId][code]) || nameAcrossDraws(code);
  return String(fromDraw || TEAM_NAMES[code] || code).replace(/Abu Dhabi/gi, 'AD');
}

/* The short form, for the two places a full name does not fit: the app's
   pinned standings column and the knockout bracket cells.

   Normally this is just the code. But a draw built by hand holds full club
   names in the same slot, and those must still be shortened - otherwise the
   standings table reads "Abu Dhabi Harlequins 1" while every fixture row on
   the same screen reads "AD Harlequins 1". The replace is a no-op on a real
   code, so this is safe either way. */
export function teamShort(code) {
  return String(code || '').replace(/Abu Dhabi/gi, 'AD');
}

/* The club's crest for a team code, or '' if this club has no logo on file.
   Strips the trailing number so ADH1 and ADH2 share one crest — the logo is
   the club's, not the team's. A hand-typed full name (no code pattern) also
   falls through to '', same failure mode as an unknown club. */
export function teamLogoSrc(code) {
  const m = String(code || '').match(/^([A-Za-z]+)\d*$/);
  const prefix = m ? m[1].toUpperCase() : '';
  return TEAM_LOGOS[prefix] || '';
}
/* Mirrors netlify/functions/_scoring.js so the entry forms can build
   themselves. The server re-derives the total from these same rules, so this
   copy only decides which inputs are shown — it can never change a score. */
const SCORE_POINTS = { tries: 5, conversions: 2, penalties: 3, drops: 3 };
const SCORE_LABEL  = { tries: 'Tries', conversions: 'Conversions', penalties: 'Penalties', drops: 'Drop goals' };
const SCORE_BY_AGE = {
  u6:['tries'], u7:['tries'], u8:['tries'], u9:['tries'], u10:['tries'], u11:['tries'],
  u12:['tries','conversions'], u12g:['tries','conversions'], u13:['tries','conversions'],
  u14b:['tries','conversions','penalties','drops'], u14g:['tries','conversions','penalties','drops'],
  u16b:['tries','conversions','penalties','drops'], u16g:['tries','conversions','penalties','drops'],
  u18b:['tries','conversions','penalties','drops'], u18g:['tries','conversions','penalties','drops'],
};
/* Live rules, once fetched, replace the built-in defaults. Fetched on demand
   and cached — a config lookup must never sit between a manager and a score. */
let LIVE_RULES = null;

export async function loadScoringRules() {
  if (LIVE_RULES) return LIVE_RULES;
  const r = await tryFetchJson('/.netlify/functions/scoring-rules');
  if (r.real && r.json && r.json.ok && r.json.rules) LIVE_RULES = r.json.rules;
  else LIVE_RULES = { ...SCORE_BY_AGE };
  return LIVE_RULES;
}

export async function saveScoringRules(rules, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/scoring-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ rules }),
  });
  if (r.real && r.json && r.json.ok) { LIVE_RULES = r.json.rules; return { ok: true }; }
  return { ok: false, error: (r.json && r.json.error) || 'Could not save the scoring rules.' };
}

export function scoringFor(ageGroupId) {
  const src = LIVE_RULES || SCORE_BY_AGE;
  return src[ageGroupId] || ['tries','conversions','penalties','drops'];
}
export function allScoreTypes() { return ['tries','conversions','penalties','drops']; }
export function scorePoints(k) { return SCORE_POINTS[k] || 0; }
export function scoreLabel(k) { return SCORE_LABEL[k] || k; }
export function scoreTotal(ageGroupId, parts) {
  return scoringFor(ageGroupId).reduce((sum, k) => {
    const v = Math.max(0, Math.floor(Number((parts || {})[k]) || 0));
    return sum + v * SCORE_POINTS[k];
  }, 0);
}

/* ============================================================
   THE VENUE — which pitches exist on each day, and which age groups play
   on which day.
   ------------------------------------------------------------
   Which day a group plays used to be a hardcoded array called SATURDAY inside
   app.html, and it was wrong: U12G was on Saturday and U18B/U18G were missing
   from it, so both fell through to Sunday. That list is gone. An age group is
   now on Saturday because Saturday is where the layout gives it pitches, so the
   two facts cannot disagree.

   ⚠️ DEFAULT_VENUE MUST MATCH netlify/functions/_venue.js's DEFAULT_VENUE.
   The same table has to exist on both sides: the server reads it to answer
   /venue-layout, and this copy is what the offline/local fallback and the very
   first paint use before that fetch resolves. test-venue.js compares the two and
   fails if they drift.

   Read off Pitch maps_Final.pdf (Sat 25 / Sun 26 Oct 2025), confirmed by Jay on
   26 July 2026 as the same running order for 2026. The sub-pitch letters
   (B1a..B1d, D3a/D3b and so on) are OURS — the map draws the boxes inside one
   outline without naming them, so these have to match the printed pitch flags.
   ============================================================ */
export const DEFAULT_VENUE = {
  day1: {
    date: '2026-11-14',
    label: 'Saturday 14 November',
    short: 'Sat',
    /* Whole / halves / quarters per main pitch. THE SOURCE OF TRUTH; `pitches`
       is derived from it (see derivePitches in netlify/functions/_venue.js) and
       is written out here so every existing reader of `day.pitches` is
       untouched and the two DEFAULT_VENUE copies stay comparable. */
    splits: { D5: 2, D4: 2, D3: 2, D2: 1, D1: 1, C4: 1, C5: 1, B1: 4, A1: 4 },
    pitches: ['D5a', 'D5b', 'D4a', 'D4b', 'D3a', 'D3b', 'D2', 'D1',
      'C4', 'C5', 'B1a', 'B1b', 'B1c', 'B1d', 'A1a', 'A1b', 'A1c', 'A1d'],
    groups: {
      u6:   ['D4a', 'D4b', 'D5a', 'D5b'],   // morning
      u7:   ['D4a', 'D4b', 'D5a', 'D5b'],   // afternoon, the same four
      u8:   ['B1a', 'B1b', 'B1c', 'B1d'],
      u9:   ['A1a', 'A1b', 'A1c', 'A1d'],
      u10:  ['C5'],
      u11:  ['C4'],
      u12:  ['D3a', 'D3b'],
      u18b: ['D2'],
      u18g: ['D1'],
    },
  },
  day2: {
    date: '2026-11-15',
    label: 'Sunday 15 November',
    short: 'Sun',
    splits: { D3: 1, D2: 1, D1: 1, C4: 2, C5: 1, B1: 2, A1: 2 },
    pitches: ['D3', 'D2', 'D1', 'C4a', 'C4b', 'C5', 'B1a', 'B1b', 'A1a', 'A1b'],
    groups: {
      u12g: ['B1a', 'B1b'],
      u13:  ['C4a', 'C4b'],
      u14b: ['D3'],
      u14g: ['A1a', 'A1b'],
      u16b: ['D2', 'D1'],
      u16g: ['C5'],
    },
  },
};

/* ---- The pitch model, shared with netlify/functions/_venue.js ----
   A main pitch is run whole, in halves or in quarters, and the playable surface
   names are DERIVED from that. Duplicated here for the same reason
   DEFAULT_VENUE is: the front end needs the answer before any fetch resolves,
   and there is no build step to share a module across both sides.

   Keep in step with _venue.js. test-venue-splits.js compares them. */
export const MAIN_PITCHES = ['D5', 'D4', 'D3', 'D2', 'D1', 'C4', 'C5', 'C3', 'C2', 'C1', 'B1', 'A1', 'A2', 'A3', 'A4'];
export const SPLITS = [1, 2, 4];
const SPLIT_SUFFIXES = { 1: [''], 2: ['a', 'b'], 4: ['a', 'b', 'c', 'd'] };

export function derivePitches(splits) {
  const out = [];
  if (!splits || typeof splits !== 'object') return out;
  MAIN_PITCHES.forEach((main) => {
    const n = Number(splits[main]);
    if (SPLITS.indexOf(n) < 0) return;
    SPLIT_SUFFIXES[n].forEach((suffix) => out.push(main + suffix));
  });
  return out;
}

/* A group keeps the same GROUND when a split changes; only the names change.
   Split a pitch it had whole and it gets every part; merge the parts and it
   gets the whole. Anything else loses an allocation to a rename, which nobody
   notices until a team turns up. */
export function remapGroupPitches(list, oldSplits, newSplits) {
  const kept = [];
  const add = (name) => { if (!kept.includes(name)) kept.push(name); };
  (Array.isArray(list) ? list : []).forEach((p) => {
    /* Only uppercased to FIND the main pitch (MAIN_PITCHES entries are all
       upper), never to store — the canonical suffix is lowercase, and this
       must hand back exactly the pitch a saved fixture is sitting on when
       nothing about its split has changed. */
    const raw = typeof p === 'string' ? p.trim() : '';
    if (!raw) return;
    const m = raw.toUpperCase().match(/^(.*[0-9])([A-Z])?$/);
    const main = m ? m[1] : raw.toUpperCase();
    const before = Number((oldSplits || {})[main]);
    const after = Number((newSplits || {})[main]);
    if (SPLITS.indexOf(after) < 0) return;
    if (before === after) { add(raw); return; }       // untouched — keep as stored
    SPLIT_SUFFIXES[after].forEach((suffix) => add(main + suffix));
  });
  return kept;
}

/* The live layout once fetched. Until then every reader below answers from
   DEFAULT_VENUE, so nothing ever waits on a config fetch and nothing is ever
   undefined. loadVenue() is called once at start-up by whoever cares. */
let LIVE_VENUE = null;

export function venue() { return LIVE_VENUE || DEFAULT_VENUE; }

export async function loadVenue() {
  if (LIVE_VENUE) return LIVE_VENUE;
  const r = await tryFetchJson('/.netlify/functions/venue-layout');
  if (r.real && r.json && r.json.ok && r.json.venue) LIVE_VENUE = r.json.venue;
  else LIVE_VENUE = DEFAULT_VENUE;
  return LIVE_VENUE;
}

/* 'day1' | 'day2' | null. Null means the layout does not list this age group at
   all — a configuration problem worth showing rather than papering over. Listed
   with an EMPTY pitch array still counts as being on that day: "which day" and
   "which pitches" are separate questions, and a group can be scheduled for
   Sunday before anyone has decided where it plays. */
export function dayIdOfAgeGroup(agId) {
  const v = venue();
  if (v.day1 && v.day1.groups && v.day1.groups[agId]) return 'day1';
  if (v.day2 && v.day2.groups && v.day2.groups[agId]) return 'day2';
  return null;
}

/* The yyyy-mm-dd date an age group plays on. A group missing from the layout
   falls back to day 1 rather than returning nothing: this feeds the date
   arithmetic behind the countdown, and a null here would read as "kick-off in
   NaN minutes". Day 1 is the safe wrong answer — it is the earlier of the two,
   so a countdown built on it expires rather than sitting in the future forever. */
export function dayOfAgeGroup(agId) {
  const v = venue();
  const d = dayIdOfAgeGroup(agId) || 'day1';
  return (v[d] && v[d].date) || DEFAULT_VENUE[d].date;
}

export function isDayOne(agId) { return dayIdOfAgeGroup(agId) === 'day1'; }

/* 'Saturday 14 November', or 'Sat' with short=true. Headings, and the day pill on
   the app's age-group picker. */
export function dayLabelOfAgeGroup(agId, short) {
  const v = venue();
  const d = dayIdOfAgeGroup(agId) || 'day1';
  const day = v[d] || DEFAULT_VENUE[d];
  return short ? (day.short || '') : (day.label || '');
}

/* The pitches this age group is allowed to use, in the order the layout lists
   them. This is what the Fixture Editor's pitch dropdowns offer — a manager can
   only pick from their own group's pitches. */
export function pitchesForAgeGroup(agId) {
  const d = dayIdOfAgeGroup(agId);
  if (!d) return [];
  const list = venue()[d].groups[agId];
  return Array.isArray(list) ? list.slice() : [];
}

/* Every pitch running on the day this age group plays. Not offered to managers;
   the clash check needs it to report a pool sitting on a pitch that exists but
   is not in its own group's allocation. */
export function pitchesOnDayOf(agId) {
  const d = dayIdOfAgeGroup(agId);
  if (!d) return [];
  const day = venue()[d];
  return Array.isArray(day.pitches) ? day.pitches.slice() : [];
}

/* ============================================================
   THE REGISTRATION WINDOW — when the entry forms are open.
   ------------------------------------------------------------
   Two levers used to be one. "The site is public" is a Netlify setting Jay
   flips on the day; "clubs can register" is these two dates, opened later and
   closed again before the tournament so the squads are fixed while the draw is
   built. It used to be `registrationOpen`, a hardcoded prop on the homepage —
   changing it cost a production deploy, and the dates will move.

   Everything between the two SHARED BLOCK markers below is duplicated BYTE FOR
   BYTE in netlify/functions/_registration.js, for the same reason DEFAULT_VENUE
   is duplicated: the server needs it, and this copy is what the very first paint
   uses before any fetch resolves. The register CTA is above the fold and cannot
   wait on a config round-trip. test-registration.js compares the two blocks
   character for character and fails if either is edited alone.

   Times are ABU DHABI time. The rest of this codebase builds dates with
   `new Date(2026, 7, 31)`, which is browser-local — so "opens 8 October" would
   be a different instant for a club in the UK than for one in Dubai. Every stamp
   stored here carries an explicit +04:00.
   ============================================================ */

/* ===== REGISTRATION WINDOW — SHARED BLOCK (start) =====
   Everything between these two markers is duplicated BYTE FOR BYTE in
   scores-data.js. It has to exist on both sides: the server needs it to answer
   /registration-window (and, later, to refuse a late submission), and the front
   end needs an answer before any fetch resolves — the register CTA is above the
   fold and cannot wait on a config round-trip.

   Do not reformat one copy. test-registration.js extracts this block from both
   files and compares the text exactly, the same trick test-venue.js uses for
   DEFAULT_VENUE. Plain `function` declarations with no `export` keyword are
   what let one text serve a CommonJS file and an ES module — each file exports
   these names separately, OUTSIDE the block. */

const REGISTRATION_MODES = ['auto', 'open', 'closed'];

/* Abu Dhabi is UTC+4 all year — the UAE has no daylight saving, so a fixed
   offset is correct rather than merely convenient. */
const REGISTRATION_TZ_OFFSET = '+04:00';

/* Null dates mean CLOSED. Before anyone sets a date, `auto` resolves to closed
   rather than to open — the failure mode of a form that is shut when it should
   be open is a phone call; the other way round is a registration nobody expected
   and a child on a roster with no age check behind it. */
const DEFAULT_REGISTRATION = { opensAt: null, closesAt: null, mode: 'auto' };

/* Is this a day that actually exists? Date.parse() is no use for this: it
   ACCEPTS '2026-02-31T00:00:00+04:00' and quietly rolls it forward to 3 March,
   so a shape check plus "does it parse" lets an impossible date through as a
   real one. That is the same trap composeDob() closes on the player form, where
   a rolled-forward date means a birthday nobody typed; here it would mean
   registration opening three days after the day on the poster.

   Day 0 of the following month is the last day of this one, computed in UTC so
   the machine's own timezone cannot shift it. */
function isRealDate(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7)), d = Number(ymd.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/* 'yyyy-mm-dd' -> '2026-10-08T00:00:00+04:00' (or T23:59:59 for the closing
   end of a day). The back office picks whole days; nobody needs registration to
   open at 14:30. Returns null for anything that is not a plain calendar date —
   or is one that does not exist — so a malformed value can never become a stamp
   that silently parses. */
function stampFromDate(ymd, endOfDay) {
  if (!isRealDate(ymd)) return null;
  return ymd + (endOfDay ? 'T23:59:59' : 'T00:00:00') + REGISTRATION_TZ_OFFSET;
}

/* The other direction, for putting a stored stamp back into a date field.
   Reads the CHARACTERS rather than building a Date: the first ten characters of
   a stamp we authored are the Abu Dhabi calendar date by construction, whereas
   `new Date(stamp).getDate()` would answer in the visitor's own timezone and
   show a London organiser the day before. */
function dateOfStamp(stamp) {
  return typeof stamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(stamp) ? stamp.slice(0, 10) : '';
}

/* Milliseconds, or null if there is nothing usable. A stamp that does not parse
   is treated as ABSENT, not as zero — absent fails closed, zero would put every
   date in the past and throw the form open. */
function parseStamp(stamp) {
  if (typeof stamp !== 'string' || !stamp) return null;
  const ms = Date.parse(stamp);
  return Number.isFinite(ms) ? ms : null;
}

/* '8 October' from a stored stamp, in Abu Dhabi terms. Built from the string's
   own characters for the reason in dateOfStamp above — no Date object is
   involved, so the answer does not change with the reader's timezone. */
const REGISTRATION_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function fmtWindowDate(stamp, withYear) {
  const ymd = dateOfStamp(stamp);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  const name = REGISTRATION_MONTHS[Number(m) - 1];
  if (!name) return '';
  return `${Number(d)} ${name}` + (withYear ? ` ${y}` : '');
}

/* THE ONE FUNCTION THAT DECIDES.  -> { open, phase, opensAt, closesAt, forced, mode }
   Pure and synchronous: no fetching, no clock of its own, `now` passed in. That
   is what makes it testable one second either side of each boundary.

   `phase` and `open` answer two DIFFERENT questions, deliberately:

     phase  = where we are relative to the DATES. Pure date arithmetic; the mode
              never touches it. 'unset' | 'before' | 'open' | 'after'.
     open   = whether the form actually works. Mode first, dates second.

   Keeping them apart is what stops a force-closed window having to lie about
   which phase it is in. Nothing outside this file makes that judgement twice:
   registrationCopy() below reads both and decides the wording once, and the
   homepage and the back-office preview both print what it returns.

   `forced` is true whenever the mode is not 'auto', so the UI can say which. */
function registrationState(settings, now) {
  const s = settings && typeof settings === 'object' ? settings : DEFAULT_REGISTRATION;
  /* An unrecognised mode falls back to 'auto', which means the DATES decide.
     That is deliberate and it is not a hole: the mode is only ever an exception
     to the dates, so discarding a junk exception leaves the dates — which is
     what the organiser set on purpose. validateSettings refuses an unknown mode
     at save time, so this can only be reached by a blob edited by hand. */
  const mode = REGISTRATION_MODES.indexOf(s.mode) >= 0 ? s.mode : 'auto';
  const opensAt  = typeof s.opensAt  === 'string' && s.opensAt  ? s.opensAt  : null;
  const closesAt = typeof s.closesAt === 'string' && s.closesAt ? s.closesAt : null;

  const o = parseStamp(opensAt);
  const c = parseStamp(closesAt);
  const t = now instanceof Date ? now.getTime() : Number(now);

  /* An unreadable clock must not open the form. Without this guard every
     comparison below is false against NaN and the final `else` hands back
     'open' — the one wrong answer that matters. */
  let phase;
  if (!Number.isFinite(t)) phase = 'unset';
  /* No opening date means there is nothing to open, whatever else is set. A
     closing date on its own is an incomplete configuration, not an invitation
     to treat the window as already running; the back office warns about it. */
  else if (o === null) phase = 'unset';
  else if (t < o) phase = 'before';
  else if (c !== null && t >= c) phase = 'after';
  else phase = 'open';

  const forced = mode !== 'auto';
  const open = mode === 'open' ? true : (mode === 'closed' ? false : phase === 'open');

  return { open, phase, opensAt, closesAt, forced, mode };
}

/* Checks a window a human is trying to save. Returns { ok, errors, settings }.
   Three hard errors, exactly as designed — refused with the reason shown, never
   silently coerced:

     - a date that does not parse
     - closesAt on or before opensAt
     - a mode outside the three

   Accepts either a full stamp ('2026-10-08T00:00:00+04:00') or a bare calendar
   date ('2026-10-08'), and stores the full stamp either way. The back office
   sends stamps; accepting the bare form as well means a value typed into the
   blob by hand still lands canonical rather than half-broken.

   THIS LIVES IN THE SHARED BLOCK ON PURPOSE, and it is the improvement on the
   venue panel. There, validateVenue() and venueProblems() are two hand-written
   implementations of one rule, and test-venue-panel.js exists to catch them
   disagreeing — because when they do, either Save goes green on something the
   server will reject, or it bounces with no explanation. Here the back office
   calls THIS function, so they cannot disagree. The server is still the
   authority; the panel is just asking it in advance. */
function validateSettings(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['No settings sent.'] };

  const read = (raw, label, endOfDay) => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw !== 'string') { errors.push(`The ${label} is not a date.`); return null; }
    const s = raw.trim();
    /* The calendar check runs on anything that STARTS with a date, not just on
       the bare form — otherwise '2026-02-31T00:00:00+04:00' sent as a full stamp
       skips it, parses, and is stored as 3 March. */
    if (/^\d{4}-\d{2}-\d{2}/.test(s) && !isRealDate(s.slice(0, 10))) {
      errors.push(`"${raw}" is not a real ${label} — there is no such day.`);
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return stampFromDate(s, endOfDay);
    if (parseStamp(s) === null) { errors.push(`"${raw}" is not a date we can read as the ${label}.`); return null; }
    return s;
  };

  const opensAt  = read(input.opensAt,  'opening date', false);
  const closesAt = read(input.closesAt, 'closing date', true);

  const mode = input.mode === undefined || input.mode === null ? 'auto' : input.mode;
  if (REGISTRATION_MODES.indexOf(mode) < 0) {
    errors.push(`"${mode}" is not one of: follow the dates, force open, force closed.`);
  }

  const o = parseStamp(opensAt), c = parseStamp(closesAt);
  if (o !== null && c !== null && c <= o) {
    errors.push('The closing date is on or before the opening date — registration would never be open.');
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], settings: { opensAt, closesAt, mode } };
}

/* Things worth saying but not worth refusing. Never blocks a save: "no opening
   date yet" is the state this setting spends most of its life in, and blocking
   it would make the panel unusable. Reads its inputs back off registrationState
   rather than the raw object, so it is describing the same normalised values the
   rest of the site is acting on. */
function registrationWarnings(settings, now) {
  const st = registrationState(settings, now);
  const out = [];
  if (!st.opensAt && !st.closesAt) out.push('No dates set yet, so registration stays closed until you set an opening date.');
  else if (!st.opensAt) out.push('There is a closing date but no opening date, so registration stays closed.');
  else if (!st.closesAt) out.push('There is no closing date, so once registration opens it stays open.');
  if (st.mode === 'open') out.push('Force open is on — the form is open to anyone who reaches the site, whatever the dates say. The public page shows a TEST MODE strip while this is on.');
  if (st.mode === 'closed') out.push('Force closed is on — the form stays shut even inside the dates.');
  if (st.phase === 'after' && st.mode === 'auto') out.push('The closing date has passed. The public page now says registration has closed.');
  return out;
}

/* THE PUBLIC WORDING, decided once.  -> { pill, blurb, buttons, testMode, opensInMs, state }
   The homepage prints this and the back office's "What the public page says"
   preview prints the same call, so the preview cannot show Jay one thing and a
   coach another. That is the whole reason prose is sitting in a shared module:
   a preview that is a second hand-written guess at the copy is a preview that
   will eventually be wrong, and it will be wrong at exactly the moment somebody
   is relying on it to check the real thing.

   Three phases, not two, and one more that only a human can create:

     before  "Registration opens 8 October"    — with a countdown
     open    "Registration closes 1 November"  — a DEADLINE is more use to a
                                                 coach than an open date
     after   "Registration closed"             — say what happened rather than
                                                 showing a dead form
     unset   "Registration opens soon"         — no date to quote yet

   Force-closed INSIDE the dates gets its own line. Falling through to "opens
   soon" there would be untrue (it is not going to open soon, someone shut it),
   and falling through to the phase wording would print a closing date that has
   not happened. */
function registrationCopy(settings, now) {
  const st = registrationState(settings, now);
  const opens = fmtWindowDate(st.opensAt);
  const closes = fmtWindowDate(st.closesAt);
  /* This sentence opens the register blurb in ALL FOUR phases, so whatever it
     claims is claimed everywhere. It used to promise "Every player takes home a
     medal" — not true (Jay, 1 Aug 2026). Its replacement has to hold for every
     side that enters: pool stage plus a Cup/Bowl/Plate/Shield bracket means
     every team plays right through its day, whatever else happens. */
  const lead = 'Every side gets a full day of rugby and every family is welcome. ';

  if (st.open) {
    return {
      pill: closes ? `REGISTRATION CLOSES ${closes.toUpperCase()}` : 'REGISTRATION NOW OPEN',
      blurb: lead + (closes
        ? `Registration closes at the end of ${closes} — sign up your team or player below.`
        : 'Registration is open — sign up your team or player below.'),
      buttons: 'Both registration buttons work',
      testMode: st.forced,
      opensInMs: null,
      state: st,
    };
  }

  if (st.forced && st.phase === 'open') {
    return {
      pill: 'REGISTRATION IS CLOSED',
      blurb: lead + 'Registration is closed at the moment — drop us a line to register your interest and we\'ll be in touch.',
      buttons: 'Both buttons show "Coming soon"',
      testMode: false,
      opensInMs: null,
      state: st,
    };
  }

  if (st.phase === 'before') {
    const o = parseStamp(st.opensAt);
    const t = now instanceof Date ? now.getTime() : Number(now);
    return {
      pill: `REGISTRATION OPENS ${opens.toUpperCase()}`,
      blurb: lead + `Registration opens on ${opens} — check back then to enter your team.`,
      buttons: 'Both buttons show "Coming soon"',
      testMode: false,
      opensInMs: (o !== null && Number.isFinite(t)) ? o - t : null,
      state: st,
    };
  }

  if (st.phase === 'after') {
    return {
      pill: 'REGISTRATION CLOSED',
      blurb: lead + `Registration closed at the end of ${closes} — get in touch if you still need a place.`,
      buttons: 'Both buttons show "Coming soon"',
      testMode: false,
      opensInMs: null,
      state: st,
    };
  }

  return {
    pill: 'REGISTRATION OPENS SOON',
    blurb: lead + 'Registration opens soon — drop us a line to register your interest and we\'ll be in touch.',
    buttons: 'Both buttons show "Coming soon"',
    testMode: false,
    opensInMs: null,
    state: st,
  };
}

/* "in 12 days" / "in 6 hours" / "in 42 minutes" / "in 30 seconds". One unit,
   because the register CTA already sits under a four-part countdown to kick-off
   and a second one of those is noise. Rounds DOWN, so it never says "in 1 day"
   about something 90 minutes away. */
function fmtCountdown(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '';
  const s = Math.floor(ms / 1000);
  const plural = (n, unit) => `in ${n} ${unit}${n === 1 ? '' : 's'}`;
  if (s >= 172800) return plural(Math.floor(s / 86400), 'day');
  if (s >= 86400) return 'tomorrow';
  if (s >= 3600) return plural(Math.floor(s / 3600), 'hour');
  if (s >= 60) return plural(Math.floor(s / 60), 'minute');
  return plural(s, 'second');
}

/* ===== REGISTRATION WINDOW — SHARED BLOCK (end) ===== */

export {
  registrationState, registrationCopy, fmtCountdown, validateSettings, registrationWarnings,
  isRealDate, stampFromDate, dateOfStamp, fmtWindowDate,
  DEFAULT_REGISTRATION, REGISTRATION_MODES,
};

/* The live window once fetched. Until then every reader answers from
   DEFAULT_REGISTRATION, which is CLOSED — so a fetch that fails, or has not
   landed yet, shows a shut form rather than opening one nobody meant to open.
   That direction is deliberate: the failure mode of a form that is shut when it
   should be open is a phone call. */
let LIVE_REGISTRATION = null;

export function registrationSettings() { return LIVE_REGISTRATION || DEFAULT_REGISTRATION; }

/* True once the real answer has arrived. The homepage uses it to hold the
   "Coming Soon" ribbon back for the fraction of a second before the fetch
   lands, so an open window does not flash shut on first paint. */
let REGISTRATION_LOADED = false;
export function registrationLoaded() { return REGISTRATION_LOADED; }

export async function loadRegistrationWindow() {
  if (LIVE_REGISTRATION) return LIVE_REGISTRATION;
  const r = await tryFetchJson('/.netlify/functions/registration-window');
  LIVE_REGISTRATION = (r.real && r.json && r.json.ok && r.json.settings)
    ? r.json.settings
    : DEFAULT_REGISTRATION;
  REGISTRATION_LOADED = true;
  return LIVE_REGISTRATION;
}

/* The current answer, for callers that would rather not pass a clock in. The
   pure function is still the one under test; this is a two-line convenience and
   nothing but display should use it. */
export function currentRegistrationState(now) {
  return registrationState(registrationSettings(), now === undefined ? Date.now() : now);
}


/* The code->name legend. Uses the draw's own names for that age group when it
   has them, so the key describes the teams actually playing rather than the
   hardcoded placeholder clubs. */
export function teamKey(agId) {
  const map = (agId && DRAW_NAMES[agId]) || TEAM_NAMES;
  return Object.keys(map).map((c) => ({ code: c, name: teamLabel(c, agId), logoSrc: teamLogoSrc(c) }));
}

const ALL9 = ['ADH1', 'DE1', 'DS1', 'DH1', 'BAR1', 'AAA1', 'DD1', 'DT1', 'ADSB1'];
const twoPools9 = () => [
  { id: 'A', name: 'Pool A', teams: ALL9.slice(0, 5) },
  { id: 'B', name: 'Pool B', teams: ALL9.slice(5) },
];

const AGE_GROUPS = [
  { id: 'u6',  name: 'U6 Tag',           hasStandings: false, advance: 0, pools: [{ id: 'A', name: 'Festival Pool', teams: [...ALL9] }] },
  { id: 'u7',  name: 'U7 Tag',           hasStandings: false, advance: 0, pools: [{ id: 'A', name: 'Festival Pool', teams: [...ALL9] }] },
  { id: 'u8',  name: 'U8 Tag',           hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u9',  name: 'U9 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u10', name: 'U10 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u11', name: 'U11 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u12', name: 'U12 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u12g', name: 'U12G QR',          hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u13', name: 'U13 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u14b', name: 'U14B Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u14g', name: 'U14G QR',          hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u16b', name: 'U16B Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u16g', name: 'U16G Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u18b', name: 'U18B Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u18g', name: 'U18G Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
];

const WALKOVER_SCORE = 20; // walk-over recorded as 20-0

// Age groups old enough for the Spirit of Rugby Award (U14 and up) — each
// match lets the manager nominate one player; nominations tally across the
// whole age group, and once every real match has a submitted result the
// player(s) with the most nominations are the award winner(s).
const SPIRIT_AWARD_AGE_IDS = ['u14b', 'u14g', 'u16b', 'u16g', 'u18b', 'u18g'];

// Age groups using the special double-bracket knockout format (see
// buildU16BBracket) instead of the plain waterfall every other group uses.
const SPECIAL_BRACKET_AGE_IDS = ['u16b', 'u16g'];

// Age groups that use the reduced festival schedule (see
// orderFestivalNoBackToBack) instead of a full round robin.
const FESTIVAL_AGE_IDS = ['u6', 'u7'];

/* ---------------- storage helpers (live backend, with local fallback) ----------------
   See local-backend.js for why/how the fallback works — same pattern as
   organizer-data.js. */
let localBackendPromise = null;
function local() {
  if (!localBackendPromise) localBackendPromise = import(new URL('local-backend.js', document.baseURI).href);
  return localBackendPromise;
}
// 30 Jul: only a 404 means "no backend deployed here" (a plain static
// server has no /.netlify/functions/* route). Any other non-JSON response
// (a Netlify platform error page, a crash, a timeout) means a real,
// deployed backend is having a real problem, and is now surfaced as an
// error instead of silently falling back to fake local-preview data — see
// the matching comment in organizer-data.js.
/* ===== BEING SIGNED OUT BY THE SERVER ==================================
   Spec: claude/specs/spec-session-refusal-aug-2026.md

   Until 11 Aug 2026 NOTHING here turned a refusal into a signed-out state.
   logout() was called by the Sign out button and by nothing else, and
   currentSession() hands back a session whenever a token STRING is in
   localStorage — it never asks whether that token is still any good. So a
   dashboard went on rendering from browser storage while every request behind
   it was turned away. Found on production by revoking an account and then
   deleting it outright: the page still drew, fifteen refreshes running.

   ⚠️ IT ACTS ON `sessionEnded` AND ON NOTHING ELSE — NEVER ON A STATUS CODE.
   Proven against the real handlers: a manager touching an organiser-only
   endpoint and a revoked manager touching the SAME endpoint both come back
   403. One must stay signed in and one must not. A status code cannot tell
   them apart; the flag can. A store outage answers 503 and carries no flag,
   because signing fifteen managers out at a pitch over a blob blip is far
   worse than the thing this fixes.

   ⚠️ Reading the SENTENCE instead would be worse than reading the status:
   the wording is meant to be improvable, and test-unified-login.js had to be
   rewritten once for pinning an exact refusal string. */
let sessionEndedHandler = null;

/* /app is a PWA with its own sign-in sheet and no business navigating away
   from itself mid-tournament, so it registers its own behaviour. Everything
   else takes the default below. */
export function onSessionEnded(fn) { sessionEndedHandler = fn; }

export function noteSessionEnded(parsed) {
  if (!parsed || parsed.sessionEnded !== true) return;
  logout();
  if (sessionEndedHandler) { try { sessionEndedHandler(); } catch (e) {} return; }
  try {
    /* ⚠️ THE PATHNAME GUARD IS NOT OPTIONAL. Without it a refusal answered on
       /signin itself redirects to /signin, which asks again, for ever. */
    if (typeof location !== 'undefined' && location.pathname.indexOf('/signin') !== 0) {
      location.replace('/signin?signedout=1');
    }
  } catch (e) { /* no location (a test, a worker): clearing the session is enough */ }
}

async function tryFetchJson(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    return { real: false }; // couldn't even reach the network
  }
  let text = '';
  try { text = await res.text(); } catch (e) { /* fall through - body unreadable */ }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      return { real: true, json: { ok: false, error: 'Unexpected response from the server.' } };
    }
    /* Every authenticated call in this file goes through here, which is the
       whole reason the rule lives at this one point rather than in each
       caller — a caller that forgot would simply never sign anybody out. */
    noteSessionEnded(parsed);
    return { real: true, json: parsed };
  } catch (e) {
    if (res.status === 404) return { real: false }; // no backend deployed here
    return { real: true, json: { ok: false, error: 'Server error. Please try again in a moment.' } };
  }
}

async function readStore() {
  const r = await tryFetchJson('/.netlify/functions/get-results');
  if (r.real) return r.json.ok ? r.json.results : {};
  return (await local()).getResults();
}

/* Returns the full publish state, not just the draw:
     { schedule, awaitingPublication, published, publishedAt, publishedBy,
       managerCanPublishNow }

   Public callers get the PUBLISHED draw only. `awaitingPublication` is true
   when nothing has been published for this age group — in which case readers
   must show "coming soon" and must NOT fall back to the auto-generated draw,
   which is sample data a parent could not tell apart from real fixtures.

   Passing a session asks for the DRAFT instead, for the fixture editor. */
async function fetchOverrideState(agId, session) {
  const draft = session && session.token ? '&draft=1' : '';
  const opts = session && session.token
    ? { headers: { Authorization: `Bearer ${session.token}` } }
    : undefined;

  const r = await tryFetchJson(
    `/.netlify/functions/get-schedule-override?age=${encodeURIComponent(agId)}${draft}`,
    opts
  );

  if (r.real && r.json && r.json.ok) {
    return {
      schedule: r.json.schedule || null,
      awaitingPublication: !!r.json.awaitingPublication,
      published: !!r.json.published,
      publishedAt: r.json.publishedAt || null,
      publishedBy: r.json.publishedBy || null,
      managerCanPublishNow: !!r.json.managerCanPublishNow,
      isDraft: !!r.json.isDraft,
    };
  }

  /* Local fallback (see local-backend.js) has no publish concept, so treat a
     saved override as published — it keeps offline development usable. */
  const schedule = await (await local()).getScheduleOverride(agId);
  return {
    schedule: schedule || null,
    awaitingPublication: !schedule,
    published: !!schedule,
    publishedAt: null,
    publishedBy: null,
    managerCanPublishNow: true,
    isDraft: false,
  };
}

/* ---------------- WHICH DRAW IS THIS READER ALLOWED TO SEE ----------------
   One derivation, four answers, called by getFixtures() and getStandings() so
   the two cannot drift apart. getDraw() does NOT use it — the editor always
   wants the draft and reports the publish state separately, in `_publish`.
   Added Aug 2026: the editor could always read an
   unpublished draw and every OTHER view of the same data was blind, so a
   manager who had just built a draw could not read it back as a fixture list,
   could not see a table, and — because the score sheet's match list is built
   from the same fetch — could not enter a score at all.

     'published' the published copy. What the public gets, unchanged.
     'draft'     an unpublished draft this reader is allowed to see.
     'sample'    no draft exists, so resolveDraw() will fall back to the
                 deterministic auto-generated draw. PLACEHOLDER CLUBS.
     'none'      nothing published and no right to a draft. "Coming soon".

   ⚠️ THE DISCRIMINATOR IS THE SERVER'S `isDraft`, NOT `!!session`, AND THE
   DIFFERENCE IS AUTHORISATION. get-schedule-override.js sets isDraft only when
   it verified the token AND hasAgeGroupAccess() passed; anything short of that
   falls through to the published answer with isDraft false. Deriving the mode
   here from `isDraft` therefore inherits the server's decision for free — a
   manager asking for somebody else's age group is refused the draft and lands
   on 'published'/'none' with no client-side check needed.

   Deriving it from `!!session` instead would put every manager into a draft
   view for all fifteen groups, with `schedule` empty because the server
   withheld it — i.e. a SAMPLE badge over placeholder clubs, presented as that
   group's own work. ⚠️ It would also pass a hand-check by an organiser, who has
   access to everything and would never see the broken case. */
function viewModeOf(state) {
  if (state && state.isDraft) return state.schedule ? 'draft' : 'sample';
  if (!state || state.awaitingPublication) return 'none';
  return 'published';
}
export { viewModeOf };

const delay = (ms) => new Promise((r) => setTimeout(r, ms)); // small UI-friendly pause

function findAg(id) { return AGE_GROUPS.find((a) => a.id === id); }

/* ---------------- the draw: pools + match slots ----------------
   A "draw" is { pools:[{id,name,teams}], slots:[{id,poolId,home,away,startMins,pitch}] }.
   Slots are sorted by startMins wherever they're displayed — so editing
   a slot's time is all it takes to reorder it; there's no separate
   manual "order" to keep in sync.

   Each match: two 7-min halves + 3-min half-time + 3 min to next kick-off
   = a 20-minute slot, starting at 8:00am. Games are ordered greedily,
   always preferring the pairing whose two teams have rested longest; if
   every remaining game would repeat a team from the immediately previous
   slot, a rest slot is inserted so no team ever plays twice with zero
   break. This is only used to seed the STARTING slot list — once saved,
   an override's slots are just plain data. */
const SLOT_MINS = 20; // 7 + 3 + 7 + 3
const DAY_START_MINS = 8 * 60; // 8:00am

/* Both are exported because the Fixture Editor needs the same numbers to lay a
   pool out on a pitch: a pool is a run of matches SLOT_MINS apart, so its end
   time is start + matches x SLOT_MINS, and a pitch with nothing on it starts at
   DAY_START_MINS. Retyping 20 and 480 over there would let the editor's
   arithmetic drift from the generator's. */
export function slotLengthMins() { return SLOT_MINS; }
export function dayStartMins() { return DAY_START_MINS; }

/* The end of a run of `count` matches starting at `startMins`. Used for the
   "08:00-10:00" label on a pool and for the overlap test - two pools clash when
   they share a pitch and their [start, end) ranges intersect. */
export function poolEndMins(startMins, count) {
  return startMins + Math.max(0, count) * SLOT_MINS;
}

/* ============================================================
   THE WHOLE-WEEKEND CLASH CHECK
   ------------------------------------------------------------
   Every age group's draw is edited on its own, in its own blob, by its own
   manager. Nothing has ever looked across them — so two groups can be handed the
   same pitch at the same time and the first anyone knows is two squads walking
   onto D2 at 09:20.

   This turns a set of draws into BOOKINGS and reports every overlap. Two kinds of
   booking, because there are two kinds of fixture:

     - a POOL, which is a run of matches SLOT_MINS apart on one pitch, so one
       booking covering the whole run; and
     - a KNOCKOUT match, which stands alone with its own pitch and time, so one
       booking each.

   Deliberately NOT a clash:
     - anything on 'TBD' or no pitch. Unscheduled is not conflicting; it is
       reported separately as something still to do.
     - two bookings on one pitch at DIFFERENT times. That is a time-share, which
       is exactly how D4/D5 ran U5/6 in the morning and U7 in the afternoon.
     - bookings on different DAYS that happen to share a pitch name. B1a, D1 and
       D2 exist on both days and are completely unrelated bookings.
     - touching exactly: one ends 10:00, the next starts 10:00. Half-open ranges,
       so [08:00,10:00) and [10:00,12:00) do not overlap.

   Pure and synchronous on purpose — no fetching, no session, no clock — so it can
   be tested exhaustively. loadAllDraws() below does the fetching.
   ============================================================ */

/* One age group's fixtures -> its bookings. */
function bookingsForAge(agId, agName, draw, dayId) {
  if (!draw) return [];
  const out = [];
  const clean = (p) => (typeof p === 'string' ? p.trim() : '');

  (draw.pools || []).forEach((pool) => {
    const slots = (draw.slots || []).filter((sl) => sl.poolId === pool.id);
    if (!slots.length) return;
    const pitches = [...new Set(slots.map((sl) => clean(sl.pitch) || 'TBD'))];
    const startMins = Math.min(...slots.map((sl) => sl.startMins));

    /* A pool whose matches were split across pitches by hand is not one booking.
       Book each pitch separately, from its own earliest match, or a per-match move
       would silently escape the check. */
    if (pitches.length > 1) {
      pitches.forEach((p) => {
        const mine = slots.filter((sl) => (clean(sl.pitch) || 'TBD') === p);
        out.push({
          agId, agName, dayId, pitch: p, kind: 'pool',
          label: `${pool.name} (part)`,
          startMins: Math.min(...mine.map((sl) => sl.startMins)),
          endMins: poolEndMins(Math.min(...mine.map((sl) => sl.startMins)), mine.length),
          count: mine.length,
        });
      });
      return;
    }

    out.push({
      agId, agName, dayId, pitch: pitches[0], kind: 'pool', label: pool.name,
      startMins, endMins: poolEndMins(startMins, slots.length), count: slots.length,
    });
  });

  (draw.knockout || []).forEach((sl) => {
    if (sl.startMins == null) return;
    out.push({
      agId, agName, dayId, pitch: clean(sl.pitch) || 'TBD', kind: 'knockout',
      label: sl.round || 'Knockout match',
      startMins: sl.startMins, endMins: poolEndMins(sl.startMins, 1), count: 1,
    });
  });

  return out;
}

/* drawsByAge: { u11: draw, u13: draw, ... }. ageNames: { u11: 'U11 Mixed Contact' }.
   Returns { bookings, clashes, unplaced, offAllocation, placedCount }.

   `clashes` is every overlapping PAIR, once, sorted by day then pitch then time.
   `unplaced` and `offAllocation` are the two soft warnings: something with no
   pitch, and something on a pitch its age group is not allocated. Neither blocks
   anything; both are things a human should look at. */
export function weekendClashes(drawsByAge, ageNames) {
  const v = venue();
  const bookings = [];
  Object.keys(drawsByAge || {}).forEach((agId) => {
    const dayId = dayIdOfAgeGroup(agId);
    if (!dayId) return;   // not in the layout at all; the Venue tab flags that
    bookings.push(...bookingsForAge(agId, (ageNames || {})[agId] || agId.toUpperCase(),
      drawsByAge[agId], dayId));
  });

  const placed = bookings.filter((b) => b.pitch && b.pitch !== 'TBD');
  const key = (b) => b.dayId + '|' + b.pitch.toLowerCase();

  const clashes = [];
  const byPitch = new Map();
  placed.forEach((b) => {
    const k = key(b);
    if (!byPitch.has(k)) byPitch.set(k, []);
    byPitch.get(k).push(b);
  });
  byPitch.forEach((list) => {
    const sorted = list.slice().sort((a, b) => a.startMins - b.startMins);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        // Half-open ranges: touching exactly is not an overlap.
        if (sorted[j].startMins >= sorted[i].endMins) break;   // sorted, so no later one can overlap either
        clashes.push({
          dayId: sorted[i].dayId,
          dayLabel: (v[sorted[i].dayId] || {}).label || sorted[i].dayId,
          pitch: sorted[i].pitch,
          sameAgeGroup: sorted[i].agId === sorted[j].agId,
          a: sorted[i], b: sorted[j],
        });
      }
    }
  });
  clashes.sort((x, y) => (x.dayId < y.dayId ? -1 : x.dayId > y.dayId ? 1
    : x.pitch.localeCompare(y.pitch) || x.a.startMins - y.a.startMins));

  const unplaced = bookings.filter((b) => !b.pitch || b.pitch === 'TBD');

  const offAllocation = placed.filter((b) => {
    const allowed = pitchesForAgeGroup(b.agId).map((p) => p.toLowerCase());
    return allowed.length > 0 && !allowed.includes(b.pitch.toLowerCase());
  });

  return { bookings, clashes, unplaced, offAllocation, placedCount: placed.length };
}

/* Plain English for one clash, e.g.
   "Pitch C4 · Sunday — U13 Pool A (08:00 – 10:00) overlaps U16B Pool B (09:20 – 11:00)" */
export function describeClash(c) {
  const w = (b) => `${b.agName} ${b.label} (${fmtTime(b.startMins)} – ${fmtTime(b.endMins)})`;
  return `Pitch ${c.pitch} · ${c.dayLabel} — ${w(c.a)} overlaps ${w(c.b)}`;
}

/* Fetches every age group's draw so weekendClashes() has something to chew on.
   WHAT YOU GET DEPENDS ON WHO YOU ARE, and that is not a bug:
     - an ORGANISER's token reads every group's DRAFT, so the check sees work in
       progress across the whole tournament;
     - a MANAGER's token reads their own draft and everyone else's PUBLISHED draw
       (get-schedule-override falls through to the published copy when the token
       has no access to that group's draft).
   The manager's comparison is the right one anyway — published is what people are
   turning up for — but two managers editing unsaved drafts cannot see each other.
   Say so in the UI rather than implying the check is exhaustive. */
export async function loadAllDraws(session) {
  const ids = AGE_GROUPS.map((a) => a.id);
  const names = {};
  AGE_GROUPS.forEach((a) => { names[a.id] = a.name; });
  const drawsByAge = {};
  const failed = [];
  await Promise.all(ids.map(async (id) => {
    try {
      const d = await getDraw(id, session);
      if (d) drawsByAge[id] = d;
    } catch (err) {
      // One unreadable age group must not lose the other fourteen.
      failed.push(id);
    }
  }));
  return { drawsByAge, ageNames: names, failed };
}

function orderNoBackToBack(teams) {
  const remaining = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) remaining.push([teams[i], teams[j]]);
  return scheduleNoBackToBack(remaining, teams);
}

// U6/U7 are non-competitive festivals — instead of a full round robin
// (every team plays every other team once), each team plays a fixed 4
// matches. Teams are arranged in a circle and paired with their 1st and
// 2nd nearest neighbors on each side (a "circulant" pairing) — this gives
// every team exactly 4 opponents with no repeats, using far fewer total
// matches than a full round robin.
const FESTIVAL_MATCHES_PER_TEAM = 4;
function buildFestivalPairs(teams) {
  const n = teams.length;
  const half = Math.floor(FESTIVAL_MATCHES_PER_TEAM / 2);
  const seen = new Set();
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let d = 1; d <= half; d++) {
      const j = (i + d) % n;
      if (i === j) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
}
function orderFestivalNoBackToBack(teams) {
  return scheduleNoBackToBack(buildFestivalPairs(teams), teams);
}

// Shared greedy scheduler: given a flat list of [home,away] pairings and
// the full team list, orders them into slots — always preferring the
// pairing whose two teams have rested longest; if every remaining game
// would repeat a team from the immediately previous slot, inserts an
// empty rest slot instead of forcing a back-to-back match.
function scheduleNoBackToBack(pairsList, teams) {
  let remaining = pairsList.slice();
  const lastPlayedAt = {}; teams.forEach((t) => (lastPlayedAt[t] = -Infinity));
  const seq = []; // slot -> [home,away] or null (rest)
  let slot = 0;
  while (remaining.length) {
    const prev = slot > 0 ? seq[slot - 1] : null;
    const clashes = (g) => prev && (g[0] === prev[0] || g[0] === prev[1] || g[1] === prev[0] || g[1] === prev[1]);
    const candidates = remaining.filter((g) => !clashes(g));
    if (!candidates.length) { seq.push(null); slot++; continue; }
    candidates.sort((a, b) => {
      const restA = Math.min(slot - lastPlayedAt[a[0]], slot - lastPlayedAt[a[1]]);
      const restB = Math.min(slot - lastPlayedAt[b[0]], slot - lastPlayedAt[b[1]]);
      return restB - restA;
    });
    const g = candidates[0];
    seq.push(g);
    lastPlayedAt[g[0]] = slot; lastPlayedAt[g[1]] = slot;
    remaining = remaining.filter((x) => x !== g);
    slot++;
  }
  return seq;
}

function fmtTime(totalMins) {
  let h = Math.floor(totalMins / 60), m = totalMins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
// 24h "HH:MM" for <input type="time">.
function fmtTime24(totalMins) {
  const h = Math.floor(totalMins / 60) % 24, m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function parseTime24(hhmm) {
  const [h, m] = String(hhmm || '08:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function poolSlots(prefix, teams, useFestivalFormat) {
  const seq = useFestivalFormat ? orderFestivalNoBackToBack(teams) : orderNoBackToBack(teams);
  return seq
    .map((g, idx) => (g ? { id: `${prefix}:${idx}`, home: g[0], away: g[1], startMins: DAY_START_MINS + idx * SLOT_MINS, pitch: 'TBD' } : null))
    .filter(Boolean);
}

function buildDefaultDraw(ag) {
  const pools = (ag.pools || []).map((p) => ({ id: p.id, name: p.name, teams: [...p.teams] }));
  const slots = [];
  const useFestivalFormat = FESTIVAL_AGE_IDS.includes(ag.id);
  pools.forEach((p) => {
    poolSlots(`${ag.id}:${p.id}`, p.teams, useFestivalFormat).forEach((s) => slots.push({ ...s, poolId: p.id }));
  });
  return { pools, slots };
}

// Resolves the effective draw for an age group: a saved override if one
// exists, else the deterministic default built from AGE_GROUPS config.
async function resolveDraw(ag, override) {
  const draw = (override && Array.isArray(override.pools) && Array.isArray(override.slots))
    ? override
    : buildDefaultDraw(ag);
  /* Single choke point: every path that resolves a draw records its name map,
     so teamLabel can answer for this age group from here on. */
  rememberDrawNames(ag.id, draw);
  return draw;
}

function slotsForPool(draw, poolId) {
  return draw.slots.filter((s) => s.poolId === poolId).sort((a, b) => a.startMins - b.startMins);
}

/* ---------------- standings engine ---------------- */
// Applies: league points (4 win/walkover, 2 draw, 0 loss/no-show),
// then tie-breaks: margin → points-for → head-to-head(2) →
// least-conceded → mini-league(3+) → coin-toss flag.
function computeStandings(draw, store) {
  const rows = {};
  draw.pools.forEach((pool) => {
    rows[pool.id] = {};
    pool.teams.forEach((t) => {
      rows[pool.id][t] = { team: t, P: 0, W: 0, D: 0, L: 0, PF: 0, PA: 0, tries: 0, cards: 0, pts: 0 };
    });
  });

  draw.slots.forEach((fx) => {
    const res = store[fx.id];
    if (!res || res.homeScore == null || res.awayScore == null) return;
    const poolRows = rows[fx.poolId]; if (!poolRows) return;
    const h = poolRows[fx.home], a = poolRows[fx.away];
    if (!h || !a) return;
    let hs = Number(res.homeScore), as = Number(res.awayScore);
    if (res.walkover === 'home') { hs = WALKOVER_SCORE; as = 0; }
    if (res.walkover === 'away') { hs = 0; as = WALKOVER_SCORE; }
    h.P++; a.P++;
    h.PF += hs; h.PA += as; a.PF += as; a.PA += hs;
    h.tries += Number(res.homeTries || 0); a.tries += Number(res.awayTries || 0);
    h.cards += Number(res.homeCards || 0); a.cards += Number(res.awayCards || 0);
    if (res.walkover === 'home' || (res.walkover == null && hs > as)) { h.W++; a.L++; h.pts += 4; }
    else if (res.walkover === 'away' || (res.walkover == null && as > hs)) { a.W++; h.L++; a.pts += 4; }
    else { h.D++; a.D++; h.pts += 2; a.pts += 2; }
  });

  // head-to-head / mini-league margin between a subset of teams
  const miniStat = (teams, pool) => {
    const s = {}; teams.forEach((t) => (s[t] = { PF: 0, PA: 0, pts: 0 }));
    draw.slots.forEach((fx) => {
      if (fx.poolId !== pool) return;
      if (!teams.includes(fx.home) || !teams.includes(fx.away)) return;
      const r = store[fx.id]; if (!r || r.homeScore == null) return;
      let hs = Number(r.homeScore), as = Number(r.awayScore);
      if (r.walkover === 'home') { hs = WALKOVER_SCORE; as = 0; }
      if (r.walkover === 'away') { hs = 0; as = WALKOVER_SCORE; }
      s[fx.home].PF += hs; s[fx.home].PA += as; s[fx.away].PF += as; s[fx.away].PA += hs;
      if (hs > as) s[fx.home].pts += 4; else if (as > hs) s[fx.away].pts += 4; else { s[fx.home].pts += 2; s[fx.away].pts += 2; }
    });
    return s;
  };

  const tables = {};
  draw.pools.forEach((pool) => {
    let list = Object.values(rows[pool.id]).map((r) => ({ ...r, margin: r.PF - r.PA }));
    list.sort((x, y) => (y.pts - x.pts) || (y.margin - x.margin) || (y.PF - x.PF) || (x.PA - y.PA));

    // resolve remaining exact ties (pts,margin,PF,PA all equal) within groups
    const out = []; let i = 0;
    while (i < list.length) {
      let j = i; while (j + 1 < list.length && ['pts', 'margin', 'PF', 'PA'].every((k) => list[j + 1][k] === list[i][k])) j++;
      const group = list.slice(i, j + 1);
      if (group.length > 1) {
        const mini = miniStat(group.map((g) => g.team), pool.id);
        /* Named, because the coin-toss check below has to ask the SAME question
           the sort just asked: "did anything separate these two?" */
        const byMini = (x, y) => {
          if (group.length === 2) { // head-to-head (count-back)
            const d = (mini[y.team].pts - mini[x.team].pts); if (d) return d;
          }
          const mm = (mini[y.team].PF - mini[y.team].PA) - (mini[x.team].PF - mini[x.team].PA);
          if (mm) return mm;
          const mf = mini[y.team].PF - mini[x.team].PF; if (mf) return mf;
          return mini[x.team].PA - mini[y.team].PA;
        };
        group.sort(byMini);
        /* Still level after the mini-league → nothing in the rules separates
           them and the organiser tosses a coin.

           The old check re-compared pts/margin/PF/PA, which are identical for
           every member of this group BY CONSTRUCTION — that is how the group
           was formed — so it was always true. Two teams the head-to-head had
           in fact separated still got badged COIN TOSS. And it started at
           k = 1, so in a tied pair only the SECOND team was marked, reading as
           though the first had won something.

           Ask byMini instead — 0 means the tie-breaks could not split them —
           and badge the whole level run, first team included. `P > 0` on every
           member keeps unplayed teams (all zeros, so trivially "tied") out of
           it. */
        let a = 0;
        while (a < group.length) {
          let b = a; while (b + 1 < group.length && byMini(group[b + 1], group[a]) === 0) b++;
          if (b > a && group.slice(a, b + 1).every((g) => g.P > 0)) {
            for (let k = a; k <= b; k++) group[k].coinToss = true;
          }
          a = b + 1;
        }
      }
      out.push(...group); i = j + 1;
    }
    tables[pool.id] = out.map((r, idx) => ({ ...r, rank: idx + 1 }));
  });
  return tables;
}

/* ---------------- knockout generation ---------------- */
// Waterfall format: rank 1 in every pool plays off for the Cup, rank 2s
// for the Bowl, rank 3s for the Plate, rank 4s for the Shield. Each final
// is a single cross-pool match — no semis. A 5th-place team (odd pool
// sizes) sits out of the knockouts entirely.
function makeWrap(store) {
  return (id, home, away) => {
    const r = store[id] || {};
    let winner = null;
    if (r.homeScore != null && r.awayScore != null && home && away) {
      let hs = Number(r.homeScore), as = Number(r.awayScore);
      if (r.walkover === 'home') { hs = WALKOVER_SCORE; as = 0; } if (r.walkover === 'away') { hs = 0; as = WALKOVER_SCORE; }
      winner = hs >= as ? home : away;
    }
    return { id, stage: 'knockout', home, away, result: r.homeScore != null ? r : null, winner };
  };
}
function loserOf(m) {
  if (!m.winner || !m.home || !m.away) return null;
  return m.winner === m.home ? m.away : m.home;
}

// Flattens whichever bracket format this age group uses into a plain,
// editable list of knockout slots — the auto-seeded STARTING POINT for
// the Fixture Editor's "Knockout stage" section, and what every reader
// falls back to until a manager/organizer saves a custom override (see
// resolveKnockout).
function computeAutoKnockout(ag, draw, tables, store) {
  let maxEndMins = DAY_START_MINS;
  draw.slots.forEach((s) => { if (s.startMins + SLOT_MINS > maxEndMins) maxEndMins = s.startMins + SLOT_MINS; });

  if (SPECIAL_BRACKET_AGE_IDS.includes(ag.id)) {
    const db = buildU16BBracket(ag, draw, tables, store);
    const order = [
      { round: 'Top Bracket — Semi-Final 1', g: db.top.sf1 },
      { round: 'Top Bracket — Semi-Final 2', g: db.top.sf2 },
      { round: 'Bottom Bracket — Semi-Final 1', g: db.bottom.sf1 },
      { round: 'Bottom Bracket — Semi-Final 2', g: db.bottom.sf2 },
      { round: 'Cup Final', g: db.top.cup },
      { round: 'Bowl Final', g: db.top.bowl },
      { round: 'Plate Final', g: db.bottom.plate },
      { round: 'Shield Final', g: db.bottom.shield },
    ];
    return order.map((o, idx) => ({ id: o.g.id, round: o.round, home: o.g.home || '', away: o.g.away || '', startMins: maxEndMins + idx * SLOT_MINS, pitch: 'TBD' }));
  }

  const rounds = buildBracket(ag, draw, tables, store);
  const flat = rounds.flatMap((r) => r.games.map((g) => ({ round: r.round, g })));
  return flat.map((o, idx) => ({ id: o.g.id, round: o.round, home: o.g.home || '', away: o.g.away || '', startMins: maxEndMins + idx * SLOT_MINS, pitch: 'TBD' }));
}

// A saved override's `knockout` array (if present) takes over completely —
// same override philosophy as pools/slots. Otherwise auto-seeded from live
// standings, exactly like before this feature existed.
function resolveKnockout(ag, draw, override, tables, store) {
  if (override && Array.isArray(override.knockout)) return override.knockout;
  return computeAutoKnockout(ag, draw, tables, store);
}

function buildBracket(ag, draw, tables, store) {
  const pools = draw.pools || [];
  const wrap = makeWrap(store);

  // Pool standings aren't final (and finalists aren't real) until every
  // pool-stage fixture for this age group has a result — until then the
  // finals show as TBD v TBD rather than guessing from a 0-played table.
  const poolsComplete = draw.slots.every((fx) => store[fx.id] && store[fx.id].homeScore != null) && draw.slots.length > 0;

  if (pools.length === 2) {
    const A = tables[pools[0].id] || [];
    const B = tables[pools[1].id] || [];
    const tiers = [
      { name: 'Cup Final', code: 'CUP', rank: 0 },
      { name: 'Bowl Final', code: 'BOWL', rank: 1 },
      { name: 'Plate Final', code: 'PLATE', rank: 2 },
      { name: 'Shield Final', code: 'SHIELD', rank: 3 },
    ];
    const rounds = [];
    tiers.forEach((t) => {
      const home = poolsComplete ? (A[t.rank] && A[t.rank].team) : null;
      const away = poolsComplete ? (B[t.rank] && B[t.rank].team) : null;
      if (!poolsComplete && !(A[t.rank] || B[t.rank])) return; // tier doesn't exist at all (pool too small)
      rounds.push({ round: t.name, games: [wrap(`${ag.id}:${t.code}`, home, away)] });
    });
    return rounds;
  }

  // Four pools: each tier (Cup/Bowl/Plate/Shield) is the four teams that
  // finished at that rank in their own pool — Cup gets all four pool
  // winners, Bowl all four runners-up, and so on. Unlike the two-pool case
  // (a single cross-pool match settles a tier outright, since there are
  // only two candidates), four candidates need a semi round first. Pairing
  // is Pool A v Pool D and Pool B v Pool C — arbitrary, since all four
  // teams in a tier are equally-ranked finishers from DIFFERENT pools, so
  // none of them have met before and no pairing is more "fair" than another.
  if (pools.length === 4) {
    const [A, B, C, D] = pools.map((p) => tables[p.id] || []);
    const tiers = [
      { name: 'Cup', code: 'CUP', rank: 0 },
      { name: 'Bowl', code: 'BOWL', rank: 1 },
      { name: 'Plate', code: 'PLATE', rank: 2 },
      { name: 'Shield', code: 'SHIELD', rank: 3 },
    ];
    const rounds = [];
    tiers.forEach((t) => {
      const at = (list) => (poolsComplete && list[t.rank]) ? list[t.rank].team : null;
      if (!poolsComplete && ![A, B, C, D].some((list) => list[t.rank])) return; // tier doesn't exist (pool too small)
      const sf1 = wrap(`${ag.id}:${t.code}:SF1`, at(A), at(D));
      const sf2 = wrap(`${ag.id}:${t.code}:SF2`, at(B), at(C));
      const fin = wrap(`${ag.id}:${t.code}`, sf1.winner, sf2.winner);
      rounds.push({ round: `${t.name} — Semi-Final 1`, games: [sf1] });
      rounds.push({ round: `${t.name} — Semi-Final 2`, games: [sf2] });
      rounds.push({ round: `${t.name} Final`, games: [fin] });
    });
    return rounds;
  }

  // fallback for a single-pool age group: straight semis + final
  const t = tables[pools[0] ? pools[0].id : null] || [];
  const seeds = [];
  if (poolsComplete) for (let k = 0; k < Math.min(ag.advance, t.length); k++) seeds.push(t[k] && t[k].team);
  if (seeds.length >= 4) {
    const sf1 = wrap(`${ag.id}:SF1`, seeds[0], seeds[3]);
    const sf2 = wrap(`${ag.id}:SF2`, seeds[1], seeds[2]);
    const fin = wrap(`${ag.id}:FINAL`, sf1.winner, sf2.winner);
    return [{ round: 'Semi-finals', games: [sf1, sf2] }, { round: 'Final', games: [fin] }];
  } else if (seeds.length >= 2) {
    return [{ round: 'Final', games: [wrap(`${ag.id}:FINAL`, seeds[0], seeds[1])] }];
  }
  return [];
}

/* ---------------- Double-bracket special format ----------------
   Instead of the plain waterfall used by most age groups, the age groups
   in SPECIAL_BRACKET_AGE_IDS run two 4-team knockout brackets: the top 2
   finishers from each pool form the "Top Bracket" (semis → winners meet
   in the Cup Final, losers meet in the Bowl Final); the next 2 from each
   pool form the "Bottom Bracket" (semis → winners meet in the Plate
   Final, losers meet in the Shield Final). A pool's 5th-place team sits
   out. Semis are seeded cross-pool (A1 v B2, B1 v A2, etc.) to avoid an
   immediate pool-stage rematch. */
function buildU16BBracket(ag, draw, tables, store) {
  const wrap = makeWrap(store);
  const pools = draw.pools || [];
  const A = tables[pools[0] ? pools[0].id : null] || [];
  const B = tables[pools[1] ? pools[1].id : null] || [];
  const poolsComplete = draw.slots.every((fx) => store[fx.id] && store[fx.id].homeScore != null) && draw.slots.length > 0;
  const nameAt = (arr, i) => (poolsComplete && arr[i]) ? arr[i].team : null;

  const tsf1 = wrap(`${ag.id}:TSF1`, nameAt(A, 0), nameAt(B, 1)); // A1 v B2
  const tsf2 = wrap(`${ag.id}:TSF2`, nameAt(B, 0), nameAt(A, 1)); // B1 v A2
  const cup = wrap(`${ag.id}:CUP`, tsf1.winner, tsf2.winner);
  const bowl = wrap(`${ag.id}:BOWL`, loserOf(tsf1), loserOf(tsf2));

  const bsf1 = wrap(`${ag.id}:BSF1`, nameAt(A, 2), nameAt(B, 3)); // A3 v B4
  const bsf2 = wrap(`${ag.id}:BSF2`, nameAt(B, 2), nameAt(A, 3)); // B3 v A4
  const plate = wrap(`${ag.id}:PLATE`, bsf1.winner, bsf2.winner);
  const shield = wrap(`${ag.id}:SHIELD`, loserOf(bsf1), loserOf(bsf2));

  return { poolsComplete, top: { sf1: tsf1, sf2: tsf2, cup, bowl }, bottom: { sf1: bsf1, sf2: bsf2, plate, shield } };
}

/* ================= EXPORTED ASYNC API ================= */

export async function getAgeGroups() {
  await delay(60);
  return AGE_GROUPS.map(({ id, name, hasStandings }) => ({ id, name, hasStandings }));
}

// Public match-day timetable, shown on the main site (Quins JRT.dc.html).
export async function getSchedule(agId) {
  await delay(60);
  const ag = findAg(agId);
  if (!ag || !(ag.pools || []).length) return null;
  const state = await fetchOverrideState(agId);
  // Nothing published yet — the caller shows "coming soon" rather than a draw.
  if (state.awaitingPublication) return { awaitingPublication: true, pools: [], knockout: [] };
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const store = await readStore();
  // Score for a match id, mirroring the walkover rule the server applies (a
  // walkover is scored 20-0). Returns empty strings when nothing is entered
  // yet, so the fixtures list shows "home v away" until a result exists.
  const scoreOf = (id) => {
    const r = store[id];
    if (!r || r.homeScore == null) return { homeScore: '', awayScore: '', played: false };
    const hs = r.walkover === 'home' ? WALKOVER_SCORE : (r.walkover === 'away' ? 0 : Number(r.homeScore));
    const as = r.walkover === 'away' ? WALKOVER_SCORE : (r.walkover === 'home' ? 0 : Number(r.awayScore));
    return { homeScore: hs, awayScore: as, played: true };
  };

  const pools = draw.pools.map((p) => {
    const slots = slotsForPool(draw, p.id);
    // homeCode/awayCode ride alongside the display name — teamLabel() below
    // is a one-way trip (a code in, a readable name out), so anything that
    // wants the club's crest (keyed by code, not name — see teamLogoSrc())
    // needs the raw code kept around too, not reconstructed from the name.
    const games = slots.map((s) => ({
      home: teamLabel(s.home, ag.id), away: teamLabel(s.away, ag.id),
      homeCode: s.home, awayCode: s.away,
      time: fmtTime(s.startMins), pitch: s.pitch || 'TBD', ...scoreOf(s.id),
    }));
    return { id: p.id, name: p.name, games };
  });

  // Every age group that keeps standings (i.e. not the U6/U7 non-competitive
  // festivals) gets its knockout stage pre-listed here — the special
  // double-bracket format for SPECIAL_BRACKET_AGE_IDS (see
  // buildU16BBracket), or the plain Cup/Bowl/Plate/Shield waterfall
  // (buildBracket) for everyone else. A manager/organizer's saved override
  // (if any) always takes over via resolveKnockout.
  let knockout = null;
  if (ag.hasStandings) {
    const tables = computeStandings(draw, store);
    const slots = resolveKnockout(ag, draw, override, tables, store);
    knockout = slots.map((s) => ({ label: s.round, home: s.home || 'TBD', away: s.away || 'TBD', time: fmtTime(s.startMins), pitch: s.pitch || 'TBD', ...scoreOf(s.id) }));
  }

  return { ageGroup: { id: ag.id, name: ag.name }, pools, knockout };
}

/* `session` is optional and is what lets a manager or organiser see an
   unpublished draw — see viewModeOf(). A public caller passes nothing and gets
   exactly what it always got. ⚠️ Scores & Standings.dc.html (/scores) must keep
   passing nothing: it is a purely public page and a parent must never see a
   draft. Asserted in tests/test-scores-public.js. */
export async function getStandings(agId, session) {
  await delay(80);
  const ag = findAg(agId); if (!ag) return null;
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId, session)]);
  const view = viewModeOf(state);
  if (view === 'none') {
    return {
      ageGroup: { id: ag.id, name: ag.name, hasStandings: ag.hasStandings },
      awaitingPublication: true, view,
      _advance: ag.advance, pools: [], tables: {}, bracket: [], doubleBracket: null,
    };
  }
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const tables = ag.hasStandings ? computeStandings(draw, store) : {};
  const isSpecial = SPECIAL_BRACKET_AGE_IDS.includes(ag.id);
  const bracket = ag.hasStandings && !isSpecial ? buildBracket(ag, draw, tables, store) : [];
  const doubleBracket = ag.hasStandings && isSpecial ? buildU16BBracket(ag, draw, tables, store) : null;
  return { ageGroup: { id: ag.id, name: ag.name, hasStandings: ag.hasStandings }, view, _advance: ag.advance, pools: draw.pools || [], tables, bracket, doubleBracket };
}

export function supportsSpiritAward(agId) {
  return SPIRIT_AWARD_AGE_IDS.includes(agId);
}

// Tally of Spirit of Rugby Award nominations for one age group. Only
// counts "real" matches (both teams decided — TBD knockout slots don't
// count) that have a submitted result with a nominee attached. Once every
// real match for the age group has a result, `complete` is true and
// `winners` lists the player(s) with the most nominations (a tie produces
// more than one winner).
export async function getSpiritAward(agId, session) {
  if (!SPIRIT_AWARD_AGE_IDS.includes(agId)) return { supported: false };
  /* Session threaded through for the same reason as its caller — the tally is
     derived from getFixtures(), so without it the award card stayed empty for
     an unpublished group even to the manager who owns it. */
  const fixtures = await getFixtures(agId, session);
  const all = [...fixtures.pool, ...fixtures.knockout];
  const real = all.filter((fx) => fx.home && fx.away);
  const totalMatches = real.length;
  const playedMatches = real.filter((fx) => fx.result && fx.result.homeScore != null).length;
  const complete = totalMatches > 0 && playedMatches === totalMatches;

  const counts = {};
  const teams = {}; // nominee name -> team they were nominated for (from the fixture)
  real.forEach((fx) => {
    if (!fx.result) return;
    [
      [fx.result.spiritNomineeHome, fx.home],
      [fx.result.spiritNomineeAway, fx.away],
    ].forEach(([name, team]) => {
      if (!name) return;
      const key = name.trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
      if (!teams[key]) teams[key] = team;
    });
  });
  const tally = Object.entries(counts)
    .map(([name, count]) => ({ name, count, team: teams[name] || '' }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const topCount = tally.length ? tally[0].count : 0;
  const winners = complete && topCount > 0 ? tally.filter((t) => t.count === topCount).map((t) => ({ name: t.name, team: t.team })) : [];

  return { supported: true, totalMatches, playedMatches, complete, tally, winners };
}

/* `session` is optional — see the note on getStandings() and viewModeOf().
   ⚠️ This is also what the score sheet's match list is built from, so passing
   the session is what lets a score be entered before the draw is published. */
export async function getFixtures(agId, session) {
  await delay(80);
  const ag = findAg(agId); if (!ag) return [];
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId, session)]);
  const view = viewModeOf(state);
  if (view === 'none') return { awaitingPublication: true, view, pool: [], knockout: [] };
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const pool = draw.slots.map((fx) => ({
    ...fx, ageGroupId: ag.id, stage: 'pool',
    home: teamLabel(fx.home, ag.id), away: teamLabel(fx.away, ag.id),
    poolName: (draw.pools.find((p) => p.id === fx.poolId) || {}).name,
    time: fmtTime(fx.startMins), result: store[fx.id] || null,
  })).sort((a, b) => a.startMins - b.startMins);
  const tables = computeStandings(draw, store);
  const knockoutSlots = resolveKnockout(ag, draw, override, tables, store);
  const knockout = knockoutSlots.map((s) => ({
    id: s.id, stage: 'knockout', round: s.round,
    /* Pool teams are run through teamLabel() a few lines up; knockout slots
       were not. With a draw that carries full club names, the pool rows read
       "AD Harlequins 1" while the knockout read "Abu Dhabi Harlequins 1".
       teamLabel maps a code to its name AND shortens "Abu Dhabi" for any club,
       and is idempotent, so it is safe to apply to either form. Display only:
       the fixture editor reads getDraw(), not this. */
    home: s.home ? teamLabel(s.home, ag.id) : null, away: s.away ? teamLabel(s.away, ag.id) : null,
    pitch: s.pitch || 'TBD',
    result: store[s.id] || null,
  }));
  return { pool, knockout, view };
}

/* THE team display-name rule, as a plain function (added Aug 2026 for the
   /organizer simulate tools): club name minus the RFC-style suffixes,
   numbered only when the club has more than one side in THIS age group —
   "Abu Dhabi Harlequins 1" when they entered three, plain "Barrelhouse"
   when they entered one. Scoped to one age group because a team code is
   only unique within its group. Reads ONLY club / teamName / ageGroup —
   the contact columns sit in the same rows and must never reach a draw.
   Manager.dc.html carries its own component-scoped copy of this rule
   (teamNamesFromRegistrations) predating this export; if either changes,
   change both — test-manager-dc-draw.js pins the behaviour there. */
export function teamNamesFromRegs(regTeams, agName) {
  const nm = String(agName || '').trim().toLowerCase();
  if (!nm) return {};
  const src = (regTeams || []).filter((r) => String(r.ageGroup || '').trim().toLowerCase() === nm);
  const perClub = {};
  src.forEach((r) => { const c = String(r.club || '').trim(); perClub[c] = (perClub[c] || 0) + 1; });
  const out = {};
  src.forEach((r) => {
    const code = String(r.teamName || '').trim();
    const rawClub = String(r.club || '').trim();
    const club = rawClub.replace(/\b(RFC|Rugby Football Club|Rugby Club)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (!code || !club) return;
    const n = (code.match(/(\d+)$/) || [])[1];
    out[code] = (perClub[rawClub] > 1 && n) ? (club + ' ' + n) : club;
  });
  return out;
}

/* -------- Fixture Editor (drag teams into pools/slots, edit times) --------
   Only available to a signed-in manager (their own age group, or the
   "admin" invite code) or an organizer (any age group) — enforced again
   server-side in save-schedule-override.js. */
export async function getDraw(agId, session) {
  const ag = findAg(agId); if (!ag) return null;
  // Editor works on the draft, so pass the session through.
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId, session)]);
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const tables = computeStandings(draw, store);
  const knockout = resolveKnockout(ag, draw, override, tables, store);
  // Deep copy so the editor can freely mutate its working draft.
  return JSON.parse(JSON.stringify({
    pools: draw.pools, slots: draw.slots, knockout,
    pitches: draw.pitches || [],
    _publish: {
      published: state.published,
      publishedAt: state.publishedAt,
      publishedBy: state.publishedBy,
      managerCanPublishNow: state.managerCanPublishNow,
    },
  }));
}

// Recomputes what the knockout stage would auto-seed to RIGHT NOW from
// live standings, ignoring any saved knockout override — used by the
// editor's "Regenerate from standings" button.
export async function autoKnockoutSlots(agId, session) {
  const ag = findAg(agId); if (!ag) return [];
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId, session)]);
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const tables = computeStandings(draw, store);
  return JSON.parse(JSON.stringify(computeAutoKnockout(ag, draw, tables, store)));
}

export function regeneratePoolSlots(agId, poolId, teams) {
  return poolSlots(`${agId}:${poolId}:new${Date.now()}`, teams, FESTIVAL_AGE_IDS.includes(agId)).map((s) => ({ ...s, poolId }));
}

export function timeToMinutes(hhmm) { return parseTime24(hhmm); }
export function minutesToTimeInput(mins) { return fmtTime24(mins); }
export function minutesToDisplay(mins) { return fmtTime(mins); }

export async function saveDraw(agId, draw, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  /* teamNames MUST be in this list. It is an allow-list, not a passthrough, so
     anything missing here is dropped before the request is even sent - the
     server stores whatever it is handed and never sees the field.

     Leaving it out meant the map written by "Import registered teams" lived
     only in the editor's memory and vanished on save. Every code that is not in
     the hardcoded nine-name TEAM_NAMES fallback then rendered as a raw code on
     the public standings: a pool read "AD Harlequins 1, DS2, Dubai Hurricanes 1,
     DW1". With real registrations that is roughly half of every pool showing
     parents a code instead of a club name. */
  const payload = {
    pools: draw.pools,
    slots: draw.slots,
    knockout: draw.knockout,
    pitches: draw.pitches || [],
    teamNames: draw.teamNames || {},
  };
  const r = await tryFetchJson('/.netlify/functions/save-schedule-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, schedule: payload }),
  });
  if (r.real) return r.json;
  return (await local()).saveScheduleOverride(session.token, agId, payload, false);
}

/* -------- Publishing --------
   Saving a draw only writes the draft. These two are what put fixtures in
   front of parents, and take them back down again.

   Permission is re-checked server-side in publish-schedule.js: organisers any
   time, managers only on the tournament days (14-15 Nov 2026) and only for
   their own age group. The UI uses canPublishNow() to decide whether to show
   the button as enabled, but the server is the authority. */
export async function publishDraw(agId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/publish-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, action: 'publish' }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Publishing needs the live site.' };
}

export async function unpublishDraw(agId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/publish-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, action: 'unpublish' }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Publishing needs the live site.' };
}

/* Cosmetic only — mirrors the server rule so the UI can explain itself
   before the user clicks. publishState comes from getDraw()._publish. */
export function canPublishNow(session, publishState) {
  if (!session) return false;
  if (isOrganizerSession(session)) return true;
  return !!(publishState && publishState.managerCanPublishNow);
}

/* An organiser session reaches this file in more than one shape depending on
   where it came from: currentSession() above builds { isOrganizer: true } from
   the organizer app's stored session, while login.js returns an object
   carrying _role (and `role` holding their job title, not a role name).
   Check all of them — missing one silently hides the Publish button, which is
   exactly what happened the first time. The server re-checks properly from the
   signed token, so this is only about what the UI offers. */
export function isOrganizerSession(session) {
  if (!session) return false;
  return !!(
    session.isOrganizer ||
    session._role === 'organizer' ||
    session.role === 'organizer'
  );
}

export async function resetDraw(agId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/save-schedule-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, reset: true }),
  });
  if (r.real) return r.json;
  return (await local()).saveScheduleOverride(session.token, agId, null, true);
}

// Sign-in, either role — ONE call to the unified endpoint
// (netlify/functions/login.js), which decides the role from the account
// itself. The old two-step fallback (try manager-login, then
// organizer-login, then write to the OTHER data layer's key) is gone; that
// chain only existed because each endpoint had a role filter.
export async function login(username, password) {
  const r = await tryFetchJson('/.netlify/functions/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  let json;
  if (r.real) {
    json = r.json;
  } else {
    // Local preview only — the stand-in backend still has per-role logins,
    // so try both, manager first (the common case on these pages).
    const lb = await local();
    json = await lb.managerLogin({ username, password });
    if (!json.ok) json = await lb.organizerLogin({ username, password });
  }
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Hand organizer sessions back in the same wrapped shape callers have
    // always received from this function.
    return {
      ok: true,
      session: isOrganizerSession(session)
        ? { token: session.token, username: session.username, name: session.name, ageGroupId: '*', isOrganizer: true }
        : session,
    };
  }
  return { ok: false, error: json.error || 'Incorrect username or password.' };
}

// Self-signup, either role (the /signin page's Create-account flows). A
// manager's age group is decided entirely by which invite code was entered
// (see manager-signup.js); an organizer signup takes the admin invite code
// and an optional free-text title. The signup ENDPOINTS stay per-role — the
// invite-code semantics genuinely differ — this just picks the right one.
export async function signup({ role = 'manager', name, title, username, password, inviteCode }) {
  const endpoint = role === 'organizer' ? 'organizer-signup' : 'manager-signup';
  const r = await tryFetchJson('/.netlify/functions/' + endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(role === 'organizer'
      ? { name, title, username, password, inviteCode }
      : { name, username, password, inviteCode }),
  });
  const json = r.real ? r.json : (role === 'organizer'
    ? (await local()).organizerSignup({ name, title, username, password, inviteCode })
    : (await local()).managerSignup({ name, username, password, inviteCode }));
  if (json.ok && json.pending) return { ok: true, pending: true, message: json.message };
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }
  return { ok: false, error: json.error || 'Could not create account.' };
}

// Reads whichever session is present — a manager session from this page,
// OR (so an organizer doesn't have to sign in twice) an Organizer session
// from Organizer.dc.html. Organizers get full (ageGroupId:'*') access,
// same as the master admin manager account, re-verified server-side from
// the token's own role either way.
// Shared session-permission checks. Used by app.html and Manager.html so
// "can this signed-in person score this age group" has exactly one
// definition, not two copies that can quietly drift apart. An organiser or
// the '*' admin-manager account can act on any age group; a normal manager
// only their own.
export function isOrganiserSession(s) {
  return !!(s && (s.isOrganizer || s._role === 'organizer' || s.role === 'organizer'));
}
export function canScoreAgeGroup(s, agId) {
  return !s ? false : (isOrganiserSession(s) || s.ageGroupId === '*' || s.ageGroupId === agId);
}

/* One-time move from the two pre-Aug-2026 keys to the unified one, so
   NOBODY is signed out by the change. The organizer key wins when someone
   holds both — the broader role, the same preference app.html's old
   resolveSession() encoded. Malformed JSON in an old key reads as absent
   (never a throw) and is still cleaned up. Runs before every session read;
   after the first call it is a single getItem. */
export function migrateSession() {
  try { if (localStorage.getItem(SESSION_KEY)) return; } catch (e) { return; }
  const read = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const v = raw ? JSON.parse(raw) : null;
      return v && v.token ? v : null;
    } catch (e) { return null; }
  };
  const winner = read(OLD_ORG_SESSION_KEY) || read(OLD_MANAGER_SESSION_KEY);
  if (winner) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(winner)); } catch (e) {} }
  try { localStorage.removeItem(OLD_ORG_SESSION_KEY); } catch (e) {}
  try { localStorage.removeItem(OLD_MANAGER_SESSION_KEY); } catch (e) {}
}

export function currentSession() {
  migrateSession();
  let s = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    s = raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
  if (!s || !s.token) return null;
  // Organizer sessions are handed to manager-side callers in the wrapped
  // all-age-groups form, exactly as before unification.
  if (isOrganizerSession(s)) return { token: s.token, username: s.username, name: s.name, ageGroupId: '*', isOrganizer: true };
  return s;
}
/* Clears the old keys too — a stale pre-migration copy must never resurrect
   a signed-in state after an explicit sign-out. */
export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  try { localStorage.removeItem(OLD_MANAGER_SESSION_KEY); } catch (e) {}
  try { localStorage.removeItem(OLD_ORG_SESSION_KEY); } catch (e) {}
}

// Google sign-in, either role. For an EXISTING Google-linked account the
// role sent here is irrelevant — google-auth.js matches on the verified
// googleSub and answers with the account's own stored role. The role only
// matters on first-time signup, where it decides which invite-code gate the
// request goes through; Google supplies a verified identity, never a role
// or an age group.
export async function googleAuth({ idToken, role = 'manager', inviteCode, username, name, title }) {
  const r = await tryFetchJson('/.netlify/functions/google-auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, role, inviteCode, username, name, title }),
  });
  const json = r.real ? r.json : (await local()).googleAuth({ idToken, role, inviteCode, username, name, title });
  if (json.ok && json.needsSignup) return { ok: true, needsSignup: true, name: json.name };
  if (json.ok && json.pending) return { ok: true, pending: true, message: json.message };
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }
  return { ok: false, error: json.error || 'Could not sign in with Google.' };
}

/* ---- Your own account (my-account.js, added 3 Aug 2026) -------------------
   BOTH ROLES. The endpoint's door is any valid session, not an organiser one,
   which is why these live here in the shared layer rather than in
   organizer-data.js — /manager needs them just as much as /organizer, and a
   manager could not previously even change their own password.
   Design: claude/specs/spec-my-account.md */

async function myAccountPost(body, failMsg) {
  const session = currentSession();
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/my-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify(body),
  });
  if (r.real) return r.json;
  return { ok: false, error: failMsg };
}

// Your own account's safe fields. Never carries passwordHash or googleSub —
// the server strips both; signInMethod is the derived answer the card needs.
export async function myAccount() {
  const session = currentSession();
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/my-account', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${session.token}` },
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Your account details need the deployed site (not available in local preview).' };
}

/* ===== CHECKING THE SESSION IS STILL GOOD, ONCE, AT BOOT =================
   Spec: claude/specs/spec-session-refusal-aug-2026.md

   ⚠️ WHY THIS EXISTS, AND IT IS THE HALF THAT WAS MISSING. noteSessionEnded()
   signs somebody out when a request is REFUSED — but /manager makes no request
   that can be refused. Measured: on load it calls scoring-rules (GET, no auth
   at all) and venue-layout (GET, optionalSession, which deliberately answers as
   the public and never marks a session ended). So the dashboard booted, both
   calls succeeded exactly as they would for an anonymous visitor, and the dead
   token in localStorage was never questioned. A revoked person's page only told
   the truth when they happened to touch something strict.

   That was shipped, and found by Jay reloading the page and still being in. The
   mechanism was verified without checking whether it ever FIRES on the page it
   was written for.

   ⚠️ IT ASKS ONLY WHEN THERE IS SOMETHING TO ASK ABOUT. A signed-out visitor
   has no token, so there is nothing to verify and an authenticated call would
   be pure waste on every public page load.

   ⚠️ IT SWALLOWS EVERYTHING, AND THAT IS DELIBERATE. This runs during boot. A
   throw here would take the whole dashboard down over a check that is only a
   nicety when the session is FINE — and the refusal it exists to catch is
   handled inside tryFetchJson, not by anything returned here. Nothing reads
   the result on purpose: a caller tempted to branch on it would be re-deciding,
   badly, something noteSessionEnded has already decided correctly.

   ⚠️ IT CANNOT LOCK ANYONE OUT. Signing out happens only on the sessionEnded
   marker, so a store outage (503) or a dead network leaves the session exactly
   where it was — which matters on a tournament morning far more than this check
   does. */
export async function verifySession() {
  const session = currentSession();
  if (!session || !session.token) return;
  try { await myAccount(); } catch (e) { /* boot must survive anything */ }
}

/* Change your OWN password. The current one is required and checked against the
   stored hash server-side — a stolen session must not be enough to lock the
   real owner out. */
export async function changeMyPassword(currentPassword, password) {
  return myAccountPost({ action: 'password', currentPassword, password },
    'Changing your password needs the deployed site (not available in local preview).');
}

/* Attach a Google identity to the account you are signed in as, so the Google
   button works next time. You prove both halves: the account by holding a
   session for it, the identity by producing a valid token for it. The server
   refuses an identity already on another login, and refuses to REPLACE one
   rather than silently moving it — see the spec for why. */
export async function linkGoogle(idToken) {
  return myAccountPost({ action: 'linkGoogle', idToken },
    'Linking a Google account needs the deployed site (not available in local preview).');
}

// The Client ID the page needs to render the Google button — see
// netlify/functions/google-config.js. null means Google sign-in isn't
// configured (local preview, or GOOGLE_CLIENT_ID not set yet in Netlify).
export async function googleClientId() {
  const r = await tryFetchJson('/.netlify/functions/google-config', { method: 'GET' });
  if (!r.real) return null;
  return (r.json && r.json.clientId) || null;
}

// Registrations for the signed-in manager's OWN age group (teams + players,
// including medical notes and emergency contacts — a manager is responsible
// for player safety in their group). The server (get-my-registrations.js)
// decides the group from the login token, so this can only ever return the
// caller's own group; organizers and the '*' admin-manager get every group.
export async function getMyRegistrations(session) {
  session = session || currentSession();
  if (!session || !session.token) return { teams: [], players: [], scope: '' };
  const r = await tryFetchJson('/.netlify/functions/get-my-registrations', {
    headers: { 'Authorization': `Bearer ${session.token}` },
  });
  if (r.real) {
    return r.json.ok
      ? { teams: r.json.teams || [], players: r.json.players || [], scope: r.json.scope || '' }
      : { teams: [], players: [], scope: '' };
  }
  // Local preview fallback: filter the shared sample down to this manager's
  // group so the screen still demonstrates before the site is deployed.
  try {
    const sample = (await local()).sampleRegistrations();
    if (!session.ageGroupId || session.ageGroupId === '*') return { ...sample, scope: 'all' };
    const name = (AGE_GROUPS.find((a) => a.id === session.ageGroupId) || {}).name || '';
    const keep = (row) => String(row.ageGroup || '').trim().toLowerCase() === name.toLowerCase();
    return { teams: (sample.teams || []).filter(keep), players: (sample.players || []).filter(keep), scope: name };
  } catch (e) { return { teams: [], players: [], scope: '' }; }
}

// Submits one match result. Backed by netlify/functions/submit-result.js,
// which re-verifies the signed-in manager/organizer's age-group access
// server-side before writing — the check here is just for instant UI
// feedback.
/* Removes a result entirely, so the match goes back to unplayed. Distinct
   from saving 0-0, which is a real draw worth two league points each. */
/* ============================================================
   CLEARING TEST DATA
   ------------------------------------------------------------
   The tournament was rehearsed end to end on real infrastructure: 255 invented
   teams, 3,825 invented players and 415 invented results, with all 15 age groups
   published. That is what surfaced most of the bugs now fixed. It also means the
   live site is currently showing fiction, and it has to come back out.

   allResults() exists so the clean-up can enumerate EVERY stored result id,
   including ORPHANS — ids left behind when a pool was regenerated and its
   matches were re-minted with new ids. Reading the current draw would miss those
   entirely, which is exactly how they came to accumulate unnoticed.

   Nothing here deletes anything by itself. Removal goes one match at a time
   through clearResult() -> submit-result.js, so it uses the same write-and-verify
   path as a real score: each removal is written, read back and confirmed. A bulk
   endpoint that emptied a blob in one shot would be faster and much easier to get
   catastrophically wrong.

   Worth knowing before pressing anything: the legacy 'all' blob is never written
   and never deleted (see netlify/functions/_results.js). A group's own blob takes
   precedence over it, so a cleared result STAYS cleared — but the original
   recording of it survives in 'all'. This operation is recoverable by anyone with
   blob access, which is a large part of why it is safe to offer at all. */
export async function allResults() {
  return readStore();
}

/* The age group a match id belongs to. Every id is `<ageGroupId>:...`, which is
   also how the backend derives the group it re-checks permission against — see
   submit-result.js. Kept here so the clean-up and the app agree. */
export function ageGroupOfMatch(matchId) {
  return String(matchId || '').split(':')[0];
}

export async function clearResult(matchId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/submit-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ matchId, data: { clear: true } }),
  });
  if (r.real) return r.json;
  return (await local()).submitResult(session.token, matchId, { clear: true });
}

export async function submitResult(matchId, data, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const agId = matchId.split(':')[0];
  if (session.ageGroupId !== '*' && session.ageGroupId !== agId) return { ok: false, error: 'You can only enter scores for your own age group.' };
  const r = await tryFetchJson('/.netlify/functions/submit-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ matchId, data }),
  });
  if (r.real) return r.json;
  return (await local()).submitResult(session.token, matchId, data);
}

/* Test-only. buildBracket()/computeAutoKnockout() are pure functions (no
   fetch, no document) — exporting them lets a Node test call the REAL
   bracket-building code directly instead of re-describing its behaviour in
   a hand-rolled mock. Nothing in the browser app imports these names; they
   exist purely so a test isn't limited to asserting through the network-
   backed async wrappers. */
export { buildBracket, computeAutoKnockout };

/* ===================================================================
   DOCUMENTS SHARED WITH MANAGERS (Aug 2026)
   ===================================================================
   Spec: claude/specs/spec-documents.md

   These two live HERE, and organizer-data.js re-exports them, because
   /manager reads scores-data.js only. The organiser-only actions (upload,
   edit, delete, restore, purge) live in organizer-data.js instead — a
   manager page must not even carry the function names, which
   tests/test-documents.js asserts BY NAME.

   ⚠️ THE SERVER IS THE AUTHORITY ON WHO SEES WHAT. Nothing here filters by
   age group: the function does it from the verified token. A client-side
   filter is not a filter — that is written down in this project already,
   about the pool dropdown, where narrowing the options in the page did
   nothing because the server never validated the value. */

/* The list this session is allowed to see, newest first.

   ⚠️ IT RETURNS `unavailable` RATHER THAN AN EMPTY LIST ON FAILURE, and the
   pages render a different sentence for each. "No documents yet" and "could
   not load documents" are different facts, and this codebase has conflated
   them three times — clubsUnavailable on the Clubs tab is the same lesson. */
export async function listDocuments(opts) {
  const session = currentSession();
  if (!session || !session.token) return { ok: false, documents: [], unavailable: true };
  const qs = (opts && opts.deleted) ? '?action=list&deleted=1' : '?action=list';
  const r = await tryFetchJson(`/.netlify/functions/documents${qs}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${session.token}` },
  });
  if (r.real) return r.json;
  return { ok: false, documents: [], unavailable: true };
}

/* Fetch one document's bytes and hand the browser a download.

   The function answers base64 inside JSON rather than raw bytes, because the
   request has to carry a Bearer token and an <a download> cannot set a
   header. The alternative — a signed one-time URL — is a second permission
   mechanism to get wrong, and the whole point of the download going through
   a function is that the tags are checked EVERY time. */
/* Fetch one document and hand back a BLOB URL for it.
 *
 * ⚠️ ONE DECODER, TWO CALLERS. Download and the embedded viewer both need the
 * same bytes; two copies of the base64 -> Blob dance would be two places to
 * get the MIME type or the revoke wrong. This is that one place, added when
 * the viewer landed (7 Aug 2026).
 *
 * The function answers base64 inside JSON rather than raw bytes, because the
 * request has to carry a Bearer token and neither <a download> nor <iframe
 * src> can set a header. The alternative — a signed one-time URL — is a
 * second permission mechanism to get wrong, and the whole point of going
 * through a function is that the tags are checked EVERY time.
 *
 * ⚠️ THE CALLER OWNS THE URL AND MUST REVOKE IT. An object URL holds its
 * bytes until it is revoked or the tab closes; the viewer revokes on close
 * and the download revokes on a timer (revoking in the same tick cancels the
 * download in Safari). */
export async function fetchDocumentBlob(id) {
  const session = currentSession();
  if (!session || !session.token) return { ok: false, error: 'Please sign in.' };
  const r = await tryFetchJson(
    `/.netlify/functions/documents?action=download&id=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
  if (!r.real) return { ok: false, error: 'That needs the deployed site (not available in local preview).' };
  if (!r.json || !r.json.ok) return r.json || { ok: false, error: 'That document is not available.' };
  try {
    const bin = atob(r.json.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const type = r.json.contentType || 'application/octet-stream';
    return {
      ok: true,
      url: URL.createObjectURL(new Blob([bytes], { type })),
      contentType: type,
      filename: r.json.filename || 'document',
    };
  } catch (err) {
    return { ok: false, error: 'That file could not be opened.' };
  }
}

/* Fetch a document and click it, so the browser saves it. */
export async function downloadDocument(id) {
  const r = await fetchDocumentBlob(id);
  if (!r.ok) return r;
  try {
    const a = document.createElement('a');
    a.href = r.url;
    a.download = r.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* Revoked on a timer rather than immediately — revoking in the same tick
       cancels the download in Safari. */
    setTimeout(() => URL.revokeObjectURL(r.url), 10000);
    return { ok: true };
  } catch (err) {
    URL.revokeObjectURL(r.url);
    return { ok: false, error: 'That file could not be opened.' };
  }
}
