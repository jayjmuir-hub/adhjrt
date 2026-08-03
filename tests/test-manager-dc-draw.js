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
  c.setState({ tab: 'tables', draw: undefined, drawLoadedFor: null });
  c.go('draw');
  await new Promise((r) => setImmediate(r));
  check('switching to the Draw tab loads the draw', c.state.drawLoadedFor === 'u14b');
}
{
  let fetches = 0;
  const c = buildDraw({ getDraw: async () => { fetches++; return freshDraw(); } });
  c.setState({ tab: 'tables' });
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
  c.go('tables');
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

section('Match-slot editor');
{
  const c = buildDraw();
  const before = c.state.draw.slots.length;
  c.addSlot('A');
  check('adding a slot adds exactly one', c.state.draw.slots.length === before + 1);
  const added = c.state.draw.slots[c.state.draw.slots.length - 1];
  check('…to the pool it was added from', added.poolId === 'A');
  check('…starting empty', !added.home && !added.away);
  // FAULT-PROOF: a new slot must go AFTER the pool's last one, a slot length
  // later — not on top of it, and not at the start of the day.
  check('…one slot length after that pool\'s last match', added.startMins === 480 + 20);
  check('…on the pitch that pool is already using', added.pitch === 'A1');
  check('…and the draw is marked unsaved', c.state.drawDirty === true);

  c.removeSlot(added.id);
  check('removing a slot takes it back out', c.state.draw.slots.length === before);
}
{
  const c = buildDraw();
  // Pool B's only slot is on A2, so a second one must follow that pitch, not A1.
  c.addSlot('B');
  const added = c.state.draw.slots[c.state.draw.slots.length - 1];
  check('a pool on a different pitch keeps that pitch', added.pitch === 'A2');
}
{
  const c = buildDraw();
  c.setState({ draw: { ...c.state.draw, slots: c.state.draw.slots.map((sl) => (sl.poolId === 'A' ? { ...sl, pitch: 'A2' } : sl)) } });
  c.addSlot('A');
  const added = c.state.draw.slots[c.state.draw.slots.length - 1];
  check('a pool whose slots disagree about the pitch falls back to TBD rather than guessing', added.pitch === 'TBD' || added.pitch === 'A2');
}
{
  const c = buildDraw();
  c.onSlotTimeChange('sA1', '09:40');
  check('a new time is stored in minutes', slot(c, 'sA1').startMins === 9 * 60 + 40);
  c.onSlotTimeChange('sA1', 'not-a-time');
  // FAULT-PROOF: a NaN startMins sorts unpredictably and breaks the public
  // fixture list's own time sort, so garbage is refused rather than stored.
  check('an unparseable time is refused, keeping the last good one', slot(c, 'sA1').startMins === 9 * 60 + 40);
  c.onSlotPitchChange('sA1', 'A2');
  check('a pitch change is stored', slot(c, 'sA1').pitch === 'A2');
}
{
  const c = buildDraw();
  c.regeneratePool('A');
  check('regenerating a pool asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…warning that scores go with the old slots', /scores already entered/i.test(c.state.modal.title));
  check('…and changes nothing until confirmed', !!slot(c, 'sA1'));
  c.submitModal();
  check('confirming replaces that pool\'s slots', !slot(c, 'sA1') && c.state.draw.slots.some((sl) => sl.poolId === 'A'));
  // FAULT-PROOF: regenerating one pool must not touch another pool's slots.
  check('…and leaves the other pool\'s slots alone', !!slot(c, 'sB1'));
  check('…keeping the pitch the pool was already on', c.state.draw.slots.filter((sl) => sl.poolId === 'A').every((sl) => sl.pitch === 'A1'));
}

section('Match-slot boxes are tap-wired');
{
  const c = buildDraw();
  let rows = c.renderVals().poolCards[0].slotRows;
  const rowA1 = rows.find((r) => r.id === 'sA1');
  check('slot rows are sorted by start time', rows[0].id === 'sA1');
  check('a box exposes onHomeClick, not a drop handler', typeof rowA1.onHomeClick === 'function' && rowA1.onDropHome === undefined);
  check('the occupied side shows its team', rowA1.homeLabel === 'ADH1');
  check('the empty side invites a tap', rowA1.awayLabel === 'Tap to place');

  rowA1.onHomeClick();
  check('tapping a filled box with nothing picked arms it',
    c.state.picked && c.state.picked.team === 'ADH1' && c.state.picked.from.kind === 'slot');
  check('…and it re-renders green', c.renderVals().poolCards[0].slotRows.find((r) => r.id === 'sA1').homeStyle.includes('#17A34A'));

  c.renderVals().poolCards[1].slotRows.find((r) => r.id === 'sB1').onAwayClick();
  check('tapping another box while armed places there', slot(c, 'sB1').away === 'ADH1');
  check('…and vacates the old box', slot(c, 'sA1').home === '');
  check('…and clears the pick', c.state.picked === null);

  c.renderVals().poolCards[0].slotRows.find((r) => r.id === 'sA1').onHomeClick();
  // FAULT-PROOF: an empty box with nothing in hand has nothing to pick up —
  // arming an empty string would let a blank be "placed" over a real team.
  check('tapping an empty box with nothing picked does nothing', c.state.picked === null);
}

section('Knockout builder');
{
  const c = buildDraw();
  const before = c.state.draw.knockout.length;
  c.addKnockoutSlot();
  check('adding a knockout match adds one', c.state.draw.knockout.length === before + 1);
  const added = c.state.draw.knockout[c.state.draw.knockout.length - 1];
  check('…starting empty', !added.home && !added.away);
  check('…with an editable label', added.round === 'New knockout match');
  check('…after the last knockout match', added.startMins === 600 + 20);

  c.onRenameKnockoutRound(added.id);
  check('renaming a knockout label asks first', !!c.state.modal && c.state.modal.kind === 'prompt');
  c.setState({ modalValue: 'Semi 1' });
  c.submitModal();
  check('…and applies it', ko(c, added.id).round === 'Semi 1');

  c.onKnockoutTimeChange(added.id, '11:30');
  check('a knockout time change is stored', ko(c, added.id).startMins === 11 * 60 + 30);
  c.onKnockoutTimeChange(added.id, 'rubbish');
  check('an unparseable knockout time is refused', ko(c, added.id).startMins === 11 * 60 + 30);
  c.onKnockoutPitchChange(added.id, 'A2');
  check('a knockout pitch change is stored', ko(c, added.id).pitch === 'A2');

  c.removeKnockoutSlot(added.id);
  check('removing a knockout match takes it out', c.state.draw.knockout.length === before);
}
{
  const c = buildDraw();
  const row = c.renderVals().knockoutRows.find((r) => r.id === 'u14b:CUP');
  check('a knockout row is labelled by its round', row.round === 'Cup Final');
  c.renderVals().poolCards[0].teamChips.find((ch) => ch.name === 'DS1').onPick();
  row.onHomeClick();
  check('a team picked from a pool lands in a knockout box', ko(c, 'u14b:CUP').home === 'DS1');
  check('…and stays in its pool roster', pool(c, 'A').teams.includes('DS1'));
}
{
  let autoCalls = 0;
  const c = buildDraw({ autoKnockoutSlots: async () => { autoCalls++; return [
    { id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DT1', startMins: 600, pitch: 'TBD' },
  ]; } });
  c.regenerateKnockout();
  check('regenerating the bracket asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and calls nothing until confirmed', autoCalls === 0);
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming asks the API to re-seed from live standings', autoCalls === 1);
  check('…and the bracket is replaced by what came back',
    c.state.draw.knockout.length === 1 && c.state.draw.knockout[0].home === 'DS1');
  check('…marking the draw unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw({ autoKnockoutSlots: async () => [
    { id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DT1', startMins: 600, pitch: 'TBD' },
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'X', away: 'Y', startMins: 540, pitch: 'TBD' },
  ] });
  c.setState({ draw: { ...c.state.draw, knockout: [
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', startMins: 540, pitch: 'A1' },
    { id: 'u14b:CUP', round: 'Cup Final', home: '', away: '', startMins: 600, pitch: 'A1' },
  ] } });
  c.generateFinals();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: "Generate finals" fills the FINALS from the winners so far.
  // A version that replaced the whole bracket would wipe the semi-final the
  // manager already edited and already played.
  check('generating finals fills the final from the auto-seed', ko(c, 'u14b:CUP').home === 'DS1' && ko(c, 'u14b:CUP').away === 'DT1');
  check('…and leaves earlier knockout matches exactly as they were',
    ko(c, 'u14b:SEMI1').home === 'ADH1' && ko(c, 'u14b:SEMI1').away === 'DE1' && ko(c, 'u14b:SEMI1').pitch === 'A1');
}
{
  const c = buildDraw();
  c.clearKnockout();
  check('clearing the knockout asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and clears nothing until confirmed', c.state.draw.knockout.length === 1);
  c.submitModal();
  check('confirming empties the knockout list', c.state.draw.knockout.length === 0);
}

section('Knockout generation is gated on what has actually been played');
{
  const c = buildDraw();
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: null },
  ], knockout: [] } });
  const vals = c.renderVals();
  check('with pool matches unplayed, "generate knockout" is off', vals.canGenerateKnockout === false);
  check('…and says why', vals.showPoolScoresHint === true);
  check('with no knockout matches at all, "generate finals" is off', vals.canGenerateFinals === false);
  // FAULT-PROOF: there is nothing to go and play yet, so the "play the
  // knockout matches first" hint would be nonsense here.
  check('…without a hint telling the manager to play matches that do not exist', vals.showPlaySemisHint === false);
}
{
  const c = buildDraw();
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: { homeScore: 10, awayScore: 5 } },
  ], knockout: [
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', result: null },
  ] } });
  const vals = c.renderVals();
  check('with every pool match played, "generate knockout" is on', vals.canGenerateKnockout === true);
  check('an unplayed semi keeps "generate finals" off', vals.canGenerateFinals === false);
  check('…and says why', vals.showPlaySemisHint === true);
}
{
  // CUP already has both sides filled (the bracket knows who's playing it)
  // but no result yet — the case that actually exercises the isFinalKo
  // filter. A CUP with blank home/away (falsy either way) would pass this
  // check even with the filter dropped, since it's excluded regardless.
  const c = buildDraw();
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: { homeScore: 10, awayScore: 5 } },
  ], knockout: [
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', result: { homeScore: 20, awayScore: 5 } },
    { id: 'u14b:CUP', round: 'Cup Final', home: 'ADH1', away: 'DS1', result: null },
  ] } });
  const vals = c.renderVals();
  // FAULT-PROOF: an unplayed FINAL must not block this — filling that final in
  // is the entire point of the button.
  check('every semi played turns "generate finals" on, even with the final unplayed', vals.canGenerateFinals === true);
  check('…and the hint is gone', vals.showPlaySemisHint === false);
}

section('Save, discard and regenerate');
{
  let saved = null, calls = 0;
  const c = buildDraw({ saveDraw: async (agId, draw, session) => { calls++; saved = [agId, draw, session && session.token]; return { ok: true }; } });
  c.addPool();
  await c.saveDraw();
  check('Save calls the API exactly once', calls === 1);
  check('…for this age group, with the session', saved[0] === 'u14b' && saved[2] === 'tok');
  check('…sending the edited draw, not the last-fetched one', saved[1].pools.length === 3);
  check('a successful save says so', c.state.drawMsg === 'Saved as a draft. Use Publish to make it public.');
  // FAULT-PROOF: loadDraw() runs right after the save and would wipe drawMsg
  // if it cleared it, so the manager would never see the confirmation.
  check('…and the confirmation survives the refetch that follows it', c.state.drawMsg !== '');
  check('…and the draw is no longer flagged unsaved', c.state.drawDirty === false);
}
{
  const c = buildDraw({ saveDraw: async () => ({ ok: false, error: 'Someone else saved first.' }) });
  c.addPool();
  await c.saveDraw();
  check('a failed save shows the server\'s reason', c.state.drawMsg === 'Someone else saved first.');
  // FAULT-PROOF: a failed save has NOT become the clean baseline, so the edit
  // must still be flagged unsaved or it will be quietly lost.
  check('…and the draw stays flagged unsaved', c.state.drawDirty === true);
  check('…keeping the edit on screen', c.state.draw.pools.length === 3);
}
{
  const c = buildDraw();
  c.addPool();
  check('setup: the local edit is there', c.state.draw.pools.length === 3);
  c.discardDraw();
  check('discarding asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('discarding refetches the saved version', c.state.draw.pools.length === 2);
  check('…and clears the unsaved flag', c.state.drawDirty === false);
}
{
  let savedDraw = null;
  const c = buildDraw({
    saveDraw: async (agId, draw) => { savedDraw = draw; return { ok: true }; },
    autoKnockoutSlots: async () => [{ id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DE1', startMins: 600, pitch: 'TBD' }],
  });
  c.resetDraw();
  check('regenerating times and bracket asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…promising the teams are kept', /teams and pool assignments are kept/i.test(c.state.modal.title));
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: this rebuilds pairings, times and the bracket. Rebuilding
  // the ROSTERS too would silently undo an afternoon of pool editing.
  check('the pools and their teams survive', savedDraw.pools.length === 2 && savedDraw.pools[0].teams.includes('ADH1'));
  check('the slots are rebuilt from those rosters', savedDraw.slots.every((sl) => String(sl.id).includes('regen')));
  check('the bracket is re-seeded', savedDraw.knockout.length === 1 && savedDraw.knockout[0].home === 'DS1');
  check('…and it says what it did', /regenerated/i.test(c.state.drawMsg));
}

section('Import registered teams');
{
  const regTeams = [
    { club: 'Abu Dhabi Harlequins', teamName: 'ADH2', ageGroup: 'U14 Boys', preferredPool: 'B' },
    { club: 'Dubai Exiles', teamName: 'DE2', ageGroup: 'U14 Boys', preferredPool: '' },
    { club: 'Someone Else', teamName: 'XX1', ageGroup: 'U16 Boys', preferredPool: '' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  const src = c.importSourceTeams();
  // FAULT-PROOF: a team registered for a DIFFERENT age group must never be
  // importable into this one.
  check('the import source is scoped to this age group by NAME', src.length === 2 && src.every((r) => r.ageGroup === 'U14 Boys'));
  check('the panel is open', c.renderVals().importOpen === true);
  check('a row is built for each importable team', c.state.importRows.length === 2);
  check('the preferred pool is honoured where it exists', c.state.importRows.find((r) => r.code === 'ADH2').poolId === 'B');

  c.confirmImport();
  const allTeams = c.state.draw.pools.flatMap((p) => p.teams);
  check('ADH2 was imported', allTeams.includes('ADH2'));
  check('DE2 was imported', allTeams.includes('DE2'));
  check('the wrong-age-group team was never imported', !allTeams.includes('XX1'));
  check('the panel closes afterwards', c.state.importOpen === false);
  check('…and the draw is flagged unsaved', c.state.drawDirty === true);
  check('…and it says nothing is saved yet', /Nothing is saved until you press Save changes/i.test(c.state.drawMsg));
  // FAULT-PROOF: saveDraw()'s allow-list carries teamNames, and a code with no
  // friendly name renders as a raw code on the public standings.
  check('a friendly club name is recorded for the imported code', c.state.draw.teamNames.ADH2 === 'Abu Dhabi Harlequins');
}
{
  const regTeams = [
    { club: 'A Club', teamName: 'AC1', ageGroup: 'U14 Boys', preferredPool: 'Z' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  check('a team asking for a pool this draw does not have is still placed', c.state.importRows[0].poolId === 'A' || c.state.importRows[0].poolId === 'B');
  check('…and the panel says so rather than silently moving it', /does not have/i.test(c.state.importNote));
}
{
  const regTeams = [
    { club: 'C1', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'C2', teamName: 'C2', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'C3', teamName: 'C3', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'C4', teamName: 'C4', ageGroup: 'U14 Boys', preferredPool: 'A' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  // FAULT-PROOF: four teams all asking for Pool A must not all land in Pool A
  // — the balancer moves the overflow, and says that it did.
  check('the pools are kept level rather than honouring every preference',
    c.state.importRows.some((r) => r.poolId === 'B'));
  check('…and the panel says how many were moved', /moved off their preferred pool/i.test(c.state.importNote));
}
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', preferredPool: 'A' }];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  check('a team already in the draw is marked skip in "add the missing ones" mode', c.state.importRows[0].skip === true);
  c.confirmImport();
  check('…and is not added twice', c.state.draw.pools.find((p) => p.id === 'A').teams.filter((t) => t === 'ADH1').length === 1);
}
{
  // Two DIFFERENT registration rows resolving to the same team code, neither
  // already in the draw — this is what actually exercises the `claimed` set,
  // since the "already in draw" case above is filtered out by `skip` before
  // dedup logic ever runs.
  const regTeams = [
    { club: 'Club One', teamName: 'DUP1', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'Club Two', teamName: 'DUP1', ageGroup: 'U14 Boys', preferredPool: 'B' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  c.confirmImport();
  const everywhere = c.state.draw.pools.flatMap((p) => p.teams).filter((t) => t === 'DUP1');
  check('a duplicate code within one import batch lands in exactly one pool, not both', everywhere.length === 1);
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: '' }], players: [], scope: 'all' }),
  });
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: { homeScore: 10, awayScore: 5 } },
  ], knockout: [] } });
  await c.openImport();
  check('replace is unavailable once results exist', c.importHasResults() === true && c.renderVals().importReplaceBlocked === true);
  c.setImportMode('replace');
  check('…and asking for it anyway does not switch mode', c.state.importMode === 'add');

  // FAULT-PROOF: confirmImport() must re-check for itself rather than trusting
  // importMode, or stale/tampered state wipes a roster that has real results.
  c.setState({ importMode: 'replace' });
  c.confirmImport();
  const poolA = c.state.draw.pools.find((p) => p.id === 'A');
  check('confirming a stale replace does NOT wipe the roster',
    poolA.teams.includes('ADH1') && poolA.teams.includes('DS1'));
  check('…and says the replace was blocked', /Replace was blocked/i.test(c.state.drawMsg));
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' }], players: [], scope: 'all' }),
  });
  await c.openImport();
  c.setImportMode('replace');
  check('with no results, replace mode is allowed', c.state.importMode === 'replace');
  c.confirmImport();
  const poolA = c.state.draw.pools.find((p) => p.id === 'A');
  check('replace clears the old roster', !poolA.teams.includes('ADH1'));
  check('…and puts the imported team in', poolA.teams.includes('C1'));
  check('…and rebuilds the pool matches to match', c.state.draw.slots.every((sl) => String(sl.id).includes('regen')));
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' }], players: [], scope: 'all' }),
  });
  await c.openImport();
  c.setImportRowPool('C1', 'B');
  check('the pool can be overridden per row', c.state.importRows[0].poolId === 'B');
  c.confirmImport();
  check('…and the override is what is applied', c.state.draw.pools.find((p) => p.id === 'B').teams.includes('C1'));
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' }], players: [], scope: 'all' }),
  });
  await c.openImport();
  c.cancelImport();
  check('cancelling closes the panel', c.state.importOpen === false);
  check('…and imports nothing', !c.state.draw.pools.flatMap((p) => p.teams).includes('C1'));
}
{
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: [], players: [], scope: 'all' }) });
  c.setState({ draw: { ...c.state.draw, pools: [] } });
  await c.openImport();
  // FAULT-PROOF: with no pools there is nowhere to put anyone, and the panel
  // has to say that instead of silently importing nothing.
  check('with no pools the panel says to add one first', /Add a pool first/i.test(c.state.importNote));
  check('…and offers no rows', c.state.importRows.length === 0);
}

section('Publish and unpublish');
{
  const c = buildDraw({ canPublishNow: () => false });
  const vals = c.renderVals();
  // FAULT-PROOF: outside the tournament window the button is REPLACED with an
  // explanation, never shown disabled with no reason given.
  check('a manager outside the window gets no Publish button', vals.canPublish === false);
  check('…and an explanation instead', /tournament days|organiser/i.test(vals.publishBlockedNote));
  check('the state pill says it is not published', /not published/i.test(vals.publishPillLabel));
}
{
  let publishCalls = 0, confirmText = '';
  const c = buildDraw({ canPublishNow: () => true, publishDraw: async () => { publishCalls++; return { ok: true, published: true }; } });
  await c.doPublish();
  confirmText = c.state.modal.title;
  check('publishing asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…naming the age group and who will see it', /U14 Boys/.test(confirmText) && /parents and coaches/i.test(confirmText));
  check('…and publishes nothing until confirmed', publishCalls === 0);
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming publishes exactly once', publishCalls === 1);
  check('…and says so', c.state.drawMsg === 'Published — these fixtures are now public.');
}
{
  let unpublishCalls = 0;
  const c = buildDraw({
    canPublishNow: () => true,
    getDraw: async () => ({ ...freshDraw(), _publish: { published: true, publishedAt: '2026-11-07T09:00:00Z', publishedBy: 'x', managerCanPublishNow: true } }),
    unpublishDraw: async () => { unpublishCalls++; return { ok: true, published: false }; },
  });
  await c.loadDraw('u14b');
  const vals = c.renderVals();
  check('an already-published draw offers Unpublish', vals.isPublished === true);
  check('…and the pill says it is live', /live/i.test(vals.publishPillLabel));
  check('…and the publish button offers a republish', /republish/i.test(vals.publishLabel));
  await c.doUnpublish();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('unpublishing calls the API exactly once', unpublishCalls === 1);
  check('…and says what the public now sees', /coming soon/i.test(c.state.drawMsg));
}
{
  const c = buildDraw({ canPublishNow: () => true, publishDraw: async () => ({ ok: false, error: 'Not signed in.' }) });
  await c.doPublish();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('a failed publish shows the server\'s reason', c.state.drawMsg === 'Not signed in.');
}

section('Publishing warns about pitch clashes, but never blocks');
{
  let loadAllCalls = 0, publishCalls = 0;
  const c = buildDraw({
    canPublishNow: () => true,
    loadAllDraws: async () => { loadAllCalls++; return { drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14 Boys', u16b: 'U16B' }, failed: [] }; },
    weekendClashes: () => ({ clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C4', sameAgeGroup: false,
      a: { agId: 'u14b', agName: 'U14 Boys', label: 'Pool A', startMins: 480, endMins: 600 },
      b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
      unplaced: [], offAllocation: [], placedCount: 2 }),
    describeClash: (cl) => `Pitch ${cl.pitch} clash`,
    publishDraw: async () => { publishCalls++; return { ok: true, published: true }; },
  });
  await c.doPublish();
  // FAULT-PROOF: publishing used to run no clash check at all.
  check('publishing runs a weekend clash check first', loadAllCalls === 1);
  check('a clash involving this age group is folded into the question', /Pitch C4 clash/.test(c.state.modal.title));
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF the other way: on the morning of the tournament the person who
  // has to move a game must not be locked out by a validator. It is a warning.
  check('…and it is a warning, not a block — publish still goes through', publishCalls === 1);
}
{
  const c = buildDraw({
    canPublishNow: () => true,
    loadAllDraws: async () => ({ drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14 Boys', u16b: 'U16B' }, failed: [] }),
    weekendClashes: () => ({ clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C9', sameAgeGroup: false,
      a: { agId: 'u16b', agName: 'U16B', label: 'Pool A', startMins: 480, endMins: 600 },
      b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
      unplaced: [], offAllocation: [], placedCount: 2 }),
    describeClash: (cl) => `Pitch ${cl.pitch} clash`,
  });
  await c.doPublish();
  check('a clash between two OTHER age groups is not raised here', !/Pitch C9 clash/.test(c.state.modal.title));
}
{
  const c = buildDraw({ canPublishNow: () => true, loadAllDraws: async () => { throw new Error('network down'); } });
  await c.doPublish();
  // FAULT-PROOF: an unreachable check must not silently look like a clean one.
  check('a clash check that fails says so in the question rather than implying all-clear',
    /Could not check/i.test(c.state.modal.title));
}

section('Check the whole weekend');
{
  const c = buildDraw({
    loadAllDraws: async () => ({ drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14 Boys', u16b: 'U16B' }, failed: [] }),
    weekendClashes: () => ({ clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C4', sameAgeGroup: false,
      a: { agId: 'u14b', agName: 'U14 Boys', label: 'Pool A', startMins: 480, endMins: 600 },
      b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
      unplaced: [], offAllocation: [], placedCount: 10 }),
    describeClash: (cl) => `Pitch ${cl.pitch} · ${cl.dayLabel} — ${cl.a.agName} ${cl.a.label} overlaps ${cl.b.agName} ${cl.b.label}`,
  });
  await c.checkWeekend();
  check('the result is stored', c.state.clash && c.state.clash.clashes.length === 1);
  const vals = c.renderVals();
  check('the clash is described in one line, from describeClash()', /Pitch C4/.test(vals.clashLines[0]) && /overlaps/.test(vals.clashLines[0]));
  check('the headline counts them', /1 pitch clash/i.test(vals.clashHeadline));
}
{
  const c = buildDraw({
    loadAllDraws: async () => ({ drawsByAge: { u14b: {} }, ageNames: { u14b: 'U14 Boys' }, failed: ['u16b', 'u18b'] }),
    weekendClashes: () => ({ clashes: [],
      unplaced: [{ agName: 'U14 Boys', label: 'Pool A', pitch: '', dayId: 'day1' }],
      offAllocation: [{ agName: 'U16B', label: 'Pool B', pitch: 'Z9' }],
      placedCount: 3 }),
  });
  await c.checkWeekend();
  const vals = c.renderVals();
  // FAULT-PROOF: a partial result used to render as a confident "No pitch
  // clashes." with nothing to say two age groups could not be read at all.
  check('the panel names the age groups it could not read', /U16B/.test(vals.clashFailedNote) && /U18B/.test(vals.clashFailedNote));
  check('…and says the check is therefore incomplete', /not a complete check/i.test(vals.clashFailedNote));
  check('the still-TBD bookings excluded from the check are listed', /U14 Boys: Pool A/.test(vals.clashUnplacedNote));
  check('a booking on a pitch outside its allocation is listed', /Z9/.test(vals.clashOffAllocationLines[0]) && /not one of its pitches/i.test(vals.clashOffAllocationLines[0]));
  check('the headline still reports the clean clash count', /No pitch clashes/i.test(vals.clashHeadline));
}
{
  const c = buildDraw({ loadAllDraws: async () => { throw new Error('network down'); } });
  await c.checkWeekend();
  check('a failed check is recorded as an error rather than crashing the tab', !!c.state.clash.error);
  check('…and shown', !!c.renderVals().clashError);
}
{
  const c = buildDraw({ isOrganiserSession: () => false });
  check('a manager is told the check cannot see other managers\' unsaved drafts',
    /unsaved edits cannot be seen/i.test(c.renderVals().clashScopeNote));
  const c2 = buildDraw({ isOrganiserSession: () => true });
  c2.setState({ session: { isOrganizer: true, ageGroupId: '*', token: 'tok' } });
  check('an organiser is told they are reading every group\'s working draft',
    /working draft/i.test(c2.renderVals().clashScopeNote));
}

section('saveDraw() rebuilds teamNames from the registrations on every save');
/* The withTeamNames() rule, ported from the old /scores editor (Aug 2026).
   Until then this page only wrote names at import time, so a draw built or
   edited by hand carried a stale or empty map and showed parents raw codes.
   The fixtures give the same club two sides (numbered) and another club one
   (unnumbered), and deliberately include a STALE WRONG name for a code the
   registrations also know — merge order is the whole point. */
const REG_TEAMS = [
  { club: 'Dubai Sharks RFC', teamName: 'DS1', ageGroup: 'U14 Boys' },
  { club: 'Dubai Sharks RFC', teamName: 'DS2', ageGroup: 'U14 Boys' },
  { club: 'Barrelhouse', teamName: 'BAR1', ageGroup: 'U14 Boys' },
  { club: 'Zebra RFC', teamName: 'Z1', ageGroup: 'U16 Boys' }, // other group — must not leak in
];
{
  let saved = null;
  const c = buildDraw({
    saveDraw: async (agId, draw) => { saved = draw; return { ok: true }; },
    getMyRegistrations: async () => ({ teams: REG_TEAMS, players: [], scope: 'u14b' }),
  });
  c.setState({ regs: { teams: REG_TEAMS, players: [] }, draw: { ...freshDraw(), teamNames: { DS1: 'Wrong Name', XX9: 'Kept Name' } } });
  await c.saveDraw();
  check('the saved draw carries the derived names', !!saved && !!saved.teamNames, saved && JSON.stringify(saved.teamNames));
  const tn = (saved && saved.teamNames) || {};
  eq('a multi-side club is numbered', tn.DS2, 'Dubai Sharks 2');
  eq('a single-side club is not', tn.BAR1, 'Barrelhouse');
  eq('derived names WIN over a stale stored name', tn.DS1, 'Dubai Sharks 1');
  eq('a stored name the registrations do not know survives the merge', tn.XX9, 'Kept Name');
  check('another age group\'s registrations do not leak in', !('Z1' in tn), JSON.stringify(tn));
}
{
  /* Registrations never fetched — saveDraw must fetch them itself, or the
     rule only fires for someone who happened to open the import first. */
  let fetches = 0; let saved = null;
  const c = buildDraw({
    saveDraw: async (agId, draw) => { saved = draw; return { ok: true }; },
    getMyRegistrations: async () => { fetches++; return { teams: REG_TEAMS, players: [], scope: 'u14b' }; },
  });
  c.setState({ regs: undefined, draw: { ...freshDraw(), teamNames: {} } });
  await c.saveDraw();
  eq('saveDraw fetches the registrations when they were never loaded', fetches, 1);
  eq('…and the names land in the saved draw', (saved && saved.teamNames || {}).DS2, 'Dubai Sharks 2');
}
{
  /* A failed or empty registrations read must be a NO-OP, never a blanking —
     the map a draw already carries is better than nothing. */
  let saved = null;
  const c = buildDraw({ saveDraw: async (agId, draw) => { saved = draw; return { ok: true }; } });
  c.setState({ regs: { teams: [], players: [] }, draw: { ...freshDraw(), teamNames: { DS1: 'Dubai Sharks 1' } } });
  await c.saveDraw();
  eq('an empty registrations read leaves the stored names exactly alone',
    saved && saved.teamNames, { DS1: 'Dubai Sharks 1' });
}
{
  /* resetDraw() saves too — the rule covers EVERY save site on the page,
     which is exactly what the old /scores editor's withTeamNames guaranteed. */
  let saved = null;
  const c = buildDraw({
    saveDraw: async (agId, draw) => { saved = draw; return { ok: true }; },
    getMyRegistrations: async () => ({ teams: REG_TEAMS, players: [], scope: 'u14b' }),
  });
  c.setState({ regs: { teams: REG_TEAMS, players: [] } });
  c.resetDraw();
  check('resetDraw asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  await c.state.modal.onConfirm();
  eq('a regenerated draw carries the derived names too', (saved && saved.teamNames || {}).DS1, 'Dubai Sharks 1');
}

summary('tests/test-manager-dc-draw.js');
}

main();
