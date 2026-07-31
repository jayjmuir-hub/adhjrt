/* tests/test-manager-dc-draw.js
   ------------------------------------------------------------------------
   The Draw tab on Manager.dc.html. Same .dc.html harness as
   tests/test-scores-draw-editor.js (DCLogic stand-in + regex the
   <script type="text/x-dc"> block out and eval it), duplicated per test file
   as this project does throughout.

   ONE INTENTIONAL DIFFERENCE FROM Manager.html, asserted here on purpose:
   pools[].teams is pool MEMBERSHIP (computeStandings reads it directly), so
   placing a team into a match slot or knockout box does NOT remove it from
   its pool roster. Manager.html removed it, which is the bug the uniform
   draw editor fixed in Scores & Standings.dc.html.
*/
const { readRepo, section, check, eq, summary } = require('./_lib');

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

function freshDraw() {
  return {
    pools: [
      { id: 'A', name: 'Pool A', teams: ['ADH1', 'DS1'] },
      { id: 'B', name: 'Pool B', teams: ['DE1'] },
    ],
    slots: [
      { id: 'sA1', poolId: 'A', home: 'ADH1', away: '', startMins: 480, pitch: 'A1' },
      { id: 'sB1', poolId: 'B', home: '', away: '', startMins: 480, pitch: 'A2' },
    ],
    knockout: [
      { id: 'u14b:CUP', round: 'Cup Final', home: '', away: '', startMins: 600, pitch: 'A1' },
    ],
    pitches: ['A1', 'A2'],
    _publish: { published: false, publishedAt: null, publishedBy: null, managerCanPublishNow: false },
  };
}

function drawApi(overrides) {
  return Object.assign({
    getDraw: async () => freshDraw(),
    saveDraw: async () => ({ ok: true }),
    publishDraw: async () => ({ ok: true, published: true }),
    unpublishDraw: async () => ({ ok: true, published: false }),
    canPublishNow: () => false,
    autoKnockoutSlots: async () => [],
    regeneratePoolSlots: (agId, poolId, teams) => (teams || []).slice(0, -1).map((t, i) => ({
      id: `${agId}:${poolId}:regen${i}`, poolId, home: t, away: teams[i + 1] || '', startMins: 8 * 60 + i * 20, pitch: 'TBD',
    })),
    pitchesForAgeGroup: () => ['A1', 'A2'],
    minutesToTimeInput: (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    minutesToDisplay: (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`,
    timeToMinutes: (hhmm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
      if (!m) return NaN;
      return Number(m[1]) * 60 + Number(m[2]);
    },
    slotLengthMins: () => 20,
    dayStartMins: () => 8 * 60,
    logout: () => {},
    loadAllDraws: async () => ({ drawsByAge: {}, ageNames: {}, failed: [] }),
    weekendClashes: () => ({ clashes: [], unplaced: [], offAllocation: [], placedCount: 0 }),
    describeClash: () => '',
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
    getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }),
    getFixtures: async () => ({ awaitingPublication: false, pool: [], knockout: [] }),
    getStandings: async () => ({ awaitingPublication: false, ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [], tables: {}, _advance: 0 }),
    getSpiritAward: async () => ({ supported: false }),
    supportsSpiritAward: () => false,
    teamLabel: (c) => c, teamShort: (c) => c,
  }, overrides || {});
}

/* A component already signed in, already on the Draw tab, with the draw
   loaded — the state every Draw-tab test starts from. */
function buildDraw(apiOverrides) {
  const c = build('Manager.dc.html');
  c.state = {
    ...c.state,
    api: drawApi(apiOverrides),
    session: { ageGroupId: 'u14b', token: 'tok' },
    ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }],
    ageId: 'u14b',
    tab: 'draw',
    draw: freshDraw(),
    drawLoadedFor: 'u14b',
    fixtures: { awaitingPublication: false, pool: [], knockout: [] },
  };
  return c;
}

function pool(c, id) { return c.state.draw.pools.find((p) => p.id === id); }
function slot(c, id) { return c.state.draw.slots.find((s) => s.id === id); }
function ko(c, id) { return (c.state.draw.knockout || []).find((s) => s.id === id); }

async function main() {

section('loadDraw(): fetching, loading state, and the empty state');
{
  let asked = null;
  const c = buildDraw({ getDraw: async (agId, session) => { asked = [agId, session && session.token]; return freshDraw(); } });
  c.setState({ draw: undefined, drawLoadedFor: null });
  check('before the fetch the tab reports it is loading', c.renderVals().drawLoading === true);
  await c.loadDraw('u14b');
  check('getDraw is called for this age group, with the session', eq('getDraw args', asked, ['u14b', 'tok']));
  check('the draw lands in state', c.state.draw && c.state.draw.pools.length === 2);
  check('…and is marked as loaded for this age group', c.state.drawLoadedFor === 'u14b');
  check('a freshly loaded draw is not dirty', c.state.drawDirty === false);
}
{
  const c = buildDraw({ getDraw: async () => null });
  c.setState({ draw: undefined, drawLoadedFor: null });
  await c.loadDraw('u14b');
  // FAULT-PROOF: state.draw is null BOTH while a fetch is in flight and after
  // a settled fetch that found nothing. drawLoadedFor is what tells them
  // apart — without it, "no draw saved yet" renders as a permanent spinner.
  check('a settled fetch that found no draw shows the empty state, not a spinner',
    c.renderVals().drawMissing === true && c.renderVals().drawLoading === false);
}
{
  const c = buildDraw();
  c.setState({ tab: 'today', draw: undefined, drawLoadedFor: null });
  c.go('draw');
  await new Promise((r) => setImmediate(r));
  check('switching to the Draw tab loads the draw', c.state.drawLoadedFor === 'u14b');
}
{
  let fetches = 0;
  const c = buildDraw({ getDraw: async () => { fetches++; return freshDraw(); } });
  c.setState({ tab: 'today' });
  c.go('draw');
  await new Promise((r) => setImmediate(r));
  check('an already-loaded draw is not refetched on every visit', fetches === 0);
}

section('pickTeam(): select and deselect');
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  check('picking a team records it', c.state.picked && c.state.picked.team === 'DS1');
  check('…with its source', c.state.picked.from.kind === 'pool' && c.state.picked.from.poolId === 'A');
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  check('tapping the same team in the same place again deselects', c.state.picked === null);
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  // FAULT-PROOF: a toggle that ignored the identity would deselect here
  // instead of switching, leaving the manager with nothing in hand.
  check('picking a different team replaces the pick rather than toggling it off',
    c.state.picked && c.state.picked.team === 'ADH1' && c.state.picked.from.kind === 'slot');
}

section('placeTeam(): moves, and the dedup rule');
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  check('a pool-to-pool move leaves the old pool', !pool(c, 'A').teams.includes('DS1'));
  check('…and joins the new one', pool(c, 'B').teams.includes('DS1'));
  check('the pick clears after a successful place', c.state.picked === null);
  check('…and the draw is marked unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'slot', slotId: 'sB1', side: 'home' });
  // FAULT-PROOF: this is the dedup rule. A place that only wrote the
  // destination would leave ADH1 in BOTH slots.
  check('a slot-to-slot move clears the old slot', slot(c, 'sA1').home === '');
  check('…and fills the new one', slot(c, 'sB1').home === 'ADH1');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'away' });
  check('moving within one slot clears the side it left', slot(c, 'sA1').home === '');
  check('…and sets the side it landed on', slot(c, 'sA1').away === 'ADH1');
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'slot', slotId: 'sB1', side: 'away' });
  // FAULT-PROOF, and the one intentional difference from Manager.html:
  // pools[].teams is MEMBERSHIP. computeStandings() reads it directly, so a
  // team that vanished from its pool here would vanish from the public
  // standings table too.
  check('placing a pool team into a match slot leaves it in its pool roster', pool(c, 'A').teams.includes('DS1'));
  check('…and it lands in the slot', slot(c, 'sB1').away === 'DS1');
}
{
  const c = buildDraw();
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.placeTeam({ kind: 'knockout', slotId: 'u14b:CUP', side: 'home' });
  check('placing a pool team into a knockout box leaves it in its pool roster', pool(c, 'B').teams.includes('DE1'));
  check('…and it lands in the knockout box', ko(c, 'u14b:CUP').home === 'DE1');

  c.pickTeam('DE1', { kind: 'knockout', slotId: 'u14b:CUP', side: 'home' });
  c.placeTeam({ kind: 'knockout', slotId: 'u14b:CUP', side: 'away' });
  check('moving within one knockout slot clears the old side', ko(c, 'u14b:CUP').home === '');
  check('…and sets the new side', ko(c, 'u14b:CUP').away === 'DE1');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  check('a slot-picked team moved into a pool leaves its old pool', !pool(c, 'A').teams.includes('ADH1'));
  check('…joins the new pool', pool(c, 'B').teams.includes('ADH1'));
  check('…and vacates the slot it was sitting in', slot(c, 'sA1').home === '');
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'home' }); // sA1.home currently holds ADH1
  check('placing onto an occupied box overwrites it', slot(c, 'sA1').home === 'DS1');
  check('…and the displaced team is simply no longer in that box', slot(c, 'sA1').away === '');
}
{
  const c = buildDraw();
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  check('placing with nothing picked changes nothing', eq('Pool B untouched', pool(c, 'B').teams, ['DE1']));
  check('…and does not mark the draw unsaved', c.state.drawDirty === false);

  const c2 = buildDraw();
  c2.setState({ draw: null, picked: { team: 'X', from: { kind: 'pool', poolId: 'A' } } });
  c2.placeTeam({ kind: 'pool', poolId: 'A' });
  check('placing with no draw loaded does not throw', true);
}

section('Pool CRUD');
{
  const c = buildDraw();
  c.addPool();
  check('adding a pool adds exactly one', c.state.draw.pools.length === 3);
  // FAULT-PROOF: the id must be the first UNUSED letter, not "next after the
  // last one" — deleting B and adding again has to reuse B, not skip to D.
  check('…with the first unused letter as its id', c.state.draw.pools[2].id === 'C');
  check('…named after it', c.state.draw.pools[2].name === 'Pool C');
  check('…and empty', c.state.draw.pools[2].teams.length === 0);
  check('…and the draw is marked unsaved', c.state.drawDirty === true);
}
{
  // Three pools (A, B, C) so a freed MIDDLE letter is unambiguous: a length-
  // based id ("next char after however many pools remain") would collide
  // with the existing C instead of reusing B — a plain reuse check with only
  // two pools to start cannot tell those two implementations apart.
  const c = buildDraw();
  c.addPool();
  check('starting from three pools', c.state.draw.pools.map((p) => p.id).join(',') === 'A,B,C');
  c.onRemovePool('B');
  c.submitModal();
  c.addPool();
  check('a freed letter is reused rather than skipped',
    c.state.draw.pools.map((p) => p.id).filter((id) => id === 'B').length === 1);
  check('…without colliding with a pool that was never removed',
    c.state.draw.pools.map((p) => p.id).filter((id) => id === 'C').length === 1);
}
{
  const c = buildDraw();
  c.onRenamePool('A');
  check('renaming a pool asks for the new name', !!c.state.modal && c.state.modal.kind === 'prompt');
  check('…seeded with the current name', c.state.modalValue === 'Pool A');
  c.setState({ modalValue: 'Pool Alpha' });
  c.submitModal();
  check('…and applies it', pool(c, 'A').name === 'Pool Alpha');
  check('…marking the draw unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw();
  c.onRemovePool('A');
  check('deleting a pool asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and nothing is deleted until it is confirmed', c.state.draw.pools.length === 2);
  c.submitModal();
  check('confirming removes the pool', c.state.draw.pools.length === 1 && !pool(c, 'A'));
  // FAULT-PROOF: a pool's match slots belong to it. Leaving them behind gives
  // orphan fixtures for a pool that no longer exists.
  check('…and its match slots go with it', !slot(c, 'sA1'));
  check('…leaving other pools\' slots alone', !!slot(c, 'sB1'));
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.onRemovePool('A');
  c.submitModal();
  // FAULT-PROOF: a team still "in hand" from a pool that no longer exists can
  // be dropped into a surviving pool a moment later, resurrecting it.
  check('deleting a pool clears a pick taken from its roster', c.state.picked === null);
}
{
  const c = buildDraw();
  // DE1 belongs to Pool B but is sitting in a Pool A slot — so this isolates
  // the SLOT-ownership guard from the roster guard.
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'away' });
  c.pickTeam('DE1', { kind: 'slot', slotId: 'sA1', side: 'away' });
  c.onRemovePool('A');
  c.submitModal();
  check('deleting a pool also clears a pick taken from one of ITS match slots', c.state.picked === null);
}
{
  const c = buildDraw();
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.onRemovePool('A');
  c.submitModal();
  // FAULT-PROOF the other way: an unconditional clear would wipe a perfectly
  // valid pick belonging to a pool that was not touched.
  check('deleting an unrelated pool leaves the pick alone', c.state.picked && c.state.picked.team === 'DE1');
}

section('Team CRUD');
{
  const c = buildDraw();
  c.onNewTeamInput('A', 'NEW1');
  check('the new-team box keeps what was typed, per pool', c.state.newTeamDrafts.A === 'NEW1');
  c.onAddTeam('A');
  check('adding puts the team in that pool', pool(c, 'A').teams.includes('NEW1'));
  check('…and empties the box for the next one', !c.state.newTeamDrafts.A);
  check('…and marks the draw unsaved', c.state.drawDirty === true);

  c.onNewTeamInput('A', '   ');
  c.onAddTeam('A');
  check('adding blank whitespace adds nothing', pool(c, 'A').teams.length === 3);
  c.onNewTeamInput('A', 'NEW1');
  c.onAddTeam('A');
  check('adding a team already in that pool does not duplicate it',
    pool(c, 'A').teams.filter((t) => t === 'NEW1').length === 1);
}
{
  const c = buildDraw();
  c.onRenameTeam('A', 'ADH1');
  check('renaming a team asks for the new name', !!c.state.modal && c.state.modal.kind === 'prompt');
  c.setState({ modalValue: 'ADHX' });
  c.submitModal();
  check('the roster carries the new name', pool(c, 'A').teams.includes('ADHX') && !pool(c, 'A').teams.includes('ADH1'));
  // FAULT-PROOF: a rename that only touched the roster would leave the match
  // slot pointing at a team name nothing else knows about.
  check('…and so does every match slot that named it', slot(c, 'sA1').home === 'ADHX');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
  c.onRenameTeam('A', 'ADH1');
  c.setState({ modalValue: 'ADHX' });
  c.submitModal();
  // FAULT-PROOF: the pick held the OLD name, so placing it afterwards would
  // resurrect the pre-rename team alongside the renamed one.
  check('renaming the picked team clears the pick', c.state.picked === null);
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.onRenameTeam('A', 'ADH1');
  c.setState({ modalValue: 'ADHX' });
  c.submitModal();
  check('renaming a different team leaves the pick alone', c.state.picked && c.state.picked.team === 'DS1');
}
{
  const c = buildDraw();
  c.onRemoveTeam('A', 'ADH1');
  check('removing a team asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and nothing is removed until it is confirmed', pool(c, 'A').teams.includes('ADH1'));
  c.submitModal();
  check('confirming takes it out of the pool', !pool(c, 'A').teams.includes('ADH1'));
  check('…and blanks it out of any match slot that named it', slot(c, 'sA1').home === '');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
  c.onRemoveTeam('A', 'ADH1');
  c.submitModal();
  check('removing the picked team clears the pick', c.state.picked === null);

  const c2 = buildDraw();
  c2.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c2.onRemoveTeam('A', 'ADH1');
  c2.submitModal();
  check('removing a different team leaves the pick alone', c2.state.picked && c2.state.picked.team === 'DS1');
}

section('renderVals(): pool cards are tap-wired');
{
  const c = buildDraw();
  const vals = c.renderVals();
  check('one card per pool', vals.poolCards.length === 2 && vals.poolCards[0].name === 'Pool A');
  const chip = vals.poolCards[0].teamChips.find((ch) => ch.name === 'ADH1');
  check('a chip exposes onPick, not a drag handler', typeof chip.onPick === 'function' && chip.onDragStart === undefined);
  check('an unpicked chip uses the neutral fill', !chip.chipStyle.includes('#17A34A'));
  chip.onPick();
  check('tapping the chip arms it', c.state.picked && c.state.picked.team === 'ADH1');
  const picked = c.renderVals().poolCards[0].teamChips.find((ch) => ch.name === 'ADH1');
  check('…and it re-renders green', picked.chipStyle.includes('#17A34A'));

  c.renderVals().poolCards[1].onZoneClick({ currentTarget: 'zone', target: 'zone' });
  check('tapping the destination pool\'s empty area places it there', pool(c, 'B').teams.includes('ADH1'));
  check('…and clears the pick', c.state.picked === null);
}
{
  const c = buildDraw();
  const vals = c.renderVals();
  vals.poolCards[0].teamChips[0].onPick();
  vals.poolCards[0].onZoneClick({ currentTarget: 'zone', target: 'a-chip-inside-it' });
  // FAULT-PROOF: a click that bubbled up from a chip must not ALSO count as a
  // drop on the zone, or every pick instantly places itself.
  check('a click that bubbled up from a child does not also place', c.state.picked !== null);
}
{
  const c = buildDraw();
  const chip = c.renderVals().poolCards[0].teamChips[0];
  let renameStopped = false, removeStopped = false;
  chip.onRename({ stopPropagation: () => { renameStopped = true; } });
  check('the chip\'s rename button stops the click bubbling into a pick', renameStopped);
  c.closeModal();
  chip.onRemove({ stopPropagation: () => { removeStopped = true; } });
  check('the chip\'s remove button does too', removeStopped);
}

section('Transient Draw state does not outlive what it referred to');
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.setState({ drawMsg: 'Saved as a draft. Use Publish to make it public.', clash: { clashes: [] }, importRows: [{ code: 'X' }] });
  c.go('today');
  // FAULT-PROOF: a stale "Saved as a draft" banner or clash result reappearing
  // the next time the Draw tab is opened tells the manager something happened
  // that did not.
  check('leaving the Draw tab clears the pick', c.state.picked === null);
  check('…the last message', c.state.drawMsg === '');
  check('…the clash result', c.state.clash === null);
  check('…and the import rows', c.state.importRows === null);
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.setState({ drawMsg: 'Saved as a draft. Use Publish to make it public.' });
  c.doLogout();
  check('signing out clears the pick', c.state.picked === null);
  check('…and the last message', c.state.drawMsg === '');
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.setState({ drawMsg: 'x', clash: { clashes: [] }, importRows: [{ code: 'X' }] });
  await c.load('u14b');
  check('a reload after a score save clears the pick', c.state.picked === null);
  check('…the message', c.state.drawMsg === '');
  check('…the clash result', c.state.clash === null);
  check('…and the import rows', c.state.importRows === null);
}
{
  const c = buildDraw();
  c.addPool();
  const poolsBefore = c.state.draw.pools.length;
  await c.load('u14b');
  // FAULT-PROOF: load() runs after every score save. Throwing away an unsaved
  // draw edit at that moment loses work the manager was never warned about.
  check('an unsaved Draw edit survives a reload triggered elsewhere',
    c.state.draw && c.state.draw.pools.length === poolsBefore);
  check('…and is still flagged unsaved', c.state.drawDirty === true);
  check('…and the tab says so', c.renderVals().drawDirty === true);
}

summary('tests/test-manager-dc-draw.js');
}

main();
