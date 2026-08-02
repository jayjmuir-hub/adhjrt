/* tests/test-fixtures-results-sync.js
   ------------------------------------------------------------------------
   Jay, 29 Jul 2026: "if you click the fixtures for an age group or say you
   are in the results or managers sections of that age group, then both the
   fixtures and results sections should both be on that age group
   automatically."

   BEFORE THIS CHANGE, the sync only ran one way. The homepage's Fixtures
   section owns `fxSelectedId` and always passed it down to the embedded
   Scores & Standings widget as the `age` prop (Fixtures -> Results), and
   that half already worked. But nothing ran the other way: picking an age
   group in the widget's own public Results tab, or landing in its Manager
   area for a group (logging in as that group's manager, or an organiser
   switching the admin picker), never told the Fixtures section to follow.
   A visitor who used the Results/Manager picker saw two different age
   groups on the same page and had no way to know why.

   THE FIX IS ONE CALLBACK, NOT A SECOND SOURCE OF TRUTH. The homepage still
   owns fxSelectedId. Scores & Standings.dc.html now also accepts an
   `onAgeChange` prop (wired through dc-import as `on-age-change`) and calls
   it — never on the prop-driven top-down path, only from the two places a
   visitor actually changes ITS OWN idea of the current age group:

     1. the public Results tab's onSelect
     2. loadEditor(), which is how both a manager's own bound age group (at
        login) and an organiser's admin-picker choice reach editorAgeId

   The homepage's handler (onScoresAgeChange) ignores an empty id, an id it
   doesn't recognise, and a no-op repeat of the id it already has — the last
   one is what stops this becoming an infinite ping-pong: Results calling
   up, the homepage calling back down, Results' own componentDidUpdate guard
   (`a !== state.selectedAgeId`) already true by then, so it stops there.

   Both halves are driven through the real components (build()), same
   pattern as test-organizer-grouping.js and test-venue-map.js — not
   reimplemented here.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Same minimal framework stand-in every other component-driving test uses. */
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

/* renderVals() on Scores & Standings.dc.html leans on a couple dozen small
   helpers from the real scores-data.js module (pitch lists, scoring labels,
   clash text...) for parts of the page these sync tests never look at.
   Rather than reach into the real ES module from this CommonJS test runner,
   this is a deliberately dumb stand-in — enough that renderVals doesn't throw
   reaching for one of them, with real per-test overrides (getStandings,
   getDraw, teamLabel...) layered on top of it. */
function fakeScoresApi(overrides) {
  return {
    getStandings: async () => null,
    getDraw: async () => ({ pools: [], knockout: [], _publish: null }),
    teamLabel: (v) => v,
    teamKey: (v) => v,
    isOrganizerSession: () => false,
    canPublishNow: () => false,
    supportsSpiritAward: () => false,
    pitchesForAgeGroup: () => [],
    dayLabelOfAgeGroup: () => '',
    dayStartMins: () => 480,
    slotLengthMins: () => 20,
    poolEndMins: () => 480,
    minutesToDisplay: (m) => String(m),
    minutesToTimeInput: () => '08:00',
    regeneratePoolSlots: () => [],
    describeClash: () => '',
    allScoreTypes: () => [],
    scoreLabel: () => '',
    scorePoints: () => 0,
    scoreTotal: () => 0,
    scoringFor: () => ({}),
    ...overrides,
  };
}

async function main() {

/* ======================================================================== */
section('The binding contract: the new prop/attr actually exist in the markup');
{
  const home = readRepo('Quins JRT.dc.html');
  check('the dc-import still passes the age it owns down to the widget',
    /<dc-import name="Scores & Standings"[^>]*\bage="\{\{ fxSelectedId \}\}"/.test(home));
  check('…and now ALSO wires the reverse channel back up',
    /<dc-import name="Scores & Standings"[^>]*\bon-age-change="\{\{ onScoresAgeChange \}\}"/.test(home));
  check('onScoresAgeChange is a real renderVals key, not a typo the template silently swallows',
    /onScoresAgeChange:\s*\(/.test(home));

  const scores = readRepo('Scores & Standings.dc.html');
  check('the public Results tab reports its own pick upward',
    /onSelect: \(\) => this\.setState\(\{ selectedAgeId: a\.id \}, \(\) => \{[\s\S]{0,200}?this\.props\.onAgeChange\(a\.id\)/.test(scores));
  check('…guarded so the standalone \/scores page (no onAgeChange prop) never throws',
    /typeof this\.props\.onAgeChange === 'function'/.test(scores));
  /* Aug 2026: loadEditor() is gone — the /scores Manager area was deleted
     (claude/specs/spec-scores-manager-removal.md), so the editor half of this
     sync channel no longer exists. The public half above is the whole
     contract now; assert the deletion is total rather than leaving a check
     anchored on code that no longer exists. */
  check('the editor half of the channel is gone with the Manager area',
    !/loadEditor/.test(scores));
}

/* ======================================================================== */
section('Homepage: onScoresAgeChange (Results/Manager -> Fixtures)');
{
  const groups = [
    { id: 'u9', name: 'U9 Mixed Contact' },
    { id: 'u16b', name: 'U16B Contact' },
  ];

  function homeWith(fxSelectedId, scheduleCalls) {
    const c = build('Quins JRT.dc.html');
    c.state = {
      ...c.state,
      fxAgeGroups: groups,
      fxSelectedId,
      // Shaped like a real schedule (renderVals walks .pools/.knockout), with
      // an extra marker so the "did it actually reload" checks below can tell
      // this original object apart from whatever loadSchedule's stub returns.
      fxSchedule: { awaitingPublication: false, pools: [], knockout: [], _sentinel: true },
      fxApi: { getSchedule: async (id) => { scheduleCalls.push(id); return { id, pools: [], knockout: [], awaitingPublication: false }; } },
    };
    return c;
  }

  {
    const calls = [];
    const c = homeWith('u9', calls);
    const vals = c.renderVals();
    check('onScoresAgeChange is handed to the template', typeof vals.onScoresAgeChange === 'function');

    vals.onScoresAgeChange('u9'); // same id already selected
    check('picking the SAME age group elsewhere is a no-op', c.state.fxSelectedId === 'u9');
    check('…and does not needlessly reload the schedule', calls.length === 0);
    check('…and does not clear the schedule that was already loaded', c.state.fxSchedule && c.state.fxSchedule._sentinel === true);
  }

  {
    const calls = [];
    const c = homeWith('u9', calls);
    const vals = c.renderVals();
    vals.onScoresAgeChange('not-a-real-age-group');
    check('an id the Fixtures section does not recognise is ignored, not adopted', c.state.fxSelectedId === 'u9');
    check('…and never calls the schedule API with garbage', calls.length === 0);
  }

  {
    const calls = [];
    const c = homeWith('u9', calls);
    const vals = c.renderVals();
    vals.onScoresAgeChange('');
    check('an empty id is ignored', c.state.fxSelectedId === 'u9');
    vals.onScoresAgeChange(null);
    check('…so is a null id', c.state.fxSelectedId === 'u9');
  }

  {
    const calls = [];
    const c = homeWith('u9', calls);
    const vals = c.renderVals();
    vals.onScoresAgeChange('u16b');
    check('a genuine pick elsewhere moves the Fixtures section to the same age group', c.state.fxSelectedId === 'u16b');
    // loadSchedule is async (awaits fxApi.getSchedule) — let its microtasks run
    // before asserting on the reload it kicked off.
    await new Promise((r) => setTimeout(r, 0));
    eq('…and actually reloads THAT group\'s schedule, exactly once, not just the id', calls, ['u16b']);
    check('the fixture filter is reset and the schedule reflects the new group',
      c.state.fxTeamFilter === '' && c.state.fxSchedule && c.state.fxSchedule.id === 'u16b');
  }
}

/* ======================================================================== */
section('Scores & Standings: public Results tab calls onAgeChange upward');
{
  function build2(props) { return build('Scores & Standings.dc.html', props); }

  {
    const calls = [];
    const c = build2({ onAgeChange: (id) => calls.push(id) });
    c.state = {
      ...c.state,
      ageGroups: [
        { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
        { id: 'u16b', name: 'U16B Contact', hasStandings: true },
      ],
      selectedAgeId: 'u9',
      api: fakeScoresApi(),
    };
    const vals = c.renderVals();
    const tab = (vals.ageTabs || []).find((t) => t.name === 'U16B Contact');
    check('the U16B public tab exists and is clickable', !!tab && typeof tab.onSelect === 'function');
    tab.onSelect();
    check('picking it updates the widget\'s own selection', c.state.selectedAgeId === 'u16b');
    eq('…and reports the pick upward through onAgeChange, exactly once', calls, ['u16b']);
  }

  {
    // No onAgeChange prop at all -- this is the standalone /scores mount.
    // Clicking a tab must not throw just because nobody is listening.
    const c = build2({});
    c.state = {
      ...c.state,
      ageGroups: [{ id: 'u9', name: 'U9 Mixed Contact', hasStandings: true }],
      selectedAgeId: null,
      api: fakeScoresApi(),
    };
    const vals = c.renderVals();
    const tab = vals.ageTabs[0];
    let threw = false;
    try { tab.onSelect(); } catch (e) { threw = true; }
    check('clicking a tab on the standalone /scores page (no onAgeChange prop) does not throw', !threw);
    check('…and still updates its own state normally', c.state.selectedAgeId === 'u9');
  }
}

}

main().then(() => summary('test-fixtures-results-sync.js')).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
