# Submission Gateway — Implementation Plan

> **Sub-project 1 of `claude/specs/spec-registration-window.md`.** Read that spec first,
> then `CLAUDE.md` from a fresh clone, then `claude/state-of-play.md`.
>
> **For an implementing session:** work task by task, in order. Every task ends
> with tests passing and a commit on `dev`. Do not deploy without Jay's "merge".

---

## For Jay — what this is, in one paragraph

Right now a coach's registration goes to Netlify first, and Netlify tells our code
about it afterwards. That means there is nowhere for us to stand and say "no, that
player is too old for U16B" or "registration closed last Tuesday" — by the time we
see it, it has already been accepted. This puts **our code at the front door**. It
checks the registration, writes the row to your Google Sheet, sends the confirmation
email from your Microsoft account, and tells the coach straight away if something is
wrong. Netlify's own copy of submissions goes away — you've never used it, and the
sheet stays the record. **Nothing about the rules changes in this piece of work**;
this is only about moving the door so there is somewhere to put the rules in
sub-project 2.

**Decisions you made (27–28 July):** drop the Netlify copy; straight swap now while
there is no traffic.

---

## READ THIS BEFORE ANYTHING ELSE — what moving the door exposes

Netlify Forms was doing three things for us that nobody chose and nobody wrote down:

1. **Spam filtering and abuse throttling** on a public endpoint.
2. **Rate limiting**, so nobody could hammer it.
3. **Shielding a Google Sheet write** behind their platform.

Take it away and `submit-registration` becomes a public, unauthenticated endpoint
that (a) appends rows to a sheet holding children's names, dates of birth and
medical notes, and (b) **sends email from `admin@adhjrt.com` to an address supplied
in the request body** — `sendConfirmation` mails `data['parent-email']`, which is
attacker-controlled. That last one is an open mail relay on your own domain if it is
not guarded.

**This is not optional hardening to bolt on later.** Tasks 4, 5 and 6 below exist
because of it, and the cutover in Task 9 must not happen without them. The
site-wide Netlify password stays ON throughout — it is the backstop while this is
proven, and removing it is a separate decision on a separate day.

---

**Goal:** Move team and player submissions from Netlify Forms onto our own
validating function, without changing any registration rule and without breaking the
confirmation emails.

**Architecture:** A thin Netlify function (`submit-registration.js`) builds real
dependencies — Google Sheets client, mailer, blob store — and hands them to
`handleSubmission()` in a dependency-free module (`_intake.js`). All logic, all
validation and all tests live in the dependency-free half. This is not a style
choice: the repo has no `node_modules` in a fresh clone, so anything that
`require`s `googleapis` cannot be tested at all. The same trick is already used by
`_password.js` and is documented in `CLAUDE.md`.

**Tech stack:** Node 22 CommonJS Netlify Functions, `googleapis`, `@netlify/blobs`,
Microsoft Graph via `fetch`. Tests are plain Node, no framework — `tests/_lib.js`.

## Global constraints

- **The repo is public and the repo root IS the deployed site.** Never `git add -A`.
  Anything left in the root is served at `adhjrt.com/<filename>`.
- **Never commit a value for any env var.** Names only, in comments.
- **Never log a registration field value.** Not in `console.log`, not in an error
  message, not in a test fixture. Log field *names* and counts.
- **Every new assertion is proven against an injected fault** in
  `tests/_prove-registration.js`, and the check that fails must be the one claiming
  to guard that behaviour. A fault that cannot be injected is a failure.
- **A test must not throw.** Reaching blind into a lookup a fault makes `undefined`
  kills the file and every check after it silently never runs. Use `|| {}`.
- **Line endings:** compare file text only after normalising CRLF to LF.
- **Work on `dev`.** `main` is deployed and costs 15 credits. Do not merge without
  Jay saying "merge".
- **`[skip ci]` never goes on a `dev` commit.** It survives a fast-forward and
  silently prevents the deploy.
- Sheet writes use `valueInputOption: 'RAW'`, never `USER_ENTERED` — a leading `=`
  in a free-text box becomes a live formula in a sheet full of children's data, and
  a leading `+` eats phone-number country codes. This is an existing, deliberate,
  hard-won setting. Preserve it.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `netlify/functions/_agegroups.js` | **new** | The fifteen age groups: id, name, ages at cut-off, format, squad cap. Dependency-free. Server's copy of the client's `AGE_GROUP_INFO`. |
| `netlify/functions/_intake.js` | **new** | Sheet column order (single-sourced), row builders, field allow-list, `validateSubmission()`, `handleSubmission()`. Dependency-free. |
| `netlify/functions/_ratelimit.js` | **new** | Blob-backed per-IP counter. Dependency-free apart from the store passed in. |
| `netlify/functions/submit-registration.js` | **new** | The HTTP handler. Builds real deps, calls `handleSubmission()`. Thin by design. |
| `netlify/functions/submission-created.js` | modify → delete | Repointed at `_intake.js` in Task 2, deleted at cutover in Task 9. |
| `netlify/functions/get-registrations.js` | modify | Import the column order instead of its own copy. |
| `netlify/functions/get-my-registrations.js` | modify | Same. |
| `Quins JRT.dc.html` | modify | `postRegistration()` posts JSON to the function; show the server's real error. |
| `netlify-forms.html` | delete | The decoy form that registered the forms with Netlify. Task 9. |
| `tests/test-intake.js` | **new** | Columns, allow-list, validation, `handleSubmission` driven with fakes. |
| `tests/test-agegroups.js` | **new** | The server table matches the client table exactly. |
| `tests/_prove-registration.js` | modify | New faults. |
| `tests/runall.ps1`, `CLAUDE.md`, `tests/README.md` | modify | Register the new files; document. |

---

## Task 1 — The age-group table, server side

The squad cap and (in sub-project 2) the age rules have to be enforced server-side,
and the table they need — `AGE_GROUP_INFO`, with `ages` and `squad` — exists **only
in `Quins JRT.dc.html`**. There is no copy in `scores-data.js` or anywhere in
`netlify/functions/`.

Follow the pattern this codebase already uses for `DEFAULT_VENUE`: a second copy,
deliberately duplicated because there is no build step, with a test that fails if
the two drift. Do **not** invent a new mechanism.

**Files:**
- Create: `netlify/functions/_agegroups.js`
- Create: `tests/test-agegroups.js`
- Read only: `Quins JRT.dc.html` (the `AGE_GROUP_INFO` array, currently around
  line 1127 — find it by the literal `const AGE_GROUP_INFO = [`)

**Interfaces produced:** `AGE_GROUPS` (array), `AGE_GROUP_BY_NAME` (object keyed by
`name`), `AGE_GROUP_BY_ID`, `MAX_SQUAD_ANY_GROUP` (number), `squadCap(name)`.

- [ ] **Step 1: Write the failing test**

`tests/test-agegroups.js`:

```js
/* tests/test-agegroups.js
   ------------------------------------------------------------------------
   The fifteen age groups exist TWICE — once in Quins JRT.dc.html for the
   registration form, once in netlify/functions/_agegroups.js so the server can
   enforce the squad cap without trusting the browser. There is no build step,
   so there is no way to have one copy. This file is the thing that stops them
   drifting, exactly as test-venue-splits.js does for DEFAULT_VENUE.

   The squad cap is the reason this matters: if the server's table says 18 and
   the client's says 12, a coach fills in eighteen names, the form lets them,
   and the server accepts a squad six players over the limit. */

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');
const A = require(path.join(repoRoot(), 'netlify', 'functions', '_agegroups.js'));

/* Pull the client's array out of the page and evaluate it. Comments stripped
   first because they contain apostrophes and braces. */
function clientTable() {
  const t = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
  const i = t.indexOf('const AGE_GROUP_INFO = [');
  const j = t.indexOf('\n];', i);
  check('the client table was found', i >= 0 && j > i);
  const src = t.slice(i + 'const AGE_GROUP_INFO = '.length, j + 2)
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  // eslint-disable-next-line no-eval
  return eval('(' + src + ')');
}

/* ====================================================================== */
section('The two copies agree');

{
  const client = clientTable();
  eq('the server carries the same fifteen groups', A.AGE_GROUPS, client);
  eq('there are fifteen', A.AGE_GROUPS.length, 15);
}

/* ====================================================================== */
section('Squad caps — the number the server will enforce');

/* Named explicitly rather than derived from the table, so a typo in the table
   is caught rather than copied. Read off AGE_GROUP_INFO in Quins JRT.dc.html
   on 28 Jul 2026. */
{
  const expected = {
    'U6 Tag': 12, 'U7 Tag': 12, 'U8 Tag': 12, 'U9 Mixed Contact': 12,
    'U10 Mixed Contact': 15, 'U11 Mixed Contact': 18, 'U12 Mixed Contact': 18,
    'U12G QR': 12, 'U13 Mixed Contact': 15, 'U14B Contact': 18, 'U14G QR': 12,
    'U16B Contact': 18, 'U16G Contact': 12, 'U18B Contact': 18, 'U18G Contact': 12,
  };
  Object.keys(expected).forEach((name) => {
    eq(`${name} squad cap`, A.squadCap(name), expected[name]);
  });
  eq('the largest squad anywhere is 18', A.MAX_SQUAD_ANY_GROUP, 18);
  /* An unknown or absent group falls back to the LARGEST cap, matching the
     client: a coach filling the roster before picking a group must not be
     blocked, and the real cap applies the moment they choose. The server still
     re-checks against the real cap once a group is present. */
  eq('an unknown group falls back to the largest cap', A.squadCap('not a group'), 18);
  eq('no group at all falls back too', A.squadCap(''), 18);
  eq('junk falls back too', A.squadCap(null), 18);
}

/* ====================================================================== */
section('Lookups');

eq('by name', A.AGE_GROUP_BY_NAME['U16B Contact'].id, 'u16b');
eq('by id', A.AGE_GROUP_BY_ID.u16b.name, 'U16B Contact');
eq('ages at the cut-off', A.AGE_GROUP_BY_ID.u16b.ages, [14, 15]);
check('an unknown name gives undefined, not a throw', A.AGE_GROUP_BY_NAME.nope === undefined);

summary('test-agegroups.js');
```

- [ ] **Step 2: Run it and watch it fail**

```
node tests/test-agegroups.js
```

Expected: `Cannot find module ... _agegroups.js`.

- [ ] **Step 3: Write `_agegroups.js`**

Copy the array out of `Quins JRT.dc.html` **verbatim** — same order, same names,
same numbers. Do not retype it; the test compares deep equality and any drift is a
failure.

```js
// netlify/functions/_agegroups.js
//
// The fifteen age groups, server side.
//
// WHY THIS IS A SECOND COPY. The same table lives in "Quins JRT.dc.html" as
// AGE_GROUP_INFO, because the registration form needs it to show squad caps and
// age warnings before any fetch resolves. There is no build step in this repo,
// so there is no way to have one copy — the same situation as DEFAULT_VENUE,
// which is duplicated between _venue.js and scores-data.js for the same reason.
//
// test-agegroups.js compares the two and fails if either moves. Change one,
// change them both, run the test.
//
// WHAT THE SERVER USES IT FOR: the squad cap, which until now was enforced only
// in the browser and could be bypassed by anyone editing the page. Sub-project 2
// will add the age rules on top of `ages`.

const AGE_GROUPS = [
  { id: 'u6', name: 'U6 Tag', ages: [5], format: '7s', squad: 12 },
  { id: 'u7', name: 'U7 Tag', ages: [6], format: '7s', squad: 12 },
  { id: 'u8', name: 'U8 Tag', ages: [7], format: '7s', squad: 12 },
  { id: 'u9', name: 'U9 Mixed Contact', ages: [8], format: '7s', squad: 12 },
  { id: 'u10', name: 'U10 Mixed Contact', ages: [9], format: '10s', squad: 15 },
  { id: 'u11', name: 'U11 Mixed Contact', ages: [10], format: '12s', squad: 18 },
  { id: 'u12', name: 'U12 Mixed Contact', ages: [11], format: '12s', squad: 18 },
  { id: 'u12g', name: 'U12G QR', ages: [11], format: '7s', squad: 12 },
  { id: 'u13', name: 'U13 Mixed Contact', ages: [12], format: '10s', squad: 15 },
  { id: 'u14b', name: 'U14B Contact', ages: [13], format: '12s', squad: 18 },
  { id: 'u14g', name: 'U14G QR', ages: [13], format: '7s', squad: 12 },
  { id: 'u16b', name: 'U16B Contact', ages: [14, 15], format: '12s', squad: 18 },
  { id: 'u16g', name: 'U16G Contact', ages: [14, 15], format: '7s', squad: 12 },
  { id: 'u18b', name: 'U18B Contact', ages: [16, 17], format: '12s', squad: 18 },
  { id: 'u18g', name: 'U18G Contact', ages: [16, 17], format: '7s', squad: 12 },
];

const AGE_GROUP_BY_NAME = {};
const AGE_GROUP_BY_ID = {};
AGE_GROUPS.forEach((g) => { AGE_GROUP_BY_NAME[g.name] = g; AGE_GROUP_BY_ID[g.id] = g; });

const MAX_SQUAD_ANY_GROUP = Math.max(...AGE_GROUPS.map((g) => g.squad));

/* The cap for a group NAME as the form submits it. Falls back to the largest
   squad in the tournament when the group is missing or unrecognised — same rule
   as the client's _squadCap(), and for the same reason: a roster typed before a
   group is chosen must not be refused. Where a group IS present the real cap is
   what applies, so the fallback never widens a real submission. */
function squadCap(name) {
  const g = AGE_GROUP_BY_NAME[typeof name === 'string' ? name : ''];
  return g ? g.squad : MAX_SQUAD_ANY_GROUP;
}

module.exports = { AGE_GROUPS, AGE_GROUP_BY_NAME, AGE_GROUP_BY_ID, MAX_SQUAD_ANY_GROUP, squadCap };
```

- [ ] **Step 4: Run it and watch it pass**

```
node tests/test-agegroups.js
```

Expected: all checks passed.

- [ ] **Step 5: Add two faults to `tests/_prove-registration.js`**

Add `'test-agegroups.js'` to the baseline list, add `'_agegroups.js'` to `NEEDED`,
and append these to `FAULTS`:

```js
  {
    name: 'the server age table drifts from the client (U16B cap 18 -> 20)',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "{ id: 'u16b', name: 'U16B Contact', ages: [14, 15], format: '12s', squad: 18 },",
      "{ id: 'u16b', name: 'U16B Contact', ages: [14, 15], format: '12s', squad: 20 },"),
    expect: ['U16B Contact squad cap', 'the same fifteen groups'],
  },
  {
    name: 'an unknown age group falls back to the SMALLEST cap instead of the largest',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      '  return g ? g.squad : MAX_SQUAD_ANY_GROUP;',
      '  return g ? g.squad : 12;'),
    expect: ['an unknown group falls back to the largest cap'],
  },
```

Run `node tests/_prove-registration.js`. Both must be **caught by the named check**.

- [ ] **Step 6: Register and commit**

Add `'test-agegroups.js'` to the `$tests` array in `tests/runall.ps1`.

```bash
git add netlify/functions/_agegroups.js tests/test-agegroups.js tests/_prove-registration.js tests/runall.ps1
git commit -F <message file>
```

Message: explain that the squad cap was client-only and could be bypassed by
editing the page, and that this is the server's copy with a drift test.

---

## Task 2 — Single-source the sheet column order

The column order for both sheets is hardcoded **three times**, in three files, kept
in sync by hand:

- `netlify/functions/submission-created.js` (the writer, a positional array)
- `netlify/functions/get-registrations.js` (`TEAM_FIELDS` plus a positional
  destructure in `mapPlayerRow`)
- `netlify/functions/get-my-registrations.js` (the same, duplicated verbatim)

Sub-project 2 adds a column. Doing that against three hand-synced copies is how a
reader ends up one column out and silently shows every parent's phone number in the
emergency-contact box. Fix it **now**, as a pure refactor with no behaviour change,
before anything moves — so the gateway is built on one source of truth.

**Files:**
- Create: `netlify/functions/_intake.js`
- Create: `tests/test-intake.js`
- Modify: `netlify/functions/submission-created.js` (the two `values = [[...]]` blocks)
- Modify: `netlify/functions/get-registrations.js`
- Modify: `netlify/functions/get-my-registrations.js`

**Interfaces produced:** `TEAM_COLUMNS`, `PLAYER_COLUMNS` (arrays of field keys in
sheet order), `teamRow(data, teamCode, submittedAt)`, `playerRow(data, submittedAt)`,
`TEAM_RANGE` (`'A:N'`), `PLAYER_RANGE` (`'A:P'`).

- [ ] **Step 1: Write the failing test**

Start `tests/test-intake.js` with a section that pins the **exact** current column
order — read off `submission-created.js` as it stands today, not from memory. The
whole value of this task is that the order does not change.

```js
const path = require('path');
const { repoRoot, section, check, eq, summary } = require('./_lib');
const I = require(path.join(repoRoot(), 'netlify', 'functions', '_intake.js'));

/* ====================================================================== */
section('The sheet column order, pinned');

/* THESE ARE THE COLUMNS THE LIVE SHEETS ALREADY HAVE. Both sheets have a
   header row and rows already in them, so this order is not a preference —
   changing it silently shifts every future row against the existing ones and
   against the header. Read off submission-created.js, 28 Jul 2026. */
eq('team columns', I.TEAM_COLUMNS, [
  'submittedAt', 'club', 'team-code', 'age-group',
  'head-coach-name', 'head-coach-email', 'head-coach-phone',
  'manager-name', 'manager-email', 'manager-phone',
  'num-players', 'notes', 'players', 'preferred-pool',
]);
eq('fourteen team columns, matching range A:N', I.TEAM_COLUMNS.length, 14);
eq('the team range says the same thing', I.TEAM_RANGE, 'A:N');

eq('player columns', I.PLAYER_COLUMNS, [
  'submittedAt', 'player-first-name', 'player-last-name', 'dob',
  'club', 'age-group',
  'parent-first-name', 'parent-last-name', 'parent-email', 'parent-phone',
  'emergency-first-name', 'emergency-last-name', 'emergency-phone',
  'medical-notes', 'consent', 'play-up-consent',
]);
eq('sixteen player columns, matching range A:P', I.PLAYER_COLUMNS.length, 16);
eq('the player range says the same thing', I.PLAYER_RANGE, 'A:P');

/* ====================================================================== */
section('Building a row');

/* Field values here are invented and obviously so. NEVER build a fixture from
   a real sheet row — this repo is public and those rows are children. */
{
  const stamp = '2026-08-01T09:00:00.000Z';
  const row = I.teamRow({
    club: 'Test Club', 'age-group': 'U16B Contact', 'head-coach-name': 'A Coach',
    'head-coach-email': 'coach@example.com', 'head-coach-phone': '+971500000000',
    'num-players': '15', 'preferred-pool': 'No preference',
  }, 'TST1', stamp);

  eq('one row out', row.length, 14);
  eq('the timestamp leads', row[0], stamp);
  eq('the team code is column 3, not something the coach typed', row[2], 'TST1');
  eq('preferred pool is LAST, not next to age group', row[13], 'No preference');
  eq('a missing field is an empty string, never undefined', row[11], '');
  check('every cell is a string', row.every((c) => typeof c === 'string'));

  /* A row must be positionally identical to the columns list, or the readers
     and the writer disagree by one and nobody notices until a parent's phone
     number shows up in the emergency-contact box. */
  eq('the row lines up with TEAM_COLUMNS', row.length, I.TEAM_COLUMNS.length);
}

{
  const stamp = '2026-08-01T09:00:00.000Z';
  const row = I.playerRow({
    'player-first-name': 'Test', 'player-last-name': 'Player', dob: '2011-01-01',
    club: 'Test Club', 'age-group': 'U16B Contact', 'parent-email': 'parent@example.com',
    consent: 'Yes', 'play-up-consent': 'No',
  }, stamp);
  eq('one row out', row.length, 16);
  eq('dob is column 4', row[3], '2011-01-01');
  eq('consent is second from last', row[14], 'Yes');
  eq('play-up consent is last', row[15], 'No');
  check('every cell is a string', row.every((c) => typeof c === 'string'));
}

/* A number or a null must not reach the sheet as a number or a null — RAW
   input means whatever we hand over is stored as-is. */
eq('a number becomes a string', I.playerRow({ dob: 20110101 }, 'x')[3], '20110101');
eq('null becomes an empty string', I.playerRow({ dob: null }, 'x')[3], '');
eq('undefined becomes an empty string', I.playerRow({}, 'x')[3], '');

summary('test-intake.js');
```

- [ ] **Step 2: Run it and watch it fail**

```
node tests/test-intake.js
```

- [ ] **Step 3: Write the column half of `_intake.js`**

```js
// netlify/functions/_intake.js
//
// Everything that happens to a registration between arriving and being stored:
// the sheet column order, the row builders, the field allow-list, validation,
// and the orchestration in handleSubmission().
//
// DEPENDENCY-FREE ON PURPOSE. Nothing here requires googleapis, @netlify/blobs
// or bcryptjs. A fresh clone has no node_modules, so anything that reaches for
// a package cannot be required by a test at all — the same reason _password.js
// was split out of _auth.js. The real clients are built in
// submit-registration.js and passed in.

/* ============================================================
   THE SHEET COLUMNS.
   ------------------------------------------------------------
   Both live sheets already have a header row and rows under it, so this order
   is not a preference: changing it shifts every future row against everything
   already there. It lived in THREE hand-synced copies until 28 Jul 2026 — the
   writer in submission-created.js and the two readers — which is a column-shift
   bug waiting for the first person to add a field.

   'submittedAt' and 'team-code' are not form fields; they are generated. Every
   other name is exactly the key the form submits.
   ============================================================ */
const TEAM_COLUMNS = [
  'submittedAt', 'club', 'team-code', 'age-group',
  'head-coach-name', 'head-coach-email', 'head-coach-phone',
  'manager-name', 'manager-email', 'manager-phone',
  'num-players', 'notes', 'players', 'preferred-pool',
];
const TEAM_RANGE = 'A:N';   // 14 columns

const PLAYER_COLUMNS = [
  'submittedAt', 'player-first-name', 'player-last-name', 'dob',
  'club', 'age-group',
  'parent-first-name', 'parent-last-name', 'parent-email', 'parent-phone',
  'emergency-first-name', 'emergency-last-name', 'emergency-phone',
  'medical-notes', 'consent', 'play-up-consent',
];
const PLAYER_RANGE = 'A:P'; // 16 columns

/* Everything reaching the sheet is a string. The append uses RAW, which stores
   exactly what it is handed, so a number or a null arriving here would land in
   the cell as a number or blank rather than the text that was submitted. */
const cell = (v) => (v === undefined || v === null ? '' : String(v));

function rowFrom(columns, source) {
  return columns.map((key) => cell(source[key]));
}

function teamRow(data, teamCode, submittedAt) {
  return rowFrom(TEAM_COLUMNS, { ...(data || {}), submittedAt, 'team-code': teamCode });
}

function playerRow(data, submittedAt) {
  return rowFrom(PLAYER_COLUMNS, { ...(data || {}), submittedAt });
}

module.exports = {
  TEAM_COLUMNS, PLAYER_COLUMNS, TEAM_RANGE, PLAYER_RANGE,
  teamRow, playerRow,
};
```

- [ ] **Step 4: Run it and watch it pass**

- [ ] **Step 5: Repoint the writer — no behaviour change**

In `submission-created.js`, add `const I = require('./_intake');` and replace the
two `values = [[ ... ]]` literals:

```js
      values = [I.teamRow(data, teamCode, submittedAt)];
```
```js
      values = [I.playerRow(data, submittedAt)];
```

and replace `columns = 'A:N'` / `'A:P'` with `I.TEAM_RANGE` / `I.PLAYER_RANGE`.

Leave everything else — the team-code read, the `RAW` setting, the email
try/catch, the comments explaining them — exactly as it is.

- [ ] **Step 6: Repoint the two readers**

In `get-registrations.js` and `get-my-registrations.js`, delete each local
`TEAM_FIELDS` array and the positional destructure in `mapPlayerRow`, and derive
both from `I.TEAM_COLUMNS` / `I.PLAYER_COLUMNS`. Read the existing code first and
keep the shape each function returns **identical** — this is a refactor, and
`/organizer` reads those shapes.

- [ ] **Step 7: Add a fault and prove it**

```js
  {
    name: 'the sheet column order is shuffled (preferred-pool moves next to age group)',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  'submittedAt', 'club', 'team-code', 'age-group',",
      "  'submittedAt', 'club', 'team-code', 'age-group', 'preferred-pool',"),
    expect: ['team columns', 'fourteen team columns'],
  },
  {
    name: 'a missing field reaches the sheet as undefined instead of blank',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "const cell = (v) => (v === undefined || v === null ? '' : String(v));",
      'const cell = (v) => v;'),
    expect: ['a missing field is an empty string', 'every cell is a string'],
  },
```

- [ ] **Step 8: Commit**

Nothing has changed behaviourally. Say so in the message, and say why it was worth
doing before the gateway rather than after.

---

## Task 3 — The field allow-list

An unknown key must never reach the sheet, the email, or a log. Today Netlify Forms
decides what the fields are; from Task 7 the request body does, and the request
body is public input.

**Files:** modify `netlify/functions/_intake.js`, `tests/test-intake.js`

**Interfaces produced:** `FORMS` (object keyed by form name), `cleanSubmission(form, data)`
→ `{ clean, dropped }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test-intake.js`:

```js
/* ====================================================================== */
section('The allow-list — what may reach the sheet at all');

{
  const { clean, dropped } = I.cleanSubmission('team-registration', {
    club: 'Test Club',
    'head-coach-email': 'coach@example.com',
    'not-a-field': 'x',
    __proto__: 'nope',
    'submittedAt': '1999-01-01T00:00:00.000Z',   // generated, never accepted
    'team-code': 'HACK9',                        // generated, never accepted
  });

  check('a known field survives', clean.club === 'Test Club');
  check('an unknown field is dropped', !('not-a-field' in clean));
  eq('and it is reported, so it can be logged by NAME', dropped, ['not-a-field', 'submittedAt', 'team-code']);
  /* THE TWO THAT MATTER. Both are generated server-side. Accepting them from
     the body would let anyone stamp their own submission time or choose their
     own team code — including one that already belongs to another club. */
  check('submittedAt cannot be supplied', !('submittedAt' in clean));
  check('a team code cannot be supplied', !('team-code' in clean));
  check('prototype pollution does not land', clean.__proto__ !== 'nope');
  check('the result has no prototype at all', Object.getPrototypeOf(clean) === null);
}

{
  const { clean } = I.cleanSubmission('player-registration', {
    'medical-notes': 'none', 'head-coach-name': 'wrong form',
  });
  check('a player field survives', clean['medical-notes'] === 'none');
  check('a TEAM field on the player form is dropped', !('head-coach-name' in clean));
}

check('an unknown form is refused outright', I.cleanSubmission('nope', {}) === null);
check('a missing form is refused outright', I.cleanSubmission(undefined, {}) === null);
check('junk data gives an empty clean object, not a throw',
  Object.keys(I.cleanSubmission('team-registration', null).clean).length === 0);

/* The honeypot is allowed THROUGH the allow-list so validation can see it, but
   it is not a sheet column, so it can never be written. */
check('bot-field is allowed through for the honeypot check',
  'bot-field' in I.cleanSubmission('team-registration', { 'bot-field': '' }).clean);
check('…but it is not a sheet column', I.TEAM_COLUMNS.indexOf('bot-field') < 0);
```

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Implement**

```js
/* ============================================================
   THE ALLOW-LIST.
   ------------------------------------------------------------
   Until 28 Jul 2026 Netlify Forms decided what a submission contained. From the
   gateway on, the request body does — and the request body is public input from
   an unauthenticated endpoint that writes to a sheet holding children's names,
   dates of birth and medical notes.

   So: an explicit list, and anything else is dropped. Dropped rather than
   refused, because a browser extension or a proxy adding a field should not
   cost a coach their registration — but the drop is REPORTED so it can be
   logged by name (never by value).

   'submittedAt' and 'team-code' are deliberately NOT accepted from the body.
   Both are generated. Accepting them would let anyone stamp their own
   submission time, or claim a team code that already belongs to another club.
   ============================================================ */
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
};

/* Not a sheet column and never written — it exists so a bot that fills every
   input it can see gives itself away. Allowed through the filter so
   validateSubmission() can look at it. */
const HONEYPOT = 'bot-field';

function cleanSubmission(form, data) {
  const spec = FORMS[typeof form === 'string' ? form : ''];
  if (!spec) return null;
  /* Object.create(null): a plain {} inherits from Object.prototype, so a
     submitted "__proto__" or "constructor" key behaves in ways nothing
     downstream expects. Nothing here needs a prototype. */
  const clean = Object.create(null);
  const dropped = [];
  const allowed = spec.fields.concat([HONEYPOT]);
  Object.keys(data && typeof data === 'object' ? data : {}).forEach((k) => {
    if (allowed.indexOf(k) >= 0) clean[k] = data[k];
    else dropped.push(k);
  });
  return { clean, dropped };
}
```

Export `FORMS`, `HONEYPOT`, `cleanSubmission`.

- [ ] **Step 4: Run and watch it pass.**

- [ ] **Step 5: Faults**

```js
  {
    name: 'the allow-list is removed and every submitted field is kept',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    if (allowed.indexOf(k) >= 0) clean[k] = data[k];',
      '    clean[k] = data[k]; if (false)'),
    expect: ['an unknown field is dropped', 'a team code cannot be supplied'],
  },
  {
    name: 'the clean object gets a prototype back',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  const clean = Object.create(null);', '  const clean = {};'),
    expect: ['no prototype at all'],
  },
  {
    name: 'an unknown form name is accepted instead of refused',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (!spec) return null;', '  if (!spec) return { clean: Object.create(null), dropped: [] };'),
    expect: ['an unknown form is refused outright'],
  },
```

- [ ] **Step 6: Commit.**

---

## Task 4 — Validation

Mirror the rules the client already applies, plus the size limits the client never
needed because Netlify was absorbing them. **No new registration rules** — ages are
sub-project 2.

**Files:** modify `netlify/functions/_intake.js`, `tests/test-intake.js`

**Interfaces produced:** `validateSubmission(form, clean)` →
`{ ok: boolean, error: string|null, field: string|null }`, `MAX_FIELD_CHARS`,
`MAX_NOTES_CHARS`, `MAX_ROSTER`.

Rules, all of them:

| Rule | Applies to | Message |
|---|---|---|
| honeypot must be empty | both | *(silently accepted — see below)* |
| required: club, age-group, preferred-pool, head-coach-name, head-coach-email | team | `Please fill in club, age group, preferred pool, head coach name and head coach email.` |
| required: player first/last name, dob, club, parent first/last name, parent email, emergency first/last name, emergency phone | player | `Please fill in the player name, date of birth, club, parent name, parent email and an emergency contact (name and mobile).` |
| `consent` must be `'Yes'` | player | `Please read and agree to the Medical Declaration & Consent before submitting.` |
| `players` must parse as an array | team | `We could not read the squad list. Please try again, or email admin@adhjrt.com.` |
| roster length ≤ `squadCap(age-group)` | team | `<group> squads are a maximum of <cap> players and you have listed <n>. Please remove <over>.` — **copy this wording character for character from `submitTeam()`**, so the coach sees the same sentence from both sides. |
| every field ≤ `MAX_FIELD_CHARS` (200), notes ≤ `MAX_NOTES_CHARS` (2000) | both | `That <field> is too long.` |
| roster ≤ `MAX_ROSTER` (30) regardless of group | team | as the cap message |
| `age-group`, if present, must be one of the fifteen | both | `<value> is not one of the tournament's age groups.` |

**The honeypot is accepted, not refused.** A bot told "no" tries again with the
field blank. A bot told "thank you" goes away. `validateSubmission` returns
`{ ok: true, drop: true }` and `handleSubmission` returns a normal success without
writing anything. Anything that behaves differently for a filled honeypot than for a
real submission — a different status code, a different response time, a different
body — hands the bot the answer.

- [ ] **Step 1: Write the failing tests.** One check per row of that table, plus:
  - each required field missing **individually** (loop over the list — a single
    "all fields missing" test passes even if only one field is actually checked);
  - the exact cap message for a real group, asserted as a whole string;
  - a 201-character field refused and a 200-character one accepted (both
    boundaries, not just one);
  - `players` submitted as `'not json'`, as `'{}'`, and as `'[]'`;
  - a filled honeypot returning `ok: true` with `drop: true`;
  - an `age-group` of `'U16B contact'` (wrong case) refused, so nothing downstream
    has to guess.

- [ ] **Step 2: Run and watch every one of them fail.**

- [ ] **Step 3: Implement `validateSubmission`.** Require `./_agegroups` for
  `squadCap` and `AGE_GROUP_BY_NAME`. Return on the **first** problem, in the order
  of the table above, so the coach gets one clear sentence rather than a list.

- [ ] **Step 4: Run and watch them pass.**

- [ ] **Step 5: Prove the client and the server agree.** A section in
  `tests/test-intake.js` that pulls the two message strings out of
  `Quins JRT.dc.html` and asserts the server produces the identical text for the
  identical input. This is the `test-venue-panel.js` pattern and it exists because
  two hand-written copies of one rule always drift. Add a fault that changes one
  word in the server's copy and prove the check catches it.

- [ ] **Step 6: Faults.** At minimum: the honeypot made to refuse instead of
  silently accept; the roster cap made `>=` instead of `>`; the length cap removed;
  the age-group check made case-insensitive. Each caught by its named check.

- [ ] **Step 7: Commit.**

---

## Task 5 — Rate limiting

**Files:** create `netlify/functions/_ratelimit.js`, `tests/test-intake.js` (new section)

**Interfaces produced:** `checkRate(store, key, now, { max, windowMs })` →
`{ ok, retryAfterSecs }`.

Netlify Forms was throttling this endpoint and nobody chose that. Without it, a
public function writes unbounded rows into a Google Sheet and sends unbounded mail
from `admin@adhjrt.com`.

Design:
- Key on `event.headers['x-nf-client-connection-ip']` (Netlify's own header — do
  **not** trust `x-forwarded-for` alone, it is caller-supplied).
- Counter in the `config` blob store under `ratelimit/<ip>`, holding
  `{ count, windowStart }`.
- **20 submissions per IP per hour.** A club secretary entering a whole age group
  by hand is the legitimate heavy user; twenty an hour is far past that and far
  short of useful abuse.
- A blob failure must **fail OPEN** (allow the submission) and log. Losing a real
  registration because the counter store hiccupped is much worse than the abuse it
  prevents, and the site password is still on.

- [ ] **Step 1:** Write tests against a fake store — under the limit, at the limit,
  over it, a window that has rolled over, a store that throws, and a missing IP
  (treat as one shared bucket, do not skip the check).
- [ ] **Step 2:** Watch them fail. **Step 3:** Implement. **Step 4:** Watch them pass.
- [ ] **Step 5:** Faults — the limit removed; the window never rolling over; a
  throwing store failing closed instead of open.
- [ ] **Step 6:** Commit.

---

## Task 6 — `handleSubmission()`, the whole flow with nothing real attached

**Files:** modify `netlify/functions/_intake.js`, `tests/test-intake.js`

**Interfaces produced:**

```js
async function handleSubmission(body, deps) -> { status, body }
// deps = {
//   now,                       // number, ms
//   ip,                        // string
//   rateStore,                 // blob-ish: get(key), setJSON(key, v)
//   loadRegistration,          // async () -> settings   (from _registration.js)
//   registrationState,         // (settings, now) -> { open, ... }
//   readTeamsSheet,            // async () -> rows[][]   (for the team code)
//   appendRow,                 // async (form, row) -> void
//   sendConfirmation,          // async (formName, data) -> { sent, count, reason }
//   parkFailed,                // async (form, data, err) -> void
//   log,                       // (msg) -> void   NEVER pass a field value to this
// }
```

The order matters and each step is there for a reason:

1. **Rate limit.** Cheapest check, and the one that has to happen before anything
   costs money.
2. **`cleanSubmission`.** Unknown form → 400. Log dropped field **names**.
3. **Honeypot.** Filled → return the same 200 a real submission returns, write
   nothing, send nothing.
4. **`validateSubmission`.** → 400 with the message and the field.
5. **Registration window.** `registrationState(await loadRegistration(), now).open`
   is false → 403, `Registration is not open.` *(This is the "three lines" that
   finishes sub-project 3. `registrationState` is already written, already shared
   with the front end and already tested at every boundary.)*
6. **Team code**, teams only — `nextTeamCode(club, ageGroup, await readTeamsSheet())`.
   A read failure falls through to `<prefix>1` with a warning, exactly as
   `submission-created.js` does today. Set `data['team-name'] = teamCode` before
   the email, because the template prints it.
7. **Append the row.** If this throws → `parkFailed(...)`, then **500** with
   `We could not save your entry — nothing has been registered. Please email
   admin@adhjrt.com and we will enter it for you.` The registration is in the
   dead-letter blob and can be replayed.
8. **Send the confirmation**, in its own try/catch, **swallowed**. The row is the
   record. A mail failure must never cost a registration and must never make the
   coach resubmit into a duplicate row. This is the existing rule in
   `submission-created.js` and it stays.
9. **200** `{ ok: true, teamCode }` (teams) or `{ ok: true }`.

- [ ] **Step 1:** Write the tests. Drive `handleSubmission` with fakes for every
  dep. Assert, at minimum:
  - the happy path for each form: exactly one `appendRow`, exactly one
    `sendConfirmation`, status 200, and for a team the code is in the response;
  - **the row that reaches `appendRow` is positionally identical to
    `teamRow`/`playerRow`** — the readers depend on it;
  - a filled honeypot: status 200, `appendRow` **not called**, `sendConfirmation`
    **not called**, and the response body byte-identical to the real success;
  - window closed: 403, nothing written, nothing sent;
  - append throws: 500, `parkFailed` called once, `sendConfirmation` **not** called;
  - mail throws: still 200, row still written — the failure is swallowed;
  - the teams-sheet read throws: still succeeds, code falls back, row still written;
  - **nothing passed to `log` contains any field value.** Assert this by putting a
    unique sentinel in every submitted field and checking no log line contains it.
    This is the check that stops a future edit logging a child's medical notes.

- [ ] **Step 2:** Watch them fail. **Step 3:** Implement. **Step 4:** Watch them pass.

- [ ] **Step 5:** Faults — the window check removed; the honeypot writing a row;
  `sendConfirmation` moved before the append; the append failure returning 200; the
  mail failure returning 500; `parkFailed` not called. Each caught by its named
  check.

- [ ] **Step 6:** Commit.

---

## Task 7 — The function

**Files:** create `netlify/functions/submit-registration.js`

Thin. It builds the real dependencies and calls `handleSubmission`. Nothing here is
tested directly, because nothing here has any logic — that is the whole point of the
split.

- Accept **POST only**; anything else → 405.
- Parse JSON. A body that will not parse → 400, `We could not read that submission.`
- **Reject a body over 64 KB** before parsing. The roster is the only large field
  and it is capped at 30 players.
- Build: `google.sheets` (lift `getAuth`, `privateKey` and `firstSheetName` out of
  `submission-created.js` — move them, do not copy them; that file is deleted in
  Task 9), `blobStore` from `_auth`, `sendConfirmation` from `_email`,
  `loadRegistration`/`registrationState` from `_registration`, `nextTeamCode` from
  `_teams`.
- `parkFailed` writes `{ form, data, error, at }` to the `config` store under
  `failed-submissions/<iso>-<random>`. **Say in a comment that this blob holds
  children's personal data**, so nobody later exposes that store casually.
- `Cache-Control: no-store` on every response.
- CORS: none. Same origin only.
- The catch-all logs `err.message` and returns a generic 500. **Never** put the
  submission in the log line.

- [ ] Commit.

---

## Task 8 — The client

**Files:** modify `Quins JRT.dc.html`

- [ ] **Step 1:** Rewrite `postRegistration` (around line 1592) to POST JSON to
  `/.netlify/functions/submit-registration` with `{ form, data }`, and to **read
  the server's error** out of the reply:

```js
  /* Posts to our own function, not to Netlify Forms. The function is the thing
     that decides whether a registration is acceptable, so the reply is worth
     reading: on a refusal it carries a sentence written for a coach, and
     showing that is the entire reason the gateway exists.

     A network failure and a refusal are DIFFERENT and must stay different. A
     refusal means "we received this and it is wrong" — the coach should fix it.
     A network failure means "we do not know whether we received it" — the coach
     should try again. Telling them to try again after a refusal would produce
     the same refusal forever. */
  async postRegistration(form, data) {
    let res;
    try {
      res = await fetch('/.netlify/functions/submit-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form, data }),
      });
    } catch (e) {
      throw new SubmitError(NETWORK_MESSAGE, true);
    }
    let payload = null;
    try { payload = await res.json(); } catch (e) { payload = null; }
    if (!res.ok || !payload || !payload.ok) {
      const msg = (payload && payload.error) || NETWORK_MESSAGE;
      throw new SubmitError(msg, !payload);
    }
    return payload;
  }
```

with `class SubmitError extends Error { constructor(message, isNetwork) { super(message); this.isNetwork = isNetwork; } }` and `NETWORK_MESSAGE` set to the existing
"We could not send your entry…" wording, kept verbatim.

- [ ] **Step 2:** Update `submitTeam()` and `submitPlayer()` to pass
  `(formName, fields)` and to show `e.message` rather than the fixed string. Keep
  the client-side checks exactly as they are — they give instant feedback and the
  server is the authority, not the replacement.
- [ ] **Step 3:** `submitTeam()` should show the returned `teamCode` on the success
  panel. The coach currently learns it from the email only.
- [ ] **Step 4:** Extend `tests/test-registration-panel.js` (or add
  `tests/test-submit-client.js`) to drive both submit methods against a fake
  `fetch`: a refusal shows the server's sentence, a network failure shows the retry
  sentence, a success clears the form, and a refusal **does not** clear it.
- [ ] **Step 5:** Faults — the server's message replaced by the generic one; a
  refusal clearing the form; `res.ok` ignored.
- [ ] **Step 6:** Run the binding check (every `{{ token }}` the markup uses is
  returned by `renderVals`) and the `sc-if`/`sc-for` balance check. Commit.

---

## Task 9 — Cutover

**Do not start this until Tasks 1–8 are committed and the whole suite is green on
Windows, including the fault run.**

- [ ] **Step 1: Test the OLD path first.** Submit one real team registration and one
  real player registration through the live site. Confirm both rows land in the
  sheets and **both confirmation emails arrive**. This is the baseline. If an email
  does not arrive now, stop — the problem is not the gateway.
- [ ] **Step 2:** Merge to `main` and deploy.
- [ ] **Step 3: Test the NEW path.** Same two submissions. Confirm rows, confirm
  both emails, confirm the team code appears on the success panel and matches the
  sheet.
- [ ] **Step 4: Test a refusal.** Submit a team with more players than the cap by
  editing the page, and confirm the coach-facing sentence comes back from the
  server. Then set the registration window to closed in `/organizer` and confirm a
  submission bounces with "Registration is not open." **Set it back to unset.**
- [ ] **Step 5:** Delete the rehearsal rows from both sheets — see
  `claude/runbooks/runbook-clearing-the-rehearsal-data.md`.
- [ ] **Step 6:** Only now: delete `netlify-forms.html` and
  `netlify/functions/submission-created.js`. Deploy. Re-run step 3 to prove the new
  path still works with the old one gone.
- [ ] **Step 7:** In Netlify, leave the Forms feature alone. It costs nothing and
  turning it off is a separate, reversible decision.
- [ ] **Step 8:** Update `CLAUDE.md`, `claude/state-of-play.md` and the status banner
  in `claude/specs/spec-registration-window.md` — sub-projects 1 and 3 are then complete.

---

## What this plan deliberately does NOT do

- **No age validation.** That is sub-project 2, and it is the one with a real-world
  reason to exist. This plan builds the place to put it: `validateSubmission` in
  `_intake.js`, with `_agegroups.js` already carrying `ages` for every group.
- **No change to what a registration contains.** No new fields, no new columns.
- **No removal of the site password.** That is Jay's, on the day, and this work
  makes the site *safer* to open, not ready to be opened.
- **No change to the emails.** `_email.js` is not touched. The gateway calls
  `sendConfirmation(formName, data)` with the same two arguments Netlify's webhook
  passes today.

## Self-review notes

- Every spec requirement for sub-project 1 has a task: moving the door (7, 8),
  deciding what still triggers the emails (6, step 8), re-testing the emails before
  and after (9, steps 1 and 3), doing it while there is no traffic (9).
- Sub-project 3's remaining "three lines" are Task 6 step 5 — folded in here rather
  than left dangling, because the window check is also the strongest abuse guard the
  new endpoint has.
- Names used consistently throughout: `cleanSubmission`, `validateSubmission`,
  `handleSubmission`, `teamRow`, `playerRow`, `TEAM_COLUMNS`, `PLAYER_COLUMNS`,
  `squadCap`, `checkRate`, `parkFailed`.
- Known gap, stated rather than hidden: Tasks 4, 5 and 6 give step-by-step
  instructions and full rule tables but not every line of test code, because the
  exact assertions depend on message strings that must be read out of
  `Quins JRT.dc.html` at implementation time and copied character for character.
  Inventing them here would produce a plan that looks authoritative and is wrong —
  the specific failure mode `claude/specs/spec-registration-window.md` warns about.
