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
check('the nav is still a direct child', /class="hdr-nav"/.test(kids[2] || ''));

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
   of room for the partner mark long before that: measured in headless Chromium
   with the real Anton and Barlow faces, the bar holds one line down to 850px
   without the mark and only to 950px with it. Anyone "tidying" this rule into
   the 760 block below would put a second line back into a STICKY header
   between 850 and 950 — and would see nothing wrong on their own 1440px
   screen. */
const hideRule = PAGE.match(/@media\(max-width:(\d+)px\)\{\s*\.hdr-partner\{([^}]*)\}\s*\}/);
check('the partner mark has its own hide rule', !!hideRule);
eq('it hides at 1000px, not at the 760px nav breakpoint', hideRule && hideRule[1], '1000');
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

summary('test-sponsors.js');
