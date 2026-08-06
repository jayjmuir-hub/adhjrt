/* tests/test-design-polish.js
   ------------------------------------------------------------------------
   Pins the design-audit fixes of Aug 2026 (branch `potential`): the broken
   things batch A repaired, and the states/feedback rules batches B and C
   added. Everything here was wrong on the live site once — each check names
   the failure it stops coming back.

   House rules apply: absence checks strip comments first (a comment about
   confirm() is not a confirm() call), and every assertion in this file is
   proven against an injected fault in _prove-registration.js.
*/

const fs = require('fs');
const path = require('path');
const { readRepo, repoRoot, section, check, summary } = require('./_lib');

const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

const ALL_PAGES = ['Quins JRT.dc.html', 'Scores & Standings.dc.html', 'Organizer.dc.html',
  'Manager.dc.html', 'Signin.dc.html', 'app.html', 'legal.html', '404.html'];
const LIGHT_PAGES = ['Organizer.dc.html', 'Manager.dc.html', 'Signin.dc.html'];

async function main() {

section('Home-screen icons point at a file that exists');
{
  for (const f of ALL_PAGES) {
    const src = readRepo(f);
    check(`${f}: apple-touch-icon is /assets/apple-touch-icon.png, not the folder that never existed`,
      src.includes('<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">')
      && !src.includes('/assets/icons/'));
  }
  check('the icon file itself is in the repo',
    fs.existsSync(path.join(repoRoot(), 'assets', 'apple-touch-icon.png')));
}

section('The light back office really is light — including the native pickers');
{
  for (const f of LIGHT_PAGES) {
    const src = stripJs(stripHtml(readRepo(f)));
    check(`${f}: no date/time input still carries color-scheme:dark`,
      !/color-scheme:dark/.test(src),
      (src.match(/.{0,60}color-scheme:dark.{0,30}/) || [])[0]);
  }
  const org = readRepo('Organizer.dc.html');
  check('the Organizer confirm modal is white-on-red like every other red button',
    /onClick="\{\{ onModalConfirm \}\}" style="background:#E11B22;border:none;color:#fff;/.test(org));
}

section('/scores works on a phone');
{
  const src = readRepo('Scores & Standings.dc.html');
  check('the pool table scrolls sideways instead of amputating the points columns',
    /overflow-x:auto;overflow-y:hidden;border:1px solid rgba\(255,255,255,0\.1\);border-radius:14px/.test(src)
    && /min-width:640px/.test(src));
  check('the awards grid wraps on narrow screens instead of forcing four rigid columns',
    /grid-template-columns:repeat\(auto-fit,minmax\(170px,1fr\)\)/.test(src)
    && !/grid-template-columns:repeat\(4,1fr\)/.test(src));
  check('tapping a pill clears the previous group\'s table in the same setState',
    /setState\(\{ selectedAgeId: a\.id, standings: null \}/.test(src));
}

section('The match-day app survives match-day conditions');
{
  const raw = readRepo('app.html');
  const src = stripJs(stripHtml(raw));
  check('the bottom sheet has the dvh cap so iOS Safari cannot hide its Close button',
    /max-height:92vh;max-height:92dvh/.test(raw));
  check('no native confirm() dialogs remain in the app flow',
    !/\bconfirm\(/.test(src.replace(/askInSheet/g, '')),
    (src.match(/.{0,60}\bconfirm\(.{0,40}/) || [])[0]);
  check('a failed browse fetch sets loadError instead of leaving "Loading…" forever',
    /catch \(e\) \{\s*if \(S\.browseId !== agId\) return;\s*S\.loadError = true;/.test(raw));
  check('the retry card exists and retries through the existing pill wiring',
    /function loadFail\(\)/.test(raw) && /data-age="\$\{esc\(S\.browseId \|\| ''\)\}"/.test(raw));
}

section('/signin plays nicely with password managers');
{
  const src = readRepo('Signin.dc.html');
  check('the username field is announced to password managers',
    /name="username" autocomplete="username"/.test(src));
  check('the password field is announced too',
    /name="password" autocomplete="current-password"/.test(src));
  check('a failed Google sign-in shows ONE error, not the same sentence twice',
    !/loginError: res\.error \|\| 'Could not sign in with Google\.'/.test(stripJs(src)));
}

section('Interaction feedback rules are present on every page');
{
  for (const f of ['Quins JRT.dc.html', 'Scores & Standings.dc.html', ...LIGHT_PAGES, 'app.html']) {
    const src = readRepo(f);
    check(`${f}: keyboard focus is visible (:focus-visible rule)`, /:focus-visible\{outline:2px solid /.test(src));
  }
  for (const f of ['Quins JRT.dc.html', 'Scores & Standings.dc.html', ...LIGHT_PAGES]) {
    const src = readRepo(f);
    check(`${f}: disabled buttons look disabled`, /button:disabled\{opacity:\.45;cursor:not-allowed\}/.test(src));
  }
  check('/scores lines its score columns up (tabular figures on the body)',
    /font-variant-numeric:tabular-nums/.test(readRepo('Scores & Standings.dc.html')));
}

section('Homepage: the audit\'s small stuff stays fixed');
{
  const src = readRepo('Quins JRT.dc.html');
  check('"Open in maps" goes to Zayed Sports City, not the Google Maps homepage',
    /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Zayed\+Sports\+City/.test(src)
    && !/href="https:\/\/maps\.google\.com"/.test(src));
  check('anchor jumps clear the sticky header (scroll-margin-top)',
    /section\[id\]\{scroll-margin-top:80px\}/.test(src));
  check('one light green tint, not three ad-hoc ones',
    !/#22c55e|#2fbf5f/i.test(src));
  check('the age-card band labels are readable, not 7.5px',
    /\.fmt-grp-band\{font-size:10px/.test(src));
}

section('Sharing and dead ends');
{
  /* The full tag, not just the URL — a bare .includes(url) also matched the
     twitter:image tag, so a fault swapping og:image alone passed. The fault
     run caught it; that run exists for exactly this. */
  for (const f of ['Quins JRT.dc.html', 'Scores & Standings.dc.html', 'legal.html']) {
    check(`${f}: og:image is the rendered share card, not the bare square crest`,
      readRepo(f).includes('<meta property="og:image" content="https://adhjrt.com/assets/share-card.png">'));
  }
  for (const f of ['Quins JRT.dc.html', 'Scores & Standings.dc.html']) {
    check(`${f}: twitter:image matches`,
      readRepo(f).includes('<meta name="twitter:image" content="https://adhjrt.com/assets/share-card.png">'));
  }
  /* NOTE for _prove-registration.js maintainers: share-card.png rides through
     the temp copy as text-normalised bytes — only its EXISTENCE is asserted,
     never its content. */
  check('the share card asset exists',
    fs.existsSync(path.join(repoRoot(), 'assets', 'share-card.png')));
  const nf = readRepo('404.html');
  check('the 404 page is branded dark and links home',
    /background:#0C0C0E/.test(nf) && /href="\/"/.test(nf));
}

section('Organizer: order and overflow');
{
  const src = readRepo('Organizer.dc.html');
  check('the age-group filter lists groups in real age order, not alphabetical',
    /\.sort\(\(a, b\) => \(AGE_GROUP_ORDER\[a\] \?\? 999\) - \(AGE_GROUP_ORDER\[b\] \?\? 999\)/.test(src));
  check('the six-tab bar wraps instead of dragging the page into horizontal scroll',
    /border-radius:12px;padding:5px;width:fit-content;flex-wrap:wrap;max-width:100%/.test(src));
}

/* ⚠️ THE WORDMARK IS THE CLUB'S NAME, AND IT HAD NO COVERAGE AT ALL.
   Jay, 3 Aug 2026: "lets change AD Harlequins at the top left to Abu Dhabi
   Harlequins". It appeared in FOUR places — the homepage header and footer,
   and legal.html's topbar and footer — and nothing asserted any of them, so
   three of the four could have been missed and no test would have said a
   word. All four moved together; a half-renamed brand reads as a bug.

   ⚠️ NOT to be confused with `teamLabel()`'s deliberate "Abu Dhabi …" → "AD …"
   shortening in scores-data.js. That one is for TEAM names in standings tables
   where the column is narrow, it is documented and tested there, and it must
   NOT be dragged into line with this. Two different things that look the same
   in a grep. */
section('The club wordmark says the club\'s name');
{
  const home = readRepo('Quins JRT.dc.html');
  const legal = readRepo('legal.html');
  for (const [name, src] of [['Quins JRT.dc.html', home], ['legal.html', legal]]) {
    /* Comments stripped BOTH ways: the 900px hide rule's comment quotes the
       old wordmark by name to explain why the number moved, and a comment
       about a wordmark is not a wordmark. House rule, hit immediately. */
    const body = stripJs(stripHtml(src));
    check(`${name}: the wordmark reads ABU DHABI HARLEQUINS`, body.includes('ABU DHABI HARLEQUINS'));
    check(`${name}: no shortened AD HARLEQUINS wordmark is left behind`,
      !body.includes('AD HARLEQUINS'));
  }
  /* Both pages carry it twice — header and footer. Counted, so renaming one
     and forgetting the other fails here rather than on Jay's screen. */
  const count = (s) => (stripJs(stripHtml(s)).match(/ABU DHABI HARLEQUINS/g) || []).length;
  check('the homepage carries it in both the header and the footer', count(home) === 2);
  check('legal.html carries it in both the topbar and the footer', count(legal) === 2);

  /* ⚠️ Seven characters became twenty. Without `white-space:nowrap` the longer
     wordmark can break across two lines inside a STICKY header — and the
     header's whole layout budget is one line. The 900px partner-mark hide in
     test-sponsors.js is the other half of this; both were measured together. */
  /* ⚠️ REPOINTED 5 Aug 2026 (evening). This anchored on `<span style=` with the
     style attribute FIRST, and the header wordmark gained a class in front of it
     when the bar learned to condense — so the regex matched nothing and the
     check failed on an undamaged copy, taking the whole suite's baseline with
     it. The RULE is unchanged and still load-bearing: a wrapped wordmark inside
     a sticky header is what the 900px measurement was about. It is anchored on
     the span's CONTENT now, which is what it was always really about, rather
     than on the order of its attributes. */
  const wmSpan = (home.match(/<span [^>]*ABU DHABI HARLEQUINS<\/span>/) || [])[0]
    || (home.match(/<span[^>]*>ABU DHABI HARLEQUINS<\/span>/) || [])[0];
  check('the header wordmark span was located', !!wmSpan,
    'if this fails the check below is asserting nothing');
  check('the header wordmark cannot wrap to a second line', !!wmSpan && /white-space:nowrap/.test(wmSpan));
}

/* ------------------------------------------------------------------------
   ⚠️ THE POINTER GATE, SWEPT ACROSS EVERY PAGE — 6 Aug 2026.

   A touch device has no pointer to move away, so it applies :hover on tap and
   KEEPS IT APPLIED until you touch something else. `2e57420` and `c3ea255`
   fixed that on the homepage after Jay reported header buttons shimmering for
   ever, and `c3ea255` added a sweep so the next component to grow a hover
   effect would be caught rather than shipped.

   ⚠️ THAT SWEEP READS THE HOMEPAGE AND NOTHING ELSE. It lives in
   test-about-board.js as `stripCssComments(PAGE)` where PAGE is
   'Quins JRT.dc.html'. A site-wide rule was being enforced on one page in ten.

   ⚠️ THIS FIXES NO LIVE BUG, and that is worth writing down rather than hiding.
   Measured at 1c26612: nine hover rules in the whole repo carry
   transform/animation/box-shadow, all nine are on the homepage, and all nine
   are already gated. Every other page changes colour, brightness or
   text-decoration only — harmless when it sticks. This is coverage for a rule
   that is currently satisfied everywhere, on the nine pages where nothing was
   watching it. The homepage's version of this bug was also satisfied-everywhere
   right up until it wasn't, and was then live and invisible for four days.

   ⚠️ THE HOMEPAGE'S OWN SWEEP IS DELIBERATELY LEFT ALONE. Three faults are
   anchored on its text and it carries the four named checks (.fmt-grp,
   .reg-btn, .fmt-day, .rules-btn) that were actually measured on a 390px touch
   viewport. Moving a check orphans the fault anchored on its old name,
   silently. So this overlaps it on purpose: a general sweep with the specific
   one still inside it, not a second copy of one rule.

   Spec: claude/specs/spec-hover-sweep-all-pages.md */
section('Nothing that moves on hover can stick on a touch screen — on ANY page');
{
  /* ⚠️ ALL_PAGES is NOT reused-and-extended here. It drives three other loops
     above (icons, og:image, twitter:image) and quietly adding two files to it
     would change what those assert — a different change wearing this one's
     clothes. The hover sweep gets its own list.
     ⚠️ deck-stage.js and image-slot.js also carry :hover rules in injected CSS
     and are NOT swept: no page in the repo references either file (grepped
     6 Aug), so they are editor-side, not the public site. If one is ever loaded
     by a page it joins this list. */
  const HOVER_PAGES = [...ALL_PAGES, 'Club.dc.html', 'rules.html'];

  const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

  /* ⚠️ BRACE-MATCHED, NOT FORMAT-MATCHED, AND THIS IS THE WHOLE REASON THE
     HOMEPAGE'S SWEEP COULD NOT SIMPLY BE POINTED AT MORE FILES. It anchors on
     /@media \(hover:hover\)\{[\s\S]*?\n  \}/ — one space after @media, no
     spaces around the colon, closing brace at exactly two spaces of indent.
     app.html writes it `@media(hover:hover){` with no space at all, so that
     anchor does not see app.html's gate AT ALL and would report its correctly
     gated rules as ungated the moment one of them grew a transform. Opening on
     a loose pattern and counting braces to the close survives spacing,
     indentation and a compound query (`… and (min-width:900px)`). */
  function gatedSpans(css) {
    const spans = [];
    const open = /@media[^{]*hover\s*:\s*hover[^{]*\{/g;
    let m;
    while ((m = open.exec(css))) {
      let i = m.index + m[0].length;
      let depth = 1;
      while (depth && i < css.length) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      spans.push([m.index, i]);
    }
    return spans;
  }

  /* A hover rule that only changes colour is harmless when it sticks. One that
     MOVES or ANIMATES is what leaves a card tilted and shimmering with nothing
     able to end it, so that is the set this sweeps. Same predicate as the
     homepage's, deliberately — two different answers to "what counts as loud"
     would be worse than one imperfect one. */
  const LOUD = /transform|animation|box-shadow/;

  const ungated = [];
  const perPage = {};
  let hoverSeen = 0;
  let loudSeen = 0;

  for (const f of HOVER_PAGES) {
    /* Line endings normalised — git checks these out as CRLF on Windows.
       Comments stripped both ways: this repo documents the traps it avoids, so
       an un-stripped sweep can match the warning telling you not to write the
       thing. */
    const css = stripCss(stripHtml(readRepo(f).replace(/\r\n/g, '\n')));
    const spans = gatedSpans(css);
    perPage[f] = 0;
    for (const m of css.matchAll(/([^\n{}]*:hover[^{}]*)\{([^{}]*)\}/g)) {
      hoverSeen++;
      perPage[f]++;
      if (!LOUD.test(m[2])) continue;              // colour-only: fine either way
      loudSeen++;
      if (!spans.some(([a, b]) => m.index >= a && m.index < b)) {
        ungated.push(`${f}: ${m[1].trim().slice(0, 50)}`);
      }
    }
  }

  check('no page has a hover rule that moves or animates outside (hover:hover)',
    ungated.length === 0, ungated.join(' | '));

  /* ⚠️ THE SWEEP ABOVE PASSES BEAUTIFULLY OVER AN EMPTY SET. A broken stripper,
     a regex that stops matching, a readRepo returning '' — all of them report
     "no ungated rules" and mean "I read nothing". This repo has hit that in
     three separate disguises. So the set is floored, per page and in total. */
  for (const f of HOVER_PAGES) {
    check(`${f}: the sweep found hover rules to check`, perPage[f] >= 1,
      `${perPage[f]} found — 0 means this page was not really read`);
  }
  check('…and the sweep saw the whole site\'s hover rules', hoverSeen >= 25,
    `${hoverSeen} seen (31 at 1c26612)`);
  check('…and it saw rules that actually move or animate', loudSeen >= 7,
    `${loudSeen} seen (9 at 1c26612, all on the homepage, all gated)`);

  /* ⚠️ NAMED SEPARATELY BECAUSE THE SWEEP CANNOT CATCH THIS ONE. app.html is
     the only non-homepage page with a pointer gate today, and its hover rules
     are colour-only — so removing the gate does not make anything "loud" and
     the sweep stays green. Nothing asserted this until now; the gate was right
     by somebody's good habit, not by a check. */
  {
    const app = stripCss(stripHtml(readRepo('app.html').replace(/\r\n/g, '\n')));
    const spans = gatedSpans(app);
    check('the match-day app\'s hover rules stay behind a pointer gate',
      spans.length >= 1 && /\.mrow:hover|\.pill:hover/.test(app.slice(spans[0] ? spans[0][0] : 0,
        spans[0] ? spans[0][1] : 0)),
      `${spans.length} pointer-gated block(s) found in app.html`);
  }
}

summary('test-design-polish.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
