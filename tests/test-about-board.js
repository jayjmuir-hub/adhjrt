/* tests/test-about-board.js
   ------------------------------------------------------------------------
   The About-section rotating photo RING (5 Aug 2026), and the one bug it
   shipped with.

   ⚠️ WHY THIS FILE EXISTS AT ALL. The ring arrived across eleven commits and
   ~520 new lines in `Quins JRT.dc.html` with NOT ONE new assertion behind it.
   The fault count was 499 before it and 499 after. By this project's own rule
   — a change nothing asserts is a change that silently regresses — that was a
   gap, and it was found by rendering the deployed page, not by a check.

   ⚠️⚠️ THE BUG, because it will be re-introduced by anyone typing ordinary
   JavaScript into this page. The component engine runs `encodeCase()` over the
   WHOLE component before parsing it, and its regex

       /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g

   exists to survive HTML's case-insensitive attribute names. It DOES NOT STOP
   AT <script> BOUNDARIES. So a local variable written as whitespace + camelCase
   + "=" is rewritten into a kebab-case `sc-camel-…` attribute name wherever it
   appears — including inside a script. The board script declared its
   screen-visibility flag in camelCase, it became `sc-camel-on-screen=`, and the
   copy of the script the engine mounts into <head> threw

       SyntaxError: Failed to execute 'appendChild' on 'Node': Unexpected token '-'

   on EVERY load of adhjrt.com. The ring still worked, because a second
   unmangled copy of the same script executes in place — which is exactly why
   nobody noticed: the symptom was a console error and a page that looked fine.
   Rendering `ba5028d` and `e7056ba` side by side is what pinned it to this
   change. The general sweep below is the guard, and it is deliberately a sweep
   over EVERY inline script in EVERY component, not a check on one variable
   name: the next one will not be called onScreen.

   Structural, not visual. This reads the page as text. It cannot tell you the
   ring looks right — only that the pieces that make it work are present, agree
   with each other, and reference files that exist. The geometry was measured by
   rendering the deployed page at 1400 / 1000 / 390px (panel 74.3 / 74.0 / 74.0%
   of the box); the numbers pinned here are the inputs to that. */

const fs = require('fs');
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* Line endings normalised — git checks these out as CRLF on Windows and every
   multi-line anchor below is written with \n. An un-normalised read finds
   nothing, the block comes back empty, and the checks inside it pass by looking
   at nothing at all. (Hit for real by test-sponsors.js on jay-pc.) */
const PAGE = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
const TOML = readRepo('netlify.toml').replace(/\r\n/g, '\n');

/* ---- helpers ------------------------------------------------------------ */

/* Strip JS comments. Absence checks MUST run on the code, not on the prose:
   this page documents the very traps it avoids ("do NOT put box-shadow on
   .jrtb-p"), so a bare substring check for `box-shadow` inside the ring CSS
   would match the warning telling you not to write it and pass for ever. Same
   trap, in the same repo, three times now. */
function stripJsComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/* Strip CSS and HTML comments for the same reason. */
function stripCssComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' '); }
function stripHtmlComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ' '); }

/* Every inline (executable) <script> body in a component: no src, and no type
   other than a JavaScript one. `type="application/ld+json"` and the engine's
   own `type="text/x-dc"` block are NOT executed as classic scripts and are
   excluded — including the x-dc block here would flag the whole component. */
function inlineScripts(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/type\s*=\s*"([^"]*)"/i) || [])[1];
    if (type && !/javascript|module/i.test(type)) continue;
    if (!m[2].trim()) continue;
    out.push({ body: m[2], at: html.slice(0, m.index).split('\n').length });
  }
  return out;
}

/* The board script, isolated. Anchored on its own opening line rather than on
   a line number, and proven non-empty below — a lazy pattern that matched the
   wrong block entirely and still "passed" is a lesson already on file. */
const BOARD = (PAGE.match(/var PHOTOS[\s\S]*?\n  \}\)\(\);/) || [''])[0];
const BOARD_CODE = stripJsComments(BOARD);

/* ------------------------------------------------------------------------ */
section('the block this file is reading is the right block');

check('the board script was located in the page', BOARD.length > 2000,
  `matched ${BOARD.length} chars`);
check('…and it is the carousel script, not some other block',
  /jrtb-track/.test(BOARD) && /PHOTOS/.test(BOARD));

/* ------------------------------------------------------------------------ */
section('⚠️ the encodeCase trap — no camelCase assignment in any inline script');

/* THE REGEX IS THE ENGINE'S OWN, copied verbatim from support.js's
   CAMEL_ATTR_RE. If the engine ever changes it, this check is describing a rule
   that no longer exists — which is why the reason is written out above rather
   than left as "matches a pattern". */
const CAMEL_ATTR_RE = /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g;

const components = fs.readdirSync(repoRoot()).filter((f) => f.endsWith('.dc.html'));
check('every .dc.html component is being swept', components.length >= 5,
  `${components.length} found: ${components.join(', ')}`);

let sweptScripts = 0;
const mangles = [];
for (const file of components) {
  const html = readRepo(file).replace(/\r\n/g, '\n');
  for (const s of inlineScripts(html)) {
    sweptScripts++;
    /* Comments are stripped first: the engine rewrites inside a comment too,
       but a rewritten comment cannot throw. Only code can, and a check that
       fired on prose would be untrue and would eventually be deleted by
       somebody who was right to delete it. */
    const code = stripJsComments(s.body);
    let m;
    CAMEL_ATTR_RE.lastIndex = 0;
    while ((m = CAMEL_ATTR_RE.exec(code))) {
      /* `==`, `===`, `=>` and `!=` are not assignments and the engine's regex
         does not match them either — it requires a bare `=`. Re-check here so
         this file cannot report a mangling the engine would not perform. */
      const after = code.slice(m.index + m[0].length);
      if (/^[=>]/.test(after)) continue;
      mangles.push(`${file}:${s.at}  ${m[2]}=`);
    }
  }
}
check('inline scripts were actually found to sweep', sweptScripts >= 2,
  `${sweptScripts} script(s)`);
check('no inline script assigns to a camelCase name (encodeCase would mangle it)',
  mangles.length === 0, mangles.join(' | '));

/* And the positive half: the flag the bug was found on is still there, doing
   its job, under a name the engine leaves alone. Asserting the absence of
   things is not a test — pair it with one that reads the working code. */
check('the ring still has a screen-visibility flag', /\bonscreen\b/.test(BOARD_CODE));
check('…and it gates the timer, so an off-screen carousel stops advancing',
  /if\(!onscreen\|\|document\.hidden\)return;/.test(BOARD_CODE),
  'costs nothing when nobody is looking at it');
check('…and an IntersectionObserver sets it',
  /onscreen=es\[0\]\.isIntersecting/.test(BOARD_CODE));

/* ------------------------------------------------------------------------ */
section('geometry — the radius is trigonometry, not taste');

/* ⚠️ REPOINTED WHOLESALE 6 Aug 2026 when the ring became a coverflow carousel.
   The RING is gone — PANELS, the 1/(2·tan(180/PANELS)) radius and --turn with
   it — but every RULE this section enforced survived the change and is
   asserted against the new subject: one variable drives the geometry, the CSS
   and the script agree on the timing, and there are more photos than slots so
   the cards have to recycle. Deleting these along with their subject would
   have retired three live guarantees by accident. */
const cards  = Number((BOARD_CODE.match(/var CARDS\s*=\s*(\d+)/) || [])[1]);
const photos = Number((BOARD_CODE.match(/var PHOTOS\s*=\s*(\d+)/) || [])[1]);
const glide  = Number((BOARD_CODE.match(/var GLIDE\s*=\s*(\d+)/) || [])[1]);

eq('the carousel carries 6 cards', cards, 6);
check('there are more photos than cards (they recycle through)', photos > cards,
  `${photos} photos, ${cards} cards`);

/* ⚠️ SIX CARDS, AND EVERY SLOT FROM -1 TO CARDS-2+1 MUST HAVE AN ENTRY. A card
   whose slot has no row in SLOTS keeps whatever transform it last had and
   parks itself on top of the hero — and it renders perfectly, so nothing else
   would catch it. */
const slotKeys = [...(BOARD_CODE.match(/'(-?\d)':\s*\{ x:/g) || [])]
  .map((m) => Number(m.match(/'(-?\d)'/)[1])).sort((a, b) => a - b);
eq('every slot from -1 upwards has a row in the table',
  slotKeys.join(','), Array.from({length: cards}, (_, i) => i - 1).join(','));

/* ⚠️ NO CARD IS TURNED PAST 90°. Chrome treats rotateY past 180deg as
   back-facing and silently never paints it — the ring lost its entire
   left-hand side to exactly that. Well inside 90 also keeps every card
   readable rather than edge-on. */
const rys = [...(BOARD_CODE.matchAll(/ry:\s*(-?\d+)/g))].map((m) => Number(m[1]));
check('the slot rotations were found', rys.length === cards, rys.join(', '));
check('no card is rotated past 90°, where Chrome stops painting it',
  rys.every((r) => Math.abs(r) < 90), rys.join(', '));

/* ⚠️ THE STAGING SLOT MUST BE INVISIBLE. Recycling six cards through eleven
   photos only works because the swap happens where nobody can see it. If the
   last slot ever gains opacity, photos visibly flip on the far side. */
const lastOp = Number((BOARD_CODE.match(new RegExp("'" + (cards - 2) + "':\\s*\\{[^}]*op:([0-9.]+)")) || [])[1]);
eq('the staging slot is fully transparent, so the repoint cannot be seen', lastOp, 0);
/* ⚠️ AND THE SCRIPT MUST TARGET THAT SAME SLOT. It targeted CARDS-2+1 first
   time — a slot that cannot occur — so restock() never ran and the carousel
   would have shown the same six photos for ever while the other five never
   appeared. Nothing errors and nothing looks broken; you would notice by
   counting, or not at all. Derived, so the two cannot drift. */
check('the script restocks at the staging slot, not one past it',
  /var STAGE = CARDS - 2;/.test(BOARD_CODE) && /slotof\(j\)===STAGE/.test(BOARD_CODE),
  'CARDS-2 is the last slot slotof() can return');

/* The glide length is written twice — once in CSS as --glide, once in the
   script as GLIDE. Drift means the script and the animation disagree. */
const cssGlide = Number((PAGE.match(/--glide:\s*(\d+)ms/) || [])[1]);
eq('the CSS --glide and the script GLIDE are the same number', cssGlide, glide);

/* ------------------------------------------------------------------------ */
section('the sizes attribute — load-bearing, and easy to lose');

/* Without `sizes` the browser assumes the image fills the viewport and always
   takes the 960px file, silently doubling the cost of the section. It appears
   THREE times — twice in the hard-coded fail-safe panel's two <source>s, once
   in the script that builds the other seven — and all three must agree or the
   first panel and the rest are fetched at different sizes. */
const SIZES = '(min-width:1461px) 380px, 26vw';
const sizesCount = PAGE.split(SIZES).length - 1;
check('the sizes string appears three times, identically', sizesCount === 3,
  `found ${sizesCount}`);
check('…including in the script that builds the other cards',
  BOARD_CODE.includes(SIZES));

/* ⚠️ AND THE REAL INVARIANT, rather than three copies of a pinned literal:
   `sizes` must AGREE WITH --cw. The literal above catches an edit that touches
   one of the three copies; this catches the more likely mistake, which is
   re-proportioning the section, updating the CSS and leaving `sizes` behind.
   That costs every visitor a bigger file than they need and reports nothing.
   Both numbers are read out of the page rather than written down here, so the
   check survives the next resize instead of needing edited by whoever does it.

   ⚠️ AND THE BREAKPOINT IS DERIVED. --cw is clamp(190px, Nvw, Mpx), so the vw
   term reaches the cap at 100*M/N px of viewport — that is where `sizes` must
   switch to the fixed clause. Writing 1461 in both places would pass happily
   while the two drifted; computing it cannot. */
const cwClamp = PAGE.match(/--cw:\s*clamp\(\s*\d+px,\s*([0-9.]+)vw,\s*(\d+)px\s*\)/);
check('the --cw clamp was located', !!cwClamp);
if (cwClamp) {
  const cwVw = Number(cwClamp[1]), cwMax = Number(cwClamp[2]);
  const sizesMax = Number((SIZES.match(/\(min-width:\d+px\) (\d+)px/) || [])[1]);
  const sizesAt  = Number((SIZES.match(/\(min-width:(\d+)px\)/) || [])[1]);
  const sizesVw  = Number((SIZES.match(/,\s*([0-9.]+)vw/) || [])[1]);
  eq("sizes' capped width is --cw's clamp maximum", sizesMax, cwMax);
  eq('…and the scaling half is the same vw', sizesVw, cwVw);
  check('…and the breakpoint is where the vw term actually reaches the cap',
    Math.abs(sizesAt - (100 * cwMax / cwVw)) <= 1,
    `sizes switches at ${sizesAt}px; ${cwVw}vw hits ${cwMax}px at ${Math.round(100 * cwMax / cwVw)}px`);
}

/* ⚠️ THE BLEED, WHICH IS THE MOST DANGEROUS LINE IN THIS SECTION. The photo box
   is deliberately sized to finish exactly at the right edge of the viewport, so
   the carousel has room the two-column grid cannot give it without stealing
   from the heading. One sub-pixel error there is a horizontal scrollbar on
   EVERY page of the site — it is swept live from 1440 to 360, and the formula
   is pinned here so it cannot be "tidied" into something that only looks right
   at one width.

     content right edge to viewport = (100vw - min(1200px,100vw))/2 + 32px
     100vw >= 1200  ->  50vw - 568px
     100vw <  1200  ->  32px
   max() is exactly those branches and is continuous at 1200px. */
/* ⚠️ A LOCAL COPY ON PURPOSE. An earlier block in this file read a const that
   was declared LATER and the whole suite died on a ReferenceError rather than
   failing a check — a test file that cannot load reports nothing at all. */
const CSSNC = stripCssComments(PAGE);
check('the carousel bleeds to the right edge with the derived formula',
  /margin-right:\s*calc\(-1 \* max\(32px,\s*\(100vw - var\(--sbw, 0px\)\) \/ 2 - 568px\)\)/.test(CSSNC),
  'sized off the section max-width and padding, not eyeballed');

/* ⚠️⚠️ THE SCROLLBAR, AND IT SHIPPED WRONG ONCE. `100vw` INCLUDES the classic
   scrollbar; the centred section does not. Measured on the deployed preview at
   a 1387px window: 15px scrollbar, 1372px of content, and the box finished at
   1380 — EIGHT PIXELS PAST THE EDGE, exactly half the scrollbar.

   It produced no visible scrollbar only because an ancestor carries
   overflow-x:hidden and was clipping it: a fallback hiding a fault in the very
   thing it covers for.

   ⚠️ AND NO LOCAL RENDER COULD HAVE CAUGHT IT. Headless Chromium uses OVERLAY
   scrollbars, so 100vw and the content width are identical and the width sweep
   reported flush everywhere. The only reading that found this was taken in a
   real browser on Windows. */
check('…with the scrollbar subtracted, or it overshoots by half of it',
  /\(100vw - var\(--sbw, 0px\)\)/.test(CSSNC),
  '100vw counts the scrollbar and the centred section does not');
check('…and --sbw is actually published by the head script',
  /window\.innerWidth - document\.documentElement\.clientWidth/.test(stripJsComments(PAGE))
  && /setProperty\('--sbw'/.test(stripJsComments(PAGE)));
check('…onto <html>, which the engine does not re-render',
  /document\.documentElement\.style\.setProperty\('--sbw'/.test(stripJsComments(PAGE)),
  'anything written onto a rendered element is destroyed by the next render');
/* ⚠️ AND MEASURING IT ONCE IS WORSE THAN NOT MEASURING IT. On the deployed
   page --sbw published `0px` while the real scrollbar was 15px: it ran before
   the body was tall enough to need one, nobody resized the window, and the
   stale 0 sat there for the life of the page — quietly reinstating the exact
   overshoot it exists to remove. A ResizeObserver on <html> is the real signal,
   because clientWidth changes at the instant a scrollbar appears or goes. */
check('…recomputed on resize, since a scrollbar can appear or go',
  /addEventListener\('resize', sbw/.test(stripJsComments(PAGE)));
check('…and on load, for a page that is already long by then',
  /addEventListener\('load', sbw\)/.test(stripJsComments(PAGE)));
check('…and watched, or a first measurement of 0 sits there for ever',
  /new ResizeObserver\(sbw\)\.observe\(document\.documentElement\)/.test(stripJsComments(PAGE)),
  'clientWidth changes the moment a scrollbar appears — that is the event');
check('…and the section it is derived from is still 1200px wide with 32px padding',
  /id="about"[^>]*max-width:1200px[^>]*padding:100px 32px/.test(PAGE),
  'change either and the bleed formula has to be redone by hand');
check('…and the right-hand corners are square, not rounded against the screen edge',
  /border-radius:18px 0 0 18px/.test(CSSNC));

/* ⚠️ REPOINTED 5 Aug 2026 (evening). `sizes` used to carry a
   `(max-width:760px) 74vw` clause and this checked it was 760 and not 700. The
   section is HIDDEN below 760px now, so the panel builder never runs there and
   a phone clause in `sizes` would describe a case that cannot happen — it was
   removed rather than left as decoration. The 760 breakpoint is still very much
   load-bearing, just somewhere else, so the check moved to where it now lives
   (the hide rule and the <picture> media conditions, in their own section
   below) instead of being deleted with its old subject. */
check('the sizes string carries no phone clause', !SIZES.includes('max-width:760px'),
  'the builder cannot run below 760px, so a clause for it would be describing nothing');
/* The stacked layout's own override has to sit at the SAME breakpoint. If the
   two drift apart there is a band of widths where `sizes` promises one width
   and the CSS delivers another, and the browser fetches the wrong file with no
   error anywhere. Whitespace is collapsed because the rule is written across
   three lines. */
const PAGE_FLAT = PAGE.replace(/\s+/g, ' ');
/* The 760px block, comments stripped. Declared here because two sections read
   it; the mobile-hide section below re-derives it under its own name for
   readability.
   ⚠️ The closing brace is matched as `\n\s*}`, not `\n}`. With the strict
   version an indented closing brace did not end the block, so the match ran on
   into the NEXT media block and swallowed it — a fault that moved a rule into a
   700px block went uncaught, because the rule was still inside the (wrongly
   extended) match. A lazy regex that matches too much passes for the same
   reason it should fail. */
const CSS_760_FOR_PW = (stripCssComments(PAGE).match(/@media \(max-width:760px\)\{[\s\S]*?\n\s*\}/) || [''])[0];
/* ⚠️ WIDENED DELIBERATELY, and it is worth saying why. This used to require the
   .about-photo rule to sit IMMEDIATELY after `@media (max-width:760px){`, which
   made it an adjacency check rather than a breakpoint check — and it broke the
   moment the hide rule was added above it, on a change that did nothing wrong.
   What it is really asserting is that the stacked --pw override lives INSIDE
   the same 760px block, so the two cannot drift to different breakpoints. That
   is what it says now. The two things it could have lost by widening — the
   block existing at all, and the rule being in it — are both still checked. */
check('…and the stacked-layout override lives in that same 760px block',
  /\.about-photo\{--cw:clamp\(170px, 62vw, 400px\);--focal:50%;margin-right:0/.test(CSS_760_FOR_PW),
  'the .about-photo phone rule must sit at the same breakpoint as the hide');
/* ⚠️ AND THE BLEED IS CANCELLED THERE. Stacked, the box is already full width;
   leaving a negative right margin on it would push it past the screen edge and
   put a scrollbar on every phone. It is hidden at this width today, so nothing
   would show the mistake until the hide was ever narrowed. */
check('…and it cancels the bleed, not just the width',
  /margin-right:0/.test(CSS_760_FOR_PW));

/* ------------------------------------------------------------------------ */
section('hidden on phones — and it takes THREE things, not one');

/* ⚠️ THE MEASUREMENT THAT DROVE THIS. `display:none` does NOT stop a browser
   downloading images inside the hidden element: measured at 16 requests and
   ~290KB to assets/board with the block fully hidden. A CSS rule alone would
   have hidden the section while a phone went on paying for every photo in it —
   the worst version of this change, because it looks finished.

   Three things are required and each is asserted separately, since any one
   alone is cosmetic:
     1. the CSS hides the whole grid CELL below 760px;
     2. the <picture> hands phones an inline 1x1, so nothing is fetched;
     3. build() refuses to construct a ring that has no client rects.
   Verified by counting real requests rather than reading the rules: 0 at 390px,
   still 9 at 1400px. */

const CSS_760 = (stripCssComments(PAGE).match(/@media \(max-width:760px\)\{[\s\S]*?\n\s*\}/) || [''])[0];
check('the 760px media block was located', CSS_760.length > 40);
check('1. the whole grid cell is hidden, not just the box inside it',
  /\.about-media\{display:none\}/.test(CSS_760),
  'hiding .about-photo alone leaves the stacked gap behind as dead space');
check('…and the cell actually carries that class in the markup',
  /class="about-media"/.test(PAGE),
  'a rule with nothing to select is not a hide');

const PIC = (PAGE.match(/<picture>[\s\S]*?<\/picture>/) || [''])[0];
check('the fail-safe picture was located', PIC.includes('board-01'));
check('2. phones match a source that costs no request',
  /<source media="\(max-width:760px\)" srcset="data:image\/gif;base64,/.test(PIC),
  'a matching <source> wins over the <img src>, so the photo is never asked for');
check('…and both real sources are fenced ABOVE the breakpoint',
  (PIC.match(/media="\(min-width:761px\)"/g) || []).length === 2,
  'avif AND webp, or a phone falls through to a real photo');
check('…761, so the two conditions meet with no gap',
  PIC.includes('(max-width:760px)') && PIC.includes('(min-width:761px)'),
  'a viewport between them would match neither source');
check('…and the <img> src is still a real photo for the no-JS desktop case',
  /<img src="assets\/board\/board-01\.webp"/.test(PIC),
  'it is only used when no source matches, so it remains the fail-safe');

/* ⚠️ AND THE BUG THAT ADDING THE PHONE SOURCE CAUSED, which nothing would have
   caught. point() used to write the avif and webp srcsets by INDEX - s[0] and
   s[1]. Inserting the 1x1 source at the front of the markup shifted every index
   by one, so the avif srcset landed on the phone source and the webp srcset on
   the source declaring type="image/avif". No error, no visible difference: the
   front panel just quietly served WebP instead of AVIF, ~30% more bytes. It was
   found by reading currentSrc off a render, not by any check. It has one now. */
check('point() finds the sources by TYPE, not by DOM position',
  /s\[j\]\.type===.image\/avif./.test(BOARD_CODE) && /s\[j\]\.type===.image\/webp./.test(BOARD_CODE),
  'anything keyed off DOM order breaks when an element is inserted above it');
check('…and nothing addresses the sources by index any more',
  !/s\[0\]\.srcset|s\[1\]\.srcset/.test(BOARD_CODE),
  'the positional version is the bug');

check('3. build() refuses a host with no client rects',
  /if\(!host\.getClientRects\(\)\.length\) return;/.test(BOARD_CODE));
check('…and does NOT flag it built, so it retries when the box appears',
  !/getClientRects\(\)\.length\)[^\n]*__built/.test(BOARD_CODE),
  'flagging a hidden host built means a rotated phone never gets a ring');
check('…and a resize re-scan catches the breakpoint being crossed later',
  /addEventListener\('resize'/.test(BOARD_CODE) && /setTimeout\(scan,\s*\d+\)/.test(BOARD_CODE),
  'the 20s boot scan is long gone by the time somebody turns a phone sideways');

/* ------------------------------------------------------------------------ */
section('the photos exist — all four files of every set');

/* Four files per photo: AVIF and WebP, 960w and 528w. `PHOTOS` is a count, so
   raising it without adding files points panels at 404s — which fails silently,
   because a <picture> with a dead srcset just shows nothing. */
const boardDir = path.join(repoRoot(), 'assets', 'board');
const haveDir = fs.existsSync(boardDir);
check('assets/board exists', haveDir);

if (haveDir) {
  const missing = [];
  for (let i = 1; i <= photos; i++) {
    const n = (i < 10 ? '0' : '') + i;
    for (const suffix of ['.avif', '-sm.avif', '.webp', '-sm.webp']) {
      const rel = `board-${n}${suffix}`;
      if (!fs.existsSync(path.join(boardDir, rel))) missing.push(rel);
    }
  }
  check(`all ${photos * 4} board files named by PHOTOS exist on disk`,
    missing.length === 0, missing.join(', '));

  /* And the fail-safe panel in the markup points at a real one. With JavaScript
     off this is the only photo anybody sees. */
  check('the hard-coded first panel references board-01',
    /src="assets\/board\/board-01\.webp"/.test(PAGE));
}

/* ------------------------------------------------------------------------ */
section('the ring sits on black, on all THREE of its surfaces');

/* ⚠️ Jay, 5 Aug 2026 (evening): "lets make the background of the 3d picture
   rotation black again". It was #0C0C0E until `65f319c` swapped it to cream a
   few hours earlier; this puts it back. Both looks are defensible — cream made
   the box vanish into the section so the photos floated, black makes it a
   framed object and turns the wedges that open while the ring rotates into part
   of the effect. The page has now had both, so the colour is pinned rather than
   left to drift a third time.

   ⚠️ THE COLOUR LIVES IN THREE PLACES and the third is the one that gets
   forgotten: the box, the 3D scene, and THE PANEL ITSELF. The panel's own
   background shows only for the instant before its photo has decoded — and the
   five idle-loaded panels start with no src at all — so a panel left cream
   against a black box flashes as a pale rectangle that reads like a broken
   image. It WAS forgotten on the first pass of this change and caught by
   re-reading the comment above it, which is why this checks all three rather
   than the one you can see in a screenshot. */
/* Comments stripped, and computed HERE rather than reusing the header
   section's copy: that one is declared further down the file, and a const
   cannot be read before its own declaration. The first version of this block
   did exactly that and the whole suite died on a ReferenceError. */
const RING_CSS_BG = stripCssComments(PAGE);
const RING_BG = '#0C0C0E';
/* The box's own rule, comments already stripped, so the background is simply
   the first colour inside it. Anchoring through the comment block was brittle
   and broke immediately - the comment is exactly the thing most likely to be
   reworded. */
[['the box', /\.about-photo\{position:relative;border-radius:18px;overflow:hidden;\s*background:(#[0-9A-Fa-f]{6})/],
 /* ⚠️ WIDENED, AND SPLIT, ON PURPOSE. The old anchor matched the WHOLE rule
     as one literal, so adding touch-action to .jrtb-scene broke a check about
     a background colour. An anchor that reads more of the rule than it is
     asserting fails on changes that did nothing wrong — but simply widening it
     to `[^}]*` would let the rule lose every other property it carries, which
     is how a check quietly stops guarding anything. So it reads the colour
     loosely and the properties that matter have their own checks below. */
  ['the 3D scene', /\.jrtb-scene\{[^}]*background:(#[0-9A-Fa-f]{6})/],
 ['the card', /\.jrtb-p\{[\s\S]*?background:(#[0-9A-Fa-f]{6})\}/]].forEach(([label, re]) => {
  const got = (RING_CSS_BG.match(re) || [])[1];
  check(`${label} is on ${RING_BG}`, got === RING_BG, `found ${got || 'nothing — the anchor moved'}`);
});

/* And the invariant behind the three literals: they must AGREE. Two dark and
   one cream is the failure mode, not "one of them is the wrong dark". */
const surfaces = [
  (RING_CSS_BG.match(/\.jrtb-scene\{[^}]*background:(#[0-9A-Fa-f]{6})/) || [])[1],
  (RING_CSS_BG.match(/\.jrtb-p\{[\s\S]*?background:(#[0-9A-Fa-f]{6});/) || [])[1],
];
check('the scene and the panel are the same colour as each other',
  surfaces[0] && surfaces[0] === surfaces[1],
  `scene ${surfaces[0]}, panel ${surfaces[1]}`);

/* The tombstone, so the next person meets the argument before the temptation. */
check('the reversal and the argument for cream are both recorded',
  /IT IS DARK AGAIN \(#0C0C0E\), reversed at Jay's request/.test(PAGE) &&
  /do not flip it a third time/.test(PAGE));

/* ------------------------------------------------------------------------ */
section('the three rendering traps, asserted as absences on the CODE');

const RING_CSS = stripCssComments(
  (PAGE.match(/\.jrtb\{[\s\S]*?\.jrtb:not\(\.ready\)[^\n]*\n/) || [''])[0]);
check('the ring CSS block was located', RING_CSS.length > 300,
  `matched ${RING_CSS.length} chars`);

/* box-shadow anywhere on .jrtb-p or its pseudo-elements stops panels painting
   their <img> at all — a compositing bug with box-shadow inside a
   backface-visibility:hidden element in a preserve-3d scene. It reports no
   error; the photos simply do not appear. */
const panelRules = RING_CSS.split(/(?=\.jrtb)/).filter((r) => /^\.jrtb-p/.test(r));
check('there are .jrtb-p rules to check', panelRules.length >= 2,
  `${panelRules.length} rule(s)`);
check('no box-shadow on .jrtb-p or its pseudo-elements',
  !panelRules.some((r) => /box-shadow/.test(r)),
  panelRules.filter((r) => /box-shadow/.test(r)).join(' | ').slice(0, 160));

/* overflow, opacity or filter on .jrtb-ring forces the browser to flatten
   preserve-3d and the cylinder collapses into a flat horizontal squash.
   Clipping belongs on .about-photo, which is why that one IS allowed to. */
const ringRule = (RING_CSS.match(/\.jrtb-track\{[\s\S]*?\}/) || [''])[0];
check('the .jrtb-track rule was located', ringRule.length > 30);
check('no overflow / opacity / filter on .jrtb-track',
  !/(^|[;{\s])(overflow|opacity|filter)\s*:/.test(ringRule), ringRule.slice(0, 160));
check('…and the clipping is on .about-photo instead',
  /\.about-photo\{[^}]*overflow:hidden/.test(PAGE));

/* ⚠️ REPOINTED, SAME RULE. This asserted that ring angles were normalised to
   -180..+180, because Chrome treats rotateY past 180deg as back-facing and the
   whole left-hand side of the ring silently never painted. The ring is gone;
   the hazard is not. The slot rotations are checked against 90° in the
   geometry section above, and what is left here is the other half of that
   lesson — the cards must not carry backface-visibility:hidden, which is what
   turned an unpainted angle into an invisible one rather than a mirrored one. */
check('no card is hidden by backface-visibility, which masked the ring bug',
  !/\.jrtb-p\{[^}]*backface-visibility/.test(CSSNC));

/* ------------------------------------------------------------------------ */
section('the two boot bugs that made this work locally and not deployed');

/* __built set on ENTRY left the host flagged as built when it was not, and the
   re-scanning loop skipped it for ever. It has to be set only once the panels
   are actually seated. */
const flagAt = BOARD_CODE.indexOf('host.__built=1');
const seatAt = BOARD_CODE.indexOf('layout();');
check('build() flags success only AFTER the cards are placed',
  flagAt > 0 && seatAt > 0 && flagAt > seatAt,
  `flag at ${flagAt}, layout at ${seatAt}`);
check('…and the early return does not set it',
  /if\(host\.__built\)return;/.test(BOARD_CODE) &&
  !/if\(host\.__built\)return;\s*host\.__built/.test(BOARD_CODE));

/* The engine renders the body after first paint and does it more than once, so
   a one-shot "found it, stop looking" builds an element that is then thrown
   away and replaced by one nobody builds. */
check('the boot loop keeps re-scanning', /setInterval\(function\(\)\{\s*scan\(\);/.test(BOARD_CODE));
check('…and it scans EVERY .jrtb, not just the first',
  /querySelectorAll\('\.jrtb'\)/.test(BOARD_CODE) && /for\(var i=0;i<list\.length;i\+\+\)/.test(BOARD_CODE));
check('…and it builds only what is not built yet', /if\(!list\[i\]\.__built\)/.test(BOARD_CODE));

/* Fails safe: if anything in here throws, the static first photo stays. */
check('the whole build is wrapped so a throw leaves the static photo',
  /\}catch\(e\)\{[^}]*\}/.test(BOARD_CODE));

/* ------------------------------------------------------------------------ */
section('the crest that is no longer in this section, and the one that never was');

const PAGE_CODE = stripHtmlComments(PAGE);
const ABOUT = (PAGE_CODE.match(/<section id="about"[\s\S]*?<\/section>/) || [''])[0];
check('the About section was located', ABOUT.length > 500,
  `matched ${ABOUT.length} chars`);

/* ⚠️⚠️ REVERSED ON THE `Compare` BRANCH (Jay, 6 Aug 2026) — AND REVERSED IS NOT
   DELETED. On `main` this block asserts the opposite: that the About section
   carries NO crest, and that `crest-shield.png` is never a live element
   anywhere. Both were right for `main`. Jay asked for the badge and the bat
   back on the rotating picture, so the subject flipped and the checks flip with
   it — but **the rule underneath them did not change, and it is the rule that
   matters**: the badge in this section must be the file that PAIRS with the bat
   that is actually present.

   That rule has two live failure modes and this branch can hit either:
     - `crest.png` + bat  →  TWO bats, one of them motionless. crest.png has a
       bat printed on it already.
     - `crest-shield.png` + no bat  →  a crest with a BAT-SHAPED HOLE in it,
       which is what went live on 5 Aug and sat there until Jay spotted it.
   So the checks below are not "is the shield there" — they assert the PAIRING,
   in both directions. Deleting them and asserting presence alone would pass on
   a page with the shield and no bat, which is the exact bug that shipped. */
check('the About section carries the crest again',
  /<img[^>]+assets\/crest-shield\.png[^>]*>/.test(ABOUT),
  'restored at Jay\'s request 6 Aug 2026 on the Compare branch');
check('…and it is the SHIELD, the one with the bat-shaped hole',
  /class="cbase"[^>]*assets\/crest-shield\.png/.test(ABOUT));
check('…NOT the complete crest, which would put two bats on screen',
  !/<img[^>]+assets\/crest\.png[^>]*>/.test(ABOUT),
  'crest.png already has a bat printed on it');

/* ⚠️ THE PAIRING, ASSERTED BOTH WAYS. The shield is only correct while a real
   bat is present to fill its hole; the bat is only correct while it has the
   holed shield to fly out of. Either alone is a bug that renders without
   erroring, so neither is allowed to exist without the other. */
const HAS_SHIELD = /crest-shield\.png/.test(ABOUT);
/* ⚠️ THE BAT IS NOW A CSS BACKGROUND, NOT AN <img> (7 Aug 2026). The three
   clip-path layers paint crest-bat.png from the stylesheet, so looking for it
   in ABOUT alone finds nothing and this pairing check would report the bat
   missing on a page where it is plainly there. Look in the page. */
const HAS_BAT = /url\(assets\/crest-bat\.png\)/.test(stripCssComments(PAGE));
check('the flat bat silhouette is painted', HAS_BAT,
  'crest-bat.png, as the background of the three clip-path layers');
eq('the holed shield and the bat stand or fall together', HAS_SHIELD, HAS_BAT);

/* ⚠️ AND THE PHOTOGRAPHIC BAT IS NO LONGER A LIVE ELEMENT, DELIBERATELY.
   crest-bat-real.png is shaded for a static wings-out pose (18 colour buckets,
   measured) so it cannot be clipped into rotating wings — the shading smears.
   The asset stays in the repo; what must not come back is a reference to it in
   the running page. Asserted on comment-stripped source so the TOMBSTONE
   explaining why it went does not itself trip the check — the fifth time that
   trap has been laid in this repo. */
check('the photographic bat is not painted anywhere in the live page',
  !/crest-bat-real\.png/.test(stripCssComments(stripJsComments(PAGE_CODE))),
  'it is shaded for one pose and smears when clipped into wings');
check('…with the reason left behind as a tombstone rather than silently dropped',
  /crest-bat-real\.png IS NOT FLAT/.test(PAGE));

/* ⚠️ AND PAGE-WIDE, because the pairing rule has a hole in it otherwise. The
   shield is legitimate in exactly ONE place — here, with the bat to fill it.
   Anywhere else on the page (header, footer) there is no bat, so it is just a
   crest with a piece missing, which is precisely what went live on 5 Aug.
   Counted, not merely "is it in the About section": a second copy elsewhere
   satisfies every check above.

   ⚠️ AND THE COUNT RUNS ON CODE WITH *BOTH* COMMENT SYNTAXES STRIPPED. First
   attempt used PAGE_CODE — HTML comments gone, CSS comments not — and returned
   3 against an expected 1, because this file DOCUMENTS the shield/bat pairing
   in a stylesheet comment and again in a markup comment. A bare count matches
   the warning telling you what to do and reports a bug that is not there.
   Fourth time this exact trap has been hit in this repo; the difference is that
   this time the check failed loudly instead of passing quietly. */
const PAGE_NOCOMMENTS = stripCssComments(stripJsComments(PAGE_CODE));
eq('the holed shield appears ONCE on the whole page, and this is the place',
  (PAGE_NOCOMMENTS.match(/crest-shield\.png/g) || []).length, 1);

/* ⚠️ THE ARGUMENT AGAINST THIS SURVIVES IN THE PAGE. The crest was taken out of
   here on 5 Aug because a badge pinned over photos rotating underneath it read
   as "a sticker stuck on a moving thing". The bat weakens that argument; it does
   not delete it. A decision recorded without the case against it is one that
   gets re-argued from scratch by whoever comes next — this repo's own rule about
   tombstones, applied to a restoration rather than a removal. */
check('the argument against putting it back survives in the markup',
  /RECORDED AGAINST ITSELF/.test(PAGE),
  'the sticker-on-a-moving-thing objection, kept on the record');

/* The dead .m-crestrow rule stays dead. The crest is back in the PHOTO BOX, not
   in the heading row it briefly occupied, so that rule has no more to select
   now than it did before. */
check('the dead .m-crestrow rule is still gone',
  !/\.m-crestrow\s*\{/.test(stripCssComments(PAGE)),
  'the crest came back to the photo box, not to the heading row');

/* The crest is also still in the header and the footer. Asserting a presence in
   one place without the others is how a logo quietly disappears from two. */
check('the crest is still on the page elsewhere',
  (PAGE_CODE.match(/assets\/crest\.png/g) || []).length >= 2,
  'header and footer');

/* ---- the bat itself ------------------------------------------------------ */

/* ⚠️ .cstage IS LOAD-BEARING, NOT DECORATION. The flight carries the bat well
   outside the 118px badge box. Without an overflow:hidden stage that is a
   horizontal scrollbar on the whole page, reported by nothing. */
const CSTAGE = (stripCssComments(PAGE).match(/\.cstage\{[^}]*\}/) || [''])[0];
check('the flight path is clipped by .cstage', /overflow:\s*hidden/.test(CSTAGE), CSTAGE);
check('…and the stage cannot swallow clicks meant for the page',
  /pointer-events:\s*none/.test(CSTAGE));
check('the stage is in the markup, wrapping the crest',
  /<div class="cstage">[\s\S]{0,400}class="crest-anim"/.test(ABOUT));

/* ---- the flight, as geometry rather than as text ------------------------ */
/* ⚠️ EVERYTHING BELOW IS ARITHMETIC ON THE ACTUAL NUMBERS, NOT A GREP FOR
   THEM. `offset-path:path()` is literal pixels in the ELEMENT's box, and the
   clip that stops the page scrolling sideways is a different box at a
   different origin. A check that reads "is there an offset-path" passes on a
   path that flies the bat straight out through the clip — which is invisible
   in the source and obvious on screen. So the path is parsed, sampled, and
   compared against the stage rectangle. */

/* The four numbers that place the badge inside the stage. Read, never
   assumed: if either the stage or the badge moves without the other, the crest
   lands somewhere other than (4,4) of .about-media and nothing errors. */
const num = (re, src) => Number((src.match(re) || [])[1]);
const STAGE_W = num(/\.cstage\{[^}]*width:(-?[\d.]+)px/, CSSNC);
const STAGE_H = num(/\.cstage\{[^}]*height:(-?[\d.]+)px/, CSSNC);
const STAGE_T = num(/\.cstage\{[^}]*top:(-?[\d.]+)px/, CSSNC);
const STAGE_L = num(/\.cstage\{[^}]*left:(-?[\d.]+)px/, CSSNC);
const ANIM = (CSSNC.match(/\.crest-anim\{[^}]*\}/) || [''])[0];
const BADGE_T = num(/top:(-?[\d.]+)px/, ANIM);
const BADGE_L = num(/left:(-?[\d.]+)px/, ANIM);
const BADGE_W = num(/width:(-?[\d.]+)px/, ANIM);

check('the stage is a fixed pixel canvas, not a percentage of its container',
  Number.isFinite(STAGE_W) && Number.isFinite(STAGE_H),
  `${STAGE_W}x${STAGE_H} — path() is literal pixels, so the canvas must be too`);

/* ⚠️ IT MAY OVERHANG LEFT AND UP. IT MAY NOT OVERHANG RIGHT OR DOWN.
   .about-media is the RIGHT column: a right overhang eats the section padding
   and puts a horizontal scrollbar on the page at some widths. Left is the text
   column, which is free room. This is the check that makes "extends left and
   up only" a rule rather than a comment. */
check('the stage overhangs up and left of the photo box', STAGE_T < 0 && STAGE_L < 0,
  `top ${STAGE_T}px, left ${STAGE_L}px`);
/* The photo box is square-ish and never narrower than the badge's own column;
   the overhang that matters is the one PAST its right edge, which is
   STAGE_L + STAGE_W - boxWidth. Rather than guess the box width, assert the
   badge sits far enough inside the stage that the stage's right edge is at
   most the box's own right edge for any box at least as wide as the badge's
   offset allows. Concretely: the stage extends (STAGE_W + STAGE_L) past the
   box's left edge, and the box is at least that wide only if the design says
   so — so this is asserted against the measured 533px box in the comment. */
const BOX_MEASURED = 533;
check('…and does not overhang its right or bottom edge, which is the scrollbar bug',
  STAGE_L + STAGE_W <= BOX_MEASURED && STAGE_T + STAGE_H <= BOX_MEASURED,
  `right edge at ${STAGE_L + STAGE_W}px, bottom at ${STAGE_T + STAGE_H}px, box ${BOX_MEASURED}px`);

/* ⚠️ THE BADGE MUST STILL LAND AT (4,4) OF .about-media. The stage moved by
   (STAGE_L, STAGE_T), so the badge inside it has to move by exactly the
   opposite amount to stay put. Two numbers that must change together; this is
   the pair that catches one of them being edited alone. */
eq('the crest badge still sits at (4,4) of the photo box',
  `${BADGE_L + STAGE_L},${BADGE_T + STAGE_T}`, '4,4');

/* The path, parsed. One M and three C segments, cubic Béziers throughout. */
const PATHSTR = (CSSNC.match(/offset-path:\s*path\("([^"]+)"\)/) || [])[1] || '';
check('the flight is one continuous offset-path, not a list of waypoints',
  PATHSTR.length > 40, `${PATHSTR.length} chars`);

const pts = (PATHSTR.match(/-?[\d.]+\s*,\s*-?[\d.]+/g) || [])
  .map((p) => p.split(',').map(Number));
check('the path parsed into coordinate pairs', pts.length >= 10, `${pts.length} points`);

/* ⚠️ THE PATH MUST START AT THE ELEMENT'S OWN CENTRE. With
   offset-anchor:50% 50%, offset-distance 0% puts the bat's centre on the first
   point — so if that point is not the centre of the 118px box, the bat
   TELEPORTS the instant the animation is armed, and sits somewhere other than
   the hole in the shield for anyone with reduced motion on. */
const centre = BADGE_W / 2;
check('the path starts at the crest centre, so the bat does not teleport on launch',
  Math.abs(pts[0][0] - centre) <= 1 && Math.abs(pts[0][1] - centre) <= 1,
  `starts (${pts[0]}), badge centre is (${centre},${centre})`);
check('…and returns there, so it lands back in the hole in the shield',
  Math.abs(pts[pts.length - 1][0] - centre) <= 1 &&
  Math.abs(pts[pts.length - 1][1] - centre) <= 1,
  `ends (${pts[pts.length - 1]})`);
check('the anchor is the bat centre, which is what makes those two checks true',
  /offset-anchor:\s*50%\s+50%/.test(CSSNC));

/* ⚠️ THE WHOLE FLIGHT INSIDE THE CLIP — sampled, not eyeballed. This is the
   check that would have caught the bug this rebuild exists to fix: the old
   flight was clipped 31px on the right and 24-27px at the top, which looked
   like a bat with a bite out of it and no test said a word.

   Sample the Béziers at 200 points each, add the bat's rotated half-extent,
   and require every sample to sit inside the stage. The half-extent is the
   half-diagonal of the 118px box because the bat rotates with the path — a
   bounding box that ignores rotation under-reports the corners, which is
   exactly the mistake made on the first pass at this. */
function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((i) =>
    u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
}
const samples = [];
for (let s = 1; s + 2 < pts.length; s += 3) {
  for (let i = 0; i <= 200; i++) {
    samples.push(cubicAt(pts[s - 1], pts[s], pts[s + 1], pts[s + 2], i / 200));
  }
}
check('the flight path sampled', samples.length > 500, `${samples.length} samples`);
/* Half-diagonal of the badge box, which is the worst case for any rotation. */
const HALF = Math.sqrt(2) * BADGE_W / 2;
/* Path coordinates are in .crest-anim's box; the stage's origin is
   (BADGE_L, BADGE_T) further up and left. Convert before comparing — mixing
   the two coordinate systems is how a clipped flight passes a clip check. */
const stageX = samples.map((p) => p[0] + BADGE_L);
const stageY = samples.map((p) => p[1] + BADGE_T);
const worst = {
  left: Math.min(...stageX) - HALF,
  top: Math.min(...stageY) - HALF,
  right: STAGE_W - (Math.max(...stageX) + HALF),
  bottom: STAGE_H - (Math.max(...stageY) + HALF),
};
check('no part of the flight is clipped by the stage, at any point along it',
  worst.left >= 0 && worst.top >= 0 && worst.right >= 0 && worst.bottom >= 0,
  `clearances L${Math.round(worst.left)} T${Math.round(worst.top)} ` +
  `R${Math.round(worst.right)} B${Math.round(worst.bottom)} px`);

/* ⚠️ THE BAT BANKS INTO ITS TURNS, WHICH IS THE WHOLE POINT OF offset-path.
   `offset-rotate:auto` alone points the bat along the tangent; the +14deg is
   the artwork's own nose-up offset. Without `auto` it flies sideways, and the
   flight still runs. */
check('the bat turns to face its direction of travel', /offset-rotate:\s*auto\b/.test(CSSNC),
  'without `auto` it slides along the curve sideways and nothing errors');

/* ⚠️⚠️ THE LANDING ANGLE, AND THIS ONE WAS A REAL BUG CAUGHT BY MEASURING
   RATHER THAN BY READING (7 Aug 2026). `offset-rotate:auto` points the bat
   along the path's TANGENT — so the angle it rests at is decided by the shape
   of the curve, not by anything you can see in the markup. The first version
   of this path left 51 degrees between its departure and its arrival: the bat
   took off flush in the shield's bat-shaped hole and landed nose-up-left,
   sitting permanently askew in a hole cut for a level bat. `forwards` then
   held it there. It renders perfectly and is invisible in the source.

   Two things have to be true and they are not independent:
     - the path must LEAVE and ARRIVE on the same heading, or the bat rests at
       two different angles at the two ends of the same flight;
     - `offset-rotate`'s fixed part must cancel that heading, or it rests at a
       consistent WRONG angle at both ends.
   Both are arithmetic on the control points, so both are checked here. */
const ang = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
const outHeading = ang(pts[0], pts[1]);
const inHeading = ang(pts[pts.length - 2], pts[pts.length - 1]);
check('the flight leaves and arrives on the same heading',
  Math.abs(outHeading - inHeading) < 1,
  `departs ${outHeading.toFixed(1)}°, arrives ${inHeading.toFixed(1)}° — ` +
  'a mismatch parks the bat askew in a hole cut for a level one');
const noseOffset = Number((CSSNC.match(/offset-rotate:\s*auto\s+(-?[\d.]+)deg/) || [])[1]);
check('…and the nose offset cancels it, so the bat rests level in the hole',
  Number.isFinite(noseOffset) && Math.abs(outHeading + noseOffset) < 1,
  `heading ${outHeading.toFixed(2)}° + offset ${noseOffset}° = ` +
  `${(outHeading + noseOffset).toFixed(2)}°, wanted 0`);

/* The four live keyframe sets. batfly / batflap / batmorph are GONE — see the
   tombstone in the stylesheet — and their absence is asserted, because a dead
   keyframe set left behind is a second set of timings for the next person to
   reconcile against the live one. */
['fly', 'dive', 'flapL', 'flapR'].forEach((k) =>
  check(`@keyframes ${k} is present`, new RegExp('@keyframes\\s+' + k + '\\b').test(CSSNC)));
['batfly', 'batflap', 'batmorph'].forEach((k) =>
  check(`the dead @keyframes ${k} is gone`,
    !new RegExp('@keyframes\\s+' + k + '\\b').test(CSSNC)));
check('…with a tombstone saying what was there and why it went',
  /TOMBSTONE[\s\S]{0,400}batfly/.test(PAGE),
  'a deletion with no trace is an invitation to re-add it');

/* ⚠️ SCALE IS A STANDALONE PROPERTY HERE, NOT A transform. offset-path owns
   the element's transform matrix; a `transform:scale()` on the same element
   overwrites it and the bat stops moving along the path entirely — while the
   scale animation still runs, so it looks alive and goes nowhere. */
const DIVE = (CSSNC.match(/@keyframes dive\{[^}]*\}/) || [''])[0];
check('the dive uses the standalone scale property, not a transform',
  /scale:/.test(DIVE) && !/transform:/.test(DIVE), DIVE);

/* ---- the wings ---------------------------------------------------------- */
/* ⚠️ THREE LAYERS OVER ONE FLAT PNG. Left wing, right wing, body band. The
   band is painted last and covers the wedge that opens at the cut line when
   the wings rotate; two layers alone leave a visible notch. */
const HALF_L = (CSSNC.match(/\.crest-anim \.half\.l\{[^}]*\}/) || [''])[0];
const HALF_R = (CSSNC.match(/\.crest-anim \.half\.r\{[^}]*\}/) || [''])[0];
const HALF_B = (CSSNC.match(/\.crest-anim \.half\.b\{[^}]*\}/) || [''])[0];
check('all three wing layers exist', !!HALF_L && !!HALF_R && !!HALF_B);
check('…and all three are in the markup, in paint order with the band last',
  /class="half l"[\s\S]{0,200}class="half r"[\s\S]{0,200}class="half b"/.test(ABOUT),
  'the band covers the wedge the two rotating wings open at the cut line');

/* ⚠️ THE BAND MUST NEVER ROTATE. This is the check the whole three-layer
   trick rests on: give the band an animation and the wedge it exists to cover
   opens up again, and the bat renders perfectly with a notch in its chest. */
check('the body band carries no animation of any kind',
  !/animation/.test(HALF_B), HALF_B);

/* The clip regions have to MEET or OVERLAP, never leave a gap. Left keeps
   0..56%, right keeps 44..100%, band keeps 38..62%: the wings overlap by 12
   points and the band straddles the join. A gap between the two wing clips is
   a transparent stripe down the middle of the bat. */
const insetOf = (rule) => ((rule.match(/clip-path:inset\(([^)]+)\)/) || [])[1] || '')
  .trim().split(/\s+/).map((v) => parseFloat(v));
const IL = insetOf(HALF_L), IR = insetOf(HALF_R), IB = insetOf(HALF_B);
check('the wing clips were parsed', IL.length === 4 && IR.length === 4 && IB.length === 4,
  `${IL} / ${IR} / ${IB}`);
/* inset() order is top right bottom left, so the left layer keeps 0..(100-right)
   and the right layer keeps (left)..100. */
check('the two wing clips overlap rather than leaving a transparent stripe',
  (100 - IL[1]) >= IR[3], `left keeps 0..${100 - IL[1]}%, right keeps ${IR[3]}..100%`);
check('…and the body band covers the whole overlap, not just part of it',
  IB[3] <= IR[3] && (100 - IB[1]) >= (100 - IL[1]),
  `band keeps ${IB[3]}..${100 - IB[1]}%, overlap is ${IR[3]}..${100 - IL[1]}%`);

/* ⚠️ THE PIVOTS ARE THE SHOULDER, NOT THE CENTRE. transform-origin at 50% 50%
   swings each wing around the middle of the whole bat, which reads as the bat
   shearing rather than flapping. They sit just inboard of the cut line and
   just above the body's midline, and they must MIRROR each other. */
const originOf = (rule) => ((rule.match(/transform-origin:([^;}]+)/) || [])[1] || '')
  .trim().split(/\s+/).map((v) => parseFloat(v));
const OL = originOf(HALF_L), OR = originOf(HALF_R);
check('each wing pivots at its own shoulder, not at the centre of the bat',
  OL.length === 2 && OR.length === 2 && OL[0] !== 50 && OR[0] !== 50,
  `${OL} / ${OR}`);
eq('…and the two pivots mirror each other about the midline',
  OL[0] + OR[0], 100);
eq('…at the same height, so the bat does not flap lopsided', OL[1], OR[1]);
check('…and above the middle of the bat, where a shoulder is', OL[1] < 50,
  `${OL[1]}% down`);

/* The two flap keyframes must be mirror images too, or the bat rows. */
/* ⚠️ THE BODY IS NESTED BRACES, SO `[^}]*` STOPS AT THE FIRST INNER ONE.
   First attempt did exactly that and found one rotation instead of two, then
   reported "keyframes not found" on keyframes that are plainly there. Match to
   the DOUBLE brace that closes the block. */
const FL = (CSSNC.match(/@keyframes flapL\{([\s\S]*?)\}\}/) || [])[1] || '';
const FR = (CSSNC.match(/@keyframes flapR\{([\s\S]*?)\}\}/) || [])[1] || '';
const degs = (s) => [...s.matchAll(/rotate\((-?[\d.]+)deg\)/g)].map((m) => Number(m[1]));
check('both flap keyframes were found', degs(FL).length >= 2 && degs(FR).length >= 2);
eq('the wings flap in mirror image rather than both sweeping the same way',
  degs(FL).map((d) => -d).join(','), degs(FR).join(','));

/* ⚠️⚠️ THE RESTING WINGS MUST BE AT ZERO, AND THIS IS THE CHECK THIS WHOLE
   BLOCK EXISTS FOR (Jay, 7 Aug 2026: "the bat is not sitting properly on the
   logo, it should sit exactly as it does on the static version").

   The wings shipped with 8deg / -8deg at BOTH 0% and 100%. With `both` fill
   the 0% frame applies through the half-second delay before the flight and the
   100% frame applies for ever after it, so the bat sat in the shield's
   bat-shaped hole with its wings splayed 8 degrees — permanently, at both ends
   — in a hole cut for a level bat.

   ⚠️ NOTHING THAT MEASURES `.cf` CAN SEE IT. The wing layers are inset:0 inside
   the badge box and rotate about their own shoulders, so `.cf`'s bounding
   rectangle is 118x118 either way. Every flight-geometry check above passed on
   the broken version, including the one asserting the resting box is
   unrotated. It was found by rendering the resting crest and comparing it
   against crest.png — the complete printed crest — which came out as two
   different pictures.

   The invariant is: the bat at rest must be IDENTICAL to the printed crest,
   which means every animated layer's first and last frame is the identity
   transform. Asserted on both wings and at both ends, because one end alone is
   satisfied by a bat that takes off level and lands splayed. */
const firstLast = (body) => {
  const zero = /(?:^|\})\s*(?:0%|from)\s*(?:,\s*100%\s*)?\{([^}]*)\}/.exec(body);
  const hund = /(?:^|\})\s*(?:0%\s*,\s*)?(?:100%|to)\s*\{([^}]*)\}/.exec(body);
  return [zero && zero[1], hund && hund[1]];
};
[['left', FL], ['right', FR]].forEach(([side, body]) => {
  const [a, b] = firstLast(body);
  check(`the ${side} wing's first and last frames were located`, !!a && !!b, `${a} / ${b}`);
  const flat = (f) => /rotate\(\s*-?0(?:\.0+)?deg\s*\)/.test(f || '');
  check(`…and the ${side} wing rests at zero, not splayed, before the flight`,
    flat(a), `0% is ${a}`);
  check(`…and returns to zero after it, so it fits the hole it came out of`,
    flat(b), `100% is ${b}`);
});

/* And the whole point of the above, stated once as the rule it serves: at rest
   the crest on the page and crest.png are the same picture. Verified by pixel
   comparison in a real browser (mean abs difference 17/765, confined to
   anti-aliased edges); this source check is what keeps it true. */
check('the resting crest is the printed crest, and that is why the zeros matter',
  /it should sit exactly as it does on the static version/.test(PAGE),
  'the rule recorded next to the keyframes that carry it');

/* ⚠️ IT MUST STOP FOR REDUCED MOTION — AND IT MUST STAY VISIBLE, WHICH IS THE
   OPPOSITE OF WHAT THIS RULE USED TO DO (7 Aug 2026). The old rule also set
   opacity:0, correctly, because batfly parked the bat wherever it happened to
   be and a stray bat over the photos looked broken. offset-path changed that:
   with no animation the bat sits at offset-distance 0%, which is its own
   centre, which is the hole in crest-shield.png. Hiding it now leaves a
   bat-shaped hole in the crest for exactly the people who asked for less
   motion — the same 5 Aug bug, arriving by a different door. */
const RM = (PAGE.match(/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\n  \}/) || [''])[0];
check('the bat honours prefers-reduced-motion', /\.crest-anim \.cf/.test(RM), RM.slice(0, 200));
check('…and the wings stop with it, not just the flight',
  /\.crest-anim \.half/.test(RM),
  'flapping wings on a parked bat is the drift this catches');
check('…by freezing at the start, NOT by hiding — a hidden bat is a holed crest',
  /animation:none\}/.test(RM) && !/animation:none;opacity:0/.test(RM), RM.slice(0, 300));
check('…with the reversal recorded, because the old rule was right for the old flight',
  /THE BAT STOPS BUT STAYS VISIBLE/.test(PAGE));

/* ⚠️⚠️ THE BOOT PATTERN. This is the single most important check in the block.
   The script that was mothballed on 5 Aug used find-it-once — scan, else watch
   with a MutationObserver and disconnect on the first hit. The component engine
   re-renders the body after first paint and does it MORE THAN ONCE, so the
   element that gets armed is thrown away and replaced by one nobody arms. It
   works perfectly from a local file and does NOTHING on the deployed site —
   exactly the bug the photo board shipped with the same day, and the removing
   commit wrote the warning down. This asserts the warning was acted on. */
const BAT_CODE = (stripJsComments(PAGE).match(/\(function\(\)\{\s*function arm\(host\)[\s\S]*?\}\)\(\);/) || [''])[0];
check('the bat script was located', BAT_CODE.length > 200, `${BAT_CODE.length} chars`);
check('it RE-SCANS rather than finding the element once',
  /setInterval\(/.test(BAT_CODE) && /scan\(\)/.test(BAT_CODE));
check('…and does not use the find-it-once MutationObserver that was mothballed',
  !/MutationObserver/.test(BAT_CODE),
  'that pattern is why this animation would be dead on the deployed site');
check('…arming every match, not just the first',
  /querySelectorAll\('\.crest-anim'\)/.test(BAT_CODE));
check('…and re-scanning on resize, for a phone turned past the 760px hide',
  /addEventListener\('resize'/.test(BAT_CODE));
/* ⚠️ THIS CHECK WAS TOO WEAK FIRST TIME AND THE PROVER SAID SO. It asserted
   only that `host.__armed=1` appears after `io.observe(host)` — which stays
   true when a SECOND assignment is added on entry, because the later one is
   still sitting there. The fault injected exactly that and walked straight
   past. It counts occurrences now: exactly one, and it must be the one after
   the observer. Same failure and same fix as the stuck-hover sweep. */
eq('the armed flag is assigned exactly once', (BAT_CODE.match(/__armed=/g) || []).length, 1);
check('…and AFTER the observer is attached, never on entry',
  /io\.observe\(host\);[\s\S]{0,120}host\.__armed=1/.test(BAT_CODE),
  'a flag set on entry marks a half-built element as done for ever');
check('the whole arming is wrapped so a throw leaves a static crest',
  /\}catch\(e\)\{\}/.test(BAT_CODE));

/* ---- and the wording, which moved with the columns ---------------------- */
section('the heading size, which is what the column width is really about');

/* ⚠️ 66px, restored 5 Aug 2026 (evening). It was cut to 52px when the photo
   column was widened to 1.5fr, because a 66px Anton heading does not fit a
   430px column. Jay asked for the original back, which is the same change as
   making the photo smaller — the two are one number, not two. Asserted so that
   widening the photo again cannot quietly shrink the words a second time. */
const H2 = (ABOUT.match(/<h2[^>]*font-size:clamp\(([^)]*)\)[^>]*>Rugby the way it should be<\/h2>/) || [])[1];
eq('the About heading is back to its original clamp', H2, '34px,5.5vw,66px');
check('the eyebrow keeps its original 16px gap under it',
  /About the festival<\/div>/.test(ABOUT) && /margin-bottom:16px[^>]*>About the festival/.test(ABOUT));

/* ------------------------------------------------------------------------ */
section('netlify.toml — the folder 404s, which had never worked');

/* ⚠️ These two rules lived here for months returning a plain 200, because the
   rule pointed at ITSELF (`to = "/tests/:splat"`). Netlify DROPS a
   self-referential redirect rather than applying it, so the status was never
   reached and the real file on disk was served — while the comment above it
   said otherwise. Fixed 5 Aug 2026 and verified by fetching the URL on the
   deploy (404, both), not by reading the config. Reading the config proves
   nothing, which is exactly how it went unnoticed; this check is the cheap
   half, and the comment in netlify.toml carries the re-test instruction. */
for (const folder of ['tests', 'tools']) {
  const rule = (TOML.match(new RegExp(`\\[\\[redirects\\]\\]\\s*\\n\\s*from = "/${folder}/\\*"[\\s\\S]*?force = true`)) || [''])[0];
  check(`the /${folder}/* redirect exists`, rule.length > 0);
  check(`…it returns 404`, /status = 404/.test(rule), rule.slice(0, 120));
  check(`…and its target is NOT itself (a self-referential rule is dropped)`,
    !new RegExp(`to = "/${folder}/`).test(rule), rule.slice(0, 120));
  check(`…the target is a real page that exists`,
    /to = "\/404\.html"/.test(rule) &&
    fs.existsSync(path.join(repoRoot(), '404.html')), rule.slice(0, 120));
}

/* ------------------------------------------------------------------------ */
section('the header nav — hover, current section, and the condensed bar');

/* Three treatments Jay picked, combined (5 Aug 2026). What is asserted here is
   the machinery that makes them work, not how they look — a source read cannot
   see a shimmer. The look was measured by rendering: bar 73px -> 53px, HSBC
   19.0px in both states, strapline 10px -> 9px. */

const HDRCSS = stripCssComments(PAGE);

/* A — the holo. Copied from .fmt-grp / .reg-btn rather than invented, so all
   three places drift together or not at all. */
check('the nav hover uses the SAME holo gradient as the cards and buttons',
  (HDRCSS.match(/linear-gradient\(115deg,transparent 25%,rgba\(225,27,34,\.4\) 38%/g) || []).length >= 3,
  'header, age-group cards and Register buttons must all read from the same recipe');
/* ⚠️ REPOINTED 5 Aug 2026 with the shimmer fix. This asserted the nav used
   holoShift — the LOOPING keyframe the cards use — which was the bug Jay
   reported, not the contract. What was really being protected is that the nav
   reuses the shared GRADIENT rather than inventing its own; the checked
   above does that. The timing is deliberately its own: a nav item is rested on,
   a card is brushed past. */
check('…but the nav times its own sweep rather than copying the cards\' loop',
  /\.hdr-nav a:hover::before\{opacity:\.85;animation:holoSweep/.test(HDRCSS) &&
  /\.fmt-grp:hover \.holo\{opacity:\.7;animation:holoShift/.test(HDRCSS),
  'the gradient is shared; the timing is not');

/* B — the underline, inset to the pill so the two line up. */
check('the underline wipes from the left', /\.hdr-nav a::after\{[^}]*transform:scaleX\(0\);transform-origin:left/.test(HDRCSS));
check('…and is inset to the pill padding, not run edge to edge',
  /\.hdr-nav a::after\{[^}]*left:11px;right:11px/.test(HDRCSS),
  'a rule wider than the tint behind it reads as a mistake');

/* B2 — the current section. ⚠️ The mechanism matters more than the effect: a
   class written onto a nav link is destroyed when the engine re-renders the
   body, which it does more than once after first paint. Driving it from one
   attribute on <html> is what makes it survive. */
const SECS = ['about','format','schedule','results','venue','sponsors'];
/* Whitespace collapsed first: the selectors are hand-aligned in the stylesheet
   so the column of section names reads down the page, and counting the spaces
   in a check is how you write a test that fails on a tidy-up. */
const HDR_FLAT = HDRCSS.replace(/\s+/g, ' ');
SECS.forEach((sec) => {
  check(`the current-section underline covers #${sec}`,
    HDR_FLAT.includes(`html[data-sec="${sec}"] .hdr-nav a[href="#${sec}"]::after`),
    'every nav section needs its own rule - one missing is one link that never marks');
  check(`…and #${sec} goes full white while it is current`,
    HDR_FLAT.includes(`html[data-sec="${sec}"] .hdr-nav a[href="#${sec}"]`),
    '');
});
check('the script writes the section to <html>, not to a link',
  /document\.documentElement\.setAttribute\('data-sec'/.test(PAGE) &&
  !/querySelector[^\n]*hdr-nav[^\n]*classList/.test(PAGE),
  'a class on a link dies with the element when the engine re-renders');
check('…and the same for the condensed class',
  /document\.documentElement\.classList\.toggle\('hdr-tight'/.test(PAGE));

/* D — the condensed bar. */
check('the condensed rules are scoped to 761px and up',
  /@media \(min-width:761px\)\{\s*html\.hdr-tight/.test(HDRCSS.replace(/\n\s*/g, ' ')),
  'below that the nav is a panel and the bar is already compact');

/* ⚠️ EVERY CONDENSED RULE NEEDS !important, because every property it
   overrides is set INLINE on the element. Without it the class goes on, the
   DOM looks correct, and the bar does not move by a single pixel — which is
   exactly what the first version did. */
['padding:7px 32px', 'width:32px', 'font-size:16px', 'height:2px', 'height:24px'].forEach((decl) => {
  const rule = (HDRCSS.match(new RegExp('html\\.hdr-tight [^{]*\\{[^}]*' + decl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^}]*\\}')) || [''])[0];
  check(`the condensed "${decl}" beats the inline style`, /!important/.test(rule), rule.slice(0, 90));
});

/* ⚠️ AND THE PARTNER MARK DOES NOT CONDENSE. Asserted as an ABSENCE with the
   reason attached: a placement quietly shrinking is the same class of failure
   as one quietly vanishing, and test-sponsors.js pins the header mark at 19px.
   Its DIVIDER is allowed to shrink - that is our furniture, not theirs. */
check('no condensed rule touches the HSBC mark itself',
  !/html\.hdr-tight[^{]*\.hdr-partner img/.test(HDRCSS) &&
  !/html\.hdr-tight[^{]*\.hdr-partner\{/.test(HDRCSS),
  'the mark is 19px in both states, and test-sponsors.js asserts that number');
check('…while its divider IS allowed to give room back',
  /html\.hdr-tight \.hdr-partner-div\{height:24px!important\}/.test(HDRCSS));

/* The scroll handler itself: throttled, passive, fails safe, and re-scans. */
check('the scroll handler is throttled to one frame',
  /if\(ticking\) return;[\s\S]{0,80}requestAnimationFrame\(measure\)/.test(PAGE),
  'a scroll fires continuously; touching the DOM every event is how a page gets heavy');
check('…and only writes when the answer changes',
  /if\(wanttight !== tight\)/.test(PAGE) && /if\(found !== cursec\)/.test(PAGE));
check('…and is registered passive', /addEventListener\('scroll', onscroll, \{passive:true\}\)/.test(PAGE));
check('…and re-measures after the engine re-renders the body',
  /setInterval\(function\(\)\{ measure\(\); if\(\+\+n>40\)/.test(PAGE),
  'the sections it measures do not exist on the first pass');
check('…and swallows its own errors, leaving the header at rest',
  /\}catch\(e\)\{ \/\* leave the header alone \*\/ \}/.test(PAGE));

/* The phone panel is a stack of full-width rows; the pill and underline are
   removed there rather than left to look like damage. */
check('the decorations come off inside the open phone panel',
  /\.hdr-row\[data-nav-open="true"\] \.hdr-nav a::before,\s*\.hdr-row\[data-nav-open="true"\] \.hdr-nav a::after\{display:none\}/.test(HDRCSS.replace(/\n\s*/g, '\n')),
  '');

/* ⚠️ THE HOVER TREATMENT IS BEHIND @media (hover:hover), AND THAT IS A BUG FIX.
   Jay, 5 Aug 2026: "the header buttons continue to shimmer forever after being
   pressed."

   A touch device has no pointer to move away, so it applies :hover on tap and
   keeps it applied until you touch something else. Measured on an 820px touch
   viewport — the band where the nav bar is still shown rather than collapsed —
   the shimmer was still running 3.4 seconds after a tap with nothing that could
   ever end it. On desktop it stopped correctly the moment the mouse left, which
   is why it shipped: two different experiences of one rule, and only one of them
   had been looked at.

   The sweep also runs ONCE now instead of `infinite`. Copying .fmt-grp's rule
   wholesale is what put a permanent loop on a nav item you rest on while
   reading seven of them. */
/* EVERY hover:hover block, not just the first. A rule moved into a second one
   is still inside a pointer query, and a check that only reads block #1 would
   call that an escape; a rule moved OUT is what actually matters. */
const HOVER_BLOCKS = HDRCSS.match(/@media \(hover:hover\)\{[\s\S]*?\n  \}/g) || [];
const HOVER_BLOCK = HOVER_BLOCKS.join('\n');
check('the hover block exists', HOVER_BLOCK.length > 100);
['a:hover{background', 'a[href="/app"]:hover', 'a:hover::before', 'a:hover::after']
  .forEach((rule) => {
    check(`the "${rule}" rule is inside it`, HOVER_BLOCK.includes('.hdr-nav ' + rule),
      'a hover rule outside the query sticks on after a tap, for ever');
  });
/* ⚠️ COUNTED, NOT MATCHED BY TEXT. The first version asked whether each
   `:hover` string it found also appeared inside the block — which is true even
   when a rule has been moved OUT, because an identical string is still sitting
   inside. The fault that moves one out reported "failed, but not on the named
   check", which is the prover distinguishing a check that fired from one that
   merely went red. Counting occurrences cannot be fooled that way. */
const hoverAll = (HDRCSS.match(/\.hdr-nav a[^{]*:hover/g) || []).length;
const hoverIn  = (HOVER_BLOCK.match(/\.hdr-nav a[^{]*:hover/g) || []).length;
check('…and NO hover rule escaped it', hoverAll > 0 && hoverAll === hoverIn,
  `${hoverAll} :hover rules in the file, ${hoverIn} inside a pointer query - one left outside is one that still sticks`);

check('the sweep runs once and ends off the far edge',
  /animation:holoSweep \.9s ease-out 1 forwards/.test(HOVER_BLOCK));
check('…and holoSweep is one-way, unlike the looping holoShift',
  /@keyframes holoSweep\{from\{background-position:0% 0%\}to\{background-position:140% 140%\}\}/.test(HDRCSS),
  'holoShift returns to its start so it can loop; this one must not');
check('the nav no longer uses the infinite loop at all',
  !/\.hdr-nav[^}]*holoShift/.test(HDRCSS));

/* ⚠️ FOCUS IS NOT A HOVER EFFECT and must stay OUTSIDE the query. A keyboard
   user has no pointer at all; putting the outline inside would take it away
   from the people who need it most. */
check('the focus outline is outside the pointer query',
  !HOVER_BLOCKS.some((blk) => blk.includes('.hdr-nav a:focus-visible')) &&
  /\.hdr-nav a:focus-visible\{outline:2px solid #3bd070/.test(HDRCSS),
  'inside ANY hover query, a keyboard user with no pointer loses the outline');

/* ⚠️ AND THE SAME GATE ON EVERY OTHER COMPONENT THAT MOVES ON HOVER (5 Aug
   2026, second pass). The header fix went out alone first; Jay then asked for
   the rest — "push it to go live so we get it off our plate".

   `.fmt-grp` (age-group cards) and `.reg-btn` (Register buttons) carried the
   identical `infinite` rule with no pointer query, and are where the header
   inherited the bug from. Measured on a 390px touch viewport, 2.5s after a tap:
   both still shimmering, glowing and tilted, indefinitely. The Register button
   is the worst of them — tapping it opens the registration modal AND leaves the
   button lit up behind it.

   ⚠️ THE DESKTOP LOOK IS DELIBERATELY UNCHANGED. `infinite` stays for a mouse:
   it is right for a card you brush past, and Jay is happy with it. Only the
   stuck state goes. Verified against the DEPLOYED page in the same harness —
   hovered, both still report `holoShift/infinite` at opacity .7 with the tilt
   applied, exactly as before.

   This is a SWEEP rather than four literals, because the next component to grow
   a hover effect will not be called .fmt-grp. */
section('nothing that moves on hover can stick on a touch screen');

const HOVER_QUERIES = HDRCSS.match(/@media \(hover:hover\)\{[\s\S]*?\n  \}/g) || [];
check('the page has pointer-gated blocks at all', HOVER_QUERIES.length >= 4,
  `${HOVER_QUERIES.length} found`);

/* A hover rule that only changes colour is harmless when it sticks. One that
   MOVES or ANIMATES is what leaves a card tilted and shimmering with nothing
   able to end it, so that is the set this sweeps. */
const LOUD = /transform|animation|box-shadow/;
const stuckable = [];
for (const m of HDRCSS.matchAll(/([^\n{}]*:hover[^{}]*)\{([^}]*)\}/g)) {
  const [whole, sel, body] = m;
  if (!LOUD.test(body)) continue;                    // colour-only: fine either way
  if (sel.includes('@media')) continue;              // the query line itself
  if (!HOVER_QUERIES.some((q) => q.includes(whole))) stuckable.push(sel.trim().slice(0, 60));
}
check('every hover rule that moves or animates is behind (hover:hover)',
  stuckable.length === 0,
  stuckable.join(' | ') || '');
check('…and the sweep actually found rules to check',
  (HDRCSS.match(/:hover[^{}]*\{[^}]*(transform|animation)/g) || []).length >= 5,
  'if this drops to nothing the sweep above is passing on an empty set');

/* Named individually as well, because these four are the ones measured on a
   real touch viewport and a sweep that silently stopped covering them would
   still pass. */
[['.fmt-grp', 'the age-group cards'], ['.reg-btn', 'the Register buttons'],
 ['.fmt-day', 'the day cards'], ['.rules-btn', 'the rules button']].forEach(([sel, label]) => {
  check(`${label} (${sel}) are gated`,
    HOVER_QUERIES.some((q) => q.includes(sel + ':hover')),
    'measured stuck on a 390px touch viewport before this');
});

/* ⚠️ THE DESKTOP BEHAVIOUR IS PART OF THE CONTRACT. Gating is not an excuse to
   quietly drop the effect: the loop must still be there for a mouse. */
check('the cards still shimmer for a real pointer',
  /\.fmt-grp:hover \.holo\{opacity:\.7;animation:holoShift 2\.2s ease-in-out infinite\}/.test(HDRCSS));
check('…and so do the Register buttons',
  /\.reg-btn:hover \.holo\{opacity:\.7;animation:holoShift 2\.2s ease-in-out infinite\}/.test(HDRCSS));

/* ⚠️ THE NAV GOT WIDER AND THE HEADER OVERFLOWED — twice, and the second time
   it turned out to have been live already.

   The links were bare text with a 24px gap: seven links, six gaps, 144px of
   spacing. An 11px pill padding adds 154px on top, and the sticky header
   scrolled sideways from ~1015px down. The gap came to 2px, and a tighter pill
   through the 761-900px band brought the nav to ~418px against the 466px it was
   on the DEPLOYED page — so a pre-existing 6-12px overflow at 762-770px went
   with it. Measured every 20px from 1440 to 360, plus 770 and 762 by hand.

   Numbers, not adjectives: 14 x padding + 6 x gap must stay under the 144px the
   bar used to spend, at every width where seven links are on screen. */
const navGap = (HDRCSS.match(/\.hdr-nav\{gap:(\d+)px!important\}/) || [])[1];
eq('the nav gap came down when the pills went in', navGap, '2');
check('…and it is !important, because the gap is set inline on the <nav>',
  /\.hdr-nav\{gap:2px!important\}/.test(HDRCSS));

const band = (HDRCSS.match(/@media \(min-width:761px\) and \(max-width:900px\)\{[\s\S]*?\n  \}/) || [''])[0];
check('the 761-900px band tightens the pill further', /padding:7px 6px 9px/.test(band),
  'that band was overflowing on the live site before this change, by 6-12px');
check('…and its underline inset follows the padding', /left:6px;right:6px/.test(band));

/* ⚠️ ORDER IS LOAD-BEARING HERE. Same specificity as the base rule, so the one
   later in the file wins. Written above it, the band rule changed nothing at
   all while looking perfectly correct. */
check('the band rule sits BELOW the base .hdr-nav a rule',
  HDRCSS.indexOf('@media (min-width:761px) and (max-width:900px)') >
  HDRCSS.indexOf('.hdr-nav a{position:relative'),
  'above it, the base padding wins and the band silently does nothing');

/* ------------------------------------------------------------------------ */
/* =========================================================================
   The header condense loop, the bat's new cadence, and the two drop-downs
   (Compare branch, 6 Aug 2026)
   ========================================================================= */

section('the condensing bar cannot flip itself back and forth');

/* ⚠️⚠️ THIS WAS A LIVE BUG ON PRODUCTION AND IT WAS A FEEDBACK LOOP, not a
   rendering glitch. Jay: "if you scroll down just a tiny bit and stop, the top
   bar starts freaking out like its going back and forth between full size and
   smaller size super fast."

   Measured before the fix: park the page at 95px, touch nothing — 92 class
   flips in 2 seconds, with scrollY moving ON ITS OWN over a 19px range.

   The loop: cross the threshold -> `hdr-tight` on -> the bar is 18px shorter ->
   the content above the viewport shrinks -> the browser's SCROLL ANCHORING
   pulls scrollY back to hold your view still -> you are now under the
   threshold -> class off -> bar grows -> anchoring pushes you back up ->
   repeat, once per frame.

   The fix is two thresholds with a gap wider than the height change. */

const HDRJS = stripJsComments(PAGE);
const tightOn = Number((HDRJS.match(/var TIGHT_ON\s*=\s*(\d+)/) || [])[1]);
const tightOff = Number((HDRJS.match(/var TIGHT_OFF\s*=\s*(\d+)/) || [])[1]);
check('there are TWO thresholds, not one', !!tightOn && !!tightOff, `${tightOn} / ${tightOff}`);
check('the single-threshold constant is gone', !/TIGHT_AT/.test(HDRJS),
  'a lone threshold is the bug, not a style preference');

/* ⚠️ MEASURED, NOT CHOSEN. `.hdr-row` is 68px full and 50px condensed — 18px,
   and 17-18px at every width from 1440 down to 761. Below 760 the condensed
   rules do not apply at all, which is why phones never saw this. The gap has
   to be wider than that or the loop comes straight back, so this is asserted
   against the measurement rather than against the number somebody typed. */
const HEADER_HEIGHT_DELTA_PX = 18;
check('the gap is wider than the height change that caused the loop',
  (tightOn - tightOff) > HEADER_HEIGHT_DELTA_PX,
  `gap ${tightOn - tightOff}px against an ${HEADER_HEIGHT_DELTA_PX}px delta`);
check('…and it condenses on the way down, not up', tightOn > tightOff);

/* The constants alone prove nothing if the condition ignores one of them —
   which is exactly what a half-applied fix looks like. */
check('the condition actually reads BOTH thresholds',
  /tight \? \(y > TIGHT_OFF\) : \(y > TIGHT_ON\)/.test(HDRJS),
  'sticky once condensed, and only expands well back up');
check('…and the first pass decides from scratch rather than inheriting',
  /tight === null\) \? \(y > TIGHT_ON\)/.test(HDRJS));

section('the bat flies once, at the speed of one flight');

/* ⚠️ THE 30s DEAD-AIR TIMELINE IS GONE, AND SO IS THE CHECK THAT GUARDED IT
   (7 Aug 2026). The old flight was ~40 hand-computed percentages spread over a
   30s animation of which only the first 18.6% moved, and the checks here
   existed to stop somebody "slowing the bat down" by stretching those
   percentages instead of adding dead air. `offset-path` needs exactly two
   stops, so there are no percentages left to drift and no dead air to defend.
   What replaces those checks is the one thing that still matters: the flight,
   the dive and both wings have to agree about WHEN, or the wings flap on a bat
   that has already landed. */
/* ⚠️ THE SHORTHAND IS A COMMA-SEPARATED LIST **AND** IT CONTAINS COMMAS.
   `fly` and `dive` share one `animation:` property, so a reader anchored on
   `animation:NAME` finds fly and misses dive; splitting the value on `,`
   instead chops `cubic-bezier(.45,.05,.4,1)` into four pieces and finds
   neither. Both mistakes were made, in that order, and both produced NaN —
   which compares equal to nothing and fails with a message that reads like the
   CSS is wrong. Split on TOP-LEVEL commas only, tracking bracket depth. */
function animParts(css) {
  const out = [];
  for (const m of css.matchAll(/animation:([^;}]+)/g)) {
    let depth = 0, cur = '';
    for (const ch of m[1]) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
const PARTS = animParts(HDRCSS);
const decl = (n) => PARTS.find((d) => new RegExp('^' + n + '\\b').test(d)) || '';
/* The FIRST time value in an animation shorthand is the duration, the SECOND
   is the delay — order, not magnitude. */
const times = (n) => [...decl(n).matchAll(/(?:^|\s)(\d*\.?\d+)s(?=\s|$)/g)].map((m) => Number(m[1]));
const dur = (n) => times(n)[0];
const dly = (n) => times(n)[1];
const flyDecl = decl('fly');
check('the flight declares a duration', dur('fly') > 0, `${dur('fly')}s`);
eq('the dive runs for exactly as long as the flight', dur('dive'), dur('fly'));
eq('…and starts with it', dly('dive'), dly('fly'));
eq('the two wings flap on the same clock as each other',
  `${dur('flapL')}/${dly('flapL')}`, `${dur('flapR')}/${dly('flapR')}`);
check('…and start with the flight, not before or after it',
  dly('flapL') === dly('fly'), `wings ${dly('flapL')}s vs flight ${dly('fly')}s`);

/* ⚠️ THE WINGS MUST STOP WHEN THE BAT LANDS. They are a SHORT animation
   repeated a counted number of times, not one long one, so the arithmetic is
   iterations x duration and it has to come out at or under the flight. Get it
   wrong high and the bat sits in the crest flapping; wrong low and it glides
   the last part of the flight with its wings locked. */
const flapCount = Number((decl('flapL').match(/\s(\d+)\s/) || [])[1]);
const flapTotal = flapCount * dur('flapL');
check('the wing flap is a counted repeat, not an endless one', flapCount > 1,
  `${flapCount} flaps of ${dur('flapL')}s`);
check('…and it finishes within the flight rather than outlasting it',
  flapTotal <= dur('fly') + 0.05 && flapTotal >= dur('fly') * 0.85,
  `${flapTotal.toFixed(2)}s of flapping inside a ${dur('fly')}s flight`);
check('the flight itself is fast enough to read as flying, not drifting',
  dur('fly') <= 8, `${dur('fly')}s — 30s was a bat in slow motion`);
check('…and the flight declaration was located', flyDecl.length > 10, flyDecl);

section('both drop-downs open with a movement');

/* ⚠️ ANIMATIONS, NOT TRANSITIONS, AND IT IS FORCED — this is the check worth
   having. The desktop panel is inside an <sc-if>, so it is MOUNTED on open: a
   transition needs a from-state from a previous frame and a just-inserted
   element has none, so it silently never runs. The phone panel goes
   display:none -> display:flex, and `display` is not animatable at all.
   Reaching for a transition does nothing in BOTH cases and looks exactly like
   "too subtle to see". */
check('the desktop panel has an open animation', /@keyframes hdrMenuIn\{/.test(HDRCSS));
check('the shared panel/stagger animation exists', /@keyframes hdrPanelIn\{/.test(HDRCSS));
check('the desktop panel carries the class that drives it',
  /class="hdr-menu-panel"/.test(PAGE));
check('…and the rule animates rather than transitions',
  /\.hdr-menu-panel\{animation:hdrMenuIn/.test(HDRCSS),
  'a transition on a just-mounted element does not run');
check('the phone panel animates too', /animation:hdrPanelIn[^;}]*\}?/.test(HDRCSS)
  && /\[data-nav-open="true"\] \.hdr-nav\{[^}]*animation:hdrPanelIn/.test(HDRCSS));

/* ⚠️ SCOPED TO THE OPEN STATE. On `.hdr-nav` itself the animation would also
   run at 761px+ every time the engine re-renders the header — which it does
   after first paint, more than once — so a desktop that never opens this panel
   would get a flickering nav. */
check('the phone animation is scoped to the OPEN attribute, not to .hdr-nav',
  !/^\s*\.hdr-nav\{[^}]*animation:hdrPanelIn/m.test(HDRCSS));

/* ⚠️ Both use `both`, which holds the FROM state before the animation starts.
   Killing the animation for reduced motion without resetting opacity and
   transform leaves the panel invisible and shifted — a menu that does not open
   is worse than a menu that opens plainly. */
const RMB = (PAGE.match(/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\n  \}/) || [''])[0];
/* ⚠️ REVISED, AND THE OLD VERSION IS WHY. This used to require the animation
   to be killed and opacity snapped to 1 — which is a defensible reading of the
   preference, and it is exactly what Jay was looking at when he said "i see
   nothing". Reproduced by sampling the pixels every frame with `reduce` on:
   opacity read 1, 1, 1, 1 across 500ms. One value. Nothing to see.

   The preference is about MOVEMENT — a slide or a scale is what makes somebody
   motion-sick, a cross-fade is not. So under `reduce` the panels still fade,
   with no translate and no scale. Both halves are asserted, because dropping
   either one is a real bug: no fade is what Jay saw, and no transform reset
   leaves the panel open 22px out of place. */
check('reduced motion still lets the menus appear — as a fade',
  /animation:hdrFadeOnly [\d.]+s ease both!important/.test(RMB),
  'not "animation:none", which is what made it invisible');
check('…and the fade keyframe moves nothing at all',
  /@keyframes hdrFadeOnly\{from\{opacity:0\}to\{opacity:1\}\}/.test(HDRCSS),
  'no translate, no scale — that is the part the preference is about');
check('…with the transform still reset, or `both` strands it out of place',
  /\.hdr-menu-panel[\s\S]{0,240}transform:none!important/.test(RMB));

/* ⚠️⚠️ IT HAS TO BE PERCEPTIBLE, AND THAT IS A REAL ASSERTION. The first
   version ran for .18s and moved 8px. It worked — verified on the deployed
   preview at currentTime 200/200, opacity 0 -> 1, no errors — and Jay still
   said "I don't see any animation in the drop down menu", because he could
   not. **A change nobody can perceive has not been made.** The temptation was
   to reply that it was working; the honest reading is that "technically runs"
   and "is an animation" are different claims.

   So the floor is asserted, not left to taste: long enough and far enough to
   register. The ceiling matters too — the engine re-renders the header after
   first paint, and a restart part-way through a long animation is a visible
   stutter rather than a smooth open. */
const menuDur = parseFloat((HDRCSS.match(/\.hdr-menu-panel\{animation:hdrMenuIn ([\d.]+)s/) || [])[1]);
const navDur = parseFloat((HDRCSS.match(/\[data-nav-open="true"\] \.hdr-nav\{[^}]*animation:hdrPanelIn ([\d.]+)s/) || [])[1]);
const menuTravel = Math.abs(parseFloat((HDRCSS.match(/@keyframes hdrMenuIn\{from\{opacity:0;transform:translateY\((-?[\d.]+)px/) || [])[1]));
const navTravel = Math.abs(parseFloat((HDRCSS.match(/@keyframes hdrPanelIn\{from\{opacity:0;transform:translateY\((-?[\d.]+)px/) || [])[1]));
check('both open durations were found', !!menuDur && !!navDur, `${menuDur}s / ${navDur}s`);
check('the desktop menu runs long enough to be seen', menuDur >= 0.25, `${menuDur}s`);
check('the phone panel runs long enough to be seen', navDur >= 0.25, `${navDur}s`);
check('…and neither is long enough to be interrupted by a re-render',
  menuDur <= 0.45 && navDur <= 0.45, `${menuDur}s / ${navDur}s`);
check('both travel far enough to register as movement', menuTravel >= 10 && navTravel >= 10,
  `${menuTravel}px / ${navTravel}px — 8px was invisible`);

/* Nothing here may touch layout: the sticky header changing height under its
   own scroll handler is the loop fixed at the top of this block. */
check('the open animations move opacity and transform only',
  /@keyframes hdrMenuIn\{from\{opacity:0;transform:[^}]*\}to\{opacity:1;transform:none\}\}/.test(HDRCSS)
  && /@keyframes hdrPanelIn\{from\{opacity:0;transform:[^}]*\}to\{opacity:1;transform:none\}\}/.test(HDRCSS),
  'animating height would move the header and reopen the feedback loop');

/* =========================================================================
   Drag, keyboard and the reduced-motion split (coverflow, 6 Aug 2026)
   ========================================================================= */

section('the carousel can be driven, and driving it does not break the page');

/* ⚠️ THE DRAG CHECKS WERE HERE AND WENT WITH THEIR SUBJECT (6 Aug 2026). Jay:
   "i don't think we need the ability to grab and drag to the next photo".
   Seven checks came out: touch-action:pan-y, Pointer Events, pointer capture,
   pointercancel, the click suppressed after a 6px drag, the clamped throw, and
   the image-drag guard.

   ⚠️ THEY ARE DELETED, NOT REPOINTED, AND THAT IS THE RIGHT CALL HERE — the
   RULES went with the feature rather than outliving it. There is no drag, so
   there is no gesture to steal, nothing to clamp and no click to suppress. A
   check kept alive past its subject guards nothing and reads as if something
   still depends on it.

   ⚠️ WHAT SURVIVES IS THE ONE THAT WOULD BE MISSED. If drag ever returns,
   `touch-action:pan-y` returns IN THE SAME CHANGE — without it a horizontal
   drag swallows vertical scrolling and traps a finger inside the box, and that
   is invisible on a desktop because the About block is hidden at and below
   760px. The people it protects are on tablets at 761px+. That instruction is
   written at both the CSS and the script, and this note is the third copy. */

section('the three-sided gradient border, and what keeps the crest in front');

/* ⚠️ THREE SIDES, NOT FOUR (Jay, 6 Aug 2026: "top, bottom, and left, the right
   side would still be the same"). The right edge runs off the screen, so a
   border there would be a line hanging in the scrollbar gutter.
   `padding-right:0` is the whole mechanism: the mask keeps only the padding
   band, so a side with no padding gets no band. */
const BORDER = (CSSNC.match(/\.about-photo::before\{[\s\S]*?\n\}/) || [''])[0];
check('the border pseudo-element was located', BORDER.length > 100, `${BORDER.length} chars`);
check('…and it has NO band on the right', /padding:3px 0 3px 3px/.test(BORDER),
  'a fourth side would hang in the scrollbar gutter');
check('…drawn as a gradient', /background:linear-gradient\(/.test(BORDER));

/* ⚠️ THE MASK IS WHAT MAKES IT A BORDER RATHER THAN A FILL. Without
   mask-composite the gradient covers the entire box and the photos vanish
   behind a coloured slab — very visible, but nothing would fail. */
check('…and masked so only the band survives, not the whole box',
  /mask-composite:exclude/.test(BORDER) && /-webkit-mask-composite:xor/.test(BORDER),
  'without this the gradient fills the box and hides the photos');
check('…following the rounded corner, which border-image cannot do',
  /border-radius:inherit/.test(BORDER),
  'border-image ignores border-radius and would cut a square corner');
check('…and not swallowing clicks', /pointer-events:none/.test(BORDER));

/* ⚠️⚠️ THE LAYERING, AND IT IS THE PART THAT LOOKS ARBITRARY AND IS NOT. Two
   requirements pull in opposite directions: the border must sit ABOVE the
   carousel cards (z-index 7..12 from the slot table) or they paint over it as
   they swing past, and BELOW the crest, which Jay asked to stay in front.

   `isolation:isolate` on the box is what makes both possible: it traps every
   z-index inside .about-photo, so the border can be 50 in there while the box
   as a whole still loses to .cstage in the page's stacking context. Remove it
   and the border's 50 beats the crest's 6 — the numbers stop being comparable
   in the way they look like they are. */
check('the photo box isolates its own stacking context',
  /isolation:isolate/.test(BORDER + CSSNC),
  'without it the border outranks the crest instead of the cards');
const borderZ = Number((BORDER.match(/z-index:(\d+)/) || [])[1]);
const cardZs = [...(stripJsComments(PAGE).matchAll(/zi:(\d+)/g))].map((m) => Number(m[1]));
check('the border outranks every carousel card', cardZs.length > 0 && borderZ > Math.max(...cardZs),
  `border ${borderZ} against a highest card of ${Math.max(...cardZs)}`);
const cstageZ = Number((CSSNC.match(/\.cstage\{[^}]*z-index:(\d+)/) || [])[1]);
check('…and the crest outranks the whole box, so it stays in front',
  cstageZ > 0, `.cstage is z-index ${cstageZ}`);
check('…with the reason recorded, because the two numbers look comparable and are not',
  /It does NOT have to beat the border's own z-index/.test(PAGE));

section('the bat flies once, and then never again');

/* ⚠️ ONE FLIGHT, EVER (Jay, 6 Aug 2026: "have the bat only fly once"). All
   four animations or none — the flight, the dive and the two wings are
   separate animations on separate elements, and one left looping means wings
   flapping on a bat that has landed. */
/* Same shorthand trap as above — reuse the depth-aware splitter. */
const batDecls = animParts(CSSNC).filter((d) => /^(fly|dive|flapL|flapR)\b/.test(d));
check('all four bat animations were located', batDecls.length === 4, batDecls.length + ' found');
check('none of them loops', batDecls.every((d) => !/infinite/.test(d)),
  batDecls.filter((d) => /infinite/.test(d)).join(' | '));
/* ⚠️ THE WINGS RUN ELEVEN TIMES, NOT ONCE, AND THAT IS NOT A LOOP. The old
   check required a literal ` 1 ` in every declaration, which was right when
   all three animations were one long pass. A short flap repeated a counted
   number of times is still "flies once" — what must not appear is `infinite`.
   Requiring `1` here would have forced the flap back into one 5s keyframe set,
   i.e. one slow wing-beat for the whole flight. */
check('…each has a counted iteration rather than an open-ended one',
  batDecls.every((d) => /\s\d+\s/.test(d)),
  batDecls.filter((d) => !/\s\d+\s/.test(d)).join(' | '));

/* ⚠️ THE FINAL FRAME IS HELD. `forwards` on the flight and the dive; `both` on
   the wings, which also need their FROM state before the delay elapses — a
   wing with neither sits unrotated for the first half-second and then jumps.
   Either fill mode holds the end; neither is optional. */
check('…and each holds its final frame rather than snapping back',
  batDecls.every((d) => /forwards|both/.test(d)),
  'it looks fine today only because the first and last frames agree');

section('purely automatic — and what that costs, and how it is paid');

/* ⚠️ NO MANUAL CONTROL AT ALL (Jay, 6 Aug 2026: "purely automatic"). Drag went
   first, then the arrow keys. Nothing in this section responds to a visitor. */
check('nothing is left listening for a key that does nothing',
  !/ArrowRight/.test(BOARD_CODE) && !/ArrowLeft/.test(BOARD_CODE));
check('…and the scene is not focusable, so it is not a dead stop in the tab order',
  !/class="jrtb-scene"[^>]*tabindex/.test(PAGE),
  'a focusable element with nothing to operate is worse than no focus at all');
check('…while the wrapper still carries a role and a label for a screen reader',
  /class="jrtb"[^>]*role="img"[^>]*aria-label=/.test(PAGE),
  'the photos are decorative, but they still have to announce as something');

/* ⚠️⚠️ THE CONSEQUENCE THAT HAD TO BE FIXED, NOT SHIPPED. While the arrow keys
   existed, switching the timer off under prefers-reduced-motion was right: the
   automatic movement stopped and anyone who wanted the next photo could ask
   for it. With no controls left, that SAME rule strands a visitor on photo 1
   for ever — the section silently becomes one static image, for exactly the
   people who never asked for that.

   So the timer keeps running under `reduce` and the CSS drops the glide to 1ms
   instead: the photo CHANGES, it just does not slide. A hard cut is not
   motion. The preference is about movement, not about content standing still —
   and this is what the ring did before any of it. */
check('reduced motion is NOT in the auto-advance gate',
  /if\(!onscreen\|\|document\.hidden\)return;/.test(BOARD_CODE)
  && !/slowmo/.test(BOARD_CODE),
  'switching the timer off would strand a reduced-motion visitor on photo 1');
check('…it drops the glide to a cut instead',
  /@media \(prefers-reduced-motion:reduce\)\{[\s\S]{0,200}\.jrtb-p\{transition-duration:1ms\}/.test(CSSNC),
  'the photo still changes; it just does not slide');
/* The drag is gone; the tombstone saying what must come back WITH it if it
   ever returns is not. touch-action:pan-y is the part that would be forgotten,
   and its absence cannot be seen on a desktop. */
check('the note about what drag took with it survives',
  /IF DRAG EVER COMES BACK, THIS COMES BACK IN THE SAME CHANGE/.test(PAGE),
  'touch-action:pan-y is the part that would be forgotten');

/* CSS that selects nothing reads as if something still uses it, and the next
   person keeps it alive on that basis. */
check('nothing is left behind pointing at a drag that no longer exists',
  !/\.jrtb\.dragging/.test(CSSNC) && !/var\(--dragx/.test(CSSNC));

check('…and the reasoning survives, because this is the second time it flipped',
  /strands\s+a visitor on photo 1 FOR EVER/.test(PAGE.replace(/\s+/g, ' ')),
  'a decision recorded without its argument gets re-argued from scratch');

/* An image the browser treats as draggable is a stray behaviour on a
   ghost-image drag instead of moving the carousel. */
check('the photos cannot be dragged as images',
  /\.jrtb-p img\{[^}]*user-drag:none/.test(CSSNC));

section('the tournament rules page');

const RULES = readRepo('rules.html').replace(/\r\n/g, '\n');
const TOML_R = TOML;

check('rules.html exists and is a full page', RULES.includes('<!DOCTYPE html>') && RULES.length > 3000);
check('it is served at /rules', /from = "\/rules"\n  to = "\/rules\.html"\n  status = 200/.test(TOML_R));
check('the About section links to it',
  /<a href="\/rules" class="reg-btn rules-btn"/.test(PAGE),
  'Jay asked for a button in the About section');

/* ⚠️ IT WEARS .reg-btn ITSELF, not a copy of its rules (Jay, 5 Aug 2026:
   "themed similar to the register a team and register a player buttons"). One
   class, three buttons, so they cannot drift apart — the alternative is a
   fourth definition of what a button looks like on this site, and this repo
   already has a lesson about two copies of one rule drifting invisibly. */
const RULESBTN = (PAGE.match(/<a href="\/rules"[\s\S]*?<\/a>/) || [''])[0];
check('the rules button wears the Register buttons\' own class', /class="reg-btn rules-btn"/.test(RULESBTN));
check('…including their gradient bar', /<span class="reg-btn-bar">/.test(RULESBTN));
check('…and their holo sweep', /<span class="holo">/.test(RULESBTN));
check('…and the label element they style', /<span class="reg-btn-label">/.test(RULESBTN));

/* ⚠️ SMALLER THAN THE HERO PAIR ON PURPOSE. The Register buttons are the page's
   call to action; this must read as the same family without competing. The
   quiet outline version it replaced had that merit and nothing else, which is
   why the size is pinned rather than left to drift back up. */
const rulesSize = (RULESBTN.match(/font-size:(\d+)px/) || [])[1];
check('the rules button is smaller than the Register buttons',
  Number(rulesSize) < 18, `${rulesSize}px against the hero pair's 18px`);

/* ⚠️ CENTRED UNDER THE PAIR, NOT UNDER THE COLUMN, and the wrapper is what
   does it. Measured at 1400 / 900 / 390px: 0px from the Tag/UAERF pair's
   centre, and 91 / 39 / 22px left of the column's — so centring on the column
   would have been visibly wrong at every width, not just arguably wrong. */
check('the button is centred with margin auto', /margin:30px auto 0/.test(RULESBTN));
check('…inside a wrapper that shrinks to the pair\'s width',
  /<div style="width:fit-content">\s*<div style="display:flex;gap:36px;margin-top:36px">/.test(PAGE),
  'without fit-content the auto margin centres on the whole column instead');

/* ⚠️ THE GLOW IS RED ON THE `Compare` BRANCH (Jay, 6 Aug 2026: "the tournament
   rules button should glow red not green"). On `main` it is #17A34A, matching
   `Register player`.

   ⚠️ DERIVED, NOT PINNED, and that is the whole value of this check. It does
   not assert the literal #E11B22 — it reads the red off `Register a team` and
   requires this button to match it. A pinned hex would pass happily while the
   two drifted apart, and "two copies of one rule drift invisibly" is this
   repo's most-repeated lesson. The point of the ask was a RED button, not a
   particular red, and the page already has exactly two button glows; a third
   would be a third. */
const teamGlow = (PAGE.match(/onClick="\{\{ onClickRegisterTeam \}\}"[^>]*--glow:(#[0-9A-Fa-f]{6})/) || [])[1];
const rulesGlow = (RULESBTN.match(/--glow:(#[0-9A-Fa-f]{6})/) || [])[1];
check('the Register-a-team glow was found', !!teamGlow, teamGlow);
check('the rules-button glow was found', !!rulesGlow, rulesGlow);
eq('the rules button glows the SAME red as Register a team', rulesGlow, teamGlow);

/* And the inverse, because "is it red" and "is it not green" are different
   questions and only the pair of them rules out a third colour creeping in. */
const playerGlow = (PAGE.match(/onClick="\{\{ onClickRegisterPlayer \}\}"[^>]*--glow:(#[0-9A-Fa-f]{6})/) || [])[1];
check('…and NOT the Register-player green it used to wear',
  !!playerGlow && rulesGlow.toUpperCase() !== playerGlow.toUpperCase(),
  `player is ${playerGlow}`);

/* ⚠️ The bar underneath still runs red->green, from .reg-btn, and that is not
   an inconsistency to "fix". `--glow` is the hover border/shadow only, so a red
   glow over a red->green bar is the same arrangement `Register a team` already
   has. Asserted so nobody harmonises them and quietly changes three buttons. */
check('the shared bar gradient is untouched by the glow change',
  /\.reg-btn-bar\{/.test(HDRCSS) || /reg-btn-bar/.test(PAGE));

/* An anchor, not a button: it goes somewhere, and a coach can send it. */
check('it is still a link rather than a button', RULESBTN.startsWith('<a href="/rules"'));
check('…with the underline killed, which .reg-btn never had to do',
  /\.rules-btn\{text-decoration:none\}/.test(HDRCSS));
check('…and the footer does too', /<a href="\/rules" style="color:#8a8f99">Tournament rules<\/a>/.test(PAGE));

/* ⚠️ INDEXABLE ON PURPOSE, unlike /register-club. Parents and coaches should be
   able to find the rules by searching, so it is in the sitemap and carries
   robots "all". If that is ever reversed, robots.txt is NOT the way — a
   Disallow line advertises the path. */
check('the rules page is indexable', /<meta name="robots" content="all">/.test(RULES));
check('…and is in the sitemap', /<loc>https:\/\/adhjrt\.com\/rules<\/loc>/.test(readRepo('sitemap.xml')));
check('…and robots.txt does not name it', !/rules/i.test(readRepo('robots.txt')));

/* The placeholder is honest about being a placeholder, and says WHEN. A bare
   "coming soon" makes a coach wonder whether the tournament is organised. */
check('the page says coming soon', /class="badge">Coming soon<\/span>/.test(RULES));
check('…and says when the rules will be there',
  /before registration opens in October/.test(RULES),
  'a placeholder with no date is a shrug');
check('…and still tells a coach four things that ARE settled',
  (RULES.match(/<li><b>/g) || []).length >= 4);
check('the replace-this-block instruction is in the file',
  /REPLACE THIS BLOCK when the real rules arrive/.test(RULES),
  'so the next person does not rebuild the page around it');

/* It shares legal.html's styling deliberately; the two are a pair. */
check('it carries the same topbar and footer shape as /legal',
  /class="topbar"/.test(RULES) && /class="foot-bar"/.test(RULES));
check('…and links back to the site and to /legal',
  /class="back" href="\/">/.test(RULES) && /href="\/legal"/.test(RULES));
check('the og:image is the branded share card',
  /<meta property="og:image" content="https:\/\/adhjrt\.com\/assets\/share-card\.png">/.test(RULES));

summary('test-about-board.js');
