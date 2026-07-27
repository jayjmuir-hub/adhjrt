/* tests/test-venue-map.js
   ------------------------------------------------------------------------
   The pitch schematic on /organizer -> Venue & days: the drawing of where each
   age group plays.

   WHAT IS ACTUALLY AT RISK HERE. This is a picture an organiser uses to decide
   things, so the failure that matters is not "it looks wrong" — it is the
   drawing quietly disagreeing with the layout it claims to be showing. Every
   cell has to be derived, none of it stored, and the two states a tick-box grid
   cannot show — a group with no pitches, and two groups on one pitch — have to
   be visible and correctly distinguished.

   The time-share is the one to get right. D4 and D5 run U6 in the morning and
   U7 in the afternoon, on purpose. A drawing that flagged that as a problem
   would be worse than no drawing, so there is an explicit assertion that it is
   NOT drawn as a warning.

   Driven through the component, not grepped — the lesson from the pitch-count
   test. The only text checks are the binding contract, because a {{ token }}
   the component does not return resolves silently to empty.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* Same minimal framework stand-in the panel tests use. */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function build() {
  const t = readRepo('Organizer.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script in Organizer.dc.html');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {} },
    { addEventListener() {}, getElementById: () => null, body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
  const c = new C();
  c.props = {};
  return c;
}

/* The real default layout, read out of the server module so this test cannot
   drift from what the site actually ships. */
const VENUE = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js')).DEFAULT_VENUE;
const clone = (o) => JSON.parse(JSON.stringify(o));

const C = build();
const maps = C.venueMaps(clone(VENUE));
const sat = maps[0], sun = maps[1];

/* Every pitch cell on a day, flattened. */
const cells = (m) => m.blocks.reduce((a, b) => a.concat(b.pitches), []);
const cell = (m, name) => cells(m).find((p) => p.name === name);

/* ====================================================================== */
section('It draws the layout it was given, and nothing else');

check('two days are drawn', maps.length === 2);
eq('Saturday is labelled from the layout', sat.label, VENUE.day1.label);
eq('Sunday is labelled from the layout', sun.label, VENUE.day2.label);

/* The count assertions are the ones that catch a pitch being silently dropped —
   the failure mode that would matter most and show least. */
eq('every Saturday pitch is drawn exactly once', cells(sat).map((p) => p.name).sort(), VENUE.day1.pitches.slice().sort());
eq('every Sunday pitch is drawn exactly once', cells(sun).map((p) => p.name).sort(), VENUE.day2.pitches.slice().sort());
check('Saturday draws 18 pitches', cells(sat).length === 18, String(cells(sat).length));
check('Sunday draws 10 pitches', cells(sun).length === 10, String(cells(sun).length));
check('no pitch appears twice', new Set(cells(sat).map((p) => p.name)).size === cells(sat).length);

/* A day with pitches must not report itself empty, and vice versa — this is what
   decides whether the "nothing to draw" message shows. */
check('a day with pitches is not reported empty', sat.isEmpty === false);
check('a day with no pitches is reported empty',
  C.venueMaps({ day1: { label: 'x', pitches: [], groups: {} }, day2: VENUE.day2 })[0].isEmpty === true);

/* ====================================================================== */
section('Pitches land in the right block');

{
  const blockOf = (m, pitch) => (m.blocks.find((b) => b.pitches.some((p) => p.name === pitch)) || {}).name;
  eq('D5A is in block D5', blockOf(sat, 'D5A'), 'D5');
  eq('D5B is in block D5 too', blockOf(sat, 'D5B'), 'D5');
  eq('D2 is its own block', blockOf(sat, 'D2'), 'D2');
  eq('B1C is in block B1', blockOf(sat, 'B1C'), 'B1');
  eq('A1D is in block A1', blockOf(sat, 'A1D'), 'A1');
  eq('C4A on Sunday is in block C4', blockOf(sun, 'C4A'), 'C4');
  eq('C5 on Sunday is its own block', blockOf(sun, 'C5'), 'C5');

  check('Saturday groups 18 pitches into 9 blocks', sat.blocks.length === 9, String(sat.blocks.length));
  check('Sunday groups 10 pitches into 7 blocks', sun.blocks.length === 7, String(sun.blocks.length));

  /* Every block on both days is one the map knows where to put. If this fails,
     a real block is being drawn in the overflow rows underneath, which means
     BLOCK_GRID has fallen behind the layout. */
  maps.forEach((m) => m.blocks.forEach((b) =>
    check(`${m.label}: block ${b.name} has a place on the drawing`, b.known === true)));

  /* …and each one is placed somewhere, in a form CSS will accept. */
  maps.forEach((m) => m.blocks.forEach((b) =>
    check(`${m.label}: block ${b.name} has a grid position`, /grid-area:\d+ \/ \d+/.test(b.style), b.style)));

  /* No two blocks on a day share a cell — they would draw on top of each other. */
  maps.forEach((m) => {
    const areas = m.blocks.map((b) => (b.style.match(/grid-area:(\d+ \/ \d+)/) || [])[1]);
    check(`${m.label}: no two blocks are placed in the same cell`, new Set(areas).size === areas.length, areas.join(' '));
  });
}

/* ====================================================================== */
section('blockOfPitch, including the names nobody expects');

{
  /* Reached through the component's own module scope by exercising it on a
     made-up layout — the function is not exported, and driving it is the point. */
  const probe = (names) => {
    const m = C.venueMaps({
      day1: { label: 'probe', pitches: names, groups: {} },
      day2: { label: 'x', pitches: [], groups: {} },
    })[0];
    return m.blocks.map((b) => b.name);
  };
  eq('a trailing letter is a sub-pitch', probe(['D5A', 'D5B']), ['D5']);
  eq('no trailing letter is the block itself', probe(['D2']), ['D2']);
  eq('two digits stay with the block', probe(['D12A', 'D12B']), ['D12']);
  eq('a name with no digit becomes its own block', probe(['Track']), ['TRACK']);
  eq('case is normalised so c4a and C4A are one block', probe(['C4A', 'c4b']), ['C4']);
  eq('different blocks stay apart', probe(['D1', 'D2']), ['D1', 'D2']);
  /* An unknown block must still be drawn, below the map rather than dropped. */
  const odd = C.venueMaps({
    day1: { label: 'probe', pitches: ['Z9'], groups: {} },
    day2: { label: 'x', pitches: [], groups: {} },
  })[0];
  check('an unrecognised block is still drawn', odd.blocks.length === 1);
  check('…and is marked as not being on the map', odd.blocks[0].known === false);
  check('…and is placed below the known rows', /grid-area:[5-9]/.test(odd.blocks[0].style), odd.blocks[0].style);
}

/* ====================================================================== */
section('Who is on each pitch');

{
  eq('C5 on Saturday is U10', cell(sat, 'C5').who, 'U10');
  eq('C4 on Saturday is U11', cell(sat, 'C4').who, 'U11');
  eq('D2 on Saturday is U18B', cell(sat, 'D2').who, 'U18B');
  eq('B1A on Saturday is U8', cell(sat, 'B1A').who, 'U8');
  eq('B1A on SUNDAY is U12G, not U8', cell(sun, 'B1A').who, 'U12G');
  eq('D3 on Sunday is U14B', cell(sun, 'D3').who, 'U14B');

  /* The same pitch NAME exists on both days and they are unrelated fields — the
     clash check already treats them separately and so must the drawing. */
  check('the two B1As are different cells', cell(sat, 'B1A') !== cell(sun, 'B1A'));

  /* A single-group cell is tinted with that group's own colour, not a generic
     "in use" colour — otherwise the drawing carries no information a list did
     not already have. */
  const u10 = cell(sat, 'C5'), u11 = cell(sat, 'C4');
  check('a used pitch is tinted', /background:#[0-9A-Fa-f]{6}30/.test(u10.style), u10.style);
  check('two different groups get two different tints', u10.style !== u11.style);
  check('the tint matches the label colour', u10.whoColor && u10.style.includes(u10.whoColor.slice(1)));
  check('the tooltip names the group in full', /U10 Mixed Contact/.test(u10.title), u10.title);
}

/* ====================================================================== */
section('A time-share is drawn as a time-share, NOT as a problem');

{
  /* U6 and U7 hold the same four pitches on purpose: U6 in the morning, U7 in
     the afternoon. This is the assertion that stops the drawing crying wolf on
     the one arrangement that was set up deliberately. */
  const d4a = cell(sat, 'D4A');
  eq('D4A names both groups', d4a.who, 'U6 · U7');
  check('…as a split of both colours', d4a.style.includes('linear-gradient'), d4a.style);
  check('…and NOT in a warning colour', !/f5c518|E11B22|ff8a8a/i.test(d4a.style.replace(/linear-gradient\([^)]*\)/, '')), d4a.style);
  check('the tooltip says it is a time-share, not a clash', /time-share, not a clash/i.test(d4a.title), d4a.title);
  check('the tooltip names both groups in full', /U6 Tag/.test(d4a.title) && /U7 Tag/.test(d4a.title), d4a.title);

  /* All four shared pitches, not just the one. */
  ['D4A', 'D4B', 'D5A', 'D5B'].forEach((p) =>
    eq(`${p} is shared by U6 and U7`, cell(sat, p).who, 'U6 · U7'));

  const note = (sat.notes || []).find((n) => /Time-shared/i.test(n.text));
  check('Saturday reports the time-share in its notes', !!note, JSON.stringify(sat.notes));
  check('…naming all four pitches', note && ['D4A', 'D4B', 'D5A', 'D5B'].every((p) => note.text.includes(p)), note && note.text);
  check('…and explaining that the Fixture Editor keeps them apart by time',
    note && /Fixture Editor/.test(note.text), note && note.text);
  check('…in a neutral colour, not amber or red', note && !/f5c518|E11B22/i.test(note.style), note && note.style);

  check('Sunday has no time-share', !(sun.notes || []).some((n) => /Time-shared/i.test(n.text)));
}

/* ====================================================================== */
section('The two things a grid of tick-boxes cannot show');

{
  /* 1. A pitch nobody is using. On the shipped layout every Saturday pitch is
        allocated, so this is proven by taking one away. */
  check('the default Saturday layout has no unused pitch',
    !(sat.notes || []).some((n) => /No group on/.test(n.text)), JSON.stringify(sat.notes));

  const stripped = clone(VENUE);
  stripped.day1.groups.u10 = [];              // C5 now belongs to nobody
  const m = C.venueMaps(stripped)[0];
  eq('an unallocated pitch says so on the cell', cell(m, 'C5').who, 'free');
  check('…drawn as an outline rather than filled', /dashed/.test(cell(m, 'C5').style), cell(m, 'C5').style);
  const unused = (m.notes || []).find((n) => /No group on/.test(n.text));
  check('…and named in the notes', unused && unused.text.includes('C5'), unused && unused.text);
  check('the in-use count drops with it', /17 in use/.test(m.summary), m.summary);

  /* 2. A group on the day with nowhere to play. Deliberately allowed by
        validateVenue() — "which day" and "which pitches" are separate decisions
        — so it is a note, never a block. */
  const homeless = (m.notes || []).find((n) => /Not placed yet/.test(n.text));
  check('a group with no pitches is called out', homeless && /U10/.test(homeless.text), homeless && homeless.text);
  check('…in amber, because it IS something to fix', homeless && /f5c518/i.test(homeless.style), homeless && homeless.style);

  check('the default layout has nobody unplaced',
    !(sat.notes || []).some((n) => /Not placed yet/.test(n.text)) &&
    !(sun.notes || []).some((n) => /Not placed yet/.test(n.text)));
}

/* ====================================================================== */
section('The summary line counts what it says it counts');

check('Saturday: 18 pitches, 9 groups, all in use',
  sat.summary === '18 pitches · 9 age groups · 18 in use', sat.summary);
check('Sunday: 10 pitches, 6 groups, all in use',
  sun.summary === '10 pitches · 6 age groups · 10 in use', sun.summary);
check('singular is handled',
  /1 pitch · 1 age group/.test(C.venueMaps({
    day1: { label: 'x', pitches: ['D1'], groups: { u6: ['D1'] } },
    day2: { label: 'y', pitches: [], groups: {} },
  })[0].summary));

/* ====================================================================== */
section('It is derived, and it survives a layout that is mid-edit');

{
  /* Nothing is stored: the drawing must follow an edit with no save. This is
     the property the whole feature rests on. */
  const edited = clone(VENUE);
  edited.day1.groups.u11 = ['C4', 'C5'];      // U11 takes C5 off U10
  edited.day1.groups.u10 = [];
  const m = C.venueMaps(edited)[0];
  eq('an edit is reflected immediately', cell(m, 'C5').who, 'U11');
  eq('…and the old owner is gone from it', cell(sat, 'C5').who, 'U10');  // the original object is untouched

  const before = JSON.stringify(VENUE);
  C.venueMaps(clone(VENUE));
  check('drawing the map does not mutate the layout', JSON.stringify(VENUE) === before);

  /* Half-built and malformed input must not throw. The panel is reachable while
     the layout is being edited, and a drawing that crashes takes the whole tab
     with it. */
  [
    ['null', null],
    ['an empty object', {}],
    ['a day missing entirely', { day1: VENUE.day1 }],
    ['a day with no pitches array', { day1: { label: 'x', groups: {} }, day2: VENUE.day2 }],
    ['a day with no groups', { day1: { label: 'x', pitches: ['D1'] }, day2: VENUE.day2 }],
    ['a group pointing at a pitch that is gone', { day1: { label: 'x', pitches: ['D1'], groups: { u6: ['D9'] } }, day2: VENUE.day2 }],
    ['a null in the pitch list', { day1: { label: 'x', pitches: ['D1'], groups: { u6: null } }, day2: VENUE.day2 }],
  ].forEach(([label, input]) => {
    let ok = true, out = null;
    try { out = C.venueMaps(input); } catch (e) { ok = false; out = e.message; }
    check(`does not throw on ${label}`, ok, String(out));
  });

  /* A group pointing at a pitch that no longer exists must not invent a cell for
     it — validateVenue() already refuses to save that, and the problems list
     already names it. Drawing it would be a third opinion. */
  const ghost = C.venueMaps({
    day1: { label: 'x', pitches: ['D1'], groups: { u6: ['D9'] } },
    day2: { label: 'y', pitches: [], groups: {} },
  })[0];
  eq('a pitch that is not on the day is not drawn', cells(ghost).map((p) => p.name), ['D1']);
  eq('…and the real pitch is correctly shown as free', cell(ghost, 'D1').who, 'free');
}

/* ====================================================================== */
section('Every {{ token }} the schematic uses is returned');

{
  const src = readRepo('Organizer.dc.html');
  const from = '<!-- WHERE EACH GROUP PLAYS';
  const to = '<!-- one card per day: the pitch list -->';
  const i = src.indexOf(from), j = src.indexOf(to);
  check('the schematic markup was found', i > 0 && j > i);
  const markup = src.slice(i, j);

  const loopVars = new Set([...markup.matchAll(/<sc-for\b[^>]*\bas="([^"]+)"/g)].map((mm) => mm[1]));
  const cleaned = markup.replace(/hint-placeholder-(?:val|count)="[^"]*"/g, '');
  const plain = new Set(), scoped = new Map();
  [...cleaned.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)(\.[\w$]+)?\s*\}\}/g)].forEach(([, root, prop]) => {
    if (prop || loopVars.has(root)) {
      if (!scoped.has(root)) scoped.set(root, new Set());
      if (prop) scoped.get(root).add(prop.slice(1));
    } else plain.add(root);
  });

  check('the schematic has bindings to check', plain.size + scoped.size > 3);

  /* The one plain binding is the list itself; the rest are loop-scoped, which
     validate-bindings.js skips by design — so this is the only thing checking
     them. */
  const C2 = build();
  C2.state = { ...C2.state, api: null, tab: 'venue', venue: clone(VENUE), venueSaved: clone(VENUE), vLoaded: true };
  let vals = null;
  try { vals = C2.renderVals(); } catch (e) { check('the venue tab renders', false, e.stack || e.message); }
  if (vals) {
    plain.forEach((t) => check(`renderVals returns {{ ${t} }}`, Object.prototype.hasOwnProperty.call(vals, t)));
    check('vMaps is a list of two days', Array.isArray(vals.vMaps) && vals.vMaps.length === 2);

    const sample = { vm: vals.vMaps[0], blk: vals.vMaps[0].blocks[0], pp: vals.vMaps[0].blocks[0].pitches[0], nt: { style: '', text: '' } };
    scoped.forEach((props, root) => {
      props.forEach((p) => check(`every ${root} carries ${p}`,
        sample[root] !== undefined && p in sample[root], `${root}.${p}`));
    });
  }
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node tests/_prove-registration.js`,
   which carries the venue-map faults too. Each is caught by the named check:

     * blockOfPitch stops normalising case -> "case is normalised"
     * the sub-pitch letter no longer
       stripped (every pitch its own
       block)                             -> "D5A is in block D5" and the block counts
     * BLOCK_GRID entry for B1 removed    -> "block B1 has a place on the drawing"
     * two blocks given the same cell     -> "no two blocks are placed in the same cell"
     * the shared-pitch branch made to
       use the warning colour             -> "NOT in a warning colour"
     * the shared branch made to show
       only the first group                -> "D4A names both groups"
     * unused pitches no longer reported  -> "named in the notes"
     * a pitch silently dropped from a
       block                              -> "every Saturday pitch is drawn exactly once"

   AND ONE CLAIM IN THE CODE WAS WRONG, which the fault run is what found.
   blockOfPitch's comment said its greedy `.*` was load-bearing — that 'D12A'
   would otherwise split as 'D1'. Injecting the lazy form changed nothing, and it
   cannot: the tail is one anchored letter, so backtracking makes the two
   identical. The comment has been corrected and the fault replaced with a real
   one in the same function. A test that passes for a reason nobody has checked
   is the thing this whole exercise exists to catch, and it works in both
   directions — on the code as well as on the tests.
   ====================================================================== */

summary('test-venue-map.js');
