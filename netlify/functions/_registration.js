// netlify/functions/_registration.js
//
// WHEN THE REGISTRATION FORMS ARE OPEN.
//
// Two levers used to be one. "The site is public" and "clubs can register" are
// different decisions on different dates: the site goes public around 45 days
// out (removing the Netlify site password — a platform setting, no code), and
// registration opens later and CLOSES again before the tournament so the squads
// are fixed while the draw is built.
//
// Until now the second one was `registrationOpen`, a hardcoded prop on the
// homepage defaulting to true. Changing it cost a production deploy. The dates
// will move, and moving them must not need a deploy — so they live here, in a
// blob an organiser edits from the back office.
//
// TWO DECISIONS TAKEN IN THE DESIGN, both worth keeping:
//
//   1. Times are ABU DHABI time, not the visitor's. The rest of this codebase
//      builds dates with `new Date(2026, 7, 31)`, which is browser-local — so
//      "opens 8 October" would be a different instant for a club in the UK than
//      for one in Dubai. Every stamp stored here carries an explicit +04:00. A
//      deadline for an Abu Dhabi tournament is an Abu Dhabi deadline.
//
//   2. The browser decides what to SHOW; the server decides what to ACCEPT.
//      Anyone can change their clock and make the form appear. That is fine,
//      because the submission still has to get past the gateway. NOTE: that
//      gateway does not exist yet (sub-project 1). Right now this is display
//      only, which is sufficient while the whole site sits behind a Netlify
//      password — but do not mistake it for enforcement.
//
// DEFAULTS ONLY, like _venue.js and _scoring.js. The override is stored in the
// `config` blob store at key `registration`.

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
  const lead = 'Every player takes home a medal and every family is welcome. ';

  if (st.open) {
    return {
      pill: closes ? `REGISTRATION CLOSES ${closes.toUpperCase()}` : 'REGISTRATION NOW OPEN',
      blurb: lead + (closes
        ? `Registration closes at the end of ${closes} — sign up your club or player below.`
        : 'Registration is open — sign up your club or player below.'),
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
      blurb: lead + `Registration opens on ${opens} — check back then to enter your club.`,
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

/* What a saved blob is allowed to become. mergeVenue() replaces a day WHOLESALE
   because merging its pitch list would make removing a pitch impossible — the
   default would keep putting it back. That trap does not exist here: there are
   no lists, and null is already the default for both dates, so there is no value
   a field-by-field fallback could make unreachable. Field-by-field it is, and a
   half-written blob still yields a usable (closed) answer. */
function mergeSettings(saved) {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_REGISTRATION };
  return {
    opensAt:  typeof saved.opensAt  === 'string' && saved.opensAt  ? saved.opensAt  : null,
    closesAt: typeof saved.closesAt === 'string' && saved.closesAt ? saved.closesAt : null,
    mode: REGISTRATION_MODES.indexOf(saved.mode) >= 0 ? saved.mode : 'auto',
  };
}

/* NO CACHE, and that is the difference from _venue.js. The layout is read on
   every fixtures request, so caching it per instance buys real work back. This
   blob is read once per homepage view, and it is the thing that decides whether
   a form is open — a warm instance serving dates an organiser changed ten
   minutes ago is a worse trade than one extra blob get. */
async function loadRegistration(blobStore) {
  try {
    return mergeSettings(await blobStore('config').get('registration', { type: 'json' }));
  } catch (err) {
    // A config read failing must never take the homepage down with it. Falling
    // back to the defaults means falling back to CLOSED, which is the safe end.
    console.warn('_registration: could not read the saved window, using defaults -', err && err.message);
    return { ...DEFAULT_REGISTRATION };
  }
}

module.exports = {
  REGISTRATION_MODES, DEFAULT_REGISTRATION, REGISTRATION_TZ_OFFSET,
  isRealDate, stampFromDate, dateOfStamp, parseStamp, fmtWindowDate, registrationState, registrationCopy, fmtCountdown,
  mergeSettings, loadRegistration, validateSettings, registrationWarnings,
};
