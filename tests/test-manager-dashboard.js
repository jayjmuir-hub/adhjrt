/* tests/test-manager-dashboard.js
   Proves Manager.html's age-group scoping and tab content against real
   injected faults — not just that the markup renders. Same
   extract-and-drive approach test-fixtures-results-sync.js uses for the
   .dc.html components, adapted for Manager.html's plain <script
   type="module"> (see Manager.html's own header comment for why it isn't
   a .dc.html component).

   DEVIATIONS FROM THE TASK-8 BRIEF'S DRAFT HARNESS, AND WHY:

   1. `new Function(...)` -> `AsyncFunction`. Manager.html's module script
      has a top-level `await api.loadVenue()` and a top-level
      `await import('/scores-data.js')`. Top-level await is legal in an ES
      module but NOT inside a body built with the plain `Function`
      constructor (SyntaxError: await is only valid in async function).
      The real module script also ends by calling `boot()` unawaited, so
      the harness has to build an ASYNC function (via
      `Object.getPrototypeOf(async function(){}).constructor`) and await
      the call, mirroring how a browser would await the module's own
      top-level await chain before running our appended test hooks.

   2. The real script calls `boot();` itself, once, at module-eval time
      (line "boot();" is the last line of the script). That means loading
      the module already runs one boot pass against whatever `currentSession()`
      the fake API returns. The test's own subsequent `await
      win.__test.boot()` call is what we rely on for the *awaited*,
      guaranteed-settled state — the auto-boot on load is fire-and-forget
      from the harness's point of view, so we don't depend on its timing.

   3. `window` needs `scrollTo` (used by `go()`) — kept from the brief.
      `document.querySelectorAll` needs to return a real array so
      `.forEach` (used by `buildTabs()` and `wire()`) doesn't throw — kept
      from the brief's stub, confirmed necessary by running against the
      real file.
*/
const { readRepo, section, check, summary } = require('./_lib');

function extractModuleScript(){
  const t = readRepo('Manager.html');
  const m = t.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script type="module"> found in Manager.html');
  return m[1];
}

function fakeApi(overrides){
  return Object.assign({
    loadVenue: async () => {},
    // u6 sorts first and is a festival group (hasStandings:false, like the
    // real config's u6) — deliberately, so the organiser-session fallback
    // test below actually exercises the hasStandings-aware fallback instead
    // of passing by accident because index 0 happened to be competitive.
    getAgeGroups: async () => [
      { id: 'u6', name: 'U6', hasStandings: false },
      { id: 'u14b', name: 'U14 Boys', hasStandings: true },
      { id: 'u16b', name: 'U16 Boys', hasStandings: true },
    ],
    login: async () => ({ ok: true }),
    currentSession: () => ({ ageGroupId: 'u14b', username: 'test-u14b', token: 'tok' }),
    logout: () => {},
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
    canScoreAgeGroup: (s, agId) => !s ? false : (s.isOrganizer || s.ageGroupId === '*' || s.ageGroupId === agId),
    getFixtures: async (agId) => ({ awaitingPublication: false, pool: [
      { id: `${agId}:A:1-2`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null },
      { id: `${agId}:A:3-4`, home: 'DS1', away: 'DT1', time: '09:20', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 15, awayScore: 10, homeTries: 3, awayTries: 2 } },
    ], knockout: [] }),
    getStandings: async () => ({ awaitingPublication: false, ageGroup: { hasStandings: true, name: 'U14 Boys' },
      pools: [{ id: 'A', name: 'Pool A' }], tables: { A: [{ team: 'DS1', P:1,W:1,D:0,L:0,PF:15,PA:10,pts:4 }] }, _advance: 1 }),
    getDraw: async (agId) => ({
      pools: [{ id: 'A', name: 'Pool A', teams: ['ADH1', 'DE1', 'DS1'] }],
      slots: [{ id: `${agId}:A:0`, poolId: 'A', home: 'ADH1', away: 'DE1', startMins: 480, pitch: 'A1' }],
      knockout: [],
      pitches: ['A1', 'A2'],
      _publish: { published: false, publishedAt: null, publishedBy: null, managerCanPublishNow: false },
    }),
    pitchesForAgeGroup: () => ['A1', 'A2'],
    minutesToDisplay: (m) => `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`,
    minutesToTimeInput: (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`,
    timeToMinutes: (hhmm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
      if (!m) return NaN;
      return Number(m[1]) * 60 + Number(m[2]);
    },
    slotLengthMins: () => 20,
    dayStartMins: () => 8 * 60,
    regeneratePoolSlots: (agId, poolId, teams) => (teams || []).slice(0, -1).map((t, i) => ({
      id: `${agId}:${poolId}:regen${i}`, poolId, home: t, away: teams[i+1] || '', startMins: 8*60 + i*20, pitch: 'TBD',
    })),
    autoKnockoutSlots: async () => [],
    saveDraw: async () => ({ ok: true }),
    resetDraw: async () => ({ ok: true }),
    getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }),
    canPublishNow: () => false,
    publishDraw: async () => ({ ok: true, published: true }),
    unpublishDraw: async () => ({ ok: true, published: false }),
    scoringFor: () => ['tries'],
    scoreLabel: (k) => k, scorePoints: () => 5, scoreTotal: () => 0,
    supportsSpiritAward: () => false,
    getSpiritAward: async () => ({ supported: false }),
    submitResult: async () => ({ ok: true, stored: { homeScore: 5, awayScore: 0 } }),
    clearResult: async () => ({ ok: true }),
    teamLabel: (c) => c, teamShort: (c) => c,
    loadScoringRules: async () => {},
  }, overrides || {});
}

// A minimal DOM stand-in — enough for the module's $()/innerHTML pattern to
// run without throwing, same spirit as test-fixtures-results-sync.js's
// window/document stubs.
function makeDom(){
  const store = {};
  return {
    getElementById: (id) => store[id] || (store[id] = { innerHTML:'', textContent:'', value:'', classList:{ add(){}, remove(){}, contains:()=>false }, style:{}, onclick:null, oninput:null, onchange:null }),
    addEventListener(){}, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/',
  };
}

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

// boot() -> renderDashboard() -> load(agId) is fire-and-forget in the real
// script (renderDashboard does not await load()), so the browser paints the
// "Loading…" state first and fills in fixtures/standings once the fetch
// resolves. A test that only awaits boot() therefore reads S.fixtures /
// S.standings while they're still null. Driving load() to completion
// ourselves (using the module's own load(), on the module's own S.ageId) is
// the equivalent of waiting for that fetch to land before reading the tab
// content — it does not touch or bypass any real logic.
async function bootAndLoad(win){
  await win.__test.boot();
  if (win.__test.S.session) await win.__test.load(win.__test.S.ageId);
}

async function loadWithApi(apiOverrides){
  const src = extractModuleScript();
  const fake = fakeApi(apiOverrides);
  const doc = makeDom();
  const win = { addEventListener(){}, matchMedia: () => ({ matches:false, addListener(){} }), scrollTo(){}, confirm: () => true, prompt: () => null };
  // Indirected through wrappers (rather than passing win.confirm/win.prompt's
  // value directly) so a test can reassign win.confirm / win.prompt AFTER
  // loadWithApi() returns and have the module's already-bound `confirm` /
  // `prompt` identifiers pick up the new behaviour — needed by the
  // MODERATE 6 tests (confirm) and the rename tests (prompt) below.
  const fn = new AsyncFunction('document', 'window', 'importApi', 'confirm', 'prompt',
    src.replace("await import('/scores-data.js')", 'importApi')
       .replace('"use strict";', '"use strict";\nwindow.__test = {};') +
    '\nwindow.__test = { S, viewToday, viewFixtures, viewResults, viewTables, viewDraw, boot, load, loadDraw, go, signOut, openMatch, findMatch, pickTeam, placeTeam, addPool, renamePool, removePool, addTeam, renameTeam, removeTeam, addSlot, removeSlot, regeneratePool, onSlotTimeChange, onSlotPitchChange, saveDraw, discardDraw, resetDraw, openImport, importSourceTeams, importHasResults, buildImportRows, confirmImport, setImportMode, setImportRowPool, cancelImport, loadRegistrations, viewRegistrations, addKnockoutSlot, removeKnockoutSlot, renameKnockoutRound, onKnockoutTimeChange, onKnockoutPitchChange, regenerateKnockout, generateFinals, clearKnockout, doPublish, doUnpublish, checkWeekend, runWeekendCheck, clashUnplacedSummary, refreshRegistrationSearch, doc: document };');
  await fn(doc, win, fake, (msg) => win.confirm(msg), (msg, def) => win.prompt(msg, def));
  return { doc, win };
}

(async () => {
  section('Age-group scoping');
  {
    const { win } = await loadWithApi({ currentSession: () => ({ ageGroupId: 'u14b', token: 't' }) });
    await win.__test.boot();
    check('a u14b manager\'s dashboard loads u14b, not another group', win.__test.S.ageId === 'u14b');
  }
  {
    const { win } = await loadWithApi({ currentSession: () => ({ ageGroupId: 'u16b', token: 't' }) });
    await win.__test.boot();
    check('a u16b manager\'s dashboard loads u16b', win.__test.S.ageId === 'u16b');
  }
  {
    // Organiser/admin path: boot() passes agId = null to renderDashboard()
    // whenever isOrganiserSession() is true, and renderDashboard() then
    // falls back to the first age group with hasStandings, mirroring
    // app.html's own `S.ageGroups.find(a => a.hasStandings) || S.ageGroups[0]`.
    // The fixture's getAgeGroups() returns u6 (hasStandings:false) first,
    // then u14b — so landing on u14b here only passes if the fallback
    // really is hasStandings-aware, not just "index 0", which would land an
    // organiser on the non-competitive u6 festival group with no switcher
    // to get back out.
    const { win } = await loadWithApi({
      currentSession: () => ({ isOrganizer: true, ageGroupId: '*', token: 't' }),
      isOrganiserSession: (s) => !!(s && s.isOrganizer),
    });
    await win.__test.boot();
    check('an organiser session falls back to the first COMPETITIVE age group, not the festival group at index 0',
      win.__test.S.ageId === 'u14b');
  }

  section('Live scoring rules loaded at boot');
  {
    // app.html loads live scoring rules at boot (app.html:1125-1126) so the
    // score form reflects any organiser customization instead of the
    // hardcoded defaults in scores-data.js. Manager.html's module script
    // does the same thing at the top level, right after loadVenue() —
    // proved here by checking the fake API's loadScoringRules was actually
    // invoked while the module loaded, not just that it exists.
    let calls = 0;
    await loadWithApi({ loadScoringRules: async () => { calls++; } });
    check('Manager.html calls api.loadScoringRules() during boot', calls === 1);
  }

  section('Today tab');
  {
    const { win } = await loadWithApi();
    await bootAndLoad(win);
    const html = win.__test.viewToday();
    check('shows the unplayed match as next up', html.includes('Next up') && html.includes('ADH1'));
  }

  section('Fixtures tab groups by pool');
  {
    const { win } = await loadWithApi();
    await bootAndLoad(win);
    const html = win.__test.viewFixtures();
    // NOTE: `html.includes('Pool A')` alone is not a real proof here —
    // matchRow() also renders m.poolName in its own .mmeta line, so that
    // substring survives even if the pool-h grouping heading is deleted.
    // Anchored on the actual pool-h markup so the check can only pass if
    // the grouping heading itself is really there.
    check('shows the pool heading', html.includes('<div class="pool-h">Pool A</div>'));
    check('shows both pool matches', (html.match(/mrow/g) || []).length === 2);
  }

  section('Results tab shows only played matches');
  {
    const { win } = await loadWithApi();
    await bootAndLoad(win);
    const html = win.__test.viewResults();
    // NOTE: `includes('15') && includes('10')` alone only proves both
    // numbers appear somewhere — it would still pass with home/away
    // swapped. matchRow() renders the score as
    // `${r.homeScore}&ndash;${r.awayScore}`, so anchor on that exact
    // ordered substring (homeScore=15, awayScore=10 in the fixture above).
    check('shows the played match score, home-away in the right order', html.includes('15&ndash;10'));
    check('does not show the unplayed match as a result row', !html.includes('09:00'));
  }

  section('Tables tab');
  {
    const { win } = await loadWithApi();
    await bootAndLoad(win);
    const html = win.__test.viewTables();
    check('shows the pool table', html.includes('Pool A') && html.includes('DS1'));
  }

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
  {
    // Fault-proof: confirmImport() must re-check importHasResults() itself,
    // not just trust S.importMode. Force S.importMode = 'replace' directly
    // (bypassing setImportMode's own gate) while results exist, and prove
    // the roster is NOT wiped.
    const { win } = await loadWithApi({
      getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: '' }], players: [], scope: 'all' }),
      getFixtures: async (agId) => ({ awaitingPublication: false,
        pool: [{ id: `${agId}:A:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 10, awayScore: 5 } }],
        knockout: [] }),
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.openImport();
    win.__test.buildImportRows('add');
    // Simulate stale/tampered state: importMode is 'replace' even though
    // setImportMode('replace') would have refused it, because results exist.
    win.__test.S.importMode = 'replace';
    win.__test.confirmImport();
    const poolA = win.__test.S.draw.pools.find((p) => p.id === 'A');
    check('confirmImport refuses a stale replace mode and does not wipe the roster', poolA.teams.includes('ADH1') && poolA.teams.includes('DE1') && poolA.teams.includes('DS1'));
  }

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
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addKnockoutSlot();
    win.__test.clearKnockout();
    check('clearKnockout empties the knockout list', win.__test.S.draw.knockout.length === 0);
  }

  section('Draw tab (Task 5 gap-fix: "Generate finals" gated on played semis)');
  {
    // No knockout matches at all: nothing to generate finals from, so the
    // button stays disabled and (matching the reference) no hint is shown
    // since there is nothing yet for the manager to go and play.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.S.fixtures.knockout = [];
    const html = win.__test.viewDraw();
    check('genFinalsBtn is disabled with no knockout matches at all',
      /id="genFinalsBtn"[^>]*disabled/.test(html));
    check('no "play the knockout matches" hint when there are no semis yet',
      !html.includes('Play the knockout matches first'));
  }
  {
    // A knockout semi-final exists but has no recorded result yet: the
    // button must stay disabled AND the explanatory hint must show.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.S.fixtures.knockout = [
      { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', result: null },
    ];
    const html = win.__test.viewDraw();
    check('genFinalsBtn is disabled while a semi-final is unplayed',
      /id="genFinalsBtn"[^>]*disabled/.test(html));
    check('the "play the knockout matches first" hint shows while unplayed',
      html.includes('Play the knockout matches first'));
  }
  {
    // Every non-final knockout match has a recorded result: the button must
    // be enabled and the hint must be gone. A FINAL-round match (Cup/Bowl/
    // Plate/Shield/Final) with no result must NOT block this — it's what
    // "Generate finals" is meant to fill in.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.S.fixtures.knockout = [
      { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', result: { homeScore: 20, awayScore: 5 } },
      { id: 'u14b:CUP', round: 'Cup Final', home: '', away: '', result: null },
    ];
    const html = win.__test.viewDraw();
    check('genFinalsBtn is enabled once every semi-final has a result',
      /id="genFinalsBtn"(?![^>]*disabled)/.test(html));
    check('the hint is gone once every semi-final has a result',
      !html.includes('Play the knockout matches first'));
  }

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

  section('Fix wave (MODERATE 5): clash checker renders failed/unplaced/offAllocation, not just clashes');
  {
    const { win } = await loadWithApi({
      loadAllDraws: async () => ({ drawsByAge: { u14b: {} }, ageNames: { u14b: 'U14B' }, failed: ['u16b', 'u18b'] }),
      weekendClashes: () => ({
        clashes: [],
        unplaced: [{ agName: 'U14B', label: 'Pool A', pitch: '', dayId: 'day1' }],
        offAllocation: [{ agName: 'U16B', label: 'Pool B', pitch: 'Z9' }],
        placedCount: 3,
      }),
      describeClash: (c) => 'unused',
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.checkWeekend();
    check('failed[] is captured in state', win.__test.S.clash.failed.length === 2);
    const html = win.__test.viewDraw();
    // FAULT-PROOF: before the fix, checkWeekend() captured failed/unplaced/
    // offAllocation on S.clash but the panel never read them, so a partial
    // result (two age groups unreadable) rendered as a confident "No pitch
    // clashes." with no hint anything was missing. These three checks fail
    // against the pre-fix render() and pass against the fixed one.
    check('the panel says which age groups could not be checked', html.includes('U16B') && html.includes('U18B') && /not.*complete/i.test(html));
    check('the panel shows the unplaced (still-TBD) booking', /excluded from this check.*U14B: Pool A/.test(html));
    check('the panel shows the off-allocation booking', html.includes('Z9') && html.includes('not one of its pitches'));
    check('a scope note about draft-vs-published visibility is shown', /published|draft/i.test(html));
  }

  section('Fix wave (MODERATE 6): doPublish() runs a clash check first and folds it into the confirm text');
  {
    let loadAllDrawsCalls = 0, confirmedText = '';
    const { win } = await loadWithApi({
      canPublishNow: () => true,
      loadAllDraws: async () => { loadAllDrawsCalls++; return { drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14B', u16b: 'U16B' }, failed: [] }; },
      weekendClashes: () => ({
        clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C4', sameAgeGroup: false,
          a: { agId: 'u14b', agName: 'U14B', label: 'Pool A', startMins: 480, endMins: 600 },
          b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
        unplaced: [], offAllocation: [], placedCount: 2,
      }),
      describeClash: (c) => `Pitch ${c.pitch} clash`,
      publishDraw: async () => ({ ok: true, published: true }),
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.confirm = (text) => { confirmedText = text; return true; };
    await win.__test.doPublish();
    // FAULT-PROOF: before the fix, doPublish() never called loadAllDraws at
    // all — publishing performed no clash check whatsoever.
    check('doPublish() runs a weekend clash check before publishing', loadAllDrawsCalls === 1);
    check('a clash involving this age group is folded into the confirm text', confirmedText.includes('Pitch C4 clash') && confirmedText.includes('U14 Boys'));
    check('the confirm is a warning, not a block — Publish still proceeds', win.__test.S.drawMsg === 'Published — these fixtures are now public.');
  }
  {
    // Fault-proof the other way: no clash involving THIS age group must not
    // show a warning, even if the weekend check found one elsewhere.
    let confirmedText = '';
    const { win } = await loadWithApi({
      canPublishNow: () => true,
      loadAllDraws: async () => ({ drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14B', u16b: 'U16B' }, failed: [] }),
      weekendClashes: () => ({
        clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C9', sameAgeGroup: false,
          a: { agId: 'u16b', agName: 'U16B', label: 'Pool A', startMins: 480, endMins: 600 },
          b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
        unplaced: [], offAllocation: [], placedCount: 2,
      }),
      describeClash: (c) => `Pitch ${c.pitch} clash`,
      publishDraw: async () => ({ ok: true, published: true }),
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.confirm = (text) => { confirmedText = text; return true; };
    await win.__test.doPublish();
    check('a clash involving a DIFFERENT age group only is not folded in as a warning', !confirmedText.includes('Pitch C9 clash'));
  }

  section('Fix wave (MAJOR 3 / MODERATE 7 / MINOR 8): clearDrawTransientState() clears stale S.picked/S.clash/S.drawMsg/S.importRows');
  {
    // MAJOR 3: a team picked from a pool must not survive that pool's own deletion.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    check('DS1 is picked before the pool is deleted', win.__test.S.picked && win.__test.S.picked.team === 'DS1');
    win.__test.removePool('A');
    // FAULT-PROOF: before the fix, S.picked survived removePool() untouched,
    // so DS1 could be silently placed back into a different pool afterwards.
    check('removePool() clears a picked team that belonged to the deleted pool', win.__test.S.picked === null);
  }
  {
    // MAJOR 3: renaming a picked team must not leave S.picked pointing at the OLD name.
    const { win } = await loadWithApi();
    win.prompt = () => 'DSX';
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    win.__test.renameTeam('A', 'DS1');
    // FAULT-PROOF: before the fix, S.picked.team still said "DS1" after the
    // rename, so placing it afterwards would resurrect the pre-rename name
    // alongside the renamed team.
    check('renameTeam() clears a picked team that was the one renamed', win.__test.S.picked === null);
    check('the team really was renamed to DSX', win.__test.S.draw.pools[0].teams.includes('DSX') && !win.__test.S.draw.pools[0].teams.includes('DS1'));
  }
  {
    // MAJOR 3: removing a team must clear a pick of that exact team.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    win.__test.removeTeam('A', 'DS1');
    check('removeTeam() clears a picked team that was removed', win.__test.S.picked === null);
  }
  {
    // MODERATE 7: the picked slotbox actually gets the CSS class the new rule targets.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.pickTeam('ADH1', { kind: 'slot', slotId: win.__test.S.draw.slots[0].id, side: 'home' });
    const html = win.__test.viewDraw();
    check('a picked match-slot box carries class="slotbox picked"', /class="slotbox picked"/.test(html));
    // Fault-proof: the stylesheet must actually define .slotbox.picked, or
    // the class alone does nothing visible.
    const styleBlock = require('./_lib').readRepo('Manager.html');
    check('the stylesheet defines a .slotbox.picked rule', /\.slotbox\.picked\s*\{/.test(styleBlock));
  }
  {
    // MINOR 8 / MAJOR 3: S.clash, S.drawMsg and S.importRows must not
    // survive load() (the re-login / score-save reset path).
    const { win } = await loadWithApi({
      loadAllDraws: async () => ({ drawsByAge: {}, ageNames: {}, failed: [] }),
      weekendClashes: () => ({ clashes: [], unplaced: [], offAllocation: [], placedCount: 0 }),
    });
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    await win.__test.checkWeekend();
    win.__test.S.drawMsg = 'Saved as a draft. Use Publish to make it public.';
    win.__test.S.importRows = [{ code: 'X', name: 'X1' }];
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    check('clash/drawMsg/importRows/picked are all set before load()',
      !!win.__test.S.clash && !!win.__test.S.drawMsg && !!win.__test.S.importRows && !!win.__test.S.picked);
    await win.__test.load(win.__test.S.ageId);
    // FAULT-PROOF: before the fix, load() cleared S.draw/S.regs/S.spiritAward
    // but left S.picked/S.clash/S.drawMsg/S.importRows untouched, so a stale
    // clash result or "Saved as a draft" banner reappeared on the next visit
    // to the Draw tab.
    check('load() clears S.picked', win.__test.S.picked === null);
    check('load() clears S.clash', win.__test.S.clash === null);
    check('load() clears S.drawMsg', win.__test.S.drawMsg === '');
    check('load() clears S.importRows', win.__test.S.importRows === null);
  }
  {
    // MINOR 8: the same transient state must not survive signOut() either
    // (the shared-device scenario: manager B signs in after manager A).
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
    win.__test.S.drawMsg = 'Saved as a draft. Use Publish to make it public.';
    win.__test.signOut();
    check('signOut() clears S.picked', win.__test.S.picked === null);
    check('signOut() clears S.drawMsg', win.__test.S.drawMsg === '');
  }

  section('Fix wave (MODERATE 4): unsaved Draw edits survive a score save elsewhere on the same age group');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    check('S.drawDirty starts false on a freshly loaded draw', win.__test.S.drawDirty === false);
    win.__test.addPool();
    check('a Draw-tab mutation sets S.drawDirty', win.__test.S.drawDirty === true);
    const poolCountBeforeLoad = win.__test.S.draw.pools.length;
    // Simulate what happens after a score save elsewhere: the module calls
    // load(S.ageId) itself. Drive it the same way.
    await win.__test.load(win.__test.S.ageId);
    // FAULT-PROOF: before the fix, load() unconditionally reset S.draw to
    // undefined here, silently destroying the unsaved extra pool with no
    // warning.
    check('load() does NOT wipe S.draw while dirty', win.__test.S.draw !== undefined && win.__test.S.draw.pools.length === poolCountBeforeLoad);
    const html = win.__test.viewDraw();
    check('an "unsaved changes" indicator is shown while dirty', /unsaved changes/i.test(html));
  }
  {
    // The dirty flag must clear once the draft is actually saved (or
    // discarded / reset), so the indicator does not linger forever.
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addPool();
    check('dirty before save', win.__test.S.drawDirty === true);
    await win.__test.saveDraw();
    check('a successful save clears S.drawDirty', win.__test.S.drawDirty === false);
  }
  {
    // And discardDraw() must also clear it (it reloads from the server).
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addPool();
    await win.__test.discardDraw();
    check('discardDraw() clears S.drawDirty', win.__test.S.drawDirty === false);
  }

  section('Fix wave (MINOR 9): knockout time input is no longer clipped');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addKnockoutSlot();
    const html = win.__test.viewDraw();
    // FAULT-PROOF: before the fix this was width:100px, which clipped times
    // like "01:0" — genuinely ambiguous between 1am and 1pm on the finals rows.
    check('the knockout time input is at least 110px wide, matching the pool slot inputs',
      /data-ko-time="[^"]*"\s+style="width:1(1[0-9]|[2-9][0-9])px/.test(html));
  }

  section('Fix wave (MAJOR 2): reflow classnames present on slot and knockout rows for the phone media query');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    win.__test.go('draw');
    await new Promise((r) => setTimeout(r, 0));
    win.__test.addKnockoutSlot();
    const html = win.__test.viewDraw();
    check('pool slot rows carry the reflow classnames the @media(max-width:560px) rule targets',
      html.includes('class="slottime"') || /input[^>]*class="slottime"/.test(html));
    check('pool slot select/delete/separator carry their reflow classnames',
      /class="slotpitch"/.test(html) && /slotdel/.test(html) && /slotsep/.test(html));
    check('knockout rows carry the same reflow classnames plus slotlabel',
      /slotlabel/.test(html));
    const styleBlock = require('./_lib').readRepo('Manager.html');
    check('a @media(max-width:560px) rule reflows .slotrow', /@media\(max-width:560px\)\{[\s\S]*?\.slotrow/.test(styleBlock));
  }

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
  {
    // Fault-proof: the running Spirit Award tally card only appears on the
    // Fixtures tab once load() has fetched it for a supporting age group.
    const { win } = await loadWithApi({
      supportsSpiritAward: () => true,
      getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 1, complete: false, tally: [{ name: 'Sam Jones', count: 1, team: 'ADH1' }], winners: [] }),
    });
    await win.__test.boot();
    await win.__test.load(win.__test.S.ageId);
    const html = win.__test.viewFixtures();
    check('the Fixtures tab shows the Spirit of Rugby Award tally', html.includes('Spirit of Rugby Award') && html.includes('Sam Jones'));
  }

  section('Fix wave (MAJOR 1): Registrations search box does not lose state on every keystroke');
  {
    const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14B Contact', headCoachName: 'Coach A', headCoachMobile: '0500000001', managerName: 'Mgr A', managerMobile: '0500000002', players: '[]' }];
    const regPlayers = [
      { playerName: 'Ethan Smith', dob: '2013-01-01', club: 'ADH', ageGroup: 'U14B Contact', parentName: 'P Smith', parentMobile: '0500000003', emergencyContact: 'E', emergencyMobile: '0500000004', medicalNotes: '', consent: 'Yes' },
      { playerName: 'Olivia Brown', dob: '2013-03-03', club: 'ADH', ageGroup: 'U14B Contact', parentName: 'P Brown', parentMobile: '0500000005', emergencyContact: 'E', emergencyMobile: '0500000006', medicalNotes: '', consent: 'Yes' },
    ];
    const { win } = await loadWithApi({ getMyRegistrations: async () => ({ teams: regTeams, players: regPlayers, scope: '' }) });
    await win.__test.boot();
    win.__test.go('registrations');
    await new Promise((r) => setTimeout(r, 0));

    // The DOM stub keeps returning the SAME stored element object for a
    // given id (see makeDom() above), so it can't reproduce the real bug
    // (the browser destroying and recreating the <input> node on every
    // keystroke). What it CAN prove, without inferring anything about the
    // DOM: that the oninput handler's own state-management logic is
    // correct across repeated calls — S.regSearch accumulates the typed
    // value rather than resetting or dropping characters — and that the
    // handler updates the filtered list in place via refreshRegistrationSearch()
    // rather than depending on a full render() (which is what actually
    // destroyed the input in the real bug).
    const input = win.__test.doc.getElementById('regSearchInput');
    check('regSearchInput exists and has an oninput handler wired', typeof input.oninput === 'function');

    input.value = 'E'; input.oninput();
    check('S.regSearch after the first keystroke', win.__test.S.regSearch === 'E');
    input.value = 'Et'; input.oninput();
    check('S.regSearch accumulates the second keystroke rather than resetting', win.__test.S.regSearch === 'Et');
    input.value = 'Eth'; input.oninput();
    input.value = 'Etha'; input.oninput();
    input.value = 'Ethan'; input.oninput();
    check('S.regSearch has the full typed string after five keystrokes', win.__test.S.regSearch === 'Ethan');

    // FAULT-PROOF: the filtered players list must reflect the fully-typed
    // search text (proving refreshRegistrationSearch() actually re-filters
    // on every keystroke, using S.regSearch as it accumulates) — not just
    // the first character, which is the visible symptom of the original bug
    // (only "E" ever landing before focus was lost).
    const playersEl = win.__test.doc.getElementById('regPlayersList');
    check('the filtered list matches "Ethan" and excludes "Olivia"', playersEl.innerHTML.includes('Ethan Smith') && !playersEl.innerHTML.includes('Olivia Brown'));

    // Clearing the box must restore both rows — proves the filter is
    // recomputed from S.regs each time, not a one-way narrowing.
    input.value = ''; input.oninput();
    check('clearing the search box restores both players', playersEl.innerHTML.includes('Ethan Smith') && playersEl.innerHTML.includes('Olivia Brown'));
  }

  summary('test-manager-dashboard.js');
})();
