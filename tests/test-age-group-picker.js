/* tests/test-age-group-picker.js
   ------------------------------------------------------------------------
   THE AGE-GROUP PICKER, ON BOTH SURFACES — 6 Aug 2026.

   Jay: the age group selection in Fixtures and Results should be "cleaner".
   Spec: claude/specs/spec-age-group-selector.md.

   What it replaced, measured before anything was written:

     /app     15 pills in ONE horizontally scrolling strip whose scrollbar is
              hidden on purpose, so eleven of the fifteen sat off the right
              edge with nothing saying they existed.
     /scores  13 identical chips (U6/U7 are filtered out — no standings)
              wrapping over three or four lines with no grouping at all.

   Both carried the full name as one string, 6 to 16 characters ("U6 Tag"
   against "U9 Mixed Contact"), so every chip was a different width. And the
   DAY — the one fact that halves the list — was visible only as the colour of
   the pill you had ALREADY chosen.

   Now: two day blocks, wrapped, with the label split into band and format.

   ⚠️⚠️ THE POINT OF THIS FILE IS THAT THE DAY SPLIT IS DERIVED, NOT TYPED.
   `app.html` once carried

       const SATURDAY = ['u6','u7','u8','u9','u10','u11','u12','u12g']

   and had U12G on Saturday and both U18 groups on Sunday — the opposite of the
   truth, on the public site, with registration open. The rule since is that an
   age group is on Saturday BECAUSE THAT IS WHERE IT HOLDS PITCHES, read from
   the venue layout, and `CLAUDE.md` says it in one line: "If you find yourself
   typing a list of age groups next to a day, stop." Grouping the picker by day
   is the first thing that has ever made that list tempting again, so the
   checks below go after a hardcoded list specifically.

   ONE DESIGN, TWO IMPLEMENTATIONS. The surfaces share no code — app.html is
   vanilla template strings, /scores is a DC component — and there is no build
   step, so the only thing that can keep them agreeing is a test that reads
   both. That is why this is one file rather than two sections in two files. */

const { readRepo, section, check, eq, summary } = require('./_lib');

const APP = readRepo('app.html').replace(/\r\n/g, '\n');
const SCORES = readRepo('Scores & Standings.dc.html').replace(/\r\n/g, '\n');

/* Absence checks run on the code, never on the prose: this repo documents the
   traps it avoids, so a bare search for a hardcoded day list would match the
   warning telling you not to write one. */
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const APP_CODE = stripJs(APP);
const SCORES_CODE = stripJs(SCORES);

/* ---- the real data, for the split rule ---------------------------------- */
/* Read out of the server's own list rather than typed here, so a renamed or
   sixteenth age group is covered the moment it lands. */
const AG_SRC = readRepo('netlify/functions/_agegroups.js');
const REAL_NAMES = [...AG_SRC.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);

/* ---- /app: run the real functions, don't grep them ---------------------- */
/* app.html is a plain file, not a component, so there is no build() harness.
   The two functions the picker is made of are lifted out by name and run for
   real against stubs — a structural check on a template string cannot tell a
   picker that groups by day from one that only looks like it does. */
function lift(name) {
  const re = new RegExp(`function ${name}\\s*\\(([^)]*)\\)\\s*\\{`);
  const m = re.exec(APP);
  if (!m) throw new Error(`${name}() not found in app.html`);
  let i = APP.indexOf('{', m.index);
  let depth = 1;
  let j = i + 1;
  while (depth && j < APP.length) {
    if (APP[j] === '{') depth += 1;
    else if (APP[j] === '}') depth -= 1;
    j += 1;
  }
  return APP.slice(m.index, j);
}

const DAY2 = ['u12g', 'u13', 'u14b', 'u14g', 'u16b', 'u16g'];
const APP_GROUPS = [
  { id: 'u6', name: 'U6 Tag' }, { id: 'u8', name: 'U8 Tag' },
  { id: 'u9', name: 'U9 Mixed Contact' }, { id: 'u12', name: 'U12 Mixed Contact' },
  { id: 'u12g', name: 'U12G QR' }, { id: 'u14b', name: 'U14B Contact' },
  { id: 'u18b', name: 'U18B Contact' },
];

function appPicker(groups, selected) {
  const sandbox = {
    S: { ageGroups: groups, browseId: selected },
    api: {
      isDayOne: (id) => DAY2.indexOf(id) < 0,
      dayLabelOfAgeGroup: (id) => (DAY2.indexOf(id) < 0 ? 'Saturday 7 November' : 'Sunday 8 November'),
    },
    esc: (v) => String(v),
  };
  sandbox.isSat = (id) => sandbox.api.isDayOne(id);
  // eslint-disable-next-line no-new-func
  const fn = new Function('S', 'api', 'esc', 'isSat',
    `${lift('ageparts')}\n${lift('pills')}\nreturn pills();`);
  return fn(sandbox.S, sandbox.api, sandbox.esc, sandbox.isSat);
}

/* ---- /scores: the DC component, driven ---------------------------------- */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}
function scoresComponent() {
  const m = SCORES.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script in Scores & Standings.dc.html');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', `${m[1]}\n;return Component;`)(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' },
  );
  const c = new C();
  c.props = {};
  c.state = {
    ...c.state,
    api: {
      isDayOne: (id) => DAY2.indexOf(id) < 0,
      dayLabelOfAgeGroup: (id) => (DAY2.indexOf(id) < 0 ? 'Saturday 7 November' : 'Sunday 8 November'),
      getStandings: async () => null, teamShort: (v) => v, teamLogoSrc: () => '', teamKey: () => [],
    },
    ageGroups: [
      { id: 'u6', name: 'U6 Tag', hasStandings: false },
      { id: 'u9', name: 'U9 Mixed Contact', hasStandings: true },
      { id: 'u12g', name: 'U12G QR', hasStandings: true },
      { id: 'u16b', name: 'U16B Contact', hasStandings: true },
    ],
    selectedAgeId: 'u9',
    view: 'public',
  };
  return c;
}

function main() {

/* ====================================================================== */
section('The label splits into band and format, on the same rule, on both surfaces');
{
  /* ⚠️ EVERY REAL NAME, not two examples — the split is the whole design and a
     single name that does not fit it produces a chip with a blank line or a
     16-character "band". Read out of _agegroups.js so a renamed group is
     covered without touching this file. */
  check('the real age-group list was found to sweep', REAL_NAMES.length === 15,
    `${REAL_NAMES.length} names found`);

  const html = appPicker(APP_GROUPS, 'u9');
  const noSpace = REAL_NAMES.filter((n) => n.indexOf(' ') < 0);
  eq('every real name has a band and a format to split into', noSpace, []);

  /* Driven through the real function rather than asserted about its source. */
  const one = appPicker([{ id: 'u9', name: 'U9 Mixed Contact' }], 'u9');
  check('/app puts the band in its own element',
    /<span class="ag-age">U9<\/span>/.test(one), one);
  check('…and the format, uppercased by CSS rather than in the string',
    /<span class="ag-fmt">Mixed Contact<\/span>/.test(one), one);
  check('…and the band is the whole label, not a truncation',
    one.indexOf('U9 Mixed Contact') < 0,
    'the full glued name is still being printed somewhere');

  /* ⚠️ THE FALLBACK, AND IT IS NOT DECORATION. A future group named with no
     space must keep its whole name as the band and simply render no format
     line — degrade, not disappear. */
  const bare = appPicker([{ id: 'u20', name: 'U20' }], 'u20');
  check('a name with no space keeps the whole string as the band',
    /<span class="ag-age">U20<\/span>/.test(bare), bare);
  check('…and renders no empty format line under it',
    bare.indexOf('ag-fmt') < 0, bare);

  /* /scores runs the same rule through its own helpers. Both surfaces splitting
     on the first space is the thing that makes it ONE design rather than two
     that currently agree. */
  const vals = scoresComponent().renderVals();
  const tabs = (vals.ageDayBlocks || []).reduce((all, d) => all.concat(d.tabs), []);
  const u9 = tabs.find((t) => t.id === 'u9') || {};
  eq('/scores splits the same name the same way — band', u9.band, 'U9');
  eq('…and format', u9.fmt, 'Mixed Contact');
  const qr = tabs.find((t) => t.id === 'u12g') || {};
  eq('…and a one-word format survives it', qr.fmt, 'QR');
  check('…and hasFmt gates the second line rather than printing an empty span',
    u9.hasFmt === true);
}

/* ====================================================================== */
section('⚠️ The day split is DERIVED from the venue layout, never typed');
{
  /* The regression this whole section exists for. A list of age-group ids
     sitting next to a day is how U12G and both U18 groups were shown on the
     wrong day on the live site. */
  const listNextToDay = /\b(SATURDAY|SUNDAY|SAT|SUN|DAY_?[12]|day[12])\s*=\s*\[/i;
  check('/app declares no age-group list next to a day',
    !listNextToDay.test(APP_CODE));
  check('/scores declares no age-group list next to a day',
    !listNextToDay.test(SCORES_CODE));

  /* Positive half — asserting an absence is not a test. Both surfaces must be
     seen ASKING the layout. */
  check('/app asks the layout which day a group is on',
    /isDayOne\(/.test(APP_CODE) || /isSat\(/.test(APP_CODE));
  check('/scores asks the layout which day a group is on',
    /api\.isDayOne\(/.test(SCORES_CODE));
  check('/app takes the block heading from the layout too, not a typed date',
    /dayLabelOfAgeGroup\(/.test(APP_CODE));
  check('/scores takes the block heading from the layout too',
    /dayLabelOfAgeGroup\(/.test(SCORES_CODE));

  /* ⚠️ AND DRIVEN, because a call to isDayOne() proves nothing about whether
     its ANSWER is used. Move a group between days in the stub and it must move
     block — that is the whole promise of deriving it. */
  const groups = [{ id: 'u9', name: 'U9 Mixed Contact' }, { id: 'u12g', name: 'U12G QR' }];
  const html = appPicker(groups, 'u9');
  const satAt = html.indexOf('Saturday 7 November');
  const sunAt = html.indexOf('Sunday 8 November');
  check('/app draws a Saturday block and a Sunday block', satAt >= 0 && sunAt > satAt,
    `sat@${satAt} sun@${sunAt}`);
  check('…with U9 above the Sunday heading and U12G below it',
    html.indexOf('U9') < sunAt && html.indexOf('U12G') > sunAt);

  const blocks = scoresComponent().renderVals().ageDayBlocks || [];
  eq('/scores draws exactly two blocks', blocks.length, 2);
  eq('…day one first', blocks[0].label, 'Saturday 7 November');
  eq('…then day two', blocks[1].label, 'Sunday 8 November');
  eq('…U9 in the first', (blocks[0].tabs || []).map((t) => t.id), ['u9']);
  eq('…U12G and U16B in the second', (blocks[1].tabs || []).map((t) => t.id), ['u12g', 'u16b']);
}

/* ====================================================================== */
section('Nothing is hidden, and the day is readable before you choose');
{
  const html = appPicker(APP_GROUPS, 'u9');
  /* ⚠️ THE ORIGINAL COMPLAINT. The old strip was overflow-x:auto with its
     scrollbar suppressed, so most of the list was off-screen with no
     affordance. Wrapping is the fix and it has to stay wrapping. */
  check('/app no longer builds a horizontally scrolling row',
    html.indexOf('pill-row') < 0 && APP_CODE.indexOf('pill-row') < 0);
  check('…the chips wrap instead', /\.ag-chips\{[^}]*flex-wrap:wrap/.test(APP));
  check('…and the picker has no overflow-x of its own',
    !/\.ag-(pick|chips)\{[^}]*overflow-x/.test(APP));

  check('every group in the list is rendered, none scrolled out of reach',
    APP_GROUPS.every((g) => html.indexOf(`data-age="${g.id}"`) >= 0));

  /* The day now has a mark on the BLOCK, so it reads before a choice is made
     rather than only after — which was the whole of problem three. */
  check('/app marks the day on the block rule, not only on the chosen chip',
    /\.ag-rule\{[^}]*background:var\(--red\)/.test(APP)
    && /\.ag-day\.sun \.ag-rule\{background:var\(--green\)\}/.test(APP));
  const blocks = scoresComponent().renderVals().ageDayBlocks || [];
  check('/scores marks day one red and day two green on its rule',
    /#E11B22/.test(blocks[0].ruleStyle) && /#17A34A/.test(blocks[1].ruleStyle),
    `${blocks[0].ruleStyle} | ${blocks[1].ruleStyle}`);
}

/* ====================================================================== */
section('The selected chip keeps the DAY\'s colour, on both surfaces');
{
  /* Red for day one, green for day two — the coding the homepage format cards
     already use. Both are asserted, or "it goes red" would pass on a picker
     that had lost the green entirely. */
  const sat = appPicker([{ id: 'u9', name: 'U9 Mixed Contact' }], 'u9');
  check('/app: a day-one chip selects red (no .sun)',
    /class="ag-chip on "/.test(sat) || /class="ag-chip on"/.test(sat.replace(/\s+"/g, '"')),
    sat);
  const sun = appPicker([{ id: 'u12g', name: 'U12G QR' }], 'u12g');
  check('/app: a day-two chip selects green (.sun)', /ag-chip on sun/.test(sun), sun);
  check('/app: the green rule exists for it to use',
    /\.ag-chip\.on\.sun\{background:var\(--green\)/.test(APP));

  const c = scoresComponent();
  const day1 = (c.renderVals().ageDayBlocks[0].tabs || [])[0] || {};
  check('/scores: the selected day-one chip is Quins red',
    /#E11B22;background:#E11B22/.test(day1.style || ''), day1.style);
  c.setState({ selectedAgeId: 'u12g' });
  const day2 = (c.renderVals().ageDayBlocks[1].tabs || [])[0] || {};
  check('/scores: the selected day-two chip is green, not red',
    /#17A34A;background:#17A34A/.test(day2.style || '') && !/#E11B22/.test(day2.style || ''),
    day2.style);
}

/* ====================================================================== */
section('What the regroup must not have broken');
{
  const c = scoresComponent();
  const blocks = c.renderVals().ageDayBlocks || [];
  const tabs = blocks.reduce((all, d) => all.concat(d.tabs), []);

  /* U6/U7 are excluded from the PUBLIC picker on purpose — a tab that can only
     ever say "no standings are kept" is worse than no tab. The regroup runs
     over publicAgeGroups, so this has to survive it. */
  check('festival groups are still absent from the public picker',
    !tabs.some((t) => t.id === 'u6'), tabs.map((t) => t.id).join(','));
  eq('every remaining group appears exactly ONCE across the blocks',
    tabs.map((t) => t.id).sort(), ['u12g', 'u16b', 'u9']);

  /* ⚠️ onSelect is the homepage embed contract — the public Results section is
     this same component, and the pick has to keep reporting upward. A regroup
     that dropped it would look perfect and silently unlink the two. */
  const calls = [];
  const c2 = scoresComponent();
  c2.props = { onAgeChange: (id) => calls.push(id) };
  const t = (c2.renderVals().ageDayBlocks || [])
    .reduce((all, d) => all.concat(d.tabs), []).find((x) => x.id === 'u16b');
  check('a chip still carries a working onSelect', typeof t.onSelect === 'function');
  t.onSelect();
  eq('…and still reports the pick upward to the homepage embed', calls, ['u16b']);
  eq('…and still selects the group', c2.state.selectedAgeId, 'u16b');
}

/* ====================================================================== */
section('One design, two implementations — the parts that must agree');
{
  /* The surfaces share no code and there is no build step, so nothing but a
     check that reads both can stop them drifting into two different pickers
     that merely started the same. */
  check('both split the label on the first space',
    /indexOf\(' '\)/.test(APP_CODE) && /indexOf\(' '\)/.test(SCORES_CODE));
  check('both use the same two day colours',
    /--red/.test(APP) && /--green/.test(APP)
    && /#E11B22/.test(SCORES) && /#17A34A/.test(SCORES));
  check('both group into blocks headed by the layout\'s own day label',
    /dayLabelOfAgeGroup/.test(APP_CODE) && /dayLabelOfAgeGroup/.test(SCORES_CODE));

  /* ⚠️ TOMBSTONE CHECK. centreActivePill() scrolled the selected pill into the
     middle of the old strip. There is no strip, so it went — and the note
     saying why has to stay, or the next person adding a horizontal row will
     rediscover the problem it solved. */
  check('the deleted pill-centring helper is recorded, not silently dropped',
    /TOMBSTONE - centreActivePill\(\)/.test(APP));
  check('…and the helper itself really is gone (dead code here is published)',
    !/function centreActivePill/.test(APP_CODE));
}

/* ====================================================================== */
section('The day is stated ONCE — dayTag() went with the regroup');
{
  /* ⚠️ WHY THIS IS A CHECK AND NOT JUST A DELETION. dayTag() printed a solid
     day marker and the date directly under the picker, for whichever group was
     being browsed — "DAY 02 · Sunday 8 November". Once the picker grouped BY
     day, the selected chip already sat inside a block headed with that exact
     string about 30px higher, so the tag was a second copy of the sentence
     immediately above it. Two identical sentences a thumb apart read as a
     mistake, not as emphasis; it is the same argument that took the HSBC band
     out from under the /scores header.

     ⚠️ The rule this guards is NOT "never show the day" — it is "show it
     once". So the absence check is paired with the positive one: the day must
     still be on screen, in the block heading, which is what makes the removal
     a tidy-up rather than a loss. */
  check('dayTag() is gone from the match-day app',
    !/function dayTag/.test(APP_CODE), 'the duplicate day line is back');
  check('…and nothing still calls it', !/dayTag\(/.test(APP_CODE));
  check('…and its CSS went with it, so it cannot come back half-styled',
    !/\.daytag/.test(APP_CODE));
  check('…and the deletion is recorded rather than silent',
    /TOMBSTONE - dayTag\(\)/.test(APP));

  /* The positive half — the day did not leave the screen, it stopped being
     said twice. */
  const html = appPicker(
    [{ id: 'u9', name: 'U9 Mixed Contact' }, { id: 'u12g', name: 'U12G QR' }], 'u12g');
  check('the day is still on screen, in the block heading',
    html.indexOf('Sunday 8 November') >= 0, html);
  eq('…and said exactly once per day, not twice',
    (html.match(/Sunday 8 November/g) || []).length, 1);
  eq('…same for the other day', (html.match(/Saturday 7 November/g) || []).length, 1);
}

summary('test-age-group-picker.js');
}

main();
