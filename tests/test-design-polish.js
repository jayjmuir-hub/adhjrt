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

summary('test-design-polish.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
