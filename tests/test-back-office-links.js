/* tests/test-back-office-links.js
   ------------------------------------------------------------------------
   Where the two back-office sign-ins live on the public homepage, and what
   they are called.

   HISTORY, because this file has now enforced two different answers:

   2 Aug 2026 — five links to two destinations under four names were cut to
   two footer pills named "Quins Organizer" and "Quins Age Group Manager",
   and the top nav carried no back-office links at all.

   3 Aug 2026 (Jay): the footer-only rule made volunteers scroll the entire
   page to sign in. The top of the page now ALSO offers both sign-ins, but
   without spending nav-bar space on them:

     desktop  a "Menu" DROPDOWN at the right of the header — every section
              link plus both sign-ins, functional hrefs to /organizer and
              /manager, not jumps to the footer
     phone    the collapsed hamburger panel carries the same two sign-ins
              (they are display:none in the nav until the panel's own
              a{display:block!important} rule un-hides them)
     footer   unchanged — one pill each, the agreed names

   So: the VISIBLE desktop nav bar is still seven public links, the 2 Aug
   naming still holds everywhere, and the only /organizer + /manager hrefs
   above the footer are the header's own (nav panel + dropdown, one each).

   Structural, not visual: this reads the page as text. It can tell you the
   links are where they should be and named what they should be named; it
   cannot tell you they look right. */

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Line endings normalised — git checks this file out as CRLF on Windows and
   the anchors below are written with \n. See test-sponsors.js for the version
   of this that silently passed by looking at nothing at all. */
const PAGE = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');

function stripComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ''); }

/* The regions this file cares about, sliced by their own markers. There is
   exactly one <nav>, one hdr-menu and one <footer> in the page — asserted,
   because if a second ever appears these slices quietly start describing the
   wrong part of the document. */
eq('there is exactly one nav element', (PAGE.match(/<nav[\s>]/g) || []).length, 1);
eq('there is exactly one footer element', (PAGE.match(/<footer[\s>]/g) || []).length, 1);
eq('there is exactly one header Menu dropdown', (PAGE.match(/class="hdr-menu"/g) || []).length, 1);

const navStart = PAGE.indexOf('<nav class="hdr-nav"');
const NAV = stripComments(PAGE.slice(navStart, PAGE.indexOf('</nav>', navStart)));
const menuStart = PAGE.indexOf('<div class="hdr-menu"');
/* The dropdown is the last thing inside .hdr-right; slicing to </header>
   keeps this anchor-free without depending on internal div nesting. */
const MENU = stripComments(PAGE.slice(menuStart, PAGE.indexOf('</header>', menuStart)));
const footStart = PAGE.indexOf('<footer');
const FOOTER = stripComments(PAGE.slice(footStart, PAGE.indexOf('</footer>', footStart)));
const BODY_ABOVE_FOOTER = stripComments(PAGE.slice(0, footStart));
const headerEnd = PAGE.indexOf('</header>');
const BETWEEN_HEADER_AND_FOOTER = stripComments(PAGE.slice(headerEnd, footStart));

/* =========================================================================
   1. The visible desktop nav bar is still the seven public links
   ========================================================================= */

section('The desktop nav bar still spends its space on the public links');

/* ⚠️ THE PUBLIC LINKS FIRST. Deleting or reordering anchors is one bad
   selection away from losing one, and a check that only counted would pass
   on the wrong seven — this repo's own headline lesson (CLAUDE.md:
   "asserting the absence of things is not a test"). */
const PUBLIC_NAV = [
  ['About', '#about'], ['Format', '#format'], ['Fixtures', '#schedule'],
  ['Results', '#results'], ['Venue', '#venue'], ['App', '/app'],
  ['Sponsors', '#sponsors'],
];
PUBLIC_NAV.forEach(([label, href]) => {
  check(`the nav still has ${label} -> ${href}`,
    NAV.includes(`href="${href}"`) && NAV.includes(`>${label}<`));
});

/* The nav now holds nine anchors — but the two sign-ins are display:none
   inline, so the BAR a desktop visitor sees is unchanged. The phone panel's
   a{display:block!important} rule (asserted in section 3) is what un-hides
   them, and only there. */
eq('the nav has exactly nine links', (NAV.match(/<a\s/g) || []).length, 9);

const navOrgTag = (NAV.match(/<a href="\/organizer"[^>]*>[^<]*<\/a>/) || [''])[0];
const navMgrTag = (NAV.match(/<a href="\/manager"[^>]*>[^<]*<\/a>/) || [''])[0];
check('the nav sign-in links exist, one per destination',
  (NAV.match(/href="\/organizer"/g) || []).length === 1
  && (NAV.match(/href="\/manager"/g) || []).length === 1);
check('both are hidden from the desktop bar (display:none inline)',
  /style="display:none/.test(navOrgTag) && /style="display:none/.test(navMgrTag),
  navOrgTag.slice(0, 80));
check('the nav organiser link keeps the agreed name', /Quins Organizer/.test(navOrgTag));
check('the nav manager link keeps the agreed name', /Quins Age Group Manager/.test(navMgrTag));
/* The raw filename is the form the organiser link used to take everywhere.
   The rewrite in netlify.toml is what makes the clean URL work — asserted in
   section 4 — so no raw form may reappear anywhere in the page. */
check('no raw Organizer.dc.html link anywhere on the page', !/href="Organizer\.dc\.html"/.test(stripComments(PAGE)));

/* =========================================================================
   2. The Menu dropdown: every section, plus BOTH sign-ins, functional
   ========================================================================= */

section('The header Menu dropdown carries the sections and both sign-ins');

check('the dropdown is gated on menuOpen, so it is a dropdown and not a permanent panel',
  /\{\{ menuOpen \}\}/.test(MENU));
check('its button toggles it', /\{\{ toggleMenu \}\}/.test(MENU));
check('…and reports its state for assistive tech', /aria-expanded="\{\{ menuOpenAttr \}\}"/.test(MENU));

PUBLIC_NAV.forEach(([label, href]) => {
  check(`the dropdown offers ${label} -> ${href}`, MENU.includes(`href="${href}"`));
});

/* ⚠️ FUNCTIONAL, NOT A JUMP. Jay's words: "functional, not just jump to
   bottom". The sign-ins must be real hrefs to the back-office routes — an
   anchor like #footer or a scroll handler would satisfy a lazier check. */
const menuOrgTag = (MENU.match(/<a href="\/organizer"[^>]*>[^<]*<\/a>/) || [''])[0];
const menuMgrTag = (MENU.match(/<a href="\/manager"[^>]*>[^<]*<\/a>/) || [''])[0];
check('the dropdown links straight to /organizer', !!menuOrgTag);
check('the dropdown links straight to /manager', !!menuMgrTag);
check('the organiser entry keeps the agreed name', /Quins Organizer/.test(menuOrgTag), menuOrgTag);
check('the manager entry keeps the agreed name', /Quins Age Group Manager/.test(menuMgrTag), menuMgrTag);
check('the sign-ins sit under their own SIGN IN heading, separated from the sections',
  /SIGN IN/.test(MENU) && MENU.indexOf('SIGN IN') < MENU.indexOf('href="/organizer"'));

/* =========================================================================
   3. The phone panel gets the same two sign-ins; the dropdown stays desktop
   ========================================================================= */

section('On a phone the hamburger panel carries the sign-ins and the dropdown is hidden');

/* The nav sign-ins are display:none inline. This rule — which already stacks
   every panel link — is the ONLY thing that un-hides them, and !important is
   load-bearing: an inline style wins otherwise (same trap as style-hover,
   see CLAUDE.md). */
check('the open panel forces every nav link visible, sign-ins included',
  /\.hdr-row\[data-nav-open="true"\] \.hdr-nav a\{[^}]*display:block!important/.test(PAGE));
check('the Menu dropdown is hidden at phone width', /\.hdr-menu\{display:none!important\}/.test(PAGE));
/* The nav moved inside .hdr-right when the dropdown arrived. Without this
   rule the open panel is measured against a shrink-wrapped flex item and
   renders as a narrow column instead of a full-width panel. */
check('the open panel forces the hdr-right wrapper full width',
  /\.hdr-row\[data-nav-open="true"\] \.hdr-right\{width:100%!important\}/.test(PAGE));

/* =========================================================================
   4. The footer: unchanged from the 2 Aug agreement
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

check('netlify.toml still rewrites /organizer, so the clean URL resolves',
  /from\s*=\s*"\/organizer"/.test(readRepo('netlify.toml')));

/* =========================================================================
   5. And nowhere else
   ========================================================================= */

section('The header and footer are the ONLY places that link to the back office');

/* The header legitimately holds two of each (nav panel + dropdown). Anything
   more above the footer is a stray — the 2 Aug cleanup exists because these
   links breed names when nobody is counting. */
eq('exactly two /organizer links above the footer, both in the header',
  (BODY_ABOVE_FOOTER.match(/href="\/organizer"/g) || []).length, 2);
eq('exactly two /manager links above the footer, both in the header',
  (BODY_ABOVE_FOOTER.match(/href="\/manager"/g) || []).length, 2);
check('none of them sit between the header and the footer',
  !/href="\/organizer"/.test(BETWEEN_HEADER_AND_FOOTER)
  && !/href="\/manager"/.test(BETWEEN_HEADER_AND_FOOTER));

/* =========================================================================
   6. The longer names have to still fit on a phone
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
