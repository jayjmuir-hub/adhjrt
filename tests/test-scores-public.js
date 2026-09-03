/* tests/test-scores-public.js
   ------------------------------------------------------------------------
   /scores after the Manager area came out (Aug 2026,
   claude/specs/spec-scores-manager-removal.md): a purely public results
   page. This file asserts what REMAINS, driven through the real component —
   the headline lesson of this repo is that a deletion this size is one bad
   selection away from deleting more, and absence-only checks pass on an
   empty page. So: presence and behaviour first, absence second.

   ⚠️ Every fixture value is invented. Never build one from real data.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function build(props) {
  const t = readRepo('Scores & Standings.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script found');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
  const c = new C();
  c.props = props || {};
  return c;
}

const AGE_GROUPS = [
  { id: 'u6', name: 'U6 Tag', hasStandings: false },
  { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
  { id: 'u16b', name: 'U16B Contact', hasStandings: true },
];

/* A published standings answer in the shape getStandings() returns. */
function standingsFixture() {
  return {
    awaitingPublication: false,
    ageGroup: { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
    pools: [{ id: 'A', name: 'Pool A', teams: ['ZZ1', 'QQ1'] }],
    tables: { A: [
      { team: 'ZZ1', p: 1, w: 1, d: 0, l: 0, pf: 20, pa: 0, pts: 4 },
      { team: 'QQ1', p: 1, w: 0, d: 0, l: 1, pf: 0, pa: 20, pts: 0 },
    ] },
    bracket: [{ round: 'Cup Final', games: [{ id: 'u9:CUP', home: 'ZZ1', away: 'QQ1', result: null }] }],
    _advance: 2,
  };
}

function fakeApi(overrides) {
  return Object.assign({
    getStandings: async () => standingsFixture(),
    /* The public picker groups its chips by DAY, read off the venue layout, so
       renderVals() calls these two. The stand-in puts every U1x on day two and
       everything else on day one, which is close enough to the real layout to
       exercise both blocks — the point here is the grouping, not the calendar.
       ⚠️ Whenever renderVals starts reading a new api function, it joins this
       stub in the same commit or the whole file dies on a TypeError and every
       fault after it reports as caught while proving nothing. */
    isDayOne: (id) => !/^u1[2-6]g?$|^u13$|^u14/.test(String(id)),
    dayLabelOfAgeGroup: (id) => (/^u1[2-6]g?$|^u13$|^u14/.test(String(id))
      ? 'Sunday 8 November' : 'Saturday 7 November'),
    teamShort: (v) => v,
    teamLogoSrc: () => '',
    teamKey: () => [{ code: 'ZZ1', name: 'Zebra Zoo', logoSrc: '' }],
  }, overrides || {});
}

/* The public age chips, flattened out of their day blocks. */
function publicTabs(vals) {
  return (vals.ageDayBlocks || []).reduce((all, d) => all.concat(d.tabs || []), []);
}

async function main() {

/* ====================================================================== */
section('What remains: the public page still renders standings, brackets, tabs');
{
  let asked = [];
  const c = build({});
  c.state = { ...c.state, api: fakeApi({ getStandings: async (id) => { asked.push(id); return standingsFixture(); } }),
    ageGroups: AGE_GROUPS, selectedAgeId: 'u9' };
  await c.loadPublic();
  eq('loadPublic fetches the selected group\'s standings', asked, ['u9']);

  const vals = c.renderVals();
  check('the page reports itself public', vals.isPublic === true);
  /* The picker is grouped by DAY now (6 Aug 2026), so renderVals returns
     ageDayBlocks rather than a flat ageTabs. Flattened here because what this
     check is about is WHICH groups are offered, not how they are arranged —
     the arrangement has its own file, test-age-group-picker.js. */
  eq('festival groups are hidden from the public tabs', publicTabs(vals).map((t) => t.name),
    ['U9 Mixed Contact', 'U16B Contact']);
  check('the pool tables render', vals.showTables === true && vals.pools.length === 1
    && vals.pools[0].rows.length === 2, JSON.stringify(vals.pools));
  check('the bracket renders', vals.hasBracket === true && vals.bracket.length === 1);
  check('the team key renders and toggles', vals.teamKeyList.length === 1 && vals.showTeamKey === false);
  vals.onToggleTeamKey();
  check('…open', c.renderVals().showTeamKey === true);
  vals.onToggleTeamKey();
  check('…and closed again', c.renderVals().showTeamKey === false);

  /* The homepage embed contract still stands. */
  const calls = [];
  const c2 = build({ onAgeChange: (id) => calls.push(id) });
  c2.state = { ...c2.state, api: fakeApi(), ageGroups: AGE_GROUPS, selectedAgeId: 'u9' };
  publicTabs(c2.renderVals()).find((t) => t.name === 'U16B Contact').onSelect();
  eq('an age-tab pick still reports upward to the homepage embed', calls, ['u16b']);
}

/* ====================================================================== */
section('An unpublished group still reads as "coming soon", never sample data');
{
  const c = build({});
  c.state = { ...c.state, api: fakeApi({ getStandings: async () => ({
    awaitingPublication: true, ageGroup: { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
    pools: [], tables: {}, bracket: [], _advance: 2 }) }),
    ageGroups: AGE_GROUPS, selectedAgeId: 'u9' };
  await c.loadPublic();
  const vals = c.renderVals();
  check('awaitingPublication surfaces', vals.awaitingPublication === true);
  check('…and suppresses the tables and bracket', vals.showTables === false && vals.hasBracket === false);
}

/* ====================================================================== */
section('The footer: Back to menu stays, plus one quiet pointer to /manager');
{
  const page = readRepo('Scores & Standings.dc.html');
  check('Back to menu is still there', /onClick="\{\{ onBackToMenu \}\}"/.test(page));
  check('the footer carries a Manager sign-in link to /manager',
    /<a href="\/manager"[^>]*>Manager sign-in/.test(page));
}

/* ====================================================================== */
section('What went: no sign-in, no session, no editor, no publish, no tools');
{
  const page = readRepo('Scores & Standings.dc.html');
  /* ABSENCE checks read the CODE only, never comments — the footer's own
     explanatory comment says "Manager area", and failing on the explanation
     of a deletion is the strip-comments lesson from the club work. */
  const stripJs = (s2) => s2.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const stripHtml = (s2) => s2.replace(/<!--[\s\S]*?-->/g, '');
  const script = stripJs((page.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '');
  const markup = stripHtml(page.slice(0, page.indexOf('<script type="text/x-dc" data-dc-script')));

  check('no Manager-area tab or view exists', !/Manager area/.test(markup) && !/isAdmin/.test(script));
  check('no password field, no sign-in form', !/type="\{\{ loginPassType \}\}"/.test(markup) && !/PASSWORD/.test(markup));
  check('the script never reads a session or localStorage',
    !/currentSession/.test(script) && !/localStorage/.test(script));
  check('the script never writes a result, a draw or a publish',
    !/submitResult|saveDraw|publishDraw|unpublishDraw/.test(script));
  check('no Google sign-in machinery remains', !/google/i.test(script));
  check('the drag/tap editor is gone', !/pickTeam|placeTeam|editorDraw/.test(script));
  check('the import, scoring-rules, simulate and clash tools are gone',
    !/onConfirmImport|saveScoringRules|runSimulateTournament|weekendClashes/.test(script));
}

summary('test-scores-public.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
