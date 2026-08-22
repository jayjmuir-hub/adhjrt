/* tests/test-backoffice-retheme.js
   ------------------------------------------------------------------------
   The back office was re-pointed at the club brand system on 22 Aug 2026
   (claude/specs/spec-backoffice-retheme.md, Jay's calls recorded there):
   /signin, /manager and /organizer wear the CURRENT club palette — read off
   the live club site and contrast-measured in Club Hub — with a dark brand
   chrome header band on the two dashboards.

   What this file pins:
   1. The colour tokens live in ONE :root block per file and the three
      copies are byte-identical — DERIVED, not pinned, so they cannot drift.
   2. The abandoned brand values are gone from live code (comments may still
      quote them as history — they are stripped before searching).
   3. The bright dark-mode red (--brand-ondark) never lands on a light
      surface: it appears only inside the dashboards' chrome header.
   4. The chrome band itself, and the theme-color metas that match it.
   5. Values that get alpha-suffixed in JS (AGE_TINT, `${t}30`) stay literal
      hexes — a var() there produces invalid CSS with no error anywhere.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

const FILES = ['Signin.dc.html', 'Manager.dc.html', 'Organizer.dc.html'];

const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const live = (s) => stripJsComments(stripHtmlComments(s));
const lf = (s) => s.replace(/\r\n/g, '\n');

async function main() {
  const src = {};
  FILES.forEach((f) => { src[f] = lf(readRepo(f)); });

  section('One token block, three identical copies');
  {
    const blocks = FILES.map((f) => {
      const m = src[f].match(/:root\{[\s\S]*?\n  \}/);
      return m ? m[0] : '';
    });
    check('every file carries a :root token block', blocks.every((b) => b.length > 0));
    check('the three token blocks are byte-identical',
      blocks[0].length > 0 && blocks.every((b) => b === blocks[0]),
      blocks.map((b, i) => `${FILES[i]}: ${b.length} chars`).join(', '));
    check('the brand red is the club site\'s current light-surface red',
      /--brand:#C8102E/.test(blocks[0]));
    check('the chrome is the club site\'s near-black', /--chrome:#0A0A0A/.test(blocks[0]));
    check('the bright red exists only as the on-dark token',
      /--brand-ondark:#FF2D4A/.test(blocks[0]));
  }

  section('The abandoned brand is gone from live code');
  {
    /* Comments may quote the old values as tombstones; the code may not
       carry them. Case-insensitive, because both spellings existed. */
    const OLD = ['#E11B22', '#F3F2EF', '#1A1C1F', '#454D58', '#5A626E',
      '#17A34A', '#0B7285', '#A62626', '#B00020', '225,27,34', '23,163,74'];
    for (const f of FILES) {
      const code = live(src[f]).toUpperCase();
      const found = OLD.filter((v) => code.includes(v));
      check(`${f}: no abandoned brand value outside comments`, found.length === 0, found.join(', '));
    }
    /* Control for the negative search (rule 8): the same machinery must FIND
       a string known to be in live code — the new brand token in use. */
    check('control: the search finds var(--brand) in live code',
      FILES.every((f) => live(src[f]).includes('var(--brand)')));
  }

  section('The bright red never lands on a light surface');
  {
    /* Outside the :root definition, --brand-ondark may appear only in the
       dashboards' dark chrome header (the crest gradient) — once each. */
    for (const f of FILES) {
      const uses = (live(src[f]).match(/var\(--brand-ondark\)/g) || []).length;
      const want = f === 'Signin.dc.html' ? 0 : 1;
      eq(`${f}: var(--brand-ondark) used exactly ${want}x outside the token block`, uses, want);
    }
  }

  section('Dark chrome on the dashboards, and only there');
  {
    for (const f of ['Manager.dc.html', 'Organizer.dc.html']) {
      check(`${f}: the header row is the dark chrome band`,
        src[f].includes('background:var(--chrome);border-radius:14px'));
      check(`${f}: browser chrome matches the band`,
        src[f].includes('<meta name="theme-color" content="#0A0A0A">'));
    }
    check('Signin.dc.html: no chrome band — the card page stays light',
      !live(src['Signin.dc.html']).includes('background:var(--chrome)'));
    check('Signin.dc.html: browser chrome is the light surface',
      src['Signin.dc.html'].includes('<meta name="theme-color" content="#F3F3F3">'));
  }

  section('Alpha-suffixed values stay literal');
  {
    /* AGE_TINT values flow into `${t}30` (hex + alpha). A var() there makes
       "var(--x)30" — invalid CSS, silently transparent, no error anywhere. */
    const org = src['Organizer.dc.html'];
    check('AGE_TINT u6 is a literal hex of the new brand red', org.includes("u6: '#C8102E'"));
    check('AGE_TINT u10 is a literal hex of the new green', org.includes("u10: '#1F9D4D'"));
    check('the AGE_TINT fallback is a literal hex', org.includes("AGE_TINT[ag] || '#636974'"));
    for (const f of FILES) {
      const mangled = live(src[f]).match(/var\(--[\w-]+\)[0-9A-Fa-f]{2}(?![\w%])/);
      check(`${f}: no var() token wears an alpha suffix`, !mangled, mangled && mangled[0]);
    }
  }

  section('Contrast — computed from the token block, not asserted from memory');
  {
    /* WCAG relative-luminance ratio, computed against the values the pages
       actually declare, so a token edit re-measures itself. The brand-accent
       button exception (white on the green) is the pre-existing site-wide
       pattern — see test-light-mode.js's header. */
    const tokens = {};
    (src['Signin.dc.html'].match(/--[\w-]+:#[0-9A-Fa-f]{6}/g) || []).forEach((d) => {
      const [k, v] = d.split(':');
      tokens[k] = v;
    });
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const pairs = [
      ['--ink', '--surface', 'primary text on the page'],
      ['--ink-muted', '--surface', 'muted text on the page'],
      ['--danger-ink', '--surface', 'error text on the page'],
      ['--accent-ink', '--surface', 'green text on the page'],
    ];
    for (const [fg, bg, label] of pairs) {
      const r = ratio(tokens[fg], tokens[bg]);
      check(`${label} clears AA (${fg} on ${bg} = ${r.toFixed(2)}:1)`, r >= 4.5);
    }
    const white = '#FFFFFF';
    const rBrand = ratio(white, tokens['--brand']);
    check(`white on the brand red clears AA (${rBrand.toFixed(2)}:1)`, rBrand >= 4.5);
    const rOnDark = ratio(tokens['--brand-ondark'], tokens['--chrome']);
    check(`the bright red on chrome clears AA (${rOnDark.toFixed(2)}:1)`, rOnDark >= 4.5);
    const rChromeMuted = ratio(tokens['--chrome-muted'], tokens['--chrome']);
    check(`muted chrome text on chrome clears AA (${rChromeMuted.toFixed(2)}:1)`, rChromeMuted >= 4.5);
    /* And the rule the whole palette is built around, held as a measurement:
       the bright red on a LIGHT surface fails — which is why it must never
       appear there, and why the check above pins its uses to the chrome. */
    check('the bright red on white genuinely fails AA — the split is real',
      ratio(white, tokens['--brand-ondark']) < 4.5);
  }

  summary('test-backoffice-retheme.js');
}

main().catch((e) => { console.error(e); process.exit(1); });
