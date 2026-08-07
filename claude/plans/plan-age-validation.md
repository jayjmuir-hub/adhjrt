# Age Validation on the Team Form — Implementation Plan

> **Sub-project 2.** Read `claude/specs/spec-age-validation.md` first — every decision
> below traces back to a decision made there. Then `CLAUDE.md` from a fresh
> clone, then `claude/state-of-play.md`.
>
> **For an implementing session:** work task by task, in order. Every task ends
> with tests passing and a commit on `dev`. Do not deploy without Jay's "yes".

---

## For Jay — what this is, in one paragraph

Right now the coach's form (the one that registers a whole squad at once) never
checks a player's date of birth against the age group they're being entered
into. The parent's form does check — but a coach filling in eighteen players by
hand can't get parental consent for each one, so it has to work differently
there. This build adds the same age check to the coach's form: as they type each
date of birth it tells them straight away if a player looks too old or too
young for the group, refuses to submit if anyone is more than one age group out
(same rule the parent's form already enforces), and — this is the part that's
new — lets a player through who is exactly **one group young**, because that's
allowed with a parent's consent and a coach can't give that on a parent's
behalf. That player is just flagged instead, so you can chase the consent
before the weekend. The date of birth box also changes from the calendar picker
to three dropdowns, matching the parent's form — the calendar picker will
silently accept "31 February" and turn it into 3 March, which the dropdowns
refuse to do.

**Decision confirmed with Jay, 28 July 2026:** a roster row with a name typed in
but no date of birth blocks submission of the whole squad, the same way a blank
date of birth blocks the parent's form. The alternative — letting it through
unchecked — would mean a coach could leave every date of birth blank and this
project would check nothing.

---

## READ THIS BEFORE ANYTHING ELSE — what this plan reuses, and what it doesn't

**This is a widening of an existing rule, not a new one.** The parent's form
already has `_playerAgeCheck()` and it is exactly right — same cut-off date,
same play-up allowance, same "more than one group is a hard block" rule. This
plan puts that same check on every roster row of the coach's form, and **reuses
`_playerAgeCheck()` rather than reimplementing it** — a roster row is adapted
into the shape it already expects (`{ dob, ageGroup }`) and passed straight in.

**Server side is a duplicate, on purpose, matching the pattern already in this
codebase.** `_agegroups.js` already duplicates the client's `AGE_GROUP_INFO`
table verbatim, with a test that fails if the two drift — the same shape as
`DEFAULT_VENUE` in `_venue.js`/`scores-data.js`. This plan does the same thing
for the age-check itself: `calcAge()`, `PREV_GROUP_ID`, `AGE_GRADE_CUTOFF_DATE`
and the check function move into `_agegroups.js` **copied character for
character**, not rewritten as a "smarter" string-only version. A different
algorithm that happens to agree today is a second thing that can drift from the
client without any test noticing; a verbatim copy is the thing this codebase
already knows how to keep honest.

`calcAge()`'s `new Date(dobStr + 'T00:00:00')` is timezone-safe here in a way
the registration window's dates were not: it never round-trips through UTC, so
whatever timezone the runtime is in, the calendar year/month/day it reads back
out are the same ones that were typed. That is different from the registration
window bug (`claude/specs/spec-registration-window.md`), where an ISO stamp with an
explicit offset got read back through `Date.getMonth()`, which answers in the
*reader's* timezone. Worth a comment where the copy lands, so nobody
"fixes" it into that trap later.

**No new sheet column, no change to `TEAM_COLUMNS`.** The play-up flag is
*derived* from the stored date of birth and the stored age group, not a fact of
its own — so nothing new needs storing. Whatever eventually reads the roster
back (the `/organizer` squad-list display, still an open question in
`claude/state-of-play.md`) can compute the same flag the same way, off the same
two stored fields. This plan does not touch that display — it is explicitly
out of scope in the spec, and rightly tied to the separate decision about how
the squad list appears in `/organizer` at all.

---

## Global constraints (same as sub-project 1 — see `claude/plans/plan-submission-gateway.md`)

- **The repo is public and the repo root IS the deployed site.** Never `git add -A`.
- **Never commit a value for any env var.**
- **Never log a registration field value** — not DOB, not a name, nothing.
- **Every new assertion is proven against an injected fault** in
  `tests/_prove-registration.js`, caught by the check that claims to guard it.
- **A test must not throw.** Use `|| {}` on any lookup a fault can make `undefined`.
- **Boundaries, individually, for all fifteen groups** — not one example. See
  the spec's testing section; it's copied into Task 4 below.
- ⚠️ **Beware a check whose two possible answers are the same value.** The squad
  cap test was fooled once by U16B, whose cap (18) equals the unknown-group
  fallback (18). The age check has no unknown-group fallback to worry about
  (an unrecognised age group is refused at step 4, before any age check runs)
  but it has the same *shape* of hazard: U16 and U18 both span two years, and
  a test that only tries U16B risks a passing answer that would also pass a
  broken lookup. Use U16G or U18G somewhere in the boundary sweep, not just
  the boys' groups, the same lesson `test-agegroups.js` already learned once.
- **Work on `dev`.** `main` is deployed and costs 15 credits. Show the diff,
  get a yes, merge only then.
- **`[skip ci]` never goes on a `dev` commit.**

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `netlify/functions/_agegroups.js` | modify | Add `PREV_GROUP_ID`, `AGE_GRADE_CUTOFF_DATE`, `calcAge()`, `fmtAges()`, `ageGroupCheck(dob, groupName)` — server's copy of the age-check rule. |
| `netlify/functions/_intake.js` | modify | `validateSubmission()` gets a new step: per-roster-row date-of-birth requirement and age check, for `team-registration` only. |
| `Quins JRT.dc.html` | modify | Roster rows get day/month/year dropdowns instead of a native date input, per-row inline age feedback, and a submit-time hard gate — all by reusing `_playerAgeCheck()`. |
| `tests/test-agegroups.js` | modify | New section: `PREV_GROUP_ID` and the age-check function agree with the client, boundary-swept across all fifteen groups. |
| `tests/test-intake.js` | modify | New section: roster age validation — required DOB, play-up allowed through, blocked refused, wording matches the client. |
| `tests/test-registration-panel.js` (or a new `tests/test-roster-age.js`) | new/modify | Drives the roster row's client-side state machine directly: dropdown → `composeDob` → per-row status → submit gate. |
| `tests/_prove-registration.js` | modify | New faults for every new assertion. |
| `tests/runall.ps1`, `CLAUDE.md`, `claude/state-of-play.md` | modify | Register new test files; document what shipped. |

---

## Task 1 — The age-check function, server side

**Files:** modify `netlify/functions/_agegroups.js`, `tests/test-agegroups.js`

**Interfaces produced:**
- `PREV_GROUP_ID` (object, id → id)
- `AGE_GRADE_CUTOFF_DATE` (Date, 31 Aug 2026)
- `calcAge(dobStr, asOf)` → `{ years, months, birthYear } | null`
- `fmtAges(ages)` → `"14 or 15"` / `"5"`
- `ageGroupCheck(dob, groupName)` → `{ status: 'ok'|'playUp'|'blocked', message }`

Copy `PREV_GROUP_ID`, `AGE_GRADE_CUTOFF_DATE`, `calcAge()` and `fmtAges()` out of
`Quins JRT.dc.html` **verbatim** — same names, same logic, same comments where
they explain *why* (the "U16/U18 span two years" note, the "not derivable from
a rule" note). Then write `ageGroupCheck()` as the same logic
`_playerAgeCheck()` runs, minus the player-form-specific bits (nothing about
`playUpConsent` here — that's a UI concept, not a validation one; the server's
answer is just the status and the message).

```js
// in _agegroups.js, appended

/* Copied verbatim from _playerAgeCheck() in Quins JRT.dc.html, minus the
   playUpConsent handling — that's a UI concept (a checkbox), not something
   the server checks. Both status values it can return mean something
   different downstream:
     'ok'      — nothing to do
     'playUp'  — one group young; ALLOWED, not refused. See spec decision 1:
                 a coach cannot give parental consent on a parent's behalf, so
                 this is flagged for /organizer rather than blocked.
     'blocked' — anything else. Refused, same rule the player form has always
                 had. */
function ageGroupCheck(dob, groupName) {
  if (!dob || !groupName) return { status: 'ok', message: '' };
  const cutoffAge = calcAge(dob, AGE_GRADE_CUTOFF_DATE);
  const info = AGE_GROUP_BY_NAME[groupName];
  if (!cutoffAge || !info) return { status: 'ok', message: '' };
  if (info.ages.includes(cutoffAge.years)) return { status: 'ok', message: '' };
  const prevInfo = AGE_GROUP_BY_ID[PREV_GROUP_ID[info.id]];
  if (prevInfo && prevInfo.ages.includes(cutoffAge.years)) {
    return {
      status: 'playUp',
      message: `This player's age at the 31 Aug 2026 cut-off fits ${prevInfo.name}, one age group younger than ${groupName}. Playing up one age group is permitted with parent/guardian consent.`,
    };
  }
  return {
    status: 'blocked',
    message: `${groupName} is for players who are ${fmtAges(info.ages)} years old at the UAERF age-grade cut-off (31 Aug 2026). Based on this date of birth, the player is ${cutoffAge.years} at that cut-off — please check the date of birth or select the correct age group.`,
  };
}
```

- [ ] **Step 1: Write the failing tests.** Append to `tests/test-agegroups.js`:
  - `PREV_GROUP_ID` deep-equals the table pulled out of the page (same
    extraction technique `clientTable()` already uses for `AGE_GROUP_INFO`).
  - **Boundary sweep, all fifteen groups, both edges.** For every group in
    `AGE_GROUPS`, a player whose cut-off age is exactly the group's lowest age
    minus one, and exactly the highest age plus one — both checked, not just
    one. That's 30 cases minimum (15 groups × 2 edges), more where a group's
    "one below" is itself a two-value band (U16B/U16G/U18B/U18G).
  - For each of those 30, assert the *right* status: one-group-young → `playUp`
    (unless there's no younger group at all — U6 has nothing below it, so a
    5-year-old cut-off age for U6 doesn't exist as an "under" case; check what
    actually happens for a U6 entry younger than 5 — U6 is the youngest group,
    so there is no play-up path down from it, and an age too young for U6
    should come back `blocked`, not `ok` and not `playUp`). Two groups young,
    or too old, or in the wrong direction → `blocked`.
  - **The U16/U18 sentinel, done properly.** U16B and U16G both span two
    years (14, 15) so being born in either year is `ok`, not a boundary case at
    all — assert that explicitly for both years, both groups, so a broken
    "single year only" lookup would fail loudly rather than by accident.
  - **The girls' groups, not just the boys'.** Every boundary case above run
    for at least U12G, U14G, U16G and U18G too, not only the boys' streams —
    the play-up target for a girls' group is a different girls' group
    (`u14g → u12g`, `u16g → u14g`, `u18g → u16g`) and a lookup that
    accidentally used the boys' chain would drift a girl into the wrong group
    silently.
  - **The message text**, for one representative playUp case and one blocked
    case, asserted as a **whole string**, matching the constants above
    character for character.
  - `ageGroupCheck('', 'U16B Contact')` and `ageGroupCheck('2010-06-01', '')`
    both return `{ status: 'ok' }` — nothing to check without both a dob and a
    group, same as the client (a roster row typed before the age group is
    chosen must not show a false alarm).
  - A junk dob (`'not-a-date'`) returns `ok`, not a throw.

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement**, then run and watch it pass.
- [ ] **Step 4: Faults.** At minimum:
  - `PREV_GROUP_ID` with one entry pointed at the wrong group (e.g.
    `u16b: 'u12'` instead of `'u14b'`) — caught by the drift check.
  - The `includes(cutoffAge.years)` check inverted to `!includes` — caught by
    the boundary sweep, not just one case.
  - `AGE_GRADE_CUTOFF_DATE` moved by a year — caught by the boundary sweep
    (every case shifts by exactly one year, so this is a real risk of a fault
    that "still passes" if the sweep isn't wide enough — this is exactly the
    kind of fault the spec's testing section is warning about).
- [ ] **Step 5: Commit.**

---

## Task 2 — Roster date-of-birth dropdowns, client side

**Files:** modify `Quins JRT.dc.html`

Replace the native `<input type="date">` in the roster row (currently around
line 900, inside the `sc-for list="{{ teamPlayerRows }}"`) with the same three
dropdowns the player form already uses, feeding the same `composeDob()`. **Do
not write a second date-composition function** — `composeDob()` is already the
single place that decides the stored shape (`yyyy-mm-dd`), and the
organiser's roster-to-registration reconciliation depends on that shape
matching exactly (see `CLAUDE.md`, "Date of birth is stored as `yyyy-mm-dd`").

- [ ] **Step 1:** Add `dobDay`, `dobMonth`, `dobYear` to each roster player
  object (`addTeamPlayer()`'s default `{ firstName: '', lastName: '', dob: '' }`
  becomes `{ firstName: '', lastName: '', dob: '', dobDay: '', dobMonth: '', dobYear: '' }`).
- [ ] **Step 2:** New handler `setTeamPlayerDobPart(idx, part, val)`, parallel
  to the player form's `setPlayerDobPart`: updates the one part, then
  recomputes `dob` via `composeDob(dobDay, dobMonth, dobYear)` — same "the dob
  field is never set directly" rule the player form already follows.
- [ ] **Step 3:** Swap the markup. Reuse the same grid ratios
  (`1fr 1.7fr 1.1fr`) and the same `dobDayOptions` / `dobMonthOptions` /
  `dobYearOptions` the player form already exposes through `renderVals()` — no
  new option lists needed, they're not player-specific.
- [ ] **Step 4:** Show "that date doesn't exist" under a row exactly like the
  player form does, when all three parts are chosen but `composeDob` returned
  `''`.
- [ ] **Step 5:** Extend the binding check / `sc-for` balance check to cover
  the new roster row markup (three new `select`s inside the existing
  `sc-for`). Run it, watch it pass.
- [ ] **Step 6:** Commit. **No behaviour change yet** — the roster still stores
  the same `{ firstName, lastName, dob }` shape and nothing reads DOB for
  anything. This step is purely the input mechanism; Task 3 adds the check.

---

## Task 3 — Per-row age feedback and the submit-time gate, client side

**Files:** modify `Quins JRT.dc.html`

**Reuses `_playerAgeCheck()` rather than reimplementing it.** A roster row
doesn't have its own `ageGroup` — the whole team shares one, `f.ageGroup` — so
each row is checked by handing `_playerAgeCheck()` a shape it already
understands:

```js
// Reused, not reimplemented. A roster row has no ageGroup of its own — the
// whole team shares f.ageGroup — so it's adapted into the shape
// _playerAgeCheck() already expects rather than writing a second version of
// the same rule.
_rosterPlayerAgeCheck(player, teamForm) {
  return this._playerAgeCheck({ dob: player.dob, ageGroup: teamForm.ageGroup });
}
```

- [ ] **Step 1:** In the `teamPlayerRows` mapping (around line 1854), compute
  `rowAgeCheck: this._rosterPlayerAgeCheck(p, this.state.teamForm)` per row.
- [ ] **Step 2:** Under each roster row, add the same two conditional lines the
  player form has — red text on `blocked`, amber text on `playUp` — sized for a
  row rather than the wider player-form layout. **No checkbox.** Spec decision
  1 is explicit: a coach cannot consent for a parent, so `playUp` here is
  informational only, not gated on anything.
- [ ] **Step 3: The submit-time hard gate.** In `submitTeam()`, before the
  existing squad-cap check, walk the (non-empty) roster and refuse if any row
  is `blocked` **or** has a name but no `dob`:

  ```js
  // Order matters: a missing DOB is checked before the age check runs, since
  // a row with no DOB has nothing for _playerAgeCheck to evaluate and would
  // otherwise silently read as 'ok' — exactly the gap this project exists to
  // close. Confirmed with Jay, 28 Jul 2026: a named row with no DOB blocks
  // the whole squad, the same way the player form requires one.
  const namedRows = f.players.filter((p) => p.firstName.trim() || p.lastName.trim());
  const missingDob = namedRows.find((p) => !p.dob);
  if (missingDob) {
    this.setState({ teamError: 'Please give a date of birth for every named player.' });
    return;
  }
  const blockedRow = namedRows.find((p) => this._rosterPlayerAgeCheck(p, f).status === 'blocked');
  if (blockedRow) {
    this.setState({ teamError: 'Please resolve the age issues flagged below before submitting.' });
    return;
  }
  ```

  Note this is a **generic** message pointing at the rows, matching the
  player form's own pattern (`_playerFormError`'s "Please resolve the age
  group mismatch below" for exactly the same reason) — the specific sentence
  is already on screen, under the row.
- [ ] **Step 4:** Extend the client-side test file that drives `submitTeam()`
  (or add one) with: a play-up-only roster submits successfully; a roster with
  one blocked player is refused with the generic message and the row's own
  message is still present in the rendered `teamPlayerRows`; a named row with
  blank DOB is refused; an unnamed blank row (never touched) is not checked at
  all and does not block anything.
- [ ] **Step 5:** Faults — the missing-DOB check removed; `blocked` treated the
  same as `playUp` (i.e., the gate deleted); the gate checking `f.players`
  instead of `namedRows` (which would wrongly refuse on the empty rows every
  form starts with).
- [ ] **Step 6:** Commit.

---

## Task 4 — Server-side enforcement in `validateSubmission()`

**Files:** modify `netlify/functions/_intake.js`, `tests/test-intake.js`

This is the gate that matters — the client checks above are for a coach typing
in good faith; this is what stops a squad submitted with JavaScript disabled or
the page edited by hand. **No new rule, the same one, just enforced a second
place** — same relationship the squad cap already has between `submitTeam()`
and `validateSubmission()`.

Insert as a new step, **after the squad cap (existing step 6) and before the
length caps (existing step 7)** — a coach fixing "too many players" first,
then an age problem, is the more useful order, matching the file's existing
"return on the first problem, most useful order" convention.

```js
/* 6.5 THE ROSTER'S DATES OF BIRTH — sub-project 2.
      No new rule: this is _playerAgeCheck()'s rule, reused server-side via
      _agegroups.js's ageGroupCheck(), the same duplication pattern the squad
      cap and the age-group table already use in this file.

      A named row with no date of birth is refused outright — confirmed with
      Jay, 28 Jul 2026 — the same requirement the player form already has.
      Skipping it would leave every roster's age check optional at the
      coach's discretion, which defeats the point.

      A play-up player (exactly one group young) is let through. It cannot be
      gated on consent here — that is a checkbox a PARENT ticks on the
      player form, and a coach entering a whole squad cannot tick it on a
      parent's behalf. See spec decision 1: flagged for /organizer to chase,
      not blocked. */
if (roster) {
  const named = roster.filter((p) => p && (text(p.firstName).trim() || text(p.lastName).trim()));
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
    // 'playUp' and 'ok' both pass through — no field is written for either.
  }
}
```

Require `ageGroupCheck` from `./_agegroups` alongside the existing `squadCap`
import.

- [ ] **Step 1: Write the failing tests.** Append to `tests/test-intake.js`:
  - A roster with one player exactly one group young for the team's age
    group: `validateSubmission` returns `ok: true` (play-up passes through).
  - A roster with one player two groups young: refused, `field: 'players'`,
    message contains the player's name and the same core sentence
    `ageGroupCheck` produces for that case (assert via the shared function,
    not a hand-typed copy of the string — if the wording ever changes in
    `_agegroups.js` this test must not need editing to match).
  - A named row (`firstName` set, `dob` empty): refused with the missing-DOB
    message.
  - An **unnamed, fully blank** row: never inspected, never blocks anything —
    every roster starts with blank rows and this must not refuse an untouched
    form.
  - Boundary sweep: reuse the same 30-case table from Task 1 (or import it),
    run each through `validateSubmission` inside a minimal valid team
    submission, assert `ok`/refused matches `ageGroupCheck`'s own answer for
    every one — this is what actually proves the two call sites agree, not
    just that each works in isolation.
  - **The client/server agreement test**, same shape as the existing squad-cap
    one: extract `_playerAgeCheck`'s blocked-message template out of
    `Quins JRT.dc.html`, build the expected suffix for a known case, and
    assert the server's refusal message ends with that exact text.
- [ ] **Step 2:** Run, watch it fail.
- [ ] **Step 3:** Implement. Run, watch it pass.
- [ ] **Step 4: Faults.**
  - The missing-DOB check removed — caught by the named-row-no-dob case.
  - `check.status === 'blocked'` changed to `!== 'ok'` (which would also
    refuse play-up players) — caught by the play-up-passes-through case, and
    this is the fault that most directly tests spec decision 1 actually
    holds.
  - The loop scoped to `roster` instead of `named` — caught by the
    blank-row-never-blocks case.
  - The message text drifted from the client's wording by one word — caught
    by the agreement test.
- [ ] **Step 5:** Commit.

---

## Task 5 — Documentation and state-of-play

**Files:** `CLAUDE.md`, `claude/state-of-play.md`

- [ ] Add a `CLAUDE.md` section next to the existing "Validation (added 28 Jul
  2026)" one: what the roster age check does, where `ageGroupCheck()` lives,
  the play-up-is-flagged-not-blocked decision and why, and the missing-DOB
  decision with the date it was confirmed.
- [ ] Update `claude/state-of-play.md`: sub-project 2 moves from "the open bug"
  to done, and the squad-list-in-`/organizer` open question gets a note that
  it is now also where the play-up flag would need to surface, once decided.
- [ ] Commit — docs-only, so `[skip ci]` is fine **only if this commit goes
  straight to `main`**; on `dev` it's never needed (per the existing rule).

---

## Task 6 — Cutover

**Do not start until Tasks 1–5 are committed and the whole suite is green,
including the fault run, on Windows.**

- [ ] **Step 1:** Merge `dev` to `main` after showing Jay the diff and getting
  a yes (15 credits — batch this with anything else pending).
- [ ] **Step 2: Verify on production**, walked by Jay:
  1. Register a team with one player exactly one age group young — squad
     submits successfully, no error shown.
  2. Register a team with one player two age groups out — refused, the
     server's sentence shown, form intact for retry.
  3. Register a team with a named row and no date of birth entered (possible
     only by editing the page, since the client blocks it too) — confirms the
     server-side gate independently of the client.
  4. A normal, fully in-range squad still registers exactly as before.
- [ ] **Step 3:** Update `claude/state-of-play.md` — sub-project 2 complete.

---

## What this plan deliberately does NOT do

- **Does not touch `/organizer`.** The play-up flag is derivable but not yet
  displayed anywhere — that's tied to the still-open "squad list is invisible
  in `/organizer`" question in `claude/state-of-play.md`, and the spec is
  explicit these should be designed together, deliberately, in a separate
  piece of work.
- **Does not require an age group on the player form.** That's a separate gap
  noted in the spec's "not yet decided" list, unrelated to this one.
- **Does not touch what happens to squads already submitted.** Four test rows
  and nothing real exist today (per `state-of-play.md`), so there is nothing
  to migrate.
- **Does not change `TEAM_COLUMNS` or add any sheet column.** Nothing new is
  stored; the flag is computed on demand from what's already there.

## Self-review notes

- Every decision in `claude/specs/spec-age-validation.md` maps to a task: flag not
  block (Task 3 step 3, Task 4), per-row live feedback (Task 3), the dropdown
  swap (Task 2), reuse `_playerAgeCheck()` rather than reimplement (Tasks 1
  and 3, stated explicitly both places).
- The one gap the spec left open — a named row with no DOB — was put to Jay
  directly rather than assumed; his answer (block it) is recorded in both the
  "For Jay" summary and inline at the two places the code enforces it, so a
  future session doesn't have to go hunting for why.
- Followed the spec's testing section literally: boundary sweep across all
  fifteen groups on both edges (not one example), the U16/U18 two-year-span
  case checked explicitly rather than assumed, the girls' groups swept
  separately from the boys' rather than assuming the chain generalises,
  every assertion paired with a fault in `_prove-registration.js`.
- Known gap, stated rather than hidden: Task 4's exact test code depends on
  message strings that have to be read out of `Quins JRT.dc.html` and
  `_agegroups.js` at implementation time, the same caveat
  `claude/plans/plan-submission-gateway.md` recorded for its own Tasks 4–6.
