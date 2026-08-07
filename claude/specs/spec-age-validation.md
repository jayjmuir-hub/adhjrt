# Spec — age validation on the team form (sub-project 2)

_Decisions taken with Jay, 28 July 2026, after sub-project 1 shipped. Written
down before any code._

> **Read first:** `CLAUDE.md` from a fresh clone, then
> `claude/plans/plan-submission-gateway.md`. This builds on the gateway; without it
> there would be nowhere to enforce any of this.

## The problem

**The team registration form does not validate player ages at all.** `submitTeam()`
checks club, age group, preferred pool, coach name and email, and the squad cap.
That is the entire list. A roster row accepts any date of birth.

All the age logic lives on the *player* form (`_playerAgeCheck()`). The team form
never got any of it.

**It affects all fifteen age groups**, not just the 12-a-side ones — nothing
about the gap is format-specific. Ten of the fifteen involve contact; five of
those are 12-a-side. The consequence varies, the gap does not.

⚠️ **Thirteen of the fifteen groups are a SINGLE year band.** Only U16 and U18
span two. Being one year out puts a player in the wrong group almost everywhere —
the tolerance is much tighter than "roughly the right age" suggests. U6 is *only*
5-year-olds.

Proven with the site's own `calcAge` against its own cut-off: **01 Jun 2010 is
16y 2m at the 31 Aug 2026 cut-off, and U16B is for 14 or 15** — that player
belongs in U18B. Not a play-up case; play-up is one group *younger*.

The team form is also the **higher-volume path**: a coach enters a whole squad at
once.

## Jay's ask, in his words

> "the coaches form should also have that catch to help prevent coaches from
> entering incorrect dob's or registering a player out of the age range"

Note the two distinct goals: catching **typos** and catching **genuinely
out-of-range players**. The design should serve both — most real hits will be
mistyped years, not deliberate ringers, and the wording should assume that.

## Decisions taken

### 1. A player one group young is FLAGGED, not blocked

On the player form, playing up one age group is permitted **with parent consent**,
collected as a mandatory tick. A coach typing a squad cannot give parental
consent on a parent's behalf.

**Decision: let it through, mark it, and surface it in `/organizer` so Jay can
chase consent before the weekend.**

- Nothing is lost, and nothing is waved through unseen.
- The alternative — blocking — would stop a coach submitting eighteen players
  because one is young, which pushes them to fudge a date rather than use the
  player form.
- ⚠️ **This creates a job**, not just a flag. `/organizer` must make outstanding
  play-up consents findable, or the flag is decoration.

Anything more than one group out stays **blocked**, same as the player form.

### 2. The coach sees it on the row, as they type

**Decision: per-row feedback the moment the date of birth is complete**, the same
way the player form behaves today, plus a hard gate at submit.

An eighteen-player squad refused with "row 12 is out of range" means scrolling
back to hunt for it. Fixing in place is the difference between a form people
finish and a form people abandon.

### 3. The date of birth entry changes to match the player form

**Decision: three dropdowns per row (day / month / year), via `composeDob()`.**

The team form currently uses a native date input. The player form deliberately
does not, because `Date` accepts `2026-02-31` and silently rolls it forward to
3 March — the same trap `isRealDate()` closes in the registration window.

- Consistent between the two forms.
- Closes the impossible-date hole rather than relying on the age check to catch
  it by accident.
- Cost: more fiddly for a coach entering eighteen players. ⚠️ **Worth watching.**
  If it proves painful in practice, revisit — but correctness first.

## Not yet decided

- **How the flag appears in `/organizer`.** Ties into the open question about the
  squad list being invisible in the Teams table (see `claude/state-of-play.md`) —
  the roster is stored but never displayed, so there is currently nowhere for a
  per-player flag to *go*. **These two should probably be designed together.**
- **Whether the player form should require an age group.** It does not today —
  `_playerFormError()` never asks for it and `emptyPlayerForm()` starts it blank.
  The server matches that deliberately (a rule the coach was never shown looks
  like a bug), but it is a hole.
- **What happens to squads already submitted** before this ships. Currently four
  test rows and nothing real, so this is cheap to decide later.

## Where it goes

The place is built and waiting:

- **`validateSubmission()` in `netlify/functions/_intake.js`** — the server-side
  gate, already carrying the required fields, the squad cap and the length caps.
- **`netlify/functions/_agegroups.js`** — already carries `ages` for all fifteen
  groups, with a drift test against the client's copy.
- **`_playerAgeCheck()` in `Quins JRT.dc.html`** — the existing client-side rule,
  to be reused per roster row rather than reimplemented.

⚠️ **The rule will then exist in two places** — the browser for instant feedback,
the gateway for enforcement. That is the same shape as the squad cap, and it
needs the same guard: a test that reads both and asserts they produce the
**identical sentence** for identical input. See the client/server agreement
section in `tests/test-intake.js`.

## Testing — the rules this project runs on

- Every assertion proven against a **deliberately injected fault**, and the check
  that fails must be the one claiming to guard that behaviour.
- **Asserting the absence of something is not a test.** Pair every "this file
  does not contain X" with something that runs it.
- **Call it signed in as well as signed out.** Everything behind an auth check is
  invisible until something logs in.
- A test must not throw — a fault that kills the file skips every check after it.
- Boundaries, individually: each age one year either side of every band, for all
  fifteen groups. Not one example.
- ⚠️ **Beware checks whose two possible answers are the same value.** U16B's
  squad cap equals the unknown-group fallback, and that made a broken lookup
  invisible once already. Ages have the same hazard: U16 and U18 both span two
  years, and adjacent groups differ by one.

## Scope

**In:** age validation on the team form's roster rows, client and server; the
play-up flag; the DOB input change.

**Out:** anything about *when* registration is open (done, sub-projects 1 and 3);
the squad list display in `/organizer` (open question, but likely designed
alongside the flag); any change to what a registration contains beyond the DOB
input and the flag.
