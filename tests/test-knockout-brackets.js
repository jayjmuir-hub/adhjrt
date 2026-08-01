/* tests/test-knockout-brackets.js
   ------------------------------------------------------------------------
   Jay, 1 Aug 2026: wants a 4-pool age group format (Cup/Bowl/Plate/Shield)
   for the simulated-tournament rebuild — Quins/Tigers/5 others field 2
   teams each, 16 teams per age group, 4 pools of 4. The existing bracket
   generator in scores-data.js (buildBracket) only ever had two shapes:
   exactly 2 pools (a single cross-pool match settles each tier outright)
   or a single pool (semis + final off the raw standings). 4 pools had NO
   code path at all — it silently fell into the single-pool fallback and
   read ONLY pools[0], ignoring the other three pools completely.

   This adds the 4-pool waterfall: each tier (Cup/Bowl/Plate/Shield) is the
   four teams that finished at that RANK in their own pool (all four pool
   winners form the Cup bracket, all four runners-up form the Bowl, etc.),
   with a semi round (Pool A v Pool D, Pool B v Pool C) since — unlike the
   2-pool case — there are 4 candidates for the tier, not 2.

   WHY THIS TESTS THE REAL FUNCTION, NOT A DESCRIPTION OF IT.
   buildBracket()/computeAutoKnockout() are now exported test-only from
   scores-data.js specifically so this file can import and call them
   directly (Node's native ESM loader, no browser shim needed — the
   functions touch only their arguments, never fetch/document). Every
   other simulate/knockout test in this repo (test-simulate-tournament.js)
   asserts through a hand-rolled mock of the whole knockout computation,
   which is fine for proving runSimulateTournament()'s own two-pass
   orchestration but would prove NOTHING about whether the bracket algorithm
   itself is correct — a fault in the real buildBracket would sail straight
   through a test that never calls it.
*/

const path = require('path');
const { section, check, eq, summary } = require('./_lib');

function repoRoot() {
  const cands = [process.env.ADHJRT_REPO, path.join(__dirname, '..')].filter(Boolean);
  return cands[0];
}

async function loadScoresData() {
  const p = path.join(repoRoot(), 'scores-data.js').replace(/\\/g, '/');
  const url = p.startsWith('/') ? `file://${p}` : `file:///${p}`;
  return import(url);
}

// A team name that encodes exactly where it finished, so a mis-wired rank
// or a mis-paired pool shows up immediately as the WRONG team name in a
// slot, not just a missing/present check.
function poolTable(poolLetter) {
  return [1, 2, 3, 4].map((rank) => ({ team: `${poolLetter}${rank}`, rank }));
}

function fourPoolFixture() {
  const pools = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
  const tables = { A: poolTable('A'), B: poolTable('B'), C: poolTable('C'), D: poolTable('D') };
  // One pool-stage slot per pool, all with a recorded result, so
  // poolsComplete is true — buildBracket refuses to seed anything real
  // until every pool-stage fixture has a result.
  const slots = pools.map((p) => ({ id: `test:${p.id}:0-1`, home: `${p.id}1`, away: `${p.id}2` }));
  const store = {};
  slots.forEach((s) => { store[s.id] = { homeScore: 20, awayScore: 0 }; });
  const draw = { pools, slots };
  const ag = { id: 'test', advance: 4 };
  return { ag, draw, tables, store };
}

function findRound(rounds, roundName) {
  return rounds.find((r) => r.round === roundName);
}

async function main() {

const { buildBracket } = await loadScoresData();

/* ======================================================================== */
section('buildBracket(): 4 pools — Cup/Bowl/Plate/Shield seeded by cross-pool RANK, not by pool');
{
  const { ag, draw, tables, store } = fourPoolFixture();
  const rounds = buildBracket(ag, draw, tables, store);

  check('12 rounds come back: 4 tiers x (SF1, SF2, Final)', rounds.length === 12);

  const cupSf1 = findRound(rounds, 'Cup — Semi-Final 1').games[0];
  const cupSf2 = findRound(rounds, 'Cup — Semi-Final 2').games[0];
  eq('Cup SF1 is Pool A v Pool D at RANK 1 (index 0), not rank 2', cupSf1.home, 'A1');
  eq('…away side is D1', cupSf1.away, 'D1');
  eq('Cup SF2 is Pool B v Pool C at rank 1', cupSf2.home, 'B1');
  eq('…away side is C1', cupSf2.away, 'C1');
  eq('Cup SF1 id is stable and namespaced under the tier, not a bare SF1',
    cupSf1.id, 'test:CUP:SF1');

  const bowlSf1 = findRound(rounds, 'Bowl — Semi-Final 1').games[0];
  eq('Bowl uses RANK 2 (index 1), not rank 1 again — this is the check that would catch an off-by-one in the tier rank',
    bowlSf1.home, 'A2');
  eq('…and Pool D\'s rank-2 finisher, not rank 1', bowlSf1.away, 'D2');

  const plateSf1 = findRound(rounds, 'Plate — Semi-Final 1').games[0];
  eq('Plate uses rank 3 (index 2)', plateSf1.home, 'A3');

  const shieldSf1 = findRound(rounds, 'Shield — Semi-Final 1').games[0];
  eq('Shield uses rank 4 (index 3), the last-place finishers', shieldSf1.home, 'A4');
  eq('…away side too', shieldSf1.away, 'D4');

  const cupFinal = findRound(rounds, 'Cup Final').games[0];
  check('the Cup Final is not seeded until its semis have results (TBD v TBD)',
    cupFinal.home === null && cupFinal.away === null);
  eq('the Cup Final id has no semi suffix — this is what isFinal() in the Simulate '
    + 'tool matches on to know a slot is a real final', cupFinal.id, 'test:CUP');
}

/* ======================================================================== */
section('buildBracket(): 4 pools — the final is fed from the ACTUAL semi winners, not a guess');
{
  const { ag, draw, tables, store } = fourPoolFixture();
  // Score both Cup semis: A1 beats D1 (home win), C1 beats B1 (away win) —
  // deliberately NOT "home always wins" for both, so a fault that hardcodes
  // "the final's home team is always the SF1 home team" gets caught.
  store['test:CUP:SF1'] = { homeScore: 20, awayScore: 0 };  // A1 (home) wins
  store['test:CUP:SF2'] = { homeScore: 0, awayScore: 20 };  // C1 (away) wins
  const rounds = buildBracket(ag, draw, tables, store);
  const cupFinal = findRound(rounds, 'Cup Final').games[0];
  eq('Cup Final home is SF1\'s actual winner (A1)', cupFinal.home, 'A1');
  eq('Cup Final away is SF2\'s actual winner (C1, the away-side winner)', cupFinal.away, 'C1');
}

/* ======================================================================== */
section('buildBracket(): 4 pools — nothing is seeded at all until every pool-stage fixture has a result');
{
  const { ag, draw, tables, store } = fourPoolFixture();
  delete store['test:D:0-1']; // Pool D's pool-stage match is still unplayed
  const rounds = buildBracket(ag, draw, tables, store);
  const cupSf1 = findRound(rounds, 'Cup — Semi-Final 1').games[0];
  check('with one pool-stage fixture still unplayed, the whole bracket shows TBD, not a partial seed',
    cupSf1.home === null && cupSf1.away === null);
}

/* ======================================================================== */
section('buildBracket(): 2-pool age groups are UNCHANGED — the new 4-pool branch does not shadow the existing one');
{
  const pools = [{ id: 'A' }, { id: 'B' }];
  const tables = { A: poolTable('A'), B: poolTable('B') };
  const slots = pools.map((p) => ({ id: `test2:${p.id}:0-1`, home: `${p.id}1`, away: `${p.id}2` }));
  const store = {};
  slots.forEach((s) => { store[s.id] = { homeScore: 20, awayScore: 0 }; });
  const draw = { pools, slots };
  const ag = { id: 'test2', advance: 4 };
  const rounds = buildBracket(ag, draw, tables, store);

  check('2-pool age groups still get exactly 4 rounds (one match per tier, no semis)', rounds.length === 4);
  const cup = rounds.find((r) => r.round === 'Cup Final').games[0];
  eq('a 2-pool Cup Final is still seeded DIRECTLY from pool winners, no semi needed', cup.home, 'A1');
  eq('id is unchanged from before this change', cup.id, 'test2:CUP');
}

}

main().then(() => summary('test-knockout-brackets.js')).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
