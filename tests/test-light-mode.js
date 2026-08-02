/* tests/test-light-mode.js
   ------------------------------------------------------------------------
   The back office went LIGHT on 2 Aug 2026 (Jay's call): /organizer,
   /manager and /signin. The PUBLIC pages stayed dark — the homepage,
   /scores and /app carry the dark brand. This file pins the split BOTH
   ways, so neither a dark surface creeping back into the back office nor
   the public pages quietly going light passes unnoticed.

   The full visual verification was a rendered-screenshot + automated WCAG
   audit at build time (every text/background pair >= 4.5:1, brand accent
   buttons excepted as the pre-existing site-wide pattern); what a source
   test can hold is the palette split itself.
*/

const { readRepo, section, check, summary } = require('./_lib');

const LIGHT_PAGES = ['Organizer.dc.html', 'Manager.dc.html', 'Signin.dc.html'];
const DARK_PAGES = ['Quins JRT.dc.html', 'Scores & Standings.dc.html', 'app.html'];

const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

async function main() {

section('The three back-office pages are light');
for (const f of LIGHT_PAGES) {
  const src = stripJs(stripHtml(readRepo(f)));
  check(`${f}: the body is the light page colour with dark ink`,
    /body\{[^}]*background:#F3F2EF;color:#1A1C1F/.test(src));
  check(`${f}: no dark page surface remains`, !/#0C0C0E/i.test(src),
    (src.match(/.{0,50}#0C0C0E.{0,30}/i) || [])[0]);
  check(`${f}: no dark card surface remains`, !/#151517/i.test(src),
    (src.match(/.{0,50}#151517.{0,30}/i) || [])[0]);
  check(`${f}: no dark-mode grey text remains`, !/#aeb4bf|#7f8794|#8b93a3/i.test(src));
  check(`${f}: hairline borders are black-alpha, not white-alpha`,
    !/rgba\(255,255,255,0?\.(1|12|15|18|2)\)/.test(src));
}

section('The public pages are still dark — the split holds in both directions');
for (const f of DARK_PAGES) {
  const src = readRepo(f);
  check(`${f}: still carries the dark page surface`, /#0C0C0E/i.test(src));
}

summary('test-light-mode.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
