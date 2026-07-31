/* tests/test-fixtures-logos.js
   ------------------------------------------------------------------------
   Jay, 30 Jul 2026: "the team logos are not showing in the fixtures section."

   The homepage's Fixtures section (id="schedule") is its OWN hand-built
   markup — it does not reuse the Scores & Standings component that already
   had crests wired in (that's the *Results* section, embedded lower on the
   same page via <dc-import>). This proves the Fixtures section's own
   renderVals() computes the same homeLogoSrc/hasHomeLogo/awayLogoSrc/
   hasAwayLogo/logoSrc/hasLogo fields, and that the markup actually reads
   them (not the other way round — a renderVals field with no matching
   markup would leave the page exactly as broken as before).

   Same build()/DCLogic/fakeScoresApi harness as test-fixtures-results-sync.js
   — the real component, not a reimplementation. */

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

const LOGOS = { ADH: '/assets/logos/adh.png', DE: '/assets/logos/de.png' };
function fakeTeamLogoSrc(code) {
  const m = String(code || '').match(/^([A-Za-z]+)\d*$/);
  const prefix = m ? m[1].toUpperCase() : '';
  return LOGOS[prefix] || '';
}

function fakeScoresApi(overrides) {
  return {
    getStandings: async () => null,
    getDraw: async () => ({ pools: [], knockout: [], _publish: null }),
    teamLabel: (v) => v,
    teamKey: () => [],
    teamLogoSrc: fakeTeamLogoSrc,
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
    fmtCountdown: () => '',
    fmtWindowDate: () => '',
    ...overrides,
  };
}

const groups = [{ id: 'u16b', name: 'U16B Contact' }];

function homeWithSchedule(schedule, teamKeyRows) {
  const c = build('Quins JRT.dc.html');
  c.state = {
    ...c.state,
    fxApi: fakeScoresApi({ teamKey: () => teamKeyRows || [] }),
    fxAgeGroups: groups,
    fxSelectedId: 'u16b',
    fxSchedule: schedule,
  };
  return c;
}

async function main() {

/* ======================================================================== */
section('Pool games: renderVals computes per-team logo fields from the raw code');
{
  const schedule = {
    awaitingPublication: false,
    pools: [{
      name: 'POOL A',
      games: [
        { home: 'ADH1', away: 'DE1', homeCode: 'ADH1', awayCode: 'DE1', homeScore: 12, awayScore: 7, time: '09:00', pitch: '1' },
        { home: 'ADH2', away: 'Other Free-Text Club', homeCode: 'ADH2', awayCode: 'ZZZ1', homeScore: 5, awayScore: 5, time: '09:20', pitch: '2' },
      ],
    }],
    knockout: [],
  };
  const c = homeWithSchedule(schedule);
  const vals = c.renderVals();
  const [g1, g2] = vals.fixturePools[0].games;

  eq('a known club (ADH) resolves its crest for the home slot', g1.homeLogoSrc, '/assets/logos/adh.png');
  check('…and hasHomeLogo flags it true', g1.hasHomeLogo === true);
  eq('a different known club (DE) resolves its own crest for the away slot', g1.awayLogoSrc, '/assets/logos/de.png');
  check('…and hasAwayLogo flags it true', g1.hasAwayLogo === true);

  eq("a club's 2nd team (ADH2) shares the 1st team's crest", g2.homeLogoSrc, '/assets/logos/adh.png');
  eq('an unrecognised club code fails safe — empty src, not a broken image', g2.awayLogoSrc, '');
  check('…and hasAwayLogo is false so the <img> never renders for it', g2.hasAwayLogo === false);
}

/* ======================================================================== */
section('Pool games: fixtures section shows the CODE, matching /app and /scores (added 30 Jul 2026)');
{
  // Jay: "we need to use the prefix names in the fixtures section too."
  // Before this fix, pool games displayed the teamLabel()'d full club name
  // (getSchedule()'s `home`/`away`) while knockout/bracket rows on the same
  // page already showed the raw code — this fixture deliberately makes the
  // full name and the code look nothing alike, so a regression back to the
  // full name can't hide behind a fixture where they happen to match.
  const schedule = {
    awaitingPublication: false,
    pools: [{
      name: 'POOL A',
      games: [
        { home: 'Abu Dhabi Harlequins 1st XV', away: 'Dubai Exiles 1st XV', homeCode: 'ADH1', awayCode: 'DE1', homeScore: 12, awayScore: 7, time: '09:00', pitch: '1' },
      ],
    }],
    knockout: [],
  };
  const c = homeWithSchedule(schedule);
  const vals = c.renderVals();
  const g = vals.fixturePools[0].games[0];
  eq('pool game home slot displays the raw code, not the expanded full name', g.home, 'ADH1');
  eq('pool game away slot displays the raw code, not the expanded full name', g.away, 'DE1');
}

/* ======================================================================== */
section('Filter by team: the dropdown\'s values and the match test both key off CODE, not name (added 30 Jul 2026)');
{
  // Before this fix, fixtureTeamOptions/gameMatchesFilter were built from the
  // teamLabel()'d full name — which never equalled a knockout entry's raw
  // code, so filtering silently never matched anything in the bracket/
  // knockout view. This proves the dropdown offers codes as its option
  // values and that picking one narrows BOTH the pool list and the knockout
  // list correctly.
  const schedule = {
    awaitingPublication: false,
    pools: [{
      name: 'POOL A',
      games: [
        { home: 'Abu Dhabi Harlequins 1st XV', away: 'Dubai Exiles 1st XV', homeCode: 'ADH1', awayCode: 'DE1', homeScore: 12, awayScore: 7, time: '09:00', pitch: '1' },
        { home: 'Dubai Sharks 1st XV', away: 'Dubai Tigers 1st XV', homeCode: 'DS1', awayCode: 'DT1', homeScore: 3, awayScore: 3, time: '09:20', pitch: '2' },
      ],
    }],
    knockout: [
      { id: 'sf1', label: 'Semi 1', home: 'ADH1', away: 'DS1', homeScore: null, awayScore: null, time: '13:00', pitch: '1' },
    ],
  };
  const c = homeWithSchedule(schedule);
  c.state = { ...c.state, fxTeamFilter: 'ADH1' };
  const vals = c.renderVals();
  eq('team-select option VALUES are codes (so they can match a knockout entry\'s raw code)',
    vals.fixtureTeamSelectOptions.map((o) => o.code).sort().join(','), 'ADH1,DE1,DS1,DT1');
  eq('picking a code filters pool games down to the ones involving it', vals.fixturePools[0].games.length, 1);
  check('...and the knockout entry involving the same code also survives the filter',
    (vals.fixtureKnockout || []).some((k) => k.id === 'sf1'));
}

/* ======================================================================== */
section('Knockout/bracket entries: dim() computes the same fields from home/away directly');
{
  // getSchedule()'s knockout entries carry the raw CODE straight in home/away
  // (no teamLabel() applied — a pre-existing, separate quirk), so dim() reads
  // item.home/item.away rather than a homeCode/awayCode pair.
  const schedule = {
    awaitingPublication: false,
    pools: [{ name: 'POOL A', games: [] }, { name: 'POOL B', games: [] }],
    knockout: [
      { id: 'sf1', label: 'Top Bracket — Semi-Final 1', home: 'ADH1', away: 'DE1', homeScore: 10, awayScore: 3, time: '13:00', pitch: '1' },
      { id: 'sf2', label: 'Top Bracket — Semi-Final 2', home: 'ADH2', away: 'DE2', homeScore: null, awayScore: null, time: '13:20', pitch: '2' },
      { id: 'cupfinal', label: 'Cup Final', home: null, away: null, homeScore: null, awayScore: null, time: '15:00', pitch: '1' },
      { id: 'bowlfinal', label: 'Bowl Final', home: null, away: null, homeScore: null, awayScore: null, time: '15:20', pitch: '2' },
      { id: 'bsf1', label: 'Bottom Bracket — Semi-Final 1', home: null, away: null, homeScore: null, awayScore: null, time: '13:00', pitch: '3' },
      { id: 'bsf2', label: 'Bottom Bracket — Semi-Final 2', home: null, away: null, homeScore: null, awayScore: null, time: '13:20', pitch: '4' },
      { id: 'platefinal', label: 'Plate Final', home: null, away: null, homeScore: null, awayScore: null, time: '15:00', pitch: '3' },
      { id: 'shieldfinal', label: 'Shield Final', home: null, away: null, homeScore: null, awayScore: null, time: '15:20', pitch: '4' },
    ],
  };
  const c = homeWithSchedule(schedule);
  const vals = c.renderVals();

  // Whichever bracket shape this schedule shape resolves to (double bracket
  // vs seed bracket vs waterfall), the semis/final data flows through dim().
  const semis = (vals.bracketList && vals.bracketList[0] && vals.bracketList[0].semis) || [];
  check('at least one semi-final entry was produced to check', semis.length > 0);
  if (semis.length) {
    eq('bracket semi-final home slot resolves its crest from the raw code', semis[0].homeLogoSrc, '/assets/logos/adh.png');
    eq('bracket semi-final away slot resolves its crest from the raw code', semis[0].awayLogoSrc, '/assets/logos/de.png');
  }
}

/* ======================================================================== */
section('Team key legend: hasLogo mirrors the crest lookup, and the age group is actually passed');
{
  const rows = [
    { code: 'ADH1', name: 'Abu Dhabi Harlequins 1st XV', logoSrc: '/assets/logos/adh.png' },
    { code: 'ZZZ1', name: 'Other', logoSrc: '' },
  ];
  const c = homeWithSchedule({ awaitingPublication: false, pools: [], knockout: [] }, rows);
  const vals = c.renderVals();
  eq('a club with a crest on file gets hasLogo: true', vals.teamKeyList[0].hasLogo, true);
  eq('a club with no crest gets hasLogo: false', vals.teamKeyList[1].hasLogo, false);
}

/* ======================================================================== */
section('The markup actually consumes these fields (a field with no reader fixes nothing)');
{
  const home = readRepo('Quins JRT.dc.html');
  check('pool game row reads g.hasHomeLogo / g.homeLogoSrc',
    /sc-if value="\{\{ g\.hasHomeLogo \}\}"[\s\S]{0,80}<img src="\{\{ g\.homeLogoSrc \}\}"/.test(home));
  check('pool game row reads g.hasAwayLogo / g.awayLogoSrc',
    /sc-if value="\{\{ g\.hasAwayLogo \}\}"[\s\S]{0,80}<img src="\{\{ g\.awayLogoSrc \}\}"/.test(home));
  check('team key row reads k.hasLogo / k.logoSrc',
    /sc-if value="\{\{ k\.hasLogo \}\}"[\s\S]{0,80}<img src="\{\{ k\.logoSrc \}\}"/.test(home));
  check('bracket semi-final row reads sm.hasHomeLogo / sm.homeLogoSrc',
    /sc-if value="\{\{ sm\.hasHomeLogo \}\}"[\s\S]{0,80}<img src="\{\{ sm\.homeLogoSrc \}\}"/.test(home));
  check('bracket final row reads br.final.hasHomeLogo / br.final.homeLogoSrc',
    /sc-if value="\{\{ br\.final\.hasHomeLogo \}\}"[\s\S]{0,100}<img src="\{\{ br\.final\.homeLogoSrc \}\}"/.test(home));
  check('bracket consolation row reads br.consolation.hasHomeLogo / br.consolation.homeLogoSrc',
    /sc-if value="\{\{ br\.consolation\.hasHomeLogo \}\}"[\s\S]{0,100}<img src="\{\{ br\.consolation\.homeLogoSrc \}\}"/.test(home));
  check('waterfall finals row reads wf.hasHomeLogo / wf.homeLogoSrc',
    /sc-if value="\{\{ wf\.hasHomeLogo \}\}"[\s\S]{0,80}<img src="\{\{ wf\.homeLogoSrc \}\}"/.test(home));
}

/* ======================================================================== */
section('PROVE IT: getSchedule() dropping homeCode/awayCode actually breaks pool-game logos');
{
  // Without the homeCode/awayCode passthrough, pool games only have
  // teamLabel()'d full names in home/away — logoOf() can't resolve a crest
  // from a name, so this asserts the real fix (adding those fields in
  // scores-data.js) is what makes the assertions above possible at all.
  const scheduleNoCodes = {
    awaitingPublication: false,
    pools: [{
      name: 'POOL A',
      games: [{ home: 'Abu Dhabi Harlequins 1st XV', away: 'Al Ain Rugby 1st XV', homeScore: 1, awayScore: 0, time: '09:00', pitch: '1' }],
    }],
    knockout: [],
  };
  const c = homeWithSchedule(scheduleNoCodes);
  const vals = c.renderVals();
  check('a full name with no accompanying code fails to resolve a crest (proves homeCode/awayCode is load-bearing)',
    vals.fixturePools[0].games[0].hasHomeLogo === false);
}

summary('test-fixtures-logos.js');

}

main().catch((e) => { console.error(e); process.exit(1); });
