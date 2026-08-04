// netlify/functions/_intake.js
//
// What happens to a registration between arriving and being stored: the sheet
// column order, the row builders, and the readers that turn a row back into the
// shape /organizer displays.
//
// ---------------------------------------------------------------------
// DEPENDENCY-FREE ON PURPOSE.
// ---------------------------------------------------------------------
// Nothing here requires googleapis, @netlify/blobs or bcryptjs. A fresh clone
// has no node_modules, so anything that reaches for a package cannot be
// required by a test at all — which is exactly why _password.js was split out
// of _auth.js. The real Sheets client is built by the caller and the rows are
// handed over as plain arrays.
//
// ---------------------------------------------------------------------
// WHY THIS FILE EXISTS AT ALL.
// ---------------------------------------------------------------------
// Until 28 July 2026 the column order was hardcoded THREE times, in three
// files, kept in step by hand:
//
//   submission-created.js    the writer, a positional array
//   get-registrations.js     TEAM_FIELDS + a positional destructure
//   get-my-registrations.js  the same, duplicated verbatim
//
// Each file was individually consistent, so a one-column drift between them
// would have looked correct in review and shown a parent's phone number in the
// emergency-contact box. The sheet is what somebody rings from at a tournament.
//
// The round-trip test — write a registration, read it back, get the same thing
// — is the check that catches that, and it could not be written at all while
// the two halves lived in different files.

const { squadCap, AGE_GROUPS, AGE_GROUP_BY_NAME, ageGroupCheck } = require('./_agegroups');
const { checkRate } = require('./_ratelimit');
/* Also dependency-free, so it is required directly rather than injected — one
   less thing the adapter can hand over wrongly. googleapis and the mailer are
   injected precisely because they are NOT. */
const { nextTeamCode } = require('./_teams');

/* ============================================================
   THE SHEET COLUMNS.
   ------------------------------------------------------------
   BOTH LIVE SHEETS ALREADY HAVE A HEADER ROW AND ROWS UNDER IT, so this order
   is not a preference. Changing it shifts every future row against everything
   already there and against the header, silently, with no error anywhere.

   'submittedAt' and 'team-code' are not form fields — they are generated
   server-side. Every other name is exactly the key the form submits.

   `preferred-pool` is LAST rather than next to `age-group`, where it reads as
   if it belongs, because it was added after the sheet already had rows in it.
   Leave it there.
   ============================================================ */
const TEAM_COLUMNS = [
  'submittedAt', 'club', 'team-code', 'age-group',
  'head-coach-name', 'head-coach-email', 'head-coach-phone',
  'manager-name', 'manager-email', 'manager-phone',
  'num-players', 'notes', 'players', 'preferred-pool',
];

/* The same fourteen, in the same order, under the names /organizer displays.
   Keeping them parallel is what turns mapTeamRow() into a zip instead of
   fourteen positional guesses. */
const TEAM_OUT = [
  'submittedAt', 'club', 'teamName', 'ageGroup',
  'headCoachName', 'headCoachEmail', 'headCoachMobile',
  'managerName', 'managerEmail', 'managerMobile',
  'numPlayers', 'notes', 'players', 'preferredPool',
];

const PLAYER_COLUMNS = [
  'submittedAt', 'player-first-name', 'player-last-name', 'dob',
  'club', 'age-group',
  'parent-first-name', 'parent-last-name', 'parent-email', 'parent-phone',
  'emergency-first-name', 'emergency-last-name', 'emergency-phone',
  'medical-notes', 'consent', 'play-up-consent',
];

/* ============================================================
   CLUB DECLARATIONS — the third sheet, added 1 Aug 2026.
   ------------------------------------------------------------
   A club says ONCE which age groups it is sending teams to and how many in
   each. Planning information only: it mints no team codes and blocks nothing.
   See claude/specs/spec-club-registration.md for the three decisions that
   shaped it.

   ONE ROW PER CLUB, not one per club-per-age-group. "How many U12 teams are
   coming" is then a single column to sum, and rowFrom() — which builds exactly
   one row per submission — works unchanged.

   ⚠️ THE FIFTEEN COUNT COLUMNS ARE WRITTEN OUT, NOT DERIVED FROM AGE_GROUPS.
   Deriving them would guarantee they never drift from the age-group table, but
   it would also mean that REORDERING AGE_GROUPS silently reshuffles the columns
   of a sheet that already has rows in it — the exact disaster the comment above
   TEAM_COLUMNS warns about. Written out here, the sheet order is permanent;
   test-intake.js compares this list against AGE_GROUPS both ways, so adding a
   sixteenth age group fails loudly and a human decides what to do about the
   sheet rather than finding out from shifted data.

   They are in REAL AGE ORDER, matching AGE_GROUPS — not alphabetical, which
   would put u12g after u18b.

   NO `total-teams` COLUMN. It is derivable, and a derived fact stored twice is
   a fact that eventually disagrees with itself. The dashboard computes it; a
   human can SUM() it. */
const CLUB_COLUMNS = [
  'submittedAt', 'club', 'contact-name', 'contact-email', 'contact-phone',
  'teams-u6', 'teams-u7', 'teams-u8', 'teams-u9', 'teams-u10', 'teams-u11',
  'teams-u12', 'teams-u12g', 'teams-u13', 'teams-u14b', 'teams-u14g',
  'teams-u16b', 'teams-u16g', 'teams-u18b', 'teams-u18g',
  'notes',
];

/* The same twenty-one, in the same order, under the names /organizer displays.
   Parallel to CLUB_COLUMNS so mapClubRow() is a zip, not positional guesses —
   the same trick TEAM_OUT plays. */
const CLUB_OUT = [
  'submittedAt', 'club', 'contactName', 'contactEmail', 'contactPhone',
  'u6', 'u7', 'u8', 'u9', 'u10', 'u11',
  'u12', 'u12g', 'u13', 'u14b', 'u14g',
  'u16b', 'u16g', 'u18b', 'u18g',
  'notes',
];

/* The prefix is in one place so the form, the columns and the reader cannot
   disagree about what a count field is called. */
const CLUB_COUNT_PREFIX = 'teams-';
const clubCountKey = (ageGroupId) => CLUB_COUNT_PREFIX + ageGroupId;

/* A ceiling on a public endpoint, not a prediction. The biggest single age
   group in 2025 was nowhere near ten; the point is that an unbounded integer
   in a public request body is not a number, it is an invitation. */
const MAX_TEAMS_PER_GROUP = 10;

/* ============================================================
   THE SILENT LINK — CLUB_FORM_KEY, added 3 Aug 2026.
   ------------------------------------------------------------
   Jay's ask: a link he can email to clubs that does not appear anywhere on
   adhjrt.com. The club page is unlisted, but that on its own protects NOTHING,
   for one reason that is easy to miss:

   ⚠️ THE REPO IS PUBLIC AND ITS ROOT IS THE DEPLOYED SITE. Anyone reading
   github.com/jayjmuir-hub/adhjrt sees the page's filename and its netlify.toml
   rewrite. "Unlisted" hides the page from visitors to the homepage and from
   Google; it hides nothing from somebody who looks at the source. The
   site-wide Netlify password used to be a second layer and is now OFF.

   So the real gate is a secret that is NOT in the repo: an environment
   variable, the same shape as MANAGER_INVITE_CODES. The page carries it in
   the query string, hands it back with the submission, and THIS check is what
   decides — because a page that hides itself in JavaScript is fully visible
   in view-source, and a client-side restriction is not a restriction.

   ⚠️ FAILS CLOSED, and that is deliberate on two counts. An absent variable
   refuses every club submission, so the form is OFF until Jay sets it — the
   safe default while the page is already live — and it gives him an off
   switch that needs no deploy, exactly as deleting ORGANIZER_INVITE_CODE
   closed organiser signup on 3 Aug. (Contrast the rate limiter, which fails
   open: there, allowing costs nothing.)

   ⚠️ THE KEY IS NEVER A SHEET COLUMN AND NEVER A FIELD. It arrives as a
   top-level property of the request body, beside `form`, not inside `data` —
   so it cannot be written to the sheet even by accident, the same way
   `team-code` is kept out of the allow-list. It is also never logged.

   Guessing it is bounded by the rate limit at step 1: twenty attempts per
   address per hour against a random key is not a threat, and a wrong key is
   refused before anything is read or written. */
function clubKeyOk(supplied) {
  const expected = process.env.CLUB_FORM_KEY || '';
  if (!expected) return false;
  return String(supplied || '') === expected;
}

/* A1 ranges, derived from the column counts rather than typed, so adding a
   column and forgetting the range cannot happen. A range narrower than the row
   makes Sheets drop the overflow without an error.

   ⚠️ colLetter() ONLY GOES UP TO Z. At 27 columns it produces '[' and Sheets
   drops the overflow silently. The clubs sheet at 21 is the closest any of
   these has come; test-intake.js asserts every range stays inside A-Z so the
   next person to add a column finds out immediately instead of losing data. */
const colLetter = (n) => String.fromCharCode('A'.charCodeAt(0) + n - 1);
const TEAM_RANGE = `A:${colLetter(TEAM_COLUMNS.length)}`;      // A:N
const PLAYER_RANGE = `A:${colLetter(PLAYER_COLUMNS.length)}`;  // A:P
const CLUB_RANGE = `A:${colLetter(CLUB_COLUMNS.length)}`;      // A:U

/* ============================================================
   THE ALLOW-LIST — what a submission may contain at all.
   ------------------------------------------------------------
   Until the gateway, Netlify Forms decided this. From the gateway on the
   REQUEST BODY decides, and the request body is public input to an
   unauthenticated endpoint that:

     * appends rows to a sheet holding children's names, dates of birth and
       medical notes, and
     * sends email from admin@adhjrt.com to an address taken out of that same
       body.

   So an unknown key never gets past here. DROPPED, not refused: a browser
   extension or a corporate proxy adding a field must not cost a coach their
   registration. But the drop is REPORTED, so it can be logged — by NAME. Never
   by value; nothing in a registration belongs in a log.

   `submittedAt`, `team-code` and `team-name` are deliberately absent from both
   lists. All three are generated. Accepting them would let anyone stamp their
   own submission time, or claim a team code that already belongs to another
   club — and the team code is what the sheet, the draw and the printed pitch
   flags all key on.
   ============================================================ */

/* Not a sheet column and never written. It exists so that a bot filling every
   input it can find gives itself away. Allowed THROUGH the filter so
   validation can look at it, which is why it is named here rather than in
   either field list. */
const HONEYPOT = 'bot-field';

/* The pools a coach may ASK for. Jay, 1 Aug 2026: D and "No preference"
   removed, leaving A/B/C.

   ⚠️ THIS IS THE FIRST TIME THIS FIELD HAS BEEN CHECKED AT ALL. Until now
   `preferred-pool` was only checked for being non-empty (REQUIRED, below);
   its VALUE was never validated, so the browser's dropdown was the only
   thing restricting it — which means it restricted nothing, and anyone
   editing the page could store any string in column N. Exactly the shape of
   the squad-cap bug recorded in CLAUDE.md. Narrowing the dropdown without
   adding this check would have been cosmetic.

   ⚠️ A DRAW CAN STILL HAVE A POOL D. This is only what a club may request on
   the registration form. An organiser can still create and fill pool D in the
   draw editor, and the 4-pool Cup/Bowl/Plate/Shield bracket depends on being
   able to. Do not narrow the draw editor, or prefOf()'s /[A-Z]/i, to match.

   ⚠️ SECOND COPY: `Quins JRT.dc.html` has the same list, because there is no
   build step — the same reason AGE_GROUP_INFO and DEFAULT_VENUE are
   duplicated. `test-intake.js` compares the two and fails if either drifts. */
const POOL_OPTIONS = ['A', 'B', 'C'];

const FORMS = {
  'team-registration': {
    columns: TEAM_COLUMNS,
    range: TEAM_RANGE,
    sheetEnv: 'GOOGLE_SHEET_ID_TEAMS',
    fields: [
      'club', 'age-group', 'preferred-pool',
      'head-coach-name', 'head-coach-email', 'head-coach-phone',
      'manager-name', 'manager-email', 'manager-phone',
      'num-players', 'notes', 'players',
    ],
  },
  'player-registration': {
    columns: PLAYER_COLUMNS,
    range: PLAYER_RANGE,
    sheetEnv: 'GOOGLE_SHEET_ID_PLAYERS',
    fields: [
      'player-first-name', 'player-last-name', 'dob', 'club', 'age-group',
      'parent-first-name', 'parent-last-name', 'parent-email', 'parent-phone',
      'emergency-first-name', 'emergency-last-name', 'emergency-phone',
      'medical-notes', 'consent', 'play-up-consent',
    ],
  },
  'club-registration': {
    columns: CLUB_COLUMNS,
    range: CLUB_RANGE,
    sheetEnv: 'GOOGLE_SHEET_ID_CLUBS',
    /* Derived from CLUB_COLUMNS rather than written out a second time: the
       allow-list and the columns must agree, and the only two entries that
       differ are the generated ones. `submittedAt` is generated server-side
       and spread AFTER the data in clubRow(), so a body supplying its own
       cannot override it — but leaving it out of the allow-list means it is
       dropped and REPORTED rather than silently ignored. */
    fields: CLUB_COLUMNS.filter((c) => c !== 'submittedAt'),
  },
};

/* Returns { clean, dropped } for a known form, or NULL for an unknown one.

   Null rather than an empty result, because "we do not know what this is" and
   "a valid form with nothing filled in" are different answers and the caller
   has to be able to tell them apart — one is a 400 about the form, the other is
   a 400 about the fields.

   The form name is matched EXACTLY. Accepting a near miss would mean two
   spellings of one form exist and only one of them is ever tested. */
function cleanSubmission(form, data) {
  const spec = FORMS[typeof form === 'string' ? form : ''];
  if (!spec) return null;

  /* Object.create(null), not {}. A plain object inherits from
     Object.prototype, so a submitted "__proto__" key does not become an own
     property — it walks the prototype chain instead, which is a different and
     worse surprise than simply being dropped. Nothing here needs a prototype. */
  const clean = Object.create(null);
  const dropped = [];
  const allowed = spec.fields.concat([HONEYPOT]);

  /* Array.isArray guard: an array IS an object, and its keys are '0', '1', …
     which would all be dropped — harmless, but the intent is clearer stated. */
  const src = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  Object.keys(src).forEach((k) => {
    if (allowed.indexOf(k) >= 0) clean[k] = src[k];
    else dropped.push(k);
  });
  return { clean, dropped };
}

/* ============================================================
   VALIDATION.
   ------------------------------------------------------------
   NO NEW RULES. Every one of these is already applied in the browser. The
   point is that until the gateway that was the ONLY place they were applied,
   so anyone editing the page could register a squad of any size for a contact
   age grade. The roster's dates of birth are checked here too, as of
   sub-project 2 (28 Jul 2026) — see step 7, below the squad cap.

   THE WORDING IS COPIED CHARACTER FOR CHARACTER from submitTeam() and
   _playerFormError() in "Quins JRT.dc.html", so a coach sees the same sentence
   whichever side refuses. test-intake.js reads both out of the page and fails
   if either moves — the test-venue-panel.js pattern, which exists because two
   hand-written copies of one rule always drift.

   Returns { ok, error, field, drop }. `drop` means "accept this and throw it
   away" and is only ever set by the honeypot.
   ============================================================ */

/* A public endpoint with no length limit is a public endpoint that will
   eventually receive a megabyte. 200 characters is far past any real name,
   club or email; notes and medical notes get room to be a paragraph. */
const MAX_FIELD_CHARS = 200;
const MAX_NOTES_CHARS = 2000;
const LONG_FIELDS = ['notes', 'medical-notes'];

/* The squad list is JSON and legitimately long, but it still needs a ceiling —
   without one the only limit on a request is the body size. Thirty players of
   plausible name length is nowhere near this. */
const MAX_PLAYERS_CHARS = 8000;

/* Which fields a coach must fill in. Copied from the browser's own checks —
   submitTeam() line 1603 and _playerFormError() line 1513.

   ⚠️ 'age-group' is required on the TEAM form and NOT on the player form. That
   is not an oversight here: _playerFormError() does not ask for it and
   emptyPlayerForm() starts it blank, so the browser accepts a player without
   one. A rule the coach was never shown is a rule that looks like a bug. */
const REQUIRED = {
  'team-registration': {
    fields: ['club', 'age-group', 'preferred-pool', 'head-coach-name', 'head-coach-email'],
    message: 'Please fill in club, age group, preferred pool, head coach name and head coach email.',
  },
  'player-registration': {
    fields: [
      'player-first-name', 'player-last-name', 'dob', 'club',
      'parent-first-name', 'parent-last-name', 'parent-email',
      'emergency-first-name', 'emergency-last-name', 'emergency-phone',
    ],
    message: 'Please fill in the player name, date of birth, club, parent name, parent email and an emergency contact (name and mobile).',
  },
  /* Phone is optional, matching the team form's manager fields. The counts are
     NOT listed here — "at least one of fifteen" is not a required-field rule
     and gets its own check, with its own sentence, at step 4c. */
  'club-registration': {
    fields: ['club', 'contact-name', 'contact-email'],
    message: 'Please fill in your club, a contact name and a contact email.',
  },
};

/* Plain-English names for the "too long" message. A coach reading
   "That head-coach-name is too long" has to work out what we mean; this is ten
   lines and the difference between a usable message and a cryptic one. */
const LABELS = {
  club: 'club name', 'age-group': 'age group', 'preferred-pool': 'preferred pool',
  'head-coach-name': 'head coach name', 'head-coach-email': 'head coach email',
  'head-coach-phone': 'head coach phone', 'manager-name': 'manager name',
  'manager-email': 'manager email', 'manager-phone': 'manager phone',
  'num-players': 'number of players', notes: 'notes', players: 'squad list',
  'player-first-name': 'player first name', 'player-last-name': 'player last name',
  dob: 'date of birth', 'parent-first-name': 'parent first name',
  'parent-last-name': 'parent last name', 'parent-email': 'parent email',
  'parent-phone': 'parent phone', 'emergency-first-name': 'emergency contact first name',
  'emergency-last-name': 'emergency contact last name',
  'emergency-phone': 'emergency contact phone', 'medical-notes': 'medical notes',
  'contact-name': 'contact name', 'contact-email': 'contact email',
  'contact-phone': 'contact phone',
  consent: 'consent', 'play-up-consent': 'play-up consent',
};
const label = (key) => LABELS[key] || key;

const text = (v) => (v === undefined || v === null ? '' : String(v));
const filled = (v) => text(v).trim().length > 0;

const bad = (error, field) => ({ ok: false, error, field: field || null });
const good = (extra) => ({ ok: true, error: null, field: null, ...(extra || {}) });

function validateSubmission(form, clean) {
  const spec = FORMS[typeof form === 'string' ? form : ''];
  if (!spec) return bad('We could not read that submission.', null);
  const d = clean && typeof clean === 'object' ? clean : {};

  /* 1. THE HONEYPOT, FIRST AND SILENTLY.
        Accepted, not refused: a bot told "no" tries again with the field
        blank; a bot told "thank you" goes away. It short-circuits before every
        other rule so a bot cannot fill it and read the validation rules back
        out of the errors. */
  if (filled(d[HONEYPOT])) return good({ drop: true });

  /* 2. REQUIRED FIELDS. One message for the set, matching the browser, but the
        FIELD is named separately so the client can highlight it. */
  const req = REQUIRED[form];
  for (const f of req.fields) {
    if (!filled(d[f])) return bad(req.message, f);
  }

  /* 3. CONSENT. A checkbox arrives as the string 'Yes' or 'No'. Anything else
        — 'true', 'on', 'yes' — is a client we did not write, and treating it as
        agreement would be recording consent nobody gave. */
  if (form === 'player-registration' && text(d.consent) !== 'Yes') {
    return bad('Please read and agree to the Medical Declaration & Consent before submitting.', 'consent');
  }

  /* 4. THE AGE GROUP, when there is one. Matched exactly against the fifteen.
        Refused rather than guessed at: a group we cannot recognise is a group
        we cannot apply a squad cap to, and later a group we cannot age-check. */
  const groupName = text(d['age-group']).trim();
  if (groupName && !AGE_GROUP_BY_NAME[groupName]) {
    return bad(`"${groupName}" is not one of the tournament's age groups.`, 'age-group');
  }

  /* 4b. THE PREFERRED POOL. Matched exactly against POOL_OPTIONS, the same
         way the age group above is matched against the fifteen, and for the
         same reason: a value we do not recognise is one the draw cannot act
         on. Numbered 4b rather than renumbering everything below it, because
         _prove-registration.js patches several of these blocks by their
         literal text.

         Unreachable from the real form — the dropdown only offers A, B and C
         — so anything else is an edited page rather than a coach mistake.
         The value is echoed back exactly as the age-group rule echoes an
         unrecognised group name; the length cap is step 8, deliberately last,
         so both rules share that same property. */
  const pool = text(d['preferred-pool']).trim();
  if (form === 'team-registration' && pool && POOL_OPTIONS.indexOf(pool) < 0) {
    return bad(`"${pool}" is not a pool you can ask for. Please choose A, B or C.`, 'preferred-pool');
  }

  /* 4c. THE DECLARED TEAM COUNTS — club declarations only.

         Two rules, and they are different in kind, so they say different
         things. A count that is not a whole number in range is a broken or
         edited client. A declaration with no teams in it at all is a
         mis-click by a real person — nothing is wrong with any one field, the
         submission just does not say anything, and storing it would put a row
         in the sheet that means nothing.

         Blank and 0 are the SAME THING here (not coming), which is why a
         blank is skipped rather than refused. Every one of the fifteen is
         optional on its own; what is required is that at least one is set. */
  if (form === 'club-registration') {
    let declared = 0;
    for (const g of AGE_GROUPS) {
      const key = clubCountKey(g.id);
      const raw = text(d[key]).trim();
      if (raw === '') continue;
      if (!/^\d+$/.test(raw)) {
        return bad(`The number of ${g.name} teams must be a whole number.`, key);
      }
      const n = parseInt(raw, 10);
      if (n > MAX_TEAMS_PER_GROUP) {
        return bad(`${MAX_TEAMS_PER_GROUP} teams is the most you can enter for one age group. If you really are bringing more ${g.name} teams, email admin@adhjrt.com.`, key);
      }
      declared += n;
    }
    if (declared < 1) {
      return bad('Please say how many teams you are bringing in at least one age group.', clubCountKey(AGE_GROUPS[0].id));
    }
  }

  /* 5. THE SQUAD LIST arrives as a JSON string. Something that is not a JSON
        array is a broken client rather than a coach mistake, so it says so
        differently — telling a coach to fix their squad list when the page
        mangled it would send them round in circles. */
  let roster = null;
  if (form === 'team-registration' && filled(d.players)) {
    if (text(d.players).length > MAX_PLAYERS_CHARS) {
      return bad('We could not read the squad list. Please try again, or email admin@adhjrt.com.', 'players');
    }
    try { roster = JSON.parse(text(d.players)); } catch (e) { roster = null; }
    if (!Array.isArray(roster)) {
      return bad('We could not read the squad list. Please try again, or email admin@adhjrt.com.', 'players');
    }
  }

  /* 6. THE SQUAD CAP — the rule that has never once been enforced anywhere but
        the browser. The sentence is submitTeam()'s, character for character.

        NO SEPARATE ABSOLUTE CEILING. There was one here briefly — a flat
        MAX_ROSTER of 30 — and it was DEAD CODE: `age-group` is required on this
        form and step 4 refuses anything that is not one of the fifteen, so by
        the time we get here squadCap() has always returned a real cap, and the
        largest in the tournament is 18. A rule that cannot fire is worse than
        no rule, because it reads as protection that is not there. Deleting the
        branch changed no test, which is how it was found.

        If `age-group` ever stops being required on the team form, the fallback
        cap (18, the largest) still bounds this — but come back and check. */
  if (roster) {
    const cap = squadCap(groupName);
    if (roster.length > cap) {
      const over = roster.length - cap;
      return bad(`${groupName} squads are a maximum of ${cap} players and you have listed ${roster.length}. Please remove ${over}.`, 'players');
    }
  }

  /* 7. THE ROSTER'S DATES OF BIRTH — sub-project 2, added 28 Jul 2026.
        No new rule: this is _playerAgeCheck()'s rule, reused server-side via
        ageGroupCheck() in _agegroups.js, the same duplication pattern the
        squad cap and the age-group table above already use in this file.

        A named row with no date of birth is refused outright — confirmed
        with Jay, 28 Jul 2026 — the same requirement the player form has
        always had for `dob`. Skipping a blank date of birth would leave the
        whole check optional at the coach's discretion, which defeats the
        point of adding it.

        A play-up player (exactly one age group young) is let through. It
        cannot be gated on consent here — that is a checkbox a PARENT ticks on
        the player form, and a coach entering a whole squad cannot tick it on
        a parent's behalf. See claude/spec-age-validation.md decision 1: it is
        flagged for /organizer to chase, not blocked. Nothing is written for
        it — the flag is derivable later from the stored dob and age group,
        so it needs no column of its own. */
  if (roster) {
    const named = roster.filter((p) => p && typeof p === 'object'
      && (text(p.firstName).trim() || text(p.lastName).trim()));
    for (const p of named) {
      if (!filled(p.dob)) {
        return bad('Please give a date of birth for every named player.', 'players');
      }
    }
    for (let i = 0; i < named.length; i++) {
      const p = named[i];
      const check = ageGroupCheck(text(p.dob), groupName);
      if (check.status === 'blocked') {
        const who = [text(p.firstName).trim(), text(p.lastName).trim()].filter(Boolean).join(' ') || `player ${i + 1}`;
        return bad(`${who}: ${check.message}`, 'players');
      }
      // 'playUp' and 'ok' both pass through unchanged — neither writes anything extra.
    }
  }

  /* 8. LENGTH. Last, so a coach fixes the obvious things first. */
  for (const f of spec.fields) {
    const max = LONG_FIELDS.indexOf(f) >= 0 ? MAX_NOTES_CHARS : MAX_FIELD_CHARS;
    if (f === 'players') continue;   // has its own ceiling, checked above
    if (text(d[f]).length > max) {
      return bad(`That ${label(f)} is too long — please shorten it to ${max} characters or fewer.`, f);
    }
  }

  return good();
}

/* ============================================================
   WRITING.
   ============================================================ */

/* Everything reaching the sheet is text. The append uses RAW — which stores
   exactly what it is handed — so a number or a null arriving here would land in
   the cell as a number or a blank of a different kind rather than as the text
   that was submitted. */
const cell = (v) => (v === undefined || v === null ? '' : String(v));

function rowFrom(columns, source) {
  return columns.map((key) => cell(source[key]));
}

/* `submittedAt` and `team-code` are spread AFTER the data, so a submission that
   supplies either of them cannot override the generated value. Anyone could
   otherwise stamp their own submission time, or claim a team code that already
   belongs to another club. */
function teamRow(data, teamCode, submittedAt) {
  return rowFrom(TEAM_COLUMNS, { ...(data || {}), submittedAt, 'team-code': teamCode });
}

function playerRow(data, submittedAt) {
  return rowFrom(PLAYER_COLUMNS, { ...(data || {}), submittedAt });
}

/* Same shape as the two above, and `submittedAt` is spread AFTER the data for
   the same reason: a submission cannot stamp its own time. */
function clubRow(data, submittedAt) {
  return rowFrom(CLUB_COLUMNS, { ...(data || {}), submittedAt });
}

/* ============================================================
   READING.
   ------------------------------------------------------------
   Sheets does not pad a row: if the last cells are blank it returns a SHORT
   array. Every field has to come back as '' rather than undefined, or the
   dashboard renders the word "undefined" in a column.
   ============================================================ */

const at = (row, i) => cell((Array.isArray(row) ? row : [])[i]);

/* First and last name are two columns in the sheet and one field on screen.
   filter(Boolean) so a missing half does not leave a stray leading or trailing
   space — a blank name must read as blank, not as ' '. */
function joinName(row, columns, firstKey, lastKey) {
  return [at(row, columns.indexOf(firstKey)), at(row, columns.indexOf(lastKey))]
    .filter(Boolean).join(' ');
}

function mapTeamRow(row) {
  const obj = {};
  TEAM_OUT.forEach((name, i) => { obj[name] = at(row, i); });
  return obj;
}

/* A zip, like mapTeamRow — CLUB_OUT is CLUB_COLUMNS under display names, in
   the same order, so position i means the same thing in both. */
function mapClubRow(row) {
  const obj = {};
  CLUB_OUT.forEach((name, i) => { obj[name] = at(row, i); });
  return obj;
}

function mapPlayerRow(row) {
  const col = (key) => at(row, PLAYER_COLUMNS.indexOf(key));
  return {
    submittedAt: col('submittedAt'),
    playerName: joinName(row, PLAYER_COLUMNS, 'player-first-name', 'player-last-name'),
    dob: col('dob'),
    club: col('club'),
    ageGroup: col('age-group'),
    parentName: joinName(row, PLAYER_COLUMNS, 'parent-first-name', 'parent-last-name'),
    parentEmail: col('parent-email'),
    parentMobile: col('parent-phone'),
    emergencyContact: joinName(row, PLAYER_COLUMNS, 'emergency-first-name', 'emergency-last-name'),
    emergencyMobile: col('emergency-phone'),
    medicalNotes: col('medical-notes'),
    consent: col('consent'),
    playUpConsent: col('play-up-consent'),
  };
}

/* ============================================================
   THE WHOLE FLOW.
   ------------------------------------------------------------
   Every dependency is injected. That is not a testing convenience: a fresh
   clone has no node_modules, so anything that requires googleapis cannot be
   loaded by a test at all. submit-registration.js is a thin adapter that builds
   the real Sheets client, mailer and blob store and calls this.

   Returns { status, body }. The caller turns that into an HTTP response.
   ============================================================ */

const NOT_SAVED = 'We could not save your entry — nothing has been registered. Please email admin@adhjrt.com and we will enter it for you.';

async function handleSubmission(body, deps) {
  const d = deps || {};
  const log = typeof d.log === 'function' ? d.log : () => {};
  const now = Number.isFinite(d.now) ? d.now : Date.now();
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const form = b.form;

  /* 1. THE RATE LIMIT, FIRST.
        It is the only thing between a public endpoint and an unbounded number
        of sheet writes and emails, so it must not sit behind anything that
        costs a round trip. It fails OPEN — see _ratelimit.js. */
  const rate = await checkRate(d.rateStore, d.ip, now);
  if (!rate.ok) {
    log(`rate limited: ${rate.retryAfterSecs}s remaining`);
    return {
      status: 429,
      body: {
        ok: false,
        error: 'Too many registrations from this connection. Please try again shortly, or email admin@adhjrt.com.',
        retryAfterSecs: rate.retryAfterSecs,
      },
    };
  }

  /* 2. THE ALLOW-LIST. An unknown form is refused before anything else. */
  const cleaned = cleanSubmission(form, b.data);
  if (!cleaned) {
    log('refused: unrecognised form');
    return { status: 400, body: { ok: false, error: 'We could not read that submission.' } };
  }
  /* Logged by NAME. Never by value — nothing in a registration belongs in a
     log, and this line is the one a future edit is most likely to widen. */
  if (cleaned.dropped.length) log(`dropped unknown field(s): ${cleaned.dropped.join(', ')}`);

  /* 2b. THE CLUB FORM'S SECRET KEY.
         Placed HERE on purpose: after the allow-list has said which form this
         is, and BEFORE validation, the window, the team numbering, the sheet
         and the email. A caller without the key must not be able to make us do
         any of that work, and must learn nothing from the answer beyond "no".

         ⚠️ Only the club form is gated. The team and player forms are meant to
         be public and must stay that way — putting this in front of them would
         shut registration for every club in the tournament. */
  if (form === 'club-registration' && !clubKeyOk(b.clubKey)) {
    /* Never log the supplied value, and do not say whether the variable is
       unset or the key merely wrong — those are the same answer to a caller. */
    log('refused: club form key');
    return {
      status: 403,
      body: { ok: false, error: 'This link is not valid. Please use the link you were sent, or email admin@adhjrt.com.' },
    };
  }

  /* 3. VALIDATION, which also answers the honeypot. */
  const verdict = validateSubmission(form, cleaned.clean);
  if (!verdict.ok) {
    log(`refused: ${verdict.field || 'validation'}`);
    return { status: 400, body: { ok: false, error: verdict.error, field: verdict.field } };
  }
  /* A filled honeypot is accepted and thrown away, and it happens HERE — before
     the window is read — so a bot cannot even make us do I/O, and gets a reply
     indistinguishable from a real success. */
  if (verdict.drop) {
    log('accepted and discarded: honeypot');
    return { status: 200, body: { ok: true } };
  }

  /* 4. THE REGISTRATION WINDOW. Sub-project 3's remaining three lines:
        registrationState() was built, shared with the front end and tested at
        every boundary in July, and all that was missing was somewhere to call
        it from.

        FAILS CLOSED, unlike the rate limiter. There, allowing costs nothing;
        here, allowing means taking registrations after the squads were supposed
        to be fixed and the draw was built.

        ⚠️ THE CLUB DECLARATION IS EXEMPT, AND THAT IS THE WHOLE POINT OF IT.
        Added 4 Aug 2026, after the silent link was found to be unusable.

        A club declaration is not an entry. It is "we expect to bring three U12
        teams", collected WEEKS BEFORE registration opens so pools, the draw and
        pitch allocation can be planned. Registration opens 8 October. Gated
        behind the window, the declaration form could not be used until the
        exact moment it stopped being useful — by October the teams themselves
        are registering and the planning numbers are moot.

        It rode in by accident, not by decision: the club form was deliberately
        routed through this same gateway with no adapter change, which was right
        for the rate limit, the honeypot, the length caps and the no-values-in-
        logs rule — and the window came along with them. Nobody asked. Jay hit
        it the first time he tried the link, and it had been sitting there since
        1 Aug through a removal and a restoration.

        ⚠️ THIS IS NOT A HOLE, because the club form has a STRONGER gate than
        the window and it has already been passed by the time we get here:
        CLUB_FORM_KEY, checked at step 2b. Only somebody Jay emailed the link to
        can reach this line at all, and deleting that variable shuts the form
        instantly with no deploy. The team and player forms are PUBLIC and stay
        gated — widening this exemption to them would quietly open registration
        for the entire tournament, months early, and there is an injected fault
        for exactly that.

        Deliberate, and Jay's explicit choice on 4 Aug: declarations are NOT
        stopped when the window closes at the far end either. The key is the
        switch. */
  if (form !== 'club-registration') {
    let open = false;
    try {
      open = !!d.registrationState(await d.loadRegistration(), now).open;
    } catch (err) {
      log(`registration window unreadable, refusing - ${err && err.message}`);
      return { status: 403, body: { ok: false, error: 'Registration is not open at the moment. Please email admin@adhjrt.com.' } };
    }
    if (!open) {
      log('refused: registration is not open');
      return { status: 403, body: { ok: false, error: 'Registration is not open at the moment. Please email admin@adhjrt.com.' } };
    }
  }

  /* 5. THE TEAM CODE, teams only. A failed numbering read costs the tidy number,
        not the registration — an organiser can renumber in the sheet, and the
        alternative is refusing a real entry because a read timed out. */
  const data = { ...cleaned.clean };
  delete data[HONEYPOT];
  const submittedAt = new Date(now).toISOString();
  let teamCode;
  let row;

  if (form === 'club-registration') {
    /* No team code: a declaration deliberately mints nothing. Decision 2 in
       claude/specs/spec-club-registration.md — teams get their codes when they
       actually register, so a club that declares three and sends two never
       leaves a phantom team in the draw. */
    row = clubRow(data, submittedAt);
  } else if (form === 'team-registration') {
    let existing = [];
    try {
      existing = await d.readTeamsSheet();
    } catch (err) {
      log(`could not read the teams sheet for numbering - ${err && err.message}`);
    }
    teamCode = nextTeamCode(data.club, data['age-group'], Array.isArray(existing) ? existing : []);
    /* The confirmation email prints the code, so it has to be on the data
       before the mailer sees it. */
    data['team-name'] = teamCode;
    row = teamRow(data, teamCode, submittedAt);
  } else {
    row = playerRow(data, submittedAt);
  }

  /* 6. THE ROW. This is the record. */
  try {
    await d.appendRow(form, row);
  } catch (err) {
    log(`sheet append failed, parking the submission - ${err && err.message}`);
    /* Parked so it can be replayed by hand. Better than the Netlify Forms copy
       it replaces, because this one can be read programmatically.
       ⚠️ That blob holds children's personal data. */
    try { await d.parkFailed(form, data, err && err.message); } catch (e2) {
      log(`could not park the failed submission - ${e2 && e2.message}`);
    }
    /* NO EMAIL. A confirmation for a registration that is not in the sheet is
       worse than no confirmation: the coach stops chasing it. */
    return { status: 500, body: { ok: false, error: NOT_SAVED } };
  }

  /* 7. THE CONFIRMATION, after the row and swallowed. A mail failure must never
        cost a registration, and must never make anyone resubmit into a
        duplicate row. Same rule submission-created.js has always had. */
  try {
    const result = await d.sendConfirmation(form, data);
    if (result && result.sent) log(`confirmation sent (${result.count} recipient(s))`);
    else log(`confirmation not sent: ${(result && result.reason) || 'unknown'}`);
  } catch (err) {
    log(`confirmation email failed (the registration WAS saved) - ${err && err.message}`);
  }

  return { status: 200, body: teamCode ? { ok: true, teamCode } : { ok: true } };
}

module.exports = {
  TEAM_COLUMNS, TEAM_OUT, PLAYER_COLUMNS,
  CLUB_COLUMNS, CLUB_OUT, CLUB_COUNT_PREFIX, clubCountKey, MAX_TEAMS_PER_GROUP,
  TEAM_RANGE, PLAYER_RANGE, CLUB_RANGE,
  FORMS, HONEYPOT, POOL_OPTIONS, cleanSubmission,
  validateSubmission, MAX_FIELD_CHARS, MAX_NOTES_CHARS, MAX_PLAYERS_CHARS,
  handleSubmission, NOT_SAVED,
  teamRow, playerRow, clubRow,
  mapTeamRow, mapPlayerRow, mapClubRow,
  clubKeyOk,
};
