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
   THE AGE CHECK — sub-project 2, added 28 Jul 2026.
   ------------------------------------------------------------------------
   ageGroupCheck() is copied character for character out of _playerAgeCheck()
   in "Quins JRT.dc.html" (minus the playUpConsent handling, a UI concept).
   PREV_GROUP_ID, AGE_GRADE_CUTOFF_DATE and calcAge() are the same verbatim-
   copy pattern the age table above already uses, so the drift check below is
   the same shape as "the two copies agree".
   ====================================================================== */
section('The age check — the two copies agree');

/* Pull PREV_GROUP_ID out of the page the same way clientTable() pulls
   AGE_GROUP_INFO. */
function clientPrevGroupId() {
  const t = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
  const i = t.indexOf('const PREV_GROUP_ID = {');
  const j = t.indexOf('\n};', i);
  check('the client PREV_GROUP_ID was found in the page', i >= 0 && j > i);
  if (i < 0 || j <= i) return {};
  const src = t.slice(i + 'const PREV_GROUP_ID = '.length, j + 2);
  // eslint-disable-next-line no-eval
  return eval('(' + src + ')');
}

eq('the server carries the same play-up chain', A.PREV_GROUP_ID, clientPrevGroupId());
eq('every non-youngest group has a previous group', Object.keys(A.PREV_GROUP_ID).length, 14);
check('U6 has no previous group — it is the youngest', !('u6' in A.PREV_GROUP_ID));

/* Lands a player at exactly `age` at the 31 Aug 2026 cut-off: 1 January of the
   right birth year has already had its birthday by then, so the cut-off age
   is simply 2026 minus the birth year. */
const dobAtCutoffAge = (age) => `${2026 - age}-01-01`;

/* ---- nothing to check without both pieces ------------------------------ */
eq('no dob, nothing to check', A.ageGroupCheck('', 'U16B Contact').status, 'ok');
eq('no group, nothing to check', A.ageGroupCheck(dobAtCutoffAge(20), '').status, 'ok');
eq('an unparsable dob does not throw', A.ageGroupCheck('not-a-date', 'U16B Contact').status, 'ok');

/* ---- the message text, character for character -------------------------- */
{
  const playUp = A.ageGroupCheck(dobAtCutoffAge(13), 'U16B Contact'); // 13 fits U14B
  eq('the play-up sentence', playUp.status, 'playUp');
  eq('…word for word',
    playUp.message,
    "This player's age at the 31 Aug 2026 cut-off fits U14B Contact, one age group younger than U16B Contact. Playing up one age group is permitted with parent/guardian consent.");

  const blocked = A.ageGroupCheck(dobAtCutoffAge(20), 'U16B Contact');
  eq('the blocked sentence', blocked.status, 'blocked');
  eq('…word for word',
    blocked.message,
    'U16B Contact is for players who are 14 or 15 years old at the UAERF age-grade cut-off (31 Aug 2026). Based on this date of birth, the player is 20 at that cut-off — please check the date of birth or select the correct age group.');
}

/* ---- U16/U18 done properly: a two-year band is NOT a boundary case ------ */
/* U16B/U16G/U18B/U18G all span two years. Both years are 'ok' — this is not
   a play-up situation and must never be treated as one. */
[['U16B Contact', 14], ['U16B Contact', 15], ['U16G Contact', 14], ['U16G Contact', 15],
  ['U18B Contact', 16], ['U18B Contact', 17], ['U18G Contact', 16], ['U18G Contact', 17]].forEach(([name, age]) => {
  eq(`${name} at age ${age} is simply ok, not a boundary case`,
    A.ageGroupCheck(dobAtCutoffAge(age), name).status, 'ok');
});

/* ---- the boundary sweep, all fifteen groups, both edges ----------------- */
/* Not one example. For every group: one year younger than its lowest age, and
   one year older than its highest age. That is 30 cases, not counting the
   groups above already swept for their two-year band. */
section('The age check — boundary sweep, all fifteen groups');

A.AGE_GROUPS.forEach((g) => {
  const lowest = Math.min(...g.ages);
  const highest = Math.max(...g.ages);

  /* One year OLD of the band: always blocked. There is no "play up" for being
     too old — the rule only ever lets a player down one group, never up. */
  const tooOld = A.ageGroupCheck(dobAtCutoffAge(highest + 1), g.name);
  check(`${g.name}: one year older than the band is blocked`, tooOld.status === 'blocked', tooOld.status);

  /* One year YOUNG of the band. If the previous group in the chain actually
     covers that age, it's a play-up; otherwise it's blocked. U6 has no
     previous group at all, so it can only ever be blocked here. */
  const prevInfo = A.AGE_GROUP_BY_ID[A.PREV_GROUP_ID[g.id]];
  const tooYoung = A.ageGroupCheck(dobAtCutoffAge(lowest - 1), g.name);
  const expectPlayUp = !!(prevInfo && prevInfo.ages.includes(lowest - 1));
  check(`${g.name}: one year younger than the band is ${expectPlayUp ? 'a play-up' : 'blocked'}`,
    tooYoung.status === (expectPlayUp ? 'playUp' : 'blocked'), tooYoung.status);
});

/* ---- the girls' chain, checked separately from the boys' ---------------- */
/* u14g -> u12g -> u11 is a DIFFERENT chain from the boys' u14b -> u13 -> u12,
   even though both groups sit at the same age. A lookup that accidentally
   fell through to the boys' chain would silently drift a girl into the wrong
   group and every check above would still pass, because it sweeps id-by-id
   rather than comparing the two streams to each other. */
eq('u14g plays up into u12g, not u13', A.PREV_GROUP_ID.u14g, 'u12g');
eq('u16g plays up into u14g, not u16b\'s u14b', A.PREV_GROUP_ID.u16g, 'u14g');
eq('u18g plays up into u16g, not u18b\'s u16b', A.PREV_GROUP_ID.u18g, 'u16g');
{
  const r = A.ageGroupCheck(dobAtCutoffAge(11), 'U14G QR'); // 11 fits U12G, not U13
  eq('a girl one year young for U14G is flagged against U12G', r.status, 'playUp');
  check('…named correctly, not U13', /U12G QR/.test(r.message), r.message);
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
