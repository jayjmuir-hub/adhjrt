# ADH JRT — changelog, 7 August 2026

> **Fourth file in the chain.** Read order: **this file →
> `claude/changelog-2026-08-06.md` → `claude/changelog-2026-08-05.md` →
> `claude/changelog.md`.** New file rather than a prepend for the reason the
> 6 Aug header gives: prepending means re-emitting every existing byte through
> the model, and bytes do not survive that. If these are ever merged, do it
> with a real file transfer, not by retyping.

## THE ABOUT BAT REBUILT — CLIP-PATH WINGS AND AN `offset-path` FLIGHT (`db5ecfb`, LIVE)

Jay pasted the bat spec ("scope 2") and said *"build it and
⚠️ **NOTE, 7 Aug:** that spec was pasted into chat, **never committed** —
`claude/specs/spec-about-bat.md` does not exist and never has. Do not go
looking for it. The design that shipped is in
`claude/specs/spec-bat-offset-path-and-wings.md`.

Original line, kept so the record reads straight:  *"build it and
deploy"*. One 15-credit production deploy. `Compare` and `dev` carry the same
commit.

### What replaced what

| before | after |
|---|---|
| `@keyframes batfly` — 11 waypoints of `translate/rotate/scale` | `offset-path:path(…)` + `@keyframes fly{0%→100% offset-distance}` |
| `@keyframes batflap` — squashing the whole bat on X | `flapL`/`flapR` rotating two clip-path wing layers |
| `@keyframes batmorph` — crossfade to `crest-bat-real.png` | gone; the flat silhouette is used for the whole flight |
| one `<img class="bflat">` + one `<img class="breal">` | three `<span class="half">` over one background PNG |
| `.cstage` sized `calc(100% + 30px)` | fixed **600×583** canvas, extending left and up only |

### ⚠️ THE OLD FLIGHT WAS CLIPPED AND NO TEST SAID A WORD

Measured before touching anything: **31px cut off the right, 24–27px off the
top at three consecutive keyframes.** The spec had found one of those. It had
been live since the bat came back on 6 Aug.

The old test asserted `.cstage` had `overflow:hidden` — true, load-bearing, and
completely blind to whether the flight fits inside it. **A check that reads
"is there a clip" passes on a path that flies straight through it.**

`tests/test-about-board.js` now parses the `path()` string, samples all three
cubic Béziers at 200 points each, adds the bat's rotated half-extent, converts
from `.crest-anim`'s coordinate box into the stage's, and requires every sample
inside the rectangle. ⚠️ **Mixing the two coordinate systems is how a clipped
flight passes a clip check** — the path is authored in the 118px badge box, the
clip is a 600×583 box at a different origin.

Worst clearances, measured in a real Chromium at 61 points along the flight:
**L54 T30 R73 B141 px.**

### ⚠️⚠️ THE LANDING ANGLE — A REAL BUG, FOUND BY MEASURING, NOT BY READING

`offset-rotate:auto` points the bat along the path's **tangent**. So the angle
it rests at is decided by the shape of the curve, and is invisible in the
source.

The path as first authored left **51 degrees** between its departure heading
(−21.45°) and its arrival heading (−72.78°). The bat took off flush in the
shield's bat-shaped hole and **landed nose-up-left, sitting permanently askew
in a hole cut for a level bat** — with `forwards` holding it there. Every
duration, iteration, fill-mode and clip check passed. It renders perfectly.

Caught by screenshotting the rendered element and noticing the resting bounding
box was 132px wide on a 118px element — i.e. rotated.

Two fixes, and they are not independent:

- **last control point `(37,130)` → `(-10,86)`**, computed so the arrival is
  parallel to the departure. It exists for no other reason;
- **`offset-rotate: auto 14deg` → `auto 21.45deg`**, which is exactly minus the
  departure heading `atan2(26−59, 143−59)`, so heading + offset = 0.

Both are now asserted as arithmetic on the control points, with a fault for
each. Re-authoring the first curve segment changes the 21.45.

Verified: the rendered box is **118×118 at (101,64) at both t=0.5s and t=5.5s**
— unrotated, exactly the badge position, flush in the hole at both ends.

### ⚠️ `prefers-reduced-motion` REVERSED, AND THE OLD RULE WAS RIGHT AT THE TIME

The old rule set `animation:none; opacity:0`. That was correct **for batfly**,
which parked the bat wherever it happened to be — a stray bat over the photos
looks like a broken image.

`offset-path` killed that reasoning. With no animation the bat sits at
`offset-distance:0%`, which is `(59,59)`, which is its own centre, which is the
hole in `crest-shield.png`. **Hiding it now leaves a bat-shaped hole in the
crest for exactly the people who asked for less motion** — the same bug that
shipped on 5 Aug, arriving by a different door.

So: stop the movement, keep the picture. The `.half` layers are in the rule
too — a check on `.cf` alone passes while the bat sits parked and flapping.

⚠️ **The fault was INVERTED rather than repointed.** It used to inject
"freeze without hiding"; it now injects the previously-shipped `opacity:0`.

### The wings: three layers over one flat PNG, no cut artwork

`crest-bat.png` is a flat single-tone silhouette (620×620, 77% of opaque pixels
one dark tone). On a silhouette the wing root hidden behind the body is **the
same colour as the visible part**, so three clipped rectangles give everything
cut files would.

⚠️ **THE BODY BAND MUST NEVER ROTATE.** Rotating the two wing layers opens a
wedge at the cut line; the band is painted last and covers it. Two layers alone
leave a visible notch — and giving all three an animation looks *more* correct
than giving two, which is why there is a fault for it.

Clip regions must overlap, not meet: left keeps 0–56%, right keeps 44–100%,
band straddles 38–62%. Pivots are at 45%/38% and 55%/38% — **mirrored about the
midline and above the middle, where a shoulder is.** `transform-origin:50% 50%`
swings each wing around the centre of the whole bat and reads as shearing.

⚠️ **`crest-bat-real.png` IS NOT FLAT** (18 colour buckets) — it is shaded for a
static wings-out pose and smears when clipped into rotating wings. The asset
stays in the repo; a reference to it in the running page does not. Tombstoned,
with a fault that paints it again.

⚠️ **Known and accepted: the joints show as hairlines under magnification.**
The band's edge is unrotated and the wing outline underneath it is not, so at
the join the two silhouettes cannot coincide and the composite is a fraction
under opaque for about a pixel. Invisible at 1×; at 4× it reads as a wing
joint. Recorded in the CSS so nobody spends an afternoon chasing it.

### ⚠️ `scale` IS ITS OWN PROPERTY, NOT A `transform`

`offset-path` owns the element's transform matrix. Writing the dive as
`transform:scale()` overwrites it — **the bat scales up and down on the spot,
in the crest, for five seconds and never moves an inch**, while every duration,
iteration and fill-mode check passes. The standalone `scale` property composes
cleanly. Fault included.

### The stage: left and up only, never right or down

`.about-media` is the **right** column, so a right overhang eats the section's
32px padding and can put a horizontal scrollbar on the page — the exact bug the
clip exists to prevent. Extending left puts the bat over the text column, which
is free room and is what *"the whole About section"* meant.

⚠️ **The stage offset and the badge offset must move together.** The stage
moved by (−97,−60), so `.crest-anim` moved by (+97,+60) to stay at (4,4) of the
photo box. Editing one alone — which is what anybody nudging the flight would
do — slides the crest off the corner of the photo it pins. Asserted as a pair.

### The 30s dead-air timeline is gone

The old flight was ~40 hand-computed percentages over a 30s animation of which
only the first 18.6% moved, plus the checks that existed to stop somebody
"slowing the bat down" by stretching those percentages. `offset-path` needs
exactly two stops. **There are no percentages left to drift.**

What replaces those checks: the flight, the dive and both wings must agree
about *when*. ⚠️ **The wings run 11 times, not once, and that is not a loop** —
the old check required a literal ` 1 ` in every declaration, which would now
force the flap back into one 5s wing-beat for the whole flight. What must not
appear is `infinite`. The arithmetic `11 × 0.42s = 4.62s` has to land inside
the 5s flight: too high and the bat flaps on the crest after landing, too low
and it glides the last stretch with its wings locked.

### Tests and prover

**`test-about-board.js`: 238 → 277 checks.** All 38 suites green on the sandbox
and on cafnet.

**Prover: 697 → 717 faults, 717/717 caught by the named check, 33 suites clean
undamaged.** ⚠️ **The baseline staying at 33 is the proof the file was extended
rather than added.**

- **Eight existing bat faults repointed, none deleted.** Their anchors —
  `batflap 30s`, `batfly … infinite`, the two `<img>` bat elements, the old
  `.cstage` rule, the 18.633% keyframe — no longer exist. *A fault that cannot
  be injected is a failed run, not a pass.*
- **Twenty new ones**, each rendering a bat that looks finished: the stage
  shrunk, the path widened past it, the stage mirrored onto the right, the
  badge moved without the stage, the path start moved off centre, `auto`
  dropped from `offset-rotate`, the dive written as a transform, the band
  animated, the band dropped, the clips tightened until they meet, the band
  narrowed off the join, both pivots centred, one pivot moved, both wings
  sweeping the same way, `batfly` restored alongside `fly`, the real bat
  painted again, reduced motion hiding the bat, reduced motion leaving the
  wings running, and the two landing-angle halves.

### ⚠️ THREE OF MY OWN MEASUREMENTS WERE WRONG FIRST TIME

**1. `[^}]*` truncated `@keyframes fly{from{…}to{…}}` at the first inner
brace.** Invalid CSS, silently dropped by the browser, `offset-distance` stayed
at 0% — so the harness took **sixty identical measurements of a stationary bat
and reported "nothing clipped".** The same bug bit the `flapL`/`flapR` reader in
the test file in the same hour. Nested braces, twice.

**2. The first live harness measured 0×0 boxes at every width and said "all
widths clean".** `x-dc{display:none}` hides the source until the component
engine hydrates it, and the engine does not run off a plain static server.
**A negative check that passes because nothing was rendered proves nothing** —
this repo's own rule, broken again. The harness now aborts if the stage has no
size.

**3. `animation:fly …, dive …` is one comma-separated shorthand AND it contains
commas.** Anchoring on `animation:NAME` found `fly` and missed `dive`
entirely; splitting the value on `,` chopped `cubic-bezier(.45,.05,.4,1)` into
four pieces and found neither. Both produced `NaN`, which compares equal to
nothing and fails with a message that reads like the CSS is wrong. There is a
depth-aware splitter now.

**And a fourth, on the production readback:** grepping the deployed HTML for
`@keyframes batfly` and `crest-bat-real.png` reported both **still present** —
they are in my own tombstone comments. Re-checked with comments stripped: **0
live occurrences of each.** Fifth time this repo has hit the comment trap; the
tests already strip both syntaxes, the ad-hoc check did not.

### Verified live on adhjrt.com

Comment-stripped readback of the deployed page: `offset-path` ×1, three `half`
layers, `offset-rotate:auto 21.45deg`, `@keyframes fly`/`flapL` present, the
corrected control point `C41,264 -10,86 59,59` present, `.cstage` reading
`top:-60px;left:-97px;width:600px;height:583px;overflow:hidden`. Zero live
occurrences of `batfly`, `batflap`, `batmorph`, `.breal`, `crest-bat-real.png`
or `animation:none;opacity:0`.

⚠️ **The rendered-geometry verification could not be done against production
from the sandbox** — its network allowlist does not include the site
(`ERR_CONNECTION_RESET`). It was done against a harness carrying the CSS and
markup lifted verbatim out of the deployed file, in a real Chromium. Same
bytes, same numbers; not the same page. If anything about the bat ever looks
wrong on a real screen, that gap is where to look first.

## `b236a4b` — `CLAUDE.md`: THE BAT IS NOT MOTHBALLED — `[skip ci]`, rode with the deploy above

`CLAUDE.md` claimed the bat was mothballed. It was restored to production on
6 Aug (`4fc5c85`). Verified before correcting: production served
`@keyframes batfly`, `.cstage`, the markup and the arming script, and
`m-crestrow` appeared **0 times**. Acting on the false claim would have put a
second, motionless bat on screen — the crest.png-plus-bat failure the 6 Aug
entry documents.

Also corrected: the site password is on for **`non_production` only**, not
everything.

⚠️ It carries `[skip ci]` but was **not** the tip of the push, so it did not
suppress the build — the trap `690d208` recorded on 6 Aug. Check the tip, not
the presence of the marker.

## Outstanding

- **`compare--adhquins-jrt.netlify.app` is password-protected**, so a branch
  preview cannot be eyeballed by a driven browser without the password. Every
  appearance claim on this branch was verified by measurement instead. Worth
  knowing before planning a look-at-it-first workflow.
- **`batwings.bundle` was left at `C:\Users\Jay\GitHub\batwings.bundle`.** The
  device bridge cannot delete; it wants removing by hand.
- `Compare` is still in the Netlify branch-deploy allow-list and still exists
  on `origin`, byte-identical to `main` — same note as 6 Aug.
