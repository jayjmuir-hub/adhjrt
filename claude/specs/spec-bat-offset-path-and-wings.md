# Spec — the About bat: real wings, and a flight on a curve

_Written 7 Aug 2026. Scope agreed with Jay: **Scope 2** — wings + `offset-path`
flight. Not GSAP. **The bat still flies once**, and it gets **the whole About
section to fly in**, not just the photo box._

Prompted by comparing our bat against the one on a third-party preview site
(domain redacted),
which Jay preferred. That site is Next.js/React with GSAP; **we are not copying
its code, only its two techniques** — a continuous path instead of waypoints,
and wings that rotate independently of the body.

---

## 1. What is live today (MEASURED 7 Aug, not remembered)

Read off the deployed page in Chrome at a 1466px viewport.

**Markup**, inside `.about-media`:

```html
<div class="cstage">                        <!-- clip box, overflow:hidden -->
  <div class="crest-anim">
    <img class="cbase"  src="assets/crest-shield.png">   <!-- crest WITH the bat-shaped hole -->
    <div class="cf"><div class="cfl">
      <img class="bflat" src="assets/crest-bat.png">
      <img class="breal" src="assets/crest-bat-real.png">
    </div></div>
  </div>
</div>
```

**CSS**, three keyframe sets, all 30s, `1 forwards`, `paused` until a script
adds `play` when the section scrolls in:

| Rule | Does |
|---|---|
| `.cf` → `batfly` | 11 `translate/rotate/scale` waypoints. Flight is 3–18.6% of the 30s; the remaining ~24.4s is inert. |
| `.cfl` → `batflap` | Squashes the **whole sprite** `scaleX(.72) scaleY(1.16)`, 6 times. |
| `.breal` → `batmorph` | Crossfades flat bat → real bat. |

**Geometry at 1466px viewport:**

| Thing | Size | Position |
|---|---|---|
| `.cstage` | 563 × 553 | `top:-30px; left:-30px` of `.about-media` |
| `.about-media` | 533 × 523 | |
| `section.m-stack` | 1200 × 774 | the About section, capped at 1200 |
| crest (`.cbase`) | 118 × 118 | at **(4, 4)** inside `.cstage` |

### ⚠️ 1a. A live bug found while measuring: the bat is CLIPPED, twice

Forcing `.cf` to individual keyframes and measuring the bat against the clip box:

| Keyframe | Bat box in stage coords | Verdict |
|---|---|---|
| `12.861%` `translate(400%,30%)` | left 473 → **right 594** | stage is **563** wide — **31px cut off the right** |
| `10.833%` `translate(300%,-18%)` | **top −25** → bottom 106 | **25px cut off the top** |
| `14.733%` `translate(330%,140%)` | 396–510 × 171–284 | inside |
| `16.449%` `translate(150%,180%)` | 178–305 × 211–338 | inside |

So at the two furthest points of the flight the bat is sliced by its own clip
box. This is on production now. Narrower viewports shrink `.about-media`, so it
gets **worse**, not better — re-measure at each breakpoint during the build.

⚠️ **`.cstage` cannot simply be given `overflow:visible`.** The clip is
load-bearing: without it `batfly` carries the bat outside the box and puts a
horizontal scrollbar on the page. Widening the box is the fix; removing the clip
is not.

### ⚠️ 1b. A project doc is stale — corrected here

`changelog-2026-08-05.md` says the crest sits to the left of the eyebrow inside
`.m-crestrow`. **There is no `.m-crestrow` in the live DOM.** The About crest is
inside `.cstage`, pinned at the top-left corner of the photo box. The changelog
describes a state that no longer exists. Recorded so the next session does not
plan around a container that isn't there.

`assets/crest.png` (the complete crest, bat printed on) is still used twice —
header at 42px and footer at 36px. Untouched by this work.

---

## 2. The two changes

### 2a. Wings — replaces `batflap`

**`crest-bat.png` is a flat single-tone silhouette.** Measured: 620×620, six
colour buckets, 77% of opaque pixels one dark tone. That fact is what makes this
cheap — **no cut artwork is needed.** Three `clip-path` rectangles over the same
one PNG give everything cut PNGs would, including the wing root that must stay
hidden behind the body, because on a silhouette the hidden part is the same
solid colour as the visible part.

Geometry measured off the asset: ink runs x 15–85%, y 25–52%; the body column is
x 46–54%. Hence:

```css
.half   { position:absolute; inset:0; background:url(assets/crest-bat.png) center/100% no-repeat }
.half.l { clip-path:inset(0 44% 0 0); transform-origin:45% 38%; animation:flapL .42s ease-in-out }
.half.r { clip-path:inset(0 0 0 44%); transform-origin:55% 38%; animation:flapR .42s ease-in-out }
.half.b { clip-path:inset(0 38% 0 38%) }         /* body band, NEVER rotates, painted on top */
@keyframes flapL { 0%,100%{transform:rotate(8deg)}  50%{transform:rotate(-26deg)} }
@keyframes flapR { 0%,100%{transform:rotate(-8deg)} 50%{transform:rotate(26deg)} }
```

⚠️ **The body band is not decoration.** Rotating the two wing layers opens a
wedge at the cut line; the band covers it. Two layers alone leave a visible
notch — confirmed by eye against the real asset. Verified clean at 0°, 10°, 20°
and 28°.

⚠️ **`crest-bat-real.png` is NOT flat** — 18 colour buckets, no tone above 25%.
Clipping *that* into rotating wings would smear shading drawn for a wings-out
pose. **Decision: `batmorph` does not run during the flap.** Either drop the
crossfade, or keep the real bat only for the nest/landing state where the wings
are at rest. Cheapest is to keep the flat bat for the whole flight.

### 2b. Flight — replaces `batfly`'s waypoints

```css
.crest-anim .cf {
  offset-path: path("…");
  offset-anchor: 50% 50%;
  offset-rotate: auto 14deg;         /* banks into the turn; no typed rotations */
  animation: fly <D>s cubic-bezier(.45,.05,.4,1) .5s 1 forwards paused;
}
@keyframes fly { from { offset-distance:0% } to { offset-distance:100% } }
```

**Verified in Chrome on the live page before writing this:** `CSS.supports`
true; at `offset-distance:0%` the element's centre lands at exactly the path's
start coordinate. Support: Chrome 46+, Edge, Firefox 72+, Safari 16+.

**Scale-for-depth is kept** as a second, parallel animation on the same element
(`scale` only), because `offset-path` owns the transform and the two must not
fight.

---

## 3. ⚠️ The one hard problem, and the decision

**CSS cannot measure its container.** `path()` is literal pixels. The stage is
563px wide at 1466px viewport and narrower below that, so a single path string
either overflows on small screens or wastes space on large ones. This is the
whole reason the preview site generates its path in JS.

Three ways out, and why:

| Option | Verdict |
|---|---|
| One `path()` per breakpoint under media queries | **Rejected.** 2–3 hand-tuned strings, each needing an eyeball check, and eyeballing is what burns deploys. |
| `shape()` with percentages | **Rejected.** Chrome 130+/Safari 18.4 only; no Firefox. Not safe for a public site. |
| **Fixed-size flight canvas** | **CHOSEN.** |

**The chosen design:** the bat flies inside a fixed **600 × 560** canvas,
centred in the widened stage. One path string, authored once, correct at every
width where the bat is shown. The stage grows with the section; the *flight*
does not. Below the width where 600×560 no longer fits, the bat is hidden —
which is already the behaviour (hidden below 760px, and the photos are not even
fetched there).

**What this costs:** on a 1200px-wide section the bat uses the middle 600px
rather than roaming the full width. Jay asked for "the whole About section"; this
gives it materially more room than today's 563px box — and, unlike today, it is
never clipped. **If the full width matters more than the simplicity, that is
Option B/GSAP, and this decision should be revisited rather than bodged.**

### The argument AGAINST all of this, recorded because it will be made again

The flight fires **once**, on scroll-in, and most visitors will see it once.
Spending a day and a deploy on the smoothness of something seen once, on a
section that is hidden entirely on phones, is hard to justify on its own. The
honest defence is §1a: **the bat is visibly clipped on production**, that has to
be fixed anyway, and fixing it means touching this code regardless. The wings
(§2a) are the part with real payoff per unit of effort and would still be worth
doing if the flight work were dropped.

---

## 4. Tests

Baseline before: 37 files green; 653/653 faults; 32 suites clean.
`test-about-board.js` is the file that changes; **the suite baseline must stay at
32** (a file is extended, not added) — that number staying put is the proof.

| Assertion | Fault that must be caught |
|---|---|
| Body band exists and does **not** rotate | Remove `.half.b` → renders a seam at full flap, and every other check still passes |
| Wing clip regions and pivots pinned | Move a pivot to 50% → wings hinge at the centre line and tear |
| `offset-rotate` is `auto 14deg` | Set `auto 0deg` → bat flies flat, no banking, animation still completes |
| Path start == crest centre | Shift path start 40px → bat teleports on launch |
| **The whole flight stays inside the stage** | Restore the old 563px stage → §1a's clipping returns. **This is the check §1a should have had.** |
| Flat bat used throughout the flap | Re-enable `batmorph` under the wings → smeared shading, renders fine |
| Reduced motion: bat does not move, and does not vanish either | Kill the fade too → an accessibility failure that renders perfectly |
| No horizontal scrollbar at 6 widths | Remove the stage clip → the scrollbar bug returns |

⚠️ Every waypoint fault in the current suite must be **repointed**, not deleted —
there are no `batfly` percentages left to point at. A fault that can no longer be
injected is a failed run, not a pass.

---

## 5. Rollout

1. Build on **`Compare`**, off a **freshly fetched** `main`. Fast-forward
   `Compare` to `main` first — it must never be left behind.
2. Verify on the branch preview: measure the bat's box against the stage at every
   keyframe, at ≥4 widths, and confirm page `overflow` is 0.
3. One merge to `main` = **one production deploy (~15 credits)**. Do not iterate
   on appearance one deploy at a time; get it right on the preview.

## 6. Blocked on

**No folder from Jay's PC is connected to this session**, so the working method
(build in sandbox → `device_commit_files` → git on the PC) cannot complete. The
local GitHub MCP is separately returning `Bad credentials`. Nothing can reach
`origin` until a folder is added in the desktop app.
