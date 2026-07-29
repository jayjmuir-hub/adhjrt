/* tests/test-simulate-tournament.js
   ------------------------------------------------------------------------
   Jay, 29 Jul 2026: "i need a button in the organizer area that publishes
   all fixture schedules and sets the score of every match to a walk over
   for the first team listed in each match, it would then generate
   knockouts and set walkover scores for those, this would be for testing
   only, there would also be a single button to reset everything."

   Built as onSimulateTournament()/runSimulateTournament() and
   onResetSimulation()/runResetSimulation() in
   "Scores & Standings.dc.html", reusing the exact same api.* calls the
   real editor UI goes through (submitResult, autoKnockoutSlots, saveDraw,
   publishDraw, unpublishDraw, clearResult) - no second write path for a
   result or a draw.

   THE PART WORTH PROVING IS THE TWO-PASS KNOCKOUT GENERATION, because it
   has to work for BOTH bracket shapes with no special case in the new
   code:
     - the plain waterfall (most groups): CUP/BOWL/PLATE/SHIELD are seeded
       DIRECTLY from pool position the moment pools are complete - there
       is no semi-final round at all.
     - the U16B/U16G double bracket: real semis (TSF1/BSF1/...) feed the
       finals via the live store, so the finals cannot be known until the
       semis are scored.

   Pass 1 walks over anything that ISN'T a final (a no-op for the
   waterfall shape, the semis for the double bracket). Pass 2 regenerates
   (now picking up real semi winners for the double bracket) and walks
   over what IS a final.

   The fake api below is deliberately NOT a dumb call-counter - it models
   the real dependency chain: a knockout slot's home/away stay '' until
   the thing that decides them has actually been scored, exactly like
   scores-data.js's computeAutoKnockout does against the live store. That
   is what makes this test able to catch a broken two-pass order: if the
   real code tried to walk over a final before its semis were scored, the
   fake's autoKnockoutSlots would still be handing back '' for that final
   and the walkover loop's own `if (!slot.home || !slot.away) continue`
   would skip it - so a fault here doesn't throw, it silently produces the
   wrong knockoutGames count, which is exactly the kind of fault
   `_prove-registration.js` is meant to catch.

   Same DCLogic/loadComponent/build/section/check pattern as
   test-fixtures-results-sync.js and test-organizer-grouping.js - not
   reimplemented here.
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

const isFinal = (id) => /:(CUP|BOWL|PLATE|SHIELD|FINAL)$/i.test(id || '');

/* onSimulateTournament/onResetSimulation's promptModal callback fires
   runSimulateTournament()/runResetSimulation() WITHOUT awaiting it (a plain
   click handler can't await a click) - so a caller driving the dialog
   programmatically has to wait for the async work the same way the real UI
   does: watch simBusy flip back to false, not the return value of onConfirm
   itself, which resolves to undefined long before the work is done. */
async function flush(c) {
  let i = 0;
  while (c.state.simBusy && i < 2000) { // eslint-disable-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 0)); // eslint-disable-line no-await-in-loop
    i++;
  }
}

/* A small stand-in for scores-data.js's live store + bracket computation,
   covering exactly the two shapes this feature has to generalise across.
   'u9' is a plain waterfall group (no semis - finals seeded straight from
   pool rank). 'u16b' is a double-bracket group (real semis feeding the
   finals). 'u6' is a festival group (no standings, no knockout, scores
   refused). */
function makeFakeSimApi() {
  const results = {}; // matchId -> { winner, loser }
  const roster = {};  // matchId -> { home, away } - what a slot's teams are, once known
  const drafts = {
    u9: { slots: [
      { id: 'u9:A:0-1', home: 'A1', away: 'A2' },
      { id: 'u9:B:0-1', home: 'B1', away: 'B2' },
    ], pools: [{ id: 'A' }, { id: 'B' }], knockout: [] },
    u16b: { slots: [
      { id: 'u16b:A:0-1', home: 'A1', away: 'A2' },
      { id: 'u16b:B:0-1', home: 'B1', away: 'B2' },
    ], pools: [{ id: 'A' }, { id: 'B' }], knockout: [] },
    u6: { slots: [{ id: 'u6:A:0-1', home: 'A1', away: 'A2' }], pools: [{ id: 'A' }], knockout: [] },
  };
  const published = { u9: false, u16b: false, u6: false };

  // Seed the roster with the pool slots up front - a pool match's teams
  // are known before any result exists, same as the real draw.
  Object.values(drafts).forEach((d) => d.slots.forEach((s) => { roster[s.id] = { home: s.home, away: s.away }; }));

  function ageGroupOfMatch(matchId) { return String(matchId || '').split(':')[0]; }

  function computeKnockout(agId) {
    if (agId === 'u9') {
      const a = results['u9:A:0-1'];
      const b = results['u9:B:0-1'];
      const slots = (a && b)
        ? [
          { id: 'u9:CUP', home: a.winner, away: b.winner },
          { id: 'u9:BOWL', home: a.loser, away: b.loser },
        ]
        : [
          { id: 'u9:CUP', home: '', away: '' },
          { id: 'u9:BOWL', home: '', away: '' },
        ];
      slots.forEach((s) => { if (s.home && s.away) roster[s.id] = { home: s.home, away: s.away }; });
      return slots;
    }
    if (agId === 'u16b') {
      const a = results['u16b:A:0-1'];
      const b = results['u16b:B:0-1'];
      const semis = (a && b)
        ? [
          { id: 'u16b:TSF1', home: a.winner, away: b.winner },
          { id: 'u16b:BSF1', home: a.loser, away: b.loser },
        ]
        : [
          { id: 'u16b:TSF1', home: '', away: '' },
          { id: 'u16b:BSF1', home: '', away: '' },
        ];
      semis.forEach((s) => { if (s.home && s.away) roster[s.id] = { home: s.home, away: s.away }; });
      const tsf1 = results['u16b:TSF1'];
      const bsf1 = results['u16b:BSF1'];
      const finals = (tsf1 && bsf1)
        ? [
          { id: 'u16b:CUP', home: tsf1.winner, away: bsf1.winner },
          { id: 'u16b:BOWL', home: tsf1.loser, away: bsf1.loser },
        ]
        : [
          { id: 'u16b:CUP', home: '', away: '' },
          { id: 'u16b:BOWL', home: '', away: '' },
        ];
      finals.forEach((s) => { if (s.home && s.away) roster[s.id] = { home: s.home, away: s.away }; });
      return [...semis, ...finals];
    }
    return [];
  }

  return {
    api: {
      getDraw: async (agId) => JSON.parse(JSON.stringify(drafts[agId])),
      saveDraw: async (agId, draw) => { drafts[agId] = JSON.parse(JSON.stringify(draw)); return { ok: true }; },
      publishDraw: async (agId) => { published[agId] = true; return { ok: true }; },
      unpublishDraw: async (agId) => { published[agId] = false; return { ok: true }; },
      autoKnockoutSlots: async (agId) => computeKnockout(agId),
      submitResult: async (matchId, data) => {
        // u6 is festival - the real API refuses scores there. The fake
        // mirrors that so a fault removing the festival branch is caught
        // by this throwing/refusing rather than silently "working".
        if (ageGroupOfMatch(matchId) === 'u6' && data && data.clear !== true) {
          return { ok: false, error: 'Festival group refuses scores' };
        }
        const r = roster[matchId];
        if (!r || !r.home || !r.away) return { ok: false, error: 'unknown match' };
        results[matchId] = data.walkover === 'home' ? { winner: r.home, loser: r.away } : { winner: r.away, loser: r.home };
        return { ok: true };
      },
      clearResult: async (matchId) => { delete results[matchId]; return { ok: true }; },
      allResults: async () => ({ ...results }),
      ageGroupOfMatch,
    },
    _internals: { results, roster, drafts, published },
  };
}

const AGE_GROUPS = [
  { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
  { id: 'u16b', name: 'U16B Contact', hasStandings: true },
  { id: 'u6', name: 'U6 Mini', hasStandings: false },
];

function buildScores(overrides) {
  const c = build('Scores & Standings.dc.html', {});
  c.state = { ...c.state, session: { token: 't', ageGroupId: '*' }, ageGroups: AGE_GROUPS, ...overrides };
  return c;
}

async function main() {

/* ======================================================================== */
section('The binding contract: the new tokens actually exist in the markup');
{
  const scores = readRepo('Scores & Standings.dc.html');
  check('the panel button is wired to onSimulateTournament', /onClick="\{\{ onSimulateTournament \}\}"/.test(scores));
  check('…and the reset button to onResetSimulation', /onClick="\{\{ onResetSimulation \}\}"/.test(scores));
  check('simBusy is a real renderVals key, not a typo the template silently swallows', /simBusy:\s*s\.simBusy/.test(scores));
  check('…so is simMsg', /simMsg:\s*s\.simMsg/.test(scores));
  check('…so is simProgress', /simProgress:\s*s\.simProgress/.test(scores));
  check('onSimulateTournament itself is a real renderVals key', /onSimulateTournament:\s*\(\)\s*=>\s*this\.onSimulateTournament\(\)/.test(scores));
  check('onResetSimulation itself is a real renderVals key', /onResetSimulation:\s*\(\)\s*=>\s*this\.onResetSimulation\(\)/.test(scores));
  check('the panel is gated to organisers only',
    /SIMULATE A TOURNAMENT[\s\S]{0,60}-->\s*<sc-if value="\{\{ isOrganiserView \}\}"[^>]*>[\s\S]{0,300}Simulate a tournament/.test(scores));
}

/* ======================================================================== */
section('runSimulateTournament(): waterfall group (u9) - finals seeded directly, no semis');
{
  const { api, _internals } = makeFakeSimApi();
  const c = buildScores({ api });
  await c.runSimulateTournament();

  check('both pool matches were walked over', _internals.results['u9:A:0-1'] && _internals.results['u9:B:0-1']);
  check('CUP was seeded straight from pool winners and walked over', _internals.results['u9:CUP']);
  check('BOWL was seeded straight from pool losers and walked over', _internals.results['u9:BOWL']);
  check('the age group was published', _internals.published.u9 === true);
  check('the saved draw kept its pools/slots untouched by the knockout save',
    _internals.drafts.u9.slots.length === 2 && _internals.drafts.u9.slots[0].home === 'A1');
}

/* ======================================================================== */
section('runSimulateTournament(): double-bracket group (u16b) - semis must be scored before finals exist');
{
  const { api, _internals } = makeFakeSimApi();
  const c = buildScores({ api });
  await c.runSimulateTournament();

  check('both pool matches were walked over', _internals.results['u16b:A:0-1'] && _internals.results['u16b:B:0-1']);
  check('pass 1 walked over the semis', _internals.results['u16b:TSF1'] && _internals.results['u16b:BSF1']);
  check('…and only THEN did pass 2 walk over the finals, fed from the semi winners/losers',
    _internals.results['u16b:CUP'] && _internals.results['u16b:BOWL']);
  check('the CUP final is actually seeded from the semi winners, not a guess - CUP\'s home team IS the TSF1 winner',
    (_internals.roster['u16b:CUP'] || {}).home === (_internals.results['u16b:TSF1'] || {}).winner
    && !!_internals.roster['u16b:CUP']);
  check('the age group was published', _internals.published.u16b === true);
}

/* ======================================================================== */
section('runSimulateTournament(): festival group (u6) - published only, never scored');
{
  const { api, _internals } = makeFakeSimApi();
  const c = buildScores({ api });
  await c.runSimulateTournament();

  check('u6 has no recorded result at all', !Object.keys(_internals.results).some((id) => id.startsWith('u6:')));
  check('…but it was still published', _internals.published.u6 === true);
}

/* ======================================================================== */
section('runSimulateTournament(): the summary message counts what actually happened');
{
  const { api } = makeFakeSimApi();
  const c = buildScores({ api });
  await c.runSimulateTournament();
  // 2 pool matches per standings group x2 groups = 4 pool walkovers.
  // u9: 2 knockout games (no semis). u16b: 2 semis + 2 finals = 4. Total 6.
  // Published: u9 + u16b + u6 = 3.
  check('pools/knockout/published counts are exact, not just non-zero, and nothing failed',
    c.state.simMsg === 'Simulated 4 pool results and 6 knockout results, published 3 age groups.');
  check('simBusy is cleared when done', c.state.simBusy === false);
}

/* ======================================================================== */
section('runResetSimulation(): unpublishes everything, clears only recorded results and generated knockouts');
{
  const { api, _internals } = makeFakeSimApi();
  const c = buildScores({ api });
  await c.runSimulateTournament(); // seed a full simulated tournament first
  await c.runResetSimulation();

  check('every age group was unpublished, including the festival group', !_internals.published.u9 && !_internals.published.u16b && !_internals.published.u6);
  check('every recorded result was removed', Object.keys(_internals.results).length === 0);
  check('u9\'s saved draw had its knockout cleared', Array.isArray(_internals.drafts.u9.knockout) && _internals.drafts.u9.knockout.length === 0);
  check('u16b\'s saved draw had its knockout cleared too', Array.isArray(_internals.drafts.u16b.knockout) && _internals.drafts.u16b.knockout.length === 0);
  check('…but pools/slots were left completely untouched', _internals.drafts.u9.slots.length === 2 && _internals.drafts.u9.slots[0].home === 'A1');
  check('the festival group (no standings) was never asked to save a knockout-cleared draw',
    _internals.drafts.u6.slots.length === 1);
}

/* ======================================================================== */
section('onSimulateTournament()/onResetSimulation(): the tournament-day guard');
{
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { api } = makeFakeSimApi();
  api.venue = () => ({ day1: { date: todayStr }, day2: { date: '2099-01-01' } });
  const c = buildScores({ api });
  c.onSimulateTournament();
  check('on a real tournament day, pressing Simulate does not even open the confirm dialog', c.state.modal === null);
  c.onResetSimulation();
  check('…and neither does Reset', c.state.modal === null);
}

/* ======================================================================== */
section('onSimulateTournament(): requires the exact typed word before running anything');
{
  const { api, _internals } = makeFakeSimApi();
  const c = buildScores({ api });
  c.onSimulateTournament();
  check('off a tournament day, the confirm dialog does open', c.state.modal && c.state.modal.kind === 'prompt');

  // Wrong word: the dialog's own onConfirm is what a real click on "OK" invokes.
  // A fault that removes the typed-word check would fire runSimulateTournament()
  // here too (unawaited, same as the real click handler) - flush() lets that
  // work actually finish before asserting nothing ran, rather than racing it.
  c.state.modal.onConfirm('please');
  await flush(c);
  check('a near-miss is refused, not run', Object.keys(_internals.results).length === 0);
  check('…and says what was typed', /you typed "please"/.test(c.state.simMsg));

  // Right word, case-insensitive, whitespace-trimmed - re-open the dialog first.
  c.onSimulateTournament();
  c.state.modal.onConfirm('  simulate  ');
  await flush(c);
  check('typing the word (any case, untrimmed) runs the real simulation', Object.keys(_internals.results).length > 0);
}

/* ======================================================================== */
section('onResetSimulation(): same typed-word gate, independently');
{
  const { api, _internals } = makeFakeSimApi();
  const c = buildScores({ api });
  await c.runSimulateTournament();
  const before = Object.keys(_internals.results).length;
  check('sanity: the simulation actually recorded something to reset', before > 0);

  c.onResetSimulation();
  c.state.modal.onConfirm('nope');
  check('a near-miss does not reset anything', Object.keys(_internals.results).length === before);

  c.onResetSimulation();
  c.state.modal.onConfirm('RESET');
  await flush(c);
  check('typing RESET actually clears the results', Object.keys(_internals.results).length === 0);
}

}

main().then(() => summary('test-simulate-tournament.js')).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
