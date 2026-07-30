/* tests/test-team-logos.js
   ------------------------------------------------------------------------
   Each participating club's crest, shown to the left of its team code
   wherever a code appears (app.html, Scores & Standings.dc.html, the team
   key legend in both). teamLogoSrc() in scores-data.js is the one place
   the code->crest mapping is spelled out — this proves it resolves every
   real club's prefix, degrades safely for an unknown one, and that the
   ten files it points at actually exist in assets/logos/.

   scores-data.js is an ES module with browser-only dependencies (fetch,
   localStorage, a dynamic import of local-backend.js), so it cannot be
   require()'d directly under plain Node — same problem test-venue-splits.js
   solves for DEFAULT_VENUE. Grab just the two self-contained declarations
   (the TEAM_LOGOS object and the teamLogoSrc function) out of the file text
   and eval them in isolation; they have no dependency on anything else in
   the module. */

const path = require('path');
const fs = require('fs');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const SRC = readRepo('scores-data.js');

function grabBlock(startMarker, endMarker) {
  const i = SRC.indexOf(startMarker);
  if (i < 0) throw new Error(`could not find "${startMarker}" in scores-data.js`);
  const j = SRC.indexOf(endMarker, i);
  if (j < 0) throw new Error(`could not find "${endMarker}" after "${startMarker}"`);
  return SRC.slice(i, j + endMarker.length);
}

const teamLogosSrc = grabBlock('const TEAM_LOGOS = {', '\n};');
const teamLogoSrcFnSrc = grabBlock('export function teamLogoSrc', '\n}')
  .replace('export function', 'function'); // eval() can't take a top-level `export`

/* Build a working copy of teamLogoSrc() in an isolated scope — exactly the
   two declarations it needs, nothing else from the real module. */
function buildTeamLogoSrc(logosBlockSrc, fnSrc) {
  // eslint-disable-next-line no-eval
  return eval(`(function(){ ${logosBlockSrc}\n${fnSrc}\nreturn teamLogoSrc; })()`);
}

const teamLogoSrc = buildTeamLogoSrc(teamLogosSrc, teamLogoSrcFnSrc);

section('Every known club prefix resolves to a crest');
[
  ['ADH1', '/assets/logos/adh.png'],
  ['ADH2', '/assets/logos/adh.png'],   // same club's 2nd team shares the crest
  ['DE1', '/assets/logos/de.png'],
  ['DS1', '/assets/logos/ds.png'],
  ['DH1', '/assets/logos/dh.png'],
  ['DT1', '/assets/logos/dt.png'],
  ['BAR1', '/assets/logos/bar.png'],
  ['AAA1', '/assets/logos/aaa.png'],
  ['DD1', '/assets/logos/dd.png'],
  ['ADSB1', '/assets/logos/adsb.png'],
  ['DW1', '/assets/logos/dw.png'],
].forEach(([code, expected]) => {
  eq(`${code} -> ${expected}`, teamLogoSrc(code), expected);
});

section('Case and shape it must not trip on');
eq('lowercase code still resolves', teamLogoSrc('adh1'), '/assets/logos/adh.png');
eq('a code with no trailing number still resolves (club, not team, identity)', teamLogoSrc('ADH'), '/assets/logos/adh.png');

section('Unknown or absent clubs fail SAFE — no logo, not a broken image');
eq('an "Other" free-text club with no fixed prefix returns empty', teamLogoSrc('XYZ1'), '');
eq('a hand-typed full club name (not a code) returns empty', teamLogoSrc('Abu Dhabi Harlequins'), '');
eq('empty string returns empty', teamLogoSrc(''), '');
eq('null returns empty', teamLogoSrc(null), '');
eq('undefined returns empty', teamLogoSrc(undefined), '');

section('Every path teamLogoSrc can return actually exists on disk');
const root = repoRoot();
const allPaths = new Set(
  Object.values(eval(`(function(){ ${teamLogosSrc}\nreturn TEAM_LOGOS; })()`))
);
check(`found ${allPaths.size} distinct logo paths (expected 10)`, allPaths.size === 10, `got ${allPaths.size}`);
allPaths.forEach((p) => {
  const onDisk = path.join(root, p.replace(/^\//, ''));
  check(`${p} exists in the repo`, fs.existsSync(onDisk));
});

section('PROVE IT: a broken prefix-extraction regex actually fails this test');
/* Swap in a version that does NOT strip the trailing digits before looking
   the prefix up — a fault that would make every multi-team club (ADH2, DE2…)
   silently show no crest. If this passes against a broken variant, the real
   assertions above aren't actually exercising the digit-stripping logic. */
const brokenFnSrc = teamLogoSrcFnSrc.replace(
  /const m = String\(code \|\| ''\)\.match\(\/\^\(\[A-Za-z\]\+\)\\d\*\$\/\);/,
  "const m = String(code || '').match(/^([A-Za-z]+\\d*)$/);" // captures the WHOLE code incl. digits — wrong
);
check('the substitution above actually changed the source (guards against a stale regex)', brokenFnSrc !== teamLogoSrcFnSrc);
const brokenTeamLogoSrc = buildTeamLogoSrc(teamLogosSrc, brokenFnSrc);
check(
  'the broken variant fails to resolve ADH2 (proves the real code exercises digit-stripping)',
  brokenTeamLogoSrc('ADH2') !== '/assets/logos/adh.png',
  `broken variant returned "${brokenTeamLogoSrc('ADH2')}"`
);
// ...and confirm the REAL function still gets it right, so we know the harness itself isn't broken.
eq('the real function still resolves ADH2 correctly (harness sanity check)', teamLogoSrc('ADH2'), '/assets/logos/adh.png');

summary('test-team-logos.js');
