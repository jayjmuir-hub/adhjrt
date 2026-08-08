# The hero on a phone: the HSBC ratio, the lockup order, the countdown

_Specced and built 8 August 2026, after Jay sent three screenshots._

## What was wrong, MEASURED not guessed

Taken on Jay's Chrome emulating a **Samsung S20 Ultra — 412px viewport, DPR 3.5,
real touch and mobile UA**. Two earlier attempts to measure failed and were
discarded rather than reported: `resize_window` left `innerWidth` at 1549, and
the sandbox cannot reach adhjrt.com at all.

| Finding | Measured |
|---|---|
| **Hero HSBC lockup squashed** | rendered 348×128 — **26.7%** narrower than its 3.707 ratio |
| **Sponsors HSBC lockup squashed** | rendered 266×96 — **25.2%** out. ⚠️ Jay only reported one; the second was found by measuring |
| Hero lockup position | **711px down the page** — below the fold, while the header mark hides below 900px |
| Countdown | five flex items at `min-width:82px` in 348px → wrapped into **three rows, 170px tall** |
| Body paragraph | flat `21px`, no `clamp()`, while the `h1` scales |
| Sideways overflow | **none** — `scrollWidth` 412 = viewport |

⚠️ **THE CAUSE OF THE SQUASH IS A PINNED HEIGHT BESIDE `max-width`.** At 128px
tall the mark wants 474px of width. Any narrower container clamps the width
while the height stays pinned, so the ratio breaks. It throws no error and
looks *almost* right, which is why it shipped.

## What was built

1. **Ratio guard, in CSS for both placements.**
   `.hero-partner img` and `a[href*="hsbc.ae"] img` get
   `height:auto + max-height`. Desktop rendering is unchanged; below the
   intrinsic width the mark scales proportionally.
   ⚠️ **Deliberately NOT edited in the tags.** `_prove-registration.js` pins the
   hero img verbatim (`HERO_IMG`) and the sponsors fault patches the literal
   `alt="HSBC" style="height:96px`. Editing either tag orphans a fault silently.
2. **A mobile-only lockup above the green date pill**, with the in-row one
   hidden at the same breakpoint. Chosen by Jay over moving the markup.
   ⚠️ CSS `order` could not do this — the mark is inside the button flex row and
   the pill has a different parent, and `order` cannot cross containers.
   ⚠️ The two are **mutually exclusive** and that pairing is asserted; a count
   of the images alone would pass on a page showing both.
3. **Countdown to one row on phones** — label on its own line, boxes share the
   remaining width.
4. **Paragraph `clamp(17px, 4.6vw, 21px)`** — desktop unchanged at 21px.

## The argument AGAINST a second lockup, recorded

It is a **fourth** copy of the mark on one page, and this project's own lessons
say copies drift. The alternative — moving the block in the markup — keeps one
copy but requires rebuilding the desktop "beside the buttons" layout, which is
currently correct. Jay chose the smaller, reversible change. **If a fifth
placement is ever proposed, revisit this rather than adding to it.**

## Test impact

- `test-sponsors.js`: three images → **four**; heights `.filter(Boolean)` so the
  deliberately-unpinned mobile mark contributes no number and the three fixed
  placements still read 19/128/96; "In partnership with" once → **twice**.
- **Five new faults**, and both ratio guards are injected — a rule guarding only
  one placement is half a fix.
- ⚠️ **Two faults were ORPHANED by renaming a check** ("three HSBC images" →
  "four") and the prover caught it. Repointed, not deleted.
- **719 → 724 faults. Baseline 33, UNCHANGED** — the proof a file was extended
  rather than added.

## Still unverified at time of writing

Rendered appearance on a real phone. The suite proves the rules are present and
that removing them fails; it cannot say the hero *looks* right. **Verify on the
`dev` branch preview before merging** — a branch deploy is free.
