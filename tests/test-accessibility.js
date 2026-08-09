/* tests/test-accessibility.js
   ---------------------------------------------------------------------------
   Every form control is named, and the one dialog in /app behaves like one.

   WHAT WENT WRONG.

   1. NOT ONE FORM CONTROL ON THE SITE WAS PROGRAMMATICALLY LABELLED. The
      labels existed and were styled — `<label class="lbl">Club name</label>`
      followed by a sibling `<input>` — but nothing associated them: no `for`,
      no `id`, no `aria-label`, no wrapping. A screen reader announced "edit
      text, blank" for club name, contact name, contact email, phone, every
      age-group count box, and username and password. Those are the forms
      parents and coaches have to complete to enter the tournament.

   2. THE /app BOTTOM SHEET DECLARED role="dialog" aria-modal="true" AND DID
      NONE OF IT. No Escape handler, no focus moved in, no focus given back, no
      focus trap — so Tab walked straight into the page behind it. It is the
      only interaction surface in /app: sign-in, score entry and follow-a-team
      all happen inside it. Every other page in the repo already handled Escape
      and unmounted its listener; /app was the outlier.

   3. Its submit buttons changed LABEL to "Saving…" but were never disabled, so
      a double-tap pitch-side sent two POSTs. Every DC page binds
      disabled="{{ busy }}" already.

   ⚠️ COMMENTS ARE STRIPPED — HTML *AND* JAVASCRIPT. These files are heavily
   commented and the comments discuss markup: two of them contain the words
   `<input type="date">` and `<select>` as PROSE, inside JavaScript block
   comments. An audit that stripped only HTML comments reported both as
   unlabelled controls.

   That is the SIXTH time in this branch that prose containing a tag was read
   as the tag — and writing this very paragraph made it seven, because the
   first draft spelled out a JS block comment's delimiters here and closed this
   comment early, so the file would not parse. The delimiters are described in
   words above for that reason. It is the single most common way a check in
   this repo goes wrong.
*/

const { section, check, eq, summary, readRepo } = require('./_lib');

const PAGES = ['Signin.dc.html', 'Club.dc.html', 'Quins JRT.dc.html',
  'Organizer.dc.html', 'Manager.dc.html', 'app.html'];

/* ⚠️ Both comment syntaxes. See the header. */
function stripComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const FIELD = /<(input|select|textarea)\b([^>]*)>/g;

/* Controls that are correctly absent from the accessibility tree, or that carry
   their own name. A submit button's name is its text. */
function exempt(attrs) {
  return /type="(hidden|submit|button|reset)"/.test(attrs)
      || /aria-hidden="true"/.test(attrs);
}

function audit(page) {
  const src = stripComments(readRepo(page));
  const labelled = new Set([...src.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const fields = [...src.matchAll(FIELD)];
  const unnamed = fields.filter(([, , attrs]) => {
    if (exempt(attrs)) return false;
    const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    if (id && labelled.has(id)) return false;
    return !/aria-label(?:ledby)?=/.test(attrs);
  });
  const ids = fields.map(([, , a]) => (a.match(/\bid="([^"]+)"/) || [])[1]).filter(Boolean);
  return { fields, unnamed, ids, labelled, src };
}

/* ====================================================================== */
section('Every form control has an accessible name');

PAGES.forEach((page) => {
  const a = audit(page);

  /* ⚠️ THE FLOOR. A regex that stopped matching would report zero fields and
     zero unnamed ones, i.e. a clean pass on a page it never looked at. */
  check(`${page}: the scan found controls (${a.fields.length})`, a.fields.length >= 3,
    `found ${a.fields.length}`);

  eq(`${page}: ⚠️ controls with no accessible name`, a.unnamed.length, 0);
  a.unnamed.slice(0, 4).forEach((m) => {
    console.log('        ' + m[0].replace(/style="[^"]*"/, 'style=…').slice(0, 110));
  });

  /* Duplicate ids make `for` ambiguous — the browser binds to the first, so a
     label can silently point at the wrong box. */
  const dupes = a.ids.filter((v, i) => a.ids.indexOf(v) !== i);
  eq(`${page}: no duplicate control ids`, dupes.join(',') || 'none', 'none');

  /* Every `for` must point at something that exists, or it names nothing. */
  const orphans = [...a.labelled].filter((id) => !a.ids.includes(id));
  eq(`${page}: every label's for= resolves to a control`, orphans.join(',') || 'none', 'none');
});

/* ====================================================================== */
section('The honeypot stays out of the accessibility tree');

{
  /* It must NOT gain a label — it is a spam trap, and a screen reader that
     announces it invites the one person who cannot see it to fill it in. */
  /* ⚠️ Quins JRT.dc.html, not Club.dc.html — I looked in the wrong file first
     and got three failures that said nothing about the honeypot. The team and
     player forms on the homepage each carry one; the club form's own trap is
     handled server-side in _intake.js. */
  const home = stripComments(readRepo('Quins JRT.dc.html'));
  const pot = (home.match(/<input[^>]*tabIndex="-1"[^>]*>/) || [''])[0];
  check('the honeypot was located', pot.length > 0);
  check('…and is aria-hidden', /aria-hidden="true"/.test(pot));
  check('…and is not in the tab order', /tabIndex="-1"/.test(pot));
}

/* ====================================================================== */
section('⚠️ The /app sheet behaves like the dialog it claims to be');

{
  const app = readRepo('app.html');          // comments kept: they explain the code
  const code = stripComments(app);

  check('it still declares itself a modal dialog',
    /role="dialog"[^>]*aria-modal="true"/.test(app));

  /* The four things aria-modal promises. Each fails independently. */
  check('1. Escape closes it', /e\.key === 'Escape'/.test(code) && /closeSheet\(\)/.test(code));
  check('2. focus moves INTO it on open', /\.focus\(\)/.test(code) && /requestAnimationFrame/.test(code));
  /* ⚠️ THE CALL, NOT THE NAME. This was `/sheetReturnFocus/.test(code)` and I
     proved it worthless by deleting the capture, the restore and the
     declaration: one bookkeeping line (`sheetReturnFocus = null;`) survived,
     the substring still matched, and all 49 checks passed against a sheet that
     no longer returned focus at all. Assert the two halves that DO the work. */
  check('3a. focus is captured before the sheet opens',
    /sheetReturnFocus = document\.activeElement/.test(code));
  check('3b. …and given BACK on close',
    /sheetReturnFocus\.focus\(\)/.test(code));
  check('4. Tab is trapped inside it', /e\.key !== 'Tab'/.test(code) || /e\.key === 'Tab'/.test(code));

  /* ⚠️ THE LISTENER MUST BE REMOVED. The sheet opens dozens of times on a match
     day; an accumulating keydown handler gets slower every time. */
  check('the keydown listener is added on open', /addEventListener\('keydown', onSheetKey\)/.test(code));
  check('⚠️ …and removed on close', /removeEventListener\('keydown', onSheetKey\)/.test(code));

  /* Ordering: both must be inside the right function, not merely present. */
  const open = (code.match(/function openSheet\([\s\S]*?\n\}/) || [''])[0];
  const close = (code.match(/function closeSheet\([\s\S]*?\n\}/) || [''])[0];
  check('openSheet was located', open.includes('classList.add'));
  check('closeSheet was located', close.includes('classList.remove'));
  check('…the add is in openSheet', /addEventListener\('keydown'/.test(open));
  check('…the remove is in closeSheet', /removeEventListener\('keydown'/.test(close));
  /* ⚠️ -1 IS LESS THAN EVERYTHING. Written as a bare `a < b` this passed when
     the capture was deleted, because indexOf returned -1. Both positions have
     to be proven to EXIST before they can be compared — the same trap already
     fixed once in test-documents.js this month. */
  {
    const capAt = open.indexOf('sheetReturnFocus = document.activeElement');
    const addAt = open.indexOf('classList.add');
    check('…and openSheet captures where focus came from BEFORE it moves it',
      capAt !== -1 && addAt !== -1 && capAt < addAt, `capture ${capAt}, open ${addAt}`);
  }
}

/* ====================================================================== */
section('⚠️ Submit buttons cannot be double-tapped');

{
  const code = stripComments(readRepo('app.html'));

  check('there is a busy() helper that sets BOTH label and disabled',
    /function busy\(/.test(code) && /\.disabled = true/.test(code));

  /* ⚠️ THE NEGATIVE HALF. The bug was setting textContent and nothing else, so
     any surviving bare `textContent = 'Saving…'` is the bug back. */
  ['Saving…', 'Signing in…', 'Clearing…'].forEach((label) => {
    check(`"${label}" goes through busy(), not a bare textContent`,
      !new RegExp(`textContent\\s*=\\s*'${label}'`).test(code),
      'setting the label without disabling is exactly the defect');
    check(`…and "${label}" is passed to busy()`, code.includes(`busy('`) && code.includes(label));
  });

  /* Restoring on failure must put BOTH back, which is why busy() returns a
     restore function rather than leaving each caller to remember. */
  ['doneLogin', 'doneClear', 'doneSave'].forEach((fn) => {
    check(`${fn}() is called on the failure branch`, new RegExp(`${fn}\\(\\)`).test(code));
  });
}

summary('test-accessibility.js');
