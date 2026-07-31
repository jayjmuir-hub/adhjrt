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
    scoringFor: () => ['tries'],
    scoreLabel: (k) => k, scorePoints: () => 5, scoreTotal: () => 0,
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
  const win = { addEventListener(){}, matchMedia: () => ({ matches:false, addListener(){} }), scrollTo(){}, confirm: () => true };
  const fn = new AsyncFunction('document', 'window', 'importApi', 'confirm',
    src.replace("await import('/scores-data.js')", 'importApi')
       .replace('"use strict";', '"use strict";\nwindow.__test = {};') +
    '\nwindow.__test = { S, viewToday, viewFixtures, viewResults, viewTables, boot, load, openMatch, findMatch };');
  await fn(doc, win, fake, win.confirm);
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

  summary('test-manager-dashboard.js');
})();
