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
  // Corrected: pools[].teams is pool MEMBERSHIP (computeStandings() reads it
  // directly), not an unassigned-teams bucket — placing a team into a
  // knockout slot must NOT remove it from its pool roster.
  check('a team placed into a knockout slot stays in its pool roster', poolB.teams.includes('DE1'));
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

/* ======================================================================== */
section('renderVals(): pool chips and zone are tap-wired, not drag-wired');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};
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

/* ======================================================================== */
section('stopPropagation(): pool chip handlers prevent event bubbling to pick');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};
  const vals = c.renderVals();
  const poolA = vals.poolCards.find((p) => p.id === 'A');
  const chipADH1 = poolA.teamChips.find((ch) => ch.name === 'ADH1');

  // Fault-injection test: verify onRename calls stopPropagation()
  let renameStopPropagationCalled = false;
  const fakeRenameEvent = {
    stopPropagation: () => { renameStopPropagationCalled = true; },
  };
  chipADH1.onRename(fakeRenameEvent);
  check('chip.onRename(e) calls e.stopPropagation()', renameStopPropagationCalled);

  // Fault-injection test: verify onRemove calls stopPropagation()
  let removeStopPropagationCalled = false;
  const fakeRemoveEvent = {
    stopPropagation: () => { removeStopPropagationCalled = true; },
  };
  chipADH1.onRemove(fakeRemoveEvent);
  check('chip.onRemove(e) calls e.stopPropagation()', removeStopPropagationCalled);
}

/* ======================================================================== */
section('renderVals(): pool-stage slot boxes are tap-wired (pickup AND drop)');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};
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

/* ======================================================================== */
section('renderVals(): 4th combination — occupied slot + team already picked');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};

  // Set up: sA1.home has ADH1 (from freshDraw), and pick DS1 from Pool A.
  let vals = c.renderVals();
  let poolA = vals.poolCards.find((p) => p.id === 'A');
  const chipDS1 = poolA.teamChips.find((ch) => ch.name === 'DS1');
  chipDS1.onPick(); // Pick DS1
  check('setup: DS1 is now picked', c.state.editorPicked && c.state.editorPicked.team === 'DS1');

  // Now tap the occupied sA1.home slot (which still contains ADH1) while DS1 is picked.
  // This is the 4th combination: occupied slot + team already picked = should PLACE (overwrite).
  vals = c.renderVals();
  poolA = vals.poolCards.find((p) => p.id === 'A');
  const rowA1 = poolA.slotRows.find((r) => r.id === 'sA1');
  rowA1.onHomeClick(); // tap the occupied home slot

  // Assert the occupied slot now shows the newly-placed team (DS1), not the old occupant (ADH1).
  const sA1 = c.state.editorDraw.slots.find((sl) => sl.id === 'sA1');
  check('tapping an occupied slot with a picked team overwrites it with the new team', sA1.home === 'DS1');

  // Corrected: DS1 came from Pool A's roster, so placing it into a match slot
  // must NOT remove it from that roster (pools[].teams is pool membership,
  // read directly by computeStandings() to build the public standings table).
  poolA = c.state.editorDraw.pools.find((p) => p.id === 'A');
  check('…and the new team STAYS in its source pool roster', poolA.teams.includes('DS1'));

  // Assert editorPicked is cleared after the placement.
  check('…and editorPicked is cleared', c.state.editorPicked === null);
}

/* ======================================================================== */
section('renderVals(): knockout boxes are tap-wired, and the separate roster is gone');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};
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
  // Corrected: a team placed into a knockout box from its pool must stay a
  // member of that pool (standings-critical — see removeTeamFromDraw/placeTeam).
  check('…and stays in its pool roster', c.state.editorDraw.pools.find((p) => p.id === 'A').teams.includes('DS1'));

  // And a filled knockout box is itself a valid pickup source, exactly like
  // a pool-stage slot box.
  const vals2 = c.renderVals();
  const ko1b = vals2.knockoutRows.find((r) => r.id === 'ko1');
  ko1b.onHomeClick();
  check('tapping a filled knockout box with nothing picked arms it as the pick', c.state.editorPicked && c.state.editorPicked.team === 'DS1' && c.state.editorPicked.from.kind === 'knockout');
}

/* ======================================================================== */
section('renderVals(): knockout 3rd combination — empty box + nothing picked');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};

  // freshDraw() creates ko1 with home='', away=''.
  // Tap the empty home side with nothing picked — should be a no-op.
  let vals = c.renderVals();
  const ko1 = vals.knockoutRows.find((r) => r.id === 'ko1');
  const beforeState = JSON.stringify(c.state.editorDraw.knockout[0]);
  ko1.onHomeClick(); // tap an empty knockout box with nothing picked

  // Assert nothing changed.
  check('tapping an empty knockout box with nothing picked is a no-op (no editorPicked set)', c.state.editorPicked === null);
  check('…and the knockout slot state is unchanged', JSON.stringify(c.state.editorDraw.knockout[0]) === beforeState);
}

/* ======================================================================== */
section('renderVals(): knockout 4th combination — occupied box + team already picked');
{
  const c = buildEditor();
  c.state.api = {
    minutesToTimeInput: () => '08:00',
    minutesToDisplay: () => '',
    poolEndMins: () => 500,
    canPublishNow: () => false,
    pitchMatch: () => null,
  };
  c.state.session = { role: 'org' };
  c.state.publishState = {};

  // Set up: place DS1 into the knockout slot's home side, then pick ADH1 from the pool.
  let vals = c.renderVals();
  let poolA = vals.poolCards.find((p) => p.id === 'A');
  const chipDS1 = poolA.teamChips.find((ch) => ch.name === 'DS1');
  chipDS1.onPick(); // pick DS1
  vals = c.renderVals();
  const ko1 = vals.knockoutRows.find((r) => r.id === 'ko1');
  ko1.onHomeClick(); // place DS1 into ko1.home
  check('setup: DS1 is now in the knockout slot', c.state.editorDraw.knockout[0].home === 'DS1');

  // Now pick a different team (ADH1) from a pool.
  vals = c.renderVals();
  poolA = vals.poolCards.find((p) => p.id === 'A');
  const chipADH1 = poolA.teamChips.find((ch) => ch.name === 'ADH1');
  chipADH1.onPick(); // pick ADH1
  check('setup: ADH1 is now picked', c.state.editorPicked && c.state.editorPicked.team === 'ADH1');

  // Now tap the occupied knockout.home slot (which contains DS1) while ADH1 is picked.
  // This is the 4th combination: occupied + picked = should PLACE (overwrite).
  vals = c.renderVals();
  const ko1b = vals.knockoutRows.find((r) => r.id === 'ko1');
  ko1b.onHomeClick(); // tap the occupied home side

  // Assert the knockout slot now shows the newly-placed team (ADH1), not the old (DS1).
  check('tapping an occupied knockout box with a picked team overwrites it', c.state.editorDraw.knockout[0].home === 'ADH1');

  // Corrected: ADH1 came from Pool A's roster, so placing it into a knockout
  // box must NOT remove it from that roster.
  poolA = c.state.editorDraw.pools.find((p) => p.id === 'A');
  check('…and the new team STAYS in its source pool roster', poolA.teams.includes('ADH1'));

  // Assert editorPicked is cleared after the placement.
  check('…and editorPicked is cleared', c.state.editorPicked === null);

  // Assert the old occupant (DS1) is NOT in any pool anymore (it came from outside).
  // But verify it's simply gone, not still in a knockout side.
  check('…and the old occupant leaves the knockout slot', c.state.editorDraw.knockout[0].away === '');
}

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
  // Remove team — but it's a DIFFERENT team from what's picked
  // FAULT-INJECTION TEST: if onRemoveTeam's guard were unconditional (always
  // clearing editorPicked), this would fail. This proves the guard only clears
  // when the removed team IS the picked team, not when removing any team.
  {
    const c = buildEditor();
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    check('setup: ADH1 is picked', c.state.editorPicked && c.state.editorPicked.team === 'ADH1');
    c.onRemoveTeam('A', 'DS1'); // remove a DIFFERENT team from the same pool
    c.state.modal.onConfirm();
    check('removing an UNPICKED team leaves editorPicked alone', c.state.editorPicked && c.state.editorPicked.team === 'ADH1');
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
section('placeTeam(): standings-integrity fix — pool roster is membership, not an unassigned bucket');
{
  // (a) Fault-injection: a naive "always remove from origin" placeTeam (i.e.
  // today's bug) would fail this — DS1 would vanish from Pool A's roster the
  // moment it's placed into a match slot, and computeStandings() reads
  // pools[].teams directly, so it would silently disappear from the public
  // standings table too.
  {
    const c = buildEditor();
    c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    c.placeTeam({ kind: 'slot', slotId: 'sB1', side: 'away' });
    const poolA = c.state.editorDraw.pools.find((p) => p.id === 'A');
    const sB1 = c.state.editorDraw.slots.find((sl) => sl.id === 'sB1');
    check('(a) placing a pool team into a match slot leaves it in the pool roster', poolA.teams.includes('DS1'));
    check('…and it lands in the slot', sB1.away === 'DS1');
  }
  // (b) Same fault-injection, for a knockout box instead of a pool-stage slot.
  {
    const c = buildEditor();
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    c.placeTeam({ kind: 'knockout', slotId: 'ko1', side: 'away' });
    const poolA = c.state.editorDraw.pools.find((p) => p.id === 'A');
    const ko1 = c.state.editorDraw.knockout.find((sl) => sl.id === 'ko1');
    check('(b) placing a pool team into a knockout box leaves it in the pool roster', poolA.teams.includes('ADH1'));
    check('…and it lands in the knockout box', ko1.away === 'ADH1');
  }
  // (c) Moving a team from a slot back into a DIFFERENT pool must still
  // behave like the old onPoolDropTeam: remove it from whichever pool
  // currently lists it (ADH1 is still listed in Pool A per fix (a)/(b) above
  // — a slot placement never touched that roster) and add it to the
  // destination pool, AND clear the vacated slot/knockout side so the team
  // isn't left duplicated there.
  {
    const c = buildEditor();
    // ADH1 starts in sA1.home (freshDraw) and is still a member of Pool A's
    // roster. Pick it up from the slot and place it into Pool B.
    check('setup: ADH1 is still in Pool A roster before the move', c.state.editorDraw.pools.find((p) => p.id === 'A').teams.includes('ADH1'));
    c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
    c.placeTeam({ kind: 'pool', poolId: 'B' });
    const poolA = c.state.editorDraw.pools.find((p) => p.id === 'A');
    const poolB = c.state.editorDraw.pools.find((p) => p.id === 'B');
    const sA1 = c.state.editorDraw.slots.find((sl) => sl.id === 'sA1');
    check('(c) moving a slot-picked team to a different pool removes it from its old pool', !poolA.teams.includes('ADH1'));
    check('…and adds it to the new pool', poolB.teams.includes('ADH1'));
    check('…and clears the vacated slot side', sA1.home === '');
  }
}

/* ======================================================================== */
section('onRemovePool(): fault-injection — picked team sourced from a match slot in the deleted pool');
{
  // (d) editorPicked can point at from:{kind:'slot', slotId, side} rather
  // than from:{kind:'pool'} — the existing guard only checked the deleted
  // pool's ROSTER, so a team picked FROM one of that pool's match slots
  // survived the pool's deletion and could then be placed into a different
  // pool's match slot, resurrecting a team whose pool no longer exists. A
  // guard that only checks removedPool.teams (today's bug) would fail this.
  //
  // To isolate this from the roster check (which would also fire if the
  // team simply happened to still be listed in Pool A's roster), place a
  // team whose OWN pool is B into a Pool-A-owned slot (sA1) first, matching
  // the corrected placeTeam() behaviour where pool membership isn't touched
  // by a slot placement — so DE1 is a member of Pool B's roster, sitting in
  // a Pool A slot. Deleting Pool A should still clear a pick sourced from
  // that slot, purely because the SLOT belonged to the deleted pool.
  const c = buildEditor();
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'away' }); // sA1 belongs to Pool A
  check('setup: DE1 is a Pool B team sitting in a Pool A slot', c.state.editorDraw.pools.find((p) => p.id === 'B').teams.includes('DE1')
    && c.state.editorDraw.slots.find((sl) => sl.id === 'sA1').away === 'DE1');
  c.pickTeam('DE1', { kind: 'slot', slotId: 'sA1', side: 'away' });
  check('setup: DE1 is picked from a slot belonging to Pool A (not Pool B, its own pool)', c.state.editorPicked && c.state.editorPicked.from.kind === 'slot' && c.state.editorPicked.from.slotId === 'sA1');
  c.onRemovePool('A');
  c.state.modal.onConfirm();
  check('(d) deleting a pool clears a pick sourced from one of ITS match slots', c.state.editorPicked === null);

  // Control: a pick from a slot belonging to a DIFFERENT (surviving) pool
  // must NOT be cleared by an unrelated pool's deletion.
  const c2 = buildEditor();
  c2.pickTeam('', { kind: 'slot', slotId: 'sB1', side: 'home' }); // sB1 (Pool B) is empty in freshDraw, but the source is what matters here
  c2.onRemovePool('A');
  c2.state.modal.onConfirm();
  check('…control: a pick from an unrelated pool\'s slot survives', c2.state.editorPicked && c2.state.editorPicked.from.slotId === 'sB1');
}

/* ======================================================================== */
section('editorPicked safety nets: loadEditor (age switch, save, discard all route through it)');
{
  const c = buildEditor();
  c.state.api = {
    getDraw: async () => freshDraw(),
    saveDraw: async () => ({ ok: true }),
    getFixtures: async () => ({ pool: [], knockout: [] }),
    supportsSpiritAward: () => false,
    minutesToTimeInput: () => '08:00', minutesToDisplay: () => '', poolEndMins: () => 500,
  };
  c.state.session = { token: 'x', ageGroupId: 'u14b' };
  c.state.regLoaded = true; // skip loadMyRegistrations
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  await c.loadEditor('u14b');
  check('loadEditor clears editorPicked (covers age-group switch)', c.state.editorPicked === null);

  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  await c.onSaveDraw();
  // onSaveDraw calls loadAdmin without await, so we need to wait for the pending
  // async operations (loadEditor inside loadAdmin) to complete. Use setImmediate
  // to yield to the event loop and let the pending promises settle.
  await new Promise(resolve => setImmediate(resolve));
  check('onSaveDraw (routes through loadAdmin -> loadEditor) clears editorPicked', c.state.editorPicked === null);
}

summary('test-scores-draw-editor.js');
}

main();
