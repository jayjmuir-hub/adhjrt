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
  const landed = await c.boot();
  check('no session at all leaves the login screen up', landed === false && c.state.session === null);
}

section('Login screen');
{
  const c = buildManager({ currentSession: () => null });
  await c.boot();
  const vals = c.renderVals();
  check('the login screen is what renders with no session', vals.loggedOut === true && vals.loggedIn === false);

  c.setState({ loginUser: '', loginPass: '' });
  await c.doLogin();
  check('an empty form is refused with a message, without calling the API',
    c.state.loginError === 'Enter your username and password.');
}
{
  let calledWith = null;
  const c = buildManager({
    currentSession: () => null,
    login: async (u, p) => { calledWith = [u, p]; return { ok: false, error: 'Wrong username or password.' }; },
  });
  c.setState({ loginUser: '  mgr-u14b  ', loginPass: 'secret' });
  await c.doLogin();
  check('the username is trimmed before it is sent', eq('login args', calledWith, ['mgr-u14b', 'secret']));
  check('a rejected login shows the server\'s message', c.state.loginError === 'Wrong username or password.');
  check('…and the login screen stays up', !c.state.session);
  check('…and the button goes back to its idle label', c.renderVals().loginLabel === 'Sign in');
}
{
  // A successful login must run the SAME boot() the page load runs — and must
  // only say "Signed in" when boot() actually landed on the dashboard.
  let sessionNow = null;
  const c = buildManager({
    currentSession: () => sessionNow,
    login: async () => { sessionNow = { ageGroupId: 'u14b', token: 't' }; return { ok: true }; },
  });
  c.setState({ loginUser: 'mgr', loginPass: 'pw' });
  await c.doLogin();
  check('a successful login lands on the dashboard', !!c.state.session && c.state.ageId === 'u14b');
  check('…and confirms it', c.state.toast === 'Signed in');
  check('…and clears the typed password out of state', c.state.loginPass === '');
}
{
  // FAULT-PROOF for the "landed" contract: login succeeds but the account's
  // age group does not exist, so boot() bounces back to the login screen. The
  // "Signed in" toast must NOT stomp the explanation.
  let sessionNow = null;
  const c = buildManager({
    currentSession: () => sessionNow,
    login: async () => { sessionNow = { ageGroupId: 'u99', token: 't' }; return { ok: true }; },
  });
  c.setState({ loginUser: 'mgr', loginPass: 'pw' });
  await c.doLogin();
  check('a login whose age group is missing does not claim "Signed in"', c.state.toast !== 'Signed in');
  check('…it explains the real problem instead', /age group is not set up/i.test(c.state.toast));
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
    vals.tabs[1].style.includes('background:transparent;color:#aeb4bf;'));

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
  check('…and says so', c.state.toast === 'Signed out');
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

section('Organizer design system is what this page uses');
{
  const html = readRepo('Manager.dc.html');
  check('page background is Organizer\'s #0C0C0E, not app.html\'s paper', /background:#0C0C0E/.test(html));
  check('cards use Organizer\'s #151517 fill', /background:#151517/.test(html));
  check('cards use Organizer\'s 1px hairline border', /border:1px solid rgba\(255,255,255,0\.1\)/.test(html));
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

summary('tests/test-manager-dc.js');
}

main();
