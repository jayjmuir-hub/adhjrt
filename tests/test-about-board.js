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
check('…and it is the ring script, not some other block',
  /jrtb-ring/.test(BOARD) && /PHOTOS/.test(BOARD));

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
check('…and it gates the timer, so an off-screen ring stops turning',
  /if\(!onscreen\|\|document\.hidden\)return;/.test(BOARD_CODE));
check('…and an IntersectionObserver sets it',
  /onscreen=es\[0\]\.isIntersecting/.test(BOARD_CODE));

/* ------------------------------------------------------------------------ */
section('geometry — the radius is trigonometry, not taste');

const panels = Number((BOARD_CODE.match(/var PANELS\s*=\s*(\d+)/) || [])[1]);
const photos = Number((BOARD_CODE.match(/var PHOTOS\s*=\s*(\d+)/) || [])[1]);
const turnMs = Number((BOARD_CODE.match(/var TURN\s*=\s*(\d+)/) || [])[1]);

eq('the ring has 8 panels', panels, 8);
check('there are more photos than panels (they cycle through)', photos > panels,
  `${photos} photos, ${panels} panels`);

/* --r is 1 / (2 * tan(180deg / PANELS)). If PANELS ever changes and this
   number does not, the panels overlap or gap and nothing errors. */
const cssR = Number((PAGE.match(/--r:\s*calc\(var\(--pw\)\s*\*\s*([0-9.]+)\)/) || [])[1]);
const wantR = 1 / (2 * Math.tan(Math.PI / panels));
check('the CSS ring radius agrees with PANELS',
  Math.abs(cssR - wantR) < 0.0001,
  `CSS has ${cssR}, PANELS=${panels} needs ${wantR.toFixed(5)}`);

/* The glide length is written twice — once in CSS as --turn, once in the script
   as TURN, which uses it to know when the step has finished. Drift means the
   script re-enters mid-animation. */
const cssTurn = Number((PAGE.match(/--turn:\s*(\d+)ms/) || [])[1]);
eq('the CSS --turn and the script TURN are the same number', cssTurn, turnMs);

/* ------------------------------------------------------------------------ */
section('the sizes attribute — load-bearing, and easy to lose');

/* Without `sizes` the browser assumes the image fills the viewport and always
   takes the 960px file, silently doubling the cost of the section. It appears
   THREE times — twice in the hard-coded fail-safe panel's two <source>s, once
   in the script that builds the other seven — and all three must agree or the
   first panel and the rest are fetched at different sizes. */
const SIZES = '(min-width:1200px) 394px, calc(37vw - 50px)';
const sizesCount = PAGE.split(SIZES).length - 1;
check('the sizes string appears three times, identically', sizesCount === 3,
  `found ${sizesCount}`);
check('…including in the script that builds the other panels',
  BOARD_CODE.includes(SIZES));

/* ⚠️ AND THE REAL INVARIANT, rather than three copies of a pinned literal:
   `sizes` must AGREE WITH --pw. The literal above catches an edit that touches
   one of the three copies; these two catch the more likely mistake, which is
   re-proportioning the section, updating the CSS, and leaving `sizes` behind.
   That failure costs every visitor a bigger file than they need and reports
   nothing anywhere. Both numbers are read out of the page rather than written
   down here, so this check survives the next resize instead of having to be
   edited by whoever does it. */
const pwClamp = PAGE.match(/--pw:\s*clamp\(\s*\d+px,\s*([0-9.]+)vw - ([0-9.]+)px,\s*(\d+)px\s*\)/);
check('the --pw clamp was located', !!pwClamp);
if (pwClamp) {
  const [, pwVw, pwSub, pwMax] = pwClamp;
  const sizesMax = (SIZES.match(/\(min-width:1200px\) (\d+)px/) || [])[1];
  const sizesCalc = SIZES.match(/calc\(([0-9.]+)vw - ([0-9.]+)px\)/);
  eq('sizes\' capped width is --pw\'s clamp maximum', sizesMax, pwMax);
  check('…and the scaling half matches too',
    !!sizesCalc && sizesCalc[1] === pwVw && sizesCalc[2] === pwSub,
    `sizes says ${sizesCalc && sizesCalc[0]}, --pw says ${pwVw}vw - ${pwSub}px`);

  /* And the capped width has to be 74% of the column the grid actually gives
     it, or the ring is cramped (too wide) or adrift in empty space (too
     narrow). Derived from the section's own grid, so changing one and not the
     other fails here rather than on Jay's screen. */
  /* [0-9.]+ , not \d+ : a ratio like 1.5fr is exactly the edit this is here to
     catch, and a regex that cannot match it fails the "grid was located" check
     instead of the one that has something to say. The fault run reported that
     as "failed, but not on the named check" rather than passing it, which is
     the entire reason that distinction exists. */
  const grid = PAGE.match(/id="about"[^>]*grid-template-columns:([0-9.]+)fr ([0-9.]+)fr;gap:(\d+)px/);
  check('the About grid was located', !!grid, 'the ratio and gap drive the panel width');
  if (grid) {
    const a = Number(grid[1]), b = Number(grid[2]), gap = Number(grid[3]);
    const share = b / (a + b);                       // the photo column's share
    const column = (1200 - 64 - gap) * share;        // 1200 cap, 32px padding each side
    const want = Math.round(column * 0.74);
    check('the panel is ~74% of the photo column at full width',
      Math.abs(Number(pwMax) - want) <= 8,
      `--pw max is ${pwMax}px; a ${Math.round(column)}px column wants about ${want}px`);
  }
}

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
  /\.about-photo\{--pw:clamp\(170px, 74vw - 30px, 520px\)/.test(CSS_760_FOR_PW),
  'the .about-photo phone rule must sit at the same breakpoint as the hide');

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
const ringRule = (RING_CSS.match(/\.jrtb-ring\{[\s\S]*?\}/) || [''])[0];
check('the .jrtb-ring rule was located', ringRule.length > 40);
check('no overflow / opacity / filter on .jrtb-ring',
  !/(^|[;{\s])(overflow|opacity|filter)\s*:/.test(ringRule), ringRule.slice(0, 160));
check('…and the clipping is on .about-photo instead',
  /\.about-photo\{[^}]*overflow:hidden/.test(PAGE));

/* Chrome treats rotateY past 180deg as back-facing, so with angles of
   225/270/315 the whole left-hand side of the ring never painted. */
check('panel angles are normalised to -180..+180',
  /if\s*\(a\s*>\s*180\)\s*a\s*-=\s*360;/.test(BOARD_CODE));

/* ------------------------------------------------------------------------ */
section('the two boot bugs that made this work locally and not deployed');

/* __built set on ENTRY left the host flagged as built when it was not, and the
   re-scanning loop skipped it for ever. It has to be set only once the panels
   are actually seated. */
const flagAt = BOARD_CODE.indexOf('host.__built=1');
const seatAt = BOARD_CODE.indexOf('panels.forEach');
check('build() flags success only AFTER seating the panels',
  flagAt > 0 && seatAt > 0 && flagAt > seatAt,
  `flag at ${flagAt}, seating at ${seatAt}`);
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

/* ⚠️ REPOINTED, NOT DELETED (5 Aug 2026, evening). This used to assert that the
   About badge was `crest.png` and not the bat-holed `crest-shield.png`. Jay
   removed the badge, so that check's SUBJECT is gone — but its RULE is not, and
   a check whose subject dies must be repointed if the rule is still alive.

   The rule splits in two, and both halves are worth having:
     - the crest is ABSENT from this section, deliberately, and stays absent;
     - `crest-shield.png` is never a live image ANYWHERE, which is a page-wide
       rule that never depended on this section in the first place. */
check('the About section carries no crest image',
  !/<img[^>]+assets\/crest[^>]*>/.test(ABOUT),
  'removed at Jay\'s request 5 Aug 2026 — see the tombstone in the markup');
check('…and the dead .m-crestrow rule went with it',
  !/\.m-crestrow\s*\{/.test(stripCssComments(PAGE)),
  'CSS that selects nothing reads as if something still uses it');
check('the tombstone explaining the removal is still there',
  /TOMBSTONE: THE CREST WAS HERE/.test(PAGE),
  'a deletion with no trace is an invitation to re-add it');

/* The crest is still in the header and the footer — the page is not short of
   one, and asserting an absence without asserting the presence it is measured
   against is how a whole logo quietly disappears. */
check('the crest is still on the page elsewhere',
  (PAGE_CODE.match(/assets\/crest\.png/g) || []).length >= 2,
  'header and footer');

/* assets/crest-shield.png is the crest with a BAT-SHAPED HOLE in it. It exists
   only as the backdrop the mothballed animation's bat flew out of, and it went
   live as the About badge once already, sitting there with a piece missing
   until Jay spotted it. Comments are stripped: the mothball note names the file
   on purpose and must stay legal to write. */
check('crest-shield.png is not referenced by any live element',
  !/crest-shield\.png/.test(PAGE_CODE),
  'if the flying bat is ever restored, swap the badge back IN THE SAME CHANGE');

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
check('…and the same holoShift drift', /\.hdr-nav a:hover::before\{opacity:\.85;animation:holoShift/.test(HDRCSS));

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
section('the tournament rules page');

const RULES = readRepo('rules.html').replace(/\r\n/g, '\n');
const TOML_R = TOML;

check('rules.html exists and is a full page', RULES.includes('<!DOCTYPE html>') && RULES.length > 3000);
check('it is served at /rules', /from = "\/rules"\n  to = "\/rules\.html"\n  status = 200/.test(TOML_R));
check('the About section links to it',
  /<a href="\/rules" class="rules-btn"/.test(PAGE),
  'Jay asked for a button in the About section');
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
