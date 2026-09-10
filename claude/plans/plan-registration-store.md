# Registration Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `claude/specs/spec-registration-store-sep-2026.md`. Read it first; the
decisions and the arguments against them live there, not here.

**Goal:** Registrations are written once, one record each, to a Netlify Blobs
store instead of Google Sheets; a scheduled function emails a snapshot to the
registrations mailbox; a command-line tool restores or deletes with a
check-only step first.

**Architecture:** Two dependency-free modules carry every decision —
`_regstore.js` (record shape, keys, write-once, listing, superseded/rehearsal
rules, reader shaping) and `_snapshot.js` (snapshot building, send cadence,
restore and delete planning). The HTTP functions and the CLI are thin adapters
that inject a real store, the real mailer and the real clock. That is the
pattern `_intake.js` / `submit-registration.js` already use, and it is what
lets the suite prove everything without `node_modules`.

**Tech Stack:** Plain Node (CommonJS), `@netlify/blobs` (already a
dependency), Microsoft Graph via the existing `_email.js`, Netlify scheduled
function declared in `netlify.toml`, Netlify CLI for the tool's credentials.

## Global Constraints

- **Never `git add -A`.** Stage the exact paths each task names.
- **No new npm dependency.** `package.json` is not touched.
- **No registration VALUE in any log, test output, commit or doc.** Log field
  names and counts only. Fixtures use invented names and `example.com`.
- **The store module and the snapshot module must load with no
  `node_modules`** — they may `require` only Node built-ins and other
  dependency-free siblings (`_intake.js`, `_registration.js`, `_teams.js`).
- **Every new check is proven against an injected fault** in
  `tests/_prove-registration.js` before it is trusted (Task 8).
- **Commit on `dev`.** Branch deploys are free; production is not touched by
  this plan. No `[skip ci]` anywhere.
- **Tests read `tests/_lib.js`** (`section`, `check`, `eq`, `readRepo`,
  `summary`) and end with `summary('<file>.js')`.
- **Windows PowerShell 5.1 runs the suite**: `powershell tests/runall.ps1`.
  In a Bash tool, `node tests/<file>.js` runs one file.
- **`Export CSV` already exists** on the organiser page (`Organizer.dc.html`
  `exportCsv()`, client-side from the loaded tables). Spec § 5's export needs
  no new function. Do not build a second one.

## File map

| File | Responsibility |
|---|---|
| Create `netlify/functions/_regstore.js` | Record shape, keys, rehearsal rule, write-once, list, hide superseded, shape rows for the two readers, team rows for numbering |
| Create `netlify/functions/_snapshot.js` | Build CSV + machine snapshot, subject line, send cadence, restore plan, delete plan and its snapshot gate |
| Create `netlify/functions/snapshot-registrations.js` | Scheduled handler: list → build → email, always emails |
| Modify `netlify/functions/_email.js:79-112` | `sendMail` accepts `attachments` |
| Modify `netlify/functions/submit-registration.js:80-118` | `readTeamsSheet` and `appendRow` read/write the store |
| Modify `netlify/functions/get-registrations.js` | Reads the store, same response shape |
| Modify `netlify/functions/get-my-registrations.js` | Reads the store, same response shape |
| Modify `netlify.toml` | Schedule block for the snapshot function |
| Create `tools/registrations-admin.js` | CLI: `check`, `restore`, `delete` via Netlify CLI |
| Create `tests/test-regstore.js`, `tests/test-snapshot.js`, `tests/test-registrations-admin.js` | The checks |
| Modify `tests/runall.ps1`, `tests/_prove-registration.js` | Register the suites; add the faults |
| Modify `tests/test-organizer-clubs.js:429`, `tests/test-functions-load.js:136` | Repoint to the store (Task 3 / Task 9) |
| Create `claude/runbooks/runbook-registrations-restore-and-delete.md` | Three procedures |
| Modify `RESTORE.md` | New section; Google section becomes a tombstone at cutover |

---

### Task 1: The store module

**Files:**
- Create: `netlify/functions/_regstore.js`
- Test: `tests/test-regstore.js`

**Interfaces:**
- Produces:
  - `STORE_NAME = 'registrations'`
  - `PREFIX = { 'team-registration': 'team', 'player-registration': 'player', 'club-registration': 'club' }`
  - `isRehearsal(club: string): boolean`
  - `makeKey(form: string, nowMs: number, rand?: string): string` → `'<prefix>/<stamp>-<6 chars>'`
  - `buildRecord({ form, row: string[], nowMs, club, supersedes? }): Record` where `Record = { v: 1, form, receivedAt: ISO, row: string[], rehearsal: boolean, supersedes?: string }`
  - `writeOnce(store, key, record): Promise<void>` — throws `Error('exists: <key>')` if `store.get(key)` is non-null
  - `listRecords(store, form): Promise<Array<{ key, record }>>` — arrival order, superseded records removed
  - `listAll(store): Promise<Array<{ key, record }>>` — every form, superseded INCLUDED (the snapshot needs them)
  - `teamRowsForNumbering(store): Promise<string[][]>` — `row` arrays of live team records
  - `shapeForReaders(entries, mappers): { teams, players, clubs }` — applies `mapTeamRow` etc. and adds `rehearsal: true` to rehearsal rows
- The `store` argument has `get(key, { type: 'json' })`, `setJSON(key, obj)`, `list({ prefix })` → `{ blobs: [{ key }] }`, `delete(key)`. That is `@netlify/blobs`' shape and the fake in the test mirrors it.

- [ ] **Step 1: Write the failing test**

```js
/* tests/test-regstore.js
   The registration STORE — one write-once record per submission.
   Spec: claude/specs/spec-registration-store-sep-2026.md § 3, § 5. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const I = require(path.join(repoRoot(), 'netlify/functions/_intake.js'));

/* A fake with exactly the four calls the module uses, in @netlify/blobs' shape. */
function fakeStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    m,
    async get(key, opts) { return m.has(key) ? JSON.parse(JSON.stringify(m.get(key))) : null; },
    async setJSON(key, obj) { m.set(key, JSON.parse(JSON.stringify(obj))); },
    async list({ prefix }) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix || '')).sort().map((key) => ({ key })) }; },
    async delete(key) { m.delete(key); },
  };
}

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const teamRow = (club, code, age) => I.teamRow({ club, 'age-group': age, 'team-name': code }, code, new Date(T0).toISOString());

section('Keys');
{
  const k = R.makeKey('player-registration', T0, 'k3f9qa');
  eq('key is <prefix>/<safe stamp>-<rand>', k, 'player/2026-10-03T08-15-42-117Z-k3f9qa');
  check('the stamp has no colon or dot (blob keys, Windows files)', !/[:.]/.test(k.split('/')[1]));
  const a = R.makeKey('team-registration', T0), b = R.makeKey('team-registration', T0);
  check('two keys in the same instant differ', a !== b);
  check('team prefix', a.startsWith('team/'));
  eq('club prefix', R.makeKey('club-registration', T0, 'abcdef').split('/')[0], 'club');
  check('keys sort in arrival order', R.makeKey('team-registration', T0, 'zzzzzz') < R.makeKey('team-registration', T0 + 1000, 'aaaaaa'));
}

section('Rehearsal flag');
{
  check('"Rehearsal Quins" is a rehearsal', R.isRehearsal('Rehearsal Quins'));
  check('case-insensitive', R.isRehearsal('rehearsal quins'));
  check('"Rehearsals FC" is NOT (whole word)', !R.isRehearsal('Rehearsals FC'));
  check('a real club is not', !R.isRehearsal('Abu Dhabi Harlequins'));
  check('empty is not', !R.isRehearsal(''));
  const rec = R.buildRecord({ form: 'team-registration', row: teamRow('Rehearsal Quins', 'REH1', 'U12 Mixed Contact'), nowMs: T0, club: 'Rehearsal Quins' });
  eq('record carries the flag', rec.rehearsal, true);
}

section('The record');
{
  const row = teamRow('Abu Dhabi Harlequins', 'ADH1', 'U12 Mixed Contact');
  const rec = R.buildRecord({ form: 'team-registration', row, nowMs: T0, club: 'Abu Dhabi Harlequins' });
  eq('format version 1', rec.v, 1);
  eq('form', rec.form, 'team-registration');
  eq('receivedAt is the server clock, ISO', rec.receivedAt, '2026-10-03T08:15:42.117Z');
  eq('row is the SHEET column order, untouched', rec.row, row);
  eq('the club column is where TEAM_COLUMNS says', rec.row[I.TEAM_COLUMNS.indexOf('club')], 'Abu Dhabi Harlequins');
  eq('not a rehearsal', rec.rehearsal, false);
  check('no supersedes unless given', !('supersedes' in rec));
  const fix = R.buildRecord({ form: 'team-registration', row, nowMs: T0, club: 'Abu Dhabi Harlequins', supersedes: 'team/x' });
  eq('supersedes is kept when given', fix.supersedes, 'team/x');
}

section('⚠️ Write once — the rule everything else leans on');
{
  const s = fakeStore();
  const rec = R.buildRecord({ form: 'player-registration', row: ['a'], nowMs: T0, club: 'X' });
  return_ok: {
    R.writeOnce(s, 'player/k1', rec).then(async () => {
      eq('a fresh key is written', (await s.get('player/k1')).form, 'player-registration');
      let threw = null;
      try { await R.writeOnce(s, 'player/k1', { ...rec, row: ['CHANGED'] }); } catch (e) { threw = e; }
      check('a second write to the same key is REFUSED', !!threw && /exists/.test(threw.message));
      eq('…and the stored record is unchanged', (await s.get('player/k1')).row, ['a']);
      check('the module exposes no update/overwrite call', !('update' in R) && !('overwrite' in R) && !('set' in R));

      /* ---- listing ---- */
      const s2 = fakeStore();
      const older = R.buildRecord({ form: 'team-registration', row: teamRow('Abu Dhabi Harlequins', 'ADH1', 'U12 Mixed Contact'), nowMs: T0, club: 'Abu Dhabi Harlequins' });
      const newer = R.buildRecord({ form: 'team-registration', row: teamRow('Abu Dhabi Harlequins', 'ADH1', 'U12 Mixed Contact'), nowMs: T0 + 5000, club: 'Abu Dhabi Harlequins', supersedes: 'team/a' });
      const other = R.buildRecord({ form: 'team-registration', row: teamRow('Dubai Exiles', 'DEX1', 'U12 Mixed Contact'), nowMs: T0 + 1000, club: 'Dubai Exiles' });
      const pl = R.buildRecord({ form: 'player-registration', row: ['p'], nowMs: T0, club: 'Dubai Exiles' });
      await R.writeOnce(s2, 'team/a', older);
      await R.writeOnce(s2, 'team/b', other);
      await R.writeOnce(s2, 'team/c', newer);
      await R.writeOnce(s2, 'player/a', pl);

      const teams = await R.listRecords(s2, 'team-registration');
      eq('listRecords hides the SUPERSEDED record and keeps the rest, in key order', teams.map((e) => e.key), ['team/b', 'team/c']);
      eq('listRecords is per form', (await R.listRecords(s2, 'player-registration')).map((e) => e.key), ['player/a']);
      eq('listAll returns EVERY record including superseded (the snapshot needs them)', (await R.listAll(s2)).map((e) => e.key).sort(), ['player/a', 'team/a', 'team/b', 'team/c']);

      /* ---- numbering ---- */
      const rows = await R.teamRowsForNumbering(s2);
      eq('numbering rows are live team rows only, sheet shape', rows.length, 2);
      eq('…positions match what _teams.nextTeamCode reads (club at 1, code at 2, age at 3)', [rows[0][1], rows[0][2], rows[0][3]], ['Dubai Exiles', 'DEX1', 'U12 Mixed Contact']);

      /* ---- reader shaping ---- */
      const shaped = R.shapeForReaders(
        { teams: await R.listRecords(s2, 'team-registration'), players: await R.listRecords(s2, 'player-registration'), clubs: [] },
        { mapTeamRow: I.mapTeamRow, mapPlayerRow: I.mapPlayerRow, mapClubRow: I.mapClubRow });
      eq('teams shaped through the shared mapper', shaped.teams.map((t) => t.teamName), ['DEX1', 'ADH1']);
      eq('a non-rehearsal row has no marker', shaped.teams[0].rehearsal, false);
      const s3 = fakeStore();
      await R.writeOnce(s3, 'team/r', R.buildRecord({ form: 'team-registration', row: teamRow('Rehearsal Quins', 'REH1', 'U9 Mixed Contact'), nowMs: T0, club: 'Rehearsal Quins' }));
      const shaped3 = R.shapeForReaders({ teams: await R.listRecords(s3, 'team-registration'), players: [], clubs: [] }, { mapTeamRow: I.mapTeamRow, mapPlayerRow: I.mapPlayerRow, mapClubRow: I.mapClubRow });
      eq('a rehearsal row carries rehearsal: true for the organiser page', shaped3.teams[0].rehearsal, true);

      section('Dependency-free');
      const src = readRepo('netlify/functions/_regstore.js');
      check('requires no package (only ./ siblings and node built-ins)',
        !/require\(['"](?!\.\/|crypto|path|fs|os)[^'"]+['"]\)/.test(src));

      summary('test-regstore.js');
    });
  }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/test-regstore.js`
Expected: `Error: Cannot find module '.../_regstore.js'`

- [ ] **Step 3: Write the module**

```js
// netlify/functions/_regstore.js
//
// THE REGISTRATION STORE — one write-once record per accepted submission.
// Spec: claude/specs/spec-registration-store-sep-2026.md (§ 3 the record,
// § 5 the readers). Replaces the three Google Sheets as the place a
// registration lives; the sheet COLUMN ORDER survives inside each record so
// nothing downstream had to learn a new layout.
//
// ⚠️ THERE IS NO UPDATE HERE, ON PURPOSE. writeOnce() refuses a key that
// already exists and nothing in this module can overwrite. A correction is a
// NEW record carrying `supersedes: <old key>`; listRecords() hides the old one.
// This is what makes restore safe (it can only ever add) and what makes a bug
// that overwrites a child's registration impossible by construction.
//
// Dependency-free: the store is passed in, so tests run without node_modules.
// The store has @netlify/blobs' shape — get(key, {type:'json'}), setJSON,
// list({prefix}) → {blobs:[{key}]}, delete(key).

const crypto = require('crypto');
const { TEAM_COLUMNS } = require('./_intake');

const STORE_NAME = 'registrations';

const PREFIX = {
  'team-registration': 'team',
  'player-registration': 'player',
  'club-registration': 'club',
};

/* A club whose name STARTS with the word "Rehearsal" is a rehearsal. Whole
   word and case-insensitive: "Rehearsal Quins" yes, "Rehearsals FC" no. The
   flag is stored on the record so the delete tool can remove rehearsal
   records alone and the snapshot subject can shout REHEARSAL. */
function isRehearsal(club) {
  return /^\s*rehearsal\b/i.test(String(club || ''));
}

/* '<prefix>/<ISO stamp with : and . replaced>-<6 random chars>'. Sorts in
   arrival order; the suffix stops two submissions in one millisecond colliding.
   `rand` is a parameter only so a test can pin the key. */
function makeKey(form, nowMs, rand) {
  const prefix = PREFIX[form];
  if (!prefix) throw new Error('unknown form: ' + form);
  const stamp = new Date(nowMs).toISOString().replace(/[:.]/g, '-');
  const r = rand || crypto.randomBytes(4).toString('hex').slice(0, 6);
  return `${prefix}/${stamp}-${r}`;
}

function buildRecord({ form, row, nowMs, club, supersedes }) {
  if (!PREFIX[form]) throw new Error('unknown form: ' + form);
  if (!Array.isArray(row)) throw new Error('row must be an array');
  const rec = {
    v: 1,
    form,
    receivedAt: new Date(nowMs).toISOString(),
    row: row.slice(),
    rehearsal: isRehearsal(club),
  };
  if (supersedes) rec.supersedes = String(supersedes);
  return rec;
}

/* Refuses if the key exists. The key's random suffix is what makes collisions
   improbable; this check is the guard that makes overwriting impossible even
   if a caller reuses a key by mistake. */
async function writeOnce(store, key, record) {
  const existing = await store.get(key, { type: 'json' });
  if (existing !== null && existing !== undefined) throw new Error('exists: ' + key);
  await store.setJSON(key, record);
}

async function listPrefix(store, prefix) {
  const res = await store.list({ prefix: prefix + '/' });
  const keys = ((res && res.blobs) || []).map((b) => b.key).sort();
  const out = [];
  for (const key of keys) {
    const record = await store.get(key, { type: 'json' });
    if (record && typeof record === 'object' && Array.isArray(record.row)) out.push({ key, record });
  }
  return out;
}

/* Live records for one form: every record, minus any that a later record
   names in `supersedes`. */
async function listRecords(store, form) {
  const prefix = PREFIX[form];
  if (!prefix) throw new Error('unknown form: ' + form);
  const all = await listPrefix(store, prefix);
  const superseded = new Set(all.map((e) => e.record.supersedes).filter(Boolean));
  return all.filter((e) => !superseded.has(e.key));
}

/* EVERYTHING, superseded included — the snapshot must carry the full history
   so a restore puts back exactly what was there. */
async function listAll(store) {
  const out = [];
  for (const prefix of Object.values(PREFIX)) out.push(...(await listPrefix(store, prefix)));
  return out;
}

/* nextTeamCode() in _teams.js reads rows positionally — club at 1, code at 2,
   age group at 3 — which is the TEAM_COLUMNS order, and the record's row IS
   that order. Superseded rows are excluded: a corrected team must not keep
   its old code alive for numbering. */
async function teamRowsForNumbering(store) {
  const live = await listRecords(store, 'team-registration');
  return live.map((e) => e.record.row);
}

/* Shapes store entries into what the two reader functions have always
   returned, through the SAME mappers the sheet rows went through. Adds
   `rehearsal` so the organiser page can mark a rehearsal row. */
function shapeForReaders(entries, mappers) {
  const tag = (mapper) => (e) => ({ ...mapper(e.record.row), rehearsal: e.record.rehearsal === true });
  return {
    teams: (entries.teams || []).map(tag(mappers.mapTeamRow)),
    players: (entries.players || []).map(tag(mappers.mapPlayerRow)),
    clubs: (entries.clubs || []).map(tag(mappers.mapClubRow)),
  };
}

module.exports = {
  STORE_NAME, PREFIX, TEAM_COLUMNS_CLUB_INDEX: TEAM_COLUMNS.indexOf('club'),
  isRehearsal, makeKey, buildRecord, writeOnce, listRecords, listAll,
  teamRowsForNumbering, shapeForReaders,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-regstore.js`
Expected: last line `test-regstore.js: 36/36 checks passed` (the exact total
may differ by one or two; every check must pass and none may print `FAIL`).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_regstore.js tests/test-regstore.js
git status --porcelain --untracked-files=all
git commit -F - <<'EOF'
The registration store module — one write-once record per submission

Dependency-free, store injected. Keys sort in arrival order, no update
exists, superseded records are hidden from readers and kept for the
snapshot, the rehearsal flag is set from the club name.
Spec: claude/specs/spec-registration-store-sep-2026.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The front door writes the store

**Files:**
- Modify: `netlify/functions/submit-registration.js:80-118` (the `readTeamsSheet` and `appendRow` deps)
- Test: `tests/test-regstore.js` (new section, reads the adapter as text)

**Interfaces:**
- Consumes from Task 1: `STORE_NAME`, `makeKey`, `buildRecord`, `writeOnce`, `teamRowsForNumbering`.
- `handleSubmission`'s dep names `readTeamsSheet` and `appendRow(form, row)` are **kept** so `_intake.js` and its 400+ checks are untouched. Only the adapter changes.

- [ ] **Step 1: Add the failing checks to `tests/test-regstore.js`** (before `summary`)

```js
      section('The front door writes the store, not a sheet');
      const door = readRepo('netlify/functions/submit-registration.js');
      check('requires _regstore', /require\(['"]\.\/_regstore['"]\)/.test(door));
      check('opens the registrations store by name', /blobStore\(STORE_NAME\)/.test(door));
      check('appendRow writes through writeOnce', /appendRow:[\s\S]*?writeOnce\(/.test(door));
      check('appendRow builds the record with the club for the rehearsal flag', /buildRecord\(\{[^}]*club/.test(door));
      check('readTeamsSheet counts store records', /readTeamsSheet:[\s\S]*?teamRowsForNumbering\(/.test(door));
      check('no sheet write remains on the front door', !/values\.append/.test(door));
      check('no sheet read remains on the front door', !/values\.get/.test(door));
      check('the dead letter (parkFailed) is untouched', /parkFailed:[\s\S]*?failed-submissions\//.test(door));
```

- [ ] **Step 2: Run it to verify the new checks fail**

Run: `node tests/test-regstore.js`
Expected: `FAIL  requires _regstore` and the five store checks fail; `no sheet write remains` fails.

- [ ] **Step 3: Rewrite the two deps in `submit-registration.js`**

Replace the `require('./_sheets')` line and the `readTeamsSheet` / `appendRow`
blocks (lines 43 and 84–113 in the current file) with:

```js
const { STORE_NAME, makeKey, buildRecord, writeOnce, teamRowsForNumbering } = require('./_regstore');
```

and, inside the `handleSubmission` deps object:

```js
      /* Team numbering reads the STORE (Sep 2026; it used to read the teams
         sheet). Live team records only — a superseded team must not keep its
         old code alive. A failure here REFUSES the submission, see _intake.js
         step 5: numbering from an empty list mints a duplicate code. */
      readTeamsSheet: async () => teamRowsForNumbering(blobStore(STORE_NAME)),

      /* THE RECORD (Sep 2026; it used to append a sheet row). One key per
         submission, write-once — _regstore.js refuses an existing key and has
         no update. The row keeps the sheet column order, so the readers'
         mappers are unchanged. The club is read out of the row by position so
         the rehearsal flag can be set without _intake.js knowing about it. */
      appendRow: async (form, row) => {
        const spec = FORMS[form];
        const club = row[spec.columns.indexOf('club')];
        const store = blobStore(STORE_NAME);
        const nowMs = Date.now();
        await writeOnce(store, makeKey(form, nowMs), buildRecord({ form, row, nowMs, club }));
      },
```

Leave `parkFailed`, `sendConfirmation`, `log`, `rateStore`,
`loadRegistration` and `registrationState` exactly as they are. Update the
header comment's `200 { ok: true, teamCode? }   accepted, row written` to
`accepted, record stored`.

- [ ] **Step 4: Run the tests**

Run: `node tests/test-regstore.js && node tests/test-intake.js && node --check netlify/functions/submit-registration.js`
Expected: both suites pass; `--check` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/submit-registration.js tests/test-regstore.js
git commit -F - <<'EOF'
The front door writes a store record instead of a sheet row

Team numbering counts live team records. _intake.js and its checks are
untouched — only the two injected deps changed. The dead letter stays.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The two readers read the store

**Files:**
- Modify: `netlify/functions/get-registrations.js` (whole file body)
- Modify: `netlify/functions/get-my-registrations.js` (whole file body)
- Modify: `tests/test-organizer-clubs.js:429-431`
- Test: `tests/test-regstore.js` (new section)

**Interfaces:**
- Consumes from Task 1: `STORE_NAME`, `listRecords`, `shapeForReaders`.
- Produces: unchanged HTTP response shapes —
  `{ ok, teams, players, clubs, clubsUnavailable }` and `{ ok, scope, teams, players }` — plus `rehearsal: boolean` on every row (additive).

- [ ] **Step 1: Add the failing checks to `tests/test-regstore.js`**

```js
      section('The readers read the store, in the same shape');
      for (const f of ['get-registrations.js', 'get-my-registrations.js']) {
        const src = readRepo('netlify/functions/' + f);
        check(`${f} requires _regstore`, /require\(['"]\.\/_regstore['"]\)/.test(src));
        check(`${f} lists live records`, /listRecords\(/.test(src));
        check(`${f} shapes through the shared mappers`, /shapeForReaders\(/.test(src));
        check(`${f} no longer reads a sheet`, !/sheetsClient|firstSheetName|GOOGLE_SHEET_ID/.test(src));
        check(`${f} still resolves the session first`, /resolveSession\(event\)/.test(src));
      }
      const org = readRepo('netlify/functions/get-registrations.js');
      check('organiser reader still refuses non-organisers', /role !== 'organizer'/.test(org));
      check('organiser reader still answers clubsUnavailable', /clubsUnavailable/.test(org));
      const mine = readRepo('netlify/functions/get-my-registrations.js');
      check('manager reader still filters by the TOKEN age group, not the request', /session\.ageGroupId/.test(mine) && !/event\.body[\s\S]*ageGroup/.test(mine));
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tests/test-regstore.js`
Expected: the `requires _regstore`, `lists live records`, `shapes`, `no longer reads a sheet` checks fail for both files.

- [ ] **Step 3: Rewrite `get-registrations.js`**

```js
// netlify/functions/get-registrations.js
//
// Returns every team, player and club registration for a signed-in
// ORGANIZER. Reads the registrations store (Sep 2026; it read three Google
// Sheets before that — see RESTORE.md § Registration store). The token is
// verified here (_auth.js), so the store is never exposed.
const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { mapTeamRow, mapPlayerRow, mapClubRow } = require('./_intake');
const { STORE_NAME, listRecords, shapeForReaders } = require('./_regstore');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const sess = await resolveSession(event);
    if (!sess.ok) return sessionRefusal(sess);
    if (sess.session.role !== 'organizer') {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Only tournament organisers can see every age group’s registrations.' }) };
    }

    const store = blobStore(STORE_NAME);

    /* Clubs FAIL SOFT, as they always have: a declaration is a planning
       nicety; teams and players are the tournament. null = could not read,
       told apart from "nobody has declared yet" by clubsUnavailable. */
    const readClubs = async () => {
      try { return await listRecords(store, 'club-registration'); } catch (err) {
        console.error('get-registrations: clubs unreadable -', err && err.message);
        return null;
      }
    };

    const [teams, players, clubs] = await Promise.all([
      listRecords(store, 'team-registration'),
      listRecords(store, 'player-registration'),
      readClubs(),
    ]);

    const shaped = shapeForReaders({ teams, players, clubs: clubs || [] }, { mapTeamRow, mapPlayerRow, mapClubRow });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ...shaped, clubsUnavailable: clubs === null }),
    };
  } catch (err) {
    console.error('get-registrations error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
```

- [ ] **Step 4: Rewrite `get-my-registrations.js`**

Keep the header comment's first two paragraphs and `AGE_GROUP_NAME_BY_ID`
and `norm` exactly as they are. Replace the requires and the handler body:

```js
const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { mapTeamRow, mapPlayerRow, mapClubRow } = require('./_intake');
const { STORE_NAME, listRecords, shapeForReaders } = require('./_regstore');

// ... AGE_GROUP_NAME_BY_ID and norm unchanged ...

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const sess = await resolveSession(event);
    if (!sess.ok) return sessionRefusal(sess);
    const session = sess.session;

    // From the TOKEN only. Organizers and the "*" admin-manager see every
    // group; an ordinary manager sees exactly one, by age-group NAME.
    const seesEverything = session.role === 'organizer' || session.ageGroupId === '*';
    const allowedName = seesEverything ? null : AGE_GROUP_NAME_BY_ID[session.ageGroupId];
    if (!seesEverything && !allowedName) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'No age group is set on this account.' }) };
    }

    const store = blobStore(STORE_NAME);
    const [teams, players] = await Promise.all([
      listRecords(store, 'team-registration'),
      listRecords(store, 'player-registration'),
    ]);
    const shaped = shapeForReaders({ teams, players, clubs: [] }, { mapTeamRow, mapPlayerRow, mapClubRow });
    const keep = (row) => seesEverything || norm(row.ageGroup) === norm(allowedName);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, scope: allowedName || 'all', teams: shaped.teams.filter(keep), players: shaped.players.filter(keep) }),
    };
  } catch (err) {
    console.error('get-my-registrations error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
```

- [ ] **Step 5: Repoint `tests/test-organizer-clubs.js:429-431`**

Replace:
```js
  check('the function reads the clubs sheet', /GOOGLE_SHEET_ID_CLUBS/.test(fn));
  check('…through the shared range and mapper, not a hand-written copy',
    /CLUB_RANGE/.test(fn) && /mapClubRow/.test(fn));
```
with:
```js
  check('the function reads the club records from the store', /listRecords\(store, 'club-registration'\)/.test(fn));
  check('…through the shared mapper, not a hand-written copy', /mapClubRow/.test(fn));
```

- [ ] **Step 6: Run the tests**

Run: `node tests/test-regstore.js && node tests/test-organizer-clubs.js && node --check netlify/functions/get-registrations.js && node --check netlify/functions/get-my-registrations.js`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/get-registrations.js netlify/functions/get-my-registrations.js tests/test-organizer-clubs.js tests/test-regstore.js
git commit -F - <<'EOF'
The two readers read the store; response shapes unchanged

Organiser sees all, manager sees the token's age group, clubs fail soft,
every row additionally carries rehearsal: true|false for the page marker.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: The snapshot module

**Files:**
- Create: `netlify/functions/_snapshot.js`
- Test: `tests/test-snapshot.js`

**Interfaces:**
- Consumes from Task 1: entries `Array<{ key, record }>`; `PREFIX`; `FORMS[form].columns` from `_intake.js`.
- Produces:
  - `csvCell(v): string` — quotes, doubles inner quotes, prefixes `'` when the value starts with `=`, `+`, `-`, `@` (formula injection)
  - `buildCsv(form, entries): string` — header row = `FORMS[form].columns`, then one row per entry, `\r\n` line ends
  - `buildSnapshot(entries, nowMs): { takenAt, counts: {team, player, club}, rehearsal: boolean, machine: object, csv: { team, player, club }, subject: string }`
    - `machine = { v: 1, takenAt, records: [{ key, record }] }`
    - `subject = 'ADH JRT registrations snapshot YYYY-MM-DD HH:MM UTC — T teams, P players, C clubs' + (rehearsal ? ' — REHEARSAL' : '')`
  - `shouldSend(nowMs, windowOpen): boolean` — `true` when open; otherwise only in the 22:00 UTC hour (02:00 Abu Dhabi)
  - `runSnapshot(deps): Promise<{ sent: boolean, subject: string, counts?, error? }>` with `deps = { listAll(), windowOpen(): Promise<boolean>, now: number, sendMail({to, subject, html, attachments}), mailFrom: string, force?: boolean }` — ALWAYS sends an email if it decides to run, even when `listAll` throws (the email then says so)
  - `restorePlan(machine, existingKeys: Set<string>): { missing: Array<{key, record}>, present: number, rehearsal: number }`
  - `deletePlan(entries, { rehearsalOnly }): Array<string>` keys to delete
  - `canDelete(machineTakenAt: string, entries): { ok: boolean, newest: string|null }` — ok when the snapshot is not older than the newest `receivedAt`

- [ ] **Step 1: Write the failing test**

```js
/* tests/test-snapshot.js
   The emailed snapshot, its cadence, and the restore/delete PLANS the CLI
   tool runs. Spec § 6, § 7. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');
const S = require(path.join(repoRoot(), 'netlify/functions/_snapshot.js'));
const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const I = require(path.join(repoRoot(), 'netlify/functions/_intake.js'));

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const teamRow = (club, code, age) => I.teamRow({ club, 'age-group': age, 'team-name': code, notes: '=HYPERLINK("x")' }, code, new Date(T0).toISOString());
const e = (key, form, club, extra) => ({ key, record: R.buildRecord({ form, row: form === 'team-registration' ? teamRow(club, 'X1', 'U9 Mixed Contact') : ['a', club], nowMs: T0, club, ...(extra || {}) }) });

const entries = [
  e('team/a', 'team-registration', 'Abu Dhabi Harlequins'),
  e('team/b', 'team-registration', 'Rehearsal Quins'),
  e('player/a', 'player-registration', 'Dubai Exiles'),
];

section('CSV cells are spreadsheet-safe');
eq('plain', S.csvCell('abc'), '"abc"');
eq('inner quotes doubled', S.csvCell('a"b'), '"a""b"');
eq('leading = is neutralised', S.csvCell('=1+1'), '"\'=1+1"');
eq('leading + is neutralised (phone numbers)', S.csvCell('+971500000000'), '"\'+971500000000"');
eq('leading - and @ too', [S.csvCell('-x'), S.csvCell('@x')], ['"\'-x"', '"\'@x"']);
eq('null is empty', S.csvCell(null), '""');

section('buildCsv');
{
  const csv = S.buildCsv('team-registration', entries.filter((x) => x.record.form === 'team-registration'));
  const lines = csv.split('\r\n');
  eq('header row is the sheet column order', lines[0], I.TEAM_COLUMNS.map((c) => '"' + c + '"').join(','));
  eq('one line per record', lines.length, 3);
  check('the formula in notes is neutralised in the file', /"'=HYPERLINK/.test(csv));
}

section('buildSnapshot');
{
  const snap = S.buildSnapshot(entries, T0);
  eq('takenAt', snap.takenAt, '2026-10-03T08:15:42.117Z');
  eq('counts per form', snap.counts, { team: 2, player: 1, club: 0 });
  eq('rehearsal flag when any record is a rehearsal', snap.rehearsal, true);
  eq('machine file carries EVERY entry with its key', snap.machine.records.map((r) => r.key), ['team/a', 'team/b', 'player/a']);
  eq('machine file version', snap.machine.v, 1);
  check('subject names date, counts and REHEARSAL', /2026-10-03 08:15 UTC/.test(snap.subject) && /2 teams, 1 players, 0 clubs/.test(snap.subject) && /REHEARSAL$/.test(snap.subject));
  eq('no REHEARSAL when none', /REHEARSAL/.test(S.buildSnapshot([entries[0]], T0).subject), false);
  check('csv for all three forms', typeof snap.csv.team === 'string' && typeof snap.csv.player === 'string' && typeof snap.csv.club === 'string');
}

section('Cadence');
{
  const at = (h) => Date.parse(`2026-10-03T${String(h).padStart(2, '0')}:05:00Z`);
  check('window open → every hour sends', [0, 7, 13, 22].every((h) => S.shouldSend(at(h), true)));
  check('window closed → only the 22:00 UTC hour (02:00 Abu Dhabi)', S.shouldSend(at(22), false) && !S.shouldSend(at(21), false) && !S.shouldSend(at(9), false));
}

section('⚠️ runSnapshot ALWAYS emails — a silent failure is not a snapshot');
{
  const sent = [];
  const mailer = async (m) => { sent.push(m); return { sent: true, count: 1 }; };
  S.runSnapshot({ listAll: async () => entries, windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' }).then(async (r) => {
    eq('sent', r.sent, true);
    eq('to the tournament mailbox ONLY', sent[0].to, 'registrations@adhjrt.com');
    eq('two attachments per form set: 3 csv + 1 machine', sent[0].attachments.length, 4);
    check('machine attachment is JSON named registrations-<stamp>.json', sent[0].attachments.some((a) => /^registrations-.*\.json$/.test(a.name) && a.contentType === 'application/json'));
    check('csv attachments named per form', ['team', 'player', 'club'].every((f) => sent[0].attachments.some((a) => a.name === `registrations-${f}.csv`)));
    check('attachment bytes are base64', sent[0].attachments.every((a) => /^[A-Za-z0-9+/=]+$/.test(a.contentBytes)));
    check('no registration VALUE in the html body', !/Abu Dhabi Harlequins|Dubai Exiles/.test(sent[0].html));

    sent.length = 0;
    const r2 = await S.runSnapshot({ listAll: async () => { throw new Error('blobs down'); }, windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
    eq('store unreadable → STILL sends', r2.sent, true);
    check('…and the subject says FAILED', /FAILED/.test(sent[0].subject));
    check('…and the body carries the error message', /blobs down/.test(sent[0].html));

    sent.length = 0;
    const r3 = await S.runSnapshot({ listAll: async () => entries, windowOpen: async () => false, now: Date.parse('2026-10-03T09:05:00Z'), sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
    eq('closed window at 09:00 UTC → not this hour', r3.sent, false);
    eq('…and nothing was sent', sent.length, 0);
    const r4 = await S.runSnapshot({ listAll: async () => entries, windowOpen: async () => false, now: Date.parse('2026-10-03T09:05:00Z'), sendMail: mailer, mailFrom: 'registrations@adhjrt.com', force: true });
    eq('force overrides the cadence (for the rehearsal)', r4.sent, true);

    section('restorePlan writes only what is MISSING');
    const machine = S.buildSnapshot(entries, T0).machine;
    const plan = S.restorePlan(machine, new Set(['team/a']));
    eq('missing = the two not in the store', plan.missing.map((m) => m.key), ['team/b', 'player/a']);
    eq('present count', plan.present, 1);
    eq('rehearsal count among missing', plan.rehearsal, 1);
    eq('a present key is never in the plan, even if its record differs', S.restorePlan({ ...machine, records: [{ key: 'team/a', record: { ...entries[0].record, row: ['CHANGED'] } }] }, new Set(['team/a'])).missing.length, 0);
    let threw = null; try { S.restorePlan({ v: 99, records: [] }, new Set()); } catch (err) { threw = err; }
    check('an unknown machine-file version is refused', !!threw);

    section('deletePlan and its gate');
    eq('--rehearsal deletes rehearsal records only', S.deletePlan(entries, { rehearsalOnly: true }), ['team/b']);
    eq('--all deletes everything', S.deletePlan(entries, { rehearsalOnly: false }).sort(), ['player/a', 'team/a', 'team/b']);
    eq('canDelete: snapshot at least as new as the newest record → ok', S.canDelete('2026-10-03T08:15:42.117Z', entries).ok, true);
    eq('canDelete: snapshot OLDER than the newest record → refused', S.canDelete('2026-10-03T08:15:42.116Z', entries).ok, false);
    eq('canDelete: empty store → ok', S.canDelete('2020-01-01T00:00:00.000Z', []).ok, true);
    eq('canDelete: junk stamp → refused', S.canDelete('yesterday', entries).ok, false);

    section('Dependency-free');
    const src = readRepo('netlify/functions/_snapshot.js');
    check('requires no package', !/require\(['"](?!\.\/|crypto|path|fs|os)[^'"]+['"]\)/.test(src));

    summary('test-snapshot.js');
  });
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/test-snapshot.js`
Expected: `Cannot find module '.../_snapshot.js'`

- [ ] **Step 3: Write the module**

```js
// netlify/functions/_snapshot.js
//
// THE SNAPSHOT — what gets emailed to the registrations mailbox, how often,
// and the restore/delete PLANS the command-line tool executes.
// Spec: claude/specs/spec-registration-store-sep-2026.md § 6, § 7.
//
// Two attachments kinds: CSV per form for humans, and ONE machine file
// (every record exactly as stored, with its key) which is the ONLY thing
// restore reads. A spreadsheet reformats cells — a leading + on a phone
// number is the known case — so a restore from the readable columns would
// quietly corrupt what it puts back.
//
// ⚠️ runSnapshot() ALWAYS sends when it decides to run, even when the store
// cannot be read: the email then says FAILED. A snapshot that fails silently
// is not a snapshot.
//
// Dependency-free: the mailer and the store listing are injected.

const { FORMS } = require('./_intake');
const { PREFIX } = require('./_regstore');

/* Quote every cell; double inner quotes; neutralise a leading = + - @ with an
   apostrophe so nothing a registrant typed becomes a live formula in Excel or
   Sheets. The same rule the organiser page's csvSafe() applies. */
function csvCell(v) {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCsv(form, entries) {
  const columns = FORMS[form].columns;
  const lines = [columns.map(csvCell).join(',')];
  for (const e of entries) lines.push(columns.map((_, i) => csvCell(e.record.row[i])).join(','));
  return lines.join('\r\n');
}

const byForm = (entries, form) => entries.filter((e) => e.record.form === form);

function buildSnapshot(entries, nowMs) {
  const takenAt = new Date(nowMs).toISOString();
  const counts = {
    team: byForm(entries, 'team-registration').length,
    player: byForm(entries, 'player-registration').length,
    club: byForm(entries, 'club-registration').length,
  };
  const rehearsal = entries.some((e) => e.record.rehearsal === true);
  const stamp = takenAt.slice(0, 16).replace('T', ' ') + ' UTC';
  const subject = `ADH JRT registrations snapshot ${stamp} — ${counts.team} teams, ${counts.player} players, ${counts.club} clubs` + (rehearsal ? ' — REHEARSAL' : '');
  return {
    takenAt, counts, rehearsal, subject,
    machine: { v: 1, takenAt, records: entries.map((e) => ({ key: e.key, record: e.record })) },
    csv: {
      team: buildCsv('team-registration', byForm(entries, 'team-registration')),
      player: buildCsv('player-registration', byForm(entries, 'player-registration')),
      club: buildCsv('club-registration', byForm(entries, 'club-registration')),
    },
  };
}

/* The function is scheduled HOURLY (netlify.toml). While the window is open
   every run sends; otherwise only the 22:00 UTC run, which is 02:00 in Abu
   Dhabi. */
function shouldSend(nowMs, windowOpen) {
  if (windowOpen) return true;
  return new Date(nowMs).getUTCHours() === 22;
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

async function runSnapshot(deps) {
  const now = Number.isFinite(deps.now) ? deps.now : Date.now();
  let open = false;
  try { open = !!(await deps.windowOpen()); } catch (err) { open = false; }
  if (!deps.force && !shouldSend(now, open)) return { sent: false, subject: '' };

  let entries = null, failure = null;
  try { entries = await deps.listAll(); } catch (err) { failure = err && err.message ? err.message : String(err); }

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fileStamp = new Date(now).toISOString().replace(/[:.]/g, '-');

  if (failure !== null) {
    const subject = `ADH JRT registrations snapshot FAILED ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    await deps.sendMail({
      to: deps.mailFrom, subject,
      html: `<p>The registrations store could not be read, so this snapshot carries no data.</p><p>Error: <code>${esc(failure)}</code></p><p>See claude/runbooks/runbook-registrations-restore-and-delete.md.</p>`,
      attachments: [],
    });
    return { sent: true, subject, error: failure };
  }

  const snap = buildSnapshot(entries, now);
  const attachments = [
    { name: `registrations-${fileStamp}.json`, contentType: 'application/json', contentBytes: b64(JSON.stringify(snap.machine)) },
    { name: 'registrations-team.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.team) },
    { name: 'registrations-player.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.player) },
    { name: 'registrations-club.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.club) },
  ];
  /* Counts only in the body. Never a value. */
  const html = `<p>Registrations snapshot taken ${esc(snap.takenAt)}.</p>` +
    `<p>${snap.counts.team} team, ${snap.counts.player} player and ${snap.counts.club} club records` +
    (snap.rehearsal ? ' — <strong>includes REHEARSAL records</strong>' : '') + '.</p>' +
    '<p>The .json attachment is what a restore reads. The .csv files are for reading. ' +
    'Procedure: claude/runbooks/runbook-registrations-restore-and-delete.md.</p>';
  await deps.sendMail({ to: deps.mailFrom, subject: snap.subject, html, attachments });
  return { sent: true, subject: snap.subject, counts: snap.counts };
}

/* Which snapshot records are NOT in the store. Present keys are never in the
   plan, whatever their content — restore adds, it never overwrites. */
function restorePlan(machine, existingKeys) {
  if (!machine || machine.v !== 1 || !Array.isArray(machine.records)) throw new Error('unrecognised snapshot file (expected v 1)');
  const missing = machine.records.filter((r) => r && r.key && !existingKeys.has(r.key));
  return {
    missing,
    present: machine.records.length - missing.length,
    rehearsal: missing.filter((r) => r.record && r.record.rehearsal === true).length,
  };
}

function deletePlan(entries, { rehearsalOnly }) {
  return entries.filter((e) => !rehearsalOnly || e.record.rehearsal === true).map((e) => e.key);
}

/* A delete needs a snapshot at least as new as the newest record, or a copy
   of something is about to not exist. */
function canDelete(machineTakenAt, entries) {
  const t = Date.parse(machineTakenAt);
  const newest = entries.map((e) => e.record.receivedAt).sort().pop() || null;
  if (!Number.isFinite(t)) return { ok: false, newest };
  if (!newest) return { ok: true, newest };
  return { ok: t >= Date.parse(newest), newest };
}

module.exports = { csvCell, buildCsv, buildSnapshot, shouldSend, runSnapshot, restorePlan, deletePlan, canDelete, PREFIX };
```

- [ ] **Step 4: Run the test**

Run: `node tests/test-snapshot.js`
Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_snapshot.js tests/test-snapshot.js
git commit -F - <<'EOF'
The snapshot module: CSV + machine file, hourly-in-season cadence, always emails

Also the restore and delete PLANS the CLI tool executes: restore adds
only what is missing; delete refuses without a snapshot newer than the
newest record.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: The scheduled function and the mailer's attachments

**Files:**
- Modify: `netlify/functions/_email.js:79-112` (`sendMail`)
- Create: `netlify/functions/snapshot-registrations.js`
- Modify: `netlify.toml` (append a functions block)
- Test: `tests/test-snapshot.js` (new section, text checks)

**Interfaces:**
- Consumes: `runSnapshot` (Task 4), `listAll`/`STORE_NAME` (Task 1), `loadRegistration`/`registrationState` (`_registration.js`), `blobStore` (`_auth.js`), `sendMail` (`_email.js`).
- Produces: `sendMail({ to, replyTo, subject, html, attachments? })` where `attachments = [{ name, contentType, contentBytes(base64) }]` becomes Graph `fileAttachment`s.

- [ ] **Step 1: Add the failing checks to `tests/test-snapshot.js`** (before `summary`)

```js
    section('The scheduled function and the mailer');
    const fn = readRepo('netlify/functions/snapshot-registrations.js');
    check('handler calls runSnapshot', /runSnapshot\(\{/.test(fn));
    check('lists the registrations store', /listAll\(blobStore\(STORE_NAME\)\)/.test(fn));
    check('window comes from _registration', /registrationState\(await loadRegistration\(blobStore\)/.test(fn));
    check('recipient is MAIL_FROM, from the environment', /mailFrom:\s*process\.env\.MAIL_FROM/.test(fn));
    check('never reads a recipient from the request', !/event\.body/.test(fn) && !/JSON\.parse\(/.test(fn));
    const mail = readRepo('netlify/functions/_email.js');
    check('sendMail accepts attachments', /async function sendMail\(\{[^}]*attachments/.test(mail));
    check('…as Graph fileAttachments', /#microsoft\.graph\.fileAttachment/.test(mail));
    const toml = readRepo('netlify.toml');
    check('netlify.toml schedules the function hourly', /\[functions\."snapshot-registrations"\][\s\S]{0,80}schedule\s*=\s*"@hourly"/.test(toml));
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tests/test-snapshot.js`
Expected: `Cannot find module` on the `readRepo` of `snapshot-registrations.js` — that is the failing state.

- [ ] **Step 3: Extend `sendMail` in `_email.js`**

Change the signature and add the attachments after `toRecipients`:

```js
async function sendMail({ to, replyTo, subject, html, attachments }) {
  // ...unchanged down to `if (replyTo) {...}`...
  /* Snapshot attachments (Sep 2026). Graph inline fileAttachment, base64
     bytes, well under its 3 MB inline limit for a few hundred records. */
  if (Array.isArray(attachments) && attachments.length) {
    message.attachments = attachments.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: a.contentBytes,
    }));
  }
```

- [ ] **Step 4: Write the function**

```js
// netlify/functions/snapshot-registrations.js
//
// SCHEDULED (netlify.toml: @hourly). Emails a snapshot of every registration
// record to the tournament's own mailbox — hourly while the registration
// window is open, once a night otherwise (_snapshot.js shouldSend).
// Spec: claude/specs/spec-registration-store-sep-2026.md § 6.
//
// No decisions here: runSnapshot() in _snapshot.js decides and is tested with
// fakes. This file only wires the real store, the real window and the real
// mailer. Scheduled functions are invoked by Netlify, not by HTTP callers.
// The recipient is MAIL_FROM — nothing in any request can change it.

const { blobStore } = require('./_auth');
const { sendMail } = require('./_email');
const { loadRegistration, registrationState } = require('./_registration');
const { STORE_NAME, listAll } = require('./_regstore');
const { runSnapshot } = require('./_snapshot');

exports.handler = async () => {
  try {
    const result = await runSnapshot({
      now: Date.now(),
      listAll: () => listAll(blobStore(STORE_NAME)),
      windowOpen: async () => !!registrationState(await loadRegistration(blobStore), Date.now()).open,
      sendMail,
      mailFrom: process.env.MAIL_FROM,
    });
    /* Counts only. */
    console.log(`snapshot-registrations: ${result.sent ? 'sent' : 'skipped this hour'}${result.counts ? ` (${result.counts.team}/${result.counts.player}/${result.counts.club})` : ''}${result.error ? ' FAILED: ' + result.error : ''}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: result.sent }) };
  } catch (err) {
    console.error('snapshot-registrations error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
```

- [ ] **Step 5: Append to `netlify.toml`**

```toml
# --- registrations snapshot (Sep 2026) -----------------------------------
# Hourly. The function itself decides whether THIS hour sends: every hour
# while the registration window is open, otherwise only 22:00 UTC (02:00 Abu
# Dhabi). See netlify/functions/_snapshot.js shouldSend() and the spec,
# claude/specs/spec-registration-store-sep-2026.md § 6.
[functions."snapshot-registrations"]
  schedule = "@hourly"
```

- [ ] **Step 6: Run the tests**

Run: `node tests/test-snapshot.js && node tests/test-email.js && node tests/test-functions-load.js && node --check netlify/functions/snapshot-registrations.js`
Expected: all pass. `test-functions-load.js` now also loads `snapshot-registrations.js` and reports it exports a handler.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/_email.js netlify/functions/snapshot-registrations.js netlify.toml tests/test-snapshot.js
git commit -F - <<'EOF'
Scheduled snapshot function; sendMail carries attachments

Hourly schedule in netlify.toml; the function decides whether the hour
sends. Recipient is MAIL_FROM only.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: The command-line tool

**Files:**
- Create: `tools/registrations-admin.js`
- Test: `tests/test-registrations-admin.js`

**Interfaces:**
- Consumes: `restorePlan`, `deletePlan`, `canDelete` (Task 4); `buildRecord`-shaped records (Task 1).
- Produces: a CLI. Modes:
  - `node tools/registrations-admin.js check <snapshot.json>`
  - `node tools/registrations-admin.js restore <snapshot.json> --confirm <N>` where `N` is the missing count `check` printed
  - `node tools/registrations-admin.js delete --rehearsal --snapshot <snapshot.json>`
  - `node tools/registrations-admin.js delete --all --snapshot <snapshot.json> --confirm ALL`
- Internally: `runTool(argv, io)` where `io = { list(store), get(store, key), set(store, key, json), del(store, key), readFile(path), out(line) }` — the pure driver, tested with fakes; `netlifyIo()` implements it by shelling out to the Netlify CLI (`netlify blobs:list|get|set|delete`), so the credential is the CLI's own login and no token exists in any file.

- [ ] **Step 1: Write the failing test**

```js
/* tests/test-registrations-admin.js
   The CLI's driver, with a fake Netlify CLI. Spec § 7. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');
const A = require(path.join(repoRoot(), 'tools/registrations-admin.js'));
const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const S = require(path.join(repoRoot(), 'netlify/functions/_snapshot.js'));

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const rec = (form, club, nowMs) => R.buildRecord({ form, row: ['x', club], nowMs: nowMs || T0, club });

function fakeIo(seed, files) {
  const m = new Map(Object.entries(seed || {}));
  const out = [];
  return {
    m, out,
    async list(store) { return [...m.keys()].sort(); },
    async get(store, key) { return m.has(key) ? m.get(key) : null; },
    async set(store, key, json) { m.set(key, json); },
    async del(store, key) { m.delete(key); },
    readFile(p) { if (!(p in files)) throw new Error('ENOENT ' + p); return JSON.stringify(files[p]); },
    out(line) { out.push(String(line)); },
  };
}

const full = { 'team/a': rec('team-registration', 'Abu Dhabi Harlequins'), 'team/b': rec('team-registration', 'Rehearsal Quins'), 'player/a': rec('player-registration', 'Dubai Exiles') };
const snapAll = S.buildSnapshot(Object.entries(full).map(([key, record]) => ({ key, record })), T0 + 60000).machine;
const snapOld = S.buildSnapshot(Object.entries(full).map(([key, record]) => ({ key, record })), T0 - 60000).machine;

(async () => {
  section('check writes nothing and reports counts');
  {
    const io = fakeIo({ 'team/a': full['team/a'] }, { 'snap.json': snapAll });
    const code = await A.runTool(['check', 'snap.json'], io);
    eq('exit 0', code, 0);
    check('reports missing 2', io.out.some((l) => /missing:\s*2/.test(l)));
    check('reports present 1', io.out.some((l) => /present:\s*1/.test(l)));
    check('reports rehearsal 1', io.out.some((l) => /rehearsal:\s*1/.test(l)));
    eq('store untouched', io.m.size, 1);
    check('no record VALUE printed', !io.out.some((l) => /Dubai Exiles|Harlequins/.test(l)));
  }

  section('restore needs the count check printed, and adds only what is missing');
  {
    const io = fakeIo({ 'team/a': { ...full['team/a'], row: ['KEEP'] } }, { 'snap.json': snapAll });
    eq('no --confirm → refused, exit 2', await A.runTool(['restore', 'snap.json'], io), 2);
    eq('wrong --confirm → refused', await A.runTool(['restore', 'snap.json', '--confirm', '5'], io), 2);
    eq('store still untouched', io.m.size, 1);
    eq('right --confirm → exit 0', await A.runTool(['restore', 'snap.json', '--confirm', '2'], io), 0);
    eq('the two missing were written', [...io.m.keys()].sort(), ['player/a', 'team/a', 'team/b']);
    eq('⚠️ the present record was NOT overwritten', io.m.get('team/a').row, ['KEEP']);
    eq('running it again is harmless (0 missing)', await A.runTool(['restore', 'snap.json', '--confirm', '0'], io), 0);
  }

  section('delete: rehearsal scope, ALL word, and the snapshot gate');
  {
    let io = fakeIo(full, { 'snap.json': snapAll, 'old.json': snapOld });
    eq('no --snapshot → refused', await A.runTool(['delete', '--rehearsal'], io), 2);
    eq('snapshot OLDER than newest record → refused', await A.runTool(['delete', '--rehearsal', '--snapshot', 'old.json'], io), 2);
    eq('store untouched so far', io.m.size, 3);
    eq('--rehearsal with a fresh snapshot → exit 0', await A.runTool(['delete', '--rehearsal', '--snapshot', 'snap.json'], io), 0);
    eq('only the rehearsal record is gone', [...io.m.keys()].sort(), ['player/a', 'team/a']);

    io = fakeIo(full, { 'snap.json': snapAll });
    eq('--all without --confirm ALL → refused', await A.runTool(['delete', '--all', '--snapshot', 'snap.json'], io), 2);
    eq('--all with --confirm all (lower case) → refused', await A.runTool(['delete', '--all', '--snapshot', 'snap.json', '--confirm', 'all'], io), 2);
    eq('still 3', io.m.size, 3);
    eq('--all --confirm ALL → exit 0', await A.runTool(['delete', '--all', '--snapshot', 'snap.json', '--confirm', 'ALL'], io), 0);
    eq('empty', io.m.size, 0);
    eq('neither scope flag → refused', await A.runTool(['delete', '--snapshot', 'snap.json'], fakeIo(full, { 'snap.json': snapAll })), 2);
  }

  section('The real io shells out to the Netlify CLI — no token anywhere');
  {
    const src = readRepo('tools/registrations-admin.js');
    check('uses execFileSync("netlify", …)', /execFileSync\(\s*['"]netlify['"]/.test(src));
    check('blobs:list / get / set / delete', ['blobs:list', 'blobs:get', 'blobs:set', 'blobs:delete'].every((c) => src.includes(c)));
    check('never reads a token from the environment or a file', !/BLOBS_TOKEN|NETLIFY_AUTH_TOKEN|token/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
    check('store name comes from _regstore', /STORE_NAME/.test(src));
  }
  summary('test-registrations-admin.js');
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/test-registrations-admin.js`
Expected: `Cannot find module '.../tools/registrations-admin.js'`

- [ ] **Step 3: Write the tool**

```js
#!/usr/bin/env node
/* tools/registrations-admin.js
   ------------------------------------------------------------------------
   Restore or delete registration records, from the command line, on a PC
   where the Netlify CLI is signed in. Spec § 7; procedure in
   claude/runbooks/runbook-registrations-restore-and-delete.md.

   CREDENTIALS. This talks to the store through the Netlify CLI
   (`netlify blobs:…`), which uses the login Jay primed once in a browser.
   There is NO token in this file, in the environment it reads, or in any
   argument. If `netlify` is not signed in or the folder is not linked, the
   CLI says so and this tool stops.

   MODES — always run `check` first:
     check   <snapshot.json>                       compare, write nothing
     restore <snapshot.json> --confirm <N>         add ONLY the N missing records (N = what check printed)
     delete  --rehearsal --snapshot <snapshot.json>            remove rehearsal records
     delete  --all --snapshot <snapshot.json> --confirm ALL    remove everything

   OUTPUT is paths, keys, counts and statuses. Never a record VALUE.
   ------------------------------------------------------------------------ */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { STORE_NAME } = require(path.join(__dirname, '..', 'netlify', 'functions', '_regstore.js'));
const { restorePlan, deletePlan, canDelete } = require(path.join(__dirname, '..', 'netlify', 'functions', '_snapshot.js'));

function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }
function has(argv, name) { return argv.indexOf(name) >= 0; }

/* The real io: every call is one Netlify CLI invocation. */
function netlifyIo() {
  const run = (args, input) => execFileSync('netlify', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
  return {
    async list(store) {
      const raw = run(['blobs:list', store, '--json']);
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed : parsed.blobs || []).map((b) => (typeof b === 'string' ? b : b.key)).sort();
    },
    async get(store, key) {
      try { return JSON.parse(run(['blobs:get', store, key])); } catch (e) { return null; }
    },
    async set(store, key, json) { run(['blobs:set', store, key], JSON.stringify(json)); },
    async del(store, key) { run(['blobs:delete', store, key]); },
    readFile(p) { return fs.readFileSync(p, 'utf8'); },
    out(line) { console.log(line); },
  };
}

async function loadEntries(io) {
  const keys = await io.list(STORE_NAME);
  const entries = [];
  for (const key of keys) {
    const record = await io.get(STORE_NAME, key);
    if (record && Array.isArray(record.row)) entries.push({ key, record });
  }
  return entries;
}

function readSnapshot(io, p) {
  if (!p) throw new Error('a snapshot file path is required');
  const machine = JSON.parse(io.readFile(p));
  if (!machine || machine.v !== 1 || !Array.isArray(machine.records)) throw new Error('not a v1 snapshot file: ' + p);
  return machine;
}

async function runTool(argv, io) {
  const mode = argv[0];
  try {
    if (mode === 'check' || mode === 'restore') {
      const machine = readSnapshot(io, argv[1]);
      const entries = await loadEntries(io);
      const plan = restorePlan(machine, new Set(entries.map((e) => e.key)));
      io.out(`snapshot taken: ${machine.takenAt}   records in snapshot: ${machine.records.length}`);
      io.out(`store: ${entries.length} record(s)`);
      io.out(`missing: ${plan.missing.length}   present: ${plan.present}   rehearsal among missing: ${plan.rehearsal}`);
      if (mode === 'check') { io.out('check only — nothing written'); return 0; }

      const confirm = flag(argv, '--confirm');
      if (confirm === undefined || Number(confirm) !== plan.missing.length) {
        io.out(`REFUSED: restore needs --confirm ${plan.missing.length} (the missing count check printed). Nothing written.`);
        return 2;
      }
      for (const m of plan.missing) {
        /* Add only. A key that exists is never touched, and the plan already excluded them. */
        await io.set(STORE_NAME, m.key, m.record);
        io.out(`restored ${m.key}`);
      }
      io.out(`done: ${plan.missing.length} record(s) restored`);
      return 0;
    }

    if (mode === 'delete') {
      const rehearsalOnly = has(argv, '--rehearsal');
      const all = has(argv, '--all');
      if (rehearsalOnly === all) { io.out('REFUSED: say exactly one of --rehearsal or --all'); return 2; }
      const snapPath = flag(argv, '--snapshot');
      if (!snapPath) { io.out('REFUSED: --snapshot <file> is required — a delete needs a copy first'); return 2; }
      const machine = readSnapshot(io, snapPath);
      const entries = await loadEntries(io);
      const gate = canDelete(machine.takenAt, entries);
      if (!gate.ok) { io.out(`REFUSED: snapshot ${machine.takenAt} is older than the newest record ${gate.newest}. Take a fresh snapshot first.`); return 2; }
      if (all && flag(argv, '--confirm') !== 'ALL') { io.out('REFUSED: --all needs --confirm ALL (upper case)'); return 2; }
      const keys = deletePlan(entries, { rehearsalOnly });
      io.out(`deleting ${keys.length} ${rehearsalOnly ? 'rehearsal' : ''} record(s)`);
      for (const k of keys) { await io.del(STORE_NAME, k); io.out(`deleted ${k}`); }
      io.out(`done: ${keys.length} deleted`);
      return 0;
    }

    io.out('usage: check <snap.json> | restore <snap.json> --confirm <N> | delete --rehearsal|--all --snapshot <snap.json> [--confirm ALL]');
    return 2;
  } catch (err) {
    io.out(`ERROR: ${err && err.message}`);
    return 1;
  }
}

module.exports = { runTool, netlifyIo };

if (require.main === module) {
  runTool(process.argv.slice(2), netlifyIo()).then((code) => process.exit(code));
}
```

- [ ] **Step 4: Run the test**

Run: `node tests/test-registrations-admin.js`
Expected: all pass. The `never reads a token` check strips comments before
matching, so the word may appear only in comments.

- [ ] **Step 5: Commit**

```bash
git add tools/registrations-admin.js tests/test-registrations-admin.js
git commit -F - <<'EOF'
registrations-admin CLI: check, restore (adds only), delete (gated by a fresh snapshot)

Credentials are the Netlify CLI's own login; no token exists anywhere.
Driver tested against a fake CLI: restore never overwrites, delete
refuses without a snapshot newer than the newest record, --all needs ALL.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: The runbook

**Files:**
- Create: `claude/runbooks/runbook-registrations-restore-and-delete.md`

- [ ] **Step 1: Write it**

```markdown
# Registrations — restore from a snapshot, clear a rehearsal, delete at season end

**Purpose.** The registrations store (Netlify Blobs, store `registrations`)
has no undo. Its copy is the snapshot email in the registrations mailbox. This
is how a person puts records back, removes rehearsal records, or deletes
everything after the tournament. Spec:
`claude/specs/spec-registration-store-sep-2026.md` § 7.

**When to use.** Restore: records are missing from the organiser page that
were there before. Clear rehearsal: after any rehearsal with a club named
`Rehearsal …`. Season end: when Jay decides the data is no longer needed —
retention is MANUAL, nothing fires on a date.

**Before you start — once per PC.**
1. In PowerShell: `npm install -g netlify-cli` (or check `netlify --version`).
2. In PowerShell, in the repo folder: `netlify login` — a browser window opens;
   sign in with the Netlify account. `netlify link` — pick the `adhquins-jrt`
   site. Both are one-off and store nothing in the repo.
3. In Outlook (the registrations mailbox): find the newest email whose subject
   starts `ADH JRT registrations snapshot`. Save the `.json` attachment to a
   folder OUTSIDE the repo, e.g. `C:\Users\Jay\Downloads\snap.json`. The
   `.csv` files are for reading; restore does not use them.

## A · Restore

1. In PowerShell, in the repo folder:
   `node tools/registrations-admin.js check C:\Users\Jay\Downloads\snap.json`
2. Read the line `missing: N   present: M   rehearsal among missing: R`.
   Good: N is the number you expected to be missing. Bad: N is far larger than
   expected → the store may be unreadable; stop and check the Netlify status
   page before going on.
3. `node tools/registrations-admin.js restore C:\Users\Jay\Downloads\snap.json --confirm N`
   (the same N). It prints one `restored <key>` per record and `done: N`.
4. Verify: open `/organizer` → Registrations. The rows are back.
5. If it fails: `REFUSED` means the count did not match — re-run check. `ERROR`
   with a Netlify message means the CLI is not signed in or linked → step 2 of
   Before you start.

## B · Clear a rehearsal

1. Wait for (or trigger) a snapshot AFTER the last rehearsal record was
   written — the subject carries `REHEARSAL`. Save its `.json`.
2. `node tools/registrations-admin.js delete --rehearsal --snapshot C:\Users\Jay\Downloads\snap.json`
3. It prints `deleting K rehearsal record(s)` then `done: K deleted`.
4. Verify: `/organizer` shows no row marked rehearsal.
5. If it says `REFUSED: snapshot … is older than the newest record` — a
   record arrived after that snapshot. Wait for the next one.

## C · Season-end delete (everything)

1. Confirm with Jay in writing that the data is to go.
2. Save the newest snapshot `.json` (step 3 of Before you start).
3. `node tools/registrations-admin.js delete --all --snapshot C:\Users\Jay\Downloads\snap.json --confirm ALL`
4. Verify: `/organizer` Registrations is empty.
5. In Outlook: delete every `ADH JRT registrations snapshot` email, then
   empty Deleted Items. They hold the same data.
6. Delete the downloaded `.json` and `.csv` files.
7. Record the date in the tracker.

**Verify a snapshot is arriving at all.** One email per hour while
registration is open, one a night otherwise, subject with the counts. None for
two days → check the function's log in Netlify (Functions →
`snapshot-registrations`).
```

- [ ] **Step 2: Commit**

```bash
git add claude/runbooks/runbook-registrations-restore-and-delete.md
git commit -F - <<'EOF'
Runbook: restore registrations, clear a rehearsal, season-end delete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 8: Register the suites and prove them against injected faults

**Files:**
- Modify: `tests/runall.ps1` (the `$tests` list, after `'test-pitch-marshals.js'`)
- Modify: `tests/_prove-registration.js` (`NEEDED` list and `FAULTS`)

- [ ] **Step 1: Add the three files to `runall.ps1`**

Change `'test-pitch-marshals.js'` (the last entry) to:
```powershell
  'test-pitch-marshals.js',
  # The registration store (Sep 2026) — spec-registration-store-sep-2026.md.
  'test-regstore.js',
  'test-snapshot.js',
  'test-registrations-admin.js'
```

- [ ] **Step 2: Add the modules to the prover's `NEEDED` list**

After the `'netlify/functions/my-account.js'` entry add:
```js
  /* The registration store (Sep 2026). ⚠️ NINTH TIME a new module has had to
     be added here — same symptom as every time before: the suite dies on
     MODULE_NOT_FOUND undamaged, the clean baseline does not rise, and every
     fault reports "caught" while proving nothing. test-regstore.js and
     test-snapshot.js REQUIRE these; the readers, the door, the function, the
     tool and the toml are read as text. */
  'netlify/functions/_regstore.js',
  'netlify/functions/_snapshot.js',
  'netlify/functions/_intake.js',
  'netlify/functions/_teams.js',
  'netlify/functions/_agegroups.js',
  'netlify/functions/_registration.js',
  'netlify/functions/_ratelimit.js',
  'netlify/functions/submit-registration.js',
  'netlify/functions/get-registrations.js',
  'netlify/functions/get-my-registrations.js',
  'netlify/functions/snapshot-registrations.js',
  'netlify/functions/_email.js',
  'tools/registrations-admin.js',
```
(Check first which of `_intake.js`, `_teams.js`, `_agegroups.js`,
`_registration.js`, `_ratelimit.js`, `_email.js` are already listed — add only
the missing ones. Duplicates are harmless but untidy.)

- [ ] **Step 3: Add the faults.** Find how `patch(file, find, replace)` is
defined in the prover (around line 286) and append to `FAULTS`:

```js
  /* ---- the registration store (Sep 2026) ---- */
  {
    name: 'writeOnce is made to overwrite an existing key',
    suite: 'test-regstore.js',
    apply: () => patch('netlify/functions/_regstore.js', "  if (existing !== null && existing !== undefined) throw new Error('exists: ' + key);", '  // overwrite'),
    expect: ['a second write to the same key is REFUSED'],
  },
  {
    name: 'the rehearsal prefix test is dropped',
    suite: 'test-regstore.js',
    apply: () => patch('netlify/functions/_regstore.js', "  return /^\\s*rehearsal\\b/i.test(String(club || ''));", '  return false;'),
    expect: ['"Rehearsal Quins" is a rehearsal'],
  },
  {
    name: 'superseded records are shown',
    suite: 'test-regstore.js',
    apply: () => patch('netlify/functions/_regstore.js', '  return all.filter((e) => !superseded.has(e.key));', '  return all;'),
    expect: ['hides the SUPERSEDED record'],
  },
  {
    name: 'team numbering counts player records instead',
    suite: 'test-regstore.js',
    apply: () => patch('netlify/functions/_regstore.js', "  const live = await listRecords(store, 'team-registration');\n  return live.map((e) => e.record.row);", "  const live = await listRecords(store, 'player-registration');\n  return live.map((e) => e.record.row);"),
    expect: ['numbering rows are live team rows only'],
  },
  {
    name: 'the front door appends to a sheet again',
    suite: 'test-regstore.js',
    apply: () => patch('netlify/functions/submit-registration.js', 'await writeOnce(store, makeKey(form, nowMs), buildRecord({ form, row, nowMs, club }));', 'await sheets.spreadsheets.values.append({});'),
    expect: ['appendRow writes through writeOnce'],
  },
  {
    name: 'the manager reader filters by the request instead of the token',
    suite: 'test-regstore.js',
    apply: () => patch('netlify/functions/get-my-registrations.js', 'const allowedName = seesEverything ? null : AGE_GROUP_NAME_BY_ID[session.ageGroupId];', 'const allowedName = seesEverything ? null : AGE_GROUP_NAME_BY_ID[JSON.parse(event.body || "{}").ageGroup];'),
    expect: ['filters by the TOKEN age group'],
  },
  {
    name: 'the snapshot skips the last record',
    suite: 'test-snapshot.js',
    apply: () => patch('netlify/functions/_snapshot.js', 'records: entries.map((e) => ({ key: e.key, record: e.record })) },', 'records: entries.slice(0, -1).map((e) => ({ key: e.key, record: e.record })) },'),
    expect: ['machine file carries EVERY entry'],
  },
  {
    name: 'a store failure is swallowed and no email goes',
    suite: 'test-snapshot.js',
    apply: () => patch('netlify/functions/_snapshot.js', "  if (failure !== null) {", "  if (failure !== null) { return { sent: false, subject: '', error: failure }; }\n  if (false) {"),
    expect: ['store unreadable → STILL sends'],
  },
  {
    name: 'the snapshot recipient is taken from the entries',
    suite: 'test-snapshot.js',
    apply: () => patch('netlify/functions/_snapshot.js', 'await deps.sendMail({ to: deps.mailFrom, subject: snap.subject, html, attachments });', "await deps.sendMail({ to: (entries[0] && entries[0].record.row[1]) || deps.mailFrom, subject: snap.subject, html, attachments });"),
    expect: ['to the tournament mailbox ONLY'],
  },
  {
    name: 'restorePlan includes present keys (would overwrite)',
    suite: 'test-snapshot.js',
    apply: () => patch('netlify/functions/_snapshot.js', '  const missing = machine.records.filter((r) => r && r.key && !existingKeys.has(r.key));', '  const missing = machine.records.filter((r) => r && r.key);'),
    expect: ['a present key is never in the plan'],
  },
  {
    name: 'canDelete lets an older snapshot through',
    suite: 'test-snapshot.js',
    apply: () => patch('netlify/functions/_snapshot.js', '  return { ok: t >= Date.parse(newest), newest };', '  return { ok: true, newest };'),
    expect: ['snapshot OLDER than the newest record → refused'],
  },
  {
    name: 'the CLI restores without the confirm count',
    suite: 'test-registrations-admin.js',
    apply: () => patch('tools/registrations-admin.js', '      if (confirm === undefined || Number(confirm) !== plan.missing.length) {', '      if (false) {'),
    expect: ['no --confirm → refused'],
  },
  {
    name: 'the CLI deletes without a snapshot',
    suite: 'test-registrations-admin.js',
    apply: () => patch('tools/registrations-admin.js', "      if (!snapPath) { io.out('REFUSED: --snapshot <file> is required — a delete needs a copy first'); return 2; }\n      const machine = readSnapshot(io, snapPath);", "      const machine = snapPath ? readSnapshot(io, snapPath) : { takenAt: new Date().toISOString(), records: [] };"),
    expect: ['no --snapshot → refused'],
  },
  {
    name: '--rehearsal deletes a real record too',
    suite: 'test-registrations-admin.js',
    apply: () => patch('netlify/functions/_snapshot.js', '  return entries.filter((e) => !rehearsalOnly || e.record.rehearsal === true).map((e) => e.key);', '  return entries.map((e) => e.key);'),
    expect: ['only the rehearsal record is gone'],
  },
```

Also add `'test-regstore.js'`, `'test-snapshot.js'`,
`'test-registrations-admin.js'` wherever the prover enumerates the suites it
runs undamaged for the `M suite(s) clean` baseline (look for the array that
holds `'test-registration.js'` near the top of the run section).

- [ ] **Step 4: Run the prover**

Run: `node tests/_prove-registration.js`
Expected: the last line reads `N/N faults caught by the named check; M suite(s)
clean on an undamaged copy`, where **N has risen by 14 and M by 3** against the
numbers in `claude/state-of-play.md`. If any fault reports "not caught" or
"caught by the suite throwing", the check or the anchor is wrong — fix it, do
not delete the fault.

- [ ] **Step 5: Run the whole suite**

Run (PowerShell): `powershell tests/runall.ps1`
Expected: one `--- <file>` header per test file including the three new ones,
and no `FAILED` line.

- [ ] **Step 6: Commit**

```bash
git add tests/runall.ps1 tests/_prove-registration.js
git commit -F - <<'EOF'
Prove the registration store suites: 14 faults, 3 new suites clean

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 9: Docs before the rehearsal, then the rehearsal

**Files:**
- Modify: `RESTORE.md` (new section `## Registration store`, placed before `## The sheet columns — one copy, at last`)
- Modify: `claude/state-of-play.md` (top entry)

- [ ] **Step 1: Add the RESTORE.md section**

```markdown
## Registration store (Sep 2026)

Every accepted registration is ONE record in the Netlify Blobs store
`registrations`, key `<team|player|club>/<stamp>-<rand>`, holding `row` in
the sheet column order plus `receivedAt`, `rehearsal` and an optional
`supersedes`. `_regstore.js` has no update: a correction is a new record and
the old one is hidden from readers, kept for the snapshot. Team numbering
counts live team records. The two readers answer the shapes they always did,
plus `rehearsal: true|false` per row.

A scheduled function emails a snapshot to `MAIL_FROM` — hourly while the
registration window is open, 22:00 UTC otherwise — as CSVs plus one `.json`
machine file. The machine file is the only thing restore reads.
`tools/registrations-admin.js` restores (adds only), clears rehearsal
records, or deletes everything, each gated; procedure in
`claude/runbooks/runbook-registrations-restore-and-delete.md`. Retention is
manual. Spec: `claude/specs/spec-registration-store-sep-2026.md`.
```

- [ ] **Step 2: Add a state-of-play entry** at the top: what is on `dev`, that
Google is still wired for the readers' fallback NO LONGER (readers read the
store), that the sheets are untouched, and that the rehearsal (spec § 12) is
the gate before cutover. Include the prover's new N and M.

- [ ] **Step 3: Commit and push `dev`**

```bash
git add RESTORE.md claude/state-of-play.md
git commit -F - <<'EOF'
docs: registration store on dev, rehearsal pending

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push origin dev
```

- [ ] **Step 4: Rehearse on the branch deploy, then production** (Jay's
steps, from spec § 12): `dev--adhquins-jrt.netlify.app` runs the same
functions against the SAME blobs and env as production, so the whole
rehearsal can run there for free. Then one 15-credit merge to `main` on
Jay's yes, and the seven rehearsal steps again on `adhjrt.com`. Record both
in state-of-play.

---

### Task 10: Cutover — remove Google (only after the rehearsal passes)

**Files:**
- Delete: `netlify/functions/_sheets.js`
- Modify: `netlify/functions/_intake.js` (remove `sheetEnv`, `range`, `TEAM_RANGE`, `PLAYER_RANGE`, `CLUB_RANGE`, `colLetter` and their exports; keep `columns`)
- Modify: `tests/test-intake.js:491-494` and every check that reads `RANGE`/`colLetter`/`sheetEnv`
- Modify: `tests/test-functions-load.js:136` (drop the four `GOOGLE_*` names)
- Modify: `RESTORE.md` (`## Email`/Google notes → tombstone paragraph naming what went and why)
- Modify: `package.json` — **do NOT remove `googleapis`/`google-auth-library` in this task**; open a tracker ticket instead, because a dependency removal is a separate, reviewable change.

- [ ] **Step 1: Grep every remaining sheet reference**

Run: `grep -rn -F -e GOOGLE_ -e sheetsClient -e firstSheetName -e _RANGE -e colLetter netlify tests tools *.js | grep -v node_modules`
Expected: a finite list; every hit is removed or repointed in this task.

- [ ] **Step 2: Remove, fix the tests, run the suite and the prover**

Run: `powershell tests/runall.ps1`
Expected: green; prover N unchanged or higher, M unchanged.

- [ ] **Step 3: In Netlify (Jay):** Site configuration → Environment variables
→ delete `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_SHEET_ID_TEAMS`, `GOOGLE_SHEET_ID_PLAYERS`, `GOOGLE_SHEET_ID_CLUBS`.
In Google Cloud: delete the service account key. In Google Drive: archive or
delete the three sheets when he chooses.

- [ ] **Step 4: Commit with a tombstone**

```bash
git add netlify/functions/_intake.js tests/test-intake.js tests/test-functions-load.js RESTORE.md
git rm netlify/functions/_sheets.js
git commit -F - <<'EOF'
Remove the Google Sheets path — registrations live in the store

Tombstone in RESTORE.md: _sheets.js (service-account auth, private-key
repair, first-tab lookup) and the A1 ranges in _intake.js are gone; the
column lists stay because the record row keeps their order.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

## Self-review against the spec

| Spec § | Task |
|---|---|
| 3 record, key, rehearsal, write-once, supersedes | 1 |
| 4 write path, numbering, dead letter, no email on failure | 2 (dead letter and no-email are `_intake.js` behaviour already tested in `test-intake.js`) |
| 5 readers, hide superseded, rehearsal marker, export | 3; export already exists (`exportCsv`) |
| 6 snapshot two attachments, cadence, always emails, MAIL_FROM only | 4, 5 |
| 7 CLI modes, gates, runbook, manual retention | 6, 7 |
| 8 no new role | nothing added — confirmed by design |
| 12 faults | 8 (14 faults ≥ the spec's 14 rows) |
| 12 rehearsal, cutover | 9, 10 |

Not covered, deliberately: the organiser page does not yet SHOW the
`rehearsal` marker visually. The data is there (`rehearsal: true`); a one-line
badge in `Organizer.dc.html`'s Teams/Players rows is a cosmetic follow-up and
is left out of this plan so the page file is not touched before the rehearsal.
Ticket it.
