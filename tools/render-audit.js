/* tools/render-audit.js — a RENDERED phone-layout audit that runs in a cloud
   sandbox, with no bridge, no login and no real handset.
   ===========================================================================
   ⚠️ NOT SERVED. `tools/*` has a force-404 rewrite in netlify.toml. This file is
   a development tool and must never be moved to the repo root, which IS the
   deployed site.

   WHY IT EXISTS. Every mobile claim in this project was made from source
   reading or DevTools emulation, and `RESTORE.md` § Phone layout recorded that
   /organizer's block had no rendered measurement at all. This closes that: it
   renders the real .dc.html files in headless Chromium and reads COMPUTED
   styles and BOUNDING BOXES out of a live DOM.

   Usage, from the repo root:
     python3 -m http.server 8099 &
     npm install --prefix /tmp/pw playwright react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0
     node tools/render-audit.js                 # all pages, 390 / 430 / 1000
   Set VENDOR_ROOT if the vendored modules are not at /root/scratch/node_modules.

   ===========================================================================
   THE FOUR THINGS THAT MAKE THIS AN HONEST READING RATHER THAN A REASSURING ONE
   ===========================================================================

   1. ⚠️ THE DESKTOP PASS IS A CONTROL, NOT AN EXTRA. If 390px reports "0
      controls under 16px" and 1000px reports the same, the number proves
      nothing — it could be coming from anywhere. The phone/desktop DIFFERENCE
      is the evidence that the @media block is what is doing the work. Measured
      on 8 Aug 2026: /signin 16px vs 15px, /organizer 16px vs 14px.

   2. ⚠️ unpkg AND GOOGLE FONTS ARE UNREACHABLE FROM THE SANDBOX, and a page
      loaded without React is an UNRENDERED TEMPLATE that still contains real
      <input> elements — so a naive query finds them, reports a font-size, and
      the reading is worthless. This is in claude/lessons.md and had bitten five
      times before this file existed. The three scripts are vendored from npm and
      fulfilled via route(). ⚠️ The response MUST carry
      access-control-allow-origin: the tags are crossorigin, and without it the
      fetch is opaque and React never boots — which looks exactly like the
      original problem.

   3. ⚠️ /organizer AND /manager RENDER NOTHING WITHOUT A SESSION — they bounce
      to /signin, so every count comes back 0, which reads exactly like "no
      problems found". A FABRICATED session is injected into localStorage: a
      made-up token in a local-only render with no network. No real credential is
      involved and nothing is transmitted. currentSession() only requires `token`
      to be truthy; the SERVER is what authorises anything, so this buys layout
      and nothing else. `dashboardRendered` asserts it worked — if that is false
      the zeroes mean "nothing rendered", not "nothing wrong".

   4. ⚠️ OVERFLOW IS COUNTED THREE WAYS BECAUSE ONE NUMBER LIES. `sidewaysPx`
      alone reads 0 under `overflow-x:hidden` while content sits off-screen and
      unreachable — which is exactly how the first /manager fix was declared a
      success. So elements past the right edge are counted separately, and split
      by whether an ancestor is a REAL scroller (reachable — the wide tables are
      supposed to do this) or an `overflow:hidden` clip (unreachable — a bug).

   ⚠️ A PREDICATE THAT WAS WRONG HERE, KEPT AS A WARNING. An earlier version
   reported `stillTemplate` from `document.body.innerHTML.includes('{{')`. That
   matches the DC source inside the invisible `<script type="text/x-dc">`, so a
   fully-rendered /organizer reported `true` and looked like a failed render.
   Count VISIBLE unrendered bindings instead, which is what templateLeaks does.

   ⚠️ WHAT THIS STILL CANNOT SEE, AND A REAL HANDSET IS THE ONLY ANSWER: iOS
   Safari's collapsing toolbar under a fixed bottom strip, and whether 16px
   actually stops zoom-on-focus — that is real-WebKit behaviour and does not
   reproduce in Chromium at any width. This tool proves the RULE APPLIES. It
   cannot prove Safari then behaves. */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VENDOR_ROOT = process.env.VENDOR_ROOT || '/root/scratch/node_modules';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ORIGIN = process.env.AUDIT_ORIGIN || 'http://127.0.0.1:8099';

const VENDOR = {
  'react@18.3.1/umd/react.production.min.js': path.join(VENDOR_ROOT, 'react/umd/react.production.min.js'),
  'react-dom@18.3.1/umd/react-dom.production.min.js': path.join(VENDOR_ROOT, 'react-dom/umd/react-dom.production.min.js'),
  '@babel/standalone@7.29.0/babel.min.js': path.join(VENDOR_ROOT, '@babel/standalone/babel.min.js'),
};

/* Pages worth auditing, and whether a session is needed to see anything. */
const PAGES = [
  { file: 'Signin.dc.html', session: false },
  { file: 'Organizer.dc.html', session: true },
  { file: 'Manager.dc.html', session: true },
];
const WIDTHS = [['phone390', 390], ['phone430', 430], ['desktop1000', 1000]];

/* Runs inside the page. Reads computed styles and boxes — never source. */
const probe = () => {
  const vw = document.documentElement.clientWidth;
  const vis = (e) => !!e.offsetParent;
  const controls = [...document.querySelectorAll('input,select,textarea')].filter(vis);
  const btns = [...document.querySelectorAll('button')].filter(vis);

  const over = [...document.querySelectorAll('*')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.right > vw + 1;
  });
  /* Reachable if the first overflow-managing ancestor is a real scroller;
     unreachable if it is an overflow:hidden clip. See note 4 in the header. */
  const clipped = over.filter((e) => {
    let p = e.parentElement;
    while (p) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden') return true;
      if (ox === 'auto' || ox === 'scroll') return false;
      p = p.parentElement;
    }
    return false;
  });

  /* ⚠️ THE CHECK NO SOURCE READ CAN MAKE. The source spells an inline style
     `display:flex`; the DC renderer re-emits `display: flex`. A selector written
     against the source spelling matches NOTHING in a browser — that is what made
     the first /manager block a silent no-op. This asks the live DOM. */
  const flexRows = [...document.querySelectorAll('[style*="display:flex"],[style*="display: flex"]')].filter(vis);

  /* Visible unrendered bindings only — see the warning in the header. */
  let leaks = 0;
  const walk = (n) => {
    if (n.nodeType === 3 && n.nodeValue.includes('{{')) {
      if (n.parentElement && n.parentElement.offsetParent) leaks++;
      return;
    }
    if (n.nodeType === 1 && n.tagName !== 'SCRIPT') [...n.childNodes].forEach(walk);
  };
  walk(document.body);

  return {
    dashboardRendered: !!document.querySelector('.bo') || !!document.querySelector('input'),
    templateLeaks: leaks,
    unresolvedTags: document.querySelectorAll('sc-if,sc-for').length,
    fontsStatus: document.fonts ? document.fonts.status : 'n/a',
    visibleControls: controls.length,
    controlFontSizes: [...new Set(controls.map((c) => getComputedStyle(c).fontSize))].sort(),
    controlsUnder16: controls.filter((c) => parseFloat(getComputedStyle(c).fontSize) < 16).length,
    visibleButtons: btns.length,
    buttonsUnder44: btns.filter((b) => b.getBoundingClientRect().height < 44).length,
    sidewaysPx: document.documentElement.scrollWidth - vw,
    overflowingElements: over.length,
    unreachableOverflow: clipped.length,
    unreachableSample: clipped.slice(0, 3).map((e) => e.tagName + ' w=' + Math.round(e.getBoundingClientRect().width)),
    flexRowsMatched: flexRows.length,
    flexRowsWrapping: flexRows.filter((e) => getComputedStyle(e).flexWrap === 'wrap').length,
  };
};

(async () => {
  for (const k of Object.keys(VENDOR)) {
    if (!fs.existsSync(VENDOR[k])) {
      console.error(`Missing vendored script: ${VENDOR[k]}\nInstall react@18.3.1, react-dom@18.3.1 and @babel/standalone@7.29.0, or set VENDOR_ROOT.`);
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  const out = {};
  for (const p of PAGES) {
    out[p.file] = {};
    for (const [label, width] of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await ctx.newPage();

      await page.route('**/unpkg.com/**', async (route) => {
        const url = route.request().url();
        const key = Object.keys(VENDOR).find((k) => url.includes(k));
        if (!key) return route.abort();
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/javascript', 'access-control-allow-origin': '*' },
          body: fs.readFileSync(VENDOR[key], 'utf8'),
        });
      });
      await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({
        status: 200, headers: { 'content-type': 'text/css', 'access-control-allow-origin': '*' }, body: '',
      }));

      if (p.session) {
        await page.addInitScript(() => {
          /* Fabricated, local-only, never transmitted. See note 3. */
          localStorage.setItem('adhjrt_session_v2', JSON.stringify({
            token: 'render-harness-not-a-real-token',
            username: 'render-harness',
            name: 'Render Harness',
            ageGroupId: '*',
            isOrganizer: true,
            role: 'organizer',
          }));
        });
      }

      await page.goto(`${ORIGIN}/${encodeURIComponent(p.file)}`, { waitUntil: 'load', timeout: 40000 });
      await page.waitForTimeout(3500);
      out[p.file][label] = await page.evaluate(probe);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
