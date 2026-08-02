/* tests/test-manager-dc.js
   ------------------------------------------------------------------------
   Parity tests for Manager.dc.html — the rebuild of Manager.html onto the
   .dc.html component engine. The OLD file and its tests
   (tests/test-manager-dashboard.js) stay in place and keep passing until the
   rollout task; these prove the NEW file behaves the same.

   Harness: the .dc.html pattern (a DCLogic stand-in, regex the
   <script type="text/x-dc"> block out, eval it, instantiate Component) —
   the same one tests/test-scores-draw-editor.js and
   tests/test-fixtures-results-sync.js use. Deliberately duplicated per test
   file, matching this project's established convention.
*/
/* PARITY MATRIX — tests/test-manager-dashboard.js (old file) → this rebuild
   ------------------------------------------------------------------------
   Every behaviour the old dashboard's tests proved, and where the same
   behaviour is proven against Manager.dc.html. Written down because the old
   file is deleted with Manager.html in the rollout task, and after that this
   comment is the only record that the swap was not a leap of faith.

     Age-group scoping (u14b, u16b, organiser fallback)      -> test-manager-dc.js, "Boot and age-group scoping"
     Live scoring rules loaded at boot                       -> test-manager-dc.js, "Parity gap-fills" (source check; componentDidMount does a dynamic import that cannot be driven in Node)
     Today tab                                                -> test-manager-dc.js, "Today tab"
     Fixtures tab groups by pool                              -> test-manager-dc.js, "Fixtures & scoring tab"
     Results tab shows only played matches                    -> test-manager-dc.js, "Results tab"
     Tables tab                                                -> test-manager-dc.js, "Tables tab"
     Draw tab (Task 1: read-only shell)                        -> test-manager-dc-draw.js, "loadDraw(): fetching, loading state, and the empty state"
     Draw tab (Task 2: tap-to-select editor)                   -> test-manager-dc-draw.js, "pickTeam()", "placeTeam()", "Pool CRUD", "Team CRUD"
     Draw tab (Task 3: slot editor + save/discard/reset)       -> test-manager-dc-draw.js, "Match-slot editor", "Save, discard and regenerate"
     Draw tab (Task 4: import registered teams)                -> test-manager-dc-draw.js, "Import registered teams"
     Draw tab (Task 5: knockout builder)                       -> test-manager-dc-draw.js, "Knockout builder"
     Draw tab (Task 5 gap-fix: finals gating)                  -> test-manager-dc-draw.js, "Knockout generation is gated on what has actually been played"
     Draw tab (Task 6: publish / unpublish gating)             -> test-manager-dc-draw.js, "Publish and unpublish"
     Draw tab (Task 7: clash checker)                          -> test-manager-dc-draw.js, "Check the whole weekend"
     MODERATE 5: clash panel renders failed/unplaced/offAllocation -> test-manager-dc-draw.js, "Check the whole weekend" (second block)
     MODERATE 6: publish runs a clash check first              -> test-manager-dc-draw.js, "Publishing warns about pitch clashes, but never blocks"
     MAJOR 3 / MODERATE 7 / MINOR 8: stale picked/clash/drawMsg/importRows -> test-manager-dc-draw.js, "Pool CRUD", "Team CRUD", "Transient Draw state does not outlive what it referred to"
     MODERATE 4: unsaved Draw edits survive a score save        -> test-manager-dc-draw.js, "Transient Draw state…" (last block)
     MINOR 9: knockout time input width                        -> No longer applicable — see below
     MAJOR 2: reflow classnames for the phone media query       -> No longer applicable — see below
     Registrations tab                                          -> test-manager-dc.js, "Registrations tab"
     Score sheet: Spirit + Cards                                -> test-manager-dc-score-sheet.js, "The payload sent to submitResult()"
     Score sheet: spirit tally on Fixtures                       -> test-manager-dc.js, "Spirit of Rugby Award tally on the Fixtures tab"
     MAJOR 1: Registrations search keeps its state               -> test-manager-dc.js, "Registrations tab" (search block)

   TWO OLD ASSERTIONS ARE RESTATED RATHER THAN PORTED, both about
   Manager.html's hand-written stylesheet:
     MINOR 9 (knockout time input width)  -> source check, "Parity gap-fills"
     MAJOR 2 (media-query reflow classes) -> source check, "Parity gap-fills"

   ONE BEHAVIOUR DELIBERATELY DIFFERS, and is not a parity failure:
     Manager.html's placeTeam() removed a team from its pool roster when it
     was placed into a match slot or knockout box. pools[].teams is pool
     MEMBERSHIP — computeStandings() reads it directly — so that made teams
     disappear from the public standings. Manager.dc.html keeps the roster,
     matching the corrected behaviour shipped in Scores & Standings.dc.html.
     See tests/test-manager-dc-draw.js, "placeTeam(): moves, and the dedup rule".
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

/* The same fake API surface tests/test-manager-dashboard.js uses against the
   OLD file, so a parity check compares like with like. u6 sorts first and is
   a festival group (hasStandings:false) so the organiser fallback test really
   exercises the hasStandings-aware branch. */
function fakeApi(overrides) {
  return Object.assign({
    loadVenue: async () => {},
    loadScoringRules: async () => {},
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
      knockout: [], pitches: ['A1', 'A2'],
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
    getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }),
    canPublishNow: () => false,
    publishDraw: async () => ({ ok: true, published: true }),
    unpublishDraw: async () => ({ ok: true, published: false }),
    loadAllDraws: async () => ({ drawsByAge: {}, ageNames: {}, failed: [] }),
    weekendClashes: () => ({ clashes: [], unplaced: [], offAllocation: [], placedCount: 0 }),
    describeClash: () => '',
    scoringFor: () => ['tries'],
    scoreLabel: (k) => k, scorePoints: () => 5, scoreTotal: () => 0,
    supportsSpiritAward: () => false,
    getSpiritAward: async () => ({ supported: false }),
    submitResult: async () => ({ ok: true, stored: { homeScore: 5, awayScore: 0 } }),
    clearResult: async () => ({ ok: true }),
    teamLabel: (c) => c, teamShort: (c) => c,
  }, overrides || {});
}

/* componentDidMount() does a dynamic import() of scores-data.js, which a Node
   test cannot resolve — so the api is injected directly, exactly the way
   tests/test-scores-draw-editor.js injects state.api, and boot() (which is
   what componentDidMount calls once the import lands) is driven by hand. */
function buildManager(apiOverrides) {
  const c = build('Manager.dc.html');
  c.state = { ...c.state, api: fakeApi(apiOverrides) };
  return c;
}

async function main() {

section('Boot and age-group scoping');
{
  const c = buildManager({ currentSession: () => ({ ageGroupId: 'u14b', token: 't' }) });
  const landed = await c.boot();
  check('a u14b manager\'s dashboard loads u14b, not another group', c.state.ageId === 'u14b');
  check('boot() reports that it landed on the dashboard', landed === true);
  check('the session is stored in state', !!c.state.session);
}
{
  const c = buildManager({ currentSession: () => ({ ageGroupId: 'u16b', token: 't' }) });
  await c.boot();
  check('a u16b manager\'s dashboard loads u16b', c.state.ageId === 'u16b');
}
{
  // The fixture's getAgeGroups() returns u6 (hasStandings:false) FIRST, so
  // landing on u14b only passes if the fallback is hasStandings-aware rather
  // than "index 0" — an organiser stuck on a non-competitive festival group
  // has no age-group switcher to escape with.
  const c = buildManager({
    currentSession: () => ({ isOrganizer: true, ageGroupId: '*', token: 't' }),
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
  });
  await c.boot();
  check('an organiser session falls back to the first COMPETITIVE age group, not the festival group at index 0',
    c.state.ageId === 'u14b');
}
{
  // A session whose age group is no longer in the live config must be signed
  // out, not shown a dashboard for a group that isn't there.
  let loggedOut = 0;
  const c = buildManager({
    currentSession: () => ({ ageGroupId: 'u99', token: 't' }),
    logout: () => { loggedOut++; },
  });
  const landed = await c.boot();
  check('an unknown age group signs the session out', loggedOut === 1);
  check('…and leaves no session in state', c.state.session === null);
  check('…and boot() reports it did NOT land on the dashboard', landed === false);
  check('…and says why, in the toast', /age group is not set up/i.test(c.state.toast));
}
{
  const c = buildManager({ currentSession: () => null });
  const gone = [];
  c.redirect = (url) => gone.push(url);
  const landed = await c.boot();
  check('no session at all redirects to the unified sign-in page, carrying next',
    landed === false && c.state.session === null && gone.length === 1 && gone[0] === '/signin?next=/manager',
    JSON.stringify(gone));
}

section('Sign-in lives on /signin — this page only redirects and signs out');
/* Aug 2026 (claude/specs/spec-unified-login.md): the login card, doLogin()
   and their bindings are gone. The signed-out shell links to /signin, boot()
   redirects there (asserted above), and doLogout() clears the unified
   session then hands over to the sign-in page. */
{
  const src = readRepo('Manager.dc.html');
  check('the signed-out shell links to /signin with next=/manager',
    /href="\/signin\?next=\/manager"/.test(src));
  check('no password field or login form remains on this page',
    !/loginPass/.test(src) && !/doLogin/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));

  let loggedOut = 0; const gone = [];
  const c = buildManager({ currentSession: () => ({ ageGroupId: 'u14b', token: 't' }), logout: () => { loggedOut++; } });
  await c.boot();
  c.redirect = (url) => gone.push(url);
  c.doLogout();
  check('sign-out clears the session through the data layer', loggedOut === 1);
  check('…leaves no session in state', c.state.session === null);
  check('…and hands over to /signin', gone.length === 1 && gone[0] === '/signin?next=/manager', JSON.stringify(gone));
}

section('Tab bar');
{
  const c = buildManager();
  await c.boot();
  const vals = c.renderVals();
  check('all six tabs are offered', eq('tab ids', vals.tabs.map((t) => t.id),
    ['today', 'fixtures', 'results', 'tables', 'draw', 'registrations']));
  check('their labels match the old dashboard', eq('tab labels', vals.tabs.map((t) => t.label),
    ['Today', 'Fixtures & scoring', 'Results', 'Tables', 'Draw', 'Registrations']));
  check('Today is the tab you land on', vals.isToday === true);
  check('the selected tab uses Organizer\'s red pill style',
    vals.tabs[0].style.includes('background:#E11B22;color:#fff;'));
  check('an unselected tab uses Organizer\'s transparent style',
    vals.tabs[1].style.includes('background:transparent;color:#454D58;'));

  vals.tabs[3].onPick();
  const vals2 = c.renderVals();
  check('tapping a tab switches to it', c.state.tab === 'tables' && vals2.isTables === true);
  check('…and only that tab is active', vals2.isToday === false && vals2.isFixtures === false
    && vals2.isResults === false && vals2.isDraw === false && vals2.isRegistrations === false);
}

section('Sign out');
{
  const c = buildManager();
  await c.boot();
  c.go('tables');
  let loggedOut = 0;
  c.state.api.logout = () => { loggedOut++; };
  c.doLogout();
  check('sign out calls api.logout()', loggedOut === 1);
  check('…drops the session', c.state.session === null);
  check('…drops the loaded fixtures and standings', c.state.fixtures === null && c.state.standings === null);
  check('…and returns to the Today tab for the next person on this device', c.state.tab === 'today');
  /* No "Signed out" toast any more — sign-out hands straight over to
     /signin (asserted in the section above), and a toast on a page being
     left is a message nobody reads. */
}

section('In-app confirm/prompt modal (window.confirm is blocked in the DC preview iframe)');
{
  const c = buildManager();
  await c.boot();
  let confirmed = 0;
  c.confirmModal('Really?', () => { confirmed++; });
  check('confirmModal opens a confirm-kind modal', c.state.modal && c.state.modal.kind === 'confirm');
  check('…carrying the message', c.renderVals().modalTitle === 'Really?');
  c.submitModal();
  check('confirming runs the callback', confirmed === 1);
  check('…and closes the modal', c.state.modal === null);

  let confirmed2 = 0;
  c.confirmModal('Really?', () => { confirmed2++; });
  c.closeModal();
  check('cancelling does NOT run the callback', confirmed2 === 0 && c.state.modal === null);

  let got = null;
  c.promptModal('Rename pool', 'Pool A', (v) => { got = v; });
  check('promptModal seeds the input with the current value', c.state.modalValue === 'Pool A');
  c.setState({ modalValue: '  Pool Z  ' });
  c.submitModal();
  check('the prompt result is trimmed', got === 'Pool Z');

  let got2 = 'untouched';
  c.promptModal('Rename pool', 'Pool A', (v) => { got2 = v; });
  c.setState({ modalValue: '   ' });
  c.submitModal();
  check('a blank prompt answer does not call back at all', got2 === 'untouched');
}

section('Today tab');
{
  const c = buildManager();
  await c.boot();
  const vals = c.renderVals();
  check('the next unplayed match is offered first', vals.todayHasNext === true && vals.todayNextRows.length === 1);
  check('…and it is the unplayed one, not the scored one', vals.todayNextRows[0].id === 'u14b:A:1-2');
  check('…named by team, time and pitch', vals.todayNextRows[0].teams === 'ADH1 v DE1'
    && vals.todayNextRows[0].time === '09:00' && vals.todayNextRows[0].pitch === 'A1');
  check('the scored match shows under recent results', vals.todayHasRecent === true
    && vals.todayRecentRows.length === 1 && vals.todayRecentRows[0].id === 'u14b:A:3-4');
  // FAULT-PROOF: `includes('15') && includes('10')` would pass with the sides
  // swapped. The score string is ordered home-then-away.
  check('…with the score home-then-away', vals.todayRecentRows[0].score === '15–10');
  check('a row knows how to open the score sheet', typeof vals.todayNextRows[0].onOpen === 'function');
  vals.todayNextRows[0].onOpen();
  check('…and does open it on that match', c.state.sheetMatchId === 'u14b:A:1-2');
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false, pool: [
    { id: `${agId}:A:1-2`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 5, awayScore: 0 } },
  ], knockout: [] }) });
  await c.boot();
  const vals = c.renderVals();
  check('with everything played there is no "next up"', vals.todayHasNext === false && vals.todayNextRows.length === 0);
  check('…and the recent list still has the played match', vals.todayHasRecent === true);
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: true, pool: [], knockout: [] }) });
  await c.boot();
  const vals = c.renderVals();
  check('an unpublished draw shows the coming-soon state, not an empty list', vals.todayAwaiting === true);
  check('…naming the age group', /U14 Boys/.test(vals.comingSoonBlurb));
  check('…and offers no rows at all', vals.todayHasNext === false && vals.todayHasRecent === false);
}
{
  const c = buildManager();
  c.setState({ ageId: 'u14b', ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }], session: { ageGroupId: 'u14b', token: 't' } });
  check('before the fetch lands, the tab says it is loading', c.renderVals().todayLoading === true);
}
{
  // A knockout slot with neither team decided is not a fixture anybody can
  // play, so it must not be offered as "next up".
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [{ id: `${agId}:A:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 5, awayScore: 0 } }],
    knockout: [{ id: `${agId}:CUP`, round: 'Cup Final', home: '', away: '', time: '13:00', pitch: 'A1', result: null }] }) });
  await c.boot();
  check('an undecided knockout slot is not offered as the next match', c.renderVals().todayHasNext === false);
}

section('Fixtures & scoring tab');
{
  const c = buildManager();
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('matches are grouped under their pool', vals.poolGroups.length === 1 && vals.poolGroups[0].name === 'Pool A');
  // FAULT-PROOF: a flat list would still show both matches. This asserts the
  // GROUPING, which is the thing the tab exists to do.
  check('…with both of that pool\'s matches inside the group', vals.poolGroups[0].rows.length === 2);
  check('the rows carry team names and times', vals.poolGroups[0].rows[0].teams === 'ADH1 v DE1'
    && vals.poolGroups[0].rows[0].time === '09:00');
  check('a played match shows its score in the list', vals.poolGroups[0].rows[1].score === '15–10');
  check('there is no knockout section when there are no knockout matches', vals.hasKnockout === false);

  vals.poolGroups[0].rows[0].onOpen();
  check('tapping a fixture opens the score sheet on it', c.state.sheetMatchId === 'u14b:A:1-2');
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [
      { id: `${agId}:A:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null },
      { id: `${agId}:B:1`, home: 'DS1', away: 'DT1', time: '09:00', pitch: 'A2', poolName: 'Pool B', result: null },
      { id: `${agId}:A:2`, home: 'DE1', away: 'ADH1', time: '10:00', pitch: 'A1', poolName: 'Pool A', result: null },
    ],
    knockout: [
      { id: `${agId}:CUP`, round: 'Cup Final', home: 'ADH1', away: 'DS1', time: '13:00', pitch: 'A1', result: null },
      { id: `${agId}:BOWL`, round: 'Bowl Final', home: '', away: '', time: '13:00', pitch: 'A2', result: null },
    ] }) });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('two pools produce two groups', vals.poolGroups.length === 2);
  check('groups keep first-appearance order', vals.poolGroups[0].name === 'Pool A' && vals.poolGroups[1].name === 'Pool B');
  check('a later match joins the pool it belongs to, not a new group', vals.poolGroups[0].rows.length === 2);
  check('decided knockout matches get their own section', vals.hasKnockout === true && vals.knockoutFixtureRows.length === 1);
  // FAULT-PROOF: an undecided knockout slot has no teams to score, so it must
  // not appear as a scoreable fixture.
  check('…and an undecided knockout slot is left out', vals.knockoutFixtureRows[0].id === 'u14b:CUP');
  check('a knockout row is labelled by its round', vals.knockoutFixtureRows[0].meta === 'Cup Final');
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: false, pool: [], knockout: [] }) });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('an age group with nothing scheduled says so', vals.fixturesEmpty === true && vals.poolGroups.length === 0);
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: true, pool: [], knockout: [] }) });
  await c.boot();
  c.go('fixtures');
  check('an unpublished draw shows coming-soon here too', c.renderVals().fixturesAwaiting === true);
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [{ id: `${agId}:X:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', result: null }], knockout: [] }) });
  await c.boot();
  c.go('fixtures');
  check('a match with no poolName still gets a heading rather than disappearing',
    c.renderVals().poolGroups.length === 1 && c.renderVals().poolGroups[0].name === 'Matches');
}

section('Results tab');
{
  const c = buildManager();
  await c.boot();
  c.go('results');
  const vals = c.renderVals();
  check('only played matches are listed', vals.resultRows.length === 1 && vals.resultRows[0].id === 'u14b:A:3-4');
  // FAULT-PROOF: `includes('15') && includes('10')` would still pass with the
  // sides swapped — the ordered string is the assertion.
  check('the score reads home-then-away', vals.resultRows[0].score === '15–10');
  check('the unplayed 09:00 match is not in the results list',
    vals.resultRows.every((r) => r.time !== '09:00'));
  vals.resultRows[0].onOpen();
  check('a result row reopens the score sheet for a correction', c.state.sheetMatchId === 'u14b:A:3-4');
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false, pool: [
    { id: `${agId}:A:1`, home: 'A', away: 'B', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 1, awayScore: 0 } },
    { id: `${agId}:A:2`, home: 'C', away: 'D', time: '09:20', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 2, awayScore: 0 } },
    { id: `${agId}:A:3`, home: 'E', away: 'F', time: '09:40', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 3, awayScore: 0 } },
  ], knockout: [] }) });
  await c.boot();
  c.go('results');
  // FAULT-PROOF: the most recent result is the one being checked, so it goes
  // on top. A forward-ordered list would put the oldest first.
  check('the newest result is first', eq('result order', c.renderVals().resultRows.map((r) => r.id),
    ['u14b:A:3', 'u14b:A:2', 'u14b:A:1']));
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [{ id: `${agId}:A:1`, home: 'A', away: 'B', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null }], knockout: [] }) });
  await c.boot();
  c.go('results');
  const vals = c.renderVals();
  check('with nothing played the tab says so', vals.resultsEmpty === true && vals.resultRows.length === 0);
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: true, pool: [], knockout: [] }) });
  await c.boot();
  c.go('results');
  check('an unpublished draw shows coming-soon on Results too', c.renderVals().resultsAwaiting === true);
}

section('Tables tab');
{
  const c = buildManager();
  await c.boot();
  c.go('tables');
  const vals = c.renderVals();
  check('one card per pool', vals.tableCards.length === 1 && vals.tableCards[0].name === 'Pool A');
  const row = vals.tableCards[0].rows[0];
  check('the row is numbered from 1', row.pos === 1);
  check('it names the team', row.team === 'DS1');
  check('it carries the played/won/drawn/lost figures', row.P === 1 && row.W === 1 && row.D === 0 && row.L === 0);
  check('it carries points for and against', row.PF === 15 && row.PA === 10);
  // FAULT-PROOF: the difference is computed, not read — a table that printed
  // PF again here would look plausible on a 15-10 row but not on this check.
  check('the difference is PF minus PA, signed', row.diff === '+5');
  check('it carries the league points', row.pts === 4);
  check('a qualifying row is marked', row.rowStyle.includes('#17A34A'));
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [{ id: 'A', name: 'Pool A' }],
    tables: { A: [
      { team: 'DS1', P:2,W:2,D:0,L:0,PF:30,PA:5,pts:8 },
      { team: 'DT1', P:2,W:0,D:0,L:2,PF:5,PA:30,pts:0 },
    ] }, _advance: 1 }) });
  await c.boot();
  c.go('tables');
  const rows = c.renderVals().tableCards[0].rows;
  check('every row is numbered in order', eq('positions', rows.map((r) => r.pos), [1, 2]));
  check('a negative difference is signed too', rows[1].diff === '-25');
  // FAULT-PROOF: _advance is 1, so exactly the top row qualifies. Marking
  // every row (or none) would still render a table that "looks right".
  check('only the qualifying places are marked', rows[0].rowStyle.includes('#17A34A') && !rows[1].rowStyle.includes('#17A34A'));
}
{
  // pools/tables are non-empty here on purpose: a guard that forgot to check
  // hasStandings would still render a card, since an empty pools list hides
  // that bug either way.
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: false, name: 'U6 Tag' },
    pools: [{ id: 'A', name: 'Pool A' }], tables: { A: [{ team: 'DS1', P:1,W:1,D:0,L:0,PF:15,PA:10,pts:4 }] }, _advance: 0 }) });
  await c.boot();
  c.go('tables');
  const vals = c.renderVals();
  check('a festival age group says it keeps no standings', vals.tablesFestival === true);
  check('…naming the group', /U6 Tag/.test(vals.tablesFestivalBlurb));
  check('…and shows no table at all', vals.tableCards.length === 0);
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [], tables: {}, _advance: 0 }) });
  await c.boot();
  c.go('tables');
  check('a competitive group with no pools yet says so', c.renderVals().tablesEmpty === true);
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: true }) });
  await c.boot();
  c.go('tables');
  check('an unpublished draw shows coming-soon on Tables', c.renderVals().tablesAwaiting === true);
  check('…without throwing on the missing ageGroup block', c.renderVals().tableCards.length === 0);
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [{ id: 'A', name: 'Pool A' }, { id: 'B', name: 'Pool B' }],
    tables: { A: [{ team: 'DS1', P:0,W:0,D:0,L:0,PF:0,PA:0,pts:0 }] }, _advance: 1 }) });
  await c.boot();
  c.go('tables');
  const vals = c.renderVals();
  check('a pool with no table rows yet still gets its card', vals.tableCards.length === 2);
  check('…with an empty row list rather than a crash', vals.tableCards[1].rows.length === 0);
}

section('Registrations tab');
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys',
    headCoachName: 'Coach A', headCoachMobile: '0500000001', managerName: 'Mgr A', managerMobile: '0500000002',
    players: JSON.stringify([{ firstName: 'Sam', lastName: 'Jones', dob: '2013-01-01' }]) }];
  const regPlayers = [
    { playerName: 'Sam Jones', dob: '2013-01-01', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Jones', parentMobile: '0500000003', emergencyContact: 'E Contact', emergencyMobile: '0500000004', medicalNotes: '', consent: 'Yes' },
    { playerName: 'Unmatched Kid', dob: '2013-02-02', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Kid', parentMobile: '0500000005', emergencyContact: 'E Kid', emergencyMobile: '0500000006', medicalNotes: 'Asthma', consent: 'Yes' },
  ];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: regTeams, players: regPlayers, scope: 'U14 Boys' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  const vals = c.renderVals();
  check('the team\'s coach is listed with a phone number', /Coach A/.test(vals.regTeamRows[0].sub) && /0500000001/.test(vals.regTeamRows[0].sub));
  check('the team\'s manager is listed too', /Mgr A/.test(vals.regTeamRows[0].sub));
  check('a player row carries the date of birth', vals.regPlayerRows[0].dob === '2013-01-01');
  check('a player row carries the emergency contact', /E Contact/.test(vals.regPlayerRows[0].emergency));
  check('medical notes are shown where they exist', vals.regPlayerRows[1].medical === 'Asthma' && vals.regPlayerRows[1].hasMedical === true);
  // FAULT-PROOF: matching is by name AND date of birth. A match on name alone
  // would clear the unmatched flag for a different child with the same name.
  check('a player who is on a roster is not flagged', vals.regPlayerRows[0].unmatched === false);
  check('a player who is on no roster IS flagged', vals.regPlayerRows[1].unmatched === true);
  check('…and the count is shown at the top', vals.regUnmatchedCount === 1 && vals.hasRegUnmatched === true);
  check('the counts match the rows', vals.regTeamCount === 1 && vals.regPlayerCount === 2);
}
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', headCoachName: 'Coach A', headCoachMobile: '1', managerName: 'M', managerMobile: '2',
    players: JSON.stringify([{ firstName: 'Sam', lastName: 'Jones', dob: '2013-01-01' }]) }];
  const regPlayers = [{ playerName: 'Sam Jones', dob: '2014-09-09', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P', parentMobile: '3', emergencyContact: 'E', emergencyMobile: '4', medicalNotes: '', consent: 'Yes' }];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: regTeams, players: regPlayers, scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: same name, different date of birth — this must still be
  // flagged, or a mis-keyed DOB silently passes as a match.
  check('a same-name player with a different date of birth is still flagged', c.renderVals().regPlayerRows[0].unmatched === true);
}
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', headCoachName: 'C', headCoachMobile: '1', managerName: 'M', managerMobile: '2', players: 'not-json-at-all' }];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  check('an unparseable roster does not take the whole tab down', c.renderVals().regTeamCount === 1);
}
{
  const regPlayers = [
    { playerName: 'Ethan Smith', dob: '2013-01-01', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Smith', parentMobile: '3', emergencyContact: 'E', emergencyMobile: '4', medicalNotes: '', consent: 'Yes' },
    { playerName: 'Olivia Brown', dob: '2013-03-03', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Brown', parentMobile: '5', emergencyContact: 'E', emergencyMobile: '6', medicalNotes: '', consent: 'Yes' },
  ];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: [], players: regPlayers, scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  c.onRegSearch({ target: { value: 'E' } });
  check('the first keystroke is kept', c.state.regSearch === 'E');
  c.onRegSearch({ target: { value: 'Et' } });
  c.onRegSearch({ target: { value: 'Eth' } });
  c.onRegSearch({ target: { value: 'Ethan' } });
  check('typing accumulates rather than resetting', c.state.regSearch === 'Ethan');
  const names = c.renderVals().regPlayerRows.map((r) => r.name);
  check('the list filters to the full typed string', names.includes('Ethan Smith') && !names.includes('Olivia Brown'));
  c.onRegSearch({ target: { value: '' } });
  // FAULT-PROOF: the filter is recomputed from state.regs each time, so it is
  // not a one-way narrowing that can never be undone.
  const namesBack = c.renderVals().regPlayerRows.map((r) => r.name);
  check('clearing the box brings everyone back', namesBack.includes('Ethan Smith') && namesBack.includes('Olivia Brown'));
}
{
  const c = buildManager({ getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  const vals = c.renderVals();
  check('an empty registration list says so for teams', vals.regTeamsEmpty === true);
  check('…and for players', vals.regPlayersEmpty === true);
}
{
  // An organiser sees every group's rows, so they have to be narrowed to the
  // group currently on screen — by NAME, since state.ageId is an id.
  const rows = {
    teams: [
      { club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', headCoachName: 'C', headCoachMobile: '1', managerName: 'M', managerMobile: '2', players: '[]' },
      { club: 'XX', teamName: 'XX1', ageGroup: 'U16 Boys', headCoachName: 'C', headCoachMobile: '1', managerName: 'M', managerMobile: '2', players: '[]' },
    ],
    players: [], scope: 'all',
  };
  const c = buildManager({
    currentSession: () => ({ isOrganizer: true, ageGroupId: '*', token: 't' }),
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
    getMyRegistrations: async () => rows,
  });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: without the narrowing, an organiser sees all 15 groups'
  // registrations stacked under whichever group they happen to be viewing.
  check('an organiser sees only the age group on screen', c.renderVals().regTeamCount === 1);
}
{
  let calls = 0;
  const c = buildManager({ getMyRegistrations: async () => { calls++; return { teams: [], players: [], scope: '' }; } });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  check('opening the tab fetches once', calls === 1);
  c.go('today');
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  check('returning to it does not refetch', calls === 1);
}

section('Spirit of Rugby Award tally on the Fixtures tab');
{
  const c = buildManager({
    supportsSpiritAward: () => true,
    getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 1, complete: false,
      tally: [{ name: 'Sam Jones', count: 1, team: 'ADH1' }], winners: [] }),
  });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('the tally card shows for a supporting age group', vals.hasSpirit === true);
  check('…with how far through the scoring it is', /1 of 2 matches scored/i.test(vals.spiritProgress));
  check('…and the nominations so far', vals.spiritTally.length === 1 && vals.spiritTally[0].name === 'Sam Jones');
  check('…and no winner while it is incomplete', vals.spiritComplete === false && vals.spiritWinnersLine === '');
}
{
  const c = buildManager({
    supportsSpiritAward: () => true,
    getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 2, complete: true,
      tally: [{ name: 'Sam Jones', count: 3, team: 'ADH1' }, { name: 'Ava Khan', count: 3, team: 'DE1' }],
      winners: [{ name: 'Sam Jones', team: 'ADH1' }, { name: 'Ava Khan', team: 'DE1' }] }),
  });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('a finished tally names the winner', vals.spiritComplete === true && /Sam Jones/.test(vals.spiritWinnersLine));
  // FAULT-PROOF: a tie produces more than one winner, and printing only the
  // first would hand one child an award two of them share.
  check('…and every winner of a tie, not just the first', /Ava Khan/.test(vals.spiritWinnersLine));
}
{
  const c = buildManager({ supportsSpiritAward: () => false });
  await c.boot();
  c.go('fixtures');
  // FAULT-PROOF: an age group that does not run the award must not see an
  // empty card implying it does.
  check('no tally card for an age group that does not run the award', c.renderVals().hasSpirit === false);
}
{
  let fetched = 0;
  const c = buildManager({ supportsSpiritAward: () => false, getSpiritAward: async () => { fetched++; return { supported: false }; } });
  await c.boot();
  check('the tally is not even fetched for an unsupported age group', fetched === 0);
}
{
  const c = buildManager({
    supportsSpiritAward: () => true,
    getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 0, complete: false, tally: [], winners: [] }),
  });
  await c.boot();
  c.go('fixtures');
  check('with no nominations yet the card says so', c.renderVals().spiritEmpty === true);
}

section('Organizer design system is what this page uses');
{
  const html = readRepo('Manager.dc.html');
  /* Aug 2026: the back office went LIGHT (Jay's call) — the parity these
     checks hold is Manager matching ORGANIZER, whatever the mode. */
  check('page background is Organizer\'s light #F3F2EF, not app.html\'s paper', /background:#F3F2EF/.test(html));
  check('cards use Organizer\'s white fill', /background:#FFFFFF/.test(html));
  check('cards use Organizer\'s 1px hairline border', /border:1px solid rgba\(0,0,0,0\.1\)/.test(html));
  check('cards use Organizer\'s 14px radius', /border-radius:14px/.test(html));
  check('headings use Anton', /font-family:'Anton'/.test(html));
  check('body type is Barlow', /font-family:'Barlow',system-ui,sans-serif/.test(html));
  check('the shell uses Organizer\'s 1300px max width and padding',
    /max-width:1300px;margin:0 auto;padding:28px 24px 80px/.test(html));
  // FAULT-PROOF against a CSS-reskin shortcut: app.html's light palette
  // variables must NOT have been copied across the way Manager.html copied them.
  check('app.html\'s --paper/--card CSS variables were NOT copied in', !/--paper:#F3F1ED/.test(html));
  check('there is no borrowed app.html :root variable block at all', !/--red-deep:#A81219/.test(html));
}

section('It is a real component, not a script tag in disguise');
{
  const html = readRepo('Manager.dc.html');
  check('it has an <x-dc> block', /<x-dc>/.test(html));
  check('it loads support.js', /src="\.\/support\.js"/.test(html));
  check('its logic is a text/x-dc script', /<script type="text\/x-dc"/.test(html));
  check('it defines class Component extends DCLogic', /class Component extends DCLogic/.test(html));
  check('it uses sc-if for the login/dashboard split', /<sc-if value="\{\{ loggedOut \}\}"/.test(html) && /<sc-if value="\{\{ loggedIn \}\}"/.test(html));
  check('it renders the tab strip with sc-for', /<sc-for list="\{\{ tabs \}\}"/.test(html));
  check('there is no plain <script type="module"> page script', !/<script type="module">/.test(html));
}

section('Parity gap-fills: three old assertions restated for the component build');
{
  const html = readRepo('Manager.dc.html');
  // Old: "Manager.html calls api.loadScoringRules() during boot", proven by
  // driving the module. componentDidMount cannot be driven in Node (it does a
  // dynamic import of scores-data.js), so this is asserted at the source — and
  // the reason it matters is unchanged: without it a manager sees the
  // hardcoded default scoring rules instead of the organiser's live ones.
  check('the component loads the live scoring rules at mount', /loadScoringRules\(\)/.test(html));
  check('…and the venue, before anything renders', /await api\.loadVenue\(\)/.test(html));

  // Old MINOR 9: the knockout time input was 100px and clipped times like
  // "01:0" — genuinely ambiguous between 1am and 1pm on the finals rows.
  const koTimeWidths = (html.match(/type="time"[^>]*width:(\d+)px/g) || []).map((m) => Number(m.match(/width:(\d+)px/)[1]));
  check('every time input is at least 110px wide', koTimeWidths.length > 0 && koTimeWidths.every((w) => w >= 110));

  // Old MAJOR 2: at phone width the fixed-width time/pitch/delete controls
  // squeezed the two team boxes down to ~24px and team names rendered one
  // character per line. This build reflows by wrapping instead of by a media
  // query, so the assertion is that the wrap and the minimum box width exist.
  check('slot rows wrap rather than squeezing at phone width', /flex-wrap:wrap/.test(html));
  check('…and a team box has a sane minimum width', /min-width:120px/.test(html));
}

summary('tests/test-manager-dc.js');
}

main();
