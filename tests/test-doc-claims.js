/* tests/test-doc-claims.js
   ------------------------------------------------------------------------
   CLAIMS IN `CLAUDE.md` THAT GIVE INSTRUCTIONS, AND THAT NOTHING ELSE WOULD
   EVER CONTRADICT.

   ⚠️ WHY THIS FILE EXISTS. This repo has now been bitten four times by a
   documented claim that was simply false, and every time the cost was somebody
   acting on it:

     - the site-wide password was recorded as ON for two days after it was
       switched OFF;
     - every Netlify preview URL in CLAUDE.md pointed at a subdomain that had
       been renamed, so following the file to preview a branch returned 404 and
       the reasonable conclusion was "branch deploys are broken";
     - "an existing deploy answers 401" outlived the password that made it true;
     - the manager master invite key was documented as "admin" when the code
       requires a literal "*", which mints an account with access to nothing.

   None of those fail. Nothing errors. A wrong sentence in a doc is invisible
   until somebody spends money or an hour on it. The only defence is to assert
   the claim the same way code is asserted.

   6 Aug 2026 added a fifth, and it is the one this file was created for.
   CLAUDE.md told the next session: "If Netlify credits ever look higher than
   expected, that is the first place to look — `main` is not the only branch
   building." **A branch build cannot move the credit number, because it does
   not cost any.** Netlify's credit plans do not meter build minutes at all: a
   production deploy is 15 credits, and a branch deploy or Deploy Preview is 0.
   So the sentence sent the reader hunting in the one place that could never be
   the cause — while the real cost, production deploys, sat in the same file
   correctly stated two hundred lines away.

   ⚠️ THE CHECKS BELOW ARE DELIBERATELY NOT "does the file contain the right
   words". Two of them are DERIVED: the 15 quoted in the outstanding-work list
   must equal the 15 in the credit table, because the failure mode this repo
   keeps hitting is two copies of one fact drifting apart, not one copy being
   wrong on its own.

   ⚠️ AND THE TOMBSTONES ARE ASSERTED, NOT JUST THE CORRECTIONS. A retraction
   that gets tidied away is how a decision gets made twice — so the false
   sentence is REQUIRED to still be present, and required to be inside its
   tombstone rather than standing as live advice. That is a real distinction:
   the words are identical in both cases, so a check that merely looked for the
   sentence's absence would fail on the correct file, and a check that looked
   for its presence would pass on the broken one. Position is the only thing
   that tells them apart.

   Structural. This reads a document as text. It cannot tell you the doc is
   well written — only that the handful of claims in it that cost money or
   mislead a stranger still say what was measured.

   Sources for the credit figures, checked 6 Aug 2026:
   https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/ */

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Line endings normalised — git checks this out as CRLF on Windows and every
   multi-line anchor below is written with \n. An un-normalised read finds
   nothing and the checks pass by looking at nothing at all. */
const DOC = readRepo('CLAUDE.md').replace(/\r\n/g, '\n');

/* =========================================================================
   1. What a deploy actually costs
   ========================================================================= */

section('CLAUDE.md states the real Netlify credit model');

/* The production figure. Stated in two places in the file and they must agree
   — see the derived check at the end of this section. */
check('a production deploy is recorded as costing credits',
  /production deploy costs 15 Netlify credits/.test(DOC));

/* ⚠️ THE ONE THAT WAS MISSING ENTIRELY. Before 6 Aug the file said production
   deploys cost 15 and left branch builds undescribed except by a sentence
   implying they cost something. Silence is what let the wrong inference in. */
check('a branch deploy is recorded as costing ZERO, explicitly',
  /\*\*Branch deploy \/ Deploy Preview\*\* \| \*\*0 — free\*\*/.test(DOC));
check('a failed deploy is recorded as free', /\| Failed deploy \| 0 \|/.test(DOC));
check('a rollback is recorded as free', /\| Rolling back production \| 0 \|/.test(DOC));
check('the rule is stated in words as well as a table',
  /\*\*Only a successful production deploy spends credits\.\*\*/.test(DOC));

/* Not zero, and saying so keeps the correction honest rather than tidy. */
check('the non-build meters are recorded too, so "free" is not overclaimed',
  /Compute is 10 credits per GB-hour, bandwidth 20 per GB/.test(DOC));

/* The claim is dated and sourced. A figure with no source is a figure nobody
   can re-check, which is how the 401 test survived the password being removed. */
check('the credit figures cite Netlify\'s own docs',
  /docs\.netlify\.com\/manage\/accounts-and-billing\/billing\/billing-for-credit-based-plans\/how-credits-work/.test(DOC));

/* ⚠️ DERIVED, NOT PINNED. The production cost appears in the credit table AND
   in the outstanding-work list. Pinning "15" twice would pass happily while
   the two drifted; this requires them to be the same number, whatever it is.
   Two copies of one rule drift invisibly — this repo's most-repeated lesson. */
const tableCost = (DOC.match(/\| \*\*Production deploy\*\* \| \*\*(\d+) each\*\* \|/) || [])[1];
const listCost = (DOC.match(/production deploy costs (\d+) Netlify credits/) || [])[1];
check('the production cost was found in the credit table', !!tableCost, tableCost);
check('the production cost was found in the outstanding-work list', !!listCost, listCost);
eq('the two copies of the production cost agree', tableCost, listCost);

/* The same agreement, the other way: the outstanding-work list must not go
   back to calling a preview merely "free" without the number, because "free"
   was already there and was still read as "cheap". */
check('the outstanding-work list quotes the zero, not just the word "free"',
  /genuinely free — 0 credits, not "cheap"/.test(DOC));

/* =========================================================================
   2. The retracted claim survives as a tombstone, and ONLY as a tombstone
   ========================================================================= */

section('The false credit advice is retracted rather than deleted');

const FALSE_CLAIM = 'main` is not the only branch\nbuilding';
const RETRACTION = 'THAT IS FALSE and was corrected on 6 Aug 2026';

/* ⚠️ PRESENCE, because a deletion with no trace is an invitation to re-add it.
   Somebody will reach the same wrong conclusion from the same true premise
   ("branch deploys are enabled") unless the argument against it is sitting
   there. */
check('the retracted sentence is still recorded', DOC.includes(FALSE_CLAIM));
check('…and is explicitly marked false', DOC.includes(RETRACTION));
check('…with the reason, not just the verdict',
  /A branch build\ncannot move the credit number, because it does not cost any/.test(DOC));

/* ⚠️ POSITION, which is the check that actually discriminates. The retracted
   sentence and a restored one are the SAME STRING. Presence cannot tell them
   apart and neither can absence. What tells them apart is whether the words
   "USED TO END" come before it — i.e. whether it is being quoted or asserted. */
const usedToEnd = DOC.indexOf('THIS PARAGRAPH USED TO END');
const claimAt = DOC.indexOf(FALSE_CLAIM);
const retractAt = DOC.indexOf(RETRACTION);
check('the tombstone marker was found', usedToEnd > -1, String(usedToEnd));
check('the retracted sentence sits INSIDE its tombstone, not standing as advice',
  usedToEnd > -1 && claimAt > usedToEnd && retractAt > claimAt,
  `usedToEnd=${usedToEnd} claim=${claimAt} retract=${retractAt}`);

/* ⚠️ AND IT MUST APPEAR ONCE. The position check above reads the FIRST
   occurrence; a second copy pasted back as live advice further down the file
   would slip past it entirely. Same shape as the stuck-hover sweep, which had
   to count occurrences rather than compare text for exactly this reason. */
eq('the retracted sentence appears exactly once',
  DOC.split(FALSE_CLAIM).length - 1, 1);

/* =========================================================================
   3. A branch deploy outlives its branch
   ========================================================================= */

section('CLAUDE.md warns that deleting a branch does not take its site down');

/* ⚠️ MEASURED, NOT ASSUMED. `club-manager-page` was deleted from origin on
   6 Aug 2026 and its branch site was still answering 200 — with its functions
   running — minutes later, confirmed against Netlify's own support. */
check('the warning is recorded', /A BRANCH DEPLOY OUTLIVES ITS BRANCH/.test(DOC));
check('…with the mechanism, so it is not read as a Netlify glitch',
  /Deleting the git branch does\nNOT take the `<branch>--adhquins-jrt\.netlify\.app` site down/.test(DOC));

/* This is the part that makes it a security note rather than tidiness: a
   branch deploy's functions are not sandboxed from production's data. */
check('…and why it matters — the same env vars and the same stores as production',
  /read the SAME environment variables and the SAME Blobs stores as\nproduction/.test(DOC));
check('…with the concrete instance, so the severity is not left abstract',
  /no rate limiting on `manager-signup`/.test(DOC));

/* The setting change is recorded as a PARTIAL fix, because writing it down as
   a fix is how the next person stops looking. */
check('the branch-deploy restriction is recorded as not retracting what is published',
  /Restricting branch\ndeploys to `dev` stops the NEXT one; it does not retract one already published/.test(DOC));
check('the current branch-deploy setting is recorded',
  /branch deploys are enabled \*\*for `dev` only\*\* as of\n6 Aug 2026/.test(DOC));

/* =========================================================================
   4. The measurement lesson that found all of the above
   ========================================================================= */

section('The baseline lesson is recorded, because it cost a false all-clear');

/* ⚠️ A 404 was read as "my delete worked" when a branch name that never
   existed returns 404 too — and no before-reading had been taken. A negative
   check that fails for the wrong reason proves nothing; that is this repo's
   own written rule, and it was broken by the person who wrote it. */
check('the no-baseline trap is recorded',
  /\*\*A 404 with no before-reading proves nothing\.\*\*/.test(DOC));
check('…including the transient-failure half of it',
  /a single `000` from a\ntransient connection failure reads exactly like "the site is gone"/.test(DOC));

/* =========================================================================
   5. The claims that were corrected BEFORE this file existed
   ========================================================================= */

section('The earlier doc corrections have not drifted back');

/* These four are the reason this file exists. They were each corrected once,
   by hand, with nothing holding them in place afterwards. */
/* ⚠️ Written as a loop rather than one clever regex, on purpose. The first
   attempt at this check was a nested replace-with-callback that I could not
   reason about, and a check nobody can reason about is worse than no check —
   it reports confidence. Every mention of the dead host must be flagged as
   dead within the 400 characters before it; the live host must appear. */
const DEAD_HOST = 'serene-gingersnap-1d0eb6';
const deadMentions = [];
for (let i = DOC.indexOf(DEAD_HOST); i > -1; i = DOC.indexOf(DEAD_HOST, i + 1)) deadMentions.push(i);
const deadUnflagged = deadMentions.filter((i) =>
  !/not the old|which 404s|no longer|dead|→ \*\*404\*\*|USED TO/i.test(DOC.slice(Math.max(0, i - 400), i)));
check('the live preview host is documented', /--adhquins-jrt\.netlify\.app/.test(DOC));
check('the dead preview host is mentioned at all, so the rename stays recorded',
  deadMentions.length > 0, String(deadMentions.length));
eq('every mention of the dead host is flagged as dead', deadUnflagged.length, 0);
check('the dead 401 test is marked dead', /AND THE 401 TEST IS DEAD TOO/.test(DOC));
check('…and replaced with what an existing deploy actually answers',
  /\*\*200 means it is there, 404 means it is not\.\*\*/.test(DOC));
check('the master invite key is documented as the asterisk the code requires',
  !/`"admin"`/.test(DOC) || /NOT `"admin"`|not `"admin"`/.test(DOC));

summary('test-doc-claims.js');
