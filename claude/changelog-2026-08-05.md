# ADH JRT — changelog, 5 August 2026 (afternoon and evening)

> **This is a continuation of `claude/changelog.md`, not a replacement.** That
> file holds everything up to and including the supporters grid (`ba5028d`) and
> remains the record for it. The entries here are the ones that came after, on
> the same day.
>
> ⚠️ **Why it is a separate file.** `changelog.md` is large enough that
> `project_read` on it times out more often than it succeeds (six attempts on
> 3 Aug), and there is no copy of it on either PC — it lives only in the Claude
> project. Prepending to it means re-emitting every existing byte through the
> model, and **bytes do not survive being re-emitted through the model** is a
> lesson this project has already paid for. Paraphrasing forty kilobytes of
> history to add three entries is a bad trade. If the two are ever merged, do it
> with a real file transfer, not by retyping.
>
> **Read order: this file first, then `changelog.md`.**

## THE ABOUT-SECTION ROTATING PHOTO RING — merged to `main`, LIVE, 5 Aug 2026 (`f6e991a` → `e7056ba`, eleven commits)

The static lineout photo in the About section became a **cylinder of eight
panels turning on its vertical axis**, cycling eleven photographs, clipped by
the box so a photo swings in from the left, comes face on, and swings out to the
right. Built across eleven commits in one run.

**This entry is written from the commits and the deployed page, not from having
built it** — the session that built it did not write it up, which is why it sat
undocumented for a day.

### The design, and the four things that keep it cheap

**One variable drives the geometry.** `--pw` (panel width) is set on
`.about-photo`; `--ph`, the ring radius `--r` and the box height are all
`calc()`s off it. There is no magic radius to keep in step by hand.

    --pw   clamp(190px, 44.4vw - 55px, 480px)      760px+  two-column
           ^ superseded the same evening by 19e8f5d - see the entry above.
             The section went back to two equal columns, so the panel is
             clamp(190px, 37vw - 50px, 394px) now. The numbers below are
             the shape of the thing; the two live ones are --pw and sizes.
    --pw   clamp(170px, 74vw - 30px, 520px)        <=760px stacked
    --ph   calc(var(--pw) * 1.25)                  panel aspect, 600/480
    --r    calc(var(--pw) * 1.20711)               1 / (2 * tan(180deg / 8))
    height calc(var(--ph) + 48px)                  24px clear above and below

Measured at 1400 / 1200 / 1000 / 860 / 760 / 600 / 400px: the panel stays
**74–76% of the box at every width**. ⚠️ **If `PANELS` changes, 1.20711 changes
too** — `tools/make-board-photo.py --geometry <width>` prints it.

**Repo size is not page weight.** The eleven photos add ~2 MB to the repo; the
photo you can see costs **~23 KB on a 1x screen**, against the 110 KB static
photo it replaced. Measured on the deployed page, not estimated. Four separate
mechanisms do that work, and all four matter:

1. **Sized to the panel, not the box** — panels are 480 CSS px, so files are
   960px (2x), not the box width.
2. **AVIF with a WebP fallback**, offered via `<picture>`. ~30% under WebP.
3. **Eight panels, not eleven.** Photos cycle *through* the panels: on each step
   the panel that has just turned to the back — invisible behind
   `backface-visibility` — is repointed at the photo it will need four steps
   later, ~24 s of lead time. **A twelfth photo costs no extra DOM at all.**
4. **Three load, five wait.** Only the front panel and its two neighbours are
   visible on arrival; the rest are pointed on `requestIdleCallback` and carry
   `fetchpriority="low"` so they never race the hero image.

⚠️ **The `sizes` attribute is load-bearing.** Without it the browser assumes the
image fills the viewport and always takes the 960px file, silently doubling the
cost. It must track `--pw`. **If page weight ever jumps, check that first.**

**Fails safe.** Panel 1 is hard-coded in the markup and the CSS makes it fill the
box until the script adds `.ready`. With JavaScript off, or if anything in the
script throws, you get one static action shot — exactly what was there before.

**Costs nothing when unwatched** — it stops turning when scrolled off screen and
when the tab is in the background.

### ⚠️ It worked locally and did nothing deployed. Twice. For two different reasons.

This is the part worth keeping.

**1. `build()` set its `__built` flag on ENTRY.** If it ran while the component
engine was midway through re-rendering — element present, its inner `.jrtb-ring`
not yet — the early `return` left the host flagged as built when it was not. The
re-scanning loop then skipped it for ever and the board sat there as a single
static photo: `built:true, ready:false, panelCount:1`. **A flag claiming success
before success happened.** It is set at the END now; bailing out without setting
it means the next scan simply retries.

**2. The boot scan was find-it-once.** The engine renders the page body after
first paint and does it **more than once**, so a one-shot "found it, stop
looking" builds an element that is then thrown away and replaced by one nobody
builds. It now keeps looking for 20 seconds and builds any `.jrtb` that is not
built yet; `build()` is idempotent per element, so re-scanning is free.

**LOCAL GREEN IS NOT DEPLOYED GREEN.** Both bugs are invisible from a local file
and fatal on the deployed site, and both produce a page that looks finished.

### ⚠️ Three CSS traps, all found by rendering rather than by reasoning

- **Never put a `box-shadow` on `.jrtb-p` or its pseudo-elements.** On the
  element, **no panel paints its `<img>` at all** — just the background colour.
  On a `::before`, the front panel paints and every angled one does not. It is a
  compositing bug with `box-shadow` on or inside a `backface-visibility:hidden`
  element in a `preserve-3d` scene. Confirmed by removing only the shadow and
  watching the photos return. If an edge is ever wanted, use a `border` with
  `box-sizing:border-box` and check EVERY panel, not just the front one.
- **Never put `overflow`, `opacity` or `filter` on `.jrtb-ring`.** Any of them
  forces the browser to flatten `preserve-3d` and the ring collapses into a flat
  horizontal squash. Clipping belongs on `.about-photo`.
- **Panel angles are normalised to −180..+180, not 0..360.** Chrome treats
  `rotateY` past 180° as back-facing, so with angles of 225/270/315° **the entire
  left-hand side of the ring silently never painted.** Proved by giving the left
  panel a red background and its mirror image a green one at identical geometry:
  green appeared, red never did. `315deg` and `-45deg` put a panel in exactly the
  same place; only one of them renders.

⚠️ **760px, not 700px.** That is where `.m-stack` collapses this section to one
column. Using 700 left a 60px band where the box had gone full-width but the
panel was still sized for two columns — the photo sat at 40% of the box in a sea
of empty space.

⚠️ **A note on verifying it by script:** forcing `transform:none` on the
`[data-reveal]` wrapper to skip the fade-in disturbs the 3D compositing and makes
panels appear blank in screenshots. **That is the measuring technique, not the
page.** Scroll to it and let the reveal finish on its own.

### ⚠️ The crest went live with a piece missing

`assets/crest-shield.png` is **the crest with a bat-shaped HOLE cut out of it**.
It exists only as the backdrop the mothballed animation's bat flew out of and
landed back into. Mothballing the bat (`c6f3871`) left the shield in place as the
About badge, and **the crest sat on the live site with a piece missing until Jay
spotted it.**

`CLAUDE.md` had made it worse: its Brand section claimed the shield *"reads as a
complete club crest on its own, which is why the badge itself was left in
place"*. That is false, and it is what put the broken crest live. The correction
already existed further up the same file, so the two contradicted each other;
`e7056ba` made them agree and left the old note saying plainly that it was false.

The badge is `assets/crest.png`, the complete logo, at 96px. ⚠️ **If the flying
bat is ever restored, swap the badge back to `crest-shield.png` IN THE SAME
CHANGE**, or there will be two bats on screen at once.

**The bat animation is MOTHBALLED, not deleted.** `crest-bat.png` and
`crest-bat-real.png` stay in the repo — the whole point of mothballing is that it
comes back cheaply. The CSS, markup and script came out in one commit, each with
a comment where it was. ⚠️ If it returns it needs the **re-scanning** boot the
board now uses, not the find-it-once pattern it had, which is precisely the bug
the board hit on the same day.

### The crest moved twice, and the reasons are worth keeping

1. It was pinned over the top-left corner of the photo box. Once the photos
   underneath started rotating it **read as a sticker stuck on a moving thing**.
2. It was then beside the `<h2>` only, which pushed the heading right and left it
   out of line with the eyebrow above it.

It now sits to the LEFT of the eyebrow and the `<h2>` together, inside
`.m-crestrow`, so "About the festival" and "Rugby the way it should be" share one
left edge. On a phone the row stacks and the crest goes above.

⚠️ **It cannot hang in the left margin.** That needs ~116px outside the content
column; the section caps at 1200px with 32px padding, so below roughly 1430px
viewport there is no margin to hang in and it would be clipped. That is why the
eyebrow moved inside the row instead.

### `assets/action-lineout.jpg` is tombstoned, not lost

It was the single static photo in this section until 5 Aug. Nothing loads it now.
**The file is left in place deliberately** — it is a good shot and costs nothing
sitting there. Recorded because "why is the old photo not referenced any more" is
a question somebody will ask.

### `f587c56` — the `tests/` 404 rule had NEVER worked

Found while adding the same kind of rule for the new `tools/` folder, by
**checking it on the deploy instead of trusting the config**.
`/tests/runall.ps1` had been returning a plain **200** for as long as the rule
existed, while the comment above it said otherwise.

The cause: **the rule pointed at itself.**

    from = "/tests/*"
    to   = "/tests/:splat"     <- self-referential
    status = 404

**Netlify DROPS a self-referential redirect rather than applying it**, so the 404
status was never reached and the real file on disk was served. The target has to
be a DIFFERENT path; both rules now point at `/404.html`.

⚠️ **The identical mistake was made again in the `tools/` rule first**, by
copying the shape of the broken one. Both are fixed and both comments now carry
the re-test instruction: fetch the URL on a deploy and look for 404. **Reading
the toml proves nothing, which is exactly how this went unnoticed.**

Impact is tidiness, not security — the repo is public and nothing in `tests/` or
`tools/` is secret. **But a config that documents a protection it does not
provide is worse than no rule**, because someone will rely on it one day.

### What was NOT done, and should have been

⚠️ **Eleven commits and ~520 lines of homepage shipped with NOT ONE new
assertion.** The injected-fault count was 499 before this run and 499 after. By
this project's own rule — a change nothing asserts is a change that silently
regresses — that is a gap, and it is how the parse error below survived a full
day. It was closed the next commit, in `fc39e2f`.

⚠️ **There is no spec.** Anything bigger than a tweak gets a spec before it gets
code; this got eleven commits and none. The reasoning survives in `CLAUDE.md`'s
Layout section and in the commit messages, which is better than nothing and is
not the same thing.

### Verified

`e7056ba` brought `CLAUDE.md` up to date with the section as it actually ended
up, including the ring geometry, the five traps above and two stale figures (the
sizes warning said 800px where it is 960; clear space said 40px where it is 24).
Docs only, tests green, exit 0, 34 files.

**Deployed:** `6a73210804434a00084d74a6`, production, `ready`, `commit_ref`
`e7056ba`, secret scan clean, 33 functions.

## THE RING IS ON A BLACK GROUND AGAIN — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`d6f0533`)

Jay: *"lets make the background of the 3d picture rotation black again, i want
to see what it looks like."* Rendered first, shown, then kept. One 15-credit
deploy (`6a73fd1b07dafe000867b6e1`, production, `ready`).

`#F3F1ED` → `#0C0C0E` — what it was until `65f319c` swapped it to cream a few
hours earlier, and the same near-black as the header and hero.

**Both readings are defensible and the page has now had both**, so the argument
for each is recorded in the CSS rather than left to be rediscovered:

- **Cream** made the box the same colour as the section behind it, so the box
  vanished and the photos appeared to float on the page.
- **Black** makes it a framed object, and the wedges that open either side while
  the ring turns become part of the effect instead of empty space.

**Do not flip it a third time without asking.**

### ⚠️ The colour lives in THREE places and only two were changed

The box, the 3D scene, and **the panel itself** each carry it, because all three
show through at different moments.

**The panel is the one that gets forgotten.** Its background is visible only for
the instant before its photo has decoded — and five of the eight panels start
with no `src` at all — so it survives every screenshot taken a second later.
Left cream against a black box it flashes as a pale rectangle, which reads as a
**broken** image rather than a loading one.

It was caught by re-reading the comment above the rule, which said in as many
words that the colour was duplicated in three places. **The comment was right
and it had been skimmed.** It now also says which of the three gets forgotten,
and why.

### Tests: 136 → 141 checks, four new faults

All three surfaces are pinned individually **and asserted to agree with each
other** — two dark and one cream is the failure mode, not "one of them is a
slightly different dark". Plus a check that the reversal and the argument for
cream both stay recorded, because a tombstone that gets tidied away is how a
decision gets made twice.

⚠️ **Two of the new checks were wrong before they were right:**

- the block read `HDRCSS`, a const declared LATER in the same file, so the whole
  suite died on a `ReferenceError` rather than failing a check. **A test file
  that cannot load reports nothing at all** — and it was only visible because
  the runner's output was read rather than its exit code trusted.
- the box's anchor ran through the comment block above the rule to reach the
  colour. The comment is the single most likely thing in that file to be
  reworded — **and it was reworded in this very commit**, so the anchor broke
  immediately. It reads the rule with comments stripped now.

**567/567 faults caught, 30 suites clean, 35 files green** — run on jay-pc as
well as the sandbox. Tree hash `80700691…` matched both sides. No overflow at
any width from 1440 to 360; geometry, the mobile hide, the pointer gates and the
scroll-spy are all untouched.

## THE STUCK-HOVER FIX REACHES THE CARDS AND THE REGISTER BUTTONS — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`c3ea255`)

Jay: *"push it to go live so we get it off our plate."* One 15-credit deploy
(`6a73ed2f5b075e0008b314d2`, production, `ready`).

The header fix (`2e57420`) shipped alone; this is the rest of the same bug, in
the place the header inherited it from.

`.fmt-grp` (age-group trading cards) and `.reg-btn` (Register buttons) carried
the identical `animation:holoShift 2.2s ease-in-out infinite` with no pointer
query. **Measured on a 390px touch viewport, 2.5 seconds after a tap: both still
shimmering, glowing and tilted, indefinitely.** Live since 1–2 Aug.

⚠️ **The Register button is the worst of the three:** tapping it opens the
registration modal AND leaves the button lit up, tilted and shimmering behind it
for as long as the modal is open.

`.fmt-day` (the two day cards) and `.rules-btn` (added the same afternoon) carry
quieter versions and were gated in the same pass, so the page has one rule
rather than four exceptions.

### ⚠️ The desktop look is deliberately unchanged

`infinite` stays for a mouse — it is right for a card you brush past, and Jay is
happy with it. **Only the stuck state goes.** Verified against the DEPLOYED page
in the same harness: hovered, both cards and buttons still report
`holoShift/infinite` at opacity .7 with the tilt applied, identical to live.

### ⚠️ And the first desktop measurement said I had broken it

The card came back `animation-name: none` while apparently hovered, which reads
exactly like a regression. **The code was fine.** The harness called
`scrollIntoViewIfNeeded` AFTER hovering, the page moved, the cursor was no
longer over the card — so it measured an element at rest.

Fixed by scrolling FIRST, parking the mouse on real coordinates, and asserting
`el.matches(':hover')` at the moment of measurement. **A measurement that does
not check its own preconditions is how a clean change gets reverted.** The same
harness then baselined the live page and returned the identical reading, which
is what proved the desktop behaviour unchanged rather than merely claimed it.

(While it was running, the day card came back `transform:none` when hovered. It
does that on the LIVE page too — pre-existing, unrelated, and not touched here.)

### Tests: 127 → 136 checks, four new faults

**The new coverage is a SWEEP, not four literals.** Every `:hover` rule on the
page whose body contains `transform`, `animation` or `box-shadow` must sit
inside an `@media (hover:hover)` block. Colour-only hover rules are left alone —
they are harmless when they stick. **The next component to grow a hover effect
will not be called `.fmt-grp`**, and this catches it.

Paired with two guards that matter as much as the sweep:

- a check that the sweep still has something to sweep, because **a filter that
  matches nothing passes loudly**;
- two checks that the mouse effect SURVIVES — **gating must not quietly become
  deleting**, and one of the four faults does exactly that.

**563/563 faults caught, 30 suites clean, 35 files green** — run on jay-pc as
well as the sandbox. Tree hash `48e74349…` matched both sides.

⚠️ **The other pages were not swept.** `/scores`, `/app`, `/organizer`,
`/manager` and `/signin` have their own hover rules and have never been checked
on a touch viewport. Nothing has been reported; it is recorded in
`state-of-play.md` because the homepage's version was invisible for four days
and only surfaced when somebody used the site on a real device.

## ⚠️ THE HEADER SHIMMER WAS STUCK FOR EVER ON TOUCH — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`2e57420`)

Jay, an hour after the header shipped: *"the header buttons continue to shimmer
forever after being pressed, i thought they only did that temporarily?"* One
15-credit deploy (`6a73e17b32262e00083a30a3`, production, `ready`).

### The bug, and why it shipped

The sweep was `animation:holoShift 2.2s ease-in-out infinite`, **copied wholesale
from `.fmt-grp`**. On a mouse that self-corrects: the pointer leaves, `:hover`
goes, the animation stops.

**A touch device has no pointer to leave.** It applies `:hover` on tap and keeps
it applied until you touch something else — so the loop ran with nothing that
could ever end it. Measured on an 820px touch viewport, the band where the nav
bar is still shown rather than collapsed to the ☰ panel:

| | animation on the nav item |
|---|---|
| before tap | `none` |
| after tap | `holoShift`, iteration-count **infinite** |
| **3.4s later** | **still `holoShift`, still infinite** |

and on desktop, correctly, `none` again the moment the mouse moved away.

⚠️ **One rule, two completely different experiences, and only the forgiving one
had ever been looked at.** Every render, every measurement and every screenshot
taken while building the header used a synthetic mouse. Nothing in the process
would ever have found this; Jay found it in about an hour of ordinary use.

### Fixed two ways, because they are two faults

1. **All the hover treatment is behind `@media (hover:hover)`.** A real pointer
   gets it; a tap produces no hover state at all. The current-section underline
   is not a hover effect and still shows on touch, so a tablet is not left with
   nothing.
2. **The sweep runs ONCE.** A new one-way keyframe `holoSweep`, .9s, `forwards`,
   ending past the far edge so the bright band leaves rather than parking
   mid-item. Verified by reading the animation's own play state: **finished at
   900ms, still finished at 3s**, with only the pill tint left while the pointer
   stays.

`infinite` is right for an age-group card you brush past. **A nav item is a
thing you rest on while you read seven of them**, and a permanent shimmer under
the cursor is noise. It is also what the effect was described as when Jay picked
it — "a shimmer crossing the item" — so the code now does what the sentence
said.

⚠️ **`:focus-visible` STAYS OUTSIDE THE POINTER QUERY.** A keyboard user has no
pointer at all; sweeping the outline in with the hover rules would take it from
the people who need it most. There is a fault that does exactly that.

### Tests: 117 → 127 checks, six new faults

⚠️ **Two of the new faults were NOT caught first time, and both were the CHECK
being too weak rather than the fault being wrong:**

- *"no hover rule escaped the query"* compared TEXT: for each `:hover` rule found
  in the file, was that same string also inside the block? **That is true even
  when a rule has been moved OUT**, because an identical string is still sitting
  inside. It counts occurrences now — in-file must equal in-query — which cannot
  be fooled that way. The prover reported it as *"failed, but not on the named
  check"*, which is precisely the distinction that run exists to make.
- the focus check read only the **first** `hover:hover` block, so a fault that
  wrapped the outline in a second one slipped past. It reads every block now.

**559/559 faults caught, 30 suites clean, 35 files green** — run on jay-pc as
well as the sandbox. Tree hash `129d5b0f…` matched both sides.

### ⚠️ The same fault is still live on two other components

`.fmt-grp` (the age-group trading cards) and `.reg-btn` (the Register buttons)
carry the identical `infinite` rule with no pointer query. **Measured on a 390px
touch viewport, 2.5 seconds after a tap: both still shimmering, glowing and
tilted, indefinitely.**

It has been live since 1–2 Aug and it is where the header inherited the bug
from. On a phone, tapping "Register a team" leaves the button lit up behind the
modal that has just opened over it.

**Jay chose to ship the header fix alone.** Recorded in `state-of-play.md`'s
known gaps as item 1, with the remedy (the same one-line pointer query) and the
warning not to "fix" it silently inside an unrelated change — it is a visible
behaviour change on phones and deserves to be its own decision.

## THE ABOUT PHOTO HIDDEN ON PHONES — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`961fb14`)

Jay: *"can we hide the photo in mobile mode?"* One 15-credit deploy
(`6a73533790dbc9000883d1da`, production, `ready`).

### ⚠️ The measurement that decided how it was built

**`display:none` does NOT stop a browser downloading images inside the hidden
element.** Measured BEFORE writing anything: **16 requests and ~290KB** to
`assets/board` at 390px with the block fully hidden.

So a CSS rule on its own would have hidden the section while a phone went on
paying for every photo in it — the worst version of this change, because it
looks finished and reports nothing. **Asking the question first is what stopped
that shipping**, and it is the reason Jay was given the choice between "hide it"
and "hide it and stop the downloads" rather than being handed the one-liner.

### Three things, any one of which alone is cosmetic

1. **The CSS hides the whole grid CELL** (`.about-media`), not just the box
   inside it. Hiding `.about-photo` alone leaves the stacked layout's 34px gap
   behind as a band of dead space under the text.
2. **The fail-safe `<picture>` gains a FIRST source** with
   `media="(max-width:760px)"` carrying an inline 1x1 transparent GIF. A matching
   `<source>` wins over the `<img src>`, so a phone resolves a data URI and never
   asks for a photo. Both real sources are fenced with `media="(min-width:761px)"`
   so they cannot match there; 760/761 meet exactly, with no width matching
   neither. ⚠️ **The `<img src>` stays a real photo** — it is only used when no
   source matches, so it remains the desktop no-JS fail-safe.
3. **`build()` returns early on a host with no client rects**, so the script does
   not construct eight panels, point six `<picture>`s and run a timer for a
   section nobody can see.

⚠️ **THE GUARD DELIBERATELY DOES NOT SET `__built`** — the same reasoning as the
ring lookup beside it. Flagging a hidden host as built means a phone turned
sideways, or a window dragged past 760px, **never gets a ring at all**: the scan
would skip it for ever. Bailing out without the flag means the next scan retries.
And because the 20-second boot scan is long over by the time anybody rotates a
phone, `boot()` now also re-scans on `resize`, debounced.

### ⚠️ Adding that source caused a bug nothing would have caught

`point()` addressed the sources by **INDEX** — `s[0]` = avif, `s[1]` = webp.
Inserting a third source at the front of the markup shifted every index by one,
so the avif srcset landed on the phone source and the webp srcset on the source
declaring `type="image/avif"`.

**No error. Nothing visibly different.** The front panel just quietly started
serving WebP instead of AVIF — about 30% more bytes. It was found by reading
`currentSrc` off a render, not by any check.

`point()` finds the sources **by type** now, which is what it should always have
done. **Anything keyed off DOM order breaks the moment somebody inserts an
element above it.** It has a check and a fault now.

### Verified by counting requests, not by reading rules

| | before | after |
|---|---|---|
| 390px | 16 requests, ~290KB | **0 requests, 0 bytes** |
| 1400px | 16 requests for 8 distinct files | **9 requests for 8** |

The desktop improvement is a side effect worth recording: the front panel no
longer fetches its `src` and then its `srcset`.

Read back off adhjrt.com after the deploy: at 390px the cell computes
`display:none`, the ring is not built, and the panel image resolves to the data
URI. At 1400px it is unchanged — eight panels, ready, real photos. No horizontal
overflow at any of 1200 / 1100 / 1000 / 900 / 860 / 800 / 700 / 600 / 500 / 390 /
360px, measured with the real Anton and Barlow.

### Tests: 53 → 66 checks, eleven new faults, 531/531 caught

**Two checks were repointed rather than deleted when their subjects moved:**

- the sizes-breakpoint check followed 760 to where it now lives — the hide rule
  and the picture's media conditions — instead of being dropped along with the
  `(max-width:760px) 74vw` clause it used to read. The builder cannot run below
  760px any more, so a phone clause in `sizes` would be describing a case that
  cannot happen, and it was removed rather than left as decoration.
- the stacked-override check was an **adjacency check pretending to be a
  breakpoint check**: it required `.about-photo` to sit immediately after the
  `@media` line, and it broke when the hide rule was added above it — on a change
  that did nothing wrong. It asserts containment in the same block now, which is
  what it always meant.

⚠️ **Two faults were not caught first time, and both were the fault's own fault
rather than the check's:**

- the breakpoint fault **indented its injected closing brace**, and the
  media-block regex matched `\n}` strictly — so the match ran on into the NEXT
  block and swallowed the rule it was supposed to have moved out. Hardened to
  `\n\s*}`. **A lazy pattern that matches too much passes for the same reason it
  should fail.**
- the by-index fault changed only the declaration and left the type loop below it
  intact, which reassigned both variables correctly. **A no-op is not a fault.**

## THE ABOUT SECTION RE-PROPORTIONED — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`19e8f5d`)

Jay: *"i want to make the pic block smaller in the about section, remove the
quins logo, and restore the wording to the size it was originally."* One
15-credit deploy (`6a73498f2a0e6400082d7bf6`, production, `ready`).

### ⚠️ Three asks, one change — and the reason is worth keeping

The photo column had been widened from `1fr` to `1.5fr` when the rotating ring
went in that morning, **and that is why the heading had been cut from
`clamp(34px,5.5vw,66px)` to `clamp(30px,4.4vw,52px)`**: a 66px Anton heading
does not fit a 430px column. The wording was never a design decision in its own
right; it was a consequence of the photo getting bigger. So restoring the
original two-equal-columns grid does both jobs at once.

| | before | after |
|---|---|---|
| grid | `1fr 1.5fr`, 60px gap | `1fr 1fr`, **70px gap** |
| photo box | 646×648 | **533×541** |
| heading | `clamp(30px,4.4vw,52px)` | **`clamp(34px,5.5vw,66px)`** |
| eyebrow gap | 10px | 16px |
| crest | 96px `assets/crest.png` | **removed, tombstoned** |

**Noticing that the three asks were one change is most of the value here.**
Treated as three, the crest comes out and the heading goes up inside a column
that cannot hold it, and the next session gets asked to shrink the wording again.

### ⚠️ The ring geometry had to follow, and it would have failed silently

`--pw` was **480px — 74% of the OLD, wider column**. Left alone in a 533px box
that is **90%**, so the photos would have run almost edge to edge and the section
would have read as cramped rather than smaller. **Nothing would have errored.**

It is `clamp(190px, 37vw - 50px, 394px)` now, and the arithmetic that produces it
is written out above the line rather than left to be reverse-engineered:

    content width  = 100vw - 64px          32px padding each side
    photo column   = (content - 70px) / 2  two equal columns
    panel at 74%   = 37vw - 50px
    capped at 1200px: (1136 - 70) / 2 = 533px column -> 394px panel

**The `sizes` attribute moved with it in all three places.** It is the browser's
only advance warning of how wide the panel will be; had it kept saying 480 while
the CSS said 394, every visitor would have gone on downloading a bigger file than
they need, reported by nothing anywhere.

### The crest is tombstoned, not quietly deleted

It had already moved twice before it went, and both reasons are arguments against
putting it back in either place: pinned over the photo box it **read as a sticker
stuck on a moving thing** once the photos rotated; beside the `<h2>` alone it
pushed the heading out of line with the eyebrow above it. And it cannot hang in
the left margin — that needs ~116px outside the content column, which does not
exist below about a 1430px viewport.

**The dead `.m-crestrow` media rule went with it in the same commit.** CSS that
selects nothing reads as if something still uses it.

### Tests: 42 → 53 checks, seven new faults

**The crest check's SUBJECT was deleted but its RULE was not, so it was repointed
rather than dropped.** `crest-shield.png` — the crest with a bat-shaped hole in
it — is still asserted to be nowhere on the page, and its fault now swaps the
FOOTER crest for it instead of the About badge that no longer exists.

New: the About section carries no crest; the dead CSS rule is gone; the tombstone
survives; **the crest is still on the page elsewhere** (asserting an absence
without the presence it is measured against is how a whole logo disappears); and
the heading is back to 66px.

⚠️ **The two that matter are DERIVED, not pinned literals:**

- **`sizes` must agree with `--pw`** — both read out of the page.
- **`--pw` must be ~74% of whatever column the grid actually gives it** —
  computed from the section's own `grid-template-columns` and `gap`.

So the next re-proportioning fails in the suite rather than on Jay's screen.
Proven in both directions: the old grid with the new `--pw` fails, and the new
grid with the old `--pw` fails.

⚠️ **One fault came back as "failed, but not on the named check" first time.**
The grid regex used `\d+` and could not match the `1.5fr` the fault injects, so
it tripped the was-it-located check instead of the one with something to say.
Widened to `[0-9.]+` and re-proven. **That distinction is the entire reason the
prover makes it** — the fault looked caught either way.

**523/523 faults caught by the named check, 30 suites clean, 35 files green** —
run on jay-pc as well as the sandbox. Tree hash `3ddda398…` matched both sides.

### ⚠️ And the first measurement was wrong in the alarming direction

The pre-flight render reported **15–85px of horizontal scroll between 800 and
1015px** — which looks exactly like a regression this change had introduced.

**There is none.** The sandbox cannot reach Google Fonts, the page had fallen
back to system faces, and **those are wider**. Re-measured with Anton and Barlow
served from npm through `route()`: **zero overflow at 1200 / 1100 / 1000 / 900 /
860 / 800 / 700 / 600 / 500 / 390 / 360px** — and zero on the deployed version
measured in the same harness, which is what proved the first reading was the
harness and not the page.

Third time this repo has been bitten by a render missing something it needed
(unpkg twice, fonts once before). **Check the deployed baseline in the same
harness before believing a regression**, and vendor the real faces before
believing any width.

### Verified live after deploying

Read back off adhjrt.com itself: the grid is `1fr 1fr` with a 70px gap, `--pw` is
the new clamp, the heading clamp is `34px,5.5vw,66px`, **zero crest images inside
`#about`**, three copies of the 394px `sizes` string, and no `.m-crestrow` rule
anywhere. Re-rendered from the deployed page at 1400 / 1000 / 390px: panel
**73.9%** of the box at all three, no page errors, no overflow.

## ⚠️ THE RING SHIPPED A PARSE ERROR ON EVERY PAGE LOAD — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`fc39e2f`)

Found the next day by rendering the deployed homepage while checking that the
About section actually worked. **Every load of adhjrt.com was throwing:**

    SyntaxError: Failed to execute 'appendChild' on 'Node': Unexpected token '-'

One 15-credit deploy (`6a733a6e0f31ad0009549437`, production, `ready`,
`commit_ref` confirmed, secret scan clean — 188 files, 0 matches, 33 functions).

### The cause: the component engine rewrites your JavaScript

`support.js` runs `encodeCase()` over the **whole component** before it is
parsed. Its regex is

    /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g

and it exists for a good reason: HTML attribute names are case-insensitive, so a
camelCase *attribute* has to be encoded as a kebab-case `sc-camel-…` name to
survive the parser. **It does not stop at `<script>` boundaries.**

The board script declared its screen-visibility flag as
`var at=0, turning=false, timer=null, onScreen=true;`. Whitespace, a camelCase
name, an equals sign — so it became `sc-camel-on-screen=true`, and the copy of
the script the engine mounts into `<head>` stopped parsing.

### ⚠️ Why nobody saw it, which is the whole problem

**A second, unmangled copy of the same script executes in place.** So the ring
built, turned, and looked perfect; the only symptom was a line in a console
nobody was reading. It shipped, and it survived a day of people looking at the
page.

**If the engine's mount order ever changed so the head copy were the only one,
the section would die with no other warning.**

Fixed by renaming to all-lowercase `onscreen`. ⚠️ **Spacing does not help** —
`onScreen = true` matches the same regex. Property access (`el.onScreen`) is
safe: the regex needs whitespace before the name. Use lowercase or snake_case for
locals in these scripts.

### How it was pinned to this change rather than guessed at

The deployed page was mirrored locally and rendered at `ba5028d` (the tip before
the ring) and at `e7056ba` (after) in the same harness: **old page, zero page
errors; current page, that error.** Then again after the fix: clean, with the
geometry unchanged.

⚠️ **The sandbox cannot reach unpkg, and that trap was hit AGAIN on the way** —
the fourth time in this repo. The first render showed eight panels at 0×0 because
React never booted, which looks exactly like a broken section. Vendoring React
and Babel from npm and serving them through Playwright's `route()` is the fix —
**and the fulfilled response needs an `access-control-allow-origin` header**,
because those script tags are `crossorigin` with SRI hashes, and without the
header the integrity check fails and React never boots, which looks exactly like
the original problem. That cost two rounds.

### The suite the ring should have shipped with

**New `tests/test-about-board.js` — 42 checks, 15 faults.**

The important one is deliberately **general**: a sweep of every inline `<script>`
in every `.dc.html`, using the engine's own regex, for a camelCase assignment.
**The next one will not be called `onScreen`.** Comments are stripped first — the
engine rewrites inside a comment too, but a rewritten comment cannot throw, and a
check that fired on prose would be untrue and would eventually be deleted by
somebody who was right to delete it.

The rest: `PANELS` agrees with the CSS ring radius (recomputed as
`1 / (2 tan(180/PANELS))`, not compared to a magic number); the CSS `--turn` and
the script `TURN` are the same number; the `sizes` string appears three times
identically and at the 760px breakpoint the layout actually uses; all four files
of every photo set `PHOTOS` names exist on disk; no `box-shadow` on `.jrtb-p`; no
`overflow`/`opacity`/`filter` on `.jrtb-ring`; angles normalised; `build()` flags
success only after seating the panels; the boot loop keeps re-scanning; the badge
is `crest.png` and the holed shield is not referenced by any live element.

**Absence checks strip comments first.** This page documents the very traps it
avoids — *"do NOT put box-shadow on `.jrtb-p`"* — so a bare substring check would
match the warning telling you not to write it and pass for ever. Same house rule,
hit again.

**And the two `netlify.toml` folder rules are pinned here too**, because
`f587c56` fixed them the same day and nothing covered them: each must return 404
and its target must NOT be inside the folder it redirects. A fault points
`/tests/*` back at itself.

⚠️ **The 44 board files joined `_prove-registration.js`'s `NEEDED` list in the
same commit** — generated with a loop rather than typed out, so the list cannot
drift from `PHOTOS`. Without them the suite fails on an **undamaged** copy, and a
suite that fails undamaged reports every one of its faults as caught while
proving nothing. **Fourth time this repo has hit that** (`_signins.js`,
`Club.dc.html`, `sitemap.xml`/`robots.txt`, the sponsor logos).

### Verified

- **35 files green in the sandbox AND on jay-pc** at `fc39e2f` — 36 `--- <file>`
  headers counted in the runner's own output, 0 `FAILURES` blocks, "All green".
  jay-pc had not run the suite since `42fcad6`; it has now.
- **514/514 injected faults caught by the named check, 30 suites clean on an
  undamaged copy** — up from 499/499 and 29. **The baseline number going up is
  the only proof the new suite ran undamaged at all.**
- **Tree hash `78275bb6…` matched between the sandbox and the PC** — content
  identity across every byte. Moved by `git bundle`, so the commit SHA is
  identical on both sides.
- **VERIFIED LIVE AFTER DEPLOYING, not just green:** the deployed homepage
  re-rendered with no page errors, the ring unchanged (8 panels, 8 distinct
  photos, panel **74.3 / 74.0 / 74.0%** of the box at 1400 / 1000 / 390px), and
  `/tests/runall.ps1` and `/tools/make-board-photo.py` both still 404.

### ⚠️ Five doc claims corrected in the same commit, each of which was giving instructions

1. **The site-wide password is OFF.** `CLAUDE.md` said it was ON in two places —
   **two days after `state-of-play.md` recorded the correction.** An accuracy pass
   scoped to one file leaves every other copy still talking to the next session.
2. **Every Netlify preview URL in `CLAUDE.md` was DEAD.** The host is
   **`adhquins-jrt`**, not `serene-gingersnap-1d0eb6` — wrong in seven places.
   Measured: `dev--adhquins-jrt.netlify.app` → **200**;
   `dev--serene-gingersnap-1d0eb6.netlify.app` → **404**. Anyone following the
   file to preview a branch for free got a 404 and would reasonably have
   concluded branch deploys were broken. The site was renamed at some point and
   nothing recorded it. **Fetch a URL before writing it into a doc, and again
   before believing one you read there.**
3. **"401 means the deploy exists" died with the password.** That test was
   written on 2 Aug when the password gate answered 401 for a real deploy and
   404 for a missing one. **An existing deploy answers 200 now.**
4. **Test counts:** 31 files / 370 faults → 35 files / 514 faults.
5. **Outstanding item 3** still said only HSBC was confirmed, the day after
   eighteen supporters shipped.

## THE MASTER MANAGER INVITE KEY IS `"*"`, NOT `"admin"` — 5 Aug 2026, docs only (`987ba40`, `[skip ci]`, no deploy, 0 credits)

A documentation bug that had been sitting in the file for weeks, carried on
`state-of-play.md`'s job list, and could never have announced itself.

`manager-signup.js` derives the account's age group from **whichever KEY NAME in
`MANAGER_INVITE_CODES` matched the submitted code**:

    const ageGroupId = Object.keys(codes).find((id) => codes[id] === inviteCode);

and the all-groups test in `_auth.js` is `session.ageGroupId === '*'` — a literal
asterisk. **Both setup instructions told you to call the master key `"admin"`.**
That mints a manager scoped to an age group that does not exist: the account
signs in perfectly well and can see nothing.

⚠️ **It fails CLOSED, so it was never a hole.** It is the quieter kind of wrong —
the docs and the code disagreed, following the docs produced a broken account,
and no error appeared anywhere. Nothing validates these key names against the
real age-group ids either, so an ordinary typo fails the same silent way. That is
recorded rather than fixed: rejecting unknown keys at signup is a behaviour
change, and this commit deploys nothing.

**The check asserts that the two AGREE, not that either has a particular value.**
`test-accounts.js` reads the sentinel out of `_auth.js`, then requires the setup
example to use that same string as its master key and to no longer offer
`"admin"`. It is anchored on the derivation itself, so if the age group ever
stops coming from the key name the section fails loudly instead of describing
nothing. **Two copies of one rule drift, and the drift is invisible until you
look for it.**

Three faults, all caught: the comment back to `"admin"`; the sentinel in
`_auth.js` moved off the asterisk; the age group no longer derived from the
matched key name. **517/517 faults, 30 suites clean, 35 files green.**

⚠️ **One honest caveat recorded in the commit:** `manager-signup.js` IS a
deployed function, so the live bundle keeps the old comment until whatever
deploys next. It is a comment and nothing executes differently — but "nothing
here is served" would have been too neat a thing to say.
