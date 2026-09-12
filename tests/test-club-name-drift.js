/* tests/test-club-name-drift.js
   ---------------------------------------------------------------------------
   normaliseClubName lives in TWO copies (JRT-7): the browser copy in
   Organizer.dc.html (the reconcileClubs helper) and the Node copy in
   _regstore.js (used by the public dropdown join). They MUST agree — if they
   diverge, the organiser's Clubs tab groups two spellings as one club while the
   public dropdown keys them as two, so a club an organiser named would silently
   not appear. This runs a battery through both and fails on any difference.

   ⚠️ If either anchor stops matching, the copy moved: REPOINT it, never delete
   the test (CLAUDE.md rule 6). A drift test that cannot find one copy proves
   nothing.
*/

const path = require('path');
const { section, check, eq, summary, repoRoot, readRepo } = require('./_lib');

const FN = path.join(repoRoot(), 'netlify', 'functions');
const { normaliseClubName: nodeCopy } = require(path.join(FN, '_regstore.js'));

/* Pull the browser copy out of Organizer.dc.html — the regex and the function,
   extracted together so the function's reference to CLUB_SUFFIX_RE resolves. */
const org = readRepo('Organizer.dc.html');
const suffix = org.match(/const CLUB_SUFFIX_RE = \/[^\n]*;/);
const func = org.match(/function normaliseClubName\(raw\) \{[\s\S]*?\n\}/);
if (!suffix || !func) {
  throw new Error('could not find CLUB_SUFFIX_RE / normaliseClubName in Organizer.dc.html — the anchor rotted; repoint it (rule 6)');
}
// eslint-disable-next-line no-new-func
const browserCopy = new Function(suffix[0] + '\n' + func[0] + '\n;return normaliseClubName;')();

const battery = [
  'Dubai Sharks', 'Dubai Sharks RFC', 'dubai sharks', '  Dubai   Sharks ',
  'St.Georges', "St George's", 'St Georges', 'Genève', 'Geneve',
  'RC Sharks', 'Al Ain FC Juniors', 'QUINS AD', 'Barrelhouse RUFC',
  'Abu Dhabi Harlequins Rugby Football Club', 'Al Ain Amblers RC',
  '', '   ', 'A-B_C', 'x'.repeat(50), null, undefined,
];

section('The two normaliseClubName copies agree, character for character');
{
  let allSame = true;
  battery.forEach((c) => {
    const a = nodeCopy(c);
    const b = browserCopy(c);
    if (a !== b) allSame = false;
    check('same for ' + JSON.stringify(c), a === b, 'node=' + JSON.stringify(a) + ' browser=' + JSON.stringify(b));
  });

  /* CONTROLS — the battery actually exercises the paths a broken copy would
     change, so "they match" is not "they both do nothing". */
  eq('CONTROL: the trailing suffix is stripped (RFC dropped)', nodeCopy('Dubai Sharks RFC'), 'dubai sharks');
  eq('CONTROL: a LEADING RC is kept (suffix is trailing-only)', nodeCopy('RC Sharks'), 'rc sharks');
  eq('CONTROL: an apostrophe closes the gap (st georges)', nodeCopy("St George's"), 'st georges');
  eq('CONTROL: accents fold (geneve)', nodeCopy('Genève'), 'geneve');
  check('CONTROL: every case in the battery was compared and matched', allSame);
}

summary('test-club-name-drift.js');
