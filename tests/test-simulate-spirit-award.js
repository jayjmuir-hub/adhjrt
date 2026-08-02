/* tests/test-simulate-spirit-award.js
   ------------------------------------------------------------------------
   Jay, 1 Aug 2026: "select a player from each team for each match for
   spirit of rugby, at the end one player should have more votes than
   others so there is a winner showing."

   Built into runSimulateTournament() — originally on
   "Scores & Standings.dc.html", MOVED to Organizer.dc.html's Tournament tab
   in Aug 2026 with the rest of the simulate tooling; this file was repointed
   in the same commit. Every
   match in a spirit-eligible age group (api.supportsSpiritAward — U14B/G,
   U16B/G, U18B/G only) now submits spiritNomineeHome/spiritNomineeAway
   pulled from that team's real registered roster (roster[0], a fixed
   "captain" per team, kept simple and traceable).

   THE PART WORTH PROVING: a fixed captain-per-team scheme reliably TIES,
   because the 4-pool Cup/Bowl/Plate/Shield format means several teams play
   the exact same number of games (every tier's two finalists both play
   pool+semi+final, win or lose). breakSpiritTies() is the correction that
   runs once an age group's matches are all in — it must actually produce a
   single unambiguous leader, and it must never touch the leader's OWN
   matches while doing it (only a rival's).

   test-simulate-tournament.js already proves the two-pass pool/knockout
   orchestration in general; this file is scoped to the Spirit of Rugby
   addition specifically, at two levels: a wiring check (does a real
   runSimulateTournament() call actually attach nominee data, and ONLY for
   eligible groups) and a direct, isolated test of breakSpiritTies() itself
   (rather than re-deriving a real 8-way tie through a full mock bracket,
   which would prove the same algorithm far more expensively).
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

function buildScores(overrides) {
  const c = build('Organizer.dc.html', {});
  c.state = { ...c.state, session: { token: 't', _role: 'organizer' }, ...overrides };
  return c;
}

async function main() {

/* ======================================================================== */
section('runSimulateTournament(): nominates from the real roster, only for spirit-eligible age groups');
{
  const results = {}; // matchId -> data actually submitted
  const roster = { u9: {}, u14b: {} };
  const drafts = {
    u9: { slots: [{ id: 'u9:A:0-1', home: 'A1', away: 'A2' }], pools: [{ id: 'A' }], knockout: [] },
    u14b: { slots: [{ id: 'u14b:A:0-1', home: 'ADH1', away: 'DE1' }], pools: [{ id: 'A' }], knockout: [] },
  };
  Object.values(drafts).forEach((d) => d.slots.forEach((s) => { roster[Object.keys(drafts).find((k) => drafts[k] === d)][s.id] = { home: s.home, away: s.away }; }));

  const registrations = {
    teams: [
      { teamName: 'ADH1', ageGroup: 'U14B Contact', players: JSON.stringify([{ firstName: 'Adam', lastName: 'Harlequin' }, { firstName: 'Ben', lastName: 'Harlequin' }]) },
      { teamName: 'DE1', ageGroup: 'U14B Contact', players: JSON.stringify([{ firstName: 'Cara', lastName: 'Exile' }, { firstName: 'Dana', lastName: 'Exile' }]) },
    ],
  };

  const api = {
    supportsSpiritAward: (agId) => agId === 'u14b',
    getMyRegistrations: async () => registrations,
    getDraw: async (agId) => JSON.parse(JSON.stringify(drafts[agId])),
    saveDraw: async (agId, draw) => { drafts[agId] = JSON.parse(JSON.stringify(draw)); return { ok: true }; },
    publishDraw: async () => ({ ok: true }),
    autoKnockoutSlots: async () => [],
    submitResult: async (matchId, data) => {
      const agId = matchId.split(':')[0];
      const r = roster[agId][matchId];
      if (!r || !r.home || !r.away) return { ok: false, error: 'unknown match' };
      results[matchId] = data;
      return { ok: true };
    },
    clearResult: async () => ({ ok: true }),
    allResults: async () => ({ ...results }),
    ageGroupOfMatch: (id) => String(id || '').split(':')[0],
  };

  const c = buildScores({ api, tournAgeGroups: [
    { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
    { id: 'u14b', name: 'U14B Contact', hasStandings: true },
  ] });
  await c.runSimulateTournament();

  check('the spirit-eligible match got a real nominee from each team\'s roster',
    results['u14b:A:0-1'].spiritNomineeHome === 'Adam Harlequin' && results['u14b:A:0-1'].spiritNomineeAway === 'Cara Exile');
  check('a non-eligible age group\'s match got NO spirit fields at all',
    !('spiritNomineeHome' in results['u9:A:0-1']) && !('spiritNomineeAway' in results['u9:A:0-1']));
}

/* ======================================================================== */
section('runSimulateTournament(): a team with no imported roster still gets a (synthetic, distinct-per-team) nominee rather than crashing');
{
  const results = {};
  const drafts = { u14b: { slots: [{ id: 'u14b:A:0-1', home: 'ADH1', away: 'BAR1' }], pools: [{ id: 'A' }], knockout: [] } };
  const api = {
    supportsSpiritAward: () => true,
    getMyRegistrations: async () => ({ teams: [] }), // nothing imported yet
    getDraw: async (agId) => JSON.parse(JSON.stringify(drafts[agId])),
    saveDraw: async (agId, draw) => { drafts[agId] = draw; return { ok: true }; },
    publishDraw: async () => ({ ok: true }),
    autoKnockoutSlots: async () => [],
    submitResult: async (matchId, data) => { results[matchId] = data; return { ok: true }; },
    clearResult: async () => ({ ok: true }),
    allResults: async () => ({ ...results }),
    ageGroupOfMatch: (id) => String(id || '').split(':')[0],
  };
  const c = buildScores({ api, tournAgeGroups: [{ id: 'u14b', name: 'U14B Contact', hasStandings: true }] });
  await c.runSimulateTournament();
  check('still ran without throwing and produced a result', !!results['u14b:A:0-1']);
  eq('the fallback nominee names the team, not a blank/undefined', results['u14b:A:0-1'].spiritNomineeHome, 'ADH1 Player');
  check('…and the two sides still get DIFFERENT fallback names', results['u14b:A:0-1'].spiritNomineeHome !== results['u14b:A:0-1'].spiritNomineeAway);
}

/* ======================================================================== */
section('breakSpiritTies(): resolves a genuine 3-way tie to a single leader, never touching the leader\'s own matches');
{
  const submitted = []; // { matchId, data }
  const api = {
    submitResult: async (matchId, data) => { submitted.push({ matchId, data }); return { ok: true }; },
  };
  const rosterFor = (agName, team) => [`${team}cap`, `${team}alt`];

  // A clean 3-way round robin of nominations: T1capvT2cap, T2capvT3cap,
  // T3capvT1cap — every captain nominated exactly twice, nothing else.
  const spiritLog = {
    m1: { data: { spiritNomineeHome: 'T1cap', spiritNomineeAway: 'T2cap' }, home: 'T1', away: 'T2' },
    m2: { data: { spiritNomineeHome: 'T2cap', spiritNomineeAway: 'T3cap' }, home: 'T2', away: 'T3' },
    m3: { data: { spiritNomineeHome: 'T3cap', spiritNomineeAway: 'T1cap' }, home: 'T3', away: 'T1' },
  };

  const c = buildScores({});
  const corrections = await c.breakSpiritTies('test', 'Test Group', spiritLog, api, { token: 't' }, rosterFor);

  const tally = {};
  Object.values(spiritLog).forEach((entry) => {
    [entry.data.spiritNomineeHome, entry.data.spiritNomineeAway].forEach((n) => { tally[n] = (tally[n] || 0) + 1; });
  });
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  eq('exactly two corrections were needed to break a 3-way tie down to one leader', corrections, 2);
  check('there IS now a single unambiguous leader (strictly more votes than #2)', ranked.length > 1 && ranked[0][1] > ranked[1][1]);
  eq('the leader is T1cap — the alphabetically-first of the original tied group, by the same tie order getSpiritAward uses',
    ranked[0][0], 'T1cap');
  check('the leader\'s OWN two matches (m1 home, m3 away) were never resubmitted — only a rival\'s matches were touched',
    !submitted.some((s) => (s.matchId === 'm1' && s.data.spiritNomineeHome !== 'T1cap')
      || (s.matchId === 'm3' && s.data.spiritNomineeAway !== 'T1cap')));
  check('a demoted rival\'s replacement nominee is a real teammate, not the same name repeated',
    submitted.every((s) => s.data.spiritNomineeHome !== s.data.spiritNomineeAway));
}

/* ======================================================================== */
section('breakSpiritTies(): a tally with no tie at the top is left completely untouched');
{
  const submitted = [];
  const api = { submitResult: async (matchId, data) => { submitted.push({ matchId, data }); return { ok: true }; } };
  const rosterFor = (agName, team) => [`${team}cap`, `${team}alt`];
  const spiritLog = {
    m1: { data: { spiritNomineeHome: 'Star', spiritNomineeAway: 'Runner1' }, home: 'S', away: 'R1' },
    m2: { data: { spiritNomineeHome: 'Star', spiritNomineeAway: 'Runner2' }, home: 'S', away: 'R2' },
  };
  const c = buildScores({});
  const corrections = await c.breakSpiritTies('test', 'Test Group', spiritLog, api, { token: 't' }, rosterFor);
  eq('no correction needed — "Star" already leads outright with 2 votes to everyone else\'s 1', corrections, 0);
  check('nothing was ever resubmitted', submitted.length === 0);
}

}

main().then(() => summary('test-simulate-spirit-award.js')).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
