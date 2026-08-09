/* tests/test-head-metadata.js
   ---------------------------------------------------------------------------
   Holds every crawler-facing tag in the REAL <head> of every page, and out of
   <helmet>.

   WHAT WENT WRONG. The .dc.html pages have a nearly empty literal <head> —
   charset, viewport, one script — and everything else lived in <helmet> inside
   the <body>, which support.js moves into document.head after boot. That works
   in a browser and nowhere else. Facebook, WhatsApp, LinkedIn, Slack and
   Twitter scrapers do not execute JavaScript, so every link to this site shared
   anywhere arrived as a bare grey URL with no title, no description and no
   card — on a site whose entire distribution is parents forwarding links.

   ⚠️ AND IT SILENTLY VOIDED A SECURITY CLAIM. netlify.toml said /register-club
   was safe partly because "the page carries noindex". It did not: the tag only
   existed after JS ran. A comment asserting a security property is worth
   nothing unless something checks the property. This file is that check.

   ⚠️ THE NEGATIVE HALF IS THE LOAD-BEARING HALF. Asserting a tag is in <head>
   passes just as happily when it is ALSO still in the helmet — and a duplicate
   means two <title> tags on the live page, because the helmet is appended to
   document.head. Every check below is a pair: present in <head>, absent from
   <helmet>.

   ⚠️ THE TAGS MUST BE MATCHED LINE-ANCHORED. My first version of this file
   located the helmet with s.indexOf('<helmet>') and got a hit inside the
   explanatory COMMENT I had just written into the <head> — which contains the
   word <helmet> — so it sliced the wrong region and reported tags "still in the
   helmet" that had been moved correctly half an hour earlier. Real tags start a
   line; prose never does.
*/

const path = require('path');
const { section, check, eq, summary, readRepo } = require('./_lib');

/* Line-anchored, for the reason in the header. */
const TAG = /^\s*(<title>|<meta\s+name="description"|<link\s+rel="canonical"|<meta\s+property="og:|<meta\s+name="twitter:"?|<meta\s+name="robots"|<script type="application\/ld\+json">)/gim;

const DC_PAGES = [
  'Quins JRT.dc.html', 'Scores & Standings.dc.html', 'Club.dc.html',
  'Manager.dc.html', 'Organizer.dc.html', 'Signin.dc.html',
];
const PLAIN_PAGES = ['app.html', 'legal.html', 'rules.html'];

function regions(src) {
  const headEnd = src.search(/^<\/head>/m);
  const helmetOpen = src.search(/^<helmet>/m);
  const helmetClose = src.search(/^<\/helmet>/m);
  return {
    head: headEnd === -1 ? '' : src.slice(0, headEnd),
    helmet: helmetOpen === -1 ? '' : src.slice(helmetOpen, helmetClose),
    headEnd, helmetOpen,
  };
}
const count = (s, re) => (s.match(re) || []).length;

/* ====================================================================== */
section('Every crawler-facing tag is in the real <head>, and only there');

DC_PAGES.forEach((page) => {
  const src = readRepo(page);
  const r = regions(src);

  /* The structural precondition. If these ever stop being found, every check
     below silently measures an empty string — the failure mode this file's own
     header warns about. */
  check(`${page}: the <head> and <helmet> regions were both located`,
    r.headEnd > 0 && r.helmetOpen > r.headEnd, `head ${r.headEnd}, helmet ${r.helmetOpen}`);

  check(`${page}: has crawler tags in <head>`, count(r.head, TAG) > 0);
  eq(`${page}: ⚠️ and NONE left in <helmet>`, count(r.helmet, TAG), 0);

  /* Exactly one title on the rendered page — the helmet is appended to
     document.head, so a leftover copy is a second <title>. */
  eq(`${page}: exactly one <title> in the whole file`, count(src, /<title>[\s\S]*?<\/title>/g), 1);
});

/* ====================================================================== */
section('The pages parents actually share carry a title, a description and a card');

[['Quins JRT.dc.html', 'https://adhjrt.com/'],
  ['Scores & Standings.dc.html', 'https://adhjrt.com/scores'],
  ['app.html', 'https://adhjrt.com/app']].forEach(([page, url]) => {
  const head = regions(readRepo(page)).head || readRepo(page);
  check(`${page}: <title>`, /<title>[^<]+<\/title>/.test(head));
  check(`${page}: description`, /<meta\s+name="description"\s+content="[^"]{40,}"/.test(head));
  check(`${page}: canonical is ${url}`, head.includes(`<link rel="canonical" href="${url}">`));
  check(`${page}: og:title`, /<meta property="og:title"/.test(head));
  check(`${page}: og:description`, /<meta property="og:description"/.test(head));
  check(`${page}: og:image`, /<meta property="og:image"/.test(head));
  check(`${page}: twitter:card`, /<meta name="twitter:card"/.test(head));
});

/* ====================================================================== */
section('⚠️ The back-office pages really do carry noindex — netlify.toml depends on it');

['Club.dc.html', 'Manager.dc.html', 'Organizer.dc.html', 'Signin.dc.html'].forEach((page) => {
  const r = regions(readRepo(page));
  /* /register-club's whole listing defence is this tag. It was in the helmet,
     so it did not exist for any crawler that ignores JavaScript — which is the
     only kind that would have found the page in the first place. */
  check(`${page}: noindex is in the literal <head>`,
    /<meta\s+name="robots"\s+content="noindex, nofollow">/.test(r.head));
  eq(`${page}: ⚠️ and not duplicated in <helmet>`, count(r.helmet, /<meta\s+name="robots"/g), 0);
});

/* ====================================================================== */
section('The helmet keeps what only a browser needs');

{
  /* The opposite mistake: moving EVERYTHING into <head> would put the header
     script and the font links outside the engine's control for no reason. Fonts
     and scripts are for browsers, which do run JavaScript. */
  const r = regions(readRepo('Quins JRT.dc.html'));
  check('font preconnects stayed in the helmet', /rel="preconnect"/.test(r.helmet));
  check('the header script stayed in the helmet', /<script>/.test(r.helmet));
  check('the manifest link stayed in the helmet', /rel="manifest"/.test(r.helmet));
}

/* ====================================================================== */
section('netlify.toml no longer claims something that was never true');

{
  const toml = readRepo('netlify.toml');
  check('the corrected note about the noindex claim is present', /CORRECTED 9 Aug 2026/.test(toml));
  /* The three paths the site was serving that are not part of the site. */
  ['/netlify/*', '/netlify.toml', '/package.json'].forEach((p) => {
    const re = new RegExp(`from = "${p.replace(/[.*]/g, (c) => '\\' + c)}"[\\s\\S]{0,120}?status = 404`);
    check(`${p} is 404'd`, re.test(toml));
  });
  /* ⚠️ A redirect pointing at itself is silently DROPPED by Netlify — the
     mistake that sat unnoticed on the tests/ rule for months. */
  check('…and none of the new rules points at itself',
    !/from = "\/netlify\/\*"\s*\n\s*to = "\/netlify/.test(toml));
}

/* ====================================================================== */
section('sitemap.xml and the pages agree');

{
  const map = readRepo('sitemap.xml');
  ['https://adhjrt.com/', 'https://adhjrt.com/scores', 'https://adhjrt.com/app',
    'https://adhjrt.com/rules'].forEach((u) => {
    check(`sitemap lists ${u}`, map.includes(`<loc>${u}</loc>`));
  });
  /* legal.html is robots: all with a canonical, so it is meant to be indexed —
     it was simply never added. */
  check('sitemap lists /legal', map.includes('<loc>https://adhjrt.com/legal</loc>'));
  /* ⚠️ AND NEVER THE SILENT LINK. Listing it would undo the whole point.
     ⚠️ MATCHED AS A <loc>, NOT AS A SUBSTRING. The substring version failed the
     moment I wrote a COMMENT into sitemap.xml explaining why the path must stay
     out of it — the check could not tell a warning about the path from the path.
     Same shape as the <helmet>-in-a-comment trap in this file's own header:
     match the structure, never the word. */
  check('⚠️ sitemap does NOT list /register-club',
    !/<loc>[^<]*register-club[^<]*<\/loc>/.test(map));
  /* robots.txt has no comment mentioning it, but match structurally anyway so
     adding one later cannot break this. A Disallow would ADVERTISE the path. */
  check('⚠️ robots.txt does not name it in a directive either',
    !/^\s*(Disallow|Allow)\s*:.*register-club/im.test(readRepo('robots.txt')));
}

summary('test-head-metadata.js');
