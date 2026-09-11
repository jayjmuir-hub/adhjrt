# Rendered audits — measure the page, not the source

How to take a real measurement of layout, colour or motion before claiming a
change worked. Reading the CSS proves nothing. A rule can lose to another rule
later in the file. A broken comment can silently switch off everything below
it. A selector written against the source file's spelling can match nothing in
the rendered page. Rules behind this: `CLAUDE.md` rules 5 and 6.

## When to use

- After any change to layout, phone layout, colour or motion (**A**, **B**).
- After touching the About block on the homepage (**C**).
- Before merging a page change, or pushing a draw-editor change (**D**).
- After changing the back office's colours, header, sidebar or tab bar
  (**E**).
- When checking `/app` navigation or anything animated (**F**).

## Before you start

- Measure the **committed file**, served locally or on a branch deploy. Never
  trust numbers from CSS injected through the console or `addStyleTag`. The
  homepage redraws itself on its countdown timer, so injected classes do not
  necessarily survive.
- Always take a **control**: the same measurement at a width or state where
  the change should NOT apply. A number that is the same at both proves
  nothing.
- A reading from a headless Chromium browser proves a rule applies. It does
  not prove iOS Safari behaves (its collapsing toolbar, its zoom when a box is
  tapped). Only a real phone answers that.

## Steps

**A · Run `tools/render-audit.js` (phone layout, back office)**

1. **In a terminal, from the repo root:** serve the files, and install the
   tools outside the repo, as the file's header says:

   ```
   python3 -m http.server 8099 &
   npm install --prefix /tmp/pw playwright react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0
   node tools/render-audit.js
   ```

   Set `VENDOR_ROOT`, `CHROME_PATH` or `AUDIT_ORIGIN` if your paths differ.
   Never run `npm install` in the repo folder: it changes `package.json`.
2. **Read `dashboardRendered` first.** If it is false, the zeroes mean nothing
   rendered, not that nothing is wrong. The tool puts a made-up session in the
   browser so that `/organizer` and `/manager` render. No real credential is
   involved.
3. **Compare the phone widths with the desktop width.** The difference between
   them is the evidence.
4. **Read the overflow counts by type.** An element past the right edge inside
   a real scroller can still be reached (wide tables do this). One inside an
   `overflow:hidden` clip cannot, and is a bug.

**B · A headless phone measurement of the homepage or `/app`**

1. **In Playwright:** use widths 360, 390 and 430 (and 320 and 359 for
   `/app`), with `isMobile`, touch, and a phone user agent.
2. Serve React, ReactDOM, Babel and the Google Fonts CSS locally, by
   intercepting the page's requests with `route()`. The response must carry an
   `access-control-allow-origin` header. The page's script tags are
   `crossorigin`, and without the header React never starts.
3. **Wait for `document.fonts.ready`, then check each font's status.** A
   fallback font changes every text measurement, and the screenshot only looks
   slightly off.
4. **Check** that `document.scrollingElement.scrollWidth` equals the viewport
   width, and that no element's box crosses the right edge.
5. **To check a CSS rule took effect:** measure the element's box. When two
   rules are equally specific, the one later in the file wins.

**C · After touching the About block**

1. Sweep the viewport **every 20px from 1440 down to 761**, and check there is
   no horizontal overflow at each width. The block is hidden at 760 and below.
2. At several widths, measure the bat's box against `.cstage` (the box that
   clips it) and check its flight path stays inside.

**D · Before merging a page, or pushing a draw-editor change**

1. **On a real phone, at pitch-side sizes:** open the changed page and use it.
2. **In PowerShell:** diff any shared page (for example `app.html`) against the
   base branch, and check that only the intended lines changed.
3. **For the draw editor, by hand:** pick a team chip, place it, and deselect
   it, in a pool, a match slot and a knockout slot. There must be no spots
   where a tap does nothing, and tapping a chip's rename or remove button must
   **not** also pick the chip.

**E · Back-office render audit**

1. Check every tab on both dashboards (`/organizer`, `/manager`), at desktop
   and 390px, **signed-in states included**. An audit of the default tab alone
   is not an audit.
2. Then look at the same tabs on `https://dev--adhquins-jrt.netlify.app`.

**F · Animation and app navigation**

1. **Measure animation in a page that is in the foreground, or in a local
   Playwright render.** A browser tab driven by Claude runs in the background,
   and Chrome freezes animation there (`requestAnimationFrame` and CSS
   animations stop). Take a screenshot as a cross-check.
2. **Test `/app`'s bottom tab bar on production, not on a deploy preview.**
   On a preview, Netlify's Deploy Preview drawer sits over the bottom of the
   page and swallows those clicks. `document.elementFromPoint` shows it. A
   preview is also a different address, so you have to sign in again there.
3. **When clicking by screen position after a save:** scroll to the top before
   clicking the age-group dropdown.

## How to verify

- Every reading has its control beside it, and they differ in the way the
  change predicts.
- For **A**: `dashboardRendered` is true, and no unrendered `{{ … }}`
  placeholders are visible on the page.

## If it fails

- **Every count is zero:** the page did not render (no React, or no session).
  Check A2 or B2 before believing it.
- **A font reports `error`:** the fonts CSS was served but the font files it
  points to did not load. Fix the interception, then measure again.
- **The rule reads right but the box did not move:** a rule later in the file
  won, or a broken comment above it switched it off. Measure, then move or fix
  the rule.
