# Spec — managers and organisers can see an unpublished draw

**Status: specced, then built. Read this before changing how a draw is read.**

Jay, 8 Aug 2026: *"the managers and organizers should be able to see fixtures,
tables, and standings in their sections even if they aren't published, because
they have to be able to make fixture changes when not published, the way it is
now they are blind"*.

He is right, and the measured symptom is wider than the one he described.

---

## The fault, measured on `dev` at `d1175c6`

There are two ways a draw is read and only one of them carries the reader's
login.

| Function in `scores-data.js` | Session? | Behaviour when nothing is published |
|---|---|---|
| `getDraw(agId, session)` | ✅ passes it to `fetchOverrideState` | Serves the DRAFT. The Draw editor has always worked. |
| `getFixtures(agId)` | ❌ | `return { awaitingPublication: true, pool: [], knockout: [] }` |
| `getStandings(agId)` | ❌ | Early return — empty `tables`, empty `bracket`, empty `doubleBracket` |
| `getSpiritAward(agId)` | ❌ | Calls `getFixtures(agId)` internally, so inherits it |

`netlify/functions/get-schedule-override.js` **already** serves the draft to a
signed-in caller asking with `?draft=1` and a Bearer token, gated on
`hasAgeGroupAccess`. ⚠️ **So no backend change is needed and none was made.**
The hole is entirely in the client's failure to pass the session it is holding.

**What that costs, per surface:**

- **`/manager`** — `comingSoonBlurb` ("The draw for X hasn't been released
  yet.") fills the **Fixtures**, **Results** and **Tables** tabs. A manager who
  has just built a draw cannot read it back as a fixture list, cannot see a
  table, cannot check bracket seeding.
- ⚠️ **`/manager` score entry is gated on publication too, and this is the part
  nobody asked about.** The score sheet's match list is `playable`, which is
  `[]` while `fxReady` is false. **No score can be entered for an unpublished
  age group.** `_publish.js` lets a manager publish on tournament days only, so
  if no organiser has published before the weekend, match-day scoring is behind
  a manager publishing it themselves first. That is a match-day failure mode,
  not a visibility annoyance.
- **`/app`** — holds a session (`currentSession`) and then calls
  `api.getFixtures(agId)` / `api.getStandings(agId)` at four sites **without
  passing it**. The match-day app is blind the same way.
- **`/organizer`** — has no fixtures or standings view **at all**. Its tabs are
  registration, clubs, teams, players, accounts, venue, documents, tournament.
  Organisers read draws through `/manager`, where they alone get the age-group
  switcher.

---

## The model: four view modes, one derivation

The naive fix — "pass the session, drop the early return" — is wrong, and the
reason is `resolveDraw()`. With no override it falls back to the deterministic
auto-generated draw: **placeholder clubs, sample pools**. Shipping that
unmarked reproduces, for staff, the exact confusion the public guard exists to
prevent for parents.

So the state is not a boolean. One helper, `viewModeOf(state)`, returns one of
four, and all three read functions call it so they cannot drift:

| Mode | When | What the reader sees |
|---|---|---|
| `published` | a published copy exists | the published draw, as today |
| `draft` | caller is allowed the draft AND a draft exists | the draft, behind a **DRAFT — NOT PUBLISHED** marker |
| `sample` | caller is allowed the draft and there is NO draft | the auto-generated draw, behind a **SAMPLE DRAW** marker |
| `none` | nobody is allowed the draft and nothing is published | "not published yet", as today |

⚠️ **THE DISCRIMINATOR IS THE SERVER'S `isDraft`, NOT "A SESSION EXISTS".**
This is the load-bearing decision in the whole change and it is easy to get
wrong in a way that reads as correct.

`get-schedule-override.js` returns `isDraft: true` **only** when it verified the
token *and* `hasAgeGroupAccess(session, ageGroupId)` passed. Anything short of
that falls through to the published answer with `isDraft: false`. Deriving the
mode from `isDraft` therefore inherits the server's authorisation for free:

- A manager browsing **their own** group in `/app` → `draft` / `sample`.
- A manager browsing **another** group in `/app` → the server refuses the draft,
  `isDraft` is false, and they correctly get `published` or `none`.
- An organiser (`ageGroupId === '*'`) → the draft of any group.

**Deriving it from `!!session` instead would have shown every manager a draft
view for all fifteen age groups**, with the schedule field empty because the
server withheld it — i.e. a `sample` badge over placeholder clubs, presented as
if it were that group's work. It would have passed a hand-check by an organiser,
because an organiser has access to everything and would never see it.

---

## Decisions, and the argument AGAINST each

**1. Show the sample draw rather than hiding it.** Jay's call, asked
explicitly. *Against:* all fifteen age groups still carry placeholder clubs
today, so until the real draw exists most groups will show fixtures made of
invented team names to anyone signed in. That is a lot of fake-looking data on
screen, and a badge is a weaker guard than an absence. **Mitigation:** the
marker states it in words rather than a colour — "these are not real fixtures" —
and it is asserted by a test that fails if the badge stops rendering while the
sample mode is active. The counter-argument is genuine and if it annoys him in
practice, `sample` is one line from behaving like `none`.

**2. Public surfaces are untouched.** `Scores & Standings.dc.html:442`
(`/scores`) and `getSchedule()` (the homepage) keep their existing behaviour and
are asserted to. *Against:* nothing. `/scores` is purely public and a parent
must never see a draft.

**3. `/organizer` gets its own read-only panel** rather than relying on the
`/manager` switcher. Jay's call. *Against:* organisers can already reach every
group through `/manager`, so this is arguably duplicate UI in the largest file
in the repo — 4,236 lines, and the one carrying the venue editor and the
simulate tools. **It is read-only on purpose:** score entry and draw editing
stay in `/manager`, so there is no second write path to keep in step.

**4. No new endpoint, no new auth.** *Against:* nothing. Adding one would have
meant a second authorisation surface for the same data, which is how the
`manager-signup` rate-limit bypass happened.

---

## Traps

1. ⚠️ **`regeneratePoolSlots()` mints match ids with `Date.now()`.** A
   regenerated draft carries brand-new ids, so results stored against the old
   ones do not appear in draft standings. Harmless while no results exist; on
   match day, editing pools would make draft tables read empty. **Pre-existing
   behaviour — draft standings EXPOSE it rather than cause it.** Not fixed here;
   flagged so the next person does not diagnose it as a bug in this change.
2. ⚠️ **Every stub gains the new parameter in the same commit.**
   `tests/test-fixtures-results-sync.js` stubs these functions. The `NEEDED`
   trap has killed whole test files five times in this repo, and a dead file
   reports its faults as caught.
3. ⚠️ **A test that only checks "the session is passed" proves nothing.** Pair
   it with one that moves the input and watches the output move — a
   `filter(() => published)` fault passes every source-reading check ever
   written. See `claude/lessons.md`, "calling the right function is not the same
   as using its answer".
4. ⚠️ **The local backend has no publish concept** and reports
   `isDraft: false`, `published: !!schedule`. Offline development keeps behaving
   as "published", which is correct and must not be "tidied" into a draft view.

---

## Verification standard

Baseline before this change, **run in the cloud sandbox on plain Node** (see the
note below): 38 test files green, **759/759 faults caught, 33 suites clean on an
undamaged copy**.

⚠️ **THIS SECTION FIRST SAID "no new test FILE is added, so the baseline must
stay at 33". That was wrong** — the plan changed when Jay asked for the
`/organizer` view, which needed its own suite. `tests/test-draft-visibility.js`
is a new file, so the clean baseline **must go UP to 34**, and it had to be
added to `runall.ps1` in the same commit. Measured after: **39 files green,
773/773 faults, 34 suites clean.**

⚠️ **THE FAULT PROVER CAUGHT THREE FAULTS IN THIS CHANGE'S OWN TESTS, AND THAT
IS THE PART WORTH READING.** All three were the same mistake — the instrument
agreeing with the intention:

1. **The stub returned the draft whether or not the request asked for it.** So
   "the draft reached the output" was true no matter what the code did, and the
   most likely regression of all — `getFixtures` taking the session and asking
   as the public anyway — was caught only by the two checks on the *request*,
   not by any check on the *answer*. The stub now mirrors
   `get-schedule-override.js`: draft only when `draft=1` **and** an
   Authorization header **and** the caller is allowed the group.
2. **`getSpiritAward` dropping the session went completely unnoticed**, for the
   same reason.
3. **The `/manager` destructure check matched a different method.**
   `const { api, session } = this.state;` appears in more than one method of
   `Manager.dc.html` — `loadDraw()` has its own — so the check passed happily
   while `load()`'s copy had been stripped to `{ api }`. Anchored on `keepDraw`,
   which is unique to `load()`.

**A negative side-effect of fixing (1) is worth keeping:** the public-path
assertions now run against a backend where a draft **exists and would be handed
over**. "No fixtures leak" is a real claim rather than a true-for-boring-reasons
one.

⚠️ **THE SUITE RUNS IN THE SANDBOX AND THE DOCS DID NOT SAY SO.** `CLAUDE.md`
§5 describes `powershell tests/runall.ps1` on jay-pc, ~7 minutes, polled through
a log because an MCP call caps at 60s. The test files are plain Node with no
dependencies and each finds the clone itself, so
`for f in tests/test-*.js; do node "$f"; done` plus
`node tests/_prove-registration.js` reproduces the whole run here with no
PowerShell and no bridge. **That makes iteration free.** `runall.ps1` remains
the authority for the header count on jay-pc.
