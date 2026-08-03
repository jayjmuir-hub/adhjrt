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

/* A stand-in for the map element on screen. The drag maths reads the real
   rectangle out of the DOM at drag time — it has to, because the panel is
   responsive — so driving it means handing the component a document that
   answers with a known rectangle. 800x600 at (100, 50) is arbitrary but not
   square and not at the origin, which is what catches a left/top mix-up or a
   forgotten offset. */
const RECT = { left: 100, top: 50, width: 800, height: 600 };

function build(rect) {
  const t = readRepo('Organizer.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script in Organizer.dc.html');
  const doc = {
    addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/',
    getElementById: (elId) => (rect && /^vmap-/.test(elId) ? { getBoundingClientRect: () => rect } : null),
  };
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic, { addEventListener() {} }, doc
  );
  const c = new C();
  c.props = {};
  c.__Component = C;
  return c;
}

/* The module-scope helpers, which are not on the component. Same script text,
   evaluated once, returning the pieces the legibility section drives directly.
   Reaching for them by name rather than re-implementing them is the point: a
   test that carried its own copy of the contrast maths would agree with itself
   forever. */
function helpers() {
  const t = readRepo('Organizer.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  // eslint-disable-next-line no-new-func
  return new Function('DCLogic', 'window', 'document',
    m[1] + '\n;return { splitMark, splitLabel, AGE_TINT };')(
    DCLogic, { addEventListener() {} },
    { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null }
  );
}

/* A pointer event as the component sees it. setPointerCapture is what keeps a
   fast drag attached to a small chip; the component guards the call, so the
   stub records it rather than needing to exist. */
function ptr(clientX, clientY) {
  const captured = [];
  return {
    clientX, clientY, pointerId: 1,
    preventDefault() { this.defaultPrevented = true; },
    currentTarget: { setPointerCapture: (pid) => captured.push(pid) },
    captured,
  };
}
/* Where a percentage lands in RECT's client coordinates — the inverse of what
   the component computes, so a bug in one is not cancelled by the same bug in
   the other. */
const atPct = (x, y) => ptr(RECT.left + (x / 100) * RECT.width, RECT.top + (y / 100) * RECT.height);

/* The real default layout, read out of the server module so this test cannot
   drift from what the site actually ships. */
const VENUE = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js')).DEFAULT_VENUE;
const clone = (o) => JSON.parse(JSON.stringify(o));

const C = build(RECT);
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
  eq('D5a is in block D5', blockOf(sat, 'D5a'), 'D5');
  eq('D5b is in block D5 too', blockOf(sat, 'D5b'), 'D5');
  eq('D2 is its own block', blockOf(sat, 'D2'), 'D2');
  eq('B1c is in block B1', blockOf(sat, 'B1c'), 'B1');
  eq('A1d is in block A1', blockOf(sat, 'A1d'), 'A1');
  eq('C4a on Sunday is in block C4', blockOf(sun, 'C4a'), 'C4');
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

  /* THE C, B AND A BLOCKS SIT ON ONE ROW, parallel across the site. Corrected
     on Jay's say-so — he walks the place. They were staggered over two rows
     before, which read as though the C pitches were above the B ones. This is
     the kind of thing that gets quietly undone by the next person tidying the
     table, so it is asserted rather than left to the comment. */
  const rowOf = (block) => {
    const all = C.venueMaps({
      day1: { label: 'x', pitches: ['C4', 'C5', 'B1', 'B2', 'A1', 'D3'], groups: {} },
      day2: { label: 'y', pitches: [], groups: {} },
    })[0];
    const b = all.blocks.find((bb) => bb.name === block);
    return b ? Number((b.style.match(/grid-area:(\d+)/) || [])[1]) : null;
  };
  const bRow = rowOf('B1');
  check('B1 and B2 are on the same row as each other', rowOf('B2') === bRow);
  ['C4', 'C5', 'A1'].forEach((b) =>
    check(`${b} is parallel with the B blocks, not above or below them`, rowOf(b) === bRow, `${b} row ${rowOf(b)}, B row ${bRow}`));
  check('the D blocks are still the row above', rowOf('D3') === bRow - 1, `D3 row ${rowOf('D3')}`);

  /* Left to right across the site: C, then B, then A. A row that is parallel
     but in the wrong order is no better than a staggered one. */
  const colOf = (block) => {
    const all = C.venueMaps({
      day1: { label: 'x', pitches: ['C4', 'C5', 'B1', 'B2', 'A1'], groups: {} },
      day2: { label: 'y', pitches: [], groups: {} },
    })[0];
    const b = all.blocks.find((bb) => bb.name === block);
    return b ? Number((b.style.match(/grid-area:\d+ \/ (\d+)/) || [])[1]) : null;
  };
  check('C4 is left of C5', colOf('C4') < colOf('C5'));
  check('the C blocks are left of the B blocks', colOf('C5') < colOf('B2'));
  check('B2 is left of B1, as on the map', colOf('B2') < colOf('B1'));
  check('the A blocks are right of the B blocks', colOf('B1') < colOf('A1'));
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
  eq('a trailing letter is a sub-pitch', probe(['D5a', 'D5b']), ['D5']);
  eq('no trailing letter is the block itself', probe(['D2']), ['D2']);
  eq('two digits stay with the block', probe(['D12A', 'D12B']), ['D12']);
  eq('a name with no digit becomes its own block', probe(['Track']), ['TRACK']);
  eq('case is normalised so c4a and C4a are one block', probe(['C4a', 'c4b']), ['C4']);
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
  eq('B1a on Saturday is U8', cell(sat, 'B1a').who, 'U8');
  eq('B1a on SUNDAY is U12G, not U8', cell(sun, 'B1a').who, 'U12G');
  eq('D3 on Sunday is U14B', cell(sun, 'D3').who, 'U14B');

  /* The same pitch NAME exists on both days and they are unrelated fields — the
     clash check already treats them separately and so must the drawing. */
  check('the two B1As are different cells', cell(sat, 'B1a') !== cell(sun, 'B1a'));

  /* A single-group cell is tinted with that group's own colour, not a generic
     "in use" colour — otherwise the drawing carries no information a list did
     not already have. */
  const u10 = cell(sat, 'C5'), u11 = cell(sat, 'C4');
  check('a used pitch is tinted', /background:#[0-9A-Fa-f]{6}30/.test(u10.style), u10.style);
  check('two different groups get two different tints', u10.style !== u11.style);
  /* 2 Aug 2026: the label used to be drawn IN the tint, on a wash of the
     same tint — near-invisible on the light page. Dark ink now; the tint
     identifies the group through the fill and border instead. */
  eq('the label ink is the dark page ink, never the tint', u10.whoColor, '#1A1C1F');
  check('the tint still identifies the cell — solid in the border', /border:1px solid #[0-9A-Fa-f]{6}/.test(u10.style), u10.style);
  check('the tooltip names the group in full', /U10 Mixed Contact/.test(u10.title), u10.title);
}

/* ====================================================================== */
section('A time-share is drawn as a time-share, NOT as a problem');

{
  /* U6 and U7 hold the same four pitches on purpose: U6 in the morning, U7 in
     the afternoon. This is the assertion that stops the drawing crying wolf on
     the one arrangement that was set up deliberately. */
  const d4a = cell(sat, 'D4a');
  eq('D4a names both groups', d4a.who, 'U6 · U7');
  check('…as a split of both colours', d4a.style.includes('linear-gradient'), d4a.style);
  check('…and NOT in a warning colour', !/f5c518|8F6400|E11B22|ff8a8a|A62626/i.test(d4a.style.replace(/linear-gradient\([^)]*\)/, '')), d4a.style);
  eq('the shared label is dark ink too, not the dark-mode-era light grey', d4a.whoColor, '#1A1C1F');
  check('the tooltip says it is a time-share, not a clash', /time-share, not a clash/i.test(d4a.title), d4a.title);
  check('the tooltip names both groups in full', /U6 Tag/.test(d4a.title) && /U7 Tag/.test(d4a.title), d4a.title);

  /* All four shared pitches, not just the one. */
  ['D4a', 'D4b', 'D5a', 'D5b'].forEach((p) =>
    eq(`${p} is shared by U6 and U7`, cell(sat, p).who, 'U6 · U7'));

  const note = (sat.notes || []).find((n) => /Time-shared/i.test(n.text));
  check('Saturday reports the time-share in its notes', !!note, JSON.stringify(sat.notes));
  check('…naming all four pitches', note && ['D4a', 'D4b', 'D5a', 'D5b'].every((p) => note.text.includes(p)), note && note.text);
  check('…and explaining that the Fixture Editor keeps them apart by time',
    note && /Fixture Editor/.test(note.text), note && note.text);
  check('…in a neutral colour, not amber or red', note && !/f5c518|8F6400|E11B22/i.test(note.style), note && note.style);

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
  /* Aug 2026 light mode: the amber is the darker #8F6400 now — raw #f5c518
     text on a white page is ~1.6:1. Same meaning, readable ink. */
  check('…in amber, because it IS something to fix', homeless && /8F6400/i.test(homeless.style), homeless && homeless.style);

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
  const C2 = build(RECT);
  C2.state = { ...C2.state, api: null, tab: 'venue', venue: clone(VENUE), venueSaved: clone(VENUE), vLoaded: true };
  let vals = null;
  try { vals = C2.renderVals(); } catch (e) { check('the venue tab renders', false, e.stack || e.message); }
  if (vals) {
    plain.forEach((t) => check(`renderVals returns {{ ${t} }}`, Object.prototype.hasOwnProperty.call(vals, t)));
    check('vMaps is a list of two days', Array.isArray(vals.vMaps) && vals.vMaps.length === 2);

    /* The default layout has no strays and no warnings, so a sample taken only
       from it would leave `st` and `nt` undefined and the loop-binding checks
       would pass by testing nothing. This second state manufactures both. */
    const C3 = build(RECT);
    C3.state = {
      ...C3.state, api: null, tab: 'venue', vLoaded: true, vView: 'map',
      venue: { day1: { label: 'x', pitches: ['Z9'], groups: { u6: [] } }, day2: { label: 'y', pitches: [], groups: {} } },
      venueSaved: null, venuePositions: {},
    };
    const oddVals = C3.renderVals();
    check('the fixture really does produce a stray', (oddVals.vMaps[0].strays || []).length === 1);
    check('…and a note', (oddVals.vMaps[0].notes || []).length > 0);

    const sample = {
      vm: vals.vMaps[0],
      blk: vals.vMaps[0].blocks[0],
      pp: vals.vMaps[0].blocks[0].pitches[0],
      /* mg = one swatch-plus-code entry (2 Aug 2026 chip redesign). The
         first block on the shipped layout is D5, which is occupied, so its
         mapGroups is never empty. */
      mg: (vals.vMaps[0].blocks[0].mapGroups || [])[0],
      nt: oddVals.vMaps[0].notes[0],
      st: oddVals.vMaps[0].strays[0],
    };
    scoped.forEach((props, root) => {
      props.forEach((p) => check(`every ${root} carries ${p}`,
        sample[root] !== undefined && p in sample[root], `${root}.${p}`));
    });
  }
}

/* ====================================================================== */
section('The map view: placing blocks on the real image');

{
  const POS = { D5: { x: 12.4, y: 20.1 }, D3: { x: 28.4, y: 20.5 }, C4: { x: 11.1, y: 63 } };
  const m = C.venueMaps(clone(VENUE), POS, true)[0];
  /* Falls back to an empty block rather than undefined. If a block stops being
     rendered at all, the checks below should REPORT that — reading a field off
     undefined throws instead, kills the process, and every check after this
     point silently never runs. A suite that collapses proves nothing. */
  const blk = (name) => m.blocks.find((b) => b.name === name) || {};

  check('a block with a position is placed', blk('D3').placed === true);
  check('a block with no position is NOT placed', blk('D2').placed === false);
  check('…and says so the other way round too', blk('D2').notPlaced === true);

  /* The stored percentage is the block's CENTRE. Anchoring by a corner would
     make a block near the right edge drift when the map is resized, because the
     offset and the box width scale differently. */
  check('a placed block is positioned from its percentage', /left:28\.4%/.test(blk('D3').mapStyle) && /top:20\.5%/.test(blk('D3').mapStyle), blk('D3').mapStyle);
  check('…and centred on it', /translate\(-50%,-50%\)/.test(blk('D3').mapStyle));
  check('an unplaced block is not absolutely positioned', !/position:absolute/.test(blk('D2').mapStyle), blk('D2').mapStyle);

  check('the map box keeps the image aspect ratio', /aspect-ratio:792\/547/.test(m.mapBoxStyle), m.mapBoxStyle);
  check('the map box has the id the drag maths measures', m.mapId === 'vmap-day1');
  check('Sunday has its own map box id', C.venueMaps(clone(VENUE), POS, true)[1].mapId === 'vmap-day2');

  /* The chip answers what a map is good at — who is over there — because there
     is no room on it for four pitch names. The schematic is where those live. */
  eq('the chip names the groups on the block', blk('C4').mapWho, 'U11');
  eq('a shared block names both', (C.venueMaps(clone(VENUE), { D4: { x: 20, y: 21 } }, true)[0].blocks.find((b) => b.name === 'D4') || {}).mapWho, 'U6 · U7');
  check('the tooltip lists the actual pitches', /D3a, D3b/.test(blk('D3').mapTitle), blk('D3').mapTitle);
  check('…and the group in full', /U12 Mixed Contact/.test(blk('D3').mapTitle), blk('D3').mapTitle);

  const free = C.venueMaps({ day1: { label: 'x', pitches: ['D1'], groups: {} }, day2: { label: 'y', pitches: [], groups: {} } }, { D1: { x: 5, y: 5 } }, true)[0];
  eq('a block nobody is on says free', free.blocks[0].mapWho, 'free');
  check('…and is drawn as an outline', /dashed/.test(free.blocks[0].mapStyle), free.blocks[0].mapStyle);

  // Unplaced blocks are collected so the UI can offer to drop them on the map.
  const strays = m.strays.map((b) => b.name);
  check('unplaced blocks are collected as strays', strays.includes('D2') && !strays.includes('D3'), strays.join(','));
  check('hasStrays follows', m.hasStrays === true);
  check('a fully placed day has no strays',
    C.venueMaps(clone(VENUE), require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js')).DEFAULT_POSITIONS, true)[0].hasStrays === false);
}

/* ====================================================================== */
section('The lock');

{
  const POS = { D3: { x: 30, y: 30 } };
  /* `|| {}` for the same reason as the block lookup above: if D3 stops being
     rendered, these checks should say so rather than throw and stop the file. */
  const lockedBlk = C.venueMaps(clone(VENUE), POS, true)[0].blocks.find((b) => b.name === 'D3') || {};
  const openBlk = C.venueMaps(clone(VENUE), POS, false)[0].blocks.find((b) => b.name === 'D3') || {};

  check('locked: the block does not invite a drag', /cursor:default/.test(lockedBlk.mapStyle), lockedBlk.mapStyle);
  check('unlocked: it does', /cursor:grab/.test(openBlk.mapStyle), openBlk.mapStyle);
  /* Without touch-action:none a drag on a phone scrolls the page instead of
     moving the block, which looks exactly like the feature not working. */
  check('unlocked: touch dragging will not scroll the page instead', /touch-action:none/.test(openBlk.mapStyle), openBlk.mapStyle);
  check('locked: no touch-action override is needed', !/touch-action/.test(lockedBlk.mapStyle));

  const c = build(RECT);
  c.state = { ...c.state, vLocked: true };
  check('the lock starts ON', c.state.vLocked === true);
  c.toggleMapLock();
  check('toggling unlocks', c.state.vLocked === false);
  c.setState({ vDrag: { block: 'D3' } });
  c.toggleMapLock();
  check('locking again cancels any drag in progress', c.state.vDrag === null);
}

/* ====================================================================== */
section('Dragging — the maths, driven through the handlers');

{
  const start = { D3: { x: 30, y: 30 } };
  const fresh = () => {
    const c = build(RECT);
    c.state = { ...c.state, vLocked: false, venuePositions: { ...start }, venuePositionsSaved: { ...start }, venue: clone(VENUE), venueSaved: clone(VENUE) };
    return c;
  };

  /* Grab the block dead centre and move: it should land exactly where the
     pointer is, because the grab offset was zero. */
  {
    const c = fresh();
    c.onBlockDown('day1', 'D3', atPct(30, 30));
    check('a drag records itself', c.state.vDrag && c.state.vDrag.block === 'D3');
    c.onBlockMove('day1', 'D3', atPct(70, 40));
    eq('the block follows the pointer', c.state.venuePositions.D3, { x: 70, y: 40 });
    c.onBlockUp();
    check('releasing ends the drag', c.state.vDrag === null);
  }

  /* Grab it off-centre: the block must keep that offset, not snap its middle
     under the cursor. */
  {
    const c = fresh();
    c.onBlockDown('day1', 'D3', atPct(34, 33));      // 4% right, 3% below centre
    c.onBlockMove('day1', 'day1' === 'day1' ? 'D3' : 'D3', atPct(64, 53));
    eq('the grab offset is preserved', c.state.venuePositions.D3, { x: 60, y: 50 });
  }

  /* A block cannot be dragged off the map. */
  {
    const c = fresh();
    c.onBlockDown('day1', 'D3', atPct(30, 30));
    c.onBlockMove('day1', 'D3', ptr(RECT.left - 500, RECT.top - 500));
    eq('dragging past the top-left clamps to 0,0', c.state.venuePositions.D3, { x: 0, y: 0 });
    c.onBlockMove('day1', 'D3', ptr(RECT.left + RECT.width + 500, RECT.top + RECT.height + 500));
    eq('dragging past the bottom-right clamps to 100,100', c.state.venuePositions.D3, { x: 100, y: 100 });
  }

  /* THE ONE THAT MATTERS MOST: locked means locked. */
  {
    const c = fresh();
    c.setState({ vLocked: true });
    c.onBlockDown('day1', 'D3', atPct(30, 30));
    check('locked: pointing at a block starts no drag', c.state.vDrag === null);
    c.onBlockMove('day1', 'D3', atPct(80, 80));
    eq('locked: the block does not move', c.state.venuePositions.D3, start.D3);
  }

  /* A move with no drag in progress, or for a different block, must do nothing
     — pointer capture makes both reachable. */
  {
    const c = fresh();
    c.onBlockMove('day1', 'D3', atPct(80, 80));
    eq('a move with no drag does nothing', c.state.venuePositions.D3, start.D3);
    c.onBlockDown('day1', 'D3', atPct(30, 30));
    c.onBlockMove('day1', 'C4', atPct(80, 80));
    eq('a move for a different block does nothing', c.state.venuePositions.D3, start.D3);
    check('…and does not invent a position for it', c.state.venuePositions.C4 === undefined);
  }

  /* An unmeasurable map must move nothing rather than guess.

     ASSERTED ON THE GUARD ITSELF, not through a drag, and that distinction was
     found by fault injection. Replacing the `return null` with a constant
     `{x:50,y:50}` passes a down-then-move test perfectly: the grab offset is
     computed from the same constant, so it cancels exactly and the block lands
     back where it started. The drag looks correct while the guard is gone.
     Only calling pointerPct directly can tell the difference. */
  {
    const c = build(null);   // no element, so no rectangle
    c.state = { ...c.state, vLocked: false, venuePositions: { ...start }, venue: clone(VENUE), venueSaved: clone(VENUE), venuePositionsSaved: { ...start } };

    eq('an unmeasurable map gives no rectangle', c.mapRect('day1'), null);
    eq('…so a pointer has no position on it — null, not a guess', c.pointerPct('day1', atPct(80, 80)), null);

    /* A laid-out-but-collapsed element (a hidden tab, or before first layout)
       reports a zero-size rectangle. Dividing by that width gives Infinity. */
    const zero = build({ left: 0, top: 0, width: 0, height: 0 });
    eq('a zero-size map also gives no rectangle', zero.mapRect('day1'), null);
    eq('…and no pointer position', zero.pointerPct('day1', ptr(10, 10)), null);

    // And end to end: nothing moves, and nothing is marked as edited.
    c.onBlockDown('day1', 'D3', atPct(30, 30));
    c.onBlockMove('day1', 'D3', atPct(80, 80));
    eq('a map that cannot be measured moves nothing', c.state.venuePositions.D3, start.D3);
    check('…and does not mark the layout as edited', c.venueDirty() === false);
  }

  /* A real measurement must still come back, or the checks above would pass on
     a pointerPct that always returned null. */
  {
    const c = build(RECT);
    eq('a measurable map gives a position', c.pointerPct('day1', atPct(25, 75)), { x: 25, y: 75 });
    check('…and a rectangle', !!c.mapRect('day1'));
  }

  /* THE PRIMARY ROUTE is the dragged chip's own offsetParent, not a lookup by
     id. Each chip is absolutely positioned inside the map box, so the browser
     hands back exactly the element the percentages are measured against — and
     nothing depends on the template interpolating an id, which cannot be
     verified from here and would silently break every drag if it did not. */
  {
    const noDoc = build(null);   // getElementById finds nothing at all
    const e = atPct(60, 20);
    e.currentTarget.offsetParent = { getBoundingClientRect: () => RECT };
    eq('the chip measures against its own offsetParent', noDoc.pointerPct('day1', e), { x: 60, y: 20 });

    const withDoc = build({ left: 0, top: 0, width: 10, height: 10 });
    const e2 = atPct(60, 20);
    e2.currentTarget.offsetParent = { getBoundingClientRect: () => RECT };
    eq('…and it is preferred over the id lookup', withDoc.pointerPct('day1', e2), { x: 60, y: 20 });

    /* A drag driven entirely through the offsetParent route, with no document
       to fall back on — the shape the real page is in. */
    const c = build(null);
    c.state = { ...c.state, vLocked: false, venuePositions: { D3: { x: 30, y: 30 } }, venuePositionsSaved: { D3: { x: 30, y: 30 } }, venue: clone(VENUE), venueSaved: clone(VENUE) };
    const down = atPct(30, 30); down.currentTarget.offsetParent = { getBoundingClientRect: () => RECT };
    const move = atPct(75, 45); move.currentTarget.offsetParent = { getBoundingClientRect: () => RECT };
    c.onBlockDown('day1', 'D3', down);
    c.onBlockMove('day1', 'D3', move);
    eq('a full drag works with no id lookup available', c.state.venuePositions.D3, { x: 75, y: 45 });
  }

  /* Rounding, and the no-op guard behind it. Without rounding every pointer
     move writes a new float and the unsaved-changes flag flickers on a block
     nobody moved. */
  {
    const c = fresh();
    c.onBlockDown('day1', 'D3', atPct(30, 30));
    c.onBlockMove('day1', 'D3', ptr(RECT.left + RECT.width * 0.123456, RECT.top + RECT.height * 0.987654));
    eq('positions are rounded to a tenth of a percent', c.state.venuePositions.D3, { x: 12.3, y: 98.8 });
    const Comp = c.__Component;
    eq('clampPct rounds', Comp.clampPct(12.3456), 12.3);
    eq('clampPct floors at 0', Comp.clampPct(-40), 0);
    eq('clampPct caps at 100', Comp.clampPct(140), 100);

    const before = JSON.stringify(c.state.venuePositions);
    c.setBlockPosition('D3', 12.3, 98.8);
    eq('re-setting the same position changes nothing', JSON.stringify(c.state.venuePositions), before);
  }

  /* Dropping a stray block puts it in the middle, ready to be dragged. */
  {
    const c = fresh();
    c.placeBlock('Z9');
    eq('placing a stray drops it in the middle', c.state.venuePositions.Z9, { x: 50, y: 50 });
  }

  /* Pointer capture is what keeps a fast drag attached to a small chip. */
  {
    const c = fresh();
    const e = atPct(30, 30);
    c.onBlockDown('day1', 'D3', e);
    check('the block captures the pointer', e.captured.length === 1);
    check('…and the default action is prevented', e.defaultPrevented === true);
  }
}

/* ====================================================================== */
section('Moving a block counts as an unsaved change');

{
  const c = build(RECT);
  const start = { D3: { x: 30, y: 30 } };
  c.state = {
    ...c.state, vLocked: false, venue: clone(VENUE), venueSaved: clone(VENUE),
    venuePositions: { ...start }, venuePositionsSaved: { ...start },
  };
  check('nothing is dirty to begin with', c.venueDirty() === false);

  /* One Save covers both halves, so a Save button that only watched the layout
     would sit grey over a map somebody had just spent ten minutes arranging. */
  c.setBlockPosition('D3', 60, 60);
  check('moving a block makes the layout dirty', c.venueDirty() === true);
  check('…and the Save button comes alive', c.renderVals().vSaveDisabled === false);

  c.setState({ venuePositionsSaved: { ...c.state.venuePositions } });
  check('saving settles it again', c.venueDirty() === false);

  /* And the other half still works on its own. */
  c.editVenue((v) => { v.day1.pitches.push('ZZ1'); });
  check('editing the layout alone is still dirty', c.venueDirty() === true);
}

/* ====================================================================== */
section('Saving actually sends the positions');

{
  /* The failure this guards is the quiet one: everything on screen behaves,
     the drag works, Save goes green and says "Saved" — and the positions were
     never in the request, so they come back to the defaults on the next load
     and it looks like the map "forgot". */
  const sent = [];
  const c = build(RECT);
  const positions = { D3: { x: 11, y: 22 } };
  c.state = {
    ...c.state, tab: 'venue', vLoaded: true,
    venue: clone(VENUE), venueSaved: clone(VENUE),
    venuePositions: { ...positions }, venuePositionsSaved: {},
    api: {
      saveVenue: async (venue, pos) => { sent.push({ venue, pos }); return { ok: true, venue, positions: { D3: { x: 11, y: 22 } } }; },
      resetVenue: async () => ({ ok: false }),
      resetVenuePositions: async () => ({ ok: true, positions: { ...require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js')).DEFAULT_POSITIONS } }),
    },
  };

  return_check: {
    const done = c.doSaveVenue();
    // doSaveVenue is async; the call itself happens synchronously before the await.
    check('Save passes the positions to the data layer', sent.length === 1 && !!sent[0].pos, JSON.stringify(sent[0] && Object.keys(sent[0])));
    eq('…and passes the ones on screen', sent[0] && sent[0].pos, positions);
    check('…alongside the layout', !!(sent[0] && sent[0].venue && sent[0].venue.day1));
    void done;
  }
}

/* ====================================================================== */
section('The server side of the positions');

{
  const V = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js'));

  check('there is a default position for every block the schematic knows',
    Object.keys(V.DEFAULT_POSITIONS).length === 16, String(Object.keys(V.DEFAULT_POSITIONS).length));
  Object.keys(V.DEFAULT_POSITIONS).forEach((b) => {
    const p = V.DEFAULT_POSITIONS[b];
    check(`${b}'s default is on the map`, p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100, JSON.stringify(p));
  });
  /* Every block the shipped layout uses must start somewhere sensible, or the
     first thing an organiser sees is a tray full of blocks. */
  ['D5', 'D4', 'D3', 'D2', 'D1', 'C4', 'C5', 'B1', 'A1'].forEach((b) =>
    check(`${b} (used by the real layout) has a starting position`, !!V.DEFAULT_POSITIONS[b]));

  eq('a valid map is accepted and rounded', V.validatePositions({ D3: { x: 10.06, y: 20.04 } }).positions, { D3: { x: 10.1, y: 20 } });
  eq('block names are normalised to upper case', Object.keys(V.validatePositions({ d3: { x: 1, y: 2 } }).positions), ['D3']);
  check('nothing sent is fine — it means "leave them alone"', V.validatePositions(null).ok === true);
  check('…and stores nothing', V.validatePositions(null).positions === null);

  [
    ['an array', [1, 2]],
    ['a string', 'D3'],
    ['coordinates that are not numbers', { D3: { x: 'left', y: 2 } }],
    ['a coordinate past the right edge', { D3: { x: 101, y: 2 } }],
    ['a negative coordinate', { D3: { x: -1, y: 2 } }],
    ['no coordinates at all', { D3: {} }],
    ['a null block', { D3: null }],
  ].forEach(([label, input]) => {
    const r = V.validatePositions(input);
    check(`refused: ${label}`, r.ok === false, JSON.stringify(r.positions));
    check(`refused with a reason: ${label}`, r.ok === false && r.errors[0] && r.errors[0].length > 10);
  });

  const many = {};
  for (let i = 0; i < V.MAX_POSITIONS + 1; i += 1) many['B' + i] = { x: 1, y: 1 };
  check('a blob with absurdly many blocks is refused', V.validatePositions(many).ok === false);

  eq('merging nothing gives the defaults', V.mergePositions(null), V.DEFAULT_POSITIONS);
  eq('merging junk gives the defaults', V.mergePositions('x'), V.DEFAULT_POSITIONS);
  eq('a saved block overrides its default', V.mergePositions({ D3: { x: 1, y: 2 } }).D3, { x: 1, y: 2 });
  eq('…and the others are untouched', V.mergePositions({ D3: { x: 1, y: 2 } }).C4, V.DEFAULT_POSITIONS.C4);
  eq('an out-of-range saved value falls back to the default', V.mergePositions({ D3: { x: 500, y: 2 } }).D3, V.DEFAULT_POSITIONS.D3);
  check('merging does not mutate the defaults', V.DEFAULT_POSITIONS.D3.x === 28.4);

  /* THE TRAP THIS WHOLE SEPARATE KEY EXISTS TO AVOID: validateVenue rebuilds a
     day from a known list of fields, so anything else riding on the venue
     object is dropped on save. If positions had been stored there, the map
     would have appeared to save and then silently reverted. */
  const withExtra = clone(VENUE);
  withExtra.day1.positions = { D3: { x: 1, y: 2 } };
  const out = V.validateVenue(withExtra);
  check('an extra field on the venue layout IS dropped on save', out.ok === true && out.venue.day1.positions === undefined);
}

/* ====================================================================== */
section('The map labels can actually be read');

/* WHY THIS SECTION EXISTS — rewritten 2 Aug 2026. Jay found the chips hard
   to read twice: first white-on-tint at 88% opacity (fixed 27 Jul with
   WCAG-computed inks and nudged fills), then STILL hard to read, because
   the real problem was using the tint as a text surface at all on top of a
   bright, busy drawing. The redesign removes the computation entirely:
   every occupied chip is an opaque WHITE card carrying the page's constant
   dark ink, and each age group appears as an outlined swatch of its EXACT
   tint beside its code. #1A1C1F on #FFFFFF is ~16.9:1 — a constant, so
   there is no ratio left to compute and the old machinery (relLuminance /
   contrastRatio / chipInk / chipFill / mixHex) is deleted. What CAN still
   silently rot is pinned below: the body staying opaque white, the ink
   staying constant and never tint-keyed, the swatch carrying the exact
   tint with its outline, and every group getting exactly one swatch. */
{
  const H = helpers();

  /* The split, on the chip. Jay asked for the pitch count; it is a count and
     not a word because "QUARTERS" spelled out made the chips wide enough to
     overlap each other on the drawing. */
  eq('a whole pitch', H.splitMark(1), '×1');
  eq('halves', H.splitMark(2), '×2');
  eq('quarters', H.splitMark(4), '×4');
  eq('…and the words are still available for the tooltip', H.splitLabel(2), 'halves');
  eq('…including quarters', H.splitLabel(4), 'quarters');
  eq('an unexpected count is reported, not rounded to a lie', H.splitLabel(3), '3 surfaces');

  const C2 = build(RECT);
  const POS = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js')).DEFAULT_POSITIONS;
  const m = C2.venueMaps(clone(VENUE), POS, true)[0];
  const EMPTY = { mapStyle: '', mapNameStyle: '', mapWhoStyle: '', mapSplit: '', mapTitle: '', mapWho: '', mapGroups: [] };
  const blk = (name) => m.blocks.find((b) => b.name === name) || EMPTY;

  /* The body: opaque white, constant dark ink, strong rim. Checked across
     EVERY occupied block on the shipped layout, not one example. */
  m.blocks.filter((b) => b.mapWho !== 'free').forEach((b) => {
    const bg = (b.mapStyle.match(/background:([^;]+);/) || [])[1] || '';
    eq(`${b.name}: the chip body is opaque white`, bg, '#FFFFFF');
    check(`${b.name}: the ink is the constant page ink`, b.mapStyle.includes('color:#1A1C1F'), b.mapStyle);
    check(`${b.name}: the rim still gives it an edge on the drawing`,
      /border:2px solid rgba\(0,0,0,0\.55\)/.test(b.mapStyle), b.mapStyle);
  });

  /* THE SWEEP: all fifteen groups, one at a time, through the real builder.
     The swatch must carry the group's EXACT tint (byte-identical — it is
     the same identity the schematic and the standings use), outlined so the
     pale tints register on white, with the code in constant dark ink. */
  Object.keys(H.AGE_TINT).forEach((ag) => {
    const one = (C2.venueMaps(
      { day1: { label: 'x', pitches: ['D1'], groups: { [ag]: ['D1'] } }, day2: { label: 'y', pitches: [], groups: {} } },
      { D1: { x: 5, y: 5 } }, true
    )[0].blocks[0]) || EMPTY;
    const g = (one.mapGroups || [])[0] || {};
    eq(`${ag}: exactly one swatch`, (one.mapGroups || []).length, 1);
    check(`${ag}: the swatch carries the EXACT tint`,
      (g.swatchStyle || '').includes(`background:${H.AGE_TINT[ag]}`), g.swatchStyle);
    check(`${ag}: the swatch is outlined so pale tints register on white`,
      /border:1px solid rgba\(0,0,0,0\.35\)/.test(g.swatchStyle || ''), g.swatchStyle);
    check(`${ag}: the code is constant dark ink, never the tint`,
      (g.codeStyle || '').includes('color:#1A1C1F')
      && !(g.codeStyle || '').toLowerCase().includes(H.AGE_TINT[ag].replace('#', '').toLowerCase()), g.codeStyle);
    eq(`${ag}: the code names the group`, g.code, ag.toUpperCase());
    check(`${ag}: the code is at least 14px`, /font-size:1[4-9]px/.test(g.codeStyle || ''), g.codeStyle);
  });

  /* A time-share gets one swatch PER GROUP, in the layout's order — the two
     identities sit side by side instead of a gradient nobody could read
     text across. */
  {
    const d4 = blk('D4');
    eq('a shared block carries two swatches', (d4.mapGroups || []).length, 2);
    eq('…in the layout order', (d4.mapGroups || []).map((g) => g.code).join(','), 'U6,U7');
    check('…each with its own exact tint',
      ((d4.mapGroups || [])[0] || {}).swatchStyle.includes(`background:${H.AGE_TINT.u6}`)
      && ((d4.mapGroups || [])[1] || {}).swatchStyle.includes(`background:${H.AGE_TINT.u7}`));
  }

  /* The name row is untouched by the redesign — still 16px/900, still the
     size that fixed the first complaint. */
  check('the block name is at least 14px', /font-size:1[4-9]px/.test(blk('D3').mapNameStyle), blk('D3').mapNameStyle);
  check('…and heavier than the old 800', /font-weight:900/.test(blk('D3').mapNameStyle));

  /* The split reads off the chip. */
  eq('D3 is in halves on Saturday, and says so', blk('D3').mapSplit, '×2');
  eq('B1 is in quarters', blk('B1').mapSplit, '×4');
  eq('C4 is whole', blk('C4').mapSplit, '×1');
  check('the tooltip spells it out', /halves/.test(blk('D3').mapTitle), blk('D3').mapTitle);
  check('…and still names every surface', /D3a, D3b/.test(blk('D3').mapTitle), blk('D3').mapTitle);

  /* An empty block keeps the dark dashed ghost — "nobody here" should look
     unlike every real allocation at a glance, and it carries no swatches. */
  {
    const free = (C2.venueMaps(
      { day1: { label: 'x', pitches: ['D1'], groups: {} }, day2: { label: 'y', pitches: [], groups: {} } },
      { D1: { x: 5, y: 5 } }, true
    )[0].blocks[0]) || EMPTY;
    check('a free block has its own readable colour', /color:#CFD4DC/.test(free.mapStyle), free.mapStyle);
    check('…and is dashed rather than solid, as before', /dashed/.test(free.mapStyle));
    eq('…and carries no swatches', (free.mapGroups || []).length, 0);
    check('…and is flagged for the template the simple way', free.isFree === true && free.hasUsers === false);
  }
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node tests/_prove-registration.js`,
   which carries the venue-map faults too. Each is caught by the named check:

     * blockOfPitch stops normalising case -> "case is normalised"
     * the sub-pitch letter no longer
       stripped (every pitch its own
       block)                             -> "D5a is in block D5" and the block counts
     * BLOCK_GRID entry for B1 removed    -> "block B1 has a place on the drawing"
     * two blocks given the same cell     -> "no two blocks are placed in the same cell"
     * the shared-pitch branch made to
       use the warning colour             -> "NOT in a warning colour"
     * the shared branch made to show
       only the first group                -> "D4a names both groups"
     * unused pitches no longer reported  -> "named in the notes"
     * a pitch silently dropped from a
       block                              -> "every Saturday pitch is drawn exactly once"
     * the lock ignored on pointer-down   -> "locked: pointing at a block starts no drag"
     * the grab offset dropped            -> "the grab offset is preserved"
     * the clamp removed                  -> "dragging past the top-left clamps to 0,0"
     * rounding removed                   -> "positions are rounded to a tenth"
     * an unmeasurable map guessed at     -> "null, not a guess"  (see below)
     * the dirty check ignoring positions -> "moving a block makes the layout dirty"
     * Save no longer sending positions   -> "Save passes the positions to the data layer"
     * blocks anchored by corner          -> "and centred on it"
     * touch-action dropped               -> "will not scroll the page instead"
     * validatePositions not range-checking -> "a coordinate past the right edge"

   And the label legibility (redesigned 2 Aug 2026 — white cards, constant
   dark ink, exact-tint swatches; the old ink-picking machinery and its
   seven faults were deleted WITH their subject), all caught by name:

     * chip body translucent again        -> "the chip body is opaque white"
     * chip ink keyed off the tint again  -> "the ink is the constant page ink"
     * swatch loses its exact tint        -> "the swatch carries the EXACT tint"
     * swatch outline removed             -> "outlined so pale tints register"
     * code drawn in the tint again       -> "constant dark ink, never the tint"
     * shared block down to one swatch    -> "a shared block carries two swatches"
     * schematic label in the tint again  -> "the label ink is the dark page ink"
     * schematic time-share label back to
       the dark-mode light grey           -> "the shared label is dark ink too"
     * the name shrunk back to 11px       -> "at least 14px"
     * every chip reporting whole         -> "in halves on Saturday, and says so"
     * the tooltip losing the split word  -> "the tooltip spells it out"

   THE UNMEASURABLE-MAP FAULT IS THE ONE WORTH READING. Replacing pointerPct's
   `return null` with a constant `{x:50,y:50}` passed a full down-then-move test
   — because the grab offset is computed from the same constant and cancels it
   exactly, so the block lands back where it started and the drag looks perfect.
   The test had to be rewritten to assert on the guard itself. A test that
   exercises a behaviour end to end can be blind to a fault sitting in the
   middle of it, and only injecting the fault shows you which.

   AND ONE CLAIM IN THE CODE WAS WRONG, which the fault run is also what found.
   blockOfPitch's comment said its greedy `.*` was load-bearing — that 'D12A'
   would otherwise split as 'D1'. Injecting the lazy form changed nothing, and it
   cannot: the tail is one anchored letter, so backtracking makes the two
   identical. The comment has been corrected and the fault replaced with a real
   one in the same function. A test that passes for a reason nobody has checked
   is the thing this whole exercise exists to catch, and it works in both
   directions — on the code as well as on the tests.
   ====================================================================== */

summary('test-venue-map.js');
