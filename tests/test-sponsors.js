/* tests/test-sponsors.js
   ------------------------------------------------------------------------
   HSBC — the tournament's one confirmed partner — and the three places the
   mark appears on the homepage: the sticky header, the band under the hero,
   and the sponsors section.

   TWO THINGS HERE ARE NOT COSMETIC, AND THEY ARE WHY THIS FILE EXISTS.

   1. NINETEEN COMPANY NAMES WERE SITTING IN THIS PAGE AS IF THEY HAD SIGNED.
      `sponsorNames` listed Transguard Group, MODON, Kibsons, Crompton
      Partners and fifteen others, and `renderVals()` returned the list
      doubled as `sponsors:` for a marquee. Nothing rendered it — the markup
      that consumed it had already been replaced by the "coming soon"
      placeholder — so it was invisible on the site and fully visible in a
      PUBLIC GitHub repo. Jay confirmed on 1 Aug 2026 that none of them are
      confirmed sponsors. Naming a company as a sponsor before they have
      agreed is a commercial problem, not a code-tidiness one, so the names
      are asserted ABSENT by name here rather than just deleted and forgotten.

   2. THE MARK MUST BE THE WHITE (REVERSE) LOCKUP ON EVERY DARK PLACEMENT.
      Two assets ship: `assets/sponsor-hsbc-white.webp` (white wordmark, used)
      and `assets/sponsor-hsbc.webp` (black wordmark, kept only as the master
      for any future light-background use). All three placements are on
      #0C0C0E. Swap the black one in and the wordmark disappears into the
      page — a failure that looks like a broken image but reports no error
      anywhere, exactly the shape of the crest reference that once killed
      every social share preview (see CLAUDE.md, Brand).

   Structural, not visual: this reads the page as text. It cannot tell you the
   band looks right, only that it is where it is meant to be, referencing what
   it is meant to reference. */

const fs = require('fs');
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* Line endings normalised. git checks these out as CRLF on Windows, and every
   multi-line anchor below is written with \n — on jay-pc the un-normalised
   version found nothing, the block came back empty, and the checks inside it
   passed by looking at nothing at all. */
const PAGE = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');

const WHITE = 'assets/sponsor-hsbc-white.webp';
const BLACK = 'assets/sponsor-hsbc.webp';

/* ---- helpers -------------------------------------------------------------

   A tiny tag walker. There is no HTML parser in this repo and adding one would
   mean node_modules, which the whole test suite exists without — a test that
   needs `npm install` first is a test that eventually stops being run
   (CLAUDE.md, Accounts and passwords). */

const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'col']);

function stripComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ''); }

/* The inner HTML of the element whose opening tag starts at `open`, found by
   counting tags rather than by matching a closing tag with a regex — the
   header nests four divs deep and a lazy regex stops at the first </div>. */
function innerOf(html, open) {
  const gt = html.indexOf('>', open);
  if (gt < 0) return '';
  let depth = 1;
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  re.lastIndex = gt + 1;
  let m;
  while ((m = re.exec(html))) {
    const [, slash, name, attrs] = m;
    if (VOID_TAGS.has(name.toLowerCase()) || attrs.trimEnd().endsWith('/')) continue;
    depth += slash ? -1 : 1;
    if (depth === 0) return html.slice(gt + 1, m.index);
  }
  return '';
}

/* The opening tags of the direct children of a chunk of inner HTML. */
function directChildTags(inner) {
  const out = [];
  let depth = 0;
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(inner))) {
    const [full, slash, name, attrs] = m;
    const selfClosing = VOID_TAGS.has(name.toLowerCase()) || attrs.trimEnd().endsWith('/');
    if (selfClosing) { if (depth === 0) out.push(full); continue; }
    if (!slash) { if (depth === 0) out.push(full); depth++; }
    else depth--;
  }
  return out;
}

/* =========================================================================
   1. The nineteen unconfirmed names, and the machinery that carried them
   ========================================================================= */

section('The unconfirmed sponsor names are gone');

/* Written out in full deliberately. A check for the identifier `sponsorNames`
   alone would pass the moment somebody re-added the same list under a
   different name, which is the mistake this is guarding against — the names
   are the problem, not the variable. */
const UNCONFIRMED = [
  'Craft by Side Hustle', 'Pizza di Rocco', "Gino's Deli", 'Transguard Group',
  "McCafferty's", 'MODON', 'Smile Rite Dental Care', 'Stanford Medical Center',
  'BEOND', 'Kibsons International', 'Sedbergh School', "The Sportsman's Arms",
  'BestBites', 'Crompton Partners', 'The Club', 'Arabian Swim Academy',
  'RECOVER', 'Broadway Malyan', 'JOOS MENA Cycles',
];

UNCONFIRMED.forEach((name) => {
  check(`the homepage does not name "${name}" as a sponsor`, !PAGE.includes(name));
});

check('the sponsorNames list is gone', !PAGE.includes('sponsorNames'));
check('renderVals no longer returns a sponsors list', !/\bsponsors\s*:/.test(PAGE));
/* The marquee animation existed only to scroll that list. Left behind it is a
   keyframe nothing uses, and the next person to find it has a ready-made place
   to put a new list of names back. */
check('the marquee keyframes are gone', !PAGE.includes('marquee'));

/* =========================================================================
   2. The assets
   ========================================================================= */

section('The two HSBC assets');

/* The prover (`_prove-registration.js`) copies only the files the suites READ
   into its temp folder — no assets/ — so these two checks cannot run there.
   Skipping is correct: a text fault injected into a .dc.html cannot make an
   image file appear or vanish, so nothing is lost. Reaching for the file
   unconditionally would throw and take every check below it with it, which is
   the failure this suite already learned about once. */
const hasAssets = fs.existsSync(path.join(repoRoot(), 'assets'));
if (hasAssets) {
  check('the white (reverse) lockup exists on disk', fs.existsSync(path.join(repoRoot(), WHITE)));
  check('the black-wordmark master is kept', fs.existsSync(path.join(repoRoot(), BLACK)));
} else {
  console.log('   (assets/ not present — asset-on-disk checks skipped)');
}

section('Every placement uses the white lockup');

const imgTags = PAGE.match(/<img[^>]*sponsor-hsbc[^>]*>/g) || [];
eq('three HSBC images on the page', imgTags.length, 3);
imgTags.forEach((tag, i) => {
  check(`HSBC image ${i + 1} uses the white lockup, not the black one`, tag.includes(WHITE));
  /* Every one of these sits on #0C0C0E. If a light-background placement is
     ever added this check has to be narrowed to the dark ones — but it must
     not simply be deleted. */
  check(`HSBC image ${i + 1} has an alt attribute`, /alt="HSBC"/.test(tag));
});

/* The master is shipped but must not be REFERENCED, or the wordmark vanishes
   into the page wherever it is used. `\bassets/sponsor-hsbc.webp` would also
   match the white file's path, so the check is on the exact quoted src. */
check('nothing references the black-wordmark master', !PAGE.includes('"' + BLACK + '"'));

/* =========================================================================
   3. The header
   ========================================================================= */

section('The header mark');

const rowOpen = PAGE.indexOf('<div class="hdr-row"');
check('the header row is still there', rowOpen >= 0);
const rowInner = stripComments(innerOf(PAGE, rowOpen));

check('the header carries a partner mark', rowInner.includes('class="hdr-partner"'));

/* THE POINT OF THE WRAPPER. The row is `justify-content:space-between`, which
   distributes its DIRECT children across the full width. Before this change it
   had three: the crest link, the mobile menu button and the nav. Adding the
   partner mark as a fourth would have spread it into the middle of the bar,
   where it reads as a nav item rather than as a partner. Wrapping the crest
   link and the mark together in one flex child keeps the count at three, so
   the nav still sits hard right and the mark sits beside the crest. */
const kids = directChildTags(rowInner);
eq('the header row still has exactly three direct children', kids.length, 3);
check('the first child is a wrapper div, not the crest link itself',
  /^<div/.test(kids[0] || '') && !/href="#top"/.test(kids[0] || ''));
check('the crest link and the partner mark share that wrapper',
  (kids[0] || '').startsWith('<div')
  && innerOf(rowInner, rowInner.indexOf(kids[0])).includes('href="#top"')
  && innerOf(rowInner, rowInner.indexOf(kids[0])).includes('class="hdr-partner"'));
check('the menu button is still a direct child', /class="hdr-toggle"/.test(kids[1] || ''));
/* Aug 2026: the nav gained a sibling — the Menu dropdown — and the two share
   the .hdr-right wrapper, keeping the row's direct-child count at three so
   space-between still pins the pair hard right rather than spreading four
   children across the bar. */
check('the third child is the hdr-right wrapper', /class="hdr-right"/.test(kids[2] || ''));
const rightInner = innerOf(rowInner, rowInner.indexOf(kids[2]));
check('…holding the nav', rightInner.includes('class="hdr-nav"'));
check('…and the Menu dropdown beside it', rightInner.includes('class="hdr-menu"'));

/* NOT A LINK, DELIBERATELY. The header is sticky, so a tap target that leaves
   the site would follow a visitor down every page — including a parent part
   way through the registration form, who would lose what they had typed. */
const partnerOpen = PAGE.indexOf('class="hdr-partner"');
const partnerInner = stripComments(innerOf(PAGE, PAGE.lastIndexOf('<', partnerOpen)));
check('the header mark is not a link', !/<a[\s>]/.test(partnerInner));
check('the header mark has a divider rule before it', partnerInner.includes('rgba(255,255,255,0.18)'));

section('The header mark is hidden on a narrow screen');

/* THE BREAKPOINT IS 1000, NOT 760, AND THAT IS THE WHOLE POINT OF THIS CHECK.
   760 is where the nav collapses behind the menu button. The header runs out
   of room for the partner mark before that: measured in headless Chromium with
   the real Anton and Barlow faces, the bar holds one line with the mark down
   to 800px and wraps below it. Anyone "tidying" this rule into the 760 block
   below would put a second line back into a STICKY header — and would see
   nothing wrong on their own 1440px screen.

   THE NUMBER MOVES WHEN THE NAV DOES. It was 1000 while the nav carried nine
   links; taking the two back-office links out on 2 Aug freed about 150px and
   it came down to 800. Re-measure, do not guess, if a nav link is added. */
const hideRule = PAGE.match(/@media\(max-width:(\d+)px\)\{\s*\.hdr-partner\{([^}]*)\}\s*\}/);
check('the partner mark has its own hide rule', !!hideRule);
eq('it hides at 800px, not at the 760px nav breakpoint', hideRule && hideRule[1], '800');
check('the rule hides it', !!hideRule && /display:\s*none/.test(hideRule[2]));
/* !important is load-bearing: the span is styled inline (`display:flex`) and
   inline wins over a stylesheet rule without it. Same trap as style-hover,
   recorded in CLAUDE.md — and one that fails silently, because the rule is
   there, it is in the right block, and it simply does nothing. */
check('the hide carries !important', !!hideRule && /display:\s*none\s*!important/.test(hideRule[2]));

/* And it must NOT also be hidden by the 760 block — not because that would
   break anything, but because two rules doing one job is how one of them ends
   up edited alone. */
/* The `\{\n` is not decoration. There are single-line `@media(max-width:760px)`
   rules earlier in the stylesheet, and without it the lazy match starting at
   one of THOSE ran on to the first `\n  }` in the file — swallowing everything
   in between, including this rule, and reporting a duplicate that does not
   exist. Requiring the brace to be followed by a newline anchors it to the one
   multi-line block. */
const MQ_RE = /@media\(max-width:760px\)\{\n([\s\S]*?)\n  \}/g;
let mq760 = '';
let mqm;
while ((mqm = MQ_RE.exec(PAGE))) { if (mqm[1].includes('.hdr-toggle')) { mq760 = mqm[1]; break; } }
check('the 760px header block is still there', mq760.length > 0);
check('the 760px block does not repeat the hide', !mq760.includes('.hdr-partner'));

/* =========================================================================
   4. The partner band
   ========================================================================= */

section('The partner band under the hero');

const bandAt = PAGE.indexOf('<section id="partner"');
const statsAt = PAGE.indexOf('<section id="stats"');
const heroAt = PAGE.indexOf('id="top"', PAGE.indexOf('<section'));

check('the partner band exists', bandAt >= 0);
check('the stat strip is still there', statsAt >= 0);
/* ORDER IS THE DESIGN. Above the stat strip the band is the first thing after
   the fold and reads as the tournament's partner; below it, it is one more row
   on a long page. */
check('the band sits ABOVE the stat strip', bandAt >= 0 && statsAt >= 0 && bandAt < statsAt);
check('the band sits below the hero', heroAt >= 0 && bandAt > heroAt);

const bandInner = bandAt >= 0 ? stripComments(innerOf(PAGE, bandAt)) : '';
check('the band says "In partnership with"', /In partnership with/i.test(bandInner));
check('the band shows the white lockup', bandInner.includes(WHITE));
/* max-width:100% or a narrow phone crops the logo rather than shrinking it. */
check('the band logo is bounded on a narrow screen', /max-width:100%/.test(bandInner));

/* =========================================================================
   5. The sponsors section
   ========================================================================= */

section('The sponsors section');

const sponsorsAt = PAGE.indexOf('<section id="sponsors"');
check('the sponsors section is still there', sponsorsAt >= 0);
const sponsorsInner = sponsorsAt >= 0 ? stripComments(innerOf(PAGE, sponsorsAt)) : '';

check('HSBC appears in the sponsors section', sponsorsInner.includes(WHITE));
check('HSBC is named as the principal partner', /Principal partner/i.test(sponsorsInner));
/* The placeholder said the line-up was "Coming soon". There is now a confirmed
   partner on the page, so that badge would be contradicting the logo above it. */
check('the "coming soon" placeholder badge is gone', !/Coming soon/i.test(sponsorsInner));
/* THE INVITATION STAYS. It is the only route by which another sponsor reaches
   Jay, and the section is the page a prospective one lands on. */
check('the get-in-touch invitation is kept', sponsorsInner.includes('mailto:admin@adhjrt.com'));
check('the invitation still says more are to come', /More partners will be announced/i.test(sponsorsInner));

/* =========================================================================
   6. The page does not undersell itself
   ========================================================================= */

/* =========================================================================
   5b. The other two surfaces — /app and /scores
   ========================================================================= */

section('The match-day app carries the partner too');

/* The homepage is not where people spend the weekend. /app is the phone screen
   at the side of a pitch, open for two days. HSBC appearing only on the
   marketing page would have been the placement nobody looked at. */
const APP = readRepo('app.html').replace(/\r\n/g, '\n');

const appImgs = APP.match(/<img[^>]*sponsor-hsbc[^>]*>/g) || [];
eq('two HSBC images in the app — header and More tab', appImgs.length, 2);
appImgs.forEach((tag, i) => {
  check(`app HSBC image ${i + 1} uses the white lockup`, tag.includes('/' + WHITE), tag);
  check(`app HSBC image ${i + 1} has an alt attribute`, /alt="HSBC"/.test(tag));
});

/* NOT A LINK, same reasoning as the website header only more so: this bar is
   FIXED, on screen on every tab, and sits a thumb's width from the crest that
   goes Home. A mis-tap that leaves the app mid-tournament is a real cost. */
const appHdrStart = APP.indexOf('<span class="hdr-partner">');
check('the app header carries the mark', appHdrStart >= 0);
const appHdr = appHdrStart >= 0 ? APP.slice(appHdrStart, APP.indexOf('</span>\n      <div class="who">', appHdrStart)) : '';
check('the app header mark is not a link', !/<a[\s>]/.test(appHdr));
check('the app header mark has a divider rule', /class="rule"/.test(appHdr));

/* ⚠️ MEASURED. The bar holds one line at every width down to 300px without the
   mark and only to about 342px with it — below that it wraps, and a wrapped
   FIXED header costs screen on the device with the least of it. 359 keeps the
   mark on every mainstream phone (360, 375, 390, 412, 430) and drops it on the
   handful narrower than that, which still get the More tab block. */
const appHide = APP.match(/@media\(max-width:(\d+)px\)\{\s*\.hdr-partner\{([^}]*)\}\s*\}/);
check('the app mark has its own hide rule', !!appHide);
eq('it hides below 360px', appHide && appHide[1], '359');
check('the rule hides it', !!appHide && /display:\s*none/.test(appHide[2]));

/* ⚠️ ASSERTED AS A BLOCK, NOT AS A STRING, and that is not fussiness — the
   first version of this check just looked for the words "Principal partner"
   anywhere in the file, and a fault that deleted the section HEADING sailed
   past it: the image count was still 2 (the logo lives in the card below the
   heading, not in it) and the phrase survived in lowercase inside the
   paragraph. A heading with no logo, or a logo with no heading, is broken;
   this requires the pair, in order, close together. */
const moreAt = APP.indexOf('<div class="sec-t">Principal partner</div>');
check('the More tab has a Principal partner heading', moreAt >= 0);
check('an HSBC logo follows it, in the same block',
  moreAt >= 0 && APP.slice(moreAt, moreAt + 400).includes('sponsor-hsbc-white.webp'));
/* The app's copy has to agree with the website's — the same claim in two
   places under two different numbers is the "hundreds vs thousands" mistake
   again, one surface across. */
check('the app does not claim "hundreds of" players', !/hundreds of (young players|players|kids)/i.test(APP));

section('The scores page carries it in the header, and only when standalone');

const SCORES = readRepo('Scores & Standings.dc.html').replace(/\r\n/g, '\n');

const scImgs = SCORES.match(/<img[^>]*sponsor-hsbc[^>]*>/g) || [];
eq('one HSBC image on the scores page', scImgs.length, 1);
check('it uses the white lockup', (scImgs[0] || '').includes(WHITE));
check('it has an alt attribute', /alt="HSBC"/.test(scImgs[0] || ''));

/* ⚠️ IN THE HEADER, INSIDE THE BRAND GROUP. It started as a band above the
   age-group pills; Jay moved it beside "ADH JRT · LIVE" on 2 Aug, matching
   the website header. Two together were redundant — a band 150px below a
   header carrying the same logo reads as a mistake rather than as prominence.

   It must sit INSIDE the brand group, not as a third child of the header row:
   that row is space-between, so a third child gets spread into the middle of
   the bar where it reads as a control. Same trap as the homepage header, and
   the check is the same shape — the logo has to appear between the
   "ADH JRT · LIVE" wording and the end of the group that contains it. */
check('the ADH JRT · LIVE wording is still there', SCORES.includes('>ADH JRT · LIVE<'));

/* ⚠️ THE FIRST VERSION OF THIS CHECK WAS TOO WEAK AND ONLY THE FAULT FOUND IT.
   It asked whether the logo appeared between the "ADH JRT · LIVE" text and the
   Standings/Manager toggle — which is still true when the logo is moved OUT of
   the brand group and becomes a third child of the header row, i.e. exactly
   the mistake being guarded against. Position in the file is not containment.
   This walks the brand group's tags and asks whether the logo is inside it. */
const groupOpen = SCORES.indexOf('<div style="display:flex;align-items:center;gap:14px">');
check('the header brand group was found', groupOpen >= 0);
const groupInner = groupOpen >= 0 ? innerOf(SCORES, groupOpen) : '';
check('the ADH JRT · LIVE wording is inside it', groupInner.includes('>ADH JRT · LIVE<'));
check('the logo is inside it too, not a third child of the header row',
  groupInner.includes('sponsor-hsbc-white.webp'));

/* Not a link, for the same reason as the site header: this bar is the page's
   own navigation and a tap target leaving the site does not belong in it. */
const scMarkAt = SCORES.indexOf('sponsor-hsbc-white.webp');
const scPartner = scMarkAt >= 0 ? SCORES.slice(SCORES.lastIndexOf('<span style="display:flex;align-items:center;gap:14px;flex:none">', scMarkAt), scMarkAt + 200) : '';
check('the scores header mark is not a link', scPartner.length > 0 && !/<a[\s>]/.test(scPartner));
check('it has a divider rule before it', /rgba\(255,255,255,0\.18\)/.test(scPartner));

/* And the old band is gone, not merely hidden. */
check('the band above the age-group pills is gone',
  !/In partnership with/i.test(SCORES));

/* ⚠️⚠️ IT SHOWS IN BOTH PLACES, AND THAT IS THE CORRECTION, NOT AN OVERSIGHT.
   This component renders twice: on the standalone /scores page, and inside the
   homepage's Results & Standings section, which imports the whole thing. The
   first version gated the mark off in the embedded case, reasoning that the
   homepage already showed the logo. That reasoning was wrong twice over — the
   site header is most of a page above Results, so nothing is duplicated on
   screen at one moment, and the homepage's Results section is the exact place
   Jay had asked for it. The gate removed it from the one place it was wanted.

   So: no `showPartner`, no `embedded` attribute, and both asserted ABSENT. A
   check that only asserted the mark exists would pass with the gate quietly
   reinstated, because the markup would still be there — it just would not
   render on the homepage, which is not something a text check can see. */
check('the mark is NOT behind a showPartner gate', !/showPartner/.test(SCORES));
check('the scores component takes no `embedded` prop', !/this\.props\.embedded/.test(SCORES));
check('the homepage dc-import does not suppress it',
  !/<dc-import name="Scores & Standings"[^>]*\sembedded=/.test(PAGE));

section('How many players the page claims');

/* THE PAGE CONTRADICTED ITS OWN HEADLINE NUMBER. The stat strip has said
   3000+ PLAYERS since it was written, while the hero lede, the organisers
   paragraph and (as first drafted) the HSBC paragraph all said "hundreds".
   Jay caught it on 2 Aug: it is thousands. Three separate sentences said the
   same wrong thing, which is how a copy fact drifts — nobody edits all the
   copies, because nobody knows how many copies there are.

   This asserts the invariant rather than the three sentences: the page must
   not describe its own turnout in hundreds while advertising 3000+. Anyone
   adding a fourth sentence in the same shape fails here. */

const HUNDREDS = /hundreds of (young players|players|kids|children)/i;
check('no visible copy claims "hundreds of" players or kids', !HUNDREDS.test(PAGE),
  (PAGE.match(HUNDREDS) || [''])[0]);

/* And the number it is being measured against is still what it was. If the
   stat strip is ever changed to a genuinely smaller figure, this check is the
   thing that says the wording has to move with it. */
check('the stat strip still advertises 3000+ players', /statPlayers:\s*Math\.round\(3000 \* sp\)/.test(PAGE));

summary('test-sponsors.js');
