# Spec — Manager Dashboard rebuild onto the component engine + Organizer link

Status: approved by Jay (design), not yet built. 31 Jul 2026.

## Problem

`/manager` (`Manager.html`) was built in Phase 1/2 to be "styled like Organizer,"
but that was only ever interpreted as matching Organizer's tab-bar shape and
touch-target sizing — the file itself is built on `app.html`'s own plain
`<script type="module">` architecture, reusing `app.html`'s CSS variables and
card/button classes verbatim. Visually and structurally it still reads as the
mobile matchday tool it was copied from, not as a sibling of `/organizer`.

Jay confirmed (after this was explained) that he wants Manager to actually look
and feel like Organizer — not just borrow its shape — and separately wants a
way to jump from `/organizer` into the manager area directly.

## Scope decisions made during brainstorming

- **Full rebuild onto the `.dc.html` component engine**, not a CSS-only reskin.
  Jay was shown both options, including the risk that this touches Manager's
  live score-entry logic (walkover handling, the 0-0 confirmation, running
  total recalculation) — code that currently works, unmodified, in production
  on `dev`. He chose the full rebuild anyway, wanting genuine parity with
  Organizer's visual system rather than a shape-only match.
- **The Organizer link is a simple nav link, not a read-only embedded view or
  an impersonation feature.** Jay picked "simple nav link to /manager" over
  the other two options offered (an embedded read-only manager view inside
  Organizer, or full impersonation letting an organizer operate any manager's
  dashboard without their login). An organizer clicking the new link still
  has to sign in as that age group's manager once they land on `/manager` —
  this build does not change login/permissions at all.
- **Old `Manager.html` is not deleted or repointed until the new build has
  parity test coverage and Jay has walked through it live.** Given the risk
  of rewriting working score-entry logic, the rollout is staged rather than
  a same-commit swap — see "Rollout" below.

## Design

### New file: `Manager.dc.html`

Built the same way `Organizer.dc.html` and `Scores & Standings.dc.html` are:
a `.dc.html` file with a `<script type="text/x-dc">` class extending
`DCLogic`, `{{ }}` template bindings, `<sc-for>`/`<sc-if>` custom tags — no
build step, same as every other component on this site. It keeps the same
six tabs the current `Manager.html` has: Today, Fixtures & scoring, Results,
Tables, Draw, Registrations (Draw and Registrations were added in Phase 2 and
carry forward unchanged in scope).

**Visual system**: reuses Organizer's actual CSS — its spacing scale, card
treatment (border/radius/shadow), typography (font sizes, weights, letter
spacing), and color usage — rather than `app.html`'s mobile-tuned variables.
The touch-target sizing Phase 1 added for phone use is reconsidered against
Organizer's own (desktop-appropriate) density; exact values are a task-level
decision during planning, not fixed here, since the point is "matches
Organizer," not a specific pixel number.

### Data and backend

No backend changes. Consumes the exact same `scores-data.js` functions the
current `Manager.html` and `Organizer.dc.html` both already call
(`getFixtures`, `getStandings`, `submitResult`, `clearResult`, `scoringFor`,
`teamLabel`, `teamShort`, `teamKey`, `login`, `currentSession`, the Draw-tab
functions from Phase 2, the Registrations-tab functions from Phase 2). No new
Netlify functions, no schema changes, no changes to `manager-login.js`.

### Ported logic — the risk this build exists to manage

The score-entry flow's actual logic (walkover handling, the 0-0 confirmation
step, live total recalculation as scores are typed) has to be re-expressed in
the `.dc.html` engine's `this.state`/`setState` pattern, the way
`Organizer.dc.html` and `Scores & Standings.dc.html` already express their own
stateful forms. This is a genuine rewrite of working code, not a copy-paste —
which is exactly why the original Phase 1 plan avoided it. Every distinct
behavior currently covered by `tests/test-manager-dashboard.js` needs an
equivalent test against the new file proving the SAME behavior, not just that
the new code runs without throwing.

### Organizer link

A "View Manager Area" button/link added to `Organizer.dc.html`'s header/nav,
navigating to `/manager` — mirroring the existing "← Main site" link pattern
Manager already has pointing back to the homepage. No permission or session
changes: an organizer clicking it still needs to sign in as that age group's
manager to actually do anything on `/manager`, exactly as today.

### Rollout — staged, not a same-commit swap

1. Build `Manager.dc.html` alongside the existing `Manager.html`, both present
   in the repo. `/manager`'s route keeps pointing at `Manager.html` until step 3.
2. Prove parity: every test in `tests/test-manager-dashboard.js` (or its
   equivalent) has a matching assertion against `Manager.dc.html`'s behavior,
   plus new tests for anything the visual rebuild changes structurally (e.g.
   new component lifecycle, new state shape). Full existing suite must keep
   passing unchanged throughout.
3. Only after Jay has walked through `Manager.dc.html` live (on the `dev`
   preview deploy) and is happy, the `/manager` route is repointed from
   `Manager.html` to `Manager.dc.html`, and the old file is removed in a
   separate, small, easily-revertable commit.

## Testing

- Full parity coverage against `tests/test-manager-dashboard.js`'s existing
  cases (login, all six tabs' rendering and interactions, walkover handling,
  0-0 confirmation, live total recalculation, session/permission edge cases)
  before the route ever switches.
- Every new test assertion proven against a real injected fault, per this
  project's standing convention — a check that only confirms the new code
  runs is not sufficient, especially here given how much of this rewrite is
  logic that already worked once.
- Full existing suite (currently 2,265 checks / 228 injected faults on `dev`
  as of the uniform draw editor work) must keep passing unchanged throughout
  every task.

## Global constraints

- No changes to `scores-data.js`'s function signatures, `manager-login.js`,
  or any other backend file — this is a frontend rebuild only.
- `Manager.html` is not deleted or repointed until parity testing is complete
  and Jay has done a live walkthrough — see "Rollout" above.
- `Organizer.dc.html`'s own existing tabs/functionality are not modified
  beyond adding the one new nav link.
- Work happens on `dev`, never directly to `main` — a `main` push needs a
  shown diff and Jay's explicit yes, per standing project convention.
- Every git write goes through the device-bridge method in
  `claude/writing-to-github-from-claude.md`, with a tree-hash verification
  before/after push.
- `Manager.dc.html`'s touch-target/density decisions favor matching
  Organizer's desktop-appropriate visual system over Phase 1's phone-tuned
  sizing, per the approved design above — exact values are a planning-time
  decision, not fixed in this spec.

## Self-review

**Placeholder scan:** no TBD/TODO markers.

**Internal consistency:** the "no backend changes" constraint is consistent
across Data/backend, Global constraints, and the Rollout section. The staged
rollout (old file stays until parity + walkthrough) is consistent with the
risk called out in "Ported logic" and with Jay's own choice to accept that
risk in exchange for genuine visual/architectural parity.

**Scope check:** two related but separable pieces — the Manager rebuild, and
the Organizer nav link. The nav link is small enough not to need its own spec;
it's included here since it's part of the same brainstorming conversation and
has no dependency on the rebuild being finished (it can be built and shipped
independently, and the implementation plan should reflect that — the link can
land early, pointing at the still-`Manager.html`-backed `/manager` route,
without waiting on the rebuild).

**Ambiguity check:** "styled like Organizer" is made concrete (spacing, card
treatment, typography, color usage — not just tab-bar shape) so a future
implementer isn't left guessing what "look and feel" means, the same
ambiguity that caused Phase 1 to under-deliver on this exact point.
