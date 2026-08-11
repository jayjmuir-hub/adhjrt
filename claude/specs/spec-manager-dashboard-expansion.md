# Manager Dashboard — Draw, Registrations & Spirit Award Expansion (Spec)

**Status:** Approved by Jay, 31 Jul 2026. Builds on the already-shipped
`spec-manager-dashboard.md` (Today / Fixtures & scoring / Results / Tables on
`/manager`, merged to `dev`). This spec covers the second phase: porting the
rest of a manager's existing abilities — currently only reachable via
`/scores` ("Full manager tools") — onto `/manager` itself.

## Why

Jay noticed managers still have to leave `/manager` and go to the old
`/scores` page (`Scores & Standings.dc.html`) to do anything beyond scoring:
build their draw, publish it, see who's registered, or nominate a Spirit of
Rugby Award winner. The whole point of `/manager` was to give managers one
clean, purpose-built page — this closes that gap.

## Ground truth used to write this spec

An audit of the live code (not assumptions) found every manager-usable
capability in `app.html` and `Scores & Standings.dc.html` that is not yet on
`/manager`. All of it is backed by functions that already exist and are
already tested in `scores-data.js` — no new Netlify functions, no backend
changes, no schema changes required for anything in this spec:

- `getDraw`, `saveDraw`, `resetDraw` (scores-data.js:1534, 1575, 1657)
- `autoKnockoutSlots`, `regeneratePoolSlots` (1558, 1567)
- `publishDraw`, `unpublishDraw`, `canPublishNow` (1611, 1622, 1635)
- `weekendClashes`, `describeClash`, `loadAllDraws` (957, 1008, 1023)
- `getMyRegistrations` (1781) — already server-side scoped to the caller's
  own age group by token (`netlify/functions/get-my-registrations.js`)
- `getSpiritAward`, `supportsSpiritAward` (1467, 1457)
- `pitchesForAgeGroup` (315) — the organiser-assigned pitch list a draw
  editor must restrict its pitch dropdown to

Reference implementation for all of the above: `Scores & Standings.dc.html`,
roughly lines 640–1040 (fixture/knockout editor + import + publish +
clash-checker UI) and 428–560 (registrations + Spirit Award UI). This is
existing, shipped, working code — the new `/manager` UI is a re-skin of its
behaviour into Manager.html's own vanilla-JS/plain-HTML style, not a new
design.

## Architecture

`Manager.html` keeps its current shape: no build step, plain
`<script type="module">`, same visual language (`.card`/`.btn`/`.field`
classes, same palette) as the four tabs already shipped. Two new top-level
tabs are added to the existing tab bar:

`Today` · `Fixtures & scoring` · `Results` · `Tables` · **`Draw`** ·
**`Registrations`**

Every new tab is scoped to the signed-in manager's own `ageGroupId` exactly
like the existing four (an organiser/admin session sees the same
first-competitive-group fallback already built for the other tabs). No new
tab introduces public/anonymous access or a way to browse another age
group's private data.

## Draw tab

One tab holds everything to do with building and releasing the schedule:

1. **Fixture/draw editor** — pools, team assignment between pools, add/
   remove/rename pools, per-pool and per-match kickoff time, per-match pitch
   (dropdown restricted to `pitchesForAgeGroup(agId)` — a manager can only
   pick a pitch an organiser actually assigned this age group). Save /
   Discard / Reset controls, same semantics as today (`saveDraw` writes a
   draft; publishing is a separate, explicit step below).
2. **Import registered teams** — pulls team names from the registration
   sheet into the pool editor, "add missing" or "replace pools" modes, with
   the existing safeguard blocking "replace" once results exist.
3. **Knockout builder** — drag teams onto knockout slots, "Generate from
   standings" (disabled until pool play is complete, same as today),
   "Generate finals from knockout", "Clear knockout", add/edit/rename
   knockout slots.
4. **Publish / Unpublish** — makes the age group's draw visible to the
   public. Carries over the existing restriction: **managers can only
   publish/unpublish on the tournament days themselves (14–15 Nov 2026)**;
   outside that window the button is replaced with text telling them to ask
   an organiser (`canPublishNow`). Organisers are unaffected by this
   restriction wherever they sign in.
5. **Clash checker** — reads all 15 age groups' draws (`weekendClashes`) and
   reports any two age groups double-booked on the same pitch at an
   overlapping time. **Shows pitch and time only** — never another group's
   scores, rosters, or contacts. Included deliberately: pitches can be
   (and sometimes are) assigned to more than one age group at different
   times, and nothing today stops two groups' schedules colliding on a
   shared pitch since each group edits its draw in isolation. This is the
   one place `/manager` intentionally looks outside the manager's own age
   group, and it is limited to that minimal, non-sensitive slice of data.

## Registrations tab

Read-only viewer, scoped server-side to the manager's own age group via
`getMyRegistrations` (the same function already enforces this for
`Scores & Standings.dc.html` — no new access-control code needed):

- **Teams table** — coach/manager name and mobile contact per registered
  team.
- **Players table** — name, date of birth, parent contact, emergency
  contact, medical notes, consent status.
- **Unmatched-registration flag** — a player or team registered but not
  appearing in the current draw's rosters, so a manager notices mismatches
  before match day.

## Spirit of Rugby Award

Not a separate tab — folded into the existing score-entry sheet on
**Fixtures & scoring**, where it's actually used:

- Once a match has a result, the score sheet gains a Spirit of Rugby
  nomination field per side (`supportsSpiritAward(agId)` gates whether this
  age group participates at all).
- A running tally and the current/declared winner is shown on the Fixtures
  & scoring tab itself (`getSpiritAward`), not buried in a menu.

## Also carried over into the score-entry sheet

- **Cards field** — a yellow/red card count per side, alongside the
  existing tries/conversions/penalties/drops inputs. Currently present in
  `Scores & Standings.dc.html`'s score form but missing from `Manager.html`'s.

## Explicitly out of scope

- **"Follow a team" / venue-pitch-map info card** — public-facing browsing
  features from `app.html`'s More tab, not manager abilities. Don't fit a
  dashboard whose entire premise is "you only ever see your own age group."
- **Change password** — audited and confirmed **broken everywhere in the
  app today**, not just missing from `/manager`. `Scores & Standings.dc.html`
  has UI for it, but `scores-data.js` has no `changePassword` export and no
  Netlify function backs a manager-scoped password change — clicking it
  today throws a client-side error. There is nothing working to port. This
  is a separate, pre-existing bug outside this spec's scope; worth its own
  fix later, flagged here so it isn't confused with an oversight in this
  build.
- **No new Netlify functions, no schema changes.** Everything in this spec
  is a new UI surface over already-shipped, already-tested backend
  functions.

## Testing

Same standard as the first Manager Dashboard build and the project's
stated convention: every new test assertion must be proven against a real
injected fault, not merely confirm the code ran. Full existing suite must
keep passing unchanged. Given the size of this expansion (draw editor and
knockout builder are both non-trivial, stateful editors), expect this to
be its own multi-task implementation plan with its own per-task and final
whole-branch review, same process as the first build.

## Rollout

Builds on the existing `work-manager-dashboard` work — continues on that
branch (or a follow-on branch off current `dev`, implementer's call at plan
time) — pushed to `dev` for Jay to verify live before any merge to `main`,
exactly as before.
