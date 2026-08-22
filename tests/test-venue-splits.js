/* tests/test-venue-splits.js
   ------------------------------------------------------------------------
   Main pitches and how they are split.

   THE MODEL: there are fifteen main pitches (D1–D5, C1–C5, B1, A1–A4,
   confirmed by Jay against the site) and each one is run whole, in halves or in
   quarters ON A GIVEN DAY. The playable surface names are DERIVED from that.
   Nothing is typed, so `C4`, `c4` and `Pitch C4` can never again be three
   different pitches to the clash check.

   THE ASSERTION THAT MATTERS MOST is the one about ground. When a split
   changes, an age group keeps the same GROUND and only the names change — split
   a pitch it had whole and it gets every part, merge the parts and it gets the
   whole. Get that wrong and an organiser silently loses an allocation to a
   rename, which nobody notices until a team turns up at a pitch that is not
   theirs.

   Second most important: the derivation must reproduce the layout the site
   already ships, exactly. If it does not, this change quietly moves live
   fixtures.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const V = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js'));
const clone = (o) => JSON.parse(JSON.stringify(o));

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
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic, { addEventListener() {} },
    { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null }
  );
  const c = new C();
  c.props = {};
  return c;
}

/* The panel is handed the SERVER's own functions, which is how it is wired in
   the browser too (organizer-data.js re-exports them from scores-data.js). */
const api = () => ({
  MAIN_PITCHES: V.MAIN_PITCHES,
  SPLITS: V.SPLITS,
  derivePitches: V.derivePitches,
  remapGroupPitches: V.remapGroupPitches,
});

/* ====================================================================== */
section('The fifteen main pitches');

eq('there are fifteen', V.MAIN_PITCHES.length, 15);
['D1', 'D2', 'D3', 'D4', 'D5'].forEach((p) => check(`${p} is a main pitch`, V.MAIN_PITCHES.includes(p)));
['C1', 'C2', 'C3', 'C4', 'C5'].forEach((p) => check(`${p} is a main pitch`, V.MAIN_PITCHES.includes(p)));
['A1', 'A2', 'A3', 'A4'].forEach((p) => check(`${p} is a main pitch`, V.MAIN_PITCHES.includes(p)));
check('B1 is a main pitch', V.MAIN_PITCHES.includes('B1'));
/* B2 on the map is the softball pitch and is not ours — Jay, 27 Jul 2026. */
check('B2 is NOT one of ours', !V.MAIN_PITCHES.includes('B2'));
check('no duplicates', new Set(V.MAIN_PITCHES).size === 15);
eq('whole, halves, quarters — nothing else', V.SPLITS, [1, 2, 4]);

/* ====================================================================== */
section('Deriving surfaces from a split');

eq('whole keeps the bare name', V.derivePitches({ D2: 1 }), ['D2']);
eq('halves get A and B', V.derivePitches({ D3: 2 }), ['D3a', 'D3b']);
eq('quarters get A to D', V.derivePitches({ B1: 4 }), ['B1a', 'B1b', 'B1c', 'B1d']);
eq('a pitch absent from splits contributes nothing', V.derivePitches({}), []);
eq('an illegal split is skipped, not guessed at', V.derivePitches({ D3: 3 }), []);
eq('a zero means not in use', V.derivePitches({ D3: 0 }), []);
eq('junk in gives nothing out', V.derivePitches(null), []);
eq('an unknown pitch name is ignored', V.derivePitches({ ZZ9: 2 }), []);
eq('order follows MAIN_PITCHES, not the object', V.derivePitches({ A1: 1, D5: 1 }), ['D5', 'A1']);

/* THE ONE THAT PROVES THIS CHANGE MOVES NOTHING. The shipped layout's pitch
   lists must come back out of the splits character for character — otherwise
   every saved fixture and every group allocation is quietly renamed. */
eq('Saturday derives exactly the shipped surfaces',
  V.derivePitches(V.DEFAULT_VENUE.day1.splits), V.DEFAULT_VENUE.day1.pitches);
eq('Sunday derives exactly the shipped surfaces',
  V.derivePitches(V.DEFAULT_VENUE.day2.splits), V.DEFAULT_VENUE.day2.pitches);
check('Saturday is still 18 surfaces', V.DEFAULT_VENUE.day1.pitches.length === 18);
check('Sunday is still 10 surfaces', V.DEFAULT_VENUE.day2.pitches.length === 10);

/* ====================================================================== */
section('A split belongs to a pitch AND a day');

{
  const d1 = V.DEFAULT_VENUE.day1.splits, d2 = V.DEFAULT_VENUE.day2.splits;
  /* Not decoration — the weekend runs this way, and one split per pitch would
     break it. */
  eq('D3 is halves on Saturday', d1.D3, 2);
  eq('…and whole on Sunday', d2.D3, 1);
  eq('C4 is whole on Saturday', d1.C4, 1);
  eq('…and halves on Sunday', d2.C4, 2);
  eq('B1 is quarters on Saturday', d1.B1, 4);
  eq('…and halves on Sunday', d2.B1, 2);
  eq('A1 is quarters on Saturday', d1.A1, 4);
  eq('…and halves on Sunday', d2.A1, 2);
  check('D5 is used on Saturday', d1.D5 === 2);
  check('…and not at all on Sunday', d2.D5 === undefined);
}

/* ====================================================================== */
section('A group keeps the same GROUND when a split changes');

{
  const R = V.remapGroupPitches;

  /* Whole -> halves: it had all of it, it still has all of it. */
  eq('splitting a whole pitch gives both halves', R(['D3'], { D3: 1 }, { D3: 2 }), ['D3a', 'D3b']);
  eq('splitting into quarters gives all four', R(['D3'], { D3: 1 }, { D3: 4 }), ['D3a', 'D3b', 'D3c', 'D3d']);

  /* Halves -> whole: there is one pitch now and they are on it. */
  eq('merging halves gives the whole pitch', R(['D3a', 'D3b'], { D3: 2 }, { D3: 1 }), ['D3']);
  eq('…even for a group that only had one half', R(['D3a'], { D3: 2 }, { D3: 1 }), ['D3']);
  eq('quarters merged to halves', R(['B1a', 'B1c'], { B1: 4 }, { B1: 2 }), ['B1a', 'B1b']);

  /* Nothing else moves. */
  eq('an untouched pitch is left alone', R(['D2', 'D1'], { D2: 1, D1: 1 }, { D2: 1, D1: 1 }), ['D2', 'D1']);
  eq('only the changed pitch is remapped',
    R(['D3', 'D2'], { D3: 1, D2: 1 }, { D3: 2, D2: 1 }), ['D3a', 'D3b', 'D2']);

  /* A pitch taken out of the day is gone, and the group loses it — there is no
     honest place to put it. */
  eq('a pitch removed from the day is dropped', R(['D3', 'D2'], { D3: 1, D2: 1 }, { D2: 1 }), ['D2']);

  eq('no duplicates come out', R(['B1a', 'B1b'], { B1: 2 }, { B1: 1 }), ['B1']);
  eq('junk in gives an empty list', R(null, {}, {}), []);
  eq('an empty list stays empty', R([], { D3: 2 }, { D3: 1 }), []);

  /* THE GROUND ITSELF. Whatever the split, a group that had the whole pitch has
     the whole pitch — asserted as a property across every legal transition
     rather than as one example. */
  [[1, 2], [1, 4], [2, 1], [2, 4], [4, 1], [4, 2], [1, 1], [2, 2], [4, 4]].forEach(([from, to]) => {
    const had = V.derivePitches({ D3: from });
    const now = R(had, { D3: from }, { D3: to });
    eq(`whole pitch stays whole: ${from} -> ${to}`, now, V.derivePitches({ D3: to }));
  });
}

/* ====================================================================== */
section('What the server will and will not store');

{
  const ok = V.validateVenue(clone(V.DEFAULT_VENUE));
  check('the shipped layout validates', ok.ok === true, (ok.errors || []).join(' '));
  eq('…and round-trips completely unchanged', ok.venue, V.DEFAULT_VENUE);

  /* `pitches` is always REBUILT from `splits`, never taken from the payload —
     if the two could disagree the site would read one and the panel edit the
     other. */
  const lying = clone(V.DEFAULT_VENUE);
  lying.day1.pitches = ['MADE', 'UP'];
  const fixed = V.validateVenue(lying);
  check('a payload lying about its pitches is corrected, not trusted', fixed.ok === true, (fixed.errors || []).join(' '));
  eq('…the surfaces come from the splits',
    ((fixed.venue || {}).day1 || {}).pitches, V.DEFAULT_VENUE.day1.pitches);

  /* A layout saved before splits existed still saves, with the splits inferred
     — nothing to migrate by hand. */
  const legacy = clone(V.DEFAULT_VENUE);
  delete legacy.day1.splits; delete legacy.day2.splits;
  const mig = V.validateVenue(legacy);
  check('a pitches-only layout still validates', mig.ok === true, (mig.errors || []).join(' '));
  /* `|| {}` throughout: validateVenue returns no `venue` when it refuses, and
     the check above is the one that should report that. Reaching into it blind
     throws instead and takes every later check in this file with it. */
  const migV = mig.venue || { day1: {}, day2: {} };
  eq('…and the splits are inferred correctly for Saturday', migV.day1.splits, V.DEFAULT_VENUE.day1.splits);
  eq('…and for Sunday', migV.day2.splits, V.DEFAULT_VENUE.day2.splits);
  eq('…leaving the surfaces identical', migV.day1.pitches, V.DEFAULT_VENUE.day1.pitches);

  eq('splitsFromPitches reads quarters', V.splitsFromPitches(['B1a', 'B1b', 'B1c', 'B1d']), { B1: 4 });
  eq('…halves', V.splitsFromPitches(['D3a', 'D3b']), { D3: 2 });
  eq('…and a whole pitch', V.splitsFromPitches(['D2']), { D2: 1 });
  /* Three surfaces is somebody's half-finished edit. Rounding UP invents a
     fourth, which is recoverable; rounding down deletes a real one, which is
     not. */
  eq('an odd count rounds up rather than dropping a surface', V.splitsFromPitches(['B1a', 'B1b', 'B1c']), { B1: 4 });

  [
    ['a split of three', (x) => { x.day1.splits.D3 = 3; }],
    ['a split of zero dressed up as a value', (x) => { x.day1.splits.D3 = 0; x.day1.groups.u12 = ['D3a']; }],
    ['a pitch nobody has heard of', (x) => { x.day1.splits.ZZ9 = 2; }],
    ['a group on a surface that does not exist', (x) => { x.day1.groups.u12 = ['D9Z']; }],
  ].forEach(([label, damage]) => {
    const bad = clone(V.DEFAULT_VENUE);
    damage(bad);
    const r = V.validateVenue(bad);
    check(`refused: ${label}`, r.ok === false, JSON.stringify(r.venue && r.venue.day1.splits));
    check(`refused with a reason: ${label}`, r.ok === false && r.errors[0] && r.errors[0].length > 10, (r.errors || [])[0]);
  });

  /* The old hard rules are untouched. */
  const both = clone(V.DEFAULT_VENUE);
  both.day2.groups.u6 = [];
  check('an age group on both days is still refused', V.validateVenue(both).ok === false);
  const neither = clone(V.DEFAULT_VENUE);
  delete neither.day1.groups.u6;
  check('an age group on neither day is still refused', V.validateVenue(neither).ok === false);
}

/* ====================================================================== */
section('The panel, driven');

{
  const c = build();
  c.state = {
    ...c.state, api: api(), tab: 'venue', vLoaded: true,
    venue: clone(V.DEFAULT_VENUE), venueSaved: clone(V.DEFAULT_VENUE),
    venuePositions: {}, venuePositionsSaved: {},
  };

  let vals = null;
  try { vals = c.renderVals(); } catch (e) { check('the venue tab renders', false, e.stack || e.message); }

  if (vals) {
    /* EVERY main pitch shows, used or not — Jay's ask. A pitch you are not
       using is a decision, and one you cannot see is one you cannot change. */
    eq('all fifteen main pitches show on Saturday', vals.vDays[0].mains.length, 15);
    eq('all fifteen show on Sunday too', vals.vDays[1].mains.length, 15);
    eq('…in the layout order', vals.vDays[0].mains.map((m) => m.name), V.MAIN_PITCHES);

    /* Falls back to an empty shape rather than undefined for the same reason as
       the modal checks below: if a pitch stops being rendered, the count check
       above is what should say so — not a TypeError that takes the rest of the
       file with it. */
    const sat = (n) => vals.vDays[0].mains.find((m) => m.name === n) || { choices: [] };
    /* The style of choice #i, or '' if there is no such choice. Keeps
       'four split choices' below an honest count while stopping a missing
       choice from throwing. */
    const style = (n, i) => ((sat(n).choices[i] || {}).style || '');
    check('D3 shows as in use', sat('D3').inUse === true);
    check('…listing its halves', /D3a · D3b/.test(sat('D3').surfaceLabel), sat('D3').surfaceLabel);
    check('C1 shows as not used today', sat('C1').inUse === false);
    check('…and says so in words', /not used/i.test(sat('C1').surfaceLabel), sat('C1').surfaceLabel);

    /* Four choices per pitch, exactly one of them selected. */
    eq('four split choices', sat('D3').choices.length, 4);
    eq('…labelled plainly', sat('D3').choices.map((x) => x.label), ['Not used', 'Whole', 'Halves', 'Quarters']);
    check('exactly one choice is highlighted', sat('D3').choices.filter((x) => (x.style || '').includes('var(--accent-mid)')).length === 1);
    check('…and it is the right one (halves)', style('D3', 2).includes('var(--accent-mid)'));
    check('an unused pitch highlights Not used', style('C1', 0).includes('var(--accent-mid)'));

    /* The age-group rows group surfaces by main pitch. */
    const u8 = vals.vGroups.find((g) => g.id === 'u8');
    const b1 = u8.pitchGroups.find((p) => p.main === 'B1');
    check('U8 has a B1 group of surfaces', !!b1);
    eq('…with all four quarters', b1.surfaces.map((x) => x.name), ['B1a', 'B1b', 'B1c', 'B1d']);
    check('…all ticked', b1.allOn === true);
    eq('…labelled by their letter, not repeating the pitch name', b1.surfaces.map((x) => x.short), ['a', 'b', 'c', 'd']);
    check('only pitches in use that day are offered',
      u8.pitchGroups.every((p) => Number(V.DEFAULT_VENUE.day1.splits[p.main]) > 0));
    const u11 = vals.vGroups.find((g) => g.id === 'u11');
    const c4 = u11.pitchGroups.find((p) => p.main === 'C4');
    check('a whole pitch is marked as whole', c4.whole === true);
    eq('…and shows a single surface', c4.surfaces.map((x) => x.name), ['C4']);
  }
}

/* ====================================================================== */
section('Changing a split in the panel');

{
  const fresh = () => {
    const c = build();
    c.state = {
      ...c.state, api: api(), tab: 'venue', vLoaded: true,
      venue: clone(V.DEFAULT_VENUE), venueSaved: clone(V.DEFAULT_VENUE),
      venuePositions: {}, venuePositionsSaved: {}, venueUsage: null,
    };
    return c;
  };

  /* D3 is halves on Saturday and U12 has both. Make it whole. */
  {
    const c = fresh();
    c.setPitchSplit('day1', 'D3', 1);
    eq('the split is stored', c.state.venue.day1.splits.D3, 1);
    check('the surfaces are rebuilt', c.state.venue.day1.pitches.includes('D3') && !c.state.venue.day1.pitches.includes('D3a'));
    eq('U12 keeps the ground it had, under the new name', c.state.venue.day1.groups.u12, ['D3']);
    check('nobody else is touched', JSON.stringify(c.state.venue.day1.groups.u11) === JSON.stringify(['C4']));
    check('the layout is now dirty', c.venueDirty() === true);
  }

  /* C4 is whole on Saturday and U11 has it. Cut it into quarters. */
  {
    const c = fresh();
    c.setPitchSplit('day1', 'C4', 4);
    eq('U11 gets all four quarters', c.state.venue.day1.groups.u11, ['C4a', 'C4b', 'C4c', 'C4d']);
    eq('…and the surfaces exist', c.state.venue.day1.pitches.filter((p) => p.indexOf('C4') === 0), ['C4a', 'C4b', 'C4c', 'C4d']);
  }

  /* Setting the same split again is a no-op, not a dirty flag. */
  {
    const c = fresh();
    c.setPitchSplit('day1', 'D3', 2);
    check('setting the split it already has changes nothing', c.venueDirty() === false);
  }

  /* Removing a pitch is destructive, so it asks first. */
  {
    const c = fresh();
    c.setPitchSplit('day1', 'C5', 0);
    /* `|| {}` deliberately. If the confirm stops opening, the check above is
       the one that should report it — reading .title off null instead throws,
       kills the process, and every check after this point silently never runs.
       A suite that collapses proves nothing about the fault that collapsed it. */
    check('taking a pitch out opens a confirm', !!c.state.modal);
    const m1 = c.state.modal || {};
    check('…naming the group that loses it', /U10/.test(m1.title), m1.title);
    check('…and nothing has changed yet', c.state.venue.day1.splits.C5 === 1);
    if (c.state.modal) c.submitModal();
    check('confirming removes it', c.state.venue.day1.splits.C5 === undefined);
    eq('…and the group loses the allocation', c.state.venue.day1.groups.u10, []);
    check('…leaving the group on the day, with no pitches', 'u10' in c.state.venue.day1.groups);
  }

  /* Cancelling leaves everything alone. */
  {
    const c = fresh();
    c.setPitchSplit('day1', 'C5', 0);
    c.closeModal();
    check('cancelling changes nothing', c.state.venue.day1.splits.C5 === 1);
    eq('…and the group keeps its pitch', c.state.venue.day1.groups.u10, ['C5']);
  }

  /* A change that would strand SAVED FIXTURES warns before doing it. */
  {
    const c = fresh();
    c.setState({ venueUsage: { day1: { D3a: 6, D3b: 6 } } });
    c.setPitchSplit('day1', 'D3', 1);
    check('a split with saved matches on it asks first', !!c.state.modal);
    const m2 = c.state.modal || {};   // same reason as above — report, do not throw
    check('…and says how many', /12 saved matches/.test(m2.title), m2.title);
    check('…and which surfaces go', /D3a, D3b/.test(m2.title), m2.title);
    check('…and warns that fixtures do not follow', /fixtures do not/i.test(m2.title));
  }

  /* Taking a whole main pitch for a group in one click. */
  {
    const c = fresh();
    const surfaces = ['B1a', 'B1b', 'B1c', 'B1d'];
    c.toggleGroupMain('u9', 'day1', 'B1', surfaces, true);
    eq('U9 picks up every quarter of B1', c.state.venue.day1.groups.u9.filter((p) => p.indexOf('B1') === 0), surfaces);
    check('…without losing what it already had', c.state.venue.day1.groups.u9.includes('A1a'));
    c.toggleGroupMain('u9', 'day1', 'B1', surfaces, false);
    check('…and drops them all again', !c.state.venue.day1.groups.u9.some((p) => p.indexOf('B1') === 0));
    check('…still keeping the rest', c.state.venue.day1.groups.u9.includes('A1a'));
  }

  /* Reset clears ASSIGNMENTS in the working copy — nothing else, and never
     the server (Jay, 2 Aug 2026: this replaced a "Reset to 2025 layout"
     button that posted the built-in layout back immediately). */
  {
    const c = fresh();
    let posted = 0;
    c.state.api = { ...c.state.api, resetVenue: async () => { posted += 1; return { ok: true }; } };
    c.doResetVenue();
    check('Reset opens a confirm first', !!c.state.modal);
    const m = c.state.modal || {};
    check('…that says what it clears and what it keeps',
      /Clear every age group/.test(m.title) && /Days and pitch splits are kept/.test(m.title), m.title);
    check('…and its button says what it does', (m.okLabel || '') === 'Clear assignments', m.okLabel);
    check('…and nothing has changed yet', (c.state.venue.day1.groups.u10 || []).length > 0);
    if (c.state.modal) c.submitModal();
    check('confirming empties every group on day 1',
      Object.values(c.state.venue.day1.groups).every((l) => Array.isArray(l) && l.length === 0));
    check('…and every group on day 2',
      Object.values(c.state.venue.day2.groups).every((l) => Array.isArray(l) && l.length === 0));
    check('every group KEEPS its day (membership intact)',
      'u10' in c.state.venue.day1.groups && 'u13' in c.state.venue.day2.groups);
    eq('the splits are untouched', c.state.venue.day1.splits, clone(V.DEFAULT_VENUE.day1.splits));
    eq('…and the surfaces with them', c.state.venue.day1.pitches, clone(V.DEFAULT_VENUE.day1.pitches));
    check('the layout is dirty — Save is how it goes live', c.venueDirty() === true);
    check('the saved copy is untouched until then',
      (c.state.venueSaved.day1.groups.u10 || []).length > 0);
    eq('NOTHING was posted to the server', posted, 0);
  }

  /* Cancelling the reset changes nothing. */
  {
    const c = fresh();
    c.doResetVenue();
    c.closeModal();
    check('cancelling keeps every assignment', (c.state.venue.day1.groups.u10 || []).length > 0);
    check('…and the layout is not dirty', c.venueDirty() === false);
  }
}

/* ====================================================================== */
section('The free-text pitch box is gone');

{
  const page = readRepo('Organizer.dc.html');
  /* This is the whole point of the model. A box to type a pitch name into is
     how `C4`, `c4` and `Pitch C4` became three pitches the clash check could
     not reconcile — a bug that had to be dug out of this codebase once already. */
  check('no "add a pitch" input remains', !/Add a pitch/i.test(page));
  check('no addPitch handler remains', !/\baddPitch\b/.test(page));
  check('no removePitch handler remains', !/\bremovePitch\b/.test(page));
  check('no free-text pitch state remains', !/vNewPitch/.test(page));
  check('the panel does not build pitch names itself', !/derivePitches\s*=\s*function/.test(page));
  check('…it asks the shared one', /api\.derivePitches/.test(page));
  check('…and the shared remap, not its own', /api\.remapGroupPitches/.test(page));

  const data = readRepo('organizer-data.js');
  check('organizer-data.js forwards the pitch model', /MAIN_PITCHES/.test(data) && /remapGroupPitches/.test(data));

  /* The old server-posting reset is gone from the callable code (comments
     stripped first — a tombstone naming it must not satisfy this). The
     driven checks above prove what Reset does INSTEAD. */
  const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  check('the 2025-layout server reset is gone from the data layer',
    !/export async function resetVenue\b/.test(stripJs(data)));
  const pageCode = stripJs(readRepo('Organizer.dc.html').replace(/<!--[\s\S]*?-->/g, ''));
  check('…and the page no longer calls it', !/api\.resetVenue\b/.test(pageCode));
  check('…or mentions 2025 anywhere a user reads (only a code comment may)',
    !/2025/.test(pageCode), (pageCode.match(/.{0,60}2025.{0,40}/) || [])[0]);
}

/* ====================================================================== */
section('The two DEFAULT_VENUE copies still agree');

{
  /* The front end carries its own copy because it needs an answer before any
     fetch resolves. Both must carry the same splits, or the panel and the site
     disagree about what exists. */
  const grab = (f) => {
    const t = readRepo(f);
    const i = t.indexOf('DEFAULT_VENUE = {');
    const j = t.indexOf('\n};', i);
    return t.slice(i + 16, j + 2).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  };
  // eslint-disable-next-line no-eval
  const a = eval('(' + grab(path.join('netlify', 'functions', '_venue.js')) + ')');
  // eslint-disable-next-line no-eval
  const b = eval('(' + grab('scores-data.js') + ')');
  eq('the server and front-end layouts are deep-equal', b, a);
  eq('…including Saturday splits', b.day1.splits, V.DEFAULT_VENUE.day1.splits);
  eq('…and Sunday splits', b.day2.splits, V.DEFAULT_VENUE.day2.splits);

  /* And the front end's own copy of the derivation agrees with the server's. */
  const sd = readRepo('scores-data.js');
  check('scores-data.js exports MAIN_PITCHES', /export const MAIN_PITCHES/.test(sd));
  check('…and derivePitches', /export function derivePitches/.test(sd));
  check('…and remapGroupPitches', /export function remapGroupPitches/.test(sd));
  const listInSd = JSON.parse((sd.match(/export const MAIN_PITCHES = (\[[^\]]*\])/) || [])[1].replace(/'/g, '"'));
  eq('the two MAIN_PITCHES lists are identical', listInSd, V.MAIN_PITCHES);
}

/* ====================================================================== */
section('WHEN the tournament is comes from the code, not the blob');

/* WHY THIS EXISTS. mergeVenue() used to read `src.date` and fall back to the
   default only when the blob had none — and validateVenue() persisted the date
   on every save. There is no back-office control for it: the panel edits splits
   and groups, and saveVenue() posts back the whole working copy, so the field
   was only ever round-tripped. One save was therefore enough to freeze the
   tournament date in a blob, permanently outranking this repo.

   It was found moving the tournament from 7-8 to 14-15 November (11 Aug 2026).
   Nothing would have failed: the deploy is clean, the tests are green, and the
   JSON-LD in the head moves while everything the venue feeds - the countdown,
   the day headings, the fixtures pages - keeps saying the old date. The site
   disagrees with itself about when the tournament is, and the only signal is a
   parent turning up on the wrong Saturday.

   So the three date fields are read from DEFAULT_VENUE unconditionally on both
   paths. The blob still owns splits and groups, which ARE panel decisions. */
{
  /* A blob shaped exactly like a real saved one, but carrying last month's
     dates - which is what production actually held. */
  const stale = clone(V.DEFAULT_VENUE);
  stale.day1.date = '2026-11-07';
  stale.day1.label = 'Saturday 7 November';
  stale.day1.short = 'SAT-OLD';
  stale.day2.date = '2026-11-08';
  stale.day2.label = 'Sunday 8 November';

  const merged = V.mergeVenue(stale);
  eq('a stale date in the blob does not win on read', merged.day1.date, V.DEFAULT_VENUE.day1.date);
  eq('…nor a stale label', merged.day1.label, V.DEFAULT_VENUE.day1.label);
  eq('…nor a stale short name', merged.day1.short, V.DEFAULT_VENUE.day1.short);
  eq('…and the same for day two', merged.day2.date, V.DEFAULT_VENUE.day2.date);

  /* The half that stops it coming back: a save must not write the date out
     again, or the next read has a fresh stale copy to ignore forever. */
  const saved = V.validateVenue(stale);
  check('a payload carrying a stale date still validates', saved.ok === true, (saved.errors || []).join(' '));
  eq('…and is corrected on the way in', ((saved.venue || {}).day1 || {}).date, V.DEFAULT_VENUE.day1.date);
  eq('…label too', ((saved.venue || {}).day1 || {}).label, V.DEFAULT_VENUE.day1.label);

  /* The blob must still own what it legitimately owns - this is not "ignore the
     blob", it is "ignore the two fields nothing can set". */
  const custom = clone(V.DEFAULT_VENUE);
  custom.day1.splits = { D1: 2 };
  custom.day1.groups = { u6: ['D1a'], u7: ['D1b'], u8: [], u9: [], u10: [], u11: [], u12: [], u18b: [], u18g: [] };
  const kept = V.mergeVenue(custom);
  eq('an organiser split still comes from the blob', kept.day1.splits, { D1: 2 });
  eq('…and the surfaces derived from it', kept.day1.pitches, ['D1a', 'D1b']);
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST.

   All fourteen are in tests/_prove-registration.js (numbers 47-60) and all
   fourteen are caught BY THE NAMED CHECK — not by the file falling over, which
   proves nothing. Run `node tests/_prove-registration.js` after touching either
   the split model or this file.

     the model
     * B2 put back into MAIN_PITCHES        -> "B2 is NOT one of ours"
     * halves suffixed 1/2 instead of A/B   -> "Saturday derives exactly the
                                               shipped surfaces"
     * a whole pitch given an 'A' suffix    -> the same
     * splitsFromPitches rounding DOWN      -> "rounds up rather than dropping"

     the ground invariant
     * a group given only the first part    -> "whole pitch stays whole"
     * a group losing its allocation        -> "splitting a whole pitch gives
                                               both halves"
     * the panel not remapping groups       -> "keeps the ground it had"

     the server
     * validateVenue trusting the payload's
       pitches instead of rebuilding them   -> "corrected, not trusted"
     * the two DEFAULT_VENUE copies drifting-> "deep-equal" / "Saturday splits"

     the panel
     * age-group rows offering pitches that
       are not in use that day              -> "only pitches in use are offered"
     * the day card hiding unused pitches    -> "all fifteen main pitches show"
     * removing a pitch without asking      -> "taking a pitch out opens a
                                               confirm"
     * stranding saved fixtures silently    -> "a split with saved matches on it
                                               asks first"
     * the free-text pitch box put back     -> "no addPitch handler remains"
   ====================================================================== */

summary('test-venue-splits.js');
