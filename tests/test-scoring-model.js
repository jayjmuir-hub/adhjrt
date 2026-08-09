/* tests/test-scoring-model.js
   ---------------------------------------------------------------------------
   The scoring model is carried TWICE and nothing asserted the two copies agree.

     netlify/functions/_scoring.js   POINTS, BY_AGE, FESTIVAL_AGE_IDS   (server)
     scores-data.js                  SCORE_POINTS, SCORE_BY_AGE, hasStandings (browser)

   The server totals a submitted result from its copy; the browser builds the
   score-entry form and shows the running total from the other. They agree
   today. Nothing made them.

   ⚠️ THIS EXACT DUPLICATION HAS ALREADY GONE WRONG TWICE IN THIS REPO — the
   pitch model and the registration rules each drifted, and each got a
   patchShared()-style helper afterwards so a fault has to be injected into BOTH
   copies. The scoring model was never given the same treatment, and it is the
   one that decides what a match was won by.

   ⚠️ WHAT DRIFT WOULD LOOK LIKE, and why nothing catches it today: a manager
   enters four tries and two conversions, the form shows 24, the server stores
   24 — until one table changes. Then the form shows one number, the standings
   show another, and the first person to notice is a coach who thinks the table
   is wrong. No error, no log, nothing red.

   ⚠️ EXTRACTED BY PARSING, NOT BY require(). scores-data.js is an ES module
   whose top level reaches for fetch, so it cannot simply be required in a test
   runner — the same reason test-session-permissions.js and test-venue-splits.js
   extract from it rather than importing it.
*/

const fs = require('fs');
const path = require('path');
const { section, check, eq, summary, repoRoot } = require('./_lib');

const SERVER = require(path.join(repoRoot(), 'netlify', 'functions', '_scoring.js'));
const CLIENT_SRC = fs.readFileSync(path.join(repoRoot(), 'scores-data.js'), 'utf8');

/* Pull a top-level `const NAME = {...};` out of the module source and evaluate
   just that object. Anchored to the start of a line so a mention of the name in
   a comment cannot be mistaken for the declaration — the trap that has caught
   six checks in this repo already. */
function literal(name) {
  const re = new RegExp(`^const ${name}\\s*=\\s*(\\{[\\s\\S]*?\\n?\\});`, 'm');
  const m = CLIENT_SRC.match(re);
  if (!m) throw new Error(`${name} not found as a top-level const in scores-data.js`);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${m[1]});`)();
}

const SCORE_POINTS = literal('SCORE_POINTS');
const SCORE_BY_AGE = literal('SCORE_BY_AGE');

/* ====================================================================== */
section('The extraction found real objects — without this the rest is vacuous');

check('SCORE_POINTS was extracted', SCORE_POINTS && Object.keys(SCORE_POINTS).length >= 4);
check('SCORE_BY_AGE was extracted', SCORE_BY_AGE && Object.keys(SCORE_BY_AGE).length >= 15);
check('the server copy loaded', SERVER.POINTS && Object.keys(SERVER.POINTS).length >= 4);
check('…and its age table', SERVER.BY_AGE && Object.keys(SERVER.BY_AGE).length >= 15);

/* ====================================================================== */
section('⚠️ What each thing is worth — the two copies must be identical');

eq('the points tables match exactly',
  JSON.stringify(SCORE_POINTS, Object.keys(SCORE_POINTS).sort()),
  JSON.stringify(SERVER.POINTS, Object.keys(SERVER.POINTS).sort()));

Object.keys(SERVER.POINTS).forEach((k) => {
  eq(`${k} is worth the same on both sides`, SCORE_POINTS[k], SERVER.POINTS[k]);
});

/* A component one side knows and the other does not is drift too — the form
   would offer a box whose value the server silently ignores. */
eq('neither side knows a component the other does not',
  Object.keys(SCORE_POINTS).sort().join(','), Object.keys(SERVER.POINTS).sort().join(','));

/* ====================================================================== */
section('⚠️ What each age group scores — the two copies must be identical');

eq('the two age tables cover the same groups',
  Object.keys(SCORE_BY_AGE).sort().join(','), Object.keys(SERVER.BY_AGE).sort().join(','));

Object.keys(SERVER.BY_AGE).forEach((ag) => {
  eq(`${ag} scores the same things on both sides`,
    JSON.stringify(SCORE_BY_AGE[ag]), JSON.stringify(SERVER.BY_AGE[ag]));
});

/* ====================================================================== */
section('⚠️ The festival groups — the server list and hasStandings must agree');

{
  /* _scoring.js's own comment says FESTIVAL_AGE_IDS "mirrors hasStandings:false
     in AGE_GROUPS in scores-data.js — keep the two in step", and nothing kept
     them in step. A group that is festival on one side and competitive on the
     other either refuses scores nobody expected to lose, or keeps a table
     nobody meant to publish. */
  const noStandings = [...CLIENT_SRC.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?hasStandings:\s*false/g)]
    .map((m) => m[1]).sort();
  check('hasStandings:false groups were found in scores-data.js', noStandings.length > 0,
    'the regex found none — that is a broken scan, not an empty answer');
  eq('the festival lists match', noStandings.join(','), [...SERVER.FESTIVAL_AGE_IDS].sort().join(','));

  /* And a festival group must score nothing beyond tries on either side —
     otherwise the two lists agreeing would still leave a group that keeps no
     table but offers penalty entry. */
  SERVER.FESTIVAL_AGE_IDS.forEach((ag) => {
    eq(`${ag} is tries-only on the server`, JSON.stringify(SERVER.BY_AGE[ag]), '["tries"]');
    eq(`${ag} is tries-only in the browser`, JSON.stringify(SCORE_BY_AGE[ag]), '["tries"]');
  });
}

/* ====================================================================== */
section('A worked total agrees on both sides');

{
  /* The end-to-end statement of the whole file: same inputs, same answer.
     4 tries + 2 conversions at U16B = 4*5 + 2*2 = 24. */
  const parts = { tries: 4, conversions: 2, penalties: 0, drops: 0 };
  const serverTotal = SERVER.totalFor('u16b', parts);
  const clientTotal = (SCORE_BY_AGE.u16b || []).reduce((sum, k) => sum + (parts[k] || 0) * (SCORE_POINTS[k] || 0), 0);
  eq('the server totals 4 tries + 2 conversions at U16B as 24', serverTotal, 24);
  eq('…and the browser arrives at the same number', clientTotal, serverTotal);
}

summary('test-scoring-model.js');
