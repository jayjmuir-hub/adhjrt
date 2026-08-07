# Design audit — whole site (2 Aug 2026)

> **Status: SHIPPED — all three batches merged to `main` 2 Aug 2026
> (`32ff4d4`, built as branch `potential`), live and deployed.** Every
> numbered item below was built, with two deliberate exceptions inside item
> 19: toast-vs-inline feedback grammar was left alone (Manager's saves
> already pair the toast with an inline message — no user-facing conflict
> worth the churn), and nothing test-pinned as a decision was touched. Two
> fixes improved on the diagnosis: item 11's chips/drop zones got
> `role="button"` + tabindex + Enter/Space rather than a `<button>`
> conversion (they contain buttons — nesting would be invalid HTML), and
> item 5's fix added a shared min-width floor so header and rows scroll as
> one unit. Pinned by `tests/test-design-polish.js` (48 checks, 22 injected
> faults). Full record: `claude/changelog.md`. The pre-build text below is
> kept as written — its "nothing has been changed" framing described the
> moment of diagnosis.

**What this is:** a diagnosis, not a build. All six pages plus `/legal` were audited
at `ea7a2b0` (current `main`/`dev`) against a design checklist — typography, colour,
layout, interaction states, content, accessibility, and the states pages forget
(loading, empty, error). Three parallel reviewers, one per slice of the site; every
high-severity claim then re-verified directly in the source. **Nothing has been
changed. Nothing gets built until you pick from this document.**

**What was deliberately NOT flagged:** the brand (Anton/Barlow, black/red/green),
the dark public site, the new light back office, and every decision recorded in
CLAUDE.md as measured or test-pinned (the 1000px HSBC hide, team codes in brackets,
no scores on the app's Fixtures tab, the venue chip contrast machinery, and so on).
The audit works *within* those decisions.

The overall picture is good: metadata, empty-state copy, error handling, safe-area
handling on the app, palette discipline and semantic structure all came back clean.
What's below is what didn't.

---

## Batch A — broken things (bugs wearing design clothes)

These aren't taste. Each one is doing something wrong today.

1. **Wrong home-screen icon path in 6 of 7 pages.** Every page except `app.html`
   links `/assets/icons/apple-touch-icon.png` — that folder doesn't exist; the file
   is at `/assets/apple-touch-icon.png`. Adding any page to an iPhone home screen
   gets a screenshot instead of the crest. One-line fix ×6 files.
2. **"Open in maps" goes nowhere useful.** The venue section's button links to bare
   `https://maps.google.com` — the Google Maps homepage, not Zayed Sports City. A
   parent taps it on match morning and gets a world map. Point it at a proper
   place-search URL for Zayed Sports City.
3. **Dark calendar/time icons on the light back office.** Five date/time inputs
   (`/organizer` ×3, `/manager` ×2) still carry `color-scheme:dark` from before
   light mode, so Chrome draws a light-on-light picker icon that's near-invisible.
4. **The Organizer confirm button is near-black text on brand red.** The modal's
   confirm button is `#E11B22` background with `#1A1C1F` ink — every other red
   button on the site is white-on-red (Manager's twin modal included). Poor
   contrast and off-pattern. Change the ink to white.
5. **`/scores` pool tables amputate the points column on phones.** The table
   wrapper is `overflow:hidden` around ~500px of fixed columns, so under ~540px
   wide the +/−, T and PTS columns are simply cut off with no way to reach them.
   Fix: `overflow-x:auto` so it scrolls sideways.
6. **`/scores` awards grid overflows on phones.** Cup/Bowl/Plate/Shield is a rigid
   4-across grid with no responsive fallback — ~85px per card on a 390px phone,
   names spilling out. Use the same auto-fit pattern the team key already uses.
7. **The app's bottom sheet can hide its own Close button on iPhones.** The sheet
   is `max-height:92vh`; with Safari's toolbar showing, 92vh is taller than the
   visible screen. Add a `92dvh` line after it (modern browsers use it, old ones
   keep the fallback).
8. **A dropped connection freezes the app forever.** `load()` and friends in
   `app.html` have no error handling — one failed fetch on flaky stadium signal
   and the tab says "Loading…" permanently. Add a "Couldn't load — tap to retry"
   card. On match day this is the one that matters.
9. **Small dead things:** the `/scores` footer link's hover colour never applies
   (the documented `!important` trap); a failed Google sign-in shows the identical
   error twice on `/signin`; one `#0E6B34` typo vs the pinned success green
   `#0E6B33`; leftover Manager-area CSS on `/scores`; `<html>` missing `lang` on
   most pages; `/legal`'s "Back to top" links are bare `href="#"`.

## Batch B — states and feedback (make it feel finished)

The biggest systematic gap on the whole site: **almost nothing reacts to being
hovered, pressed or focused.**

10. **Hover/active states, everywhere.** On the back office exactly two header
    links have hover feedback — no tab, button, or clickable row reacts to a mouse
    in a desktop tool. `/scores` has none at all. The app has no pressed feedback
    on its main tap targets (tab bar, match rows, pills). Fix: one consistent
    treatment per component class — slight darken on hover, slight scale on press,
    150–200ms transitions.
11. **Keyboard focus rings.** No `:focus-visible` styling anywhere on the homepage
    or back office; and the draw editor's team chips / drop zones are clickable
    `<div>`s that keyboard users can't reach at all. Convert to real buttons, add
    one site-wide focus-visible rule.
12. **Lining-up numbers.** No `tabular-nums` anywhere on a site that is mostly
    columns of scores — standings on `/scores`, the app tables, Manager's
    standings, the homepage countdown (its seconds visibly wobble). One CSS rule
    per page.
13. **Loading vs empty, told apart.** `/organizer` shows "No team registrations
    match your filters" *while the fetch is still running* — the exact ambiguity
    the dataError banner fixed for failures. `/scores` keeps showing the previous
    age group's table after you tap a new pill. The app's "Loading…" is static
    text indistinguishable from a freeze. Each gets its own small fix.
14. **Disabled buttons that look disabled.** Manager's "Generate knockout",
    "Replace the pools", Save/Discard while busy — currently identical to live
    buttons, full colour, pointer cursor. Apply the existing disabled treatment.
    Related: "+ Add pool" with no draw loaded throws silently; "Save changes"
    lacks a busy label its neighbours all have.
15. **The app's two native `confirm()` dialogs** ("Clear this result?", "Save as
    0–0?") drop a browser OS dialog into an otherwise fully app-styled flow.
    Replace with the inline two-button pattern.
16. **`/signin` and password managers.** No autocomplete attributes on the one
    page whose job is credentials — password managers can't reliably save or fill.
    Add `autocomplete="username"` / `"current-password"` etc., plus Enter in the
    username field advancing to sign-in.
17. **Modal manners.** No dialog closes on Escape (one exception); the homepage
    registration modals lack dialog semantics for screen readers. Add Escape +
    `role="dialog"` where missing.
18. **Anchor jumps hide headings under the sticky homepage header** — one
    `scroll-margin-top` rule fixes every nav link at once (the code already
    hand-compensates in one place, proving the offset).

## Batch C — polish and consistency (visible, worth your read)

19. **The back office reads as two products in places.** The Venue & days tab runs
    its own larger type scale than the rest of `/organizer`; Manager's table
    headers sit on a grey band, Organizer's on white; Manager confirms via toast,
    Organizer via inline sentences; the role-picker highlights red on `/signin`
    and green on `/organizer`. Each is a pick-one-and-apply-it-both-places job.
20. **Big-table scanability.** Teams (hundreds of rows, 12 columns) and Players
    have no row hover tint or zebra striping; the age-group filter dropdown sorts
    alphabetically (U6/U7/U8/U9 dumped last) even though the correct age-order
    map already exists in the same file; help paragraphs run ~180 characters wide.
21. **Homepage small stuff:** the age-card band labels render at 7.5px
    (unreadable); four slightly different greens serve as the accent (brand
    `#17A34A` plus three ad-hoc lighter ones); the mobile stat strip keeps stray
    desktop divider borders; the hero shard animations ignore
    `prefers-reduced-motion` (the crest animation honours it — extend the same
    courtesy); cool blue-greys on the warm cream sections.
22. **Header copy on `/organizer`:** wordmark says "ORGANIZER" (US spelling, vs
    "Organiser" in every label users read), subtitle still says "REGISTRATIONS"
    from before it had six tabs. Your call on both.
23. **A proper share card.** The `og:image` is the square transparent crest, which
    renders as a tiny logo on whatever background WhatsApp/Twitter picks. A
    1200×630 dark-brand card (crest + wordmark + dates) makes every shared link
    look deliberate. I'd generate the asset for your approval.
24. **A branded 404 page.** Currently a mistyped URL lands on Netlify's default
    grey page. One small self-contained dark page with a link home.
25. **`/organizer`'s six-tab bar doesn't wrap** on narrow windows (Manager's
    does) — drags the page into horizontal scroll.

---

## What I'd recommend

- **Batch A is worth doing regardless** — it's bug fixing, lowest risk, and two of
  the items (app fetch error handling, `/scores` phone clipping) directly affect
  match day.
- **Batch B is the biggest felt improvement per line changed** — the site's one
  systematic gap is interaction feedback, and the fixes are mechanical and
  brand-neutral.
- **Batch C needs your eye** — several items are judgement calls (spelling, accent
  consolidation, the share card), and I'd show renders before merging anything
  visible.

**Process, per house rules:** everything lands on `dev` (free), each batch as its
own commit, full suite + fault run green on your PC before anything moves, diff
and preview link (`dev--serene-gingersnap-1d0eb6.netlify.app`) to you, and one
15-credit merge to `main` when you're happy — not one per batch. A handful of new
test assertions where they earn their keep (icon path, no `color-scheme:dark` on
the light pages, autocomplete present on `/signin`), each proven against an
injected fault as usual. The light/dark palette tests are unaffected by all of
the above.
