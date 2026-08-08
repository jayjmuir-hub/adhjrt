/* tests/test-sponsors.js
   ------------------------------------------------------------------------
   HSBC — the tournament's one confirmed partner — and the THREE places the
   mark appears on the homepage: the sticky header (19px), the hero lockup
   beside the Register buttons (128px, added 3 Aug 2026), and the sponsors
   section (64px).

   ⚠️ IT WAS FOUR FOR ABOUT AN HOUR. A `<section id="partner">` band sat
   between the hero and the stat strip carrying a 54px lockup; Jay removed it
   on 3 Aug 2026 in the same breath as doubling the hero one to 128px, because
   the two said the same thing a few hundred pixels apart. The band's ABSENCE
   is asserted below — it is not enough for it to be gone, it has to stay
   gone, and the argument that put it there is on file and will be made again.

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
      for any future light-background use). All four placements are on
      #0C0C0E — and the hero one is pinned there on purpose: the "Sign up now"
      section's background is OUR red, where the lockup's red hexagon would
      vanish. Swap the black one in and the wordmark disappears into the
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
/* ⚠️ THIS LIST SHRANK ON 4 AUG 2026, BY HAND, IN THE SAME COMMIT THAT PUT THE
   REAL SPONSORS UP. Nine of the original nineteen came back as CONFIRMED
   2026/27 sponsors and moved out of this list into SPONSORS on the page:
   McCafferty's, BEOND, Sedbergh School, The Sportsman's Arms, Crompton
   Partners, Arabian Swim Academy, RECOVER, Broadway Malyan and JOOS/Yas Mena
   Cycles.

   ⚠️ EDITING THIS LIST IS THE POINT, NOT AN OBSTACLE. Every one of those nine
   failed this file when its name went on the page — which is exactly what it
   is for. The correct response was to check with Jay that they had signed and
   then move the name deliberately, one at a time. It must never be widened,
   emptied, or turned into a substring match to make a build pass.

   What is left is the ten that are STILL not confirmed for 2026/27. */
const UNCONFIRMED = [
  'Craft by Side Hustle', 'Pizza di Rocco', "Gino's Deli", 'Transguard Group',
  'MODON', 'Smile Rite Dental Care', 'Stanford Medical Center',
  'Kibsons International', 'BestBites', 'The Club',
];

UNCONFIRMED.forEach((name) => {
  check(`the homepage does not name "${name}" as a sponsor`, !PAGE.includes(name));
});

check('the sponsorNames list is gone', !PAGE.includes('sponsorNames'));

/* ⚠️ `sponsors:` IS BACK, ON PURPOSE — and this check is the inverse of what it
   was. It used to assert renderVals returned NO sponsors list, because the one
   it had carried nineteen unconfirmed names doubled for a marquee that nothing
   rendered. On 4 Aug 2026 a CONFIRMED list with real logo files replaced it.

   The old check was inverted rather than deleted: what mattered was never the
   identifier, it was that no unconfirmed name reaches the page, and the
   UNCONFIRMED sweep above is what actually enforces that. */
check('renderVals returns the confirmed sponsors list', /\bsponsors:\s*SPONSORS\b/.test(PAGE));
check('…sourced from the SPONSORS constant, not an inline literal',
  /^const SPONSORS = \[/m.test(PAGE));

/* The marquee animation existed only to scroll the old fake list. A keyframe
   nothing uses is a ready-made place to put a list of names back.
   ⚠️ Comments stripped: the SPONSORS block explains the marquee's removal by
   name, and a comment about a marquee is not a marquee. */
check('the marquee keyframes are gone',
  !stripComments(PAGE).replace(/\/\*[\s\S]*?\*\//g, '').includes('marquee'));

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

/* ⚠️ FOUR since 3 Aug 2026, not three — Jay asked for the mark beside the hero
   Register buttons ("the gap area in the hero"). The count is written out on
   purpose: it is what makes a placement appearing or vanishing UNNOTICED
   impossible, and it is why this check had to be changed deliberately in the
   same commit rather than quietly widened to `>= 3`. It has moved twice in one
   day — 3 up to 4 when the hero lockup arrived, and back down to 3 when Jay
   removed the band. Both times by hand, which is the point. The three are the
   sticky header (19px), the hero lockup (128px) and the sponsors section
   (96px, raised from 64 on 5 Aug at Jay's request). */
const imgTags = PAGE.match(/<img[^>]*sponsor-hsbc[^>]*>/g) || [];
/* ⚠️ FOUR since 8 Aug 2026, not three. The fourth is the MOBILE-ONLY hero
   lockup that sits above the date pill; the in-row one is hidden at the same
   breakpoint, so a visitor never sees the mark twice. That pairing is asserted
   below — the count alone would pass on a page showing both at once. */
eq('four HSBC images on the page', imgTags.length, 4);
imgTags.forEach((tag, i) => {
  check(`HSBC image ${i + 1} uses the white lockup, not the black one`, tag.includes(WHITE));
  /* Every one of these sits on #0C0C0E. If a light-background placement is
     ever added this check has to be narrowed to the dark ones — but it must
     not simply be deleted. */
  check(`HSBC image ${i + 1} has an alt attribute`, /alt="HSBC"/.test(tag));
});

/* ⚠️ THE SIZES ARE ASSERTED, NOT JUST THE COUNT. A placement quietly shrinking
   is the same class of failure as one quietly vanishing — the mark is still
   there, so nothing looks broken, and the tournament's only confirmed partner
   is smaller than the day before with nobody the wiser. Written out, so moving
   one is a deliberate edit here in the same commit. The sponsors-section
   lockup went 64 -> 96 on 5 Aug at Jay's request. */
/* ⚠️ .filter() IS LOAD-BEARING, NOT TIDYING. The mobile lockup deliberately
   carries NO pixel height — a pinned height beside max-width is exactly what
   squashed the other two by 25-27% on a real phone. It contributes no number
   here, and the three FIXED placements must still read 19 / 128 / 96. */
const hsbcHeights = imgTags
  .map((t) => (t.match(/height:(\d+)px/) || [])[1])
  .filter(Boolean)
  .map(Number);
check('the HSBC placements are 19px, 128px and 96px',
  JSON.stringify(hsbcHeights) === JSON.stringify([19, 128, 96]), hsbcHeights.join(', '));

/* ⚠️ AND THE MOBILE ONE MUST STAY PROPORTIONAL. This is the check that would
   have caught the original bug: a mark with a pinned height AND max-width
   cannot keep its ratio in a container narrower than its intrinsic width. */
const mobileTag = imgTags.find((t) => /height:auto/.test(t));
check('the mobile hero lockup has no pinned pixel height', !!mobileTag, mobileTag || 'none');
check('the mobile hero lockup is capped by width, not height',
  !!mobileTag && /max-width:\d+px/.test(mobileTag));

/* ⚠️ THE RATIO FIX ITSELF, ASSERTED. This is the rule that stops a pinned
   height fighting max-width. Without it the marks squash by 25-27% on a phone
   and nothing errors — the logo is simply wrong, which for a partner mark is
   the whole problem. Asserted for BOTH placements, because both were bent. */
const FLAT = PAGE.replace(/\s+/g, '');
check('the hero lockup keeps its ratio (height:auto + max-height cap)',
  /\.hero-partnerimg\{height:auto!important;max-height:128px!important\}/.test(FLAT));
check('the sponsors lockup keeps its ratio (height:auto + max-height cap)',
  /a\[href\*="hsbc\.ae"\]img\{height:auto!important;max-height:96px!important\}/.test(FLAT));

/* ⚠️ THE TWO HERO LOCKUPS MUST BE MUTUALLY EXCLUSIVE. Showing both would put
   the partner mark on screen twice, which is worse than the bug this fixed. */
check('the in-row hero lockup is hidden at the mobile breakpoint',
  /\.hero-partner\{display:none!important\}/.test(PAGE.replace(/\s+/g, '')) ||
  /\.hero-partner\s*\{\s*display:\s*none\s*!important\s*\}/.test(PAGE));
check('the mobile-only lockup is shown at that same breakpoint',
  /\.hero-partner-m\{display:flex!important\}/.test(PAGE.replace(/\s+/g, '')));

/* ⚠️ THE HERO PLACEMENT, AND THE REASON IT IS ALLOWED TO BE THERE.
   The hero sits on #0C0C0E, and the reverse lockup's hexagon is HSBC red. The
   "Sign up now" section's background is OUR red (#E11B22, the accentColor
   default), where that hexagon would sit red on red and disappear. So the
   placement is pinned to the hero's button row specifically — a later "move it
   next to the other Register buttons" would be the mistake this asserts
   against. */
{
  const heroRow = PAGE.split('<!-- HSBC beside the call to action')[1] || '';
  const block = heroRow.split('</div>')[0] || '';
  check('the hero lockup sits inside the hero Register button row',
    /onClickRegisterPlayer/.test(PAGE.split('<!-- HSBC beside the call to action')[0].slice(-2000)),
    'anchored on the button it was asked to sit beside');
  check('…and carries the "In partnership with" label', /In partnership with/.test(block));
  check('…and uses the white lockup', block.includes(WHITE));
  /* 128px. It went 46 → 64 → 128 across three of Jay's messages, the last one
     being "make the HSBC in the hero section double in size" — sent together
     with the removal of the band, which is what makes the size defensible:
     this is now the ONLY prominent placement on the page, not one of two.
     The bound is a range rather than an exact number because the point is that
     it is unmistakably a feature rather than a footnote; a shrink back toward
     header size is the regression this catches. */
  const heroH = (block.match(/height:(\d+)px/) || [])[1];
  check('…at the size Jay asked for, not the header\'s 19px', Number(heroH) >= 100 && Number(heroH) <= 160,
    `hero lockup is ${heroH}px`);

  /* ⚠️ At 128px the lockup is ~510px wide — wider than a phone. Without
     max-width:100% a narrow screen CROPS it rather than shrinking it. The band
     that used to carry this rule is gone, so the rule has to live here now. */
  check('…and bounded on a narrow screen, or a phone crops it',
    /max-width:100%/.test(block));

  /* ⚠️ IT IS CENTRED IN THE SPACE LEFT OVER, NOT PUSHED TO THE FAR RIGHT.
     Jay asked for it "more to the right" and then, once it was hard against
     the edge, for "about half way between register player and the side of the
     page". `margin-left:auto` ALONE pins it right; auto on BOTH sides splits
     the free space evenly, which is that halfway point — and it stays halfway
     at any width, where a fixed margin would drift with the button labels and
     stop being halfway the moment a label changed.

     Both are asserted. Losing the right auto is a silent regression back to
     the version Jay rejected, and it is one character. */
  check('…horizontally centred in the space left after the buttons',
    /margin-left:auto/.test(block) && /margin-right:auto/.test(block));

  /* ⚠️ The row it joined had only two children and no wrap rule. A third item
     overflows a phone without one, and an overflowing hero is the first thing
     anybody sees. */
  const rowStart = PAGE.indexOf('<div style="display:flex;gap:16px;margin-top:38px');
  check('the hero button row wraps, now that a third item shares it',
    rowStart >= 0 && PAGE.slice(rowStart, rowStart + 260).includes('flex-wrap:wrap'));

  /* ⚠️ THE DIVIDER ONLY MAKES SENSE ON ONE LINE. Rendered at 390px the row
     wraps and the lockup lands on its own line, where a 1px vertical bar has
     nothing on the other side of it and the 36px of indent leaves the mark out
     of line with the buttons above. The rule that undoes it needs !important
     because the block is styled INLINE — an ordinary rule loses silently, which
     is the same trap already documented for .hdr-partner. */
  check('the hero lockup block is addressable by class, not just inline style',
    /class="hero-partner"/.test(PAGE));
  const dividerRule = (PAGE.match(/\.hero-partner\{[^}]*\}/) || [''])[0];
  check('…and its divider is dropped once the row wraps', /border-left:0/.test(dividerRule));
  check('…along with the indent that goes with it',
    /padding-left:0/.test(dividerRule) && /margin-left:0/.test(dividerRule));
  check('…and the rule carries !important, or the inline style silently wins',
    (dividerRule.match(/!important/g) || []).length === 3);

  /* The red section must NOT grow one. */
  const regSection = PAGE.split('<section id="register"')[1] || '';
  const regBody = regSection.split('</section>')[0] || '';
  check('the RED Sign up now section has no HSBC lockup — the hexagon would vanish',
    !/sponsor-hsbc/.test(regBody));
}

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
   it came down to 800.

   ⚠️ AND ON 3 AUG 2026 IT WENT BACK UP TO 900, BECAUSE 800 WAS WRONG. The
   wordmark was lengthened to "ABU DHABI HARLEQUINS", which forced a
   re-measurement — and the re-measurement found the header was ALREADY
   overflowing the viewport HORIZONTALLY from about 875px down with the mark
   still showing. Proven not to be the new wordmark's doing by measuring the
   old one in the same harness: identical 874px scrollWidth at a 870px
   viewport. A sticky header that scrolls sideways follows a visitor down
   every page. 900 is 875 with margin, and the sweep from 1440px to 360px is
   now clean at every width.

   The earlier measurement checked for WRAPPING and never checked for
   OVERFLOW, so it reported a healthy header that was already broken. That is
   the lesson worth keeping: a measurement answers the question you asked it.

   Re-measure, do not guess, if a nav link is added OR the wordmark changes. */
const hideRule = PAGE.match(/@media\(max-width:(\d+)px\)\{\s*\.hdr-partner\{([^}]*)\}\s*\}/);
check('the partner mark has its own hide rule', !!hideRule);
eq('it hides at 900px, not at the 760px nav breakpoint', hideRule && hideRule[1], '900');
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

section('The partner band under the hero is GONE and stays gone');

/* ⚠️ THIS IS AN ABSENCE CHECK, AND ABSENCE CHECKS ARE THE EASY ONES TO GET
   WRONG. It reads the page with comments STRIPPED, because the tombstone left
   in the markup explains the band at length and mentions `id="partner"` — a
   comment about a band is not a band. That is the same house rule the wordmark
   checks hit an hour earlier.

   Why assert it at all rather than just deleting it: the band's own comment
   argued that HSBC deserved "the first slot after the fold, with nothing else
   competing for the eye", and that argument is still a good one in the
   abstract. Somebody will make it again. The answer now is the 128px hero
   lockup, and the two must not both exist — that was Jay's whole complaint. */
const NO_COMMENTS = stripComments(PAGE);
const bandAt = NO_COMMENTS.indexOf('<section id="partner"');
const statsAt = NO_COMMENTS.indexOf('<section id="stats"');

check('the partner band is gone', bandAt < 0);
check('the stat strip is still there', statsAt >= 0);
/* The 54px lockup was the band's, and nothing else on the page uses that size.
   If it reappears, the band came with it. */
check('no 54px lockup survives anywhere on the page', !/sponsor-hsbc-white\.webp[^>]*height:54px/.test(NO_COMMENTS));
/* One "In partnership with" on the page now, not two. The band had the other,
   and two of them a few hundred pixels apart is what Jay objected to. */
/* ⚠️ TWICE since 8 Aug 2026, and both are hero lockups — one for wide screens,
   one for phones, never both visible. It is NOT back to the old band-plus-hero
   pair the original check was written against: the band is still gone, and
   that is asserted separately. */
check('"In partnership with" appears exactly twice — the two hero lockups',
  (NO_COMMENTS.match(/In partnership with/g) || []).length === 2,
  (NO_COMMENTS.match(/In partnership with/g) || []).length);
/* The tombstone is not decoration: it carries why the band existed, so the
   next person meets the reasoning before re-adding it. */
check('the removal left a tombstone explaining what was there and why it went',
  /PRINCIPAL PARTNER BAND — REMOVED/.test(PAGE));

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

/* =========================================================================
   5b. THE SUPPORTERS GRID (added 4 Aug 2026)
   ========================================================================= */

section('The supporters grid');
{
  /* ⚠️ THE COUNT IS WRITTEN OUT. Same discipline as the HSBC placements: a
     sponsor appearing or vanishing UNNOTICED must be impossible, and adding
     one is meant to be a deliberate edit here as well as on the page. */
  /* ⚠️ Captures ANY extension, not just .webp. The first version required
     `.webp`, so a raw .png dropped in fell OUT of the list entirely and tripped
     the COUNT check instead of the format check — the fault run caught that.
     A pattern that only matches the healthy case cannot report the sick one. */
  const rows = [...PAGE.matchAll(/\{ name: (.+?), *file: '(assets\/sponsor-[a-z0-9-]+\.[a-z]+)', *h: (\d+)(, light: true)?, url: '([^']*)' \}/g)];
  eq('eighteen confirmed supporters', rows.length, 18);

  /* ⚠️ EVERY ROW CARRIES ITS OWN HEIGHT, and the markup must use it as a
     MAXIMUM. The first version rendered every logo at a fixed height:44px with
     max-width:100%, which is wrong twice over —
       (a) height fixed + width clamped SQUASHES a very wide mark. Broadway
           Malyan is 11.5:1; at 44px tall it wants 506px of width, gets ~246,
           and renders distorted rather than smaller. Nothing reports it.
       (b) equal height is not equal presence. The near-square marks (Ashurst,
           The Sportsman's Arms, ~1.1:1) read as postage stamps beside a 5:1
           wordmark, which is exactly the sponsor-relations problem this
           section exists to avoid.
     h normalises optical AREA instead — see claude/specs/spec-sponsors-grid.md.
     The bounds are the tile: 68px is what fits inside 104px with 16px padding,
     26px is the legibility floor on a phone. */
  rows.forEach(([, name, , h]) => {
    const n = Number(h);
    check(`${name.replace(/['"]/g, '')} has a height inside the tile (26-68)`, n >= 26 && n <= 68, h);
  });
  check('the grid binds the per-logo height', /max-height:\{\{ s\.h \}\}px/.test(sponsorsInner));
  check('…as a maximum, never a fixed height that would squash wide marks',
    !/<img[^>]*\{\{ s\.file \}\}[^>]*[^-]height:\d+px/.test(sponsorsInner));
  check('…with object-fit:contain so the aspect ratio survives the clamp',
    /object-fit:contain/.test(sponsorsInner));

  /* ⚠️ DISCRIMINATING, not decorative. Asserting "everything has an h" would
     pass against h:44 on all fourteen — the very bug this replaced. The widest
     mark must end up SMALLER than the squarest one, which is the whole claim. */
  const hOf = (slug) => Number((rows.find((r) => r[2].includes(slug)) || [])[3]);
  /* ⚠️ REPOINTED 5 Aug. Broadway Malyan was the widest mark at 11.5:1 while the
     file was their TAGLINE lockup; the wordmark that replaced it is 5.4:1, so
     the anchor moved to the mark that is actually widest now. The RULE — a very
     wide mark must end up smaller than a mid-pack one — is unchanged, and it is
     the rule the fixed-height bug broke. */
  check('the widest mark (Brighton College, 5.6:1) is sized down',
    hOf('brighton-college') < hOf('oak-view-group'), `${hOf('brighton-college')} vs ${hOf('oak-view-group')}`);
  check('the squarest marks are sized UP, not left as postage stamps',
    hOf('sportsmans-arms') > hOf('brighton-college') && hOf('ashurst') > hOf('brighton-college'),
    `${hOf('sportsmans-arms')}/${hOf('ashurst')} vs ${hOf('brighton-college')}`);

  /* ⚠️ BROADWAY MALYAN'S FILE IS THE WORDMARK, NOT THE TAGLINE. The first one
     they supplied was "Creating places. Together." — theirs, but it does not
     say who they are, so their NAME was nowhere on the page and nobody could
     have told from the grid who the sponsor was. Asserted by shape, which is
     the only thing a source-reading test can see: the tagline lockup was
     11.5:1 and needed h:26; the wordmark is 5.4:1 at h:36. A slide back to the
     tagline file would take the ratio and the height with it. */
  check('Broadway Malyan is sized for the wordmark, not the tagline lockup',
    hOf('broadway-malyan') >= 34, String(hOf('broadway-malyan')));
  check('the heights are not all the same number',
    new Set(rows.map((r) => r[3])).size >= 6);

  /* Every file the list names must EXIST. A typo here is a broken image on the
     live site and nothing anywhere reports it. Skipped in the prover's temp
     copy, which carries no assets/ - the same guard the HSBC asset checks use. */
  if (hasAssets) {
    rows.forEach(([, name, file]) => {
      check(`${name.replace(/['"]/g, '')} has its logo file on disk`,
        fs.existsSync(path.join(repoRoot(), file)));
    });
  }

  /* ⚠️ WHITE-ON-TRANSPARENT, ALL OF THEM. Every supplied file was rendered on
     #0C0C0E before shipping and six single-colour marks were recoloured white
     to get there. WebP is asserted because the conversion is where that
     treatment happened - a .png creeping in means somebody dropped a raw
     download in and skipped it, and a dark logo on this ground vanishes while
     reporting no error at all. That is the HSBC lesson, one section down. */
  rows.forEach(([, name, file]) => {
    check(`${name.replace(/['"]/g, '')} is a processed .webp, not a raw drop-in`,
      file.endsWith('.webp'));
  });

  /* The grid must actually RENDER the list. A list returned and never bound is
     the single most common way this page breaks, and it is invisible to a
     check that only reads the data. */
  check('the grid loops over the sponsors list', /<sc-for list="\{\{ sponsors \}\}"/.test(PAGE));
  check('…and binds both the file and the name', /src="\{\{ s\.file \}\}"/.test(PAGE) && /alt="\{\{ s\.name \}\}"/.test(PAGE));
  check('…with lazy loading, since it is well below the fold', /loading="lazy"/.test(sponsorsInner));

  /* ⚠️ HSBC STAYS ABOVE AND SEPARATE. They are the principal partner; these are
     supporters. Folding the two into one wall is the tidy-up that quietly
     demotes the tournament's only confirmed partner, and it has been warned
     about in CLAUDE.md since 2 Aug. */
  const hsbcAt = sponsorsInner.indexOf('Principal partner');
  const gridAt = sponsorsInner.indexOf('With the support of');
  check('HSBC is still called the principal partner', hsbcAt >= 0);
  check('the supporters grid sits BELOW HSBC, not alongside', gridAt > hsbcAt);
  check('HSBC is not repeated inside the supporters grid',
    !sponsorsInner.slice(gridAt).includes('sponsor-hsbc'));

  /* ⚠️ TWO CONFIRMED SPONSORS ARE DELIBERATELY ABSENT because their artwork
     could not be made legible — Recover (too small at any size) and Crompton
     Partners (what was supplied is a photograph, not a logo). Anderson came off
     this list on 5 Aug when they sent a flat file. They are NOT in the UNCONFIRMED sweep above, because they HAVE
     signed; this asserts they are not half-added either, with a name on the
     page and no file behind it.
     ⚠️ Bili Boys Biltong came OFF this list on 5 Aug — see below. It is the
     one sponsor shipped on artwork this suite would otherwise call unusable,
     and that was a deliberate decision, not a slip. */
  /* ⚠️ THE PENDING LIST IS EMPTY AS OF 5 AUG and the sweep is kept anyway, in
     the only form that still means something: every sponsor on the page has a
     FILE. The old list-of-slugs check emptied itself out as each one arrived,
     and an empty forEach is a check that asserts nothing while looking like
     coverage. This is what it was really guarding. */
  check('no sponsor is named without a file behind it',
    rows.every((r) => r[2] && r[2].startsWith('assets/sponsor-')));

  /* ⚠️ EVERY LOGO LINKS TO ITS SPONSOR, and every URL was checked for a 200
     before it went in. A sponsor's own mark pointing at a dead domain — or at
     whoever bought the name next — is a commercial problem, not a broken link.
     The row pattern REQUIRES the url, so a sponsor added without one falls out
     of the list entirely and trips the count check rather than shipping a tile
     that goes nowhere. */
  rows.forEach(([, name, , , , url]) => {
    const n = name.replace(/['"]/g, '');
    check(`${n} links somewhere`, !!url && url !== '#');
    check(`…over https, not http or a bare path`, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(url), url);
  });
  /* ⚠️ NO TWO SPONSORS SHARE A URL. That is what a copy-paste slip looks like:
     the row is complete, the link works, and it opens the wrong company. */
  check('every sponsor URL is distinct',
    new Set(rows.map((r) => r[5])).size === rows.length);

  /* ⚠️ target="_blank" REQUIRES rel="noopener", and this is a security check,
     not a tidiness one. Without it the opened page gets a live `window.opener`
     handle and can navigate THIS tab anywhere — reverse tabnabbing — and the
     tab it would redirect is the one a parent registers a child in. */
  const anchors = sponsorsInner.match(/<a [^>]*target="_blank"[^>]*>/g) || [];
  check('the supporter logos are links', /<a href="\{\{ s\.url \}\}"/.test(sponsorsInner));
  eq('every new-tab link in the section is accounted for', anchors.length, 2);
  anchors.forEach((a, i) => {
    check(`new-tab link ${i + 1} carries rel="noopener"`, /rel="noopener noreferrer"/.test(a), a);
  });
  check('…and the link is the whole tile, not a logo-sized target',
    /href="\{\{ s\.url \}\}"[\s\S]{0,320}width:100%;height:100%/.test(sponsorsInner));
  check('…and it says it opens in a new tab, for anyone not looking at it',
    /aria-label="\{\{ s\.name \}\} — opens in a new tab"/.test(sponsorsInner));

  /* ⚠️ HSBC's card links; the HEADER and HERO marks deliberately do not. That
     rule is about the STICKY header — a tap target that leaves the site follows
     a visitor down every page, including a parent part way through the
     registration form. Asserted from both ends so neither drifts. */
  check('the HSBC card links to hsbc.ae', /<a href="https:\/\/www\.hsbc\.ae\/"/.test(sponsorsInner));
  /* ⚠️ Sliced to the block's own closing tag, not to a character count. The
     header mark carries a style attribute, so `<span class="hdr-partner">` does
     not match it — the first version of this check looked for that and found
     -1, which is a check reading nothing rather than a check passing. And a
     fixed-length slice would run past the block into markup that legitimately
     contains links. */
  const hdrStart = PAGE.indexOf('class="hdr-partner"');
  const hdrBlock = hdrStart >= 0 ? PAGE.slice(hdrStart, PAGE.indexOf('</span>', PAGE.indexOf('<img', hdrStart))) : '';
  check('the header block was located', hdrBlock.length > 80, String(hdrBlock.length));
  check('the header HSBC mark is still NOT a link', !/<a[\s>]/.test(hdrBlock));

  const heroStart = PAGE.indexOf('class="hero-partner"');
  const heroBlock = heroStart >= 0 ? PAGE.slice(heroStart, PAGE.indexOf('</div>', heroStart)) : '';
  check('the hero block was located', heroBlock.length > 200, String(heroBlock.length));
  check('the hero HSBC lockup is still NOT a link', !/<a[\s>]/.test(heroBlock));

  /* ⚠️ NOTHING IN THIS GRID IS RECOLOURED. Jay's call, 5 Aug: "put them on the
     black background, anything that was changed can just go in a white box."
     Every file is the sponsor's own artwork in their own colours; a mark that
     does not read on `#151517` gets a WHITE BOX rather than being repainted.

     ⚠️ THE SPLIT IS MEASURED, NOT CHOSEN — median WCAG contrast of the ink
     against the tile, white box below 4.5:1. That is why it is nine rather
     than a tidier number, and why the nine are not the nine anyone would have
     guessed. The count is written out because moving a logo from one treatment
     to the other changes how that sponsor is presented, and must not happen
     unnoticed. Re-measure when a file is replaced; never copy the flag from a
     neighbour. */
  const lit = rows.filter((r) => r[4]);
  eq('nine sponsors get a white box', lit.length, 9);

  /* ⚠️ THE TILES ALTERNATE, AND THE ORDER OF THE LIST IS WHAT DOES IT — not an
     :nth-child rule. A positional CSS rule would paint every other tile white
     regardless of what is in it, so one added sponsor would flip nine logos
     onto the wrong ground and erase the three that exist only as white files.
     Asserting the ALTERNATION and the MEASURED flag together is what makes the
     checkerboard safe: the colour still follows the artwork.
     Crompton leads at Jay's request (5 Aug), so the run starts white. */
  check('Crompton leads the list', rows.length > 0 && rows[0][2].includes('crompton-partners'));
  const alternates = rows.every((r, i) => !!r[4] === (i % 2 === 0));
  check('the tiles alternate white, dark, white, dark…', alternates,
    rows.map((r) => (r[4] ? 'W' : 'D')).join(''));

  /* ⚠️ FLEX, NOT GRID. A CSS grid leaves an incomplete final row hanging on the
     left and there is no grid property that centres it; flex-wrap plus
     justify-content:center centres whatever the last row holds, at every width,
     with no count baked in — which matters because the count changes every time
     a sponsor signs. */
  check('the last row is centred rather than left-hanging',
    /display:flex;flex-wrap:wrap;justify-content:center/.test(sponsorsInner)
      && !/grid-template-columns/.test(sponsorsInner));
  const LIGHT = ['brighton-college', 'beond', 'westminster-construction', 'broadway-malyan',
    'bottle-store', 'align-health', 'anderson-education', 'crompton-partners', 'recover'];
  check('…and they are exactly the nine that fail on the dark tile',
    lit.length === LIGHT.length && lit.every((r) => LIGHT.some((n) => r[2].includes(n))),
    lit.map((r) => r[2]).join(', '));
  /* ⚠️ AND THE OTHER NINE ARE ASSERTED TOO, or the check above would pass on a
     grid where every tile had gone white. Three of them CANNOT take a white box
     at any point — Oak View Group, V&P and Yas Mena Cycles exist only as
     white-on-transparent files, so a white tile would erase them outright. */
  ['oak-view-group', 'value-performance', 'yas-cycles'].forEach((slug) => {
    const r = rows.find((row) => row[2].includes(slug));
    check(`${slug} stays on the dark tile — no other version of it exists`, !!r && !r[4]);
  });
  check('the tile colour is DERIVED from that flag, not written into the data',
    /bg:\s*s\.light \? '#ffffff' : '#151517'/.test(PAGE));
  /* ⚠️ SCOPED TO THE LOOP, not to the whole section. The HSBC card above it is
     LEGITIMATELY background:#151517 — a negative check across the section would
     fail on the principal-partner card, which is not what this is about. Prove
     the slice is the slice you meant: this asserts the block is non-empty
     first, or "no hardcoded colour in nothing" passes for ever. */
  const gridStart = sponsorsInner.indexOf('<sc-for list="{{ sponsors }}"');
  const tile = gridStart >= 0
    ? sponsorsInner.slice(gridStart, sponsorsInner.indexOf('</sc-for>', gridStart))
    : '';
  check('the supporters loop was located', tile.length > 100, String(tile.length));
  check('…and the tile binds the colour rather than hardcoding one',
    /background:\{\{ s\.bg \}\}/.test(tile) && !/background:#[0-9a-f]{6}/i.test(tile));
  check('…and its border follows, or white-on-white loses its edge',
    /border:1px solid \{\{ s\.edge \}\}/.test(sponsorsInner));
  /* ⚠️ BILI BOYS IS THE ONE DOCUMENTED EXCEPTION TO BOTH ARTWORK RULES, and
     the exception is pinned so it cannot spread by imitation.
     It is a BADGE — dark type on an opaque cream ground with a printed border
     — so the white-on-transparent treatment every other file gets would mean
     deleting the logo rather than recolouring it. And the only artwork
     supplied is 154x90, well under the house 160px tall, so it is stored at
     NATIVE size: padding it up to 160 would bake a 1.78x stretch into the file
     permanently, where storing it small and rendering it at h:52 costs 1.16x
     on a 2x screen and can be replaced by a better file with no other change.
     h:52 is therefore DELIBERATELY below the 64 the formula gives for its
     1.7:1 ratio. If somebody "corrects" it to 64 they are choosing a blurrier
     logo, so the number is asserted and the reasoning has to stay next to it. */
  const bili = rows.find((r) => r[2].includes('bili-boys'));
  check('Bili Boys is on the page', !!bili);
  /* ⚠️ ON THE DARK TILE, because the badge carries its OWN opaque cream ground
     — it is already a box, and a cream rectangle inside a white one is worse
     than leaving it alone. It is the one logo the contrast measurement gets
     wrong (it reads the ground as ink), so it is pinned by hand. */
  check('…on the dark tile, because the badge carries its own ground', !!bili && !bili[4]);
  eq('…rendered small enough that its 90px source is not stretched far', Number(bili && bili[3]), 52);
  check('…and the reason it stays on the dark tile is written down',
    /badge with its own opaque cream ground/i.test(PAGE) && /154x90/.test(PAGE));

  const anderson = rows.find((r) => r[2].includes('anderson-education'));
  check('Anderson is on the page', !!anderson);
  /* Red wordmark over a BLACK subline — the subline is invisible on the dark
     tile and recolouring it is exactly what this pass undid, so it takes a box. */
  check('…on a white box, since its subline is black', !!anderson && !!anderson[4]);

  /* ⚠️ THE RULE ITSELF HAS TO BE WRITTEN DOWN, not just applied. "Why is this
     one white and that one not?" is what a later session will ask, and the
     answer — measured contrast, not taste — is the only thing that stops the
     flag being copied around by eye. */
  check('the white-box rule is recorded next to the data',
    /assigned by MEASUREMENT/i.test(PAGE) && /4\.5:1/.test(PAGE));

  check('…and the reason it breaks both artwork rules is written down',
    /badge[\s\S]{0,400}opaque cream/i.test(PAGE) && /154x90/.test(PAGE));
}
/* THE INVITATION STAYS. It is the only route by which another sponsor reaches
   Jay, and the section is the page a prospective one lands on. */
check('the get-in-touch invitation is kept', sponsorsInner.includes('mailto:admin@adhjrt.com'));
/* ⚠️ "More partners will be announced" was TRUE while the section held only
   HSBC and a dashed placeholder. With fourteen supporters up it reads as a
   page that has not been finished, so it went with the placeholder on 4 Aug
   2026. The invitation itself stays — that is the part that matters. */
check('the finished-page copy no longer promises announcements',
  !/More partners will be announced/i.test(sponsorsInner));

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
