# Spec — the pointer-gate hover sweep goes site-wide

**Status:** proposed, 6 Aug 2026. Test-only change. No CSS, no markup, no
behaviour, nothing deployed changes.

## The problem

`c3ea255` fixed the stuck-hover bug on the homepage and added a sweep so the
next component to grow a hover effect would be caught rather than shipped. The
sweep lives in `tests/test-about-board.js` and reads `HDRCSS`, which is

    const HDRCSS = stripCssComments(PAGE);   // PAGE = 'Quins JRT.dc.html'

**The homepage and only the homepage.** The rule it enforces — anything that
moves or animates on hover must sit inside `@media (hover:hover)` — is a
site-wide rule being checked on one page out of ten.

## What the code actually looks like today (measured, 6 Aug)

Every `:hover` block in the repo was extracted and its body tested for
`transform` / `animation` / `box-shadow`.

- **Nine such rules exist. All nine are on the homepage. All nine are already
  inside `@media (hover:hover)`. Zero outside.**
- The other pages' hover rules change `filter:brightness`, `background`,
  `color` or `text-decoration` only. `test-about-board.js` says why that is
  fine, in its own words: *"A hover rule that only changes colour is harmless
  when it sticks."*
- `app.html` already gates its hover rules and nobody asserted that anywhere.

**So this fixes no live bug.** It is coverage for a rule that is currently
satisfied everywhere, on nine pages where nothing is watching it. That is worth
saying plainly rather than dressing it up: the homepage's version of this bug
was also satisfied-everywhere right up until it wasn't, and it was then live and
invisible for four days.

## Where it goes, and why not where the existing one is

**`tests/test-design-polish.js`, not `test-about-board.js`.**

- `test-design-polish.js` is already the site-wide file. It defines `ALL_PAGES`
  and has a section called *"Interaction feedback rules are present on every
  page"*. A cross-page hover rule belongs beside that, not inside a file about
  the About-section carousel.
- ⚠️ **The existing homepage sweep is NOT moved and NOT rewritten.** Three
  faults in `_prove-registration.js` are anchored on its text. Moving a check
  orphans the fault anchored on its old name, silently — written down in
  `state-of-play.md`, and not worth re-learning here. The homepage keeps its
  sweep and its four named checks (`.fmt-grp`, `.reg-btn`, `.fmt-day`,
  `.rules-btn`), which are the ones actually measured on a touch viewport.
- The new sweep therefore overlaps the homepage deliberately. That is a general
  sweep with a specific one inside it, which is the shape this repo already
  prefers, not two copies of one rule.

## Pages covered

`ALL_PAGES` (8) **plus `Club.dc.html` and `rules.html`** — ten files.

⚠️ `ALL_PAGES` is deliberately left at eight. Adding the two files to it would
silently extend every other loop that uses it (apple-touch-icon, og:image,
twitter:image) and change what those checks assert, which is a different change
wearing this one's clothes. The hover sweep gets its own list.

**Out of scope, recorded so nobody re-opens it:** `deck-stage.js` and
`image-slot.js` carry `:hover` rules in injected CSS, and **no page in the repo
references either file** (grepped). They are editor-side surfaces, not the
public site. If either is ever loaded by a page, it joins the list.

## How the gate is detected

⚠️ **By matching braces, not by matching the homepage's formatting.** The
existing sweep anchors on

    /@media \(hover:hover\)\{[\s\S]*?\n  \}/

— one space after `@media`, no space around the colon, and a closing brace at
exactly two spaces of indentation. **`app.html` writes it `@media(hover:hover){`
with no space at all.** That anchor does not see `app.html`'s gate, so a sweep
built on it would report `app.html`'s correctly-gated rules as ungated the
moment one of them grew a `transform`. The new sweep opens on
`/@media[^{]*hover\s*:\s*hover[^{]*\{/` and counts braces to the close, so
spacing, indentation and a compound query (`… and (min-width:900px)`) all work.

## The checks

1. **No page has a hover rule carrying `transform` / `animation` / `box-shadow`
   outside a pointer gate.** Failure message names the file and the selector.
2. **The sweep read real CSS on every page** — a floor on the total number of
   `:hover` rules seen. Without it, a stripper bug or a bad regex turns the
   sweep into a pass over an empty set, which is the failure mode this repo has
   hit in three separate disguises.
3. **The sweep actually saw rules that move or animate** — a floor on the loud
   count, so check 1 cannot be satisfied by there being nothing to check.
4. **`app.html`'s hover rules stay pointer-gated** — named, because it is the
   one non-homepage page that has a gate today and nothing asserts it.

Floors are set from the measured counts at `1c26612` and written as `>=`, not
pinned equals: the point is to catch the set collapsing to nothing, not to make
adding a link a test failure.

## Proof

Three new faults in `_prove-registration.js`, each injected into a **different**
file so no one anchor covers two of them:

| Fault | File | Must be caught by |
|---|---|---|
| the back-office buttons grow a lift on hover with no pointer gate | `Manager.dc.html` | check 1 |
| the rules page grows a hover effect that moves, outside the gate | `rules.html` | check 1 |
| the match-day app's hover rules lose their pointer gate | `app.html` | check 4 |

⚠️ Fault 2 is on `rules.html` specifically because it is one of the two files
**not** in `ALL_PAGES` — it proves the new list is really being used and not
quietly falling back to the old one.

⚠️ Fault 3 rewrites `@media(hover:hover)` to `@media(pointer:fine)` rather than
deleting it. `app.html`'s hover rules are colour-only, so degating them does not
trip the loud sweep — only the named check can catch it, which is what makes
that check worth having rather than decoration.

## Expected effect on the numbers

- Faults: **630 → 633**.
- Clean baseline suites: **31 → 31, unchanged.** This extends an existing file
  rather than adding one, so the baseline must NOT move. ⚠️ If it does, the run
  proves nothing and something else changed.
- Test files: **36 → 36.**
- `NEEDED`: **no change.** All ten page files are already in it — verified
  before writing this, because a test that starts reading a file absent from
  `NEEDED` dies on ENOENT and reports its faults as caught while proving
  nothing. That trap has been hit four times in this repo.

## Landing

Built and committed on `Compare` (0 credits). It touches no served file, so
there is nothing to look at on the preview — the proof is the suite on jay-pc.
**Merging to `main` needs an explicit yes from Jay** and costs 15 credits, and
there is no reason for this to make that trip on its own; it should ride with
the next real change.
