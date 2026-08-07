# Manager Dashboard — Draw, Registrations & Spirit Award Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Draw` tab (fixture/pool/knockout editor, import, publish/unpublish, whole-weekend clash check) and a `Registrations` tab to `Manager.html`, and fold Spirit of Rugby Award nomination + a Cards field into the existing score-entry sheet — porting every manager-usable capability that today only exists in `Scores & Standings.dc.html`, onto `/manager`, with zero new backend code.

**Architecture:** `Manager.html` keeps its existing shape exactly as built in `plan-manager-dashboard.md`: one plain `<script type="module">`, no build step, one shared `S` state object, `render()`/`go()`/`wire()` re-render pattern, `.card`/`.btn`/`.field`/`.mrow`/`.sheet` CSS classes already defined in the file's `<style>` block. Two new entries are added to `MGR_TABS` (`draw`, `registrations`), two new `view*()` render functions are added alongside the existing four, and `wire()` gains the new tap handlers. Every new call into `scores-data.js` uses an export that already exists and is already used by `Scores & Standings.dc.html` — this plan adds **no new exports** to `scores-data.js` and **no new Netlify functions**. The one meaningful UI-pattern change from the reference implementation is **replacing HTML5 drag-and-drop with tap-to-select-then-tap-to-place** for moving teams between pools and onto match/knockout slots, because `Manager.html` is phone-primary and native drag-and-drop is unreliable on touch devices.

**Tech Stack:** Vanilla JS ES module (unchanged), `scores-data.js` (unchanged — read only), the existing `save-schedule-override.js` / `publish-schedule.js` / `get-my-registrations.js` Netlify functions (unchanged, called only through the existing `scores-data.js` wrappers `saveDraw`/`resetDraw`/`publishDraw`/`unpublishDraw`/`getMyRegistrations`).

## Global Constraints

- No new Netlify functions. No changes to any file under `netlify/functions/`.
- No new exports added to `scores-data.js`. Every function this plan calls (`getDraw`, `saveDraw`, `resetDraw`, `autoKnockoutSlots`, `regeneratePoolSlots`, `publishDraw`, `unpublishDraw`, `canPublishNow`, `weekendClashes`, `describeClash`, `loadAllDraws`, `getMyRegistrations`, `getSpiritAward`, `supportsSpiritAward`, `pitchesForAgeGroup`, `dayLabelOfAgeGroup`, `timeToMinutes`, `minutesToTimeInput`, `minutesToDisplay`, `slotLengthMins`, `dayStartMins`, `poolEndMins`, `isOrganizerSession`, `ageGroupOfMatch`, `scoringFor`, `scoreLabel`, `scorePoints`, `scoreTotal`, `submitResult`, `clearResult`) already exists in `scores-data.js` today — confirm the exact signature against the file before using it, do not guess.
- Every new test assertion must be proven against a real injected fault (patch the actual logic, confirm the check fails, revert the patch) — a check that only confirms code exists or that a value was applied is not acceptable, per this project's own convention (see `tests/test-manager-dashboard.js`'s own header comment for the established pattern).
- The full existing suite (`tests/runall.ps1` — test-registration.js, test-registration-panel.js, test-venue-map.js, test-venue-splits.js, test-session-permissions.js, test-agegroups.js, test-intake.js, test-functions-load.js, test-accounts.js, test-organizer-grouping.js, test-email.js, test-google-auth.js, test-manager-dashboard.js, test-fixtures-results-sync.js, test-simulate-tournament.js, `_prove-registration.js`) must keep passing unchanged after every task.
- No HTML5 drag-and-drop (`draggable`, `ondragstart`, `ondragover`, `ondrop`) anywhere in this feature — tap-to-select-then-tap-to-place only, per the spec's touch-friendly-adaptation requirement.
- A manager's pitch dropdowns are restricted to `api.pitchesForAgeGroup(agId)` (plus `'TBD'` plus any pitch already saved on that slot, so an old/legacy pitch never silently vanishes) — never free text, never every pitch on the day.
- The clash checker shows pitch + time only, never another age group's scores, rosters or contacts.
- Managers can only publish/unpublish on the tournament days (7–8 Nov 2026); `api.canPublishNow(session, publishState)` is the single source of truth the UI defers to — never a client-side date check duplicated locally.
- Never `git add -A`. Stage only the files this plan actually touches.
- `[skip ci]` on any commit that is docs-only. None of this plan's commits are docs-only.
- Work continues on the existing `work-manager-dashboard` branch. Show the diff and get Jay's yes before any push to `dev`; pushing to `main` costs 15 credits and needs its own explicit go-ahead.

---

### Task 1: Draw tab shell, state, and read-only draw display

**Why this is first:** every later Draw-tab task (editor, import, knockout, publish, clash-check) hangs off one loaded `S.draw` object and one new tab in the tab bar. Building the shell and a read-only render first gives every later task somewhere to attach, and gives this task its own independently-testable deliverable: a manager can open the Draw tab and see their pools, teams and match slots (no editing yet).

**Files:**
- Modify: `Manager.html` — `<style>` block (add a handful of new classes), `MGR_TABS` array, `S` object, `render()`/`wire()` switch, add `loadDraw()`, `viewDraw()`
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `api.getDraw(agId, session)` → `Promise<{ pools: [{id,name,teams:[code,...]}], slots: [{id,poolId,home,away,startMins,pitch}], knockout: [{id,round,home,away,startMins,pitch}], pitches: [string,...], _publish: { published, publishedAt, publishedBy, managerCanPublishNow } } | null>` (`scores-data.js:1534`). Consumes `api.pitchesForAgeGroup(agId)` → `string[]` (`scores-data.js:315`). Consumes `api.minutesToDisplay(mins)` → `'8:00 AM'`-style string (`scores-data.js:1573`). Consumes `S.session`, `S.ageId`, `tName()`, `esc()`, `toast()` — all already defined in `Manager.html` from the first build.
- Produces: `S.draw` (the object `getDraw()` returned, or `null` while loading, or `undefined` if never fetched), `S.drawLoadedFor` (the `agId` the current `S.draw` belongs to — guards a stale response from an in-flight fetch overwriting a newer tab switch, mirroring the existing `load()` guard at `Manager.html:341`), `loadDraw(agId)` (async, fetches and stores), `viewDraw()` (render function called from `render()`'s dispatch), `poolPitchOf(poolId)`, `poolStartOf(poolId)`, `poolSlotCount(poolId)` (pure helpers over `S.draw`, ported from `Scores & Standings.dc.html:1377-1398` with `this.state.editorDraw` replaced by `S.draw`). Later tasks (2–7) read and mutate `S.draw` directly and call `loadDraw()` again after a save.

- [ ] **Step 1: Add the two new CSS classes this whole feature needs**

In `Manager.html`, inside the `<style>` block, immediately after the existing `.tscroll` rules (around line 189, right before the closing `</style>`), add:

```css
/* ---------- Draw tab: tap-to-select team chips (Task 2), pool/slot cards ---------- */
.chip{display:inline-flex;align-items:center;gap:6px;background:#faf9f7;border:1.5px solid var(--line);
      border-radius:100px;padding:8px 8px 8px 14px;font-size:13px;font-weight:700;margin:3px}
.chip.picked{background:var(--green);border-color:var(--green-deep);color:#fff}
.chip button{color:var(--muted);font-size:13px;padding:2px 4px}
.chip.picked button{color:#fff}
.dropzone{min-height:44px;padding:10px;background:#faf9f7;border:1.5px dashed var(--line);
          border-radius:10px;display:flex;flex-wrap:wrap;align-items:flex-start;text-align:left}
.slotbox{flex:1;min-width:0;text-align:center;background:#faf9f7;border:1.5px dashed var(--line);
         border-radius:8px;padding:8px 6px;font-size:12.5px;font-weight:700;overflow-wrap:break-word}
.slotbox.empty{color:var(--muted);font-weight:600}
.slotrow{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.pill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
      padding:4px 10px;border-radius:100px}
.pill-live{background:var(--good-bg);color:var(--green-deep)}
.pill-off{background:var(--paper);color:var(--muted);border:1px solid var(--line)}
```

- [ ] **Step 2: Add the Draw tab to the tab bar and extend `S`**

In `Manager.html`, change the `MGR_TABS` array (around line 293):

```js
const MGR_TABS = [
  { id:'today', label:'Today' },
  { id:'fixtures', label:'Fixtures & scoring' },
  { id:'results', label:'Results' },
  { id:'tables', label:'Tables' },
  { id:'draw', label:'Draw' },
  { id:'registrations', label:'Registrations' },
];
```

Change the `S` object declaration (around line 232):

```js
const S = {
  session: null, ageGroups: [], view: 'today', fixtures: null, standings: null,
  // Draw tab (Tasks 1-7)
  draw: undefined, drawLoadedFor: null, drawBusy: false, drawMsg: '',
  picked: null, // { team, from: {kind:'pool',poolId} | {kind:'slot',slotId,side} | {kind:'knockout',slotId,side} }
  importOpen: false, importMode: 'add', importRows: null, importNote: '',
  clash: null, clashBusy: false,
  // Registrations tab (Task 8)
  regs: undefined, regBusy: false, regSearch: '',
  // Spirit Award (Task 9) is read via api.getSpiritAward() per-render, not cached in S.
};
```

- [ ] **Step 3: Wire `load()` to also fetch the draw when the Draw tab is opened, and add `loadDraw()`**

`Manager.html`'s existing `load(agId)` (around line 337) fetches fixtures+standings unconditionally on every tab switch. The draw editor is heavier (it's a full mutable draft) and not needed on the other four tabs, so fetch it lazily, only when the Draw tab is actually selected. Change `go(v)` (around line 335):

```js
function go(v){
  S.view = v; buildTabs(); render(); window.scrollTo(0,0);
  if (v === 'draw' && S.drawLoadedFor !== S.ageId) loadDraw(S.ageId);
  if (v === 'registrations' && S.regs === undefined) loadRegistrations(); // Task 8 defines loadRegistrations
}
```

Also call it from `load(agId)` itself so switching age group (organiser path) invalidates a stale draw:

```js
async function load(agId){
  S.ageId = agId; S.fixtures = null; S.standings = null;
  S.draw = undefined; S.drawLoadedFor = null; // invalidate: Task 1
  S.regs = undefined; // invalidate: Task 8
  render();
  const [fx, st] = await Promise.all([api.getFixtures(agId), api.getStandings(agId)]);
  if (S.ageId !== agId) return;
  S.fixtures = fx; S.standings = st;
  render();
  if (S.view === 'draw') loadDraw(agId);
  if (S.view === 'registrations') loadRegistrations();
}
```

Add `loadDraw()` right after `load()`:

```js
async function loadDraw(agId){
  S.draw = null; // loading state
  render();
  const draw = await api.getDraw(agId, S.session);
  if (S.ageId !== agId) return; // stale response guard, same pattern as load()
  S.draw = draw;
  S.drawLoadedFor = agId;
  render();
}
```

- [ ] **Step 4: Add `viewDraw()` — read-only for now**

Add this function near the other `view*()` functions (after `viewTables()`, around line 443):

```js
function viewDraw(){
  const head = `<div class="sec-t">Draw</div>`;
  if (S.draw === undefined) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (S.draw === null) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (!S.draw) return head + `<div class="card"><div class="empty"><b>No draw yet</b><div>Nothing to edit for ${esc(ageName(S.ageId))}.</div></div></div>`;
  const d = S.draw;
  const pools = (d.pools || []).map((p) => {
    const slots = (d.slots || []).filter((sl) => sl.poolId === p.id).sort((a,b) => a.startMins - b.startMins);
    const teamRow = (p.teams || []).map((t) => `<span class="chip">${esc(tName(t))}</span>`).join('') || '<span class="muted" style="font-size:13px">No teams yet</span>';
    const slotRows = slots.map((sl) => `<div class="mrow"><div><div class="mtime">${esc(api.minutesToDisplay(sl.startMins))}</div><div class="mpitch">${esc(sl.pitch||'TBD')}</div></div>
      <div><div class="mteams">${esc(sl.home?tName(sl.home):'TBD')} <span class="muted">v</span> ${esc(sl.away?tName(sl.away):'TBD')}</div></div><div></div></div>`).join('');
    return `<div class="sec-t">${esc(p.name)}</div><div class="card"><div style="padding:12px 14px">${teamRow}</div>${slotRows}</div>`;
  }).join('');
  const ko = (d.knockout || []).filter((k) => k.home || k.away);
  const koRows = ko.map((sl) => `<div class="mrow"><div><div class="mtime">${esc(api.minutesToDisplay(sl.startMins))}</div><div class="mpitch">${esc(sl.pitch||'TBD')}</div></div>
    <div><div class="mteams">${esc(sl.home?tName(sl.home):'TBD')} <span class="muted">v</span> ${esc(sl.away?tName(sl.away):'TBD')}</div><div class="mmeta">${esc(sl.round||'')}</div></div><div></div></div>`).join('');
  return head + pools + (ko.length ? `<div class="sec-t">Knockout</div><div class="card">${koRows}</div>` : '');
}
```

Wire it into `render()`'s dispatch (around line 346-352):

```js
function render(){
  $('mgrMain').innerHTML = S.view === 'today' ? viewToday()
    : S.view === 'fixtures' ? viewFixtures()
    : S.view === 'results' ? viewResults()
    : S.view === 'tables' ? viewTables()
    : S.view === 'draw' ? viewDraw()
    : viewRegistrations(); // Task 8 defines viewRegistrations
  wire();
}
```

- [ ] **Step 5: Extend the existing test-manager-dashboard.js fake API and add a Draw-tab section**

In `tests/test-manager-dashboard.js`, add these keys to `fakeApi()`'s default object (near `getStandings`):

```js
    getDraw: async (agId) => ({
      pools: [{ id: 'A', name: 'Pool A', teams: ['ADH1', 'DE1', 'DS1'] }],
      slots: [{ id: `${agId}:A:0`, poolId: 'A', home: 'ADH1', away: 'DE1', startMins: 480, pitch: 'A1' }],
      knockout: [],
      pitches: ['A1', 'A2'],
      _publish: { published: false, publishedAt: null, publishedBy: null, managerCanPublishNow: false },
    }),
    pitchesForAgeGroup: () => ['A1', 'A2'],
    minutesToDisplay: (m) => `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`,
```

Add a new section at the end of the file, before `summary('test-manager-dashboard.js');`:

```js
  section('Draw tab (Task 1: read-only shell)');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0)); // let loadDraw()'s fetch microtask settle
    const html = win.__test.viewDraw();
    check('shows the pool name', html.includes('Pool A'));
    check('shows the team chips', html.includes('ADH1') && html.includes('DE1'));
    check('shows the scheduled match slot', html.includes('8:00'));
  }
  {
    // Fault: getDraw() returning null (no draw saved yet) must show the
    // "no draw" empty state, not throw or silently show nothing.
    const { win } = await loadWithApi({ getDraw: async () => null });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const html = win.__test.viewDraw();
    check('shows the no-draw empty state when getDraw() returns null', html.includes('No draw yet'));
  }
```

`win.__test` must expose `go` and `S` for this — extend the harness's own appended line at the bottom of `loadWithApi()` (in `extractModuleScript`'s consumer):

```js
'\nwindow.__test = { S, viewToday, viewFixtures, viewResults, viewTables, viewDraw, boot, load, loadDraw, go, openMatch, findMatch };'
```

(replacing the existing shorter `window.__test = {...}` assignment line already in the file).

- [ ] **Step 6: Run the test, confirm it fails, then fails for the right reason**

Run: `node tests/test-manager-dashboard.js`
Expected: FAIL — `viewDraw is not a function` (or similar), because `Manager.html` doesn't have Steps 1-4 yet at this point if you're following TDD strictly. If you implemented Steps 1-4 before Step 5 (as written above), it should instead PASS immediately — in that case, temporarily comment out the `viewDraw` addition in `Manager.html`, confirm the test now fails with "viewDraw is not a function", then restore it. This is the fault-injection proof this project requires: the test must be shown to actually exercise the new code, not just pass by coincidence.

- [ ] **Step 7: Run the full existing suite**

Run: `node tests/runall.ps1` (or the per-file loop the repo's CI uses if `runall.ps1` needs PowerShell — check `tests/README.md` for the Node-only equivalent command if pwsh isn't available in this environment; if not, run every listed test file individually with `node tests/<file>.js`).
Expected: every file passes, including the extended `test-manager-dashboard.js`.

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add Draw tab shell with read-only pool/slot/knockout display"
```

---

### Task 2: Tap-based team/pool editor (pools, teams, add/remove/rename)

**Why this task is scoped this way:** this is the first *mutating* piece of the Draw tab, and it is the task that establishes the tap-to-select-then-tap-to-place interaction pattern every later editing task (match slots, knockout) reuses. Keeping it to pools+teams only (no match-slot assignment yet — that's Task 3) keeps the reviewable diff to one interaction pattern at a time.

**Files:**
- Modify: `Manager.html` — extend `viewDraw()`, add pool/team CRUD functions, add `wireDraw()` (called from `wire()`)
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `S.draw.pools` (mutated in place via `setState`-free direct mutation + `render()`, matching this codebase's existing pattern of mutating `S` and re-rendering — see `Manager.html`'s existing `S.view = v; render()` idiom, there is no framework `setState` here).
- Produces: `pickTeam(team, from)`, `placeTeam(dest)` (the tap-to-select/tap-to-place core — later tasks' slot/knockout drop targets call `placeTeam` too), `addPool()`, `renamePool(poolId)`, `removePool(poolId)`, `addTeam(poolId, name)`, `renameTeam(poolId, oldName)`, `removeTeam(poolId, team)`. All operate on `S.draw` in place, then call `render()`. None of them call `api.saveDraw` — that's Task 3's Save button, so these are all purely-local edits to the working draft, exactly mirroring the reference (`Scores & Standings.dc.html`'s `onAddPool`/`onRenamePool`/etc. at lines 1542-1616 only touch `editorDraw` in local state; saving is a separate explicit step).

- [ ] **Step 1: Write the failing tests for pick/place and pool/team CRUD**

Add to `tests/test-manager-dashboard.js`, after the Task 1 section:

```js
  section('Draw tab (Task 2: tap-to-select team/pool editor)');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));

    // Tap a team chip: it becomes "picked".
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    check('picking a team records it as picked', win.__test.S.picked && win.__test.S.picked.team === 'DS1');

    // Tapping the SAME chip again deselects it.
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    check('tapping the same chip again deselects', win.__test.S.picked === null);

    // Add a second pool, then move DS1 from Pool A into it by pick+place.
    win.__test.addPool();
    const newPoolId = win.__test.S.draw.pools[1].id;
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    win.__test.placeTeam({ kind: 'pool', poolId: newPoolId });
    const poolA = win.__test.S.draw.pools.find((p) => p.id === 'A');
    const poolB = win.__test.S.draw.pools.find((p) => p.id === newPoolId);
    check('DS1 left Pool A', !poolA.teams.includes('DS1'));
    check('DS1 landed in the new pool', poolB.teams.includes('DS1'));
    check('picked is cleared after a successful place', win.__test.S.picked === null);
  }
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.removeTeam('A', 'ADH1');
    check('removeTeam takes the team out of the pool', !win.__test.S.draw.pools[0].teams.includes('ADH1'));
    // Fault-proof: a match slot that named the removed team must be blanked,
    // not left dangling with a team no pool contains any more.
    const slot = win.__test.S.draw.slots.find((sl) => sl.home === 'ADH1' || sl.away === 'ADH1');
    check('removing a team blanks it out of any match slot that had it', !slot);
  }
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const before = win.__test.S.draw.pools.length;
    win.__test.addPool();
    check('addPool adds exactly one pool', win.__test.S.draw.pools.length === before + 1);
    check('the new pool starts with no teams', win.__test.S.draw.pools[before].teams.length === 0);
  }
```

- [ ] **Step 2: Run and confirm it fails**

Run: `node tests/test-manager-dashboard.js`
Expected: FAIL — `pickTeam is not a function` (none of these exist in `Manager.html` yet).

- [ ] **Step 3: Implement pick/place and pool/team CRUD in `Manager.html`**

Add these functions after `loadDraw()`:

```js
// ---------------- Tap-to-select / tap-to-place ----------------
// Manager.html is phone-primary, and HTML5 drag-and-drop is unreliable on
// touch devices — the reference editor (Scores & Standings.dc.html) uses
// draggable chips + ondragover/ondrop, which this deliberately does NOT
// port. Tapping a chip selects it (S.picked); tapping a destination moves
// it there and clears S.picked; tapping the SAME chip again deselects.
function pickTeam(team, from){
  if (S.picked && S.picked.team === team && sameSource(S.picked.from, from)) {
    S.picked = null;
  } else {
    S.picked = { team, from };
  }
  render();
}
function sameSource(a, b){
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'pool') return a.poolId === b.poolId;
  return a.slotId === b.slotId && a.side === b.side;
}
// Removes `team` from wherever S.picked.from says it currently is.
function removeFromSource(from, team){
  const d = S.draw;
  if (from.kind === 'pool') {
    const p = d.pools.find((x) => x.id === from.poolId);
    if (p) p.teams = p.teams.filter((t) => t !== team);
  } else if (from.kind === 'slot') {
    const sl = d.slots.find((x) => x.id === from.slotId);
    if (sl) sl[from.side] = '';
  } else if (from.kind === 'knockout') {
    const sl = d.knockout.find((x) => x.id === from.slotId);
    if (sl) sl[from.side] = '';
  }
}
function placeTeam(dest){
  if (!S.picked || !S.draw) return;
  const { team, from } = S.picked;
  removeFromSource(from, team);
  if (dest.kind === 'pool') {
    const p = S.draw.pools.find((x) => x.id === dest.poolId);
    if (p && !p.teams.includes(team)) p.teams.push(team);
  } else if (dest.kind === 'slot') {
    const sl = S.draw.slots.find((x) => x.id === dest.slotId);
    if (sl) sl[dest.side] = team;
  } else if (dest.kind === 'knockout') {
    const sl = S.draw.knockout.find((x) => x.id === dest.slotId);
    if (sl) sl[dest.side] = team;
  }
  S.picked = null;
  render();
}

// ---------------- Pool / team CRUD (local draft only — Save is Task 3) ----------------
function addPool(){
  const existingIds = S.draw.pools.map((p) => p.id);
  let nextChar = 'A';
  for (let i = 0; i < 26; i++) { const c = String.fromCharCode(65 + i); if (!existingIds.includes(c)) { nextChar = c; break; } }
  S.draw.pools.push({ id: nextChar, name: `Pool ${nextChar}`, teams: [] });
  render();
}
function renamePool(poolId){
  const p = S.draw.pools.find((x) => x.id === poolId); if (!p) return;
  const next = prompt('Rename pool', p.name);
  if (next == null || !next.trim() || next.trim() === p.name) return;
  p.name = next.trim();
  render();
}
function removePool(poolId){
  if (!confirm('Delete this pool? This removes all its teams and match slots.')) return;
  S.draw.pools = S.draw.pools.filter((p) => p.id !== poolId);
  S.draw.slots = S.draw.slots.filter((sl) => sl.poolId !== poolId);
  render();
}
function addTeam(poolId){
  const val = ($(`newteam-${poolId}`) || {}).value;
  const name = (val || '').trim();
  if (!name) return;
  const p = S.draw.pools.find((x) => x.id === poolId); if (!p) return;
  if (!p.teams.includes(name)) p.teams.push(name);
  render();
}
function renameTeam(poolId, oldName){
  const next = prompt('Rename team', oldName);
  if (next == null) return;
  const trimmed = next.trim();
  if (!trimmed || trimmed === oldName) return;
  const p = S.draw.pools.find((x) => x.id === poolId); if (!p) return;
  p.teams = p.teams.map((t) => (t === oldName ? trimmed : t));
  S.draw.slots = S.draw.slots.map((sl) => ({
    ...sl,
    home: sl.home === oldName ? trimmed : sl.home,
    away: sl.away === oldName ? trimmed : sl.away,
  }));
  render();
}
function removeTeam(poolId, team){
  if (!confirm(`Remove ${team} from this pool? Any match slots featuring them will show "Drop team here" until reassigned.`)) return;
  const p = S.draw.pools.find((x) => x.id === poolId); if (!p) return;
  p.teams = p.teams.filter((t) => t !== team);
  S.draw.slots = S.draw.slots.map((sl) => ({
    ...sl,
    home: sl.home === team ? '' : sl.home,
    away: sl.away === team ? '' : sl.away,
  }));
  render();
}
```

- [ ] **Step 4: Extend `viewDraw()`'s pool rendering to use tappable chips and dropzones, and add `wireDraw()`**

Replace the `pools` line inside `viewDraw()` (from Task 1 Step 4) with:

```js
  const pools = (d.pools || []).map((p) => {
    const slots = (d.slots || []).filter((sl) => sl.poolId === p.id).sort((a,b) => a.startMins - b.startMins);
    const teamChips = (p.teams || []).map((t) => {
      const isPicked = S.picked && S.picked.team === t && S.picked.from.kind === 'pool' && S.picked.from.poolId === p.id;
      return `<span class="chip${isPicked?' picked':''}" data-pick-team="${esc(t)}" data-pick-pool="${esc(p.id)}">${esc(tName(t))}
        <button data-rename-team="${esc(t)}" data-rename-pool="${esc(p.id)}" aria-label="Rename">&#9998;</button>
        <button data-remove-team="${esc(t)}" data-remove-pool="${esc(p.id)}" aria-label="Remove">&times;</button></span>`;
    }).join('');
    return `<div class="sec-t">${esc(p.name)}
        <button class="btn-o" style="width:auto;display:inline;padding:4px 10px;font-size:11px;margin-left:8px" data-rename-pool-btn="${esc(p.id)}">Rename</button>
        <button class="btn-o" style="width:auto;display:inline;padding:4px 10px;font-size:11px;margin-left:6px;color:#a3271b" data-remove-pool-btn="${esc(p.id)}">Delete</button>
      </div>
      <div class="card"><div style="padding:12px 14px">
        <div class="dropzone" data-drop-pool="${esc(p.id)}">${teamChips || '<span class="muted" style="font-size:13px">No teams yet</span>'}</div>
        <div class="field" style="display:flex;gap:8px;margin-top:10px">
          <input id="newteam-${esc(p.id)}" placeholder="New team name" style="flex:1">
          <button class="btn-o" style="width:auto;padding:12px 16px" data-add-team="${esc(p.id)}">+ Add</button>
        </div>
      </div></div>`;
  }).join('');
```

Add `wireDraw()` and call it from the existing `wire()`:

```js
function wireDraw(){
  if (S.view !== 'draw' || !S.draw) return;
  document.querySelectorAll('[data-pick-team]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('[data-rename-team],[data-remove-team]')) return; // let the buttons handle their own clicks
      pickTeam(el.dataset.pickTeam, { kind: 'pool', poolId: el.dataset.pickPool });
    };
  });
  document.querySelectorAll('[data-rename-team]').forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); renameTeam(el.dataset.renamePool, el.dataset.renameTeam); };
  });
  document.querySelectorAll('[data-remove-team]').forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); removeTeam(el.dataset.removePool, el.dataset.removeTeam); };
  });
  document.querySelectorAll('[data-drop-pool]').forEach((el) => {
    el.onclick = (e) => { if (e.target === el) placeTeam({ kind: 'pool', poolId: el.dataset.dropPool }); };
  });
  document.querySelectorAll('[data-add-team]').forEach((el) => { el.onclick = () => addTeam(el.dataset.addTeam); });
  document.querySelectorAll('[data-rename-pool-btn]').forEach((el) => { el.onclick = () => renamePool(el.dataset.renamePoolBtn); });
  document.querySelectorAll('[data-remove-pool-btn]').forEach((el) => { el.onclick = () => removePool(el.dataset.removePoolBtn); });
  document.getElementById('addPoolBtn') && (document.getElementById('addPoolBtn').onclick = addPool);
}
```

Add an "+ Add pool" button at the end of `viewDraw()`'s pool section (append to the `head + pools + ...` return, before the knockout block):

```js
  const addPoolBtn = `<button class="btn btn-o" id="addPoolBtn" style="margin:14px 0">+ Add pool</button>`;
```

and include `addPoolBtn` in the final return string (`return head + pools + addPoolBtn + (ko.length ? ... : '');`).

Change the existing `wire()` function (around line 353) to also call `wireDraw()`:

```js
function wire(){
  document.querySelectorAll('[data-match]').forEach(b => b.onclick = () => openMatch(b.dataset.match));
  wireDraw();
}
```

- [ ] **Step 5: Run the test file, confirm it passes**

Run: `node tests/test-manager-dashboard.js`
Expected: PASS, all Task 1 + Task 2 checks green.

- [ ] **Step 6: Prove the fault-injection requirement on `removeTeam`'s slot-blanking behaviour**

Temporarily change `removeTeam`'s slot-blanking lines to a no-op (comment out the `S.draw.slots = ...` reassignment), run the test, confirm the "removing a team blanks it out of any match slot" check now FAILS, then restore the real code and confirm it passes again. This proves the assertion is actually anchored to real behaviour, not coincidence.

- [ ] **Step 7: Run the full existing suite**

Run every file listed in `tests/runall.ps1` (or the script itself, if runnable in this environment).
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add tap-to-select pool/team editor to the Draw tab"
```

---

### Task 3: Tap-based match slot editor (time/pitch per match, add slot, regenerate from pool) + save/discard/reset

**Files:**
- Modify: `Manager.html` — extend `viewDraw()`'s per-pool match-slot rendering, add slot CRUD, add save/discard/reset buttons and handlers
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `placeTeam()`/`pickTeam()` from Task 2 (a match slot's Home/Away box is just another `dest`/`from` of `kind:'slot'`). Consumes `api.saveDraw(agId, draw, session)` → `Promise<{ok, error?}>` (`scores-data.js:1575`) — payload allow-list is `{pools, slots, knockout, pitches, teamNames}`, confirmed at `scores-data.js:1587-1593`. Consumes `api.resetDraw(agId, session)` → `Promise<{ok, error?}>` (`scores-data.js:1657`). Consumes `api.regeneratePoolSlots(agId, poolId, teams)` → `Array<{id,home,away,startMins,pitch,poolId}>` (`scores-data.js:1567`, synchronous, not async — do not `await` it). Consumes `api.timeToMinutes(hhmm)` → minutes-since-midnight number or `NaN` (`scores-data.js:1571`). Consumes `api.pitchesForAgeGroup(agId)` for the per-slot pitch `<select>` options.
- Produces: `addSlot(poolId)`, `removeSlot(slotId)`, `regeneratePool(poolId)`, `onSlotTimeChange(slotId, hhmm)`, `onSlotPitchChange(slotId, val)`, `saveDraw()` (async, calls `api.saveDraw` then `loadDraw()` again — note this local `saveDraw()` is a `Manager.html`-local function name, distinct from the imported `api.saveDraw`), `discardDraw()` (re-fetches, discarding local edits), `resetDraw()` (async, calls `api.resetDraw`, wraps `confirm()`). These are consumed by no later task directly, but Task 5's knockout editor mirrors the same slot-editing pattern (own functions, same shape).

- [ ] **Step 1: Write the failing tests**

Add to `tests/test-manager-dashboard.js`:

```js
  section('Draw tab (Task 3: match slot editor + save/discard/reset)');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const before = win.__test.S.draw.slots.length;
    win.__test.addSlot('A');
    check('addSlot adds one slot to the pool', win.__test.S.draw.slots.length === before + 1);
    const added = win.__test.S.draw.slots[win.__test.S.draw.slots.length - 1];
    check('the new slot belongs to the right pool', added.poolId === 'A');
    check('the new slot starts empty (Drop team here)', !added.home && !added.away);

    win.__test.removeSlot(added.id);
    check('removeSlot takes it back out', win.__test.S.draw.slots.length === before);
  }
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const slotId = win.__test.S.draw.slots[0].id;
    win.__test.onSlotTimeChange(slotId, '09:40');
    const slot = win.__test.S.draw.slots.find((s) => s.id === slotId);
    check('slot time change updates startMins', slot.startMins === 9*60+40);
    // Fault-proof: a garbage time input must be REJECTED, not silently stored as NaN
    // (a NaN startMins would sort before/after everything unpredictably and break
    // the public fixtures list's own time-sort).
    win.__test.onSlotTimeChange(slotId, 'not-a-time');
    check('an unparseable time is rejected, not stored as NaN', !isNaN(win.__test.S.draw.slots.find((s) => s.id === slotId).startMins));
  }
  {
    let saveCalls = 0, savedPayload = null;
    const { win } = await loadWithApi({
      saveDraw: async (agId, draw) => { saveCalls++; savedPayload = draw; return { ok: true }; },
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.saveDraw();
    check('Save calls api.saveDraw exactly once', saveCalls === 1);
    check('the saved payload carries this age group\'s pools', savedPayload && savedPayload.pools[0].id === 'A');
  }
  {
    // Fault-proof for discard: making a local edit then discarding must
    // throw the edit away by re-fetching, not just leave stale state.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addPool();
    check('the local edit is visible before discard', win.__test.S.draw.pools.length === 2);
    await win.__test.discardDraw();
    check('discard reloads the saved draw, dropping the local edit', win.__test.S.draw.pools.length === 1);
  }
```

- [ ] **Step 2: Run and confirm failure**

Run: `node tests/test-manager-dashboard.js` — expect `addSlot is not a function`.

- [ ] **Step 3: Implement in `Manager.html`**

```js
function addSlot(poolId){
  const step = api.slotLengthMins();
  const poolSlots = S.draw.slots.filter((sl) => sl.poolId === poolId);
  const lastMins = poolSlots.length ? Math.max(...poolSlots.map((sl) => sl.startMins)) : api.dayStartMins() - step;
  const pitch = poolPitchOf(poolId) || 'TBD';
  S.draw.slots.push({ id: `${S.ageId}:${poolId}:new${Date.now()}`, poolId, home: '', away: '', startMins: lastMins + step, pitch });
  render();
}
function removeSlot(slotId){
  S.draw.slots = S.draw.slots.filter((sl) => sl.id !== slotId);
  render();
}
function regeneratePool(poolId){
  if (!confirm("Regenerate this pool's match schedule from its current team list? This replaces all of this pool's match slots, and any scores already entered for them.")) return;
  const pool = S.draw.pools.find((p) => p.id === poolId);
  const keepPitch = poolPitchOf(poolId);
  const fresh = api.regeneratePoolSlots(S.ageId, poolId, pool.teams).map((sl) => (keepPitch ? { ...sl, pitch: keepPitch } : sl));
  S.draw.slots = [...S.draw.slots.filter((sl) => sl.poolId !== poolId), ...fresh];
  render();
}
function onSlotTimeChange(slotId, hhmm){
  const mins = api.timeToMinutes(hhmm);
  if (mins == null || isNaN(mins)) return; // reject garbage input, keep the existing time
  const sl = S.draw.slots.find((x) => x.id === slotId);
  if (sl) sl.startMins = mins;
  render();
}
function onSlotPitchChange(slotId, val){
  const sl = S.draw.slots.find((x) => x.id === slotId);
  if (sl) sl.pitch = val;
  render();
}
// Pool-level helpers (pure reads over S.draw) — same purpose as
// Scores & Standings.dc.html's poolPitchOf/poolStartOf/poolSlotCount
// (lines 1377-1398), ported to read S.draw instead of this.state.editorDraw.
function poolPitchOf(poolId){
  const vals = new Set(S.draw.slots.filter((sl) => sl.poolId === poolId).map((sl) => sl.pitch || 'TBD'));
  if (!vals.size) return 'TBD';
  if (vals.size > 1) return '';
  return [...vals][0];
}

async function saveDraw(){
  S.drawBusy = true; S.drawMsg = ''; render();
  const res = await api.saveDraw(S.ageId, S.draw, S.session);
  S.drawBusy = false;
  S.drawMsg = res.ok ? 'Saved as a draft. Use Publish to make it public.' : (res.error || 'Could not save.');
  render();
  if (res.ok) await loadDraw(S.ageId);
}
async function discardDraw(){
  if (!confirm('Discard unsaved changes to this draw? This reloads the last saved version.')) return;
  await loadDraw(S.ageId);
}
async function resetDraw(){
  if (!confirm('Regenerate match times and the knockout bracket from the current teams and pools? Your teams and pool assignments are kept — only match pairings, times, and the bracket are rebuilt.')) return;
  S.drawBusy = true; render();
  const freshSlots = S.draw.pools.flatMap((p) => api.regeneratePoolSlots(S.ageId, p.id, p.teams));
  const freshKnockout = await api.autoKnockoutSlots(S.ageId, S.session);
  S.draw = { ...S.draw, slots: freshSlots, knockout: freshKnockout };
  const res = await api.saveDraw(S.ageId, S.draw, S.session);
  S.drawBusy = false;
  S.drawMsg = res.ok ? 'Match times and bracket regenerated — your teams were kept.' : (res.error || 'Could not save.');
  render();
  if (res.ok) await loadDraw(S.ageId);
}
```

- [ ] **Step 4: Extend `viewDraw()`'s slot rendering (tappable Home/Away boxes, time input, pitch select) and add the Save/Discard/Reset row**

Replace each pool's `slotRows`-building line inside `viewDraw()` with:

```js
    const pitchOpts = Array.from(new Set(['TBD', ...api.pitchesForAgeGroup(S.ageId)]));
    const slotRows = slots.map((sl) => {
      const homePicked = S.picked && S.picked.from.kind === 'slot' && S.picked.from.slotId === sl.id && S.picked.from.side === 'home';
      const awayPicked = S.picked && S.picked.from.kind === 'slot' && S.picked.from.slotId === sl.id && S.picked.from.side === 'away';
      const opts = Array.from(new Set([...pitchOpts, sl.pitch])).filter(Boolean);
      return `<div class="slotrow">
        <input type="time" value="${esc(api.minutesToTimeInput(sl.startMins))}" data-slot-time="${esc(sl.id)}" style="width:110px;flex:none">
        <div class="slotbox${sl.home?'':' empty'}${homePicked?' picked':''}" data-slot-box="${esc(sl.id)}" data-slot-side="home" data-slot-team="${esc(sl.home||'')}">${sl.home?esc(tName(sl.home)):'Drop team here'}</div>
        <span class="muted" style="flex:none">v</span>
        <div class="slotbox${sl.away?'':' empty'}${awayPicked?' picked':''}" data-slot-box="${esc(sl.id)}" data-slot-side="away" data-slot-team="${esc(sl.away||'')}">${sl.away?esc(tName(sl.away)):'Drop team here'}</div>
        <select data-slot-pitch="${esc(sl.id)}" style="width:84px;flex:none">${opts.map((o)=>`<option value="${esc(o)}" ${o===(sl.pitch||'TBD')?'selected':''}>${esc(o)}</option>`).join('')}</select>
        <button class="btn-o" style="width:auto;padding:8px 10px;font-size:12px;color:#a3271b" data-slot-remove="${esc(sl.id)}">&times;</button>
      </div>`;
    }).join('');
```

and change the pool card's return template to render `slotRows` inside a `<div style="padding:0 14px 14px">` block, plus "+ Add match slot" / "Regenerate from pool" buttons:

```js
      <div class="card"><div style="padding:12px 14px">
        <div class="dropzone" data-drop-pool="${esc(p.id)}">${teamChips || '<span class="muted" style="font-size:13px">No teams yet</span>'}</div>
        <div class="field" style="display:flex;gap:8px;margin-top:10px">
          <input id="newteam-${esc(p.id)}" placeholder="New team name" style="flex:1">
          <button class="btn-o" style="width:auto;padding:12px 16px" data-add-team="${esc(p.id)}">+ Add</button>
        </div>
        <div style="margin-top:14px">${slotRows}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-o" style="width:auto;padding:10px 14px;font-size:12px" data-add-slot="${esc(p.id)}">+ Add match slot</button>
          <button class="btn-o" style="width:auto;padding:10px 14px;font-size:12px" data-regen-pool="${esc(p.id)}">Regenerate from pool</button>
        </div>
      </div></div>`;
```

Append a Save/Discard/Reset card at the end of `viewDraw()`'s return, before the final knockout section (this block stays present even before Task 5 adds the knockout editor):

```js
  const saveBar = `<div class="card" style="padding:16px;margin-top:16px">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-g" id="drawSaveBtn" style="width:auto;padding:14px 22px" ${S.drawBusy?'disabled':''}>Save changes</button>
      <button class="btn btn-o" id="drawDiscardBtn" style="width:auto;padding:13px 20px" ${S.drawBusy?'disabled':''}>Discard changes</button>
      <button class="btn btn-o" id="drawResetBtn" style="width:auto;padding:13px 20px;color:#a3271b" ${S.drawBusy?'disabled':''}>Regenerate times &amp; bracket</button>
    </div>
    ${S.drawMsg ? `<p style="margin-top:10px;font-size:13px;color:var(--green-deep);font-weight:600">${esc(S.drawMsg)}</p>` : ''}
  </div>`;
```

and include `saveBar` in the final return expression.

Extend `wireDraw()` with the new handlers:

```js
  document.querySelectorAll('[data-slot-time]').forEach((el) => { el.onchange = () => onSlotTimeChange(el.dataset.slotTime, el.value); });
  document.querySelectorAll('[data-slot-pitch]').forEach((el) => { el.onchange = () => onSlotPitchChange(el.dataset.slotPitch, el.value); });
  document.querySelectorAll('[data-slot-remove]').forEach((el) => { el.onclick = () => removeSlot(el.dataset.slotRemove); });
  document.querySelectorAll('[data-add-slot]').forEach((el) => { el.onclick = () => addSlot(el.dataset.addSlot); });
  document.querySelectorAll('[data-regen-pool]').forEach((el) => { el.onclick = () => regeneratePool(el.dataset.regenPool); });
  document.querySelectorAll('[data-slot-box]').forEach((el) => {
    el.onclick = () => {
      const slotId = el.dataset.slotBox, side = el.dataset.slotSide, team = el.dataset.slotTeam;
      if (team && !S.picked) { pickTeam(team, { kind: 'slot', slotId, side }); return; }
      if (S.picked) { placeTeam({ kind: 'slot', slotId, side }); return; }
    };
  });
  const saveBtn = document.getElementById('drawSaveBtn'); if (saveBtn) saveBtn.onclick = saveDraw;
  const discardBtn = document.getElementById('drawDiscardBtn'); if (discardBtn) discardBtn.onclick = discardDraw;
  const resetBtn = document.getElementById('drawResetBtn'); if (resetBtn) resetBtn.onclick = resetDraw;
```

- [ ] **Step 5: Run the test file, confirm it passes**

Run: `node tests/test-manager-dashboard.js` — expect PASS.

- [ ] **Step 6: Fault-injection proof on the time-rejection check**

Temporarily remove the `if (mins == null || isNaN(mins)) return;` guard in `onSlotTimeChange`, run the test, confirm the "unparseable time is rejected" check now FAILS (stores `NaN`), then restore the guard.

- [ ] **Step 7: Run the full existing suite. Expect all pass.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add match slot editor (tap-assign, time/pitch, add/regenerate) and save/discard/reset to the Draw tab"
```

---

### Task 4: Import registered teams

**Files:**
- Modify: `Manager.html` — add import panel to `viewDraw()`, add import logic functions
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `S.regs` (Task 8's registrations cache — import needs `S.regs.teams`; if not yet loaded, `openImport()` calls `loadRegistrations()` first, same lazy-load-once pattern as the reference's `onOpenImport` at `Scores & Standings.dc.html:2492-2496`). Consumes `S.fixtures` to compute `importHasResults()` (blocks "replace" mode once any result exists — ported from `Scores & Standings.dc.html:2486-2489`).
- Produces: `openImport()`, `importSourceTeams()` (filters `S.regs.teams` down to this age group by name match, ported from `Scores & Standings.dc.html:2425-2431`), `teamNamesFromRegistrations()` (ported from `Scores & Standings.dc.html:2441-2458`, produces the `draw.teamNames` map `saveDraw()`'s allow-list needs), `buildImportRows(mode)`, `setImportMode(mode)`, `setImportRowPool(code, poolId)`, `confirmImport()`, `cancelImport()`. `confirmImport()` writes into `S.draw.pools`/`S.draw.slots`/`S.draw.teamNames` exactly like Task 2/3's other local-draft edits — nothing is saved to the server until the existing `saveDraw()` (Task 3) runs.

- [ ] **Step 1: Write the failing tests**

```js
  section('Draw tab (Task 4: import registered teams)');
  {
    const regTeams = [
      { club: 'Abu Dhabi Harlequins', teamName: 'ADH2', ageGroup: 'U14B Contact', preferredPool: 'B' },
      { club: 'Dubai Exiles', teamName: 'DE2', ageGroup: 'U14B Contact', preferredPool: '' },
      { club: 'Someone Else', teamName: 'XX1', ageGroup: 'U16 Boys', preferredPool: '' }, // wrong age group, must be excluded
    ];
    const { win } = await loadWithApi({
      getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }),
      getAgeGroups: async () => [
        { id: 'u14b', name: 'U14B Contact', hasStandings: true },
        { id: 'u16b', name: 'U16 Boys', hasStandings: true },
      ],
      currentSession: () => ({ ageGroupId: 'u14b', token: 't' }),
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.openImport();
    const src = win.__test.importSourceTeams();
    check('import source is scoped to this age group only', src.length === 2 && src.every((r) => r.ageGroup === 'U14B Contact'));

    win.__test.buildImportRows('add');
    check('import rows are built for both matching teams', win.__test.S.importRows.length === 2);

    win.__test.confirmImport();
    const poolA = win.__test.S.draw.pools.find((p) => p.id === 'A');
    const allTeams = win.__test.S.draw.pools.flatMap((p) => p.teams);
    check('ADH2 was imported into a pool', allTeams.includes('ADH2'));
    check('DE2 was imported into a pool', allTeams.includes('DE2'));
    // Fault-proof: a team from a DIFFERENT age group must never be importable.
    check('XX1 (wrong age group) was never imported', !allTeams.includes('XX1'));
  }
  {
    // Fault-proof: "replace" must be blocked once a result exists.
    const { win } = await loadWithApi({
      getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14B Contact', preferredPool: '' }], players: [], scope: 'all' }),
      getFixtures: async (agId) => ({ awaitingPublication: false,
        pool: [{ id: `${agId}:A:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 10, awayScore: 5 } }],
        knockout: [] }),
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.openImport();
    check('replace mode is blocked once results exist', win.__test.importHasResults() === true);
  }
```

- [ ] **Step 2: Run and confirm failure** — expect `openImport is not a function`.

- [ ] **Step 3: Implement in `Manager.html`**

```js
function importHasResults(){
  const f = S.fixtures; if (!f) return false;
  return [...(f.pool||[]), ...(f.knockout||[])].some((m) => m.result && m.result.homeScore != null);
}
function importSourceTeams(){
  const meta = S.ageGroups.find((a) => a.id === S.ageId);
  const nm = ((meta && meta.name) || '').trim().toLowerCase();
  if (!nm) return [];
  return (S.regs && S.regs.teams || []).filter((r) => String(r.ageGroup||'').trim().toLowerCase() === nm);
}
function teamNamesFromRegistrations(){
  const src = importSourceTeams();
  const perClub = {};
  src.forEach((r) => { const c = String(r.club||'').trim(); perClub[c] = (perClub[c]||0)+1; });
  const out = {};
  src.forEach((r) => {
    const code = String(r.teamName||'').trim();
    const rawClub = String(r.club||'').trim();
    const club = rawClub.replace(/\b(RFC|Rugby Football Club|Rugby Club)\b/gi, '').replace(/\s+/g,' ').trim();
    if (!code || !club) return;
    const n = (code.match(/(\d+)$/) || [])[1];
    out[code] = (perClub[rawClub] > 1 && n) ? (club + ' ' + n) : club;
  });
  return out;
}
async function openImport(){
  if (S.regs === undefined) await loadRegistrations();
  buildImportRows(S.importMode || 'add');
  S.importOpen = true;
  render();
}
function buildImportRows(mode){
  const draw = S.draw;
  if (!draw) return;
  const pools = draw.pools || [];
  const poolIds = pools.map((p) => p.id);
  if (!poolIds.length) { S.importRows = []; S.importMode = mode; S.importNote = 'Add a pool first, then import.'; return; }
  const existing = new Set();
  pools.forEach((p) => (p.teams||[]).forEach((t) => existing.add(t)));
  const src = importSourceTeams();
  const load = {}; poolIds.forEach((id) => { load[id] = 0; });
  if (mode === 'add') pools.forEach((p) => { load[p.id] = (p.teams||[]).length; });
  const prefOf = (r) => { const m = String(r.preferredPool||'').match(/[A-D]/i); const id = m ? m[0].toUpperCase() : ''; return poolIds.indexOf(id) >= 0 ? id : ''; };
  const smallest = () => poolIds.slice().sort((a,b) => load[a]-load[b] || poolIds.indexOf(a)-poolIds.indexOf(b))[0];
  const rows = [];
  src.forEach((r) => {
    const code = String(r.teamName||'').trim();
    if (!code) return;
    const inDraw = existing.has(code);
    if (mode === 'add' && inDraw) { rows.push({ code, club: String(r.club||''), pref: r.preferredPool||'', poolId: '', skip: true }); return; }
    const want = prefOf(r);
    const asked = String(r.preferredPool||'').match(/[A-D]/i);
    const unavailable = !!(asked && !want);
    let poolId = want || smallest();
    let moved = false;
    if (want && load[want] - load[smallest()] >= 2) { poolId = smallest(); moved = true; }
    load[poolId] += 1;
    rows.push({ code, club: String(r.club||''), pref: r.preferredPool||'', poolId, flag: inDraw?'in':'new', moved, unavailable, skip: false });
  });
  const nameByCode = teamNamesFromRegistrations();
  rows.forEach((row) => { row.name = nameByCode[row.code] || ''; });
  S.importRows = rows; S.importMode = mode;
  const movedCount = rows.filter((r) => r.moved).length;
  const unavailCount = rows.filter((r) => r.unavailable).length;
  const notes = [];
  if (movedCount) notes.push(movedCount + ' team' + (movedCount===1?' was':'s were') + ' moved off their preferred pool to keep the pools even.');
  if (unavailCount) notes.push(unavailCount + ' team' + (unavailCount===1?'':'s') + ' asked for a pool this draw does not have, placed in the smallest pool.');
  S.importNote = notes.join(' ');
  render();
}
function setImportMode(mode){
  if (mode === 'replace' && importHasResults()) return;
  buildImportRows(mode);
}
function setImportRowPool(code, poolId){
  S.importRows = (S.importRows||[]).map((r) => (r.code === code ? { ...r, poolId, moved: false } : r));
  render();
}
function confirmImport(){
  const draw = S.draw; if (!draw) return;
  const mode = S.importMode || 'add';
  const rows = (S.importRows||[]).filter((r) => !r.skip && r.poolId);
  const claimed = new Set();
  if (mode !== 'replace') (draw.pools||[]).forEach((p) => (p.teams||[]).forEach((t) => claimed.add(t)));
  const dupCodes = []; const usableRows = [];
  rows.forEach((r) => { if (claimed.has(r.code)) { dupCodes.push(r.code); return; } claimed.add(r.code); usableRows.push(r); });
  const names = { ...(draw.teamNames||{}) };
  usableRows.forEach((r) => { if (r.name) names[r.code] = r.name; });
  const pools = (draw.pools||[]).map((p) => {
    const teams = mode === 'replace' ? [] : [...(p.teams||[])];
    usableRows.forEach((r) => { if (r.poolId === p.id && teams.indexOf(r.code) < 0) teams.push(r.code); });
    return { ...p, teams };
  });
  let slots = draw.slots || [];
  if (mode === 'replace') slots = pools.reduce((acc, p) => acc.concat(api.regeneratePoolSlots(S.ageId, p.id, p.teams||[])), []);
  S.draw = { ...draw, pools, teamNames: names, slots };
  S.importOpen = false;
  S.drawMsg = 'Imported ' + usableRows.length + ' team' + (usableRows.length===1?'':'s') + ' into the editor.'
    + (mode === 'replace' ? ' Pool matches rebuilt to match the new rosters.' : ' Press "Regenerate from pool" on any pool you changed to rebuild its matches.')
    + (dupCodes.length ? ' SKIPPED ' + dupCodes.length + ' duplicate team code(s) (' + dupCodes.join(', ') + ').' : '')
    + ' Nothing is saved until you press Save changes.';
  render();
}
function cancelImport(){ S.importOpen = false; render(); }
```

Note `saveDraw()` (Task 3) must include `teamNames` in what it sends — the existing `api.saveDraw(agId, draw, session)` already reads `draw.teamNames || {}` off whatever object you pass it (`scores-data.js:1592`), so no change to `saveDraw()` itself is needed as long as `S.draw.teamNames` is set by `confirmImport()`, which it is above.

- [ ] **Step 4: Add the import panel to `viewDraw()`**

Add near the top of `viewDraw()`'s pools section (before the pool cards), a small panel:

```js
  const importPanel = `<div class="card" style="padding:16px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted)">Registered teams</div>
        <div style="font-size:13px;margin-top:4px">${esc(importSourceTeams().length)} registered for ${esc(ageName(S.ageId))}</div></div>
      <button class="btn-o" style="width:auto;padding:10px 14px;font-size:12px" id="openImportBtn">Review &amp; import</button>
    </div>
    ${S.importOpen ? `<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn-o" style="width:auto;padding:9px 14px;font-size:12px" id="importModeAdd">Add the missing ones</button>
        <button class="btn-o" style="width:auto;padding:9px 14px;font-size:12px" id="importModeReplace" ${importHasResults()?'disabled':''}>Replace the pools</button>
      </div>
      ${importHasResults() ? `<div class="err">Replace is unavailable: this age group already has results.</div>` : ''}
      ${S.importNote ? `<div class="err" style="background:var(--warn-bg);color:var(--warn)">${esc(S.importNote)}</div>` : ''}
      ${(S.importRows||[]).length ? (S.importRows||[]).map((r) => `<div class="mrow" style="grid-template-columns:1fr auto">
          <div><b>${esc(r.name||r.code)}</b><div class="muted" style="font-size:12px">${esc(r.code)} ${r.skip?'&middot; already in draw':''}</div></div>
          <select data-import-pool="${esc(r.code)}" ${r.skip?'disabled':''}>${(S.draw.pools||[]).map((p)=>`<option value="${esc(p.id)}" ${p.id===r.poolId?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
        </div>`).join('') : '<div class="empty">Nothing to import for this age group yet.</div>'}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-p" style="width:auto;padding:12px 18px" id="confirmImportBtn">Import ${((S.importRows||[]).filter(r=>!r.skip)).length} team(s)</button>
        <button class="btn btn-o" style="width:auto;padding:11px 16px" id="cancelImportBtn">Cancel</button>
      </div>
    </div>` : ''}
  </div>`;
```

Include `importPanel` in `viewDraw()`'s return (right after `head`, before `pools`).

Extend `wireDraw()`:

```js
  const openImportBtn = document.getElementById('openImportBtn'); if (openImportBtn) openImportBtn.onclick = openImport;
  const importModeAdd = document.getElementById('importModeAdd'); if (importModeAdd) importModeAdd.onclick = () => setImportMode('add');
  const importModeReplace = document.getElementById('importModeReplace'); if (importModeReplace) importModeReplace.onclick = () => setImportMode('replace');
  document.querySelectorAll('[data-import-pool]').forEach((el) => { el.onchange = () => setImportRowPool(el.dataset.importPool, el.value); });
  const confirmImportBtn = document.getElementById('confirmImportBtn'); if (confirmImportBtn) confirmImportBtn.onclick = confirmImport;
  const cancelImportBtn = document.getElementById('cancelImportBtn'); if (cancelImportBtn) cancelImportBtn.onclick = cancelImport;
```

Expose the new functions on `window.__test` in the test harness's appended block: add `openImport, importSourceTeams, importHasResults, buildImportRows, confirmImport` to the list.

- [ ] **Step 5: Run the test file, confirm it passes.**

- [ ] **Step 6: Fault-injection proof**

Temporarily change `importSourceTeams()`'s filter to compare on `r.club` instead of `r.ageGroup` (so it stops scoping by age group), run the test, confirm "XX1 (wrong age group) was never imported" now FAILS, then restore the real filter.

- [ ] **Step 7: Run the full existing suite. Expect all pass.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add import-registered-teams panel to the Draw tab"
```

---

### Task 5: Knockout builder (tap-assign + generate/clear/generate finals)

**Files:**
- Modify: `Manager.html` — add knockout section to `viewDraw()`, add knockout CRUD functions
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `placeTeam()`/`pickTeam()` (Task 2) with `kind:'knockout'`. Consumes `api.autoKnockoutSlots(agId, session)` → `Promise<Array<{id,round,home,away,startMins,pitch}>>` (`scores-data.js:1558`) for both "Generate knockout from standings" and "Generate finals from knockout" (the finals variant filters the result to slot ids matching `/:(CUP|BOWL|PLATE|SHIELD|FINAL)$/i`, exactly as the reference does at `Scores & Standings.dc.html:1690-1704`). Consumes `S.fixtures.pool` to compute the "every pool match played" gate that enables "Generate knockout from standings" (ported from `Scores & Standings.dc.html:3448`).
- Produces: `addKnockoutSlot()`, `removeKnockoutSlot(slotId)`, `renameKnockoutRound(slotId)`, `onKnockoutTimeChange(slotId, hhmm)`, `onKnockoutPitchChange(slotId, val)`, `regenerateKnockout()` (async), `generateFinals()` (async), `clearKnockout()`. None of these call `api.clearResult` on the corresponding match results — the spec for this port keeps to "the same tap-assign adaptation applies here too" and the four listed buttons (generate/generate finals/clear/add-and-edit slots); ported knockout mutation clears local draft state only, exactly mirroring what Task 3's slot editing already does (results are cleared separately by a manager using the existing "Clear result" button on the Fixtures & scoring tab's score sheet, which already exists from the first Manager Dashboard build).

- [ ] **Step 1: Write the failing tests**

```js
  section('Draw tab (Task 5: knockout builder)');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const before = (win.__test.S.draw.knockout||[]).length;
    win.__test.addKnockoutSlot();
    check('addKnockoutSlot adds one slot', win.__test.S.draw.knockout.length === before + 1);
    const added = win.__test.S.draw.knockout[win.__test.S.draw.knockout.length - 1];
    check('the new knockout slot starts empty', !added.home && !added.away);
    win.__test.removeKnockoutSlot(added.id);
    check('removeKnockoutSlot removes it', win.__test.S.draw.knockout.length === before);
  }
  {
    // Tap-assign a team into a knockout slot from a pool.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addKnockoutSlot();
    const koId = win.__test.S.draw.knockout[win.__test.S.draw.knockout.length - 1].id;
    win.__test.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    win.__test.placeTeam({ kind: 'knockout', slotId: koId, side: 'home' });
    const ko = win.__test.S.draw.knockout.find((k) => k.id === koId);
    check('team placed in knockout slot home side', ko.home === 'ADH1');
    check('team removed from the pool it came from', !win.__test.S.draw.pools.find((p)=>p.id==='A').teams.includes('ADH1'));
  }
  {
    let autoCalls = 0;
    const { win } = await loadWithApi({
      autoKnockoutSlots: async () => { autoCalls++; return [{ id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DT1', startMins: 600, pitch: 'TBD' }]; },
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.regenerateKnockout();
    check('regenerateKnockout calls the auto-seed API', autoCalls === 1);
    check('the knockout list is replaced with the auto-seeded result', win.__test.S.draw.knockout.length === 1 && win.__test.S.draw.knockout[0].id === 'u14b:CUP');
  }
  {
    win_clear_test: {
      const { win } = await loadWithApi();
      await win.__test.boot();
      win.__test.go('draw');
      await new Promise((r) => setTimeout(r, 0));
      win.__test.addKnockoutSlot();
      win.__test.clearKnockout();
      check('clearKnockout empties the knockout list', win.__test.S.draw.knockout.length === 0);
    }
  }
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement in `Manager.html`**

```js
function addKnockoutSlot(){
  const list = S.draw.knockout || [];
  const lastMins = list.length ? Math.max(...list.map((sl) => sl.startMins)) : 8*60;
  S.draw.knockout = [...list, { id: `${S.ageId}:knockout:new${Date.now()}`, round: 'New knockout match', home: '', away: '', startMins: lastMins + 20, pitch: 'TBD' }];
  render();
}
function removeKnockoutSlot(slotId){
  S.draw.knockout = (S.draw.knockout||[]).filter((sl) => sl.id !== slotId);
  render();
}
function renameKnockoutRound(slotId){
  const sl = S.draw.knockout.find((x) => x.id === slotId); if (!sl) return;
  const next = prompt('Rename this knockout match label', sl.round);
  if (next == null || !next.trim() || next.trim() === sl.round) return;
  sl.round = next.trim();
  render();
}
function onKnockoutTimeChange(slotId, hhmm){
  const mins = api.timeToMinutes(hhmm);
  if (mins == null || isNaN(mins)) return;
  const sl = S.draw.knockout.find((x) => x.id === slotId);
  if (sl) sl.startMins = mins;
  render();
}
function onKnockoutPitchChange(slotId, val){
  const sl = S.draw.knockout.find((x) => x.id === slotId);
  if (sl) sl.pitch = val;
  render();
}
async function regenerateKnockout(){
  if (!confirm('Replace the knockout stage with the current auto-seeded bracket from live standings? This discards any manual knockout edits.')) return;
  const fresh = await api.autoKnockoutSlots(S.ageId, S.session);
  S.draw.knockout = fresh;
  render();
}
async function generateFinals(){
  if (!confirm('Fill the finals from the current knockout results? This updates only the final matches (Cup, Bowl, Plate, Shield or Final) from the winners so far.')) return;
  const fresh = await api.autoKnockoutSlots(S.ageId, S.session);
  const isFinal = (id) => /:(CUP|BOWL|PLATE|SHIELD|FINAL)$/i.test(id||'');
  const cur = S.draw.knockout || [];
  const freshFinals = fresh.filter((f) => isFinal(f.id));
  const byId = {}; freshFinals.forEach((f) => { byId[f.id] = f; });
  const haveIds = new Set(cur.map((sl) => sl.id));
  const updated = cur.map((sl) => (isFinal(sl.id) && byId[sl.id]) ? { ...sl, home: byId[sl.id].home, away: byId[sl.id].away } : sl);
  freshFinals.forEach((f) => { if (!haveIds.has(f.id)) updated.push(f); });
  S.draw.knockout = updated;
  render();
}
function clearKnockout(){
  if (!confirm('Clear all knockout matches for this age group? You can generate them again from the standings afterwards. (Remember to Save changes.)')) return;
  S.draw.knockout = [];
  render();
}
```

- [ ] **Step 4: Add the knockout section markup and wire it**

Replace `viewDraw()`'s final knockout block with a full editor:

```js
  const koPitchOpts = Array.from(new Set(['TBD', ...api.pitchesForAgeGroup(S.ageId)]));
  const koRows = (S.draw.knockout||[]).slice().sort((a,b)=>a.startMins-b.startMins).map((sl) => {
    const homePicked = S.picked && S.picked.from.kind === 'knockout' && S.picked.from.slotId === sl.id && S.picked.from.side === 'home';
    const awayPicked = S.picked && S.picked.from.kind === 'knockout' && S.picked.from.slotId === sl.id && S.picked.from.side === 'away';
    const opts = Array.from(new Set([...koPitchOpts, sl.pitch])).filter(Boolean);
    return `<div class="slotrow">
      <span class="muted" style="font-size:11.5px;width:120px;flex:none;overflow-wrap:break-word">${esc(sl.round)} <button data-ko-rename="${esc(sl.id)}" aria-label="Rename">&#9998;</button></span>
      <input type="time" value="${esc(api.minutesToTimeInput(sl.startMins))}" data-ko-time="${esc(sl.id)}" style="width:100px;flex:none">
      <div class="slotbox${sl.home?'':' empty'}${homePicked?' picked':''}" data-ko-box="${esc(sl.id)}" data-ko-side="home" data-ko-team="${esc(sl.home||'')}">${sl.home?esc(tName(sl.home)):'Drop team here'}</div>
      <span class="muted" style="flex:none">v</span>
      <div class="slotbox${sl.away?'':' empty'}${awayPicked?' picked':''}" data-ko-box="${esc(sl.id)}" data-ko-side="away" data-ko-team="${esc(sl.away||'')}">${sl.away?esc(tName(sl.away)):'Drop team here'}</div>
      <select data-ko-pitch="${esc(sl.id)}" style="width:84px;flex:none">${opts.map((o)=>`<option value="${esc(o)}" ${o===(sl.pitch||'TBD')?'selected':''}>${esc(o)}</option>`).join('')}</select>
      <button class="btn-o" style="width:auto;padding:8px 10px;font-size:12px;color:#a3271b" data-ko-remove="${esc(sl.id)}">&times;</button>
    </div>`;
  }).join('');
  const poolsAllPlayed = !!(S.fixtures && S.fixtures.pool && S.fixtures.pool.length > 0 && S.fixtures.pool.every((fx) => fx.result && fx.result.homeScore != null));
  const knockoutSection = `<div class="sec-t">Knockout stage</div><div class="card" style="padding:16px">
    ${koRows || '<div class="empty" style="padding:14px 0">No knockout matches yet.</div>'}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn-o" style="width:auto;padding:9px 14px;font-size:12px" id="addKoBtn">+ Add knockout match</button>
      <button class="btn-o" style="width:auto;padding:9px 14px;font-size:12px" id="regenKoBtn" ${poolsAllPlayed?'':'disabled'}>Generate knockout from standings</button>
      <button class="btn-o" style="width:auto;padding:9px 14px;font-size:12px" id="genFinalsBtn">Generate finals from knockout</button>
      <button class="btn-o" style="width:auto;padding:9px 14px;font-size:12px;color:#a3271b" id="clearKoBtn">Clear knockout</button>
    </div>
    ${!poolsAllPlayed ? `<p class="muted" style="font-size:12px;margin-top:8px">Enter every pool score first — then you can generate the knockout from the final standings.</p>` : ''}
  </div>`;
```

Replace the final `(ko.length ? ... : '')` expression in `viewDraw()`'s return with `knockoutSection` (the read-only Task 1 knockout block is now fully superseded by this editor).

Extend `wireDraw()`:

```js
  document.querySelectorAll('[data-ko-time]').forEach((el) => { el.onchange = () => onKnockoutTimeChange(el.dataset.koTime, el.value); });
  document.querySelectorAll('[data-ko-pitch]').forEach((el) => { el.onchange = () => onKnockoutPitchChange(el.dataset.koPitch, el.value); });
  document.querySelectorAll('[data-ko-remove]').forEach((el) => { el.onclick = () => removeKnockoutSlot(el.dataset.koRemove); });
  document.querySelectorAll('[data-ko-rename]').forEach((el) => { el.onclick = () => renameKnockoutRound(el.dataset.koRename); });
  document.querySelectorAll('[data-ko-box]').forEach((el) => {
    el.onclick = () => {
      const slotId = el.dataset.koBox, side = el.dataset.koSide, team = el.dataset.koTeam;
      if (team && !S.picked) { pickTeam(team, { kind: 'knockout', slotId, side }); return; }
      if (S.picked) { placeTeam({ kind: 'knockout', slotId, side }); return; }
    };
  });
  const addKoBtn = document.getElementById('addKoBtn'); if (addKoBtn) addKoBtn.onclick = addKnockoutSlot;
  const regenKoBtn = document.getElementById('regenKoBtn'); if (regenKoBtn && !regenKoBtn.disabled) regenKoBtn.onclick = regenerateKnockout;
  const genFinalsBtn = document.getElementById('genFinalsBtn'); if (genFinalsBtn) genFinalsBtn.onclick = generateFinals;
  const clearKoBtn = document.getElementById('clearKoBtn'); if (clearKoBtn) clearKoBtn.onclick = clearKnockout;
```

Also add the new function names to `window.__test`'s exposed list in the test harness.

- [ ] **Step 5: Run the test file, confirm it passes.**

- [ ] **Step 6: Fault-injection proof**

Temporarily change `regenerateKnockout()` to not reassign `S.draw.knockout` (leave it as-is after calling the API), run the test, confirm "the knockout list is replaced with the auto-seeded result" FAILS, then restore.

- [ ] **Step 7: Run the full existing suite. Expect all pass.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add tap-assign knockout builder to the Draw tab"
```

---

### Task 6: Publish / Unpublish with match-day gating

**Files:**
- Modify: `Manager.html` — add publish panel to `viewDraw()`, add publish/unpublish functions
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `S.draw._publish` → `{published, publishedAt, publishedBy, managerCanPublishNow}` (set by `loadDraw()` in Task 1, straight off `getDraw()`'s return). Consumes `api.canPublishNow(session, publishState)` → `boolean` (`scores-data.js:1635`) — **this is the single gating check**; the UI must never independently compute "is it 7-8 Nov" itself. Consumes `api.publishDraw(agId, session)` → `Promise<{ok, published?, publishedAt?, error?}>` (`scores-data.js:1611`) and `api.unpublishDraw(agId, session)` → `Promise<{ok, published?, error?}>` (`scores-data.js:1622`).
- Produces: `doPublish()` (async, confirms, calls `api.publishDraw`, reloads draw), `doUnpublish()` (async, confirms, calls `api.unpublishDraw`, reloads draw). Both re-render via `loadDraw(S.ageId)` afterward so `_publish.published` reflects the server's new state, not an optimistic guess.

- [ ] **Step 1: Write the failing tests**

```js
  section('Draw tab (Task 6: publish / unpublish gating)');
  {
    // Manager, outside the tournament window: canPublishNow() returns false,
    // so the button must be REPLACED with explanatory text, never shown disabled.
    const { win } = await loadWithApi({ canPublishNow: () => false });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const html = win.__test.viewDraw();
    check('cannot-publish text shown when canPublishNow() is false', html.includes('Ask a tournament organiser') || html.includes('tournament days'));
    check('no Publish button rendered when canPublishNow() is false', !html.includes('id="doPublishBtn"'));
  }
  {
    let publishCalls = 0;
    const { win } = await loadWithApi({ canPublishNow: () => true, publishDraw: async () => { publishCalls++; return { ok: true, published: true }; } });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.doPublish();
    check('Publish calls api.publishDraw exactly once', publishCalls === 1);
  }
  {
    let unpublishCalls = 0;
    const { win } = await loadWithApi({
      canPublishNow: () => true,
      getDraw: async () => ({ pools: [{id:'A',name:'Pool A',teams:['ADH1']}], slots: [], knockout: [],
        pitches: [], _publish: { published: true, publishedAt: '2026-11-07T09:00:00Z', publishedBy: 'x', managerCanPublishNow: true } }),
      unpublishDraw: async () => { unpublishCalls++; return { ok: true, published: false }; },
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    const html = win.__test.viewDraw();
    check('Unpublish button only shows when already published', html.includes('id="doUnpublishBtn"'));
    await win.__test.doUnpublish();
    check('Unpublish calls api.unpublishDraw exactly once', unpublishCalls === 1);
  }
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement in `Manager.html`**

```js
async function doPublish(){
  const ask = 'Publish these fixtures for ' + ageName(S.ageId) + '? Parents and coaches will see them on the public fixtures and standings pages straight away.';
  if (!confirm(ask)) return;
  S.drawBusy = true; S.drawMsg = ''; render();
  const res = await api.publishDraw(S.ageId, S.session);
  S.drawBusy = false;
  S.drawMsg = res.ok ? 'Published — these fixtures are now public.' : (res.error || 'Could not publish.');
  render();
  if (res.ok) await loadDraw(S.ageId);
}
async function doUnpublish(){
  if (!confirm('Take these fixtures back down? Anyone who has already seen them will find the fixtures replaced by "coming soon" until you publish again. Your draft is kept.')) return;
  S.drawBusy = true; S.drawMsg = ''; render();
  const res = await api.unpublishDraw(S.ageId, S.session);
  S.drawBusy = false;
  S.drawMsg = res.ok ? 'Unpublished — the public now sees "coming soon".' : (res.error || 'Could not unpublish.');
  render();
  if (res.ok) await loadDraw(S.ageId);
}
```

- [ ] **Step 4: Add the publish panel to `viewDraw()` and wire it**

```js
  const pubState = (S.draw && S.draw._publish) || {};
  const canPub = api.canPublishNow(S.session, pubState);
  const publishPanel = `<div class="card" style="padding:16px;margin-top:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-family:Anton;font-size:16px;text-transform:uppercase">Publishing</span>
      <span class="pill ${pubState.published?'pill-live':'pill-off'}">${pubState.published?'Live':'Not published'}</span>
    </div>
    ${canPub ? `<div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-p" style="width:auto;padding:14px 22px" id="doPublishBtn">${pubState.published?'Republish':'Publish fixtures'}</button>
        ${pubState.published ? `<button class="btn btn-o" style="width:auto;padding:13px 20px;color:#a3271b" id="doUnpublishBtn">Unpublish</button>` : ''}
      </div>`
      : `<p style="font-size:13px;color:var(--warn);font-weight:600">Managers can publish on the tournament days only (7&ndash;8 November 2026). Ask a tournament organiser to publish before then.</p>`}
  </div>`;
```

Include `publishPanel` in `viewDraw()`'s return (after the knockout section). Extend `wireDraw()`:

```js
  const doPublishBtn = document.getElementById('doPublishBtn'); if (doPublishBtn) doPublishBtn.onclick = doPublish;
  const doUnpublishBtn = document.getElementById('doUnpublishBtn'); if (doUnpublishBtn) doUnpublishBtn.onclick = doUnpublish;
```

Add `doPublish, doUnpublish` to the test harness's exposed `window.__test` list.

- [ ] **Step 5: Run the test file, confirm it passes.**

- [ ] **Step 6: Fault-injection proof**

Temporarily change the publish panel's condition from `canPub ? ... : ...` to always render the Publish button (delete the `canPub` gate), run the test, confirm "no Publish button rendered when canPublishNow() is false" now FAILS, then restore the gate.

- [ ] **Step 7: Run the full existing suite. Expect all pass.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add publish/unpublish panel with match-day gating to the Draw tab"
```

---

### Task 7: Clash checker

**Files:**
- Modify: `Manager.html` — add clash-check panel to `viewDraw()`, add `checkWeekend()`
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `api.loadAllDraws(session)` → `Promise<{drawsByAge, ageNames, failed}>` (`scores-data.js:1023`). Consumes `api.weekendClashes(drawsByAge, ageNames)` → `{bookings, clashes, unplaced, offAllocation, placedCount}` (`scores-data.js:957`) — each `clash` entry is `{dayId, dayLabel, pitch, sameAgeGroup, a: booking, b: booking}` where a `booking` is `{agId, agName, dayId, pitch, label, startMins, endMins, count}`. Consumes `api.describeClash(c)` → plain-English one-line string, e.g. `"Pitch C4 · Sunday — U13 Pool A (08:00 – 10:00) overlaps U16B Pool B (09:20 – 11:00)"` (`scores-data.js:1008`) — **this string already contains only pitch/time/age-group-name/label, never scores or contacts**, satisfying the spec's "shows pitch and time only" requirement with no extra filtering needed on the `Manager.html` side.
- Produces: `checkWeekend()` (async, sets `S.clashBusy`/`S.clash`, calls the two APIs above in sequence exactly as `Scores & Standings.dc.html:2170-2185`'s `runWeekendCheck`/`onCheckWeekend` do).

- [ ] **Step 1: Write the failing tests**

```js
  section('Draw tab (Task 7: clash checker)');
  {
    const { win } = await loadWithApi({
      loadAllDraws: async () => ({ drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14B', u16b: 'U16B' }, failed: [] }),
      weekendClashes: () => ({
        clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C4', sameAgeGroup: false,
          a: { agId: 'u14b', agName: 'U14B', label: 'Pool A', startMins: 480, endMins: 600 },
          b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
        unplaced: [], offAllocation: [], placedCount: 10,
      }),
      describeClash: (c) => `Pitch ${c.pitch} · ${c.dayLabel} — ${c.a.agName} ${c.a.label} overlaps ${c.b.agName} ${c.b.label}`,
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.checkWeekend();
    check('clash result is stored on S.clash', win.__test.S.clash && win.__test.S.clash.clashes.length === 1);
    const html = win.__test.viewDraw();
    check('the clash is shown with pitch and time', html.includes('Pitch C4') && html.includes('U14B'));
    // Fault-proof: nothing beyond pitch/time/label must ever appear — this
    // simply proves the render uses describeClash()'s string verbatim and
    // adds nothing of its own from the booking objects (which carry no
    // scores/contacts to begin with, by construction of weekendClashes()).
    check('no raw score-shaped field name leaks into the clash markup', !html.includes('homeScore') && !html.includes('parentMobile'));
  }
  {
    // Fault-proof: a thrown error from loadAllDraws must be caught and shown,
    // not left to crash the whole Draw tab render.
    const { win } = await loadWithApi({ loadAllDraws: async () => { throw new Error('network down'); } });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.checkWeekend();
    check('a failed clash check is recorded as an error, not left to throw', win.__test.S.clash && !!win.__test.S.clash.error);
  }
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement in `Manager.html`**

```js
async function checkWeekend(){
  S.clashBusy = true; S.clash = null; render();
  try {
    const { drawsByAge, ageNames, failed } = await api.loadAllDraws(S.session);
    const result = { ...api.weekendClashes(drawsByAge, ageNames), failed, groupCount: Object.keys(drawsByAge).length };
    S.clashBusy = false; S.clash = result;
  } catch (err) {
    S.clashBusy = false; S.clash = { error: 'Could not read every age group. Try again.' };
  }
  render();
}
```

- [ ] **Step 4: Add the clash panel to `viewDraw()` and wire it**

```js
  const clashPanel = `<div class="card" style="padding:16px;margin-top:16px">
    <div style="font-family:Anton;font-size:16px;text-transform:uppercase;margin-bottom:6px">Check the whole weekend</div>
    <p class="muted" style="font-size:12.5px;margin-bottom:10px">Every age group is edited on its own, so nothing normally notices when two of them are handed the same pitch at the same time. This reads all 15 and lists every overlap.</p>
    <button class="btn btn-o" style="width:auto;padding:12px 18px" id="checkWeekendBtn" ${S.clashBusy?'disabled':''}>${S.clashBusy?'Checking all 15 age groups…':'Check the whole weekend'}</button>
    ${S.clash ? (S.clash.error
      ? `<div class="err" style="margin-top:12px">${esc(S.clash.error)}</div>`
      : `<div style="margin-top:12px">
          <p style="font-weight:700;font-size:13.5px">${S.clash.clashes.length === 0
            ? `No pitch clashes. ${S.clash.placedCount} pool(s)/knockout matches placed across ${S.clash.groupCount} age groups.`
            : `${S.clash.clashes.length} pitch clash(es) across the weekend.`}</p>
          ${S.clash.clashes.map((c) => `<div class="err" style="margin-top:8px;background:#fbeae8;color:#a3271b">${esc(api.describeClash(c))}</div>`).join('')}
        </div>`) : ''}
  </div>`;
```

Include `clashPanel` in `viewDraw()`'s return (after `publishPanel`). Extend `wireDraw()`:

```js
  const checkWeekendBtn = document.getElementById('checkWeekendBtn'); if (checkWeekendBtn) checkWeekendBtn.onclick = checkWeekend;
```

Add `checkWeekend` to the test harness's exposed `window.__test` list.

- [ ] **Step 5: Run the test file, confirm it passes.**

- [ ] **Step 6: Fault-injection proof**

Temporarily remove the `try`/`catch` around the `loadAllDraws`/`weekendClashes` calls in `checkWeekend()` (let it throw uncaught), run the test, confirm the "failed clash check is recorded as an error" check now fails (with the test itself likely throwing/erroring rather than reporting a clean FAIL — note that in your run output as the proof), then restore the `try`/`catch`.

- [ ] **Step 7: Run the full existing suite. Expect all pass.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add whole-weekend pitch clash checker to the Draw tab"
```

---

### Task 8: Registrations tab

**Files:**
- Modify: `Manager.html` — add `loadRegistrations()`, `viewRegistrations()`, wire the search box
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `api.getMyRegistrations(session)` → `Promise<{teams: TeamRow[], players: PlayerRow[], scope: string}>` (`scores-data.js:1781`), where a `TeamRow` has (per `netlify/functions/_intake.js`'s `TEAM_OUT`) `{submittedAt, club, teamName, ageGroup, headCoachName, headCoachEmail, headCoachMobile, managerName, managerEmail, managerMobile, numPlayers, notes, players, preferredPool}` — note `players` is a **JSON-encoded string** of that team's coach-submitted roster (`[{firstName,lastName,dob},...]`), and a `PlayerRow` has `{submittedAt, playerName, dob, club, ageGroup, parentName, parentEmail, parentMobile, emergencyContact, emergencyMobile, medicalNotes, consent}` (both confirmed in `netlify/functions/_intake.js:65-70,420-435`). The server has already scoped both arrays to the manager's own age group (or all groups, for an organiser/`'*'` session) — `Manager.html` does **not** need to filter by age group name itself for an ordinary manager, but **does** need to narrow for the organiser/`'*'` case (mirroring `Scores & Standings.dc.html`'s `regNarrow` at line 2924-2930), since `S.ageId` (an id like `u14b`) is not directly comparable to `row.ageGroup` (a name like `U14B Contact`) — use `S.ageGroups.find(a=>a.id===S.ageId).name` for the comparison, same lookup `importSourceTeams()` (Task 4) already performs.
- Produces: `loadRegistrations()` (async, sets `S.regs`), `viewRegistrations()` (render function, added to `render()`'s dispatch in Task 1 Step 4), `unmatchedRegistrationCount()` (cross-references player registrations against every team's parsed roster by name+DOB, ported from `Scores & Standings.dc.html:2933-2951`'s `regKeyOf`/`regParseRoster`/`regRosterKeys`/`regUnmatchedTotal`).

- [ ] **Step 1: Write the failing tests**

```js
  section('Registrations tab (Task 8)');
  {
    const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14B Contact', headCoachName: 'Coach A', headCoachMobile: '0500000001', managerName: 'Mgr A', managerMobile: '0500000002', players: JSON.stringify([{ firstName:'Sam', lastName:'Jones', dob:'2013-01-01' }]) }];
    const regPlayers = [
      { playerName: 'Sam Jones', dob: '2013-01-01', club: 'ADH', ageGroup: 'U14B Contact', parentName: 'P Jones', parentMobile: '0500000003', emergencyContact: 'E Contact', emergencyMobile: '0500000004', medicalNotes: '', consent: 'Yes' },
      { playerName: 'Unmatched Kid', dob: '2013-02-02', club: 'ADH', ageGroup: 'U14B Contact', parentName: 'P Kid', parentMobile: '0500000005', emergencyContact: 'E Kid', emergencyMobile: '0500000006', medicalNotes: 'Asthma', consent: 'Yes' },
    ];
    const { win } = await loadWithApi({ getMyRegistrations: async () => ({ teams: regTeams, players: regPlayers, scope: 'U14B Contact' }) });
    await win.__test.boot();
    win.__test.go('registrations');
    await new Promise((r) => setTimeout(r, 0));
    const html = win.__test.viewRegistrations();
    check('shows the team\'s coach name and mobile', html.includes('Coach A') && html.includes('0500000001'));
    check('shows the player\'s date of birth', html.includes('2013-01-01'));
    check('shows the player\'s medical notes', html.includes('Asthma'));
    check('flags the player with no matching roster entry', html.includes('Unmatched Kid') && /not on a roster|unmatched/i.test(html));
    // Fault-proof: a player who DOES match a roster entry must NOT be flagged.
    const html2 = win.__test.viewRegistrations();
    const samSection = html2.slice(html2.indexOf('Sam Jones'), html2.indexOf('Sam Jones') + 200);
    check('a matched player is not flagged as unmatched', !/not on a roster|unmatched/i.test(samSection));
  }
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement in `Manager.html`**

```js
async function loadRegistrations(){
  S.regs = null; render();
  const data = await api.getMyRegistrations(S.session);
  S.regs = data;
  render();
}
function regNarrow(rows){
  if (S.session && S.session.ageGroupId === '*') {
    const meta = S.ageGroups.find((a) => a.id === S.ageId);
    const nm = ((meta && meta.name) || '').trim().toLowerCase();
    return (rows || []).filter((r) => String(r.ageGroup||'').trim().toLowerCase() === nm);
  }
  return rows || [];
}
function regKeyOf(name, dob){ return String(name||'').trim().toLowerCase().replace(/\s+/g,' ') + '|' + String(dob||'').trim(); }
function regParseRoster(team){
  let arr = [];
  try { arr = JSON.parse(team.players || '[]'); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  return arr.map((p) => ({ name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim(), dob: p.dob || '' }));
}
function viewRegistrations(){
  const head = `<div class="sec-t">Registrations</div>`;
  if (S.regs === undefined || S.regs === null) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  const teams = regNarrow(S.regs.teams);
  const players = regNarrow(S.regs.players);
  const rosterKeys = new Set();
  teams.forEach((t) => regParseRoster(t).forEach((p) => rosterKeys.add(regKeyOf(p.name, p.dob))));
  const unmatched = players.filter((p) => !rosterKeys.has(regKeyOf(p.playerName, p.dob)));
  const q = (S.regSearch || '').trim().toLowerCase();
  const hit = (hay) => !q || hay.toLowerCase().includes(q);
  const teamRows = teams.filter((t) => hit([t.club, t.teamName, t.headCoachName, t.managerName].join(' '))).map((t) => `<div class="row">
    <div><b>${esc(t.club)} &middot; ${esc(t.teamName)}</b><small>Coach: ${esc(t.headCoachName||'—')} ${esc(t.headCoachMobile||'')} &middot; Manager: ${esc(t.managerName||'—')} ${esc(t.managerMobile||'')}</small></div></div>`).join('');
  const playerRows = players.filter((p) => hit([p.playerName, p.club, p.parentName, p.dob].join(' '))).map((p) => {
    const isUnmatched = unmatched.includes(p);
    return `<div class="row" style="${isUnmatched?'box-shadow:inset 3px 0 0 #c9861a':''}">
      <div><b>${esc(p.playerName)}</b> <span class="muted">${esc(p.dob)}</span>
        <small>${esc(p.club)} &middot; Parent: ${esc(p.parentName||'—')} ${esc(p.parentMobile||'')} &middot; Emergency: ${esc(p.emergencyContact||'—')} ${esc(p.emergencyMobile||'')}</small>
        ${p.medicalNotes ? `<small style="color:#c9861a;font-weight:700">Medical: ${esc(p.medicalNotes)}</small>` : ''}
        <small>Consent: ${esc(p.consent||'—')}</small>
        ${isUnmatched ? `<small style="color:#c9861a;font-weight:700">&#9888; not on a roster</small>` : ''}
      </div></div>`;
  }).join('');
  return head
    + `<div class="field"><input id="regSearchInput" placeholder="Search player, club, coach or parent…" value="${esc(S.regSearch||'')}"></div>`
    + (unmatched.length ? `<div class="err" style="background:var(--warn-bg);color:var(--warn)">${unmatched.length} player registration(s) don't match any team roster by name + date of birth — flagged below.</div>` : '')
    + `<div class="sec-t">Teams (${teams.length})</div><div class="card">${teamRows || '<div class="empty">No team registrations yet.</div>'}</div>`
    + `<div class="sec-t">Players (${players.length})</div><div class="card">${playerRows || '<div class="empty">No player registrations yet.</div>'}</div>`;
}
```

- [ ] **Step 4: Wire the search box**

Add to `wire()` (or a new `wireRegistrations()` called from `wire()`):

```js
  const regSearchInput = document.getElementById('regSearchInput');
  if (regSearchInput) regSearchInput.oninput = () => { S.regSearch = regSearchInput.value; render(); };
```

Add `viewRegistrations`, `loadRegistrations` to the test harness's `window.__test` exposed list (both already referenced from Task 1's `render()`/`go()` changes — this task is what actually defines them).

- [ ] **Step 5: Run the test file, confirm it passes.**

- [ ] **Step 6: Fault-injection proof**

Temporarily change `regKeyOf` to ignore `dob` (`return String(name||'').trim().toLowerCase();`), run the test, confirm "a matched player is not flagged as unmatched" still passes but re-run with a name collision case — simpler: temporarily make `rosterKeys` always empty (comment out the `.forEach` that populates it), run the test, confirm "a matched player is not flagged as unmatched" now FAILS (Sam Jones would incorrectly show as unmatched), then restore.

- [ ] **Step 7: Run the full existing suite. Expect all pass.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add Registrations tab (teams, players, unmatched-registration flag)"
```

---

### Task 9: Spirit of Rugby Award + Cards field in the score-entry sheet

**Files:**
- Modify: `Manager.html` — extend `openMatch()` (the existing score-entry sheet) and `viewFixtures()`/`viewToday()`'s heading area for the running tally
- Test: `tests/test-manager-dashboard.js` (extend)

**Interfaces:**
- Consumes: `api.supportsSpiritAward(agId)` → `boolean` (`scores-data.js:1457`). Consumes `api.getSpiritAward(agId)` → `Promise<{supported:false} | {supported:true, totalMatches, playedMatches, complete, tally:[{name,count,team}], winners:[{name,team}]}>` (`scores-data.js:1467`). Consumes the existing `api.submitResult(matchId, payload, session)` (already used by `openMatch()` from the first Manager Dashboard build) — this task only **adds fields to the payload it already builds**: `homeCards`/`awayCards` (numbers) and `spiritNomineeHome`/`spiritNomineeAway` (strings), both already accepted and stored by `netlify/functions/submit-result.js:143-146` — no backend change needed.
- Produces: no new exported functions — this task only edits the body of the existing `openMatch(id)` function and adds a small spirit-tally card to `viewFixtures()`. `viewFixtures()` becomes `async` in effect only insofar as the tally needs its own fetch; keep this simple by fetching the tally lazily into `S.spiritAward` when the Fixtures tab loads (mirrors `load()`'s existing fixtures/standings fetch pattern), not by making `viewFixtures()` itself async (render functions in this codebase are synchronous; they read from `S`, they don't fetch).

- [ ] **Step 1: Write the failing tests**

```js
  section('Score sheet (Task 9: Spirit of Rugby Award + Cards)');
  {
    const { win } = await loadWithApi({ supportsSpiritAward: () => true });
    await win.__test.boot();
    await win.__test.load(win.__test.S.ageId);
    win.__test.openMatch(`${win.__test.S.ageId}:A:1-2`);
    const body = win.__test.getSheetBodyHtml ? win.__test.getSheetBodyHtml() : win.__test.doc.getElementById('sheetBody').innerHTML;
    check('the score sheet shows a Cards input for each side', (body.match(/Cards/g) || []).length >= 2);
    check('the score sheet shows Spirit of Rugby nomination inputs when supported', /spirit/i.test(body));
  }
  {
    const { win } = await loadWithApi({ supportsSpiritAward: () => false });
    await win.__test.boot();
    await win.__test.load(win.__test.S.ageId);
    win.__test.openMatch(`${win.__test.S.ageId}:A:1-2`);
    const body = win.__test.doc.getElementById('sheetBody').innerHTML;
    // Fault-proof: an age group that does NOT support the award must never
    // see the nomination fields at all — this is what proves showSpirit is
    // actually gating the markup, not just present unconditionally.
    check('no Spirit of Rugby fields when supportsSpiritAward() is false', !/spirit/i.test(body));
  }
  {
    let submitted = null;
    const { win } = await loadWithApi({
      supportsSpiritAward: () => true,
      submitResult: async (id, payload) => { submitted = payload; return { ok: true, stored: { homeScore: 5, awayScore: 0 } }; },
    });
    await win.__test.boot();
    await win.__test.load(win.__test.S.ageId);
    win.__test.openMatch(`${win.__test.S.ageId}:A:1-2`);
    win.__test.doc.getElementById('home-tries').value = '1';
    win.__test.doc.getElementById('spirit-home').value = 'Sam Jones';
    win.__test.doc.getElementById('home-cards').value = '1';
    win.__test.doc.getElementById('sgo').onclick();
    await new Promise((r) => setTimeout(r, 0));
    check('the submitted payload carries the spirit nomination', submitted && submitted.spiritNomineeHome === 'Sam Jones');
    check('the submitted payload carries the cards count', submitted && Number(submitted.homeCards) === 1);
  }
```

- [ ] **Step 2: Run and confirm failure** — expect the "Cards" check to fail (0 matches) since `openMatch()` doesn't render it yet.

- [ ] **Step 3: Extend `openMatch()` in `Manager.html`**

`openMatch()` currently builds `sideInputs(side, label)` from `api.scoringFor(S.ageId)` only (tries/conversions/penalties/drops). Add a Cards row to `sideInputs`, unconditionally (every age group gets Cards — the spec does not gate it behind `supportsSpiritAward`, only the nomination field is gated):

```js
  const sideInputs = (side, label) => `
    <div class="scoreblock">
      <div class="sb-head"><span>${esc(label)}</span><b id="tot-${side}">0</b></div>
      ${parts.map(k => `
        <div class="sb-row">
          <label for="${side}-${k}">${esc(api.scoreLabel(k))} <span class="sb-pts">${api.scorePoints(k)} pts</span></label>
          <input id="${side}-${k}" class="sb-in" type="number" inputmode="numeric" min="0" step="1"
                 value="${r ? (r[side + k.charAt(0).toUpperCase() + k.slice(1)] || 0) : 0}">
        </div>`).join('')}
      <div class="sb-row">
        <label for="${side}-cards">Cards</label>
        <input id="${side}-cards" class="sb-in" type="number" inputmode="numeric" min="0" step="1"
               value="${r ? (r[side + 'Cards'] || 0) : 0}">
      </div>
    </div>`;
```

Add a Spirit of Rugby block, gated on `api.supportsSpiritAward(S.ageId)`, right after the walk-over field and before the Save button:

```js
  const showSpirit = api.supportsSpiritAward(S.ageId);
  const spiritBlock = showSpirit ? `<div class="field" style="margin-top:4px">
    <label>Spirit of Rugby — one nomination per side</label>
    <div style="display:flex;gap:10px">
      <input id="spirit-home" placeholder="${esc(m.home?tName(m.home):'Home')} player" value="${r ? esc(r.spiritNomineeHome||'') : ''}" style="flex:1">
      <input id="spirit-away" placeholder="${esc(m.away?tName(m.away):'Away')} player" value="${r ? esc(r.spiritNomineeAway||'') : ''}" style="flex:1">
    </div>
  </div>` : '';
```

Splice `spiritBlock` into the `openSheet(...)` call's HTML string, between the walk-over `<div class="field">` block and the Save button.

Extend the payload-building in the Save handler (`$('sgo').onclick`) to include Cards and Spirit fields:

```js
    const payload = { walkover: wo || null };
    ['home','away'].forEach(side => parts.forEach(k => {
      payload[side + k.charAt(0).toUpperCase() + k.slice(1)] = Number(($(`${side}-${k}`)||{}).value || 0);
    }));
    payload.homeCards = Number(($('home-cards')||{}).value || 0);
    payload.awayCards = Number(($('away-cards')||{}).value || 0);
    if (showSpirit) {
      payload.spiritNomineeHome = ($('spirit-home')||{}).value || '';
      payload.spiritNomineeAway = ($('spirit-away')||{}).value || '';
    }
    const res = await api.submitResult(m.id, payload, S.session);
```

(The `readSide`/`recalc` total calculation must **not** include Cards — cards carry no points, mirroring the reference's `parts` list which never includes `'cards'` as a scoring type. Do not add `'cards'` to `parts`; it stays a sibling field outside the scoring loop, exactly as coded above.)

- [ ] **Step 4: Add the running Spirit Award tally card to the Fixtures & scoring tab**

Extend `load(agId)` to also fetch the spirit tally (only when supported, to avoid a wasted call):

```js
async function load(agId){
  S.ageId = agId; S.fixtures = null; S.standings = null;
  S.draw = undefined; S.drawLoadedFor = null;
  S.regs = undefined;
  S.spiritAward = null;
  render();
  const [fx, st] = await Promise.all([api.getFixtures(agId), api.getStandings(agId)]);
  if (S.ageId !== agId) return;
  S.fixtures = fx; S.standings = st;
  render();
  if (S.view === 'draw') loadDraw(agId);
  if (S.view === 'registrations') loadRegistrations();
  if (api.supportsSpiritAward(agId)) {
    S.spiritAward = await api.getSpiritAward(agId);
    if (S.ageId === agId) render();
  }
}
```

Add a small card to the top of `viewFixtures()` (before the `groups` markup), only rendered when `S.spiritAward` is set and `supported`:

```js
function viewFixtures(){
  const fx = S.fixtures;
  const head = `<div class="sec-t">Fixtures</div>`;
  if (!fx) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (fx.awaitingPublication) return head + comingSoon('Fixtures');
  const spirit = S.spiritAward && S.spiritAward.supported ? `<div class="card" style="padding:14px 16px;margin-bottom:14px">
    <div style="font-family:Anton;font-size:15px;text-transform:uppercase;color:var(--green-deep);margin-bottom:6px">Spirit of Rugby Award</div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">${S.spiritAward.playedMatches} of ${S.spiritAward.totalMatches} matches scored</div>
    ${S.spiritAward.complete && S.spiritAward.winners.length ? `<div style="font-weight:800;margin-bottom:8px">🏆 ${S.spiritAward.winners.map(w=>esc(w.team?`${w.name} (${w.team})`:w.name)).join(' & ')}</div>` : ''}
    ${S.spiritAward.tally.length ? S.spiritAward.tally.map((t) => `<span class="chip">${esc(t.name)} <span class="muted">${esc(t.team)}</span> ${t.count}</span>`).join('') : '<div class="muted" style="font-size:12px">No nominations yet.</div>'}
  </div>` : '';
  const byPool = {};
  ...
  return head + spirit
    + `<div class="card">${groups || '<div class="empty">...</div>'}</div>`
    + (ko.length ? ... : '');
}
```

- [ ] **Step 5: Run the test file, confirm it passes.**

- [ ] **Step 6: Fault-injection proof**

Temporarily delete the `if (showSpirit)` guard on the spirit-block payload lines (make it unconditional even when `supportsSpiritAward` is false), run the "no Spirit of Rugby fields when supportsSpiritAward() is false" check, confirm it still passes (because the markup gate is separate from the payload gate) — then instead temporarily change `showSpirit` itself to `const showSpirit = true;` (hardcoded), run the test, confirm "no Spirit of Rugby fields when supportsSpiritAward() is false" now FAILS, then restore `const showSpirit = api.supportsSpiritAward(S.ageId);`.

- [ ] **Step 7: Run the full existing suite. Expect all pass — pay particular attention to `test-fixtures-results-sync.js`, since this task touches `submitResult`'s payload shape.**

- [ ] **Step 8: Commit**

```bash
git add Manager.html tests/test-manager-dashboard.js
git commit -m "Add Spirit of Rugby Award nomination + tally and Cards field to the score sheet"
```

---

### Task 10: Test suite wiring — `tests/runall.ps1` and README

**Files:**
- Modify: `tests/runall.ps1` (confirm `test-manager-dashboard.js` is already listed — it was added in the first Manager Dashboard build; this task only needs to update it if the run order or count comment is stale)
- Modify: `claude/changelog.md` (append an entry — this is a top-level doc per this project's own filing convention, so it is in scope even though this plan otherwise only touches `Manager.html` and `tests/`)

**Interfaces:**
- Consumes: nothing new — this task is verification/bookkeeping, not new code.
- Produces: nothing consumed by a later task — this is the last task before the whole-branch review (Task 11).

- [ ] **Step 1: Confirm `test-manager-dashboard.js` is listed in `tests/runall.ps1`**

Run: `grep -n "test-manager-dashboard" tests/runall.ps1`
Expected: it is already present (added when the first Manager Dashboard plan shipped). If it is **not** present, add it to the list in the same style as the other entries, in the position that keeps the file's existing ordering convention (alphabetical, or grouped — match whatever `runall.ps1` already does).

- [ ] **Step 2: Run the entire suite one more time, in full, as `runall.ps1` would**

Run every file listed in the spec's own enumeration (test-registration.js, test-registration-panel.js, test-venue-map.js, test-venue-splits.js, test-session-permissions.js, test-agegroups.js, test-intake.js, test-functions-load.js, test-accounts.js, test-organizer-grouping.js, test-email.js, test-google-auth.js, test-manager-dashboard.js, test-fixtures-results-sync.js, test-simulate-tournament.js, `_prove-registration.js`), either via `pwsh tests/runall.ps1` if PowerShell is available in this environment, or by looping `node tests/<file>.js` over the same list if not.
Expected: every file passes, 0 failures.

- [ ] **Step 3: Append a changelog entry**

Read `claude/changelog.md` in full first (`project_read` if working from the Claude Project, or `Read` if working from the local clone), then append a new dated entry at the top (or wherever this file's existing convention places new entries — match it) summarizing: "Draw tab (fixture/pool/knockout editor with tap-to-assign, import registered teams, publish/unpublish, whole-weekend clash checker) and Registrations tab added to /manager; Spirit of Rugby Award nomination and a Cards field added to the score-entry sheet. No backend changes — every new UI surface calls an existing, already-tested scores-data.js export."

- [ ] **Step 4: Commit**

```bash
git add tests/runall.ps1 claude/changelog.md
git commit -m "Confirm test-manager-dashboard.js wiring in runall.ps1; changelog entry for the Draw/Registrations expansion"
```

(If `tests/runall.ps1` needed no change in Step 1, drop it from the `git add` and commit only the changelog.)

---

### Task 11: Final whole-branch verification

**Why this task exists:** every prior task was reviewed and tested individually, but nothing yet has looked at the finished `Manager.html` as ONE page a manager actually taps through on a phone, nor confirmed the branch touched nothing outside its stated scope. This mirrors Task 9 from the first Manager Dashboard plan (`plan-manager-dashboard.md`), which is this project's established "before this goes to Jay" gate.

**Files:**
- None modified — this is a read-only verification pass. Any defect found here becomes a new, small follow-up commit (not part of this task's own steps) fixing exactly that defect, then re-running this task's checks.

**Interfaces:**
- Consumes: the finished `Manager.html` from Tasks 1-9, the full test suite from Task 10.
- Produces: nothing — this is the plan's exit gate.

- [ ] **Step 1: Diff review — confirm scope**

Run: `git diff dev...work-manager-dashboard --stat` (or the equivalent against whatever the branch's actual merge-base is if `dev` has moved).
Expected: only `Manager.html`, `tests/test-manager-dashboard.js`, `tests/runall.ps1` (if touched), and `claude/changelog.md` appear — confirm nothing under `netlify/functions/`, `scores-data.js`, `app.html`, `Scores & Standings.dc.html`, or `Organizer.dc.html` was touched by this plan's tasks. If anything else shows up, investigate before proceeding — this plan's Global Constraints explicitly forbid backend or `scores-data.js` changes.

- [ ] **Step 2: Full suite, one more time, clean**

Run the complete `tests/runall.ps1` list end to end.
Expected: 0 failures.

- [ ] **Step 3: Headless screenshots at desktop and phone widths**

Using whatever headless-browser tooling this environment has available (e.g. a local static server + a headless Chromium screenshot script — check `claude/runbooks/` for an existing recipe from the first Manager Dashboard build's own Task 9 before writing a new one), serve `Manager.html` locally with a stubbed `scores-data.js` session (or, if a working local login exists in this environment's test fixtures, a real one), and capture:
- The Draw tab at 375px width (phone) — confirm pool cards, team chips, and the Save/Discard/Reset row are all reachable without horizontal scroll clipping content.
- The Draw tab at 1200px width (desktop) — confirm the layout does not look broken or oddly narrow at a wider viewport (the existing four tabs already handle this via `.mgr-shell{max-width:960px}`; confirm the new tab inherits it, since it renders into the same `#mgrMain` container).
- The Registrations tab at 375px width — confirm the search box and team/player rows are legible without horizontal scroll.
- The Fixtures & scoring tab's score sheet, opened on a match, at 375px width — confirm the new Cards and Spirit of Rugby fields fit inside the existing `.sheet` without visually colliding with the Save button.

Expected: no clipped content, no overlapping elements, no unreadable text at either width. If anything is visually broken, fix it with a small follow-up commit and re-capture before finishing.

- [ ] **Step 4: Manual click-through of the tap-to-select interaction**

In the same local preview, manually click through: pick a team chip in a pool (confirm it highlights green), tap a different pool's dropzone (confirm the team moves and the highlight clears), tap the same chip twice in a row without moving it (confirm it deselects). Repeat once for a match slot Home box and once for a knockout slot Away box. This is the one interaction this plan invented rather than ported verbatim, so it gets a manual pass in addition to the automated `pickTeam`/`placeTeam` unit checks from Task 2.

Expected: every pick/place/deselect works as described, with no dead zones (tapping the picked chip's rename/remove buttons must NOT trigger a pick, per Task 2 Step 4's `e.target.closest(...)` guard — confirm this specifically, since it is easy to regress).

- [ ] **Step 5: Report to Jay and get the push decision**

Per this project's own convention (`claude/writing-to-github-from-claude.md`, and the "Pushing to main costs 15 credits" project instruction): show Jay the diff summary from Step 1, the test summary from Step 2, and the screenshots from Step 3, in plain language labelled by platform ("In GitHub: this branch now has 9 new commits on top of the shipped Manager Dashboard..."). Get an explicit yes before pushing anything to `dev`, and a separate explicit yes before any later merge to `main`.

- [ ] **Step 6: No commit for this task** — it is a verification gate, not a code change. If Step 3 or Step 4 found something to fix, that fix is its own small commit (following the same fault-injection-tested pattern as every other task in this plan), after which Steps 1-4 are re-run before reporting to Jay.

---

## Self-review notes (fixed inline before this plan was finalized)

- **Spec coverage check:** Draw tab (editor, import, knockout, publish/unpublish with gating, clash checker) → Tasks 1-7. Registrations tab (teams, players, unmatched flag) → Task 8. Spirit of Rugby Award + Cards → Task 9. Testing convention (fault-injection proof, full suite passing) → embedded in every task's Steps, plus Task 10/11. Explicitly-out-of-scope items (Follow-a-team/venue-pitch-map, Change password) → correctly have no task; confirmed no step in this plan touches either.
- **Type/interface consistency check:** `pickTeam(team, from)` / `placeTeam(dest)` signature is identical everywhere it's called (Task 2's pool dropzones, Task 3's slot boxes, Task 5's knockout boxes) — `from`/`dest` objects always carry `{kind, poolId}` or `{kind, slotId, side}`. `S.draw` is the one shared mutable object every Draw-tab task (2-7) reads and writes directly — confirmed no task introduces a second, competing copy (e.g. a `S.editorDraw` name was deliberately avoided to prevent exactly the kind of drift the reference implementation's own `editorDraw`/`fixtures` split could have caused). `saveDraw()` (Manager.html-local, Task 3) vs. `api.saveDraw()` (imported, `scores-data.js`) are named identically to the reference's own local/imported split and this is called out explicitly in Task 3's Interfaces block to avoid an implementer confusing the two.
- **Placeholder scan:** no task contains "TBD"/"add error handling"/"similar to Task N" — every code block is complete, copy-pasteable, and every test step contains the actual assertion code rather than a description of one.
