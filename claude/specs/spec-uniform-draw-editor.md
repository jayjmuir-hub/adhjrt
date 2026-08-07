# Spec: Uniform tap-to-select draw editor (replace drag-and-drop in Scores & Standings.dc.html)

**Status:** Approved by Jay, 31 Jul 2026. Ready for implementation plan.

## Why

The tournament site has two places where teams get assigned to pools and match slots (the
"draw"): Manager.html (phone-primary, built later) and `Scores & Standings.dc.html` (desktop,
reached via `/scores`, also embedded on the public homepage via `<dc-import name="Scores &
Standings">`). They currently use two different interaction models — Manager uses
tap-to-select-then-tap-to-place, `Scores & Standings.dc.html` uses HTML5 drag-and-drop. Jay
wants these uniform. Direction chosen: convert `Scores & Standings.dc.html` to Manager's
tap-to-select pattern (not the reverse), because tap-to-select works fine with a mouse too and
avoids the touch-unreliability problem that motivated Manager's version in the first place.

**Correction of an earlier wrong assumption:** this is NOT part of Organizer.dc.html — Organizer
has no draw editor at all. The drag-and-drop editor lives in `Scores & Standings.dc.html`
specifically, served at `/scores`.

## Scope

In scope: only the pool/knockout draw assignment UI inside `Scores & Standings.dc.html` — how a
team gets placed into a pool, a pool-stage match slot, or a knockout match slot.

Out of scope: score entry, results display, standings computation, any other tab or page. No
changes to `scores-data.js` or any Netlify function — this is a pure frontend interaction port.
Manager.html itself is not modified (it's already correct and already tested) except as a
reference to copy the pattern from.

## Current state (facts, confirmed by reading the code)

**Manager.html's tap-to-select (the pattern to copy):**
- State: `S.picked = { team, from: {kind:'pool',poolId} | {kind:'slot',slotId,side} |
  {kind:'knockout',slotId,side} } | null`
- `pickTeam(team, from)`: toggles selection — picks up if nothing/something-else is picked,
  deselects if tapping the same chip/source again (via `sameSource()`).
- `placeTeam(dest)`: no-ops if nothing is picked; otherwise calls `removeFromSource(from, team)`
  unconditionally (strips the team out of whichever pool/slot/knockout box it came from), then
  writes `team` into `dest`, then clears `S.picked`.
- `removeFromSource(from, team)`: three branches (pool/slot/knockout) each doing the obvious
  removal.
- Slot and knockout boxes double as pickup source (tap when occupied and nothing picked yet) and
  drop target (tap when something is picked) — same box, state-dependent behavior.
- Visual: `.chip.picked` / `.slotbox.picked` get a green fill (`var(--green)` /
  `var(--green-deep)`).
- Safety nets: every other draw mutator (`removePool`, `renameTeam`, `removeTeam`, `load()`,
  `signOut()`) explicitly clears `S.picked` if it would otherwise point at now-stale data.

**`Scores & Standings.dc.html`'s drag-and-drop (the code to replace):**
- `this._dragTeam` — a bare team-name string, no origin tracking. Set by `onTeamDragStart`.
- Three separate, independent drop handlers: `onPoolDropTeam(poolId)`, `onSlotSideDrop(slotId,
  side)`, `onKnockoutSideDrop(slotId, side)`.
- **Confirmed bug:** only `onPoolDropTeam` removes the team from every pool's roster before
  re-adding it. `onSlotSideDrop` and `onKnockoutSideDrop` do NOT remove the team from its
  previous slot/knockout box — a team dragged from one match slot into another ends up assigned
  to both. This is fixed as part of this port (see Decisions below).
- Renders a second, separate "knockout roster" chip list (`knockoutRosterGroups`) purely for
  drag-sourcing teams into knockout slots — a duplicate of the pool chips.
- Rename/remove buttons on each chip already exist (`chip.onRename` / `chip.onRemove`,
  `onRemoveTeam(poolId, team)` at line ~1568) — same shape as Manager's, unaffected by this
  change except for the pick-vs-button click-target guard (see Decisions).
- Draw state lives in React `this.state.editorDraw` (pools/slots/knockout), loaded per age group
  in `componentDidUpdate` when `editorAgeId` changes (~line 1330), not a global object like
  Manager's `S`.
- No existing test in `tests/` asserts on this file's drag-and-drop handlers by name — the blast
  radius for removing them is zero existing test breakage.

## Decisions (from Jay)

1. **Fix the dedup bug.** The ported tap-to-select editor always removes a team from wherever it
   currently is before placing it, for pool, slot, and knockout destinations alike — matching
   Manager's `removeFromSource` behavior unconditionally, not today's pool-only behavior.
2. **Drop the separate knockout roster.** No second chip list for knockout placement. A team
   reaches a knockout slot the same way it reaches anything else: tap it in its pool card (or
   pick it back up out of a filled knockout box), tap the destination. Matches Manager exactly.

## Design

**Architecture choice:** port the pattern into `Scores & Standings.dc.html`'s own existing
React-class code (idiomatic to that file — `this.state`/`this.setState`), rather than extracting
a shared module used by both files. Manager.html's implementation is a hand-rolled global-object
pattern (`S`, manual `render()`); `Scores & Standings.dc.html` is React-class state. Unifying
these into one shared implementation would be a materially bigger, riskier rewrite touching
Manager.html's already-tested, already-reviewed code for no functional benefit Jay asked for.
Same rules, same behavior, each written idiomatically per file — consistent with how this
project already shares logic (via `scores-data.js` functions) without forcing shared UI code.

**New state:** `this.state.editorPicked = null`, same shape as Manager's `S.picked`:
`{ team, from: {kind:'pool',poolId} | {kind:'slot',slotId,side} | {kind:'knockout',slotId,side} }
| null`.

**New methods on the component** (mirroring Manager's three functions exactly, adapted to
`this.setState`):
- `pickTeam(team, from)` — toggle select/deselect via a `sameSource` comparison, same as
  Manager's.
- `removeFromSource(draw, from, team)` — pure helper returning an updated `pools`/`slots`/
  `knockout` set with `team` stripped out of wherever `from` says it is. (Written as a pure
  function over a `draw` object, not a direct mutator, to fit this file's `setState((s) => ...)`
  immutable-update style — Manager mutates in place because it manually calls `render()`
  afterward; this file re-renders via React state, so the port needs an immutable version doing
  the identical three-branch removal.)
- `placeTeam(dest)` — no-ops if `editorPicked` is null; otherwise calls `removeFromSource` then
  writes `team` into `dest` (pool/slot/knockout), via one `this.setState` combining both steps,
  then clears `editorPicked`.

**Markup changes:**
- Pool chips: `draggable="true" onDragStart="..."` → `onClick="{{ chip.onPick }}"`, with the
  existing rename/remove buttons' click handlers stopping propagation so they don't also trigger
  a pick (same guard Manager already applies).
- Pool roster drop zone: `onDragOver`/`onDrop` → a single `onClick` on the zone background that
  calls `placeTeam({kind:'pool', poolId})` only when the click target is the zone itself, not a
  child chip (same distinction Manager's `wireDraw()` makes).
- Pool-stage slot boxes (Home/Away): `onDragOver`/`onDropHome`/`onDropAway` → one `onClick` per
  box that either picks up the occupying team (if the box has a team and nothing is currently
  picked) or places the picked team there (if something is picked) — the same dual-purpose
  box behavior Manager uses.
- Knockout slot boxes: same dual-purpose `onClick` pattern as pool-stage slot boxes, targeting
  `dest.kind === 'knockout'`.
- Delete: `onTeamDragStart`, `onPoolDropTeam`, `onSlotSideDrop`, `onKnockoutSideDrop`,
  `this._dragTeam`, all `draggable`/`onDragStart`/`onDragOver`/`onDrop` attributes, and the
  `knockoutRosterGroups` rendering block entirely.

**Visual:** apply the same "picked" highlight Manager uses — a green fill on the selected chip
and on a slot/knockout box currently armed to receive a placement — using this file's own
existing color tokens (site accent green `#17A34A`, consistent with the "signature bar" red→green
accent used elsewhere on the site, not a new color).

**Safety nets to carry over** (audit every existing mutator in this file and add an
`editorPicked`-clearing guard wherever Manager's build needed one):
- `onRemoveTeam(poolId, team)` — clear `editorPicked` if it referenced this team.
- Pool removal (whatever the pool-delete method is named in this file) — clear if `editorPicked`
  pointed into that pool.
- Team rename (if this file supports renaming independent of remove/re-add) — clear if
  `editorPicked` pointed at the old name.
- Age-group switch (`componentDidUpdate` when `editorAgeId` changes) — clear `editorPicked`,
  since it's now pointing at a different age group's draw entirely.
- Save (`onSaveDraw()`) — clear `editorPicked` after a successful save, matching Manager's
  post-save behavior.
- Any "discard unsaved changes" / reload-draw action this file has — clear `editorPicked`.

The exact method names and line numbers for each of these mutators need to be re-confirmed
against the file as of implementation time (this spec was written from a point-in-time read) —
the implementation plan's tasks should each re-grep the current file rather than trust these
line numbers as gospel.

## Testing

**No existing test breaks** — nothing in `tests/` currently asserts on `onTeamDragStart`,
`onPoolDropTeam`, `onSlotSideDrop`, or `onKnockoutSideDrop` by name (confirmed by grep across all
of `tests/`).

**New test file required**, mirroring `test-manager-dashboard.js`'s Draw-tab test sections
(pick/place/deselect via toggling the same source; a pool-to-pool move; a slot-to-slot move that
specifically proves the dedup fix by asserting the team is NOT left in its old slot — this is the
fault-injection-worthy assertion, since a naive "just add to destination" port would pass a
shallow "team appears at destination" check while still failing to remove it from the origin);
picked-state-cleared checks for team-remove, pool-remove, age-group switch, and save; rendered
`class="... picked"` assertions for chips and slot/knockout boxes paired with a check that the
`.picked` CSS rule actually exists (same fault-proof pairing `test-manager-dashboard.js` uses).

Per the project's standing rule, every new assertion must be proven against a real injected
fault, not just checked to confirm the change was applied.

New test file gets added to `tests/runall.ps1`'s explicit `$tests` array — this project has
already been bitten once by a new test file existing in the repo but silently not running because
it was left off that list.

Full existing suite (2,193 checks / 228 injected faults as of this spec) must keep passing
unchanged, plus the new file's checks on top.

## Global constraints

- No changes to `scores-data.js` or any Netlify function.
- No changes to Manager.html's own implementation (reference only).
- No changes outside `Scores & Standings.dc.html`, its new test file, and `tests/runall.ps1`.
- Work happens on `dev` (or a feature branch merged into `dev`) — never directly to `main`. A
  `main` push needs a shown diff and an explicit yes from Jay, per standing project rule.
- Every git write to GitHub goes through the device-bridge method in
  `claude/writing-to-github-from-claude.md` — build and test in the sandbox first, verify a tree-
  hash match against the PC before/after push.
