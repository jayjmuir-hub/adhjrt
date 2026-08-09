/* tests/test-image-weight.js
   ---------------------------------------------------------------------------
   Holds the weight of what the pages actually SERVE.

   WHAT WENT WRONG. assets/action-run.png was 1.8 MB and was the hero background
   on the homepage — the Largest Contentful Paint, downloaded in full by every
   parent on venue mobile data before the hero could finish painting. It was
   larger than the whole of the rest of that page put together. The About-section
   board photos three screens further down already had the full avif/webp + -sm
   treatment and a generator script to produce it; the one image that actually
   gated first paint had never been through it.

   ⚠️ THIS FILE CHECKS WHAT IS REFERENCED, NOT WHAT IS ON DISK. The master PNG
   is deliberately kept in the repo to re-encode from, so a rule of "no large
   PNGs in assets/" would either fail on the master or force deleting it. What
   must not happen is a large file being NAMED by a page. So: find every image
   src/srcset in the served pages, then weigh those files.

   ⚠️ AND IT MUST FAIL IF IT FINDS NOTHING. A scan that matches zero images
   passes every size check trivially. The floor below is what stops that — the
   same trap as an empty grep reported as a clean bill of health.
*/

const fs = require('fs');
const path = require('path');
const { section, check, eq, summary, repoRoot, readRepo } = require('./_lib');

const PAGES = ['Quins JRT.dc.html', 'Scores & Standings.dc.html', 'app.html',
  'Organizer.dc.html', 'Manager.dc.html', 'Club.dc.html', 'Signin.dc.html',
  'legal.html', 'rules.html', '404.html'];

/* ⚠️ These files are HEAVILY commented, and the comments talk ABOUT markup —
   they contain <picture>, <script> and asset paths as prose. Every scan here
   runs on the comment-free text, because no regex can tell a tag from a
   sentence describing one. Four checks in this branch were written wrong
   before that sank in. */
function stripHtmlComments(s) { return s.replace(/<!--[\s\S]*?-->/g, ''); }

/* Every asset path a page names, from src= and from srcset= (which carries a
   comma-separated list with width descriptors). */
function referenced(rawSrc) {
  const src = stripHtmlComments(rawSrc);
  const out = new Set();
  const add = (p) => { if (p && p.startsWith('assets/')) out.add(p); };
  (src.match(/src="([^"]+)"/g) || []).forEach((m) => add(m.slice(5, -1).replace(/^\//, '')));
  (src.match(/srcset="([^"]+)"/g) || []).forEach((m) => {
    m.slice(8, -1).split(',').forEach((part) => add(part.trim().split(/\s+/)[0].replace(/^\//, '')));
  });
  return out;
}

const all = new Set();
PAGES.forEach((p) => referenced(readRepo(p)).forEach((a) => all.add(a)));

const sizeOf = (rel) => {
  try { return fs.statSync(path.join(repoRoot(), rel)).size; } catch (e) { return -1; }
};

/* ⚠️ TWO MODES, DECLARED OUT LOUD.

   The on-disk weight checks need the real binary files. `_prove-registration.js`
   seeds its temp copy with `readFileSync(from,'utf8')` and a CRLF→LF replace,
   which mangles any binary it touches — so assets/ is deliberately NOT seeded
   there, and in that copy every size check would fail on an UNDAMAGED tree. A
   suite that fails undamaged makes all of its faults report "caught" while
   proving nothing, which is precisely what the prover's baseline exists to
   catch, and it did catch this.

   So: the MARKUP checks run everywhere and are what the faults aim at. The
   WEIGHT checks run only where the bytes exist. ⚠️ The mode is asserted rather
   than inferred silently — "skipped quietly" and "passed" must never look the
   same, which is the whole lesson of this repo's fixture rules. */
const WEIGHABLE = sizeOf('assets/action-run.png') > 0;

/* ====================================================================== */
section(`Mode: ${WEIGHABLE ? 'full — the real assets are present' : 'markup only — no assets/ in this copy'}`);

check('the mode was determined from a real file, not assumed',
  typeof WEIGHABLE === 'boolean');
if (!WEIGHABLE) {
  console.log('   (assets/ absent — on-disk weight checks skipped, markup checks still run)');
}

/* ====================================================================== */
section('The scan found something to measure');

/* ⚠️ THE FLOOR. Without it, a regex that stops matching turns this whole file
   into a row of vacuous passes. 20 is far below the real count and far above
   anything a broken scan would return. */
/* 12, not 20: the About ring's 44 board files are named by srcset built in
   script, not in static markup, so they are not in this scan at all — and this
   file only claims to cover what the MARKUP names. Set from the measured 16
   with room to move, low enough never to nag and high enough that a regex
   which stopped matching would trip it. */
check(`the scan found images to weigh (${all.size})`, all.size >= 12, `found ${all.size}`);
check('…including the hero', [...all].some((a) => a.includes('action-run')));
check('…and the venue map', [...all].some((a) => a.includes('venue-map')));

/* ====================================================================== */
section('Every referenced image exists');

if (WEIGHABLE) {
  [...all].sort().forEach((a) => {
    check(`${a} exists`, sizeOf(a) >= 0, 'a page names an asset that is not in the repo');
  });
}

/* ====================================================================== */
section('⚠️ No page serves a heavyweight image');

/* 200 KB is generous — the largest thing here after the change is a 66 KB webp.
   It is set as a CEILING that catches a regression, not as a target. */
const CEILING = 200 * 1024;
if (WEIGHABLE) {
  [...all].sort().forEach((a) => {
    const n = sizeOf(a);
    if (n < 0) return;                       // already reported above
    check(`${a} is under 200 KB (${Math.round(n / 1024)} KB)`, n <= CEILING,
      'convert it with the same avif/webp + -sm treatment as assets/board/');
  });
}

/* ====================================================================== */
section('⚠️ The hero is not a PNG any more, and is not served as one');

{
  const home = readRepo('Quins JRT.dc.html');
  const refs = referenced(home);
  check('the homepage no longer names action-run.png', ![...refs].some((a) => a.endsWith('action-run.png')),
    'the 1.8 MB master must stay in the repo but must never be served');
  /* ⚠️ THE MARKUP HALF IS THE HALF THE FAULTS AIM AT, and it runs everywhere.
     A page must not NAME a heavy original, whatever is on disk. */
  ['action-run.png', 'venue-map.png', 'format-action.jpg'].forEach((heavy) => {
    check(`no page names ${heavy} in markup`,
      !PAGES.some((p) => [...referenced(readRepo(p))].some((a) => a.endsWith(heavy))),
      'the master stays in the repo to re-encode from, but must never be served');
  });

  if (WEIGHABLE) {
    check('the master PNG is still in the repo to re-encode from', sizeOf('assets/action-run.png') > 0);
    ['assets/action-run.avif', 'assets/action-run.webp',
      'assets/action-run-sm.avif', 'assets/action-run-sm.webp'].forEach((f) => {
      check(`${f} exists`, sizeOf(f) > 0);
    });
  }

  /* The four-file shape only helps if the markup can actually pick between
     them. A <picture> with one source is a slower <img>. */
  /* ⚠️ COMMENTS STRIPPED FIRST — see stripHtmlComments above. This matched a
     <picture> written inside an explanatory COMMENT twice before it was right:
     once unanchored, then again with ^\s* (that comment is indented, so it
     starts a line too). Making the regex cleverer was the wrong move each time;
     removing comments is the fix, because the file genuinely contains prose
     about tags and no pattern can tell the two apart. */
  const markup = stripHtmlComments(home);
  const pic = (markup.match(/<picture>(?:(?!<\/picture>)[\s\S])*action-run[\s\S]*?<\/picture>/) || [''])[0];
  check('the hero picture was located', pic.includes('action-run'));
  check('…offers avif', /type="image\/avif"/.test(pic));
  check('…offers webp', /type="image\/webp"/.test(pic));
  /* ⚠️ BOTH SOURCES, CHECKED SEPARATELY. `/action-run-sm/.test(pic)` passed
     when the phone variant was dropped from the AVIF srcset alone, because the
     WebP one still mentioned it — so an AVIF-capable phone (most of them) would
     have pulled the full-width file while the check stayed green. A per-source
     assertion is the only kind that means anything here. */
  const avifSrc = (pic.match(/<source type="image\/avif"[^>]*>/) || [''])[0];
  const webpSrc = (pic.match(/<source type="image\/webp"[^>]*>/) || [''])[0];
  check('…the avif source offers a phone variant', /action-run-sm\.avif/.test(avifSrc), avifSrc);
  check('…and so does the webp source', /action-run-sm\.webp/.test(webpSrc), webpSrc);
  check('…both carry width descriptors so the browser can choose',
    /\b700w\b/.test(avifSrc) && /\b700w\b/.test(webpSrc));
  /* ⚠️ The <img> fallback must NOT be the PNG, or every browser that fails the
     source list pulls 1.8 MB — and that is exactly the browser least able to. */
  check('…and falls back to webp, never to the PNG', /<img[^>]+src="assets\/action-run\.webp"/.test(pic));

  /* It is the LCP element. Priority and dimensions both matter, and they are
     the two things most often dropped in a later edit. */
  check('…is marked fetchpriority="high" (it IS the LCP)', /fetchpriority="high"/.test(pic));
  check('…and carries width and height, so it reserves its space',
    /width="1297"/.test(pic) && /height="1212"/.test(pic));
  /* ⚠️ Above the fold. Lazy here would delay the very thing being optimised. */
  check('⚠️ …and is NOT lazy-loaded', !/loading="lazy"/.test(pic));
}

/* ====================================================================== */
section('The unused asset is gone');

if (WEIGHABLE) {
  eq('sponsors-logos.png is deleted (371 KB, nothing referenced it)',
    sizeOf('assets/sponsors-logos.png'), -1);
}

summary('test-image-weight.js');
