# Uniform Draw Editor (tap-to-select) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HTML5 drag-and-drop pool/knockout draw editor in `Scores & Standings.dc.html` (served at `/scores`) with the same tap-to-select-then-tap-to-place interaction Manager.html's Draw tab already uses, fixing a confirmed dedup bug and dropping the separate knockout roster chip list along the way.

**Architecture:** Port Manager.html's `S.picked` / `pickTeam` / `placeTeam` / `removeFromSource` pattern into `Scores & Standings.dc.html`'s own React-class state (`this.state.editorPicked`, `this.setState`) rather than extracting a shared module — the two files' state models (Manager's hand-rolled global object + manual `render()` vs. this file's React class state) are different enough that unifying them is a bigger, riskier rewrite than what was asked for. Manager.html is read-only reference material in this plan; it is never modified.

**Tech Stack:** Plain JS "`.dc.html`" component files (a custom template engine — `<script type="text/x-dc">` classes extending `DCLogic`, `{{ }}` template bindings, `<sc-for>`/`<sc-if>` custom tags), Node.js test scripts using the project's own `tests/_lib.js` harness (`readRepo`, `section`, `check`, `eq`, `summary`) with a per-test-file `DCLogic`/`loadComponent`/`build` stand-in (established pattern, see `tests/test-fixtures-results-sync.js`).

## Global Constraints

- No changes to `scores-data.js` or any Netlify function — this is a pure frontend interaction port.
- No changes to `Manager.html` itself — read-only reference for the pattern being ported.
- No changes outside `Scores & Standings.dc.html`, the new test file (`tests/test-scores-draw-editor.js`), and `tests/runall.ps1`.
- Work happens on `dev` (or a feature branch merged into `dev`) — never directly to `main`. A `main` push needs a shown diff and an explicit yes from Jay.
- Every git write to GitHub goes through the device-bridge method in `claude/writing-to-github-from-claude.md` — build and test in the sandbox first, verify a tree-hash match against the PC before/after push. Never `git add -A`.
- Full existing suite (2,193 checks / 228 injected faults as of the spec) must keep passing unchanged, plus the new file's checks on top.
- Every new test assertion must be proven against a real injected fault, not just a check that the change was applied.
- Site brand green for the "picked" highlight: `#17A34A` (fill) / `#0F7A36` (deep/border) — the same values `Manager.html` defines as `--green`/`--green-deep`, and the same green already used by this file's own "Save changes" button.

---

### Task 1: Core pick/place/remove logic + isolated tests (no template wiring yet)

**Files:**
- Modify: `Scores & Standings.dc.html` — add `editorPicked` to the initial state object (near `editorDraw: null, editorAgeId: null, editorBusy: false, editorMsg: '',`), and add four new methods (`pickTeam`, `samePickSource`, `removeTeamFromDraw`, `placeTeam`) directly after the existing `onTeamDragStart(team, e) { ... }` method (search for `onTeamDragStart(team, e) {` to find it — do not rely on a line number, it may have drifted).
- Create: `tests/test-scores-draw-editor.js`
- Modify: `tests/runall.ps1` is NOT touched yet — that's Task 6, once the file's checks are final. (Running it manually with `node tests/test-scores-draw-editor.js` works fine before then.)

**Interfaces:**
- Produces: `this.state.editorPicked` — `{ team, from: {kind:'pool',poolId} | {kind:'slot',slotId,side} | {kind:'knockout',slotId,side} } | null`. `pickTeam(team, from)`, `placeTeam(dest)`, `samePickSource(a, b)`, `removeTeamFromDraw(draw, from, team)` — all instance methods on the `Component` class in `Scores & Standings.dc.html`. Later tasks (2–4) call `pickTeam`/`placeTeam` from template-wired `onClick` handlers; Task 5 extends `removeTeamFromDraw`'s callers' setState blocks with `editorPicked`-clearing guards.

- [ ] **Step 1: Add `editorPicked` to initial state**

Find this line in `Scores & Standings.dc.html`'s constructor state object:

```js
editorDraw: null, editorAgeId: null, editorBusy: false, editorMsg: '',
```

Replace it with:

```js
editorDraw: null, editorAgeId: null, editorBusy: false, editorMsg: '',
// { team, from: {kind:'pool',poolId} | {kind:'slot',slotId,side} | {kind:'knockout',slotId,side} } | null
// Ported from Manager.html's S.picked — same shape, same rules. Manager is
// phone-primary and HTML5 drag-and-drop is unreliable on touch, which is why
// it uses tap-to-select-then-tap-to-place instead of this file's drag-and-drop.
// This task starts porting that pattern here too, for a uniform editor.
editorPicked: null,
```

- [ ] **Step 2: Write the failing tests for pick/deselect and the dedup fix**

Create `tests/test-scores-draw-editor.js`:

```js
/* tests/test-scores-draw-editor.js
   ------------------------------------------------------------------------
   Ports Manager.html's tap-to-select-then-tap-to-place draw editor into
   Scores & Standings.dc.html (previously drag-and-drop), for a uniform
   editor across /manager and /scores. See claude/specs/spec-uniform-draw-
   editor.md in the Quins JRT Claude project for the full design.

   Confirmed bug fixed here: today, dragging a team already in one match
   slot into a different slot leaves it in BOTH slots — onSlotSideDrop and
   onKnockoutSideDrop never removed the team from its old slot, only
   onPoolDropTeam did. The new pickTeam/placeTeam always remove-then-place,
   matching Manager.html's placeTeam. The "dedup" tests below are the
   fault-injection-worthy assertions: a naive port that only checks "team
   appears at the destination" would still pass with the old bug present.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Same minimal framework stand-in every other component-driving test uses
   (see tests/test-fixtures-results-sync.js, tests/test-organizer-grouping.js,
   tests/test-venue-map.js). Deliberately duplicated per test file rather
   than shared, matching this project's established convention. */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function loadComponent(file) {
  const t = readRepo(file);
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no x-dc script found in ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
}

function build(file, props) {
  const C = loadComponent(file);
  const c = new C();
  c.props = props || {};
  return c;
}

/* A draw with two pools, one pool-stage slot per pool already carrying a
   team, and one knockout slot — enough surface to exercise pool<->pool,
   pool<->slot, slot<->slot, and knockout moves. */
function freshDraw() {
  return {
    pools: [
      { id: 'A', name: 'Pool A', teams: ['ADH1', 'DS1'] },
      { id: 'B', name: 'Pool B', teams: ['DE1'] },
    ],
    slots: [
      { id: 'sA1', poolId: 'A', home: 'ADH1', away: '', startMins: 480, pitch: 'Pitch 1' },
      { id: 'sB1', poolId: 'B', home: '', away: '', startMins: 480, pitch: 'Pitch 2' },
    ],
    knockout: [
      { id: 'ko1', round: 'Final', home: '', away: '', startMins: 600, pitch: 'Pitch 1' },
    ],
  };
}

function buildEditor() {
  const c = build('Scores & Standings.dc.html');
  c.state = { ...c.state, editorDraw: freshDraw(), editorAgeId: 'u14b', editorPicked: null };
  return c;
}

async function main() {

/* ======================================================================== */
section('pickTeam(): select / deselect');
{
  const c = buildEditor();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  check('picking a team records it as picked', c.state.editorPicked && c.state.editorPicked.team === 'DS1');
  check('…with the correct source', c.state.editorPicked.from.kind === 'pool' && c.state.editorPicked.from.poolId === 'A');

  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  check('tapping the exact same source again deselects', c.state.editorPicked === null);

  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  check('picking a DIFFERENT team/source replaces the picked one, not toggles it off',
    c.state.editorPicked && c.state.editorPicked.team === 'ADH1' && c.state.editorPicked.from.kind === 'slot');
}

/* ======================================================================== */
section('placeTeam(): pool -> pool move');
{
  const c = buildEditor();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  const poolA = c.state.editorDraw.pools.find((p) => p.id === 'A');
  const poolB = c.state.editorDraw.pools.find((p) => p.id === 'B');
  check('the team left its old pool', !poolA.teams.includes('DS1'));
  check('…and landed in the new pool', poolB.teams.includes('DS1'));
  check('editorPicked is cleared after a successful place', c.state.editorPicked === null);
}

/* ======================================================================== */
section('placeTeam(): the dedup fix — slot -> slot (today\'s bug)');
{
  const c = buildEditor();
  // ADH1 starts in sA1's home side. Move it to sB1's home side.
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'slot', slotId: 'sB1', side: 'home' });
  const sA1 = c.state.editorDraw.slots.find((sl) => sl.id === 'sA1');
  const sB1 = c.state.editorDraw.slots.find((sl) => sl.id === 'sB1');
  // THIS is the assertion that would fail against today's onSlotSideDrop,
  // which never clears the origin slot — proving the dedup fix, not just
  // that the destination was written.
  check('the team is REMOVED from its old slot (dedup fix)', sA1.home === '');
  check('…and present in the new slot', sB1.home === 'ADH1');
}

/* ======================================================================== */
section('placeTeam(): the dedup fix — pool -> knockout, and knockout -> knockout');
{
  const c = buildEditor();
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.placeTeam({ kind: 'knockout', slotId: 'ko1', side: 'home' });
  let poolB = c.state.editorDraw.pools.find((p) => p.id === 'B');
  let ko1 = c.state.editorDraw.knockout.find((sl) => sl.id === 'ko1');
  check('a team placed into a knockout slot leaves its pool roster', !poolB.teams.includes('DE1'));
  check('…and appears in the knockout slot', ko1.home === 'DE1');

  // Now move it from ko1.home to ko1.away (same slot, other side) — proves
  // the same-slot-different-side case also removes from the origin side.
  c.pickTeam('DE1', { kind: 'knockout', slotId: 'ko1', side: 'home' });
  c.placeTeam({ kind: 'knockout', slotId: 'ko1', side: 'away' });
  ko1 = c.state.editorDraw.knockout.find((sl) => sl.id === 'ko1');
  check('moving within the same knockout slot clears the OLD side (dedup fix)', ko1.home === '');
  check('…and sets the new side', ko1.away === 'DE1');
}

/* ======================================================================== */
section('placeTeam(): no-ops safely');
{
  const c = buildEditor();
  c.placeTeam({ kind: 'pool', poolId: 'B' }); // nothing picked
  const poolB = c.state.editorDraw.pools.find((p) => p.id === 'B');
  check('placing with nothing picked is a no-op', eq('poolB unchanged', poolB.teams, ['DE1']));

  const c2 = build('Scores & Standings.dc.html');
  c2.state = { ...c2.state, editorDraw: null, editorPicked: { team: 'X', from: { kind: 'pool', poolId: 'A' } } };
  c2.placeTeam({ kind: 'pool', poolId: 'A' }); // no editorDraw at all
  check('placing with no editorDraw loaded does not throw', true);
}

summary();
}

main();
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node tests/test-scores-draw-editor.js`
Expected: a thrown error such as `TypeError: c.pickTeam is not a function` (the methods don't exist yet).

- [ ] **Step 4: Implement `pickTeam`, `samePickSource`, `removeTeamFromDraw`, `placeTeam`**

Find the existing `onTeamDragStart` method in `Scores & Standings.dc.html`:

```js
onTeamDragStart(team, e) {
  this._dragTeam = team;
  if (e && e.dataTransfer) { try { e.dataTransfer.setData('text/plain', team); } catch (err) {} }
}
```

Leave it in place for now (Task 6 removes it once nothing calls it) and add these four new methods directly after it:

```js
// ---------------- Tap-to-select / tap-to-place ----------------
// Ported from Manager.html's S.picked / pickTeam / placeTeam / removeFromSource
// (same shape, same rules) so the draw editor is uniform across /manager and
// /scores. Manager mutates a global `S.draw` object in place and calls a
// manual render() afterward; this file re-renders via setState, so
// removeTeamFromDraw returns a NEW draw object rather than mutating one.
pickTeam(team, from) {
  const p = this.state.editorPicked;
  if (p && p.team === team && this.samePickSource(p.from, from)) {
    this.setState({ editorPicked: null });
  } else {
    this.setState({ editorPicked: { team, from } });
  }
}
samePickSource(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'pool') return a.poolId === b.poolId;
  return a.slotId === b.slotId && a.side === b.side;
}
// Pure helper: returns a NEW draw with `team` removed from wherever `from`
// says it currently sits.
removeTeamFromDraw(draw, from, team) {
  if (from.kind === 'pool') {
    return { ...draw, pools: draw.pools.map((p) => (p.id === from.poolId ? { ...p, teams: p.teams.filter((t) => t !== team) } : p)) };
  }
  if (from.kind === 'slot') {
    return { ...draw, slots: draw.slots.map((sl) => (sl.id === from.slotId ? { ...sl, [from.side]: '' } : sl)) };
  }
  if (from.kind === 'knockout') {
    return { ...draw, knockout: draw.knockout.map((sl) => (sl.id === from.slotId ? { ...sl, [from.side]: '' } : sl)) };
  }
  return draw;
}
// Always removes-then-places, regardless of origin — this is the dedup fix:
// today's onSlotSideDrop/onKnockoutSideDrop skip the removal step, which is
// how a team ends up assigned to two match slots at once.
placeTeam(dest) {
  const picked = this.state.editorPicked;
  if (!picked || !this.state.editorDraw) return;
  const { team, from } = picked;
  this.setState((s) => {
    let draw = this.removeTeamFromDraw(s.editorDraw, from, team);
    if (dest.kind === 'pool') {
      draw = { ...draw, pools: draw.pools.map((p) => (p.id === dest.poolId ? (p.teams.includes(team) ? p : { ...p, teams: [...p.teams, team] }) : p)) };
    } else if (dest.kind === 'slot') {
      draw = { ...draw, slots: draw.slots.map((sl) => (sl.id === dest.slotId ? { ...sl, [dest.side]: team } : sl)) };
    } else if (dest.kind === 'knockout') {
      draw = { ...draw, knockout: draw.knockout.map((sl) => (sl.id === dest.slotId ? { ...sl, [dest.side]: team } : sl)) };
    }
    return { editorDraw: draw, editorPicked: null };
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node tests/test-scores-draw-editor.js`
Expected: `test-scores-draw-editor.js: 14/14 checks passed` (or similar — every `check(...)` call above passing, 0 failures printed).

- [ ] **Step 6: Commit**

```bash
git add "Scores & Standings.dc.html" tests/test-scores-draw-editor.js
git commit -m "Add tap-to-select pick/place logic to the Scores & Standings draw editor (not yet wired to the template)"
```

---

### Task 2: Wire the pool roster chips and pool drop zone to tap

**Files:**
- Modify: `Scores & Standings.dc.html` — the `teamChips` array built in `renderVals()` (search for `teamChips: pool.teams.map((t) => ({` inside the `poolCards` map), and the pool chip / pool drop-zone template markup (search for `<sc-for list="{{ pool.teamChips }}"` and the enclosing `<div onDragOver="{{ pool.onDragOverZone }}"` wrapper).
- Test: `tests/test-scores-draw-editor.js` (append a new section)

**Interfaces:**
- Consumes: `pickTeam(team, from)`, `placeTeam(dest)` from Task 1.
- Produces: per-chip `onPick`, `onRename`, `onRemove`, `chipBg`, `chipBorder` template tokens; per-pool `onZoneClick` token. Task 3 follows the same `chipBg`/`chipBorder` naming convention for slot boxes (as `homeBg`/`homeBorder` etc.), so later tasks/tests can rely on that naming.

- [ ] **Step 1: Write the failing test for tap-to-select via the rendered chip tokens**

Append to `tests/test-scores-draw-editor.js`, directly before `summary();`:

```js
/* ======================================================================== */
section('renderVals(): pool chips and zone are tap-wired, not drag-wired');
{
  const c = buildEditor();
  c.state.api = { minutesToTimeInput: () => '08:00', minutesToDisplay: () => '', poolEndMins: () => 500 };
  const vals = c.renderVals();
  const poolA = vals.poolCards.find((p) => p.id === 'A');
  const chipDS1 = poolA.teamChips.find((ch) => ch.name === 'DS1');

  check('a pool chip exposes onPick, not onDragStart', typeof chipDS1.onPick === 'function' && chipDS1.onDragStart === undefined);
  check('an unpicked chip uses the default (non-green) background', chipDS1.chipBg === '#1f1f22');

  chipDS1.onPick();
  check('tapping the chip records it as picked', c.state.editorPicked && c.state.editorPicked.team === 'DS1');

  const vals2 = c.renderVals();
  const poolA2 = vals2.poolCards.find((p) => p.id === 'A');
  const chipDS1picked = poolA2.teamChips.find((ch) => ch.name === 'DS1');
  check('…and re-renders it with the green "picked" fill', chipDS1picked.chipBg === '#17A34A' && chipDS1picked.chipBorder === '#0F7A36');

  const poolB2 = vals2.poolCards.find((p) => p.id === 'B');
  check('tapping the destination pool\'s zone places it there',
    (() => { poolB2.onZoneClick({ currentTarget: 'zone', target: 'zone' }); return c.state.editorDraw.pools.find((p) => p.id === 'B').teams.includes('DS1'); })());
  check('…and clears editorPicked', c.state.editorPicked === null);

  // Clicking the zone when the click actually landed on a CHILD chip (not the
  // bare zone background) must NOT also place — this is the click-target
  // guard replacing drag-and-drop's "only onDrop on the zone itself" behavior.
  const vals3 = c.renderVals();
  const poolA3 = vals3.poolCards.find((p) => p.id === 'A');
  poolA3.teamChips[0].onPick(); // pick ADH1 up
  poolA3.onZoneClick({ currentTarget: 'zone', target: 'not-the-zone' });
  check('a click that bubbled up from a child element does not also place', c.state.editorPicked !== null);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/test-scores-draw-editor.js`
Expected: FAIL — `poolA.teamChips.find(...).onPick` is `undefined` (not a function yet), since `renderVals()` still only produces the old drag tokens.

- [ ] **Step 3: Wire pool chips and the pool drop zone to tap in `renderVals()`**

Find this block inside the `poolCards` map in `renderVals()`:

```js
onDragOverZone: (e) => e.preventDefault(),
onDropZone: (e) => { e.preventDefault(); this.onPoolDropTeam(pool.id); },
teamChips: pool.teams.map((t) => ({
  name: t,
  onDragStart: (e) => this.onTeamDragStart(t, e),
  onRename: () => this.onRenameTeam(pool.id, t),
  onRemove: () => this.onRemoveTeam(pool.id, t),
})),
```

Replace it with:

```js
// Tap the zone's own background (not a child chip) to place a picked team
// here — e.currentTarget is the element the handler is bound to, e.target is
// whatever was actually clicked, so they only match on the bare background.
onZoneClick: (e) => { if (e.target === e.currentTarget) this.placeTeam({ kind: 'pool', poolId: pool.id }); },
teamChips: pool.teams.map((t) => {
  const isPicked = !!(s.editorPicked && s.editorPicked.team === t && s.editorPicked.from.kind === 'pool' && s.editorPicked.from.poolId === pool.id);
  return {
    name: t,
    picked: isPicked,
    chipBg: isPicked ? '#17A34A' : '#1f1f22',
    chipBorder: isPicked ? '#0F7A36' : 'rgba(255,255,255,0.15)',
    onPick: () => this.pickTeam(t, { kind: 'pool', poolId: pool.id }),
    // stopPropagation so tapping Rename/Remove doesn't also register as a pick.
    onRename: (e) => { e.stopPropagation(); this.onRenameTeam(pool.id, t); },
    onRemove: (e) => { e.stopPropagation(); this.onRemoveTeam(pool.id, t); },
  };
}),
```

- [ ] **Step 4: Update the pool chip and pool zone markup**

Find this template block:

```html
<div onDragOver="{{ pool.onDragOverZone }}" onDrop="{{ pool.onDropZone }}" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.18);border-radius:10px;margin-bottom:10px;min-height:44px">
  <sc-for list="{{ pool.teamChips }}" as="chip" hint-placeholder-count="5">
    <div draggable="true" onDragStart="{{ chip.onDragStart }}" style="display:flex;align-items:center;gap:6px;background:#1f1f22;border:1px solid rgba(255,255,255,0.15);border-radius:100px;padding:6px 6px 6px 14px;font-size:13px;font-weight:700;cursor:grab;user-select:none;white-space:nowrap">
      <span style="white-space:nowrap">{{ chip.name }}</span>
      <button onClick="{{ chip.onRename }}" aria-label="Rename team" style="background:transparent;border:none;color:#7f8794;cursor:pointer;font-size:12px;padding:2px 4px">&#9998;</button>
      <button onClick="{{ chip.onRemove }}" aria-label="Remove team" style="background:transparent;border:none;color:#ff8a8a;cursor:pointer;font-size:14px;padding:2px 5px">&times;</button>
    </div>
  </sc-for>
</div>
```

Replace it with:

```html
<div onClick="{{ pool.onZoneClick }}" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.18);border-radius:10px;margin-bottom:10px;min-height:44px">
  <sc-for list="{{ pool.teamChips }}" as="chip" hint-placeholder-count="5">
    <div onClick="{{ chip.onPick }}" style="display:flex;align-items:center;gap:6px;background:{{ chip.chipBg }};border:1px solid {{ chip.chipBorder }};border-radius:100px;padding:6px 6px 6px 14px;font-size:13px;font-weight:700;cursor:pointer;user-select:none;white-space:nowrap">
      <span style="white-space:nowrap">{{ chip.name }}</span>
      <button onClick="{{ chip.onRename }}" aria-label="Rename team" style="background:transparent;border:none;color:#7f8794;cursor:pointer;font-size:12px;padding:2px 4px">&#9998;</button>
      <button onClick="{{ chip.onRemove }}" aria-label="Remove team" style="background:transparent;border:none;color:#ff8a8a;cursor:pointer;font-size:14px;padding:2px 5px">&times;</button>
    </div>
  </sc-for>
</div>
```

- [ ] **Step 5: Update the pool section's intro copy**

Find (in the pool-stage editor's intro paragraph):

```html
<p style="color:#7f8794;font-size:13px;margin-bottom:18px;line-height:1.6">Drag a team from a pool's roster onto another pool to move it, or onto a match slot's Home/Away box to assign it there. Edit kickoff time directly — the list re-sorts by time automatically.</p>
```

Replace with:

```html
<p style="color:#7f8794;font-size:13px;margin-bottom:18px;line-height:1.6">Tap a team to pick it up, then tap another pool or a match slot's Home/Away box to place it there. Tap the same team again to put it down. Edit kickoff time directly — the list re-sorts by time automatically.</p>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node tests/test-scores-draw-editor.js`
Expected: all checks pass, including the new "pool chips and zone are tap-wired" section.

- [ ] **Step 7: Commit**

```bash
git add "Scores & Standings.dc.html" tests/test-scores-draw-editor.js
git commit -m "Wire pool roster chips and pool drop zone to tap-to-select in the draw editor"
```

---

### Task 3: Wire pool-stage match slot boxes to tap (dual-purpose pickup/drop)

**Files:**
- Modify: `Scores & Standings.dc.html` — the `slotRows` array inside the `poolCards` map in `renderVals()` (search for `slotRows: slots.map((sl) => ({`), and the slot-row template markup (search for `<sc-for list="{{ pool.slotRows }}"`).
- Test: `tests/test-scores-draw-editor.js` (append a new section)

**Interfaces:**
- Consumes: `pickTeam`, `placeTeam` from Task 1.
- Produces: per-row `onHomeClick`/`onAwayClick`, `homeBg`/`homeBorder`/`awayBg`/`awayBorder` tokens, replacing `onDragOver`/`onDropHome`/`onDropAway`. Task 4 mirrors this exact naming for knockout rows.

- [ ] **Step 1: Write the failing test for slot-box dual-purpose tap**

Append to `tests/test-scores-draw-editor.js`, before `summary();`:

```js
/* ======================================================================== */
section('renderVals(): pool-stage slot boxes are tap-wired (pickup AND drop)');
{
  const c = buildEditor();
  c.state.api = { minutesToTimeInput: () => '08:00', minutesToDisplay: () => '', poolEndMins: () => 500 };
  let vals = c.renderVals();
  let poolA = vals.poolCards.find((p) => p.id === 'A');
  let rowA1 = poolA.slotRows.find((r) => r.id === 'sA1');

  check('an occupied slot box exposes onHomeClick, not onDragOver/onDropHome',
    typeof rowA1.onHomeClick === 'function' && rowA1.onDragOver === undefined && rowA1.onDropHome === undefined);
  check('an unpicked, occupied home box uses the default background', rowA1.homeBg === '#0C0C0E');

  // Tapping an OCCUPIED box with nothing picked PICKS IT UP.
  rowA1.onHomeClick();
  check('tapping a filled slot box with nothing picked arms it as the pick', c.state.editorPicked && c.state.editorPicked.team === 'ADH1' && c.state.editorPicked.from.kind === 'slot');

  vals = c.renderVals();
  poolA = vals.poolCards.find((p) => p.id === 'A');
  rowA1 = poolA.slotRows.find((r) => r.id === 'sA1');
  check('…and re-renders it with the green "armed" fill', rowA1.homeBg === '#17A34A' && rowA1.homeBorder === '1.5px solid #0F7A36');

  // Tapping a DIFFERENT box while something is picked PLACES it there.
  const poolB = vals.poolCards.find((p) => p.id === 'B');
  const rowB1 = poolB.slotRows.find((r) => r.id === 'sB1');
  rowB1.onAwayClick();
  check('tapping an empty box while something is picked places it there', c.state.editorDraw.slots.find((sl) => sl.id === 'sB1').away === 'ADH1');
  check('…and the origin slot is cleared (dedup fix)', c.state.editorDraw.slots.find((sl) => sl.id === 'sA1').home === '');
  check('…and editorPicked clears', c.state.editorPicked === null);

  // Tapping an EMPTY box with nothing picked does nothing.
  vals = c.renderVals();
  poolA = vals.poolCards.find((p) => p.id === 'A');
  rowA1 = poolA.slotRows.find((r) => r.id === 'sA1');
  rowA1.onHomeClick(); // home is now '' after the move above — should no-op
  check('tapping an empty box with nothing picked is a no-op', c.state.editorPicked === null);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/test-scores-draw-editor.js`
Expected: FAIL — `rowA1.onHomeClick` is `undefined`.

- [ ] **Step 3: Wire slot boxes to tap in `renderVals()`**

Find this block inside `slotRows: slots.map((sl) => ({` in `renderVals()`:

```js
onDragOver: (e) => e.preventDefault(),
onDropHome: (e) => { e.preventDefault(); this.onSlotSideDrop(sl.id, 'home'); },
onDropAway: (e) => { e.preventDefault(); this.onSlotSideDrop(sl.id, 'away'); },
```

Replace it with:

```js
homePickedNow: !!(s.editorPicked && s.editorPicked.from.kind === 'slot' && s.editorPicked.from.slotId === sl.id && s.editorPicked.from.side === 'home'),
awayPickedNow: !!(s.editorPicked && s.editorPicked.from.kind === 'slot' && s.editorPicked.from.slotId === sl.id && s.editorPicked.from.side === 'away'),
onHomeClick: () => {
  if (sl.home && !s.editorPicked) { this.pickTeam(sl.home, { kind: 'slot', slotId: sl.id, side: 'home' }); return; }
  if (s.editorPicked) this.placeTeam({ kind: 'slot', slotId: sl.id, side: 'home' });
},
onAwayClick: () => {
  if (sl.away && !s.editorPicked) { this.pickTeam(sl.away, { kind: 'slot', slotId: sl.id, side: 'away' }); return; }
  if (s.editorPicked) this.placeTeam({ kind: 'slot', slotId: sl.id, side: 'away' });
},
```

Then, still inside the same `slotRows` map, find:

```js
home: sl.home || 'Drop team here', away: sl.away || 'Drop team here',
homeColor: sl.home ? '#fff' : '#5a616d', awayColor: sl.away ? '#fff' : '#5a616d',
```

Replace it with:

```js
home: sl.home || 'Tap to place', away: sl.away || 'Tap to place',
homeColor: '#fff', awayColor: sl.away ? '#fff' : '#5a616d',
homeBg: this.state.editorPicked && this.state.editorPicked.from.kind === 'slot' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'home' ? '#17A34A' : '#0C0C0E',
homeBorder: this.state.editorPicked && this.state.editorPicked.from.kind === 'slot' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'home' ? '1.5px solid #0F7A36' : '1.5px dashed rgba(255,255,255,0.18)',
awayBg: this.state.editorPicked && this.state.editorPicked.from.kind === 'slot' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'away' ? '#17A34A' : '#0C0C0E',
awayBorder: this.state.editorPicked && this.state.editorPicked.from.kind === 'slot' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'away' ? '1.5px solid #0F7A36' : '1.5px dashed rgba(255,255,255,0.18)',
```

(Note: `homeColor` is unconditionally `'#fff'` now because an empty box now reads "Tap to place" in white rather than the old dim "Drop team here" — this matches Manager.html's own `.slotbox.empty{color:var(--muted)...}` treatment being visually distinct only via the dashed border + lighter placeholder text weight, not dimmed text color. If this reads as a visual regression once you see it rendered, dim the placeholder text back to `'#5a616d'` when the slot is both empty AND not currently armed as a pick target — but ship it as `'#fff'` first and let Jay flag it if the empty-slot text is now too prominent, since that's a subjective call, not a functional one.)

- [ ] **Step 4: Update the slot-row markup**

Find:

```html
<div onDragOver="{{ row.onDragOver }}" onDrop="{{ row.onDropHome }}" style="flex:1;min-width:0;text-align:center;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.18);border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.homeColor }};line-height:1.25;overflow-wrap:break-word">{{ row.home }}</div>
<span style="color:#5a616d;font-size:11px;font-weight:700;flex:none;width:8px;text-align:center">v</span>
<div onDragOver="{{ row.onDragOver }}" onDrop="{{ row.onDropAway }}" style="flex:1;min-width:0;text-align:center;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.18);border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.awayColor }};line-height:1.25;overflow-wrap:break-word">{{ row.away }}</div>
```

(inside the pool-stage `slotRows` `<sc-for>`, NOT the knockout one further down — Task 4 handles the knockout rows separately) — replace it with:

```html
<div onClick="{{ row.onHomeClick }}" style="flex:1;min-width:0;text-align:center;background:{{ row.homeBg }};border:{{ row.homeBorder }};border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.homeColor }};line-height:1.25;overflow-wrap:break-word;cursor:pointer">{{ row.home }}</div>
<span style="color:#5a616d;font-size:11px;font-weight:700;flex:none;width:8px;text-align:center">v</span>
<div onClick="{{ row.onAwayClick }}" style="flex:1;min-width:0;text-align:center;background:{{ row.awayBg }};border:{{ row.awayBorder }};border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.awayColor }};line-height:1.25;overflow-wrap:break-word;cursor:pointer">{{ row.away }}</div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node tests/test-scores-draw-editor.js`
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add "Scores & Standings.dc.html" tests/test-scores-draw-editor.js
git commit -m "Wire pool-stage match slot boxes to dual-purpose tap-to-select/place"
```

---

### Task 4: Knockout — drop the separate roster, wire knockout slot boxes to tap

**Files:**
- Modify: `Scores & Standings.dc.html` — remove the `knockoutRosterGroups` declaration in `renderVals()` and its markup block; the `knockoutRows` array in `renderVals()` (search for `knockoutRows: (s.editorDraw`); the knockout section's intro paragraph and markup.
- Test: `tests/test-scores-draw-editor.js` (append a new section)

**Interfaces:**
- Consumes: `pickTeam`, `placeTeam` from Task 1 (identical `kind:'knockout'` destination Task 1 already handles).
- Produces: per-knockout-row `onHomeClick`/`onAwayClick`/`homeBg`/`homeBorder`/`awayBg`/`awayBorder`, same naming convention as Task 3's pool-stage rows. No knockout-specific roster tokens remain.

- [ ] **Step 1: Write the failing test for knockout tap wiring and the dropped roster**

Append to `tests/test-scores-draw-editor.js`, before `summary();`:

```js
/* ======================================================================== */
section('renderVals(): knockout boxes are tap-wired, and the separate roster is gone');
{
  const c = buildEditor();
  c.state.api = { minutesToTimeInput: () => '08:00', minutesToDisplay: () => '', poolEndMins: () => 500 };
  const vals = c.renderVals();

  check('knockoutRosterGroups no longer exists', vals.knockoutRosterGroups === undefined);

  const ko1 = vals.knockoutRows.find((r) => r.id === 'ko1');
  check('a knockout row exposes onHomeClick/onAwayClick, not onDragOver/onDropHome/onDropAway',
    typeof ko1.onHomeClick === 'function' && typeof ko1.onAwayClick === 'function' && ko1.onDragOver === undefined && ko1.onDropHome === undefined);

  // A team reaches a knockout slot by tapping it in its POOL card, same as
  // reaching any other destination — no separate knockout roster chip needed.
  const poolA = vals.poolCards.find((p) => p.id === 'A');
  poolA.teamChips.find((ch) => ch.name === 'DS1').onPick();
  ko1.onHomeClick();
  check('a team picked from a pool chip lands in a knockout slot', c.state.editorDraw.knockout.find((sl) => sl.id === 'ko1').home === 'DS1');
  check('…and left its pool roster (dedup fix)', !c.state.editorDraw.pools.find((p) => p.id === 'A').teams.includes('DS1'));

  // And a filled knockout box is itself a valid pickup source, exactly like
  // a pool-stage slot box.
  const vals2 = c.renderVals();
  const ko1b = vals2.knockoutRows.find((r) => r.id === 'ko1');
  ko1b.onHomeClick();
  check('tapping a filled knockout box with nothing picked arms it as the pick', c.state.editorPicked && c.state.editorPicked.team === 'DS1' && c.state.editorPicked.from.kind === 'knockout');
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/test-scores-draw-editor.js`
Expected: FAIL — `vals.knockoutRosterGroups` still exists, `ko1.onHomeClick` is `undefined`.

- [ ] **Step 3: Remove `knockoutRosterGroups` from `renderVals()`**

Find and delete this block entirely:

```js
const knockoutRosterGroups = (s.editorDraw ? s.editorDraw.pools : []).map((pool) => ({
  id: pool.id, name: pool.name,
  chips: pool.teams.map((t) => ({ name: t, onDragStart: (e) => this.onTeamDragStart(t, e) })),
}));
```

Also find and delete this line further down in the same `renderVals()` return object:

```js
knockoutRosterDragOver: (e) => e.preventDefault(),
```

Also remove `knockoutRosterGroups` from wherever the return object lists it as a key (search the returned object literal for `knockoutRosterGroups,` or `knockoutRosterGroups:` and delete that entry).

- [ ] **Step 4: Wire knockout rows to tap**

Find this block inside `knockoutRows: (...).map((sl) => ({`:

```js
onDragOver: (e) => e.preventDefault(),
onDropHome: (e) => { e.preventDefault(); this.onKnockoutSideDrop(sl.id, 'home'); },
onDropAway: (e) => { e.preventDefault(); this.onKnockoutSideDrop(sl.id, 'away'); },
```

Replace it with:

```js
onHomeClick: () => {
  if (sl.home && !this.state.editorPicked) { this.pickTeam(sl.home, { kind: 'knockout', slotId: sl.id, side: 'home' }); return; }
  if (this.state.editorPicked) this.placeTeam({ kind: 'knockout', slotId: sl.id, side: 'home' });
},
onAwayClick: () => {
  if (sl.away && !this.state.editorPicked) { this.pickTeam(sl.away, { kind: 'knockout', slotId: sl.id, side: 'away' }); return; }
  if (this.state.editorPicked) this.placeTeam({ kind: 'knockout', slotId: sl.id, side: 'away' });
},
```

Then, in the same map, find:

```js
home: sl.home || 'Drop team here', away: sl.away || 'Drop team here',
homeColor: sl.home ? '#fff' : '#5a616d', awayColor: sl.away ? '#fff' : '#5a616d',
```

Replace with:

```js
home: sl.home || 'Tap to place', away: sl.away || 'Tap to place',
homeColor: '#fff', awayColor: '#fff',
homeBg: this.state.editorPicked && this.state.editorPicked.from.kind === 'knockout' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'home' ? '#17A34A' : '#0C0C0E',
homeBorder: this.state.editorPicked && this.state.editorPicked.from.kind === 'knockout' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'home' ? '1.5px solid #0F7A36' : '1.5px dashed rgba(255,255,255,0.18)',
awayBg: this.state.editorPicked && this.state.editorPicked.from.kind === 'knockout' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'away' ? '#17A34A' : '#0C0C0E',
awayBorder: this.state.editorPicked && this.state.editorPicked.from.kind === 'knockout' && this.state.editorPicked.from.slotId === sl.id && this.state.editorPicked.from.side === 'away' ? '1.5px solid #0F7A36' : '1.5px dashed rgba(255,255,255,0.18)',
```

- [ ] **Step 5: Remove the knockout roster markup and update the knockout rows' markup + intro copy**

Find and delete this entire block:

```html
<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <sc-for list="{{ knockoutRosterGroups }}" as="grp" hint-placeholder-count="2">
    <div style="background:#0C0C0E;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;flex:1;min-width:220px">
      <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#5a616d;text-transform:uppercase;margin-bottom:8px">{{ grp.name }}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <sc-for list="{{ grp.chips }}" as="chip" hint-placeholder-count="5">
          <div draggable="true" onDragStart="{{ chip.onDragStart }}" style="background:#1f1f22;border:1px solid rgba(255,255,255,0.15);border-radius:100px;padding:6px 14px;font-size:12px;font-weight:700;cursor:grab;user-select:none;white-space:nowrap">{{ chip.name }}</div>
        </sc-for>
      </div>
    </div>
  </sc-for>
</div>
```

Find the knockout section's intro paragraph:

```html
<p style="color:#7f8794;font-size:13px;margin-bottom:14px;line-height:1.6">Drag a team below onto a Home/Away box to assign it. Times auto-seed once pool play ends, but you can edit them (and the matchup) directly here.</p>
```

Replace with:

```html
<p style="color:#7f8794;font-size:13px;margin-bottom:14px;line-height:1.6">Tap a team in its pool card above to pick it up, then tap a Home/Away box below to place it — or tap a filled box to pick that team back up. Times auto-seed once pool play ends, but you can edit them (and the matchup) directly here.</p>
```

Find the knockout row's Home/Away markup:

```html
<div onDragOver="{{ row.onDragOver }}" onDrop="{{ row.onDropHome }}" style="flex:1;min-width:0;text-align:center;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.18);border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.homeColor }};line-height:1.25;overflow-wrap:break-word">{{ row.home }}</div>
<span style="color:#5a616d;font-size:11px;font-weight:700;flex:none;width:8px;text-align:center">v</span>
<div onDragOver="{{ row.onDragOver }}" onDrop="{{ row.onDropAway }}" style="flex:1;min-width:0;text-align:center;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.18);border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.awayColor }};line-height:1.25;overflow-wrap:break-word">{{ row.away }}</div>
```

Replace with:

```html
<div onClick="{{ row.onHomeClick }}" style="flex:1;min-width:0;text-align:center;background:{{ row.homeBg }};border:{{ row.homeBorder }};border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.homeColor }};line-height:1.25;overflow-wrap:break-word;cursor:pointer">{{ row.home }}</div>
<span style="color:#5a616d;font-size:11px;font-weight:700;flex:none;width:8px;text-align:center">v</span>
<div onClick="{{ row.onAwayClick }}" style="flex:1;min-width:0;text-align:center;background:{{ row.awayBg }};border:{{ row.awayBorder }};border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:700;color:{{ row.awayColor }};line-height:1.25;overflow-wrap:break-word;cursor:pointer">{{ row.away }}</div>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node tests/test-scores-draw-editor.js`
Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add "Scores & Standings.dc.html" tests/test-scores-draw-editor.js
git commit -m "Drop the separate knockout roster and wire knockout slot boxes to tap-to-select"
```

---

### Task 5: Safety nets — clear `editorPicked` on rename, remove, pool-delete, and editor reload

**Files:**
- Modify: `Scores & Standings.dc.html` — `onRenameTeam`, `onRemoveTeam`, `onRemovePool`, `loadEditor`.
- Test: `tests/test-scores-draw-editor.js` (append a new section)

**Interfaces:**
- Consumes: `editorPicked` state (Task 1), the setState-returning patterns already used by these four methods.
- Produces: none new — this task only adds guards to existing methods so `editorPicked` cannot outlive the team/pool/age-group it referenced.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test-scores-draw-editor.js`, before `summary();`:

```js
/* ======================================================================== */
section('editorPicked safety nets: it must not outlive what it pointed at');
{
  // Rename: editorPicked held the OLD name.
  {
    const c = buildEditor();
    c.state.modal = null;
    c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    c.onRenameTeam('A', 'DS1'); // opens the in-app rename modal
    c.state.modal.onConfirm('DS1x'); // simulates Jay typing the new name and confirming
    check('renaming a picked team clears editorPicked', c.state.editorPicked === null);
    check('…but still renames the team', c.state.editorDraw.pools.find((p) => p.id === 'A').teams.includes('DS1x'));
  }
  // Rename: editorPicked pointed at a DIFFERENT team — must survive untouched.
  {
    const c = buildEditor();
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    c.onRenameTeam('A', 'DS1');
    c.state.modal.onConfirm('DS1x');
    check('renaming an UNPICKED team leaves editorPicked alone', c.state.editorPicked && c.state.editorPicked.team === 'ADH1');
  }
  // Remove team
  {
    const c = buildEditor();
    c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    c.onRemoveTeam('A', 'DS1'); // opens the in-app confirm modal
    c.state.modal.onConfirm();
    check('removing the picked team clears editorPicked', c.state.editorPicked === null);
  }
  // Remove pool — picked team was IN that pool
  {
    const c = buildEditor();
    c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    c.onRemovePool('A');
    c.state.modal.onConfirm();
    check('deleting the pool the picked team lived in clears editorPicked', c.state.editorPicked === null);
  }
  // Remove pool — picked team was in a DIFFERENT pool
  {
    const c = buildEditor();
    c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
    c.onRemovePool('A');
    c.state.modal.onConfirm();
    check('deleting an unrelated pool leaves editorPicked alone', c.state.editorPicked && c.state.editorPicked.team === 'DE1');
  }
}

/* ======================================================================== */
section('editorPicked safety nets: loadEditor (age switch, save, discard all route through it)');
{
  const c = buildEditor();
  c.state.api = {
    getDraw: async () => freshDraw(),
    saveDraw: async () => ({ ok: true }),
    minutesToTimeInput: () => '08:00', minutesToDisplay: () => '', poolEndMins: () => 500,
  };
  c.state.session = { token: 'x' };
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  await c.loadEditor('u14b');
  check('loadEditor clears editorPicked (covers age-group switch)', c.state.editorPicked === null);

  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  await c.onSaveDraw();
  check('onSaveDraw (routes through loadAdmin -> loadEditor) clears editorPicked', c.state.editorPicked === null);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/test-scores-draw-editor.js`
Expected: FAIL on most of the new checks — `editorPicked` is currently untouched by `onRenameTeam`/`onRemoveTeam`/`onRemovePool`/`loadEditor`.

(`onSaveDraw` calls `this.loadAdmin(editorAgeId)`, which is not stubbed in this test's fake `api` beyond `getDraw`/`saveDraw` — if it throws on a missing `api.getFixtures`/`api.getStandings` or similar, add minimal no-op stubs for whatever it calls, matching the `fakeScoresApi` stand-in pattern in `tests/test-fixtures-results-sync.js`. Read `loadAdmin`'s body first — search for `async loadAdmin(` — to see exactly what it awaits, and stub only what's needed to let it resolve without throwing.)

- [ ] **Step 3: Add the safety-net guards**

Find `onRenameTeam`:

```js
onRenameTeam(poolId, oldName) {
  this.promptModal('Rename team', oldName, (trimmed) => {
    if (trimmed === oldName) return;
    this.setState((s) => {
      const pools = s.editorDraw.pools.map((p) => (p.id === poolId ? { ...p, teams: p.teams.map((t) => (t === oldName ? trimmed : t)) } : p));
      const slots = s.editorDraw.slots.map((sl) => ({ ...sl, home: sl.home === oldName ? trimmed : sl.home, away: sl.away === oldName ? trimmed : sl.away }));
      return { editorDraw: { ...s.editorDraw, pools, slots } };
    });
  });
}
```

Replace with:

```js
onRenameTeam(poolId, oldName) {
  this.promptModal('Rename team', oldName, (trimmed) => {
    if (trimmed === oldName) return;
    this.setState((s) => {
      const pools = s.editorDraw.pools.map((p) => (p.id === poolId ? { ...p, teams: p.teams.map((t) => (t === oldName ? trimmed : t)) } : p));
      const slots = s.editorDraw.slots.map((sl) => ({ ...sl, home: sl.home === oldName ? trimmed : sl.home, away: sl.away === oldName ? trimmed : sl.away }));
      // Safety net (mirrors Manager.html's MAJOR 3 fix): editorPicked may
      // still hold the OLD name. Left uncleared, placing it afterwards would
      // resurrect the pre-rename name alongside the renamed team.
      const editorPicked = (s.editorPicked && s.editorPicked.team === oldName) ? null : s.editorPicked;
      return { editorDraw: { ...s.editorDraw, pools, slots }, editorPicked };
    });
  });
}
```

Find `onRemoveTeam`:

```js
onRemoveTeam(poolId, team) {
  this.confirmModal(`Remove ${team} from this pool? Any match slots featuring them will show "Drop team here" until reassigned.`, () => {
    this.setState((s) => {
      const pools = s.editorDraw.pools.map((p) => (p.id === poolId ? { ...p, teams: p.teams.filter((t) => t !== team) } : p));
      const slots = s.editorDraw.slots.map((sl) => ({ ...sl, home: sl.home === team ? '' : sl.home, away: sl.away === team ? '' : sl.away }));
      return { editorDraw: { ...s.editorDraw, pools, slots } };
    });
  });
}
```

Replace with:

```js
onRemoveTeam(poolId, team) {
  this.confirmModal(`Remove ${team} from this pool? Any match slots featuring them will show "Tap to place" until reassigned.`, () => {
    this.setState((s) => {
      const pools = s.editorDraw.pools.map((p) => (p.id === poolId ? { ...p, teams: p.teams.filter((t) => t !== team) } : p));
      const slots = s.editorDraw.slots.map((sl) => ({ ...sl, home: sl.home === team ? '' : sl.home, away: sl.away === team ? '' : sl.away }));
      // Safety net: the removed team must not still be "in hand" to place
      // straight back in somewhere else.
      const editorPicked = (s.editorPicked && s.editorPicked.team === team) ? null : s.editorPicked;
      return { editorDraw: { ...s.editorDraw, pools, slots }, editorPicked };
    });
  });
}
```

(Note the confirm copy also changes from "Drop team here" to "Tap to place" here, matching the placeholder text changed in Tasks 3–4.)

Find `onRemovePool`:

```js
onRemovePool(poolId) {
  this.confirmModal('Delete this pool? This removes all its teams and match slots.', () => {
    this.setState((s) => ({
      editorDraw: {
        ...s.editorDraw,
        pools: s.editorDraw.pools.filter((p) => p.id !== poolId),
        slots: s.editorDraw.slots.filter((sl) => sl.poolId !== poolId),
      },
    }));
  });
}
```

Replace with:

```js
onRemovePool(poolId) {
  this.confirmModal('Delete this pool? This removes all its teams and match slots.', () => {
    this.setState((s) => {
      // Safety net (mirrors Manager.html's MAJOR 3 fix): a team picked up
      // from this pool (or one of its match slots) must not survive the
      // pool's deletion — otherwise it can be silently placed into a
      // different pool a moment later.
      const removedPool = s.editorDraw.pools.find((p) => p.id === poolId);
      const removedTeams = new Set((removedPool && removedPool.teams) || []);
      const editorPicked = (s.editorPicked && removedTeams.has(s.editorPicked.team)) ? null : s.editorPicked;
      return {
        editorDraw: {
          ...s.editorDraw,
          pools: s.editorDraw.pools.filter((p) => p.id !== poolId),
          slots: s.editorDraw.slots.filter((sl) => sl.poolId !== poolId),
        },
        editorPicked,
      };
    });
  });
}
```

Find `loadEditor`:

```js
async loadEditor(agId) {
  const { api } = this.state;
  if (!api || !agId) return;
  // Pass the session so the editor loads the DRAFT, not the published copy.
  const draw = await api.getDraw(agId, this.state.session);
  const ageChanged = agId !== this.state.editorAgeId;
  this.setState({
    editorDraw: draw,
    editorAgeId: agId,
    editorMsg: '',
    publishState: (draw && draw._publish) || null,
  });
```

Replace the `this.setState({...})` call with:

```js
async loadEditor(agId) {
  const { api } = this.state;
  if (!api || !agId) return;
  // Pass the session so the editor loads the DRAFT, not the published copy.
  const draw = await api.getDraw(agId, this.state.session);
  const ageChanged = agId !== this.state.editorAgeId;
  this.setState({
    editorDraw: draw,
    editorAgeId: agId,
    editorMsg: '',
    publishState: (draw && draw._publish) || null,
    // Safety net: a fresh load (age-group switch, or the reload that follows
    // every save/discard) means any in-hand pick refers to draw state that
    // may no longer exist. Same rule as Manager.html's loadDraw().
    editorPicked: null,
  });
```

(Leave the rest of `loadEditor` — the `if (ageChanged && ...) this.props.onAgeChange(agId);` line and everything after it — unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-scores-draw-editor.js`
Expected: all checks pass. If `onSaveDraw`'s test still fails because `loadAdmin` needs more stubbed `api` methods, add exactly the missing ones to the fake `api` object in the test (per the note in Step 2) — do not change `loadAdmin` or `onSaveDraw` themselves to work around a test gap.

- [ ] **Step 5: Commit**

```bash
git add "Scores & Standings.dc.html" tests/test-scores-draw-editor.js
git commit -m "Clear editorPicked on rename, remove, pool-delete, and editor reload"
```

---

### Task 6: Remove dead drag-and-drop code, register the new test file, run the full suite

**Files:**
- Modify: `Scores & Standings.dc.html` — delete `onTeamDragStart`, `onPoolDropTeam`, `onSlotSideDrop`, `onKnockoutSideDrop`.
- Modify: `tests/runall.ps1` — add `'test-scores-draw-editor.js'` to the `$tests` array.
- Verify: full suite run.

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is cleanup plus the project's standing "register the new test file" step (this project has been bitten once already by a new test file existing but not being in `runall.ps1`'s list, so silently never running).

- [ ] **Step 1: Confirm nothing still calls the four drag methods**

Run:

```bash
grep -n "onTeamDragStart\|onPoolDropTeam\|onSlotSideDrop\|onKnockoutSideDrop\|_dragTeam" "Scores & Standings.dc.html"
```

Expected: only the four method DEFINITIONS themselves show up (no call sites) — Tasks 2–4 already replaced every template/`renderVals()` reference to them. If any call site still appears, stop and re-check the relevant earlier task before proceeding — deleting a method something still calls will break at runtime, not at test time (nothing in the test suite renders the full template end-to-end).

- [ ] **Step 2: Delete the four drag-and-drop methods**

Find and delete this entire block:

```js
onTeamDragStart(team, e) {
  this._dragTeam = team;
  if (e && e.dataTransfer) { try { e.dataTransfer.setData('text/plain', team); } catch (err) {} }
}
onPoolDropTeam(poolId) {
  const team = this._dragTeam; if (!team) return;
  this.setState((s) => {
    if (!s.editorDraw) return {};
    const pools = s.editorDraw.pools.map((p) => ({ ...p, teams: p.teams.filter((t) => t !== team) }));
    const target = pools.find((p) => p.id === poolId);
    if (target && !target.teams.includes(team)) target.teams.push(team);
    return { editorDraw: { ...s.editorDraw, pools } };
  });
  this._dragTeam = null;
}
onSlotSideDrop(slotId, side) {
  const team = this._dragTeam; if (!team) return;
  this.setState((s) => ({ editorDraw: { ...s.editorDraw, slots: s.editorDraw.slots.map((sl) => (sl.id === slotId ? { ...sl, [side]: team } : sl)) } }));
  this._dragTeam = null;
}
```

(This block sits directly before `onSlotTimeChange` — leave `onSlotTimeChange` and everything after it untouched.)

Then find and delete this block (sits just before `onKnockoutTimeChange`):

```js
onKnockoutSideDrop(slotId, side) {
  const team = this._dragTeam; if (!team) return;
  this.setState((s) => ({ editorDraw: { ...s.editorDraw, knockout: s.editorDraw.knockout.map((sl) => (sl.id === slotId ? { ...sl, [side]: team } : sl)) } }));
  this._dragTeam = null;
}
```

- [ ] **Step 3: Register the new test file in `runall.ps1`**

Find the `$tests = @(...)` array in `tests/runall.ps1` (it currently ends with `'test-fixtures-logos.js'`):

```powershell
$tests = @(
  'test-registration.js',
  'test-registration-panel.js',
  'test-venue-map.js',
  'test-venue-splits.js',
  'test-session-permissions.js',
  'test-agegroups.js',
  'test-intake.js',
  'test-functions-load.js',
  'test-accounts.js',
  'test-organizer-grouping.js',
  'test-email.js',
  'test-google-auth.js',
  'test-manager-dashboard.js',
  'test-fixtures-results-sync.js',
  'test-simulate-tournament.js',
  'test-team-logos.js',
  'test-fixtures-logos.js'
)
```

Replace with (adding the new file as the last entry):

```powershell
$tests = @(
  'test-registration.js',
  'test-registration-panel.js',
  'test-venue-map.js',
  'test-venue-splits.js',
  'test-session-permissions.js',
  'test-agegroups.js',
  'test-intake.js',
  'test-functions-load.js',
  'test-accounts.js',
  'test-organizer-grouping.js',
  'test-email.js',
  'test-google-auth.js',
  'test-manager-dashboard.js',
  'test-fixtures-results-sync.js',
  'test-simulate-tournament.js',
  'test-team-logos.js',
  'test-fixtures-logos.js',
  'test-scores-draw-editor.js'
)
```

(Re-check this array against the actual current file before editing — Task 1–5 don't touch `runall.ps1`, but confirm no other unrelated change landed on `dev` in the meantime that altered this list.)

- [ ] **Step 4: Run every test file individually and confirm the exact counts**

Run each of the following and record the "N/N checks passed" line for each:

```bash
node tests/test-registration.js
node tests/test-registration-panel.js
node tests/test-venue-map.js
node tests/test-venue-splits.js
node tests/test-session-permissions.js
node tests/test-agegroups.js
node tests/test-intake.js
node tests/test-functions-load.js
node tests/test-accounts.js
node tests/test-organizer-grouping.js
node tests/test-email.js
node tests/test-google-auth.js
node tests/test-manager-dashboard.js
node tests/test-fixtures-results-sync.js
node tests/test-simulate-tournament.js
node tests/test-team-logos.js
node tests/test-fixtures-logos.js
node tests/test-scores-draw-editor.js
```

Expected: every file reports 0 failures, and the pre-existing 17 files' totals sum to exactly 2,193 (unchanged from before this plan) — confirming nothing outside `Scores & Standings.dc.html` regressed. `test-scores-draw-editor.js`'s own total is new and additive on top of 2,193. (`pwsh` may not be installed in every environment this plan runs in — running each file individually with `node` is an equivalent, sandbox-safe substitute for `tests/runall.ps1` when `pwsh` is unavailable; use `runall.ps1` directly if `pwsh` is available, since it also enforces the injected-fault count.)

- [ ] **Step 5: Commit**

```bash
git add "Scores & Standings.dc.html" tests/runall.ps1
git commit -m "Remove the now-dead drag-and-drop draw-editor code, register the new test file"
```

- [ ] **Step 6: Final whole-branch check before handing off for push**

Run:

```bash
grep -n "onDragStart\|onDragOver\|onDrop=\|draggable=\"true\"\|_dragTeam" "Scores & Standings.dc.html"
```

Expected: no matches anywhere in the file (confirms the drag-and-drop interaction is fully gone, not just the four named methods).

```bash
grep -rn "onTeamDragStart\|onPoolDropTeam\|onSlotSideDrop\|onKnockoutSideDrop\|knockoutRosterGroups\|knockoutRosterDragOver" tests/
```

Expected: no matches (confirms no test anywhere references the removed names).

---

## Self-Review

**Spec coverage:**
- Core tap-to-select/place pattern ported → Task 1.
- Pool roster + pool zone → Task 2.
- Pool-stage match slots (dual-purpose pickup/drop) → Task 3.
- Knockout: drop separate roster, wire knockout boxes → Task 4.
- Decision 1 (fix the dedup bug) → `removeTeamFromDraw`/`placeTeam` in Task 1, proven by the slot→slot and same-knockout-slot dedup tests in Tasks 1, 3, 4.
- Decision 2 (drop the separate knockout roster) → Task 4, Step 3/5.
- Safety nets (rename/remove/pool-delete/age-switch/save/discard all clear `editorPicked`) → Task 5. Save and discard both route through `loadEditor`, so Task 5's `loadEditor` guard plus the direct `onSaveDraw` test covers both without a separate `onDiscardDraw` test (it calls the identical `loadEditor` path).
- Visual "picked" highlight using the site's brand green (`#17A34A`/`#0F7A36`) → Tasks 2–4, using inline computed style tokens rather than a CSS class (this file has no stylesheet classes at all — everything is inline `style="..."` — unlike Manager.html's `.chip.picked`/`.slotbox.picked` classes, which don't apply to this file's markup style).
- New test file added to `runall.ps1` → Task 6, Step 3.
- No changes to `scores-data.js`, Netlify functions, or Manager.html → confirmed by every task's Files list; nothing in this plan touches any of them.
- Dead code removal (`onTeamDragStart`, `onPoolDropTeam`, `onSlotSideDrop`, `onKnockoutSideDrop`, `_dragTeam`) → Task 6.

**Placeholder scan:** no TBD/TODO markers; every step includes the actual find/replace code, not a description of it.

**Type/naming consistency check:** `editorPicked` shape (`{team, from:{kind,...}}`) is identical across Tasks 1, 2, 3, 4, 5. `pickTeam`/`placeTeam`/`samePickSource`/`removeTeamFromDraw` names introduced in Task 1 are used unchanged in every later task. `chipBg`/`chipBorder` (Task 2) and `homeBg`/`homeBorder`/`awayBg`/`awayBorder` (Tasks 3–4) follow one naming convention throughout. Green/deep-green hex values (`#17A34A`/`#0F7A36`) are the same literal strings in every task and in the Global Constraints section — no drift.

**One open, deliberately-flagged judgment call:** Task 3, Step 3's note about `homeColor`/`awayColor` always being `'#fff'` now (versus the old dimmed `'#5a616d'` for an empty box) is a genuine subjective visual call, not a functional gap — flagged inline for whoever implements/reviews Task 3 to notice and adjust if it looks wrong once rendered, rather than silently guessing either way.

## Execution Handoff

Plan complete and saved to `claude/plans/plan-uniform-draw-editor.md` in the "Quins JRT" Claude project. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
