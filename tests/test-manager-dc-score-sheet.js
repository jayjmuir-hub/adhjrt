/* tests/test-manager-dc-score-sheet.js
   ------------------------------------------------------------------------
   The score-entry sheet on Manager.dc.html, ported from Manager.html's
   openMatch(). This is the riskiest port in the rebuild — walkover handling,
   the 0-0 confirmation and the live running total are all currently-working
   logic being re-expressed in this.state/setState — so it gets its own file
   and every check below is proven against an injected fault.

   Harness: the .dc.html pattern (DCLogic stand-in + regex the
   <script type="text/x-dc"> block out and eval it), duplicated per test file
   as this project does throughout.
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

/* Two scoring parts, with REAL point weights, so the running total is a
   calculation with a knowable answer rather than a constant. */
const POINTS = { tries: 5, conversions: 2 };

function sheetApi(overrides) {
  return Object.assign({
    scoringFor: () => ['tries', 'conversions'],
    scoreLabel: (k) => ({ tries: 'Tries', conversions: 'Conversions' })[k] || k,
    scorePoints: (k) => POINTS[k] || 0,
    scoreTotal: (agId, parts) => ['tries', 'conversions']
      .reduce((sum, k) => sum + Math.max(0, Math.floor(Number((parts || {})[k]) || 0)) * POINTS[k], 0),
    supportsSpiritAward: () => false,
    submitResult: async () => ({ ok: true, stored: { homeScore: 17, awayScore: 0 } }),
    clearResult: async () => ({ ok: true }),
    teamLabel: (c) => c,
    getFixtures: async () => FIXTURES(),
    getStandings: async () => ({ awaitingPublication: false, ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [], tables: {}, _advance: 0 }),
    getSpiritAward: async () => ({ supported: false }),
    canPublishNow: () => false,
    isOrganiserSession: () => false,
    describeClash: (c) => `${c.a.agName} vs ${c.b.agName}`,
  }, overrides || {});
}

function FIXTURES() {
  return {
    awaitingPublication: false,
    pool: [
      { id: 'u14b:A:1-2', home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null },
      { id: 'u14b:A:3-4', home: 'DS1', away: 'DT1', time: '09:20', pitch: 'A1', poolName: 'Pool A',
        result: { homeScore: 17, awayScore: 5, homeTries: 3, homeConversions: 1, awayTries: 1, awayConversions: 0,
                  homeCards: 1, awayCards: 0, walkover: null, spiritNomineeHome: 'Sam Jones', spiritNomineeAway: '' } },
    ],
    knockout: [
      { id: 'u14b:CUP', round: 'Cup Final', home: 'ADH1', away: 'DS1', time: '13:00', pitch: 'A1', result: null },
    ],
  };
}

function buildSheet(apiOverrides) {
  const c = build('Manager.dc.html');
  c.state = {
    ...c.state,
    api: sheetApi(apiOverrides),
    session: { ageGroupId: 'u14b', token: 'tok' },
    ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }],
    ageId: 'u14b',
    fixtures: FIXTURES(),
    tab: 'fixtures',
  };
  return c;
}

async function main() {

section('openMatch(): the sheet opens on the right match, seeded from the saved result');
{
  const c = buildSheet();
  c.openMatch('u14b:A:3-4');
  check('the sheet is open on that match', c.state.sheetMatchId === 'u14b:A:3-4');
  // FAULT-PROOF: a port that opened the sheet with a blank draft would still
  // "work" visually but would silently zero a saved score on the next save.
  check('home tries are seeded from the saved result', Number(c.state.sheetDraft.homeTries) === 3);
  check('home conversions are seeded from the saved result', Number(c.state.sheetDraft.homeConversions) === 1);
  check('away tries are seeded from the saved result', Number(c.state.sheetDraft.awayTries) === 1);
  check('cards are seeded from the saved result', Number(c.state.sheetDraft.homeCards) === 1);
  check('the spirit nomination is seeded from the saved result', c.state.sheetDraft.spiritNomineeHome === 'Sam Jones');

  const vals = c.renderVals();
  check('renderVals reports the sheet as open', vals.sheetOpen === true);
  check('the sheet names both teams', vals.sheetHomeName === 'DS1' && vals.sheetAwayName === 'DT1');
  check('an already-scored match offers "Update result"', vals.sheetSaveLabel === 'Update result');
}
{
  const c = buildSheet();
  c.openMatch('u14b:A:1-2');
  check('an unplayed match starts at zero', Number(c.state.sheetDraft.homeTries) === 0 && Number(c.state.sheetDraft.awayTries) === 0);
  check('…and offers "Save result"', c.renderVals().sheetSaveLabel === 'Save result');
  check('…with no walkover selected', c.state.sheetDraft.walkover === '');
}
{
  const c = buildSheet();
  c.openMatch('u14b:CUP');
  check('a knockout match can be opened too', c.state.sheetMatchId === 'u14b:CUP');
  c.openMatch('u14b:NOT-A-MATCH');
  check('an unknown match id leaves the open sheet alone rather than blanking it', c.state.sheetMatchId === 'u14b:CUP');
}

section('Live total recalculation');
{
  const c = buildSheet();
  c.openMatch('u14b:A:1-2');
  check('both totals start at 0', c.sheetTotal('home') === 0 && c.sheetTotal('away') === 0);

  const vals = c.renderVals();
  const homeTries = vals.sheetHomeFields.find((f) => f.key === 'homeTries');
  check('the sheet builds one input per scoring part from api.scoringFor()',
    eq('home field keys', vals.sheetHomeFields.map((f) => f.key), ['homeTries', 'homeConversions']));
  check('each input carries its label and point value', homeTries.label === 'Tries' && homeTries.pts === '5 pts');

  homeTries.onInput({ target: { value: '3' } });
  // FAULT-PROOF on the arithmetic itself: 3 tries at 5 = 15, not 3 and not 0.
  check('typing 3 tries makes the home total 15', c.sheetTotal('home') === 15);
  c.renderVals().sheetHomeFields.find((f) => f.key === 'homeConversions').onInput({ target: { value: '1' } });
  check('adding a conversion makes it 17', c.sheetTotal('home') === 17);
  check('the away total is still 0 — the two sides do not share a draft', c.sheetTotal('away') === 0);
  check('renderVals publishes the recalculated total', c.renderVals().sheetHomeTotal === 17);

  c.renderVals().sheetAwayFields.find((f) => f.key === 'awayTries').onInput({ target: { value: '2' } });
  check('the away side totals independently', c.sheetTotal('away') === 10 && c.sheetTotal('home') === 17);
}

section('Walkover handling');
{
  const c = buildSheet();
  c.openMatch('u14b:A:1-2');
  c.renderVals().sheetHomeFields.find((f) => f.key === 'homeTries').onInput({ target: { value: '3' } });
  check('setup: home is on 15 before the walkover', c.sheetTotal('home') === 15);

  c.setSheetWalkover('home');
  check('a home walkover shows 20 for home', c.sheetTotal('home') === 20);
  check('…and 0 for away, whatever was typed', c.sheetTotal('away') === 0);

  const vals = c.renderVals();
  check('the scoring inputs are disabled while a walkover is set',
    vals.sheetHomeFields.every((f) => f.disabled === true) && vals.sheetAwayFields.every((f) => f.disabled === true));
  check('…and dimmed, the same visual cue the old sheet used',
    vals.sheetHomeFields.every((f) => f.opacity === '0.45'));
  check('the chosen walkover button is the highlighted one', vals.woHomeStyle.includes('#E11B22') && !vals.woAwayStyle.includes('#E11B22'));

  c.setSheetWalkover('away');
  check('switching to an away walkover flips the totals', c.sheetTotal('home') === 0 && c.sheetTotal('away') === 20);

  c.setSheetWalkover('');
  // FAULT-PROOF: a port that cleared the typed numbers when the walkover was
  // set would show 0 here instead of the 15 the manager actually typed.
  check('clearing the walkover restores the typed totals', c.sheetTotal('home') === 15);
  check('…and re-enables the inputs', c.renderVals().sheetHomeFields.every((f) => f.disabled === false));
}

section('The 0-0 confirmation');
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 0, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.saveSheet();
  // FAULT-PROOF: this is the whole point — an all-zero save must ASK first,
  // because 0-0 is a real draw worth two league points each, not "no result".
  check('saving an all-zero sheet asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…in words that say what 0-0 costs', /two league points/i.test(c.state.modal.title));
  check('…and points at Clear result for the other intent', /Clear result/i.test(c.state.modal.title));
  check('…and nothing has been submitted yet', submitted === 0);

  c.closeModal();
  check('cancelling the 0-0 question submits nothing', submitted === 0);
  check('…and leaves the sheet open so the score can be typed', c.state.sheetMatchId === 'u14b:A:1-2');

  c.saveSheet();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming the 0-0 question does submit', submitted === 1);
}
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 5, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.renderVals().sheetHomeFields.find((f) => f.key === 'homeTries').onInput({ target: { value: '1' } });
  c.saveSheet();
  await new Promise((r) => setImmediate(r));
  check('a non-zero score is saved without asking', c.state.modal === null && submitted === 1);
}
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 20, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.setSheetWalkover('home');
  c.saveSheet();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: a walkover IS an all-zero form, so a 0-0 check that ignored
  // the walkover flag would nag on every walkover ever recorded.
  check('a walkover is not mistaken for a 0-0 draw', c.state.modal === null && submitted === 1);
}
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 0, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeCards', '1');
  c.saveSheet();
  // FAULT-PROOF: cards are not points. A 0-0 with a yellow card is still a
  // 0-0 draw and must still be confirmed — a zero check that swept cards in
  // would skip the question.
  check('a card does not make an all-zero sheet count as scored', !!c.state.modal && submitted === 0);
}

section('The payload sent to submitResult()');
{
  let payload = null, sentId = null, sentSession = null;
  const c = buildSheet({
    supportsSpiritAward: () => true,
    submitResult: async (id, data, session) => { sentId = id; payload = data; sentSession = session; return { ok: true, stored: { homeScore: 17, awayScore: 5 } }; },
  });
  c.openMatch('u14b:A:3-4');
  c.setSheetField('homeTries', '3');
  c.setSheetField('homeConversions', '1');
  c.setSheetField('awayTries', '1');
  c.setSheetField('homeCards', '2');
  c.setSheetField('spiritNomineeHome', 'Sam Jones');
  await c.saveSheet();
  check('it posts against the match that is open', sentId === 'u14b:A:3-4');
  check('it passes the session through', sentSession && sentSession.token === 'tok');
  check('walkover is null, not the empty string, when none is set', payload.walkover === null);
  check('every scoring part is sent as a NUMBER, not the input\'s string',
    payload.homeTries === 3 && payload.homeConversions === 1 && payload.awayTries === 1
    && typeof payload.homeTries === 'number');
  check('cards are sent as numbers too', payload.homeCards === 2 && payload.awayCards === 0);
  check('the spirit nomination is sent when the age group supports it', payload.spiritNomineeHome === 'Sam Jones');
}
{
  let payload = null;
  const c = buildSheet({
    supportsSpiritAward: () => false,
    submitResult: async (id, data) => { payload = data; return { ok: true, stored: { homeScore: 5, awayScore: 0 } }; },
  });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '1');
  await c.saveSheet();
  // FAULT-PROOF: the nomination fields must be gated on supportsSpiritAward(),
  // not sent unconditionally with empty strings.
  check('no spirit fields are sent when the age group does not support the award',
    payload.spiritNomineeHome === undefined && payload.spiritNomineeAway === undefined);
  check('the sheet does not offer the spirit inputs either', c.renderVals().sheetShowSpirit === false);
}
{
  const c = buildSheet({ supportsSpiritAward: () => true });
  c.openMatch('u14b:A:1-2');
  check('the sheet DOES offer the spirit inputs for a supporting age group', c.renderVals().sheetShowSpirit === true);
}

section('Where the spirit inputs sit (Aug 2026: inside each team\'s box, right under Cards)');
{
  /* Jay's call: parked at the bottom of the sheet the nominee boxes were
     routinely missed. Each one now lives INSIDE its team's bordered box,
     directly below that team's Cards row. Structural, on comment-stripped
     source: order is asserted by index, not by the inputs merely existing. */
  const src = readRepo('Manager.dc.html').replace(/<!--[\s\S]*?-->/g, '');
  const homeCards = src.indexOf('{{ onSheetHomeCards }}');
  const homeSpirit = src.indexOf('{{ onSheetSpiritHome }}');
  const awayCards = src.indexOf('{{ onSheetAwayCards }}');
  const awaySpirit = src.indexOf('{{ onSheetSpiritAway }}');
  const woBlock = src.indexOf('WALK-OVER');
  check('all four inputs and the walkover block were found',
    [homeCards, homeSpirit, awayCards, awaySpirit, woBlock].every((i) => i > -1));
  check('the home nominee comes directly after the home Cards row, before the away box even starts',
    homeCards < homeSpirit && homeSpirit < awayCards);
  check('the away nominee comes after the away Cards row', awayCards < awaySpirit);
  check('…and before the walkover block — i.e. inside the away box, not at the bottom of the sheet',
    awaySpirit < woBlock);
  /* Each input keeps its team's name as the placeholder, so the two boxes
     cannot be filled in swapped. */
  const homeTag = (src.match(/<input[^>]*\{\{ onSheetSpiritHome \}\}[^>]*>/) || [''])[0];
  const awayTag = (src.match(/<input[^>]*\{\{ onSheetSpiritAway \}\}[^>]*>/) || [''])[0];
  check('the home input is labelled with the home team', /\{\{ sheetHomeName \}\} player/.test(homeTag));
  check('the away input is labelled with the away team', /\{\{ sheetAwayName \}\} player/.test(awayTag));
  /* Two gated blocks now (one per box) — and the old single bottom block,
     whose label read "SPIRIT OF RUGBY — ONE NOMINATION PER SIDE", is gone. */
  check('each box carries its own sheetShowSpirit gate',
    (src.match(/\{\{ sheetShowSpirit \}\}/g) || []).length === 2);
  check('the old bottom block\'s label is gone', !src.includes('SPIRIT OF RUGBY — ONE NOMINATION PER SIDE'));
}
{
  let payload = null;
  const c = buildSheet({ submitResult: async (id, data) => { payload = data; return { ok: true, stored: { homeScore: 20, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.setSheetWalkover('away');
  await c.saveSheet();
  check('a walkover is sent as the side that was awarded the match', payload.walkover === 'away');
}

section('After a save');
{
  let loads = 0;
  const c = buildSheet({
    getFixtures: async () => { loads++; return FIXTURES(); },
    submitResult: async () => ({ ok: true, stored: { homeScore: 17, awayScore: 5 } }),
  });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '3');
  await c.saveSheet();
  check('a saved sheet closes', c.state.sheetMatchId === null);
  // FAULT-PROOF: the toast must echo the SERVER's stored figures, not the
  // form's — that is the confirmation the score really landed.
  check('the toast echoes the score the server stored', c.state.toast === 'Saved 17–5');
  check('the tab data is refetched so tables and results catch up', loads === 1);
}
{
  const c = buildSheet({ submitResult: async () => ({ ok: true }) });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '3');
  await c.saveSheet();
  check('a save with no stored echo still confirms something happened', c.state.toast === 'Result saved');
}
{
  let loads = 0;
  const c = buildSheet({
    getFixtures: async () => { loads++; return FIXTURES(); },
    submitResult: async () => ({ ok: false, error: 'You can only enter scores for your own age group.' }),
  });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '3');
  await c.saveSheet();
  // FAULT-PROOF: a rejected save must NOT close the sheet — the manager would
  // otherwise believe a score they typed was saved.
  check('a rejected save leaves the sheet open', c.state.sheetMatchId === 'u14b:A:1-2');
  check('…shows the server\'s reason', c.state.sheetError === 'You can only enter scores for your own age group.');
  check('…keeps the typed numbers', Number(c.state.sheetDraft.homeTries) === 3);
  check('…and does not refetch as if something changed', loads === 0);
  check('…and the Save button is usable again', c.renderVals().sheetBusy === false);
}

section('Clear result');
{
  let cleared = 0, clearedId = null, loads = 0;
  const c = buildSheet({
    getFixtures: async () => { loads++; return FIXTURES(); },
    clearResult: async (id) => { cleared++; clearedId = id; return { ok: true }; },
  });
  c.openMatch('u14b:A:3-4');
  c.clearSheet();
  check('clearing asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…in words that say the match goes back to unplayed', /back to unplayed/i.test(c.state.modal.title));
  check('…and nothing is cleared until it is confirmed', cleared === 0);
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming clears that match', cleared === 1 && clearedId === 'u14b:A:3-4');
  check('…closes the sheet', c.state.sheetMatchId === null);
  check('…says so', c.state.toast === 'Result cleared');
  check('…and refetches so the table is recalculated', loads === 1);
}
{
  const c = buildSheet({ clearResult: async () => ({ ok: false, error: 'Not signed in.' }) });
  c.openMatch('u14b:A:3-4');
  c.clearSheet();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('a failed clear leaves the sheet open with the reason',
    c.state.sheetMatchId === 'u14b:A:3-4' && c.state.sheetError === 'Not signed in.');
}
{
  const c = buildSheet();
  c.openMatch('u14b:A:3-4');
  check('a scored match offers Clear result', c.renderVals().sheetHasResult === true);
  c.openMatch('u14b:A:1-2');
  // FAULT-PROOF: an unplayed match has nothing to clear; offering the button
  // there implies a result exists.
  check('an unplayed match does not', c.renderVals().sheetHasResult === false);
  c.closeSheet();
  check('closing the sheet drops the draft', c.state.sheetMatchId === null && c.state.sheetError === '');
}

summary('tests/test-manager-dc-score-sheet.js');
}

main();
