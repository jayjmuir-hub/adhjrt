/* tests/test-back-office-links.js
   ------------------------------------------------------------------------
   Where the two back-office sign-ins live on the public homepage, and what
   they are called.

   THE PROBLEM THIS FIXES. There were FIVE links to two destinations, under
   FOUR different names:

     top nav          "Organizer"          -> Organizer.dc.html
     top nav          "Manager"            -> /manager
     footer Explore   "Manager dashboard"  -> /manager
     footer bar       "Organizer login"    -> Organizer.dc.html
     footer bar       "Manager login"      -> /manager

   Three problems in one. The top nav is the most valuable space on the site
   and it was spending two slots on the handful of volunteers who use the back
   office, ahead of the thousands of parents and coaches the page is written
   for — and on a phone those two pushed genuinely public links further down
   the collapsed menu. The same destination had three different names, so
   nobody could tell whether they went to the same place. And the organiser
   link was written as a raw filename while the manager link beside it used
   the clean rewrite, which is the state a broken link starts from.

   Jay's call, 2 Aug 2026: sign-ins live at the BOTTOM only, named
   "Quins Organizer" and "Quins Age Group Manager".

   Structural, not visual: this reads the page as text. It can tell you the
   links are where they should be and named what they should be named; it
   cannot tell you they look right. */

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Line endings normalised — git checks this file out as CRLF on Windows and
   the anchors below are written with \n. See test-sponsors.js for the version
   of this that silently passed by looking at nothing at all. */
const PAGE = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');

function stripComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ''); }

/* The three regions this file cares about, sliced by their own markers. There
   is exactly one <nav> and one <footer> in the page — asserted below, because
   if a second ever appears these slices quietly start describing the wrong
   part of the document. */
eq('there is exactly one nav element', (PAGE.match(/<nav[\s>]/g) || []).length, 1);
eq('there is exactly one footer element', (PAGE.match(/<footer[\s>]/g) || []).length, 1);

const navStart = PAGE.indexOf('<nav class="hdr-nav"');
const NAV = stripComments(PAGE.slice(navStart, PAGE.indexOf('</nav>', navStart)));
const footStart = PAGE.indexOf('<footer');
const FOOTER = stripComments(PAGE.slice(footStart, PAGE.indexOf('</footer>', footStart)));
const BODY_ABOVE_FOOTER = stripComments(PAGE.slice(0, footStart));

/* =========================================================================
   1. Not in the top nav
   ========================================================================= */

section('The top nav carries no back-office links');

check('no /organizer link in the nav', !/href="\/organizer"/.test(NAV));
check('no /manager link in the nav', !/href="\/manager"/.test(NAV));
/* The raw filename is the form the organiser link used to take. Checking for
   it separately matters: a check on "/organizer" alone would pass while
   `Organizer.dc.html` sat there doing exactly the same job. */
check('no raw Organizer.dc.html link in the nav', !/Organizer\.dc\.html/.test(NAV));

/* ⚠️ AND THE PUBLIC LINKS ARE STILL THERE. Deleting two anchors out of a list
   of nine is one bad selection away from deleting three, and a check that only
   asserts absence would pass on an empty nav — this repo's own headline lesson
   (CLAUDE.md: "asserting the absence of things is not a test"). */
const PUBLIC_NAV = [
  ['About', '#about'], ['Format', '#format'], ['Fixtures', '#schedule'],
  ['Results', '#results'], ['Venue', '#venue'], ['App', '/app'],
  ['Sponsors', '#sponsors'],
];
PUBLIC_NAV.forEach(([label, href]) => {
  check(`the nav still has ${label} -> ${href}`,
    NAV.includes(`href="${href}"`) && NAV.includes(`>${label}<`));
});
eq('the nav has exactly seven links, all public', (NAV.match(/<a\s/g) || []).length, 7);

/* =========================================================================
   2. Nowhere else above the footer either
   ========================================================================= */

section('Nothing above the footer links to the back office');

/* "At the bottom" means at the bottom. A stray link half way down the page
   would satisfy every check in section 1 and still be wrong. */
check('no /organizer link anywhere above the footer', !/href="\/organizer"/.test(BODY_ABOVE_FOOTER));
check('no /manager link anywhere above the footer', !/href="\/manager"/.test(BODY_ABOVE_FOOTER));
check('no Organizer.dc.html link anywhere above the footer',
  !/href="Organizer\.dc\.html"/.test(BODY_ABOVE_FOOTER));

/* =========================================================================
   3. In the footer, once each, under the agreed names
   ========================================================================= */

section('The footer carries one of each, correctly named');

eq('exactly one /organizer link in the footer', (FOOTER.match(/href="\/organizer"/g) || []).length, 1);
eq('exactly one /manager link in the footer', (FOOTER.match(/href="\/manager"/g) || []).length, 1);

/* The Explore column used to carry a third link, to /manager, called
   "Manager dashboard" — a fourth name for the second destination. The count
   above catches its return, but this names it so the failure explains itself. */
check('the Explore column no longer says "Manager dashboard"', !FOOTER.includes('Manager dashboard'));

const orgTag = (FOOTER.match(/<a href="\/organizer"[\s\S]*?<\/a>/) || [''])[0];
const mgrTag = (FOOTER.match(/<a href="\/manager"[\s\S]*?<\/a>/) || [''])[0];

check('the organiser link is labelled "Quins Organizer"', /Quins Organizer/.test(orgTag), orgTag.slice(-60));
check('the manager link is labelled "Quins Age Group Manager"', /Quins Age Group Manager/.test(mgrTag), mgrTag.slice(-60));

/* The old wording. Named explicitly rather than left to the label checks,
   because "Quins Organizer login" would pass those and is not what was
   agreed. */
check('the old "Organizer login" wording is gone', !FOOTER.includes('Organizer login'));
check('the old "Manager login" wording is gone', !FOOTER.includes('Manager login'));

/* Both are back-office doors and both should look like each other — one pill,
   one arrow, same treatment. A rename is where that quietly stops being true. */
check('the organiser link keeps the pill styling', /border-radius:100px/.test(orgTag));
check('the manager link keeps the pill styling', /border-radius:100px/.test(mgrTag));
check('both links carry the same arrow', orgTag.includes('→') && mgrTag.includes('→'));

/* ⚠️ THE CLEAN URL, NOT THE FILENAME. `netlify.toml` rewrites /organizer onto
   Organizer.dc.html, so both forms work today and nothing would notice the
   difference — until the rewrite is the thing somebody changes. The two links
   sit next to each other and must be written the same way. */
check('no raw Organizer.dc.html href survives in the footer',
  !/href="Organizer\.dc\.html"/.test(FOOTER));
check('netlify.toml still rewrites /organizer, so the clean URL resolves',
  /from\s*=\s*"\/organizer"/.test(readRepo('netlify.toml')));

/* =========================================================================
   4. The longer names have to still fit on a phone
   ========================================================================= */

section('The footer bar copes with the longer labels');

/* ⚠️ MEASURED, AND IT WAS BROKEN. The bar is `justify-content:space-between`
   with no wrap. "Organizer login →" happened to fit; "Quins Age Group Manager
   →" does not — at 390px wide the row overflowed its own box by 136px, so
   half the second pill sat past the edge of the screen with nothing to scroll
   to reach it. The page itself showed no sideways scrollbar, so the only
   symptom was a sign-in link a volunteer could not tap on their phone.
   Two rules fix it and both are load-bearing: the row wraps, so the pills drop
   onto their own line; and each pill is nowrap, so the arrow cannot be left
   behind on a line of its own — which is what it did at 1000px before. */

const barMatch = FOOTER.match(/<div style="max-width:1200px;margin:40px auto 0;padding-top:24px[^"]*"/);
check('the footer bottom bar was found', !!barMatch);
check('the bar wraps rather than clipping its last child',
  !!barMatch && /flex-wrap:\s*wrap/.test(barMatch[0]), barMatch && barMatch[0].slice(0, 120));
check('the organiser pill will not break before its arrow', /white-space:\s*nowrap/.test(orgTag));
check('the manager pill will not break before its arrow', /white-space:\s*nowrap/.test(mgrTag));

summary('test-back-office-links.js');
