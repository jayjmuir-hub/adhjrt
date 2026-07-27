/* tests/_lib.js — the small shared harness the registration-window tests use.
   ------------------------------------------------------------------------------
   WHY THESE LIVE IN THE REPO. They assert exact strings out of
   _registration.js, scores-data.js and two .dc.html files. Kept on a disk
   outside the repo they drift: check out an older commit and the tests you have
   are whichever ones happen to be on that machine today, not the ones that
   matched that code. In here a checkout gives you both halves at once — and any
   machine with a clone can run them, which is precisely what went wrong on
   27 July, when a session bridged to the wrong PC could not run a single one of
   the 577 existing checks.

   REPO PATH. Normally just the parent of this folder. ADHJRT_REPO still wins if
   it is set, and the old out-of-repo locations are still tried, so a stray copy
   of this file in someone's adhjrt-sim keeps working rather than failing
   obscurely. Drop those fallbacks once the thirteen older files have moved in
   here too — see tests/README.md. */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CANDIDATES = [
  process.env.ADHJRT_REPO,
  path.join(__dirname, '..'),
  path.join(os.homedir(), 'GitHub', 'adhjrt'),
  'C:\\Users\\jayjm\\GitHub\\adhjrt',
  'C:\\Users\\Jay\\GitHub\\adhjrt',
].filter(Boolean);

function repoRoot() {
  for (const c of CANDIDATES) {
    try { if (fs.existsSync(path.join(c, 'CLAUDE.md'))) return c; } catch (e) { /* next */ }
  }
  throw new Error(
    'Could not find the adhjrt clone. Set ADHJRT_REPO to its path.\nTried:\n  ' + CANDIDATES.join('\n  ')
  );
}

function readRepo(rel) { return fs.readFileSync(path.join(repoRoot(), rel), 'utf8'); }

/* ---- assertions ---------------------------------------------------------- */

let passed = 0;
const failures = [];
let currentSection = '';

function section(name) { currentSection = name; console.log('\n— ' + name); }

function check(label, cond, detail) {
  if (cond) { passed++; return true; }
  failures.push(`${currentSection ? currentSection + ' / ' : ''}${label}${detail ? '  →  ' + detail : ''}`);
  console.log('   FAIL  ' + label + (detail ? '  →  ' + detail : ''));
  return false;
}

function eq(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return check(label, a === e, a === e ? '' : `got ${a}, expected ${e}`);
}

function summary(fileLabel) {
  const total = passed + failures.length;
  console.log(`\n${fileLabel}: ${passed}/${total} checks passed`);
  if (failures.length) {
    console.log('\nFAILURES:');
    failures.forEach((f) => console.log('  • ' + f));
    process.exit(1);
  }
  process.exit(0);
}

/* Counts without exiting — for a file that wants to report before deciding. */
function counts() { return { passed, failed: failures.length }; }

module.exports = { repoRoot, readRepo, section, check, eq, summary, counts };
