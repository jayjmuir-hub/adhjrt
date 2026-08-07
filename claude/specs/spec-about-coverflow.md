# Spec — the About photos as a coverflow carousel

**Status:** specced 6 Aug 2026, **no code written**. Asked for by Jay, pointing
at `https://motion.dev/examples/react-carousel-coverflow`: *"can we do something
like this for the about section rotating pictures?"*

**Branch:** would be built on `Compare` (currently `824cd02`), which already
carries the crest, the flying bat and the red rules button. Not `main`.

---

## The decisions already taken

Jay chose these before any code; they are not open questions.

| | |
|---|---|
| Layout | **Bleed the carousel off the right edge of the page.** Columns unchanged. |
| Interaction | **Auto-advance PLUS drag/swipe.** |
| Library | **None.** See "Why not Motion" below. |

---

## ⚠️ Why not Motion, since that is what was linked

**Their source is paywalled.** The example's code is Motion+ (paid
subscription) only. Anything built here is a rebuild of the *effect*, not a copy
of their code. Coverflow is a transform arrangement, not a trade secret, so this
costs nothing except the temptation to assume the library is required.

**The page already has the whole toolkit.** The existing ring is a 3D CSS
transform scene — `perspective`, `preserve-3d`, `rotateY`, `backface-visibility`.
Coverflow is the same primitives arranged differently. Motion would add:

- a new external script to a page that currently loads **zero** animation
  libraries;
- another CDN that has to be up — and **unpkg has been unreachable in the
  sandbox four times** on this project, each time producing a render that looked
  exactly like a broken page;
- a `crossorigin` + SRI tag, which has already cost a round of debugging when
  the `access-control-allow-origin` header was missing;
- weight, on a section whose whole design story is that the visible photo costs
  ~23 KB.

**If the effect ever needs physics the CSS cannot express** — spring-based
throw, velocity-tracked inertia — that is the moment to revisit this, and the
argument for it should be written down here rather than assumed.

---

## The layout: bleed, and the arithmetic behind it

⚠️ **Widening the photo COLUMN was the obvious move and it is wrong.** At the
1200px cap the section's content box is 1136px and the gap is 70px, so the two
columns share 1066px:

| photo column | text column left |
|---|---|
| 394px *(today's panel)* | 672px |
| 533px *(today's box)* | 533px |
| 620px | 446px |
| **700px** *(what coverflow wants)* | **366px** |

On 5 Aug a **430px** text column could not hold the 66px Anton heading — that is
why it had been cut to 52px, and why `19e8f5d` restored two equal columns at
Jay's request. **Widening to 700px leaves 366px, which is worse than the version
he rejected.** So the columns stay as they are and the carousel takes its width
from outside the grid instead.

### The bleed

`.about-photo` keeps its grid cell but extends past its right edge to the
viewport edge:

    margin-right: calc(-1 * max(32px, 50vw - 568px));

Derivation, written out because it must be redone by hand if the section's
max-width or padding ever change:

    section content width  = min(1200px, 100vw) - 64px      32px padding each side
    content right edge     = (100vw + min(1200px, 100vw))/2 - 32px
    distance to viewport   = (100vw - min(1200px, 100vw))/2 + 32px

    100vw >= 1200px  ->  50vw - 568px      (grows with the screen)
    100vw <  1200px  ->  32px              (just the section padding)

`max(32px, 50vw - 568px)` is exactly those two branches and is continuous at
1200px, where both evaluate to 32px.

**Effect:** at a 1440px viewport the box is 533 + 152 = **685px**; at 1920px it
is **925px**. The text column keeps 672px and the heading stays at 66px.

⚠️ **The right border-radius has to go** — a rounded corner hard against the
screen edge reads as a mistake. Left corners keep 18px, right corners 0.

⚠️ **THIS IS THE MOST LIKELY THING TO BREAK, AND IT BREAKS SILENTLY.** A box
sized to end exactly at the viewport edge is one sub-pixel rounding error away
from adding a horizontal scrollbar to every page on the site. It must be swept
every 20px from 1440 down to 761 and asserted, not eyeballed — the header has
already produced a 6–12px overflow that was live for days at 762–770px and
nobody noticed.

---

## The effect

Five cards visible: the centre one face-on, two each side angled inward and
pushed back. Values below are the starting point, to be tuned against a render.

| card | translateX | rotateY | translateZ | scale | opacity | z-index |
|---|---|---|---|---|---|---|
| centre (d=0) | 0 | 0deg | 0 | 1 | 1 | 10 |
| d = ±1 | ±0.62 × CW | ∓42deg | −120px | 0.90 | 0.75 | 9 |
| d = ±2 | ±1.18 × CW | ∓52deg | −260px | 0.80 | 0.45 | 8 |
| \|d\| ≥ 3 | off-stage | — | — | — | 0 | 0 |

- `CW` (card width) replaces `--pw` as the one variable that drives everything.
  Keep the same discipline: every other number is a `calc()` off it.
- Scene keeps `perspective:1200px`, matching the ring.
- Transition ~600ms on `transform` and `opacity`, one shared easing.
- Auto-advance every 5s, the interval the ring already uses.

### Inherited constraints — all of these still apply

These are paid-for lessons, not preferences. Every one has its own check today.

1. ⚠️ **NO `box-shadow` on a card or its pseudo-elements.** In a
   `preserve-3d` scene with `backface-visibility:hidden` it stops the `<img>`
   painting at all. Use a `border` with `box-sizing:border-box` and check every
   card, not just the front one.
2. ⚠️ **NO `overflow`, `opacity` or `filter` on the 3D container.** Any of them
   flattens `preserve-3d`. Clipping belongs on `.about-photo`.
3. ⚠️ **Angles normalised to −180..+180.** Chrome treats `rotateY` past 180° as
   back-facing and silently never paints it.
4. ⚠️ **`sizes` must track the card width in all three places**, or every
   visitor downloads a larger file than they need and nothing reports it.
5. ⚠️ **Lowercase or snake_case locals only.** `encodeCase()` rewrites
   whitespace + camelCase + `=` into an `sc-camel-…` attribute name inside
   `<script>` bodies, which threw a SyntaxError on every page load once already.
6. ⚠️ **Re-scanning boot, never find-it-once.** The engine re-renders the body
   after first paint more than once. Set the built flag at the END.
7. ⚠️ **Hover/active effects behind `@media (hover:hover)`.** A touch device
   applies `:hover` on tap and never removes it.
8. ⚠️ **`prefers-reduced-motion`: auto-advance stops, drag still works.**
   Movement the visitor initiates is not the movement the preference is about.
   Cards cross-fade rather than glide.
9. ⚠️ **Fail-safe.** Card 1 hard-coded in the markup, filling the box until the
   script adds `.ready`. JavaScript off, or any throw, leaves one static photo —
   which is what was there before the ring.
10. ⚠️ **Hidden below 760px, and NOT downloaded there.** Takes all three of: the
    CSS hiding `.about-media`, the `<picture>` media fence with the 1x1 GIF
    first source, and the build guard on a host with no client rects.
11. ⚠️ **Costs nothing unwatched** — stops when scrolled off screen and when the
    tab is hidden.

---

## Drag and swipe

Pointer Events, not touch/mouse pairs. `setPointerCapture` on the scene so a
drag that leaves the box still tracks.

    down    record x, freeze auto-advance, mark dragging
    move    offset = x - startx; cards follow at offset/CW of a step
    up      step = round(offset / (CW * 0.62)), clamped to ±2
            settle to the new index, resume auto-advance after ~4s

⚠️ **`touch-action: pan-y` ON THE SCENE, AND THIS IS THE WHOLE BALLGAME ON
TOUCH.** Without it a horizontal drag steals vertical scrolling and the page
traps the visitor's finger inside the carousel. With it, the browser keeps
vertical scroll for itself and only gives us horizontal movement.

⚠️ **The About block is hidden at and below 760px**, so on a phone this code is
not reachable at all. Drag matters for a mouse and for **tablets at 761px+** —
which is exactly the band nobody tests, and where the stuck-hover bug lived for
four days.

⚠️ **A drag must not fire the link/lightbox on release.** Track distance moved
and suppress the click if it exceeds a few pixels; otherwise every swipe ends in
an accidental activation.

**Keyboard:** the scene is focusable, left/right arrows step it. This costs
almost nothing and a carousel that only responds to dragging is unusable for
anyone who does not drag.

---

## What this replaces, and what it costs

**Replaces** the eight-panel cylinder from `f6e991a`…`e7056ba`: `--pw`, `--ph`,
`--r`, `PANELS`, `TURN`, the `1/(2·tan(180/PANELS))` radius, and the panel
recycling that lets eleven photos live on eight panels.

⚠️ **THE PHOTO RECYCLING IS WORTH KEEPING.** It is why a twelfth photo costs no
extra DOM, and why only three images load on arrival with five more on idle.
Coverflow needs 5 live cards, so the same trick applies with a different number.
**Do not rebuild this as eleven cards each with its own `<picture>`** — that is
eleven downloads on arrival instead of three.

**The crest and the flying bat stay exactly where they are** (top-left of the
photo box, `Compare` branch). They are positioned against `.about-media`, not
against the scene, so the bleed does not move them. ⚠️ **`.cstage` must still
clip the bat's flight path** — and the box it lives in is about to get wider,
so the clip has to be re-checked, not assumed.

### Tests

`tests/test-about-board.js` currently asserts the RING: `PANELS` against the
ring radius, `--turn` against `TURN`, the eight-panel geometry, `--pw` at ~74%
of the grid-derived column. **Those checks' subject is being replaced, so they
are repointed to the coverflow's equivalents, not deleted** — the rules behind
them (one variable drives the geometry; the CSS and the script agree on the
timing; `sizes` agrees with the card width) all survive.

New checks needed, each with an injected fault:

- the bleed produces **no horizontal overflow**, swept 1440 → 761;
- `sizes` agrees with `CW`, derived rather than pinned;
- `touch-action: pan-y` is present on the scene — its absence is invisible on a
  desktop and traps a finger on a tablet;
- a drag past the threshold does **not** fire a click;
- auto-advance stops under `prefers-reduced-motion` but **drag still works**;
- all five card slots reference files that exist on disk;
- the fail-safe first card is still hard-coded in the markup.

⚠️ **The baseline suite count must go UP** if a file is added, and the fault
count must move. ~520 lines of ring shipped with the fault count unchanged at
499 — that is how the parse error survived a day.

---

## Risks, stated before starting

1. **The bleed adds a page-wide horizontal scrollbar.** Highest-likelihood
   failure, silent, affects every page. Swept and asserted.
2. **Drag fights scroll on touch.** Mitigated by `touch-action`, but only real
   testing on a tablet proves it.
3. **Coverflow may simply look worse here than the ring.** The ring works
   *because* it is narrow and mysterious — one photo at a time swinging through
   a slot. Coverflow shows five at once and is a busier, more commercial look.
   ⚠️ **Render it and look before landing.** If it is worse, the ring is one
   `git checkout` away and that is not a wasted afternoon.
4. **Two moving things in one block.** The bat already flies here. A carousel
   that also drifts may be one animation too many — which is *exactly* why the
   bat was mothballed on 5 Aug when the ring arrived. **This is the same
   judgement call, and it will be made again on this branch.**

---

## Not doing, unless asked

- Lightbox / full-size view on click.
- Captions or credits per photo.
- Reflections under the cards. Classic coverflow has them; they need a second
  copy of every image or a `-webkit-box-reflect` that only WebKit honours, and
  the section's black ground makes them read as smudges.
