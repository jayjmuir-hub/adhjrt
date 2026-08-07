# Spec — the supporters grid

**Status:** SHIPPED 5 Aug 2026 — `2f1dfae` → `c1cc033`, six deploys. Live and
verified live on adhjrt.com. **Eighteen sponsors, in their own colours.**
**Surface:** `#sponsors` on the homepage (`Quins JRT.dc.html`).
**Tests:** `tests/test-sponsors.js` (179 checks), faults in `tests/_prove-registration.js`.

---

## What it is

A grid of every 2026/27 sponsor, under **With the support of**, sitting **below**
the HSBC principal-partner card. It replaced the dashed "More partners will be
announced" placeholder.

The list is **data**, in `SPONSORS` near the top of the script block. Adding a
sponsor is one line and one file, not a markup edit.

```js
{ name: 'Oak View Group',                  file: 'assets/sponsor-oak-view-group.webp',   h: 51 },
{ name: 'Crompton Partners Estate Agents', file: 'assets/sponsor-crompton-partners.webp', h: 54, light: true },
```

---

## Hierarchy — the thing not to tidy up

HSBC is the **principal partner**. These are **supporters**. They must not be
folded into one wall of logos. That merge is the obvious visual tidy-up and it
quietly demotes the tournament's only confirmed partner. Warned about in
`CLAUDE.md`, asserted three ways, with a fault that injects exactly it.

---

## ⚠️ Nothing is recoloured. A failing mark gets a white box.

Jay's call, 5 Aug: *"put them on the black background, anything that was changed
can just go in a white box."* This **reversed** the design the first five
deploys were built on, which recoloured logos white to sit on the dark tile.

Every file is now the sponsor's own artwork in their own colours. A mark that
does not read on `#151517` carries `light: true` and gets a white box.

**The split is MEASURED, not chosen** — median WCAG contrast of the ink against
the tile, white box below 4.5:1:

| | |
|---|---|
| **white box (9)** | Brighton College, BEOND, Westminster, Broadway Malyan, The Bottle Store, Align Health, Anderson, Crompton Partners, Recover |
| **dark tile (9)** | Oak View Group, V&P, Ashurst, Sedbergh, McCafferty's, The Sportsman's Arms, Yas Mena Cycles, Arabian Swim Academy, Bili Boys |

**The nine are not the nine anybody would guess** — which is the whole argument
for measuring. **Re-measure when a file is replaced; never copy the flag from a
neighbour.**

The tile's background and border are **derived from the flag** in
`renderVals()` — the data says what the ARTWORK is, not what colour to paint a
box, so the two greys live in one place.

### ⚠️ Three logos can NEVER take a white box

**Oak View Group, V&P and Yas Mena Cycles exist only as white-on-transparent
files.** A white tile erases them outright. Asserted by name, with a fault that
adds the flag to Yas Cycles.

This is also why **lightening the whole section — asked for twice — stayed
rejected both times.** It is not a taste argument; it is three logos that
disappear.

### Both sides are asserted

"Nine are light" passes on a grid where **every** tile has gone white — exactly
the failure the request could have produced if taken literally and applied by
eye. So the dark nine are asserted too.

Faults cover: a tenth box appearing, a box being dropped (which hides a dark-ink
logo with no error anywhere), the tile hardcoding one colour again, the border
not following the background, and the written rule being deleted.

⚠️ **The "no hardcoded tile colour" check is SCOPED TO THE `sc-for` BLOCK.** The
HSBC card above it is legitimately `background:#151517`, so a section-wide
negative check fails on the principal-partner card. The slice asserts it is
non-empty first — *"no hardcoded colour in nothing"* would pass for ever.

---

## Artwork rules

Transparent background, trimmed to the ink, **never upscaled**, saved as
`.webp`. A file smaller than the house 160px tall is stored at native size
rather than padded up, so a better file replaces it later with no stretch baked
in: Broadway Malyan (439×82), McCafferty's (494×114), Align Health (244×56),
Crompton (236×97), Bili Boys (154×90), Recover (143×32).

**The recipe for a logo that arrives on a white ground:** key the white out with
`alpha = 255 - min(r,g,b)`, un-multiply so the ink keeps its true colour, crop
to the ink, scale DOWN to 160px tall if it is bigger.

### ⚠️ Bili Boys is the one file with an opaque ground

A cream badge with a printed border. It **stays on the dark tile** because it is
already a box — a cream rectangle inside a white one is worse. It is also **the
one logo the contrast measurement gets wrong** (it reads the ground as ink), so
it is pinned by hand with the reason written beside it. 154×90 is all the
artwork there is, so `h` sits below the formula on purpose.

---

## Sizing — `h`, and why it is not one number

    h = round(83.5 / sqrt(width / height)), clamped to 26..68

- **68** is what fits inside the 104px tile with 16px of padding.
- **26** is the legibility floor on a phone.
- Recompute `h` when a file is replaced — a new crop changes the ratio.
- Native-size files sit **below** the formula value on purpose.

### The bug this replaced

The first draft rendered every logo at `height:44px; max-width:100%`. Wrong
twice:

1. **It squashes wide marks.** With `height` fixed and only `max-width` clamped,
   a very wide mark renders *distorted*, not smaller. Nothing reports it.
2. **Equal height is not equal presence.** At 44px the near-square marks —
   Ashurst, The Sportsman's Arms — read as postage stamps beside a 5:1 wordmark.
   A sponsor-relations problem, not a cosmetic one.

The markup uses `max-height` (never `height`) plus `object-fit:contain`, so the
ratio always survives the clamp.

**This was caught by looking at a render, not by a test.** The tests were green
against the broken version.

⚠️ **And the render that found it was nearly wrong the other way.** The first
screenshot looked faded, which read as a broken reveal animation. It was an
EMPTY SHELL — `support.js` boots React from unpkg, the sandbox cannot reach it,
so every section measured 0×0. **A screenshot of nothing looks like a result**;
third time this repo has hit that. Route-intercept unpkg to a vendored React and
fonts.googleapis.com to local Anton/Barlow before believing any render.

---

## What the day cost, and what to do differently

**Six 15-credit deploys on one section.** Five were unblocked by artwork
arriving one file at a time after the previous had landed; the sixth reversed
the design the first five were built on.

Two things to carry forward:

1. When files are arriving piecemeal, ask *"is more coming in the next hour?"*
   before landing.
2. When a design rests on **one judgement call** — here, *recolour the logos or
   box them?* — get that judgement made before building on it five times. The
   render that made the choice obvious took ten minutes and no credits.

⚠️ **Eight fault anchors rotted in the final change and were REPOINTED, not
deleted.** Every rule they guard is still alive; their subjects moved. The run
named all eight rather than passing quietly. **Two changed meaning with the
design**: *"Anderson's red is flattened away"* became *"the white-box rule is
deleted, leaving the flags unexplained"*, and *"a third white tile"* became
*"a white box spreads to a logo that only exists as a white file"*. A fault
whose RULE has changed shape must change with it, or it guards a world that no
longer exists.

---

## Still worth chasing

Nothing is missing or wrong. Two files are smaller than ideal:

- **Recover** — 143×32 native, the smallest asset on the site.
- **Bili Boys Biltong** — 154×90, the second smallest.

One sentence covers both: *"do you have your logo as a vector, or a PNG at least
800px wide with a transparent background?"*

⚠️ **Ashurst Perkins Coie's teal is settled — approved, not pending** (*"ashurst
is good"*, Jay, 5 Aug). Do not raise it again.

---

## Tests

`tests/test-sponsors.js` §5b asserts:

- the count is **written out** (eighteen)
- the row pattern captures **any** extension, so a raw `.png` is reported by the
  *format* check rather than falling out of the list and tripping the *count*
  check
- every named file exists on disk — gated on `hasAssets`, because the prover's
  temp copy has no `assets/`
- every `h` is inside 26–68
- the markup binds `max-height:{{ s.h }}px`, never a fixed height, and keeps
  `object-fit:contain`
- **discriminating** sizing checks: the widest mark ends up *smaller* than the
  mid-pack and the squarest marks end up *larger*
- **exactly nine white boxes, named**, and the three that can never take one
  asserted individually
- the tile colour is derived from the flag; the border follows it; no hardcoded
  colour inside the loop
- Bili Boys on the dark tile at exactly 52, with its reason written down
- the white-box rule itself is recorded next to the data
- HSBC is above, separate, and not repeated inside the grid
- the get-in-touch invitation stays; the "more will be announced" copy is gone

### Traps worth remembering

⚠️ **`sponsor-*.webp` must stay in `NEEDED`** in `_prove-registration.js`. The
prover creates `assets/`, which flips `hasAssets` true, so without them the
suite fails on an *undamaged* copy. Same trap as `_signins.js` and
`Club.dc.html`.

⚠️ **An empty `forEach` is a check that asserts nothing while looking like
coverage.** The pending-artwork sweep looped over a list of slugs that emptied
itself out as each sponsor arrived; it was rewritten to assert every sponsor on
the page has a file behind it rather than left to decay into a no-op.
