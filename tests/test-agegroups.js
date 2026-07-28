/* tests/test-agegroups.js
   ------------------------------------------------------------------------
   The fifteen age groups exist TWICE — once in "Quins JRT.dc.html" as
   AGE_GROUP_INFO, because the registration form needs squad caps and age
   warnings before any fetch resolves, and once in netlify/functions/_agegroups.js
   so the server can enforce the squad cap without trusting the browser.

   There is no build step in this repo, so there is no way to have one copy.
   Same situation as DEFAULT_VENUE, which is duplicated between _venue.js and
   scores-data.js for the same reason. This file is what stops the two drifting.

   THE SQUAD CAP IS WHY IT MATTERS. Until now it was checked in the browser
   only — `_squadCap()` in the page — so anyone editing the page could register
   a squad of any size and nothing downstream would notice. Once the gateway
   enforces it server-side, a server table saying 18 where the client says 12
   means a coach fills in eighteen names, the form lets them, and the server
   accepts a squad six players over the limit for a contact age grade.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const A = require(path.join(repoRoot(), 'netlify', 'functions', '_agegroups.js'));

/* Pull the client's array out of the page and evaluate it. Comments are
   stripped first: they contain apostrophes and braces that would otherwise end
   up inside the expression. CRLF is normalised because a Windows checkout has
   it and the anchors below are written with \n. */
function clientTable() {
  const t = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
  const i = t.indexOf('const AGE_GROUP_INFO = [');
  const j = t.indexOf('\n];', i);
  check('the client table was found in the page', i >= 0 && j > i);
  if (i < 0 || j <= i) return [];
  const src = t.slice(i + 'const AGE_GROUP_INFO = '.length, j + 2)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
  // eslint-disable-next-line no-eval
  return eval('(' + src + ')');
}

/* ====================================================================== */
section('The two copies agree');

{
  const client = clientTable();
  /* Deep equality, not "the same ids". A difference in `ages` is sub-project
     2's whole subject and a difference in `squad` is enforceable today. */
  eq('the server carries exactly the client table', A.AGE_GROUPS, client);
  eq('there are fifteen', A.AGE_GROUPS.length, 15);
  eq('…on both sides', client.length, 15);
  check('every group has an id, a name, ages, a format and a squad',
    A.AGE_GROUPS.every((g) => g.id && g.name && Array.isArray(g.ages) && g.ages.length
      && g.format && typeof g.squad === 'number'));
  check('no duplicate ids', new Set(A.AGE_GROUPS.map((g) => g.id)).size === 15);
  check('no duplicate names', new Set(A.AGE_GROUPS.map((g) => g.name)).size === 15);
}

/* ====================================================================== */
section('Squad caps — the number the server will enforce');

/* Written out by hand rather than derived from the table, so a typo in the
   table is CAUGHT rather than copied. Read off AGE_GROUP_INFO in
   "Quins JRT.dc.html" on 28 Jul 2026. All four girls' groups play 7s with a
   squad of 12, including U16G and U18G — which is why they differ from the
   boys' groups of the same age, and why this list is not derivable from a rule. */
{
  const expected = {
    'U6 Tag': 12,
    'U7 Tag': 12,
    'U8 Tag': 12,
    'U9 Mixed Contact': 12,
    'U10 Mixed Contact': 15,
    'U11 Mixed Contact': 18,
    'U12 Mixed Contact': 18,
    'U12G QR': 12,
    'U13 Mixed Contact': 15,
    'U14B Contact': 18,
    'U14G QR': 12,
    'U16B Contact': 18,
    'U16G Contact': 12,
    'U18B Contact': 18,
    'U18G Contact': 12,
  };
  eq('all fifteen are named here', Object.keys(expected).length, 15);
  Object.keys(expected).forEach((name) => {
    eq(`${name} squad cap`, A.squadCap(name), expected[name]);
  });
  eq('the largest squad anywhere is 18', A.MAX_SQUAD_ANY_GROUP, 18);
  check('…and it is derived from the table, not typed',
    A.MAX_SQUAD_ANY_GROUP === Math.max(...A.AGE_GROUPS.map((g) => g.squad)));
}

/* ====================================================================== */
section('An unknown group falls back UP, never down');

/* Matching the client's _squadCap(): a coach typing the roster before picking
   an age group must not be blocked. The fallback is the LARGEST squad in the
   tournament, so it can only ever be more permissive than the real cap — and
   the real cap applies the moment a group is present. A fallback that guessed
   low would refuse a legitimate 18-player squad with no way for the coach to
   understand why. */
eq('an unknown group falls back to the largest cap', A.squadCap('not a group'), 18);
eq('no group at all falls back too', A.squadCap(''), 18);
eq('null falls back too', A.squadCap(null), 18);
eq('undefined falls back too', A.squadCap(undefined), 18);
eq('a number falls back rather than throwing', A.squadCap(12), 18);
eq('an object falls back rather than throwing', A.squadCap({}), 18);
/* Names are compared exactly. The gateway refuses an unrecognised age group
   outright rather than guessing, so a near-miss must NOT quietly resolve.

   U16G, NOT U16B. U16B's real cap is 18 and the fallback is also 18, so a
   near-miss resolving to the real group would return the same number either way
   and this check would pass on a broken lookup. U16G's cap is 12, so the two
   answers differ and the check can actually tell them apart. (Found by injecting
   the fault: the first version of this used U16B and did not notice.) */
eq('the wrong case is not the same group', A.squadCap('u16g contact'), 18);
eq('trailing space is not the same group', A.squadCap('U16G Contact '), 18);
eq('a leading space is not either', A.squadCap(' U16G Contact'), 18);
check('…and the group it nearly matched really does have a different cap',
  A.squadCap('U16G Contact') === 12);

/* ====================================================================== */
section('Lookups');

/* `|| {}` throughout. A fault that empties or rekeys an index makes these
   undefined, and reaching into undefined throws — which kills the file and
   means every check after this point silently never runs. The check should
   REPORT the broken index, not take the suite down with it. */
const byName = (n) => A.AGE_GROUP_BY_NAME[n] || {};
const byId = (i) => A.AGE_GROUP_BY_ID[i] || {};

eq('by name', byName('U16B Contact').id, 'u16b');
eq('by id', byId('u16b').name, 'U16B Contact');
eq('ages at the cut-off', byId('u16b').ages, [14, 15]);
eq('a single-year group', byId('u6').ages, [5]);
check('an unknown name gives undefined, not a throw', A.AGE_GROUP_BY_NAME.nope === undefined);
check('an unknown id gives undefined, not a throw', A.AGE_GROUP_BY_ID.nope === undefined);
eq('every id is indexed', Object.keys(A.AGE_GROUP_BY_ID).length, 15);
eq('every name is indexed', Object.keys(A.AGE_GROUP_BY_NAME).length, 15);

/* The ids have to match the ones the rest of the site already uses for age
   groups — the venue layout keys its `groups` object on them, so a mismatch
   would silently detach a registration from the day it plays. */
{
  const V = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js'));
  const venueIds = new Set(
    Object.keys(V.DEFAULT_VENUE.day1.groups).concat(Object.keys(V.DEFAULT_VENUE.day2.groups))
  );
  eq('the venue layout knows the same fifteen', venueIds.size, 15);
  A.AGE_GROUPS.forEach((g) => {
    check(`${g.id} is an age group the venue layout knows`, venueIds.has(g.id));
  });
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node tests/_prove-registration.js`:

     * U16B's cap changed on the server only -> "U16B Contact squad cap"
     * an unknown group falling back to the
       smallest cap instead of the largest   -> "falls back to the largest cap"
     * squadCap made case-insensitive        -> "the wrong case is not the same
                                                group" (see the note there: the
                                                first version of that check used
                                                U16B, whose cap equals the
                                                fallback, and passed on the fault)
     * an id renamed away from the venue
       layout's                              -> "is an age group the venue
                                                layout knows"
   ====================================================================== */

summary('test-agegroups.js');
