# ADH JRT — changelog

> Detailed, shipped-and-verified history of every feature: what was built, how
> it was tested, and how it was confirmed in production. Split out of
> `claude/state-of-play.md` on 30 July 2026 so that doc could stay a short
> "where things stand right now" read. For current status, pending jobs and
> operational rules, read `claude/state-of-play.md` instead — this doc is
> history, not a to-do list.
>
> Entries below are in the order they were originally written (most recent
> first, roughly).

## THE SUPPORTERS GRID — merged to `main`, LIVE AND VERIFIED LIVE, 5 Aug 2026 (`2f1dfae` → `ba5028d`)

**Eighteen sponsors** on the homepage, under **With the support of**, below the
HSBC principal-partner card — **every 2026/27 sponsor, in their own colours.**
Six 15-credit deploys across the morning: fourteen recoloured white on the
first, then Bili Boys, then Anderson, then white tiles carrying Crompton and
Recover, then Broadway Malyan's real wordmark — **and finally the recolouring
undone altogether.** Spec: `claude/specs/spec-sponsors-grid.md`.

⚠️ **Six deploys for one section is five more than planned.** Five were
unblocked by artwork Jay found and sent after the previous had landed; the sixth
reversed a design decision the first five were built on. Worth recording rather
than hiding: when files are arriving one at a time, ask *"is more coming in the
next hour?"* before landing — and when a design rests on one judgement call
(here: recolour, or box?), get that judgement made before building on it five
times.

### ⚠️ EVERY LOGO LINKS TO ITS SPONSOR (`ba5028d`)

Jay: *"can we make the photos link to the sponsor's websites?"* Each row carries
a `url`; the HSBC card links to hsbc.ae.

⚠️ **EVERY URL WAS CHECKED FOR A 200 BEFORE IT WENT IN.** A sponsor's own mark
pointing at a dead domain — or at whoever bought the name next — is a commercial
problem, not a broken link. Fourteen were found and verified by search; **four
came from Jay** because they could not be found (V&P, Recover, Arabian Swim
Academy) or were genuinely ambiguous — McCafferty's has a group site AND a Yas
Island site, and the sponsor is Yas. Sedbergh is the UK school, confirmed.
**The work was HELD until he supplied them rather than shipping guesses**, which
is the right trade: an unlinked logo is fine, a wrong one is not.

⚠️ **`target="_blank"` REQUIRES `rel="noopener"`, and that is a SECURITY rule.**
Without it the opened page gets a live `window.opener` handle and can navigate
THIS tab anywhere — reverse tabnabbing — and the tab it would redirect is the
one a parent is registering a child in. Fault for dropping it.

**The row pattern REQUIRES the url**, so a sponsor added without one falls out
of the list entirely and trips the COUNT check rather than shipping a tile that
goes nowhere. Also asserted: https only, and **every URL distinct** — a
copy-paste slip produces a working link to the wrong company and nothing about
it looks broken.

⚠️ **HSBC's CARD links; the HEADER and HERO marks deliberately do NOT.** That
rule is about the STICKY header — a tap target that leaves the site follows a
visitor down every page, including a parent mid-registration. Asserted from both
ends, with a fault that links the header mark.

⚠️ **One of those two checks was reading NOTHING at first.** It sliced from
`'<span class="hdr-partner">'`, which does not match — the header mark carries a
style attribute — so `indexOf` returned −1 and the check passed on an empty
string. It now anchors on the class alone, slices to the block's own closing tag
rather than a character count, and **asserts the block was located before
asserting anything about it.**

⚠️ **Eleven fault anchors rotted on the row format gaining `url`, and one would
have ESCAPED.** The fold-HSBC-into-the-grid fault injects a row; a row without a
url no longer matches the pattern, so the COUNT check would have passed on the
fault instead of the hierarchy check catching it. The run reported it as **NOT
CAUGHT** rather than passing quietly — which is the whole reason that script
distinguishes "caught by the named check" from "the suite went red".

### ⚠️ THE TILES ALTERNATE, AND THE ORDER OF THE LIST IS WHAT DOES IT (`87471e2`)

Jay: *"can we do them every other is dark, every other is white, should work."*
It does — **and only because the measured split came out exactly nine and nine.**

The checkerboard is achieved by **ORDERING `SPONSORS` so `light` alternates**,
NOT by an `:nth-child` rule on the markup. The difference is the whole safety of
it: a positional CSS rule paints every other tile white *regardless of what is in
it*, so adding ONE sponsor flips nine logos onto the wrong ground and the three
that exist only as white files VANISH, reporting no error anywhere. Ordering
keeps the colour following the ARTWORK.

**Both are asserted together** — the alternation AND the measured flag. Faults
for regrouping the list and for moving Crompton out of first.

⚠️ **A nineteenth sponsor breaks the alternation**, and the fix is NOT to flip
its tile: measure it, put it in its half, accept one repeat. Written into the
data where the next person will meet it.

**Crompton Partners leads** at Jay's request, so the run starts white.

### ⚠️ FLEX, NOT GRID — because of the last row (`87471e2`)

Jay: *"centre the bottom line of 3."* A CSS grid leaves an incomplete final row
hanging on the left and **there is no grid property that centres it**.
`flex-wrap` + `justify-content:center` centres whatever the last row holds, at
every width, **with no count baked in** — which matters because the count changes
every time a sponsor signs. `flex:1 1 190px` keeps full rows filling the width;
`max-width:260px` stops a short last row stretching into three enormous tiles,
and `.spon-tile` lifts that cap below 640px where there is one tile per row
anyway.

### The sponsors-section HSBC lockup: 64px → 96px (`87471e2`)

⚠️ **ALL THREE PLACEMENT SIZES ARE NOW ASSERTED** (19 / 128 / 96), not just the
count. **A placement quietly SHRINKING is the same class of failure as one
quietly vanishing** — the mark is still there, so nothing looks broken, and the
tournament's only confirmed partner is smaller than the day before with nobody
the wiser. Two existing HSBC faults were repointed for the new height.

⚠️ **One assertion nearly rotted on a LINE BREAK.** The "assigned by
MEASUREMENT" anchor fell across a wrapped comment. Fixed by keeping the anchored
phrase on one line rather than loosening the regex — **a check that tolerates
arbitrary whitespace is a check that also matches text nobody meant.**

### ⚠️ NOTHING IS RECOLOURED ANY MORE (`c1cc033`) — the design was reversed

Jay: *"lets redo all the changes to put them on the black background, anything
that was changed can just go in a white box."*

Every one of the eighteen files was rebuilt from the sponsor's **own artwork in
their own colours**. A mark that does not read on `#151517` now gets a **white
box** instead of being repainted.

**The split is MEASURED, not chosen** — median WCAG contrast of the ink against
the tile, white box below 4.5:1. It comes out **nine and nine**, and the nine
are not the nine anybody would have guessed, which is the whole argument for
measuring rather than eyeballing:

| | |
|---|---|
| **white box** | Brighton College, BEOND, Westminster, Broadway Malyan, The Bottle Store, Align Health, Anderson, Crompton, Recover |
| **dark tile** | Oak View Group, V&P, Ashurst, Sedbergh, McCafferty's, The Sportsman's Arms, Yas Mena Cycles, Arabian Swim, Bili Boys |

⚠️ **THREE LOGOS CAN NEVER TAKE A WHITE BOX.** Oak View Group, V&P and Yas Mena
Cycles exist **only** as white-on-transparent files, so a white tile erases them
outright. That is why lightening the whole section — asked for twice — stayed
rejected both times, and it is now asserted by name with a fault that adds the
flag to Yas Cycles.

**BOTH SIDES of the split are asserted.** "Nine are light" passes on a grid
where every tile has gone white — which is exactly the failure the request could
have produced if taken literally and applied by eye.

**Bili Boys stays on the dark tile**: its badge carries its own opaque cream
ground, so it is already a box, and a cream rectangle inside a white one is
worse. It is also **the one logo the contrast measurement gets wrong** — it
reads the ground as ink — so it is pinned by hand with the reason beside it.

**Files are never upscaled.** Anything under the house 160px tall is stored at
native size rather than padded up, so a better file replaces it later with no
stretch baked in: Broadway Malyan (439×82), McCafferty's (494×114), Align Health
(244×56), Crompton (236×97), Bili Boys (154×90), Recover (143×32).

⚠️ **EIGHT FAULT ANCHORS ROTTED IN ONE CHANGE and were REPOINTED, not deleted.**
Every rule they guard is still alive; their subjects moved. The run named all
eight rather than passing quietly, which is the entire reason that script
exists. **Two changed meaning with the design**: *"Anderson's red is flattened
away"* became *"the white-box rule is deleted, leaving the flags unexplained"*,
and *"a third white tile"* became *"a white box spreads to a logo that only
exists as a white file"*. A fault whose subject is deleted must be repointed if
the rule is still alive — and a fault whose RULE has changed shape must change
with it, or it guards a world that no longer exists.

**The render was shown to Jay before this one landed**, precisely because nine
white boxes is a look nobody can picture from a sentence.

The list is DATA (`SPONSORS`, bound through `renderVals`), so adding a sponsor
is one line and one file rather than a markup edit. The dashed "More partners
will be announced" placeholder went with it — true while the section held only
HSBC, and with fourteen logos up it reads as a page nobody finished. The
get-in-touch invitation stays; it is the only route by which another sponsor
reaches Jay.

### ⚠️ THE TESTS WERE GREEN AGAINST A REAL BUG, AND ONLY A RENDER FOUND IT

The first draft sized every logo at `height:44px; max-width:100%`. 132 checks
passed. It was wrong twice:

1. **A fixed height with a clamped width SQUASHES a wide mark.** Broadway
   Malyan is 11.5:1 — at 44px tall it wants 506px of width, gets about 246, and
   renders **distorted rather than smaller**. Nothing reports it, anywhere.
2. **Equal height is not equal presence.** The near-square marks (Ashurst, The
   Sportsman's Arms, ~1.1:1) came out the size of postage stamps beside a 5:1
   wordmark. That is a sponsor-relations problem, not a cosmetic one.

Each row now carries its own **max** height, and the markup uses `max-height`
plus `object-fit:contain` so the ratio always survives the clamp:

    h = round(83.5 / sqrt(width / height)), clamped 26..68

68 is what fits inside the 104px tile with 16px of padding; 26 is the
legibility floor on a phone. **Recompute `h` when a file is replaced** — a new
crop changes the ratio.

**The sizing checks had to DISCRIMINATE, and the first version did not.**
"Every row has an `h`" passes against `h:44` on all fourteen — against the very
bug it replaced. They now assert the widest mark ends up **smaller** than
mid-pack and the squarest end up **larger**, with faults that level each back.

### ⚠️ And the render that found it was nearly wrong the other way

The first screenshot showed a grid that looked faded, which read as a broken
`data-reveal` animation. It was not. `support.js` boots React from unpkg, which
the sandbox cannot reach, so **every section measured 0×0 and the screenshot
was of an empty shell.** Same trap as the 3 Aug hero render and the 2 Aug
light-mode audit, which reported zero contrast failures against blank pages —
**a screenshot of nothing looks like a result.** Fixed by route-intercepting
unpkg to the vendored React and fonts.googleapis.com to the local Anton/Barlow.
With React actually booting, every `[data-reveal]` computes `opacity: 1`.

### Artwork rules

White-on-transparent, trimmed to 160px tall, saved as `.webp`. **The `.webp`
conversion is WHERE the white treatment happened** — a `.png` in the list means
somebody dropped a raw download in and skipped it, and a dark logo on `#0C0C0E`
vanishes while reporting no error. That is the HSBC lesson one section down.
Asserted, with a fault.

Chosen against a rendered contact sheet rather than by reasoning: all nineteen
candidates were rendered on dark **and** on light before deciding. **The
prediction — that a light band would be safer — was wrong**; recolouring six
single-colour marks to white is what made dark win.

**HSBC stays ABOVE and SEPARATE.** They are the principal partner; these are
supporters. Folding the two into one wall is the tidy-up that demotes the
tournament's only confirmed partner, and it has been warned about in
`CLAUDE.md` since 2 Aug. Asserted three ways, with a fault that injects it.

### ⚠️ WHITE TILES FOR LOGOS THAT CANNOT GO ON A DARK GROUND (`c03659b`)

Jay: *"you can use a white box around logos that won't work on the dark
background, that is fine."* That cleared the last two absences.

A sponsor row may carry **`light: true`** — meaning *this artwork exists ONLY as
dark ink on white and cannot be recoloured without destroying it*. **Crompton
Partners**' navy keyhole lives inside the O; **Recover**'s type is a hairline.
The tile's background and border are **derived from the flag in `renderVals`**,
not written into `SPONSORS`: the data says what the artwork IS, not what colour
to paint a box, so the two greys live in one place.

⚠️ **A white tile is an exception, not a default.** Every one is a bright
rectangle in an otherwise dark band, so **the count is written out — exactly
two**. Four faults: a third tile added, the flag removed (which hides both logos
with no error anywhere), the tile hardcoding one colour again, and the border
not following the background.

⚠️ **LIGHTENING THE WHOLE SECTION was the other option and was REJECTED.** Jay
asked for it directly. Oak View Group, V&P and Yas Mena Cycles exist **only** as
white-on-transparent files and would have vanished on a light ground — this
exact failure, inverted — and it would not have rescued anything Crompton or
Recover needed either. Per-tile cannot break what already works. **Saying that
before spending the deploy is what this session got right**; the same idea will
be had again.

⚠️ **The "no hardcoded tile colour" check is SCOPED TO THE `sc-for` BLOCK.** The
HSBC card above it is legitimately `background:#151517`, so a section-wide
negative check fails on the principal-partner card. The slice asserts it is
non-empty first — *"no hardcoded colour in nothing"* would pass for ever.

**The pending-artwork sweep was REWRITTEN rather than left behind.** It looped
over a list of slugs that emptied itself out as each sponsor arrived, and **an
empty `forEach` is a check that asserts nothing while looking like coverage.**
It now asserts every sponsor on the page has a file behind it, which is what it
was really guarding. Its fault was repointed the same way — it used to inject a
half-added Recover, whose subject has since shipped.

### ⚠️ BROADWAY MALYAN'S FILE WAS THE TAGLINE, NOT THE WORDMARK (`d3c542b`)

The file we shipped was their tagline lockup — *"Creating places. Together."*
Genuinely theirs, so nothing about it looked wrong in a diff or a render, but it
does not say who they are: **their NAME was nowhere on the page** and nobody
looking at the grid could have told who the sponsor was. Jay sent the wordmark.

The ratio moved **11.5:1 → 5.4:1** with the file, so `h` moved **26 → 36**.

⚠️ **RECOLOURED WHITE RATHER THAN GIVEN A WHITE TILE, and the line matters.**
Their copper is flat single-colour type, so it recolours cleanly — and measured
on `#151517` the copper is about **2.6:1**, which is not readable. **A white
tile is for artwork that CANNOT be recoloured** (Crompton's navy keyhole inside
the O), not for artwork that merely arrived in a colour. If that distinction
goes, the grid ends up a wall of white boxes.

**Two anchors moved with the file rather than being deleted.** The "widest mark
is sized down" check and its fault both pointed at Broadway Malyan because it
WAS the widest at 11.5:1; it no longer is, so both moved to Brighton College.
The rule is unchanged — and it is the rule the fixed-height bug broke. A new
check asserts the file is the wordmark **by shape**, since a source-reading test
cannot see a picture: the tagline needed 26, the wordmark needs 36, and its
fault slides the file back.

**Also settled:** Ashurst Perkins Coie's brand teal is **approved, not pending**
(*"ashurst is good"*, Jay, 5 Aug). It had been carried as an open flag.

### ⚠️ ANDERSON KEEPS ITS RED (`dee1d8f`)

Jay sent a flat 810×189 logo on white — the file that had been missing. The
recipe, recorded because more will arrive this way: key the white out with
`alpha = 255 - min(r,g,b)`, then classify each pixel red (`r - max(g,b) > 40`)
or ink. Cropped to the ink and scaled DOWN to 160px tall, so no upscale.

**The red was kept and only the black subline turned white** — flattening the
lot to white throws away the half of the logo that identifies them. It is the
only coloured mark in the grid apart from Ashurst's teal. It is HSBC red's
neighbour, not HSBC red, and it sits three rows below the principal-partner
card: **if that ever reads as competing with HSBC, recolour Anderson, not the
card.** Asserted, with a fault, so a later "make the grid consistent" pass has
to argue with it first.

The name on the page is the one on the logo — **Anderson Executive Development
Centre** — not the "Anderson Education" the chase list had been calling them.

### ⚠️ BILI BOYS IS THE OTHER DOCUMENTED EXCEPTION, AND IT IS PINNED (`09fd2d5`)

Jay: *"we're missing the bili boys logo."* It had been left off because the
artwork fails BOTH house rules. It still does — so the exception was made
deliberately and asserted, rather than made quietly.

It is a **badge**: dark type on an **opaque cream** ground with a printed
border. White-on-transparent would mean deleting the logo, not recolouring it.
And the only artwork in existence is **154x90**, under the house 160px tall, so
it is stored at NATIVE size with `h:52` rather than the 64 the formula gives for
its 1.7:1 ratio. **Padding it up to 160 would bake a 1.78x stretch into the file
permanently**; storing it small and rendering it at 52 costs 1.16x on a 2x
screen and can be swapped for a better file with no other change. Somebody
"correcting" 52 to 64 is choosing a blurrier logo, so the number is asserted and
the reasoning sits next to it in the data.

**Both the count check and the pending-artwork check FAILED on this**, which is
what they are for. 14 → 15, and `bili-boys` came off the not-half-added list —
deliberately, in the same commit. Three new faults: the height "corrected" to
the formula value, the written reason tidied away, and Bili Boys dropped again.

Live: **89x52 CSS from a 154x90 source** — a downscale, so it is sharp at 1x.

### No confirmed sponsor is missing any more

All three that started the day absent — Anderson, Crompton and Recover — are on
the page by the end of it, and Broadway Malyan's wrong file is replaced. Still
worth chasing **better** files, but nothing is wrong: Recover is the smallest
asset on the page (143×32 native) and Bili Boys the second (154×90).

`CLAUDE.md` gained a supporters-grid section in `09fd2d5` — the spec lives in
the Claude project, which a fresh clone does not carry.

Two more to chase, lower priority: **Broadway Malyan's** file is their tagline
*"Creating places. Together."*, not the company wordmark. **Ashurst Perkins
Coie** is the one non-monochrome mark in the grid — left in their brand teal
deliberately, because recolouring a law firm's logo is not a call to take
unilaterally.

### Verified

**`test-sponsors.js` 132 → 231 checks; 473 → 499 injected faults caught by the
named check, 29 suites clean; the full 34-file sweep green.** Six new faults
for the sizing alone, including the fixed-height regression itself, the markup
ignoring the data it is given, `object-fit` dropped, a height that does not fit
the tile, and the two lazy levelling fixes.

⚠️ **`sponsor-*.webp` had to join `NEEDED` in `_prove-registration.js`.** The
prover creates `assets/`, which flips `hasAssets` true, so without them the
suite failed on an **undamaged** copy. Same trap as `_signins.js` and
`Club.dc.html` — third time.

Three fault anchors were repointed rather than dropped when the row format
gained `h`, including one that would have **escaped silently**: the fault that
folds HSBC into the grid injects a row, and a row without `h` no longer matches
the row pattern, so the count check would have passed on the fault.

**Verified LIVE on adhjrt.com after the deploy**, not just green tests: all
nineteen assets return 200 (with a negative control returning 404, so the 200s
mean something), and the section was driven in Jay's own Chrome — eighteen
logos, **zero distorted**, white tiles on exactly Crompton and Recover read back
from live computed CSS (rendered ratio compared against `naturalWidth /
naturalHeight` per image), reveals fired, no horizontal overflow, HSBC above
and separate.

## ⚠️ A NETLIFY ENV-VAR CHANGE NEEDS A DEPLOY — the docs said otherwise for a week (4 Aug 2026, `CLUB_FORM_KEY`)

Not a feature. A wrong fact that was written down as verified, believed for a
week, and cost an hour of diagnosis and one wasted 15-credit deploy before it
was caught.

### What the docs said

`CLAUDE.md` and `state-of-play.md` both said Netlify environment variables on
this site are **"read per request — no redeploy needed to change them."**

That came from the `ORGANIZER_INVITE_CODE` deletion on 3 Aug. Jay deleted the
variable, the changelog recorded that organiser self-signup was therefore
closed, and **nobody ever attempted a signup to check.** The claim was recorded
as fact on the strength of nothing.

### What is actually true, proven twice in both directions

**Creating a variable.** `CLUB_FORM_KEY` was created at 06:29. The club form
went on refusing every submission afterwards. The running function could not see
a variable that did not exist when it was deployed. It started working only
after a deploy.

**Rotating a variable.** The key was later rotated in the Netlify UI. The OLD
key went on being **accepted** — proven by posting it and watching it get past
the key gate into validation — until another deploy. After that deploy the old
key returned 403, identical to a made-up one.

So: **reading the value back in the Netlify UI proves nothing about what the
running function sees.** Change the variable, deploy, then test the BEHAVIOUR.

### ⚠️ Two diagnostic lessons, both learned the expensive way

**1. Read the response, not the screenshot.** The club form's failures all
render in the same red panel. "Deployed, new window, used link, same error" was
visually true and factually wrong — the sentence underneath had changed from
*"This link is not valid"* to *"Registration is not open at the moment"*, which
was the entire answer. An hour went into a key that was working fine. The fix
was to post from the live page and read the actual JSON.

**2. A verification whose failure mode writes production data is not a
verification.** The rotation check was built expecting a 403, so it carried a
valid payload. The key had NOT been rotated, so the submission sailed through
and **wrote a junk row into the Club Registrations sheet.**

The correct probe carries the key with **every age-group box empty**: it passes
the key gate and then trips the "declares nothing" validation rule. **400 means
accepted, 403 means refused, and neither writes anything.** That probe is now
written into `CLAUDE.md`.

### One more, about verifying `[skip ci]`

The rule was "verify by the deploy id not moving". On `quins-club-hub` the id
HAD moved — because an unrelated deploy ran in the gap. **Check the
`commit_ref`, not the deploy id.** On a two-machine setup you cannot assume
nothing else deployed while you were working.

### Where it stands

Both wrong claims corrected in `CLAUDE.md`, including the club section's "shuts
the form instantly with no deploy". `CLUB_FORM_KEY` is rotated and verified: the
old key — which had leaked into a chat transcript during the diagnosis — now
returns 403. The Club Registrations sheet is clean.

## THE /organizer CLUBS TAB — merged to `main`, LIVE AND VERIFIED LIVE, 4 Aug 2026 (`42fcad6`)

Parked item 6, brought forward from October at Jay's request ("build it now").
One 15-credit deploy (`6a7199a2ea58380008f54974`, production, `ready`).

The seventh tab, and the reason declarations exist at all: one row per club —
declared total, registered total, a **Short / Over / On track** badge, contact —
expandable to the per-age-group breakdown with mismatching rows tinted. A
"show only clubs to chase" filter, and **the flagged count on the tab button**
so it is visible without opening the tab, the same way Accounts carries its
pending count.

### ⚠️ THE JOIN IS FREE TEXT TYPED BY TWO DIFFERENT PEOPLE, MONTHS APART

A club contact types the club name once, on the declaration. A coach types it
again on every team registration. **There is no club id anywhere in the
system**, and inventing one now would mean changing a form clubs are already
being sent a link to. So the join is on a normalised name — and a normaliser is
the kind of code that is quietly wrong for a year, because its failures look
like ordinary numbers rather than errors.

`normaliseClubName()` lowercases, folds accents, removes apostrophes, turns
other punctuation into spaces, collapses whitespace, and strips ONE trailing
club-type suffix. **Every one of those rules exists because of a specific pair
of names, and two were found by the test rather than by inspection:**

- Apostrophes are **removed**, not spaced — `St George's` was becoming
  `st george s` and no longer matching `St Georges`. Caught on the first run.
- Other punctuation becomes a **space** — or `St.Georges` collapses to one word
  while `St Georges` stays two.
- The suffix strip is **anchored to the end** and runs once — a blanket strip
  turns `RC Sharks` into `Sharks` and merges two real clubs.

⚠️ **AN EAGER NORMALISER IS WORSE THAN A LAZY ONE, and that asymmetry drove the
design.** A wrong match produces a plausible number nobody questions. A missed
match lands in the "registered but never declared" panel where it is visible.
Given the choice, fail towards the visible one.

**That panel is half the answer, not a leftover.** A club that registers without
declaring is invisible to a declared-clubs-only view — and it is also where a
failed name match ends up, so a bad match reads as an odd row rather than as a
club that silently under-registered.

### Jay's three choices, asked before building

1. **Normalise, and surface what did not match** — over exact-match (one stray
   capital makes a club look like it registered nothing) and over hand-merging
   (more moving parts, and it needs somewhere to store the merges).
2. **One row per club, expandable** — over a 15-column matrix that scrolls
   sideways on anything smaller than a big monitor, and over a mismatches-only
   view that cannot show who is on track.
3. **Over-registration flags too** — more teams than planned still changes
   pools, pitches and the draw.

### The rest of the rules

- Blank, `0` and rubbish in a declaration box all mean "none declared" — the
  club form says "leave a group blank if you are not entering it". None of them
  may become `NaN` in a total.
- Only age groups with something on either side are listed under a club.
  Fifteen rows of `0 / 0` is noise, and an expandable row is only useful if what
  it opens is short enough to read.
- The age-group join goes through `MANAGER_AGE_GROUPS` — the teams sheet stores
  the display NAME, a declaration stores the ID — never a second mapping. An
  unrecognised name still counts towards the club's total, so a team that exists
  cannot vanish and make a club look short for a reason nobody can see.
- ⚠️ **`get-registrations.js` reads the clubs sheet FAIL-SOFT, alone among the
  three.** Declarations are a planning nicety; teams and players are the
  tournament. A missing or unshared `GOOGLE_SHEET_ID_CLUBS` must not cost an
  organiser their Teams table. `clubsUnavailable` tells that apart from "nobody
  has declared yet" — **the loading-vs-empty trap one level down**, and this
  codebase has now been bitten by that three times. Asserted three ways, because
  "loading", "broken" and "empty" are three different sentences.
- `organizer-data.js` DEFAULTS `clubs` to `[]` rather than passing it through
  raw: the page and the function do not deploy atomically in a rollback, and
  `undefined.map` on one tab would take the whole dashboard down.

### Verified

**New `tests/test-organizer-clubs.js`, 113 checks, DRIVING the real component**
out of `Organizer.dc.html` rather than grepping it — a source check cannot see a
loop that stops at the first age group, a total that double-counts, or a filter
that hides the wrong rows. The name pairs are swept **both ways** (must meet /
must not meet), and **all fifteen age groups** are swept, because a mapping that
covers the head of the list and not the tail is the exact shape of the
club-count bug this project already had. Added to `runall.ps1` by hand.

**Thirteen faults, all caught:** the normaliser un-anchored and disabled,
apostrophes respaced, the declared total not summing, over-registration
unflagged, undeclared clubs dropped, an unknown age group uncounted, the
unreadable sheet reading as empty, the filter breaking two ways, one expand
expanding all, the clubs sheet made fail-hard, and the age-group map hardcoded.

**451 → 464 faults, 29 baseline suites** (up from 28 — the new suite joined the
derived baseline by itself, which is what that derivation exists for). **33 files
green on cafnet at `42fcad6`.** Tree hash `f4234015…` matched between the sandbox
and the PC.

**Rendered before landing** — signed in with a stubbed session and stubbed API so
the REAL load path filled the tab, rather than state being poked from outside.
The render is what confirmed "dubai exiles rfc" folding into "Dubai Exiles" and
"Dubai Hurricanes" landing in the unmatched panel.

**And verified LIVE on adhjrt.com after the deploy:** the tab renders against the
real sheet and reads **"Clubs (1 to chase)"** — the one live declaration, with
nothing registered against it yet. Correct.

⚠️ **Until registration opens in October the registered column is zero for
everyone, so every club will read Short.** That is the tab being right about a
world where no team has registered, and it is exactly why this was deferred to
October in the first place. Jay chose to have it early anyway, knowing that.

## THE CLUB FORM COULD NEVER HAVE WORKED — merged to `main`, LIVE AND VERIFIED LIVE, 4 Aug 2026 (`4955a5a`)

Jay set `CLUB_FORM_KEY`, opened the silent link, filled the form, pressed Send —
and was refused. What followed was worth more than the fix: **the feature had
been unusable since the day it shipped, and nothing in 451 injected faults could
have told us, because the bug was a missing decision rather than a wrong line.**

One 15-credit deploy (`6a7191d43687ee0007b57a78`, production, `ready`).

### The bug

`handleSubmission()` runs five gates in order: rate limit, allow-list, **club
key**, validation, **registration window**. The club form passed the key gate
and died at the window.

Registration opens **8 October**. A club declaration is *"we expect to bring
three U12 teams"* — planning information whose entire value is that it arrives
WEEKS BEFORE registration opens, so pools, the draw and pitch allocation can be
worked out in advance. Gated behind the window, **the form could not be used
until the exact moment it stopped being useful**: by October the teams
themselves are registering and the declared numbers are moot.

**It rode in by accident, not by decision.** The 1 Aug build routed the club
form through the existing gateway "with no adapter change at all" — recorded at
the time as an elegance, and it genuinely was for the rate limit, the honeypot,
the length caps and the no-values-in-logs rule. The registration window came
along with them and nobody asked whether it should. It survived the 2 Aug
removal and the 3 Aug restoration untouched.

### The fix

One condition at step 4: the window is skipped for `club-registration`, and not
even READ — a blob round trip on a path that has already decided it does not
care.

⚠️ **Not a hole, and the reason is ordering.** The club form has a stronger gate
than the window and it has ALREADY BEEN PASSED by the time this line is reached:
`CLUB_FORM_KEY`, at step 2b. Only somebody sent the link gets that far, and
deleting the variable shuts the form instantly with no deploy. Jay's explicit
choice: declarations are **not** stopped when the window closes at the far end
either — the key is the switch.

### What the assertions had to cover, and why

- **Every shut state, not just "closed".** The window says no three ways —
  closed, unreadable, and `registrationState` throwing — and an exemption
  covering one of them would have failed on the day it mattered.
- **Both public forms still refused in those same states.** This is the one that
  earns its keep. *"Why is one form special-cased?"* is a reasonable question and
  widening the exemption is the wrong answer to it — that would open
  registration for the entire tournament months early, silently, with every
  other check still passing.
- **A club submission with NO key is still refused, window or not** — proving
  the exemption did not quietly make the unlisted form public.
- **The window is not read at all** for a declaration.

**Five new faults:** the exemption removed, widened to every form, **inverted**
(club gated, public forms freed — a plausible typo and the worst of both), the
key check folded into the exemption, and the window read but ignored. Two
existing window faults were repointed for the new indentation rather than
dropped.

### ⚠️ The diagnosis is the part worth keeping

Three hypotheses were wrong before the right one, and two of them cost real
money:

1. **"You tested before the variable saved."** Checked the Netlify API: the
   variable existed, context `all`, all four scopes. Wrong.
2. **"Netlify bakes env vars in at deploy time, so it needs a redeploy."**
   Stated confidently, cost **15 credits**, and appeared to fail — Jay redeployed
   and got the same red box. **It was actually right**, and the retest after it
   is what proved it; the apology was premature in both directions.
3. The actual answer came from **reading the response body instead of the
   screenshot.** The page shows every refusal in the same red panel, so "same
   error" looked like no progress when the sentence underneath had changed from
   *"This link is not valid"* to *"Registration is not open at the moment."*
   **The two failures were never distinguishable to the person reporting them.**

The method that broke it open: drive the real page in Chrome, hook `window.fetch`
to capture the exact POST body, and confirm the client half is innocent before
touching the server. That took the problem from "somewhere in a chain of six
things" to "the server, and only the server" in one step.

⚠️ **The client test used a DUMMY key on purpose** — proving that whatever is in
the URL reaches the server as a top-level `clubKey` needs no real secret. The
real value was compared by **SHA-256 fingerprint**, not by printing it. (Jay
then pasted the key into the chat himself, so it needs rotating; noted for him
rather than filed away.)

### Verified

**33 files green on cafnet at `4955a5a`** (`runall.ps1`, "All green"),
**451/451 injected faults caught by the named check, 28 suites clean** — up from
446/446. `test-intake.js` 648 → 665 checks. Tree hash `2d2c9370…` matched
between the sandbox and the PC.

**And verified LIVE on adhjrt.com after the deploy**, three ways, because a
green suite is not a working site:

| | |
|---|---|
| club declaration **with** the key, window shut | **200, accepted and written** |
| club declaration with a **wrong** key | 403, "This link is not valid" |
| **team** registration, valid payload, window shut | 403, "Registration is not open" |

The third one had to be run twice: the first attempt used an incomplete payload
and was refused at VALIDATION (400), which proves nothing about the window. **A
negative check that fails for the wrong reason is not a negative check.**

That live club submission wrote a real row — "DIAGNOSTIC DELETE ME" — flagged to
Jay for deletion.

## THE PARTNER BAND REMOVED, THE HERO LOCKUP DOUBLED — merged to `main`, LIVE, 3 Aug 2026 (`da6aacb`)

Jay: *"lets remove the HSBC section between the hero and the stat numbers area,
and lets make the HSBC in the hero section double in size."* One 15-credit
deploy (`6a7181e9d8cb2d00085917eb`, production, `ready`).

The `<section id="partner">` band — a 54px lockup on its own full-width strip
between the hero and the stat strip — is gone, and the hero lockup went **64px
→ 128px**. The two placements said the same thing a few hundred pixels apart,
and the hero one now says it much louder. Down to **three** on the page: header
19px, hero 128px, sponsors section 64px.

**Nothing linked to `#partner`** — the nav's Sponsors link goes to `#sponsors` —
so nothing else moved.

### The count moved by hand for the second time in an hour

`test-sponsors.js` asserts the number of HSBC images **exactly**. It went 3 → 4
when the hero lockup arrived and 4 → 3 when the band went, both times as a
deliberate edit in the same commit. A check loosened to `>= 3` to make a build
pass would have saved one line and thrown away the only thing that makes a
placement appearing or vanishing unnoticed impossible.

### `max-width:100%` had to MOVE, not disappear with the band

At 128px the lockup is about **510px wide — wider than a phone**. Without the
bound a narrow screen crops it rather than shrinking it. That rule lived on the
band's logo; deleting the band would have deleted the rule with it, and the one
placement that now genuinely needs it is the one that would have lost it.

### ⚠️ The band is TOMBSTONED, not silently deleted

Its own comment argued HSBC deserved *"the first slot after the fold, with
nothing else competing for the eye"*. **That is a good argument, and somebody
will make it again** without knowing the 128px hero lockup is the answer to it.
The two must not both exist — that was the entire complaint.

So the markup keeps a comment recording what was there, why it went, and the
details a re-add would need (it was `#0C0C0E` to match the hero above it so the
stat strip stayed the first colour break; its logo carried `max-width:100%`).
And the suite asserts the ABSENCE four ways, because "it is gone" and "it stays
gone" are different claims:

- the `<section id="partner">` does not exist **anywhere** on the page — not
  just "not above the stat strip", so a band that creeps back lower down still
  fails;
- **no 54px lockup survives**, which catches the "I'll just keep the logo"
  version;
- **"In partnership with" appears exactly ONCE** — two of them a few hundred
  pixels apart is precisely what Jay removed;
- the tombstone itself is still there, because deleting a comment looks like
  tidying.

The absence checks strip comments first. The tombstone explains the band at
length and names `id="partner"`, and **a comment about a band is not a band** —
the same house rule the wordmark checks hit an hour earlier, hit again
immediately.

### Four faults now assert the opposite of what they used to

`BAND_BLOCK` and `BAND_IMG` are kept in `_prove-registration.js` for the reverse
of the reason they were written: no fault deletes the band any more, one **puts
it back**. The four are the band restored above the stat strip, the band
creeping back lower down, its 54px lockup re-added without its section, and the
tombstone tidied away. Three anchors that pointed at the deleted band were
repointed rather than dropped — the black-lockup swap and the lost-logo fault
moved to the sponsors section, and the narrow-screen bound moved to the hero.

### Verified

**33 files green on cafnet at `da6aacb`** (`runall.ps1`, "All green"; scan for
`FAILURES` / `BASELINE FAIL` / "not on the named" / "could not be injected"
returned nothing), **446/446 injected faults caught by the named check, 28
suites clean** — up from 444/444. `test-sponsors.js` 104 → 101 checks. Tree hash
`86b331e6…` matched between the sandbox and the PC. Rendered at 1440, 1180 and
390px with the real faces before landing: nothing overflows, and the phone keeps
the lockup on its own line bounded to the screen width.

## THE WORDMARK, A BIGGER HERO LOCKUP, AND A HEADER OVERFLOW THAT WAS ALREADY LIVE — merged to `main`, LIVE, 3 Aug 2026 (`035f639`, then `28f0df9`)

Two small asks — *"can we move it more to the right and make it bigger?"* and
*"lets change AD Harlequins at the top left to Abu Dhabi Harlequins"* — and the
second one flushed out a real bug that had been on the live site since 2 Aug.
One 15-credit deploy (`6a716c23c204c50008370cd4`, production, `ready`,
`commit_ref` confirmed, secret scan clean — 123 files, 0 matches, 33 functions,
10 redirect rules).

### The two asks

The hero lockup went **46px → 64px**, and from a fixed `margin-left:10px` to
**`margin-left:auto`** — which on a flex child eats all the free space and puts
it at the right-hand end of the row. A bigger fixed margin would have looked
equivalent in the diff and would have drifted with the button labels.

The wordmark was renamed in **four** places, not the one Jay pointed at: the
homepage header **and footer**, and `legal.html`'s topbar **and footer**. A
half-renamed brand reads as a bug on whichever page was missed.

⚠️ **`teamLabel()`'s "Abu Dhabi …" → "AD …" shortening in `scores-data.js` was
NOT touched.** That one is deliberate, it exists so TEAM names fit narrow
standings columns, and it is documented and tested where it lives. The two look
identical in a grep and are opposite rules; both files now say so.

### ⚠️ THE RENAME FORCED A RE-MEASUREMENT, AND THE RE-MEASUREMENT FOUND A LIVE BUG

Seven characters became twenty inside a **sticky** header whose entire layout
budget is one line, so the header's breakpoints had to be measured again rather
than assumed. Rendered in headless Chromium with the real Anton and Barlow
faces, sweeping 1440px down to 360px:

**The header was overflowing the viewport HORIZONTALLY from about 875px down,
with the HSBC mark still showing.** Not a wrap — a sticky bar that scrolls
sideways, following a visitor down every page, on any laptop window in that
range.

**And it was not the rename's doing.** Measured the OLD short wordmark in the
same harness to check: **identical 874px scrollWidth at a 870px viewport.** The
bug shipped on 2 Aug with the header mark itself and had been live for a day.

**Why it was missed.** The hide rule sat at 800px because the original
measurement asked whether the header **wrapped** — and it does not wrap; it
overflows. A measurement only answers the question you asked it, and this one
returned a clean bill of health for a header that was already broken. That is
the lesson worth keeping, and it is now written above the check.

Moved to **900px** (875 with margin). The sweep is clean at every width from
1440 to 360. `CLAUDE.md` separately claimed the hide was at **1000px** while the
CSS said 800 — wrong on top of wrong, and corrected.

The header wordmark also gained `white-space:nowrap`, so the longer name cannot
break to a second line inside the sticky bar.

### ⚠️ The club's own name had NO test coverage, anywhere

Four places carried the wordmark and **not one assertion touched any of them**.
Three of the four could have been left short and the suite would have said
nothing. `test-design-polish.js` gained a section that asserts the new wordmark
on both pages, asserts the old one is absent, **counts** the occurrences (so
renaming the header and forgetting the footer fails here rather than on Jay's
screen), and asserts the nowrap. Four faults, one per way it can go wrong.

The absence check hit the house rule immediately: the new 900px rule's own
comment quotes `"AD HARLEQUINS"` by name to explain why the number moved, so
the check strips **CSS/JS comments as well as HTML ones**. A comment about a
wordmark is not a wordmark.

### And a follow-up the same evening: it was too far right (`28f0df9`)

Jay: *"the hsbc is too far to the right now, it should be about half way between
register player and the side of the page."* One more 15-credit deploy
(`6a7173149593260008ab9c76`, production, `ready`, `commit_ref` confirmed, secret
scan clean).

`margin-left:auto` **alone** pins a flex child hard against the right edge —
which is exactly what he was objecting to. **auto on BOTH sides** splits the
free space evenly, which is the halfway point, and it stays halfway at any
width where a fixed margin would drift with the button labels and stop being
halfway the moment a label changed. Measured at 1440px: 186px of gap before the
block, 170px after (the row's own 16px flex gap accounts for the difference).
Nothing changes on a wrapped line, where `margin-left:0!important` already wins.

**Both autos are asserted**, because losing the right-hand one is a silent
revert to the version Jay rejected and it is one character. Two faults: the
whole thing back to a fixed margin, and just the right auto dropped. 444/444.

### Verified

**33 files green on cafnet at `035f639`** (`runall.ps1`, "All green"; scan for
`FAILURES` / `BASELINE FAIL` / "not on the named" / "could not be injected"
returned nothing), **443/443 injected faults caught by the named check, 28
suites clean** — up from 437/437. **Six new faults**; `test-sponsors.js` 103 →
104, `test-design-polish.js` 48 → 55. Tree hash `76dab85e…` matched between the
sandbox and the PC.

**Three fault anchors were orphaned by these edits and repointed in the same
change** — the two `.hdr-partner` hide faults (800 → 900) and the hero-class
fault (the block's `gap` changed with the resize). The run named all three as
"COULD NOT INJECT" rather than passing them, which is the behaviour that makes
that script worth running.


## HSBC IN THE HERO — merged to `main`, LIVE, 3 Aug 2026 (`bee7a30`)

Jay: *"can we put a semi large in partnership with and the HSBC logo to the
right of player registration button?"* — then, when asked which of the two
Register pairs he meant, *"in the gap area in the hero."* One 15-credit deploy
(`6a7165b8ea58380008c510cc`, production, `ready`, `commit_ref` confirmed, secret
scan clean — 123 files, 0 matches, 33 functions, 10 redirect rules).

The mark now appears in **four** places on the homepage: the sticky header
(19px), the hero beside the Register buttons (46px, new), the `#partner` band
(54px), and the sponsors section (64px).

### ⚠️ THE GAP IN THE HERO IS THE ONLY PLACE THIS WORKS, AND THAT IS NOT OBVIOUS

Those two Register buttons appear **twice** on this page — once in the hero and
once in `<section id="register">`, "Sign up now". Asking for the mark "to the
right of player registration button" describes both.

The second one is `background:{{ accent }}` — `this.props.accentColor ?? '#E11B22'`,
**our** red. The reverse lockup's hexagon is **HSBC** red. Put the mark there and
the hexagon sits red on red and disappears, reporting no error anywhere — the
same failure shape as referencing the black wordmark on a dark page, which this
suite has guarded since 2 Aug. The hero is `#0C0C0E`, so the hexagon reads.

That was checked before choosing, and it is why the question got asked rather
than guessed at. `test-sponsors.js` now asserts **the red section has no HSBC
lockup at all**, and there is an injected fault that moves the block down there
— because "the two Register buttons should look the same" is exactly the tidy-up
a later session would make, and it would look right in the diff.

A second finding was reported to Jay rather than silently worked around: the
`#partner` band does almost exactly this half a screen further down. He wanted
both. The hero block borrows the band's shape deliberately — label above the
mark, same green, same words — so the two read as one idea rather than two
attempts at it, and it stays narrow enough to share a line with two buttons.
A thin divider on its left is what stops it reading as a third button.

### The row had never needed to wrap before

The hero button row was two buttons with no `flex-wrap`. A third item overflows
a phone without one, and **an overflowing hero is the first thing anybody sees**.
Added in the same commit, with its own fault.

⚠️ **And wrapping created a second, smaller problem that only a render shows.**
Once the row wraps, the lockup lands on its own line — where a 1px vertical
divider has nothing on the other side of it, and 36px of indent leaves the mark
out of line with the buttons above it. `.hero-partner` now drops the divider,
the padding and the margin below 800px. **`!important` on all three**, because
the block is styled inline and an ordinary rule loses silently — the identical
trap already documented for `.hdr-partner`, hit again the first time a second
element needed the same treatment. Three faults: the class removed (so the rule
targets nothing), the `!important` removed, and the divider dropped while the
indent is left behind.

### Measured, not eyeballed

Rendered in headless Chromium at **1440, 1180 and 390px** with the real Anton
and Barlow faces — fallback fonts are wider and give a different, wrong answer,
which is the same reason the header's 1000px hide was measured rather than
picked. Result: all three items share one line down to 1180px, the lockup takes
its own line at 390px, and **nothing overflows at any of the three**. The
decorative shards float in that same right-hand area of the hero
(`position:absolute`), which is the specific thing a render checks and a source
read cannot.

⚠️ The render harness needed React vendored locally — `support.js` boots it from
unpkg, which the sandbox cannot reach, and **without it every section measures
0×0 and a screenshot of nothing looks like a passing result**. Same trap as the
2 Aug light-mode audit, which reported zero contrast failures against blank
pages. The harness was deleted before committing: the repo root is the deployed
site.

### The count was moved deliberately, not widened

`test-sponsors.js` asserts the number of HSBC images on the page **exactly**.
That check had to be edited by hand in this commit — 3 to 4 — rather than
loosened to `>= 3`. That is the point of it: a written-out count is what makes a
placement appearing or vanishing unnoticed impossible, and loosening it to make
the build pass would have thrown that away to save one line. The reasoning is
written above the check so the next person meets it before the temptation.

### Verified

**33 files green on cafnet at `bee7a30`** (`runall.ps1`, `test-sponsors.js`
99 → 103 checks), **437/437 injected faults caught by the named check, 28 suites
clean** — up from 428/428. **Nine new faults.** Tree hash `31c9979c…` matched
between the sandbox and the PC; moved by `git bundle`, so the commit SHA is
identical on both sides.

One existing fault was **narrowed rather than left alone**: the band-label fault
patched the bare text `>In partnership with<`, and there are now two labels with
that wording on the page. `patch()` replaces every occurrence, so it would have
damaged both and stopped saying anything about the band specifically. It now
patches the band's own label span, verbatim.


## CLUB REGISTRATION RETURNS, BEHIND A SILENT LINK — merged to `main`, LIVE, 3 Aug 2026 (`622f0e8`)

Jay: *"i want to have a silent link for register your club, the link would not
show up publicly without having the exact link to it, is that possible?"* Yes —
but the obvious version of it protects nothing here, and that is what this
commit is really about. One 15-credit deploy (`6a70c9278d2d44000859778a`,
production, `ready`, `commit_ref` confirmed, secret scan clean — 123 files, 0
matches, **10 redirect rules**, up from 9).

### It was not a hiding job — the feature was gone

Club registration shipped 1 Aug (`1cdc521`) and Jay had it **removed entirely**
on 2 Aug (`91080a2`): the homepage modal, the columns, the row builder, the
mappers, the validation branch, the email, the lot. `club-registration` had
become an UNKNOWN FORM the gateway refused outright. So "add a silent link" was
"bring the feature back, unlisted".

**Recovered, not rewritten.** The `_intake.js` and `_email.js` halves are a
**reverse apply of `91080a2`**, so the columns, `clubRow()`, `mapClubRow()`,
the validation branch and `clubEmail()` are byte-identical to what shipped on
1 Aug. The homepage modal stayed deleted — the form is its own page — and a test
asserts the club form has not crept back onto the public page.

### ⚠️ UNLISTED IS NOT PROTECTED, and that is the whole design

Four things keep `/register-club` out of sight, each asserted separately
because they fail independently and three of four is not hidden: nothing on
adhjrt.com links to it, it is absent from `sitemap.xml`, the page carries
`noindex, nofollow`, and **`robots.txt` deliberately does NOT name it** — a
`Disallow` line would advertise the path in a public file to exactly the people
it is hidden from. That is the obvious-looking way to do this and it is
backwards; it has its own injected fault.

**None of that is protection.** This repo is PUBLIC and its root is the deployed
site, so `netlify.toml`'s rewrite and the filename are readable by anyone — and
the site-wide Netlify password is now OFF, so there is no second layer.

The guard is a secret that is **not in the repo**: `CLUB_FORM_KEY`, an
environment variable, checked server-side by `clubKeyOk()`. The page carries it
in the query string and hands it back with the submission, because **a page that
hid itself in JavaScript would be fully visible in view-source — a client-side
restriction is not a restriction.**

- **Checked at step 2b of `handleSubmission`:** after the allow-list has named
  the form, BEFORE validation, the window, the numbering, the sheet and the
  email. A caller without the key must not be able to make us do that work, and
  must learn nothing from the answer beyond "no". Faults for removing it and for
  moving it below the write.
- ⚠️ **FAILS CLOSED.** An absent variable refuses every club submission — the
  safe default while the page shipped un-keyed, and Jay's off switch with no
  deploy, exactly as deleting `ORGANIZER_INVITE_CODE` closed organiser signup
  hours earlier. **The rate limiter beside it fails OPEN**; making the two
  consistent would be a real mistake, so it has a fault of its own.
- ⚠️ **ONLY the club form is gated.** Widening it would shut registration for
  every club in the tournament — the loudest possible failure, and exactly the
  kind of consistency tidy-up that looks harmless in a diff. Asserted with the
  variable UNSET, so a leaked gate cannot pass by having a key lying around.
- ⚠️ **The key rides BESIDE `data`, never inside it** — a top-level property of
  the body next to `form`. So it can never become a sheet column, the same
  guarantee `team-code` gets by being absent from the allow-list. A key smuggled
  *inside* `data` authorises nothing.
- **Never logged**, and a wrong key and an unset variable return the identical
  sentence: those are the same answer to whoever is asking. Guessing is bounded
  by the existing rate limit — twenty attempts per address per hour.

**What is at stake if the key leaks** was weighed openly rather than assumed:
the club form holds a club name, a contact, and fifteen team counts. **No
children's data.** That is why an unlisted page plus one shared key is a
defensible design here, and would not be on the team or player forms.

### Two checks repointed rather than widened

The restored *"the page really submits `<name>`"* loop read one page, and would
now have passed on the two public forms while failing on the club one. Rather
than widening it to sweep both files — a widened check is a check with less to
say — **each form is asserted against its own page and its own call shape**
(the homepage posts `postRegistration(form, data)`; the club page posts a body,
because it has to carry `clubKey`), plus a hardcoded assertion that `FORMS`
holds exactly those three so a fourth cannot ride in unasserted. And a new check
that the club form has NOT returned to the homepage.

### ⚠️ The same trap as that morning, twice in one day

**`Club.dc.html` was missing from `_prove-registration.js`'s `NEEDED` list**, so
`test-intake.js` died on ENOENT inside the prover's temp copy and **eight
unrelated faults reported "failed, but not on the named check"**. Identical in
shape to `_signins.js` a few hours earlier. `sitemap.xml` and `robots.txt` had
to join the list for the same reason — the silent-link assertions read them.

Recording it twice is the point: the rule is not "remember `_signins.js`", it is
**check that list whenever any new file is read by a test OR required by code
under test.**

### Verified

**33 files green on cafnet at `622f0e8`** (`runall.ps1` exit 0, 34 headers),
**428/428 injected faults caught by the named check, 28 suites clean** — up from
414/414. 14 new faults, including one for each of the four things that keep the
page unlisted. Tree hash `08d53105…` matched between the sandbox and the PC.

### Deliberately NOT built: the `/organizer` Clubs tab

Declarations are readable in the Google Sheet only. The tab would show declared
against actually-registered per club per age group, with mismatches flagged —
the chase list, and the reason declarations exist at all. **Deferred to October
because the Teams sheet is empty until registration opens**: built now it would
read "declared 3, registered 0" for every club, and every fixture would be
invented with no real row to check the reconciliation against. Costs one extra
deploy; Jay chose that knowing the number. Recorded as the one open item in
`claude/parked-requests.md`.

### Needs one thing in Netlify

`CLUB_FORM_KEY`. **Until it is set the form refuses every submission, by
design** — the page shipped live and switched off.

## LAST SIGN IN ON THE ACCOUNT CARD — merged to `main`, LIVE, 3 Aug 2026 (`5c72eaf`)

Jay: *"i want to see last sign in below member since."* Nothing recorded one, so
the interesting half of this was never the field — it was **where the stamp gets
written**. One 15-credit deploy (`6a70bc50a249db00086d67b5`, production,
`ready`, `commit_ref` confirmed, secret scan clean — 122 files, 0 matches, **33
functions**, up from 32).

### ⚠️ The stamps live in their OWN blob store, one key per person

Every account lives in ONE blob under the key `list`, and `saveAccounts()`
rewrites the whole array; Netlify Blobs has no compare-and-set. That is
tolerable today **only** because the accounts blob is written rarely — create,
approve, reject, revoke, a password change, a Google link.

**A `lastSignInAt` field on the account record would have made it a write on
EVERY LOGIN.** Fifteen managers signing in inside a minute on tournament
morning, while an organiser approves somebody: both read the list, both write it
back, and the approval quietly did not happen. That is not a hypothetical — it
is exactly the bug that lost match results in July 2026 and forced the results
store to be split one blob per age group.

`netlify/functions/_signins.js` is a store of its own (`signins`), keyed per
username, so two people signing in at the same moment touch two different keys
and cannot collide at all — **and no sign-in can ever damage an account
record.** `test-my-account.js` **proves** it rather than asserting it in a
comment: it interleaves two sign-ins with an organiser approval mid-flight and
checks the approval survives, and there is an injected fault that moves the
stamp back onto the account record to prove that check fires.

### The rest of the rules, each with a fault

- **Recorded AFTER the password and approval checks, never before.** A failed
  attempt is not a sign-in, and stamping one would let anyone move somebody
  else's "last signed in" just by guessing at their username. Two faults: one
  that stamps before the password check, one that stamps a refused pending
  account.
- **Both doors record it** — `login.js` and `google-auth.js`, including a
  brand-new account approved immediately, or the first organiser would read as
  never having signed in.
- **Fails OPEN both ways.** `recordSignIn()` swallows everything: a display
  nicety must never cost somebody a sign-in on the one morning it matters.
  `readSignIn()` answers null rather than throwing.
- **The username is sanitised before it becomes a blob key**, the same way
  `_ratelimit.js` sanitises the client address.
- **The card shows the TIME as well as the date.** "3 August" alone cannot
  answer *"did they get in this morning?"*, which is the only question the line
  exists for.
- **No record renders as "Never"** — which covers both a person who has never
  signed in and a store that could not be read. Honest either way: we do not
  know that they have. An unparseable stamp reads Never too, never
  "Invalid Date".

Your own card reads it from `my-account.js`; somebody else's from
`accounts-admin.js`'s listing, which the card already renders — no second
endpoint and no second round trip. On your own card this is trivia; on
somebody else's it is the useful thing, and the reason Jay asked: **which
managers have never got in.**

### Three things the fault run caught, not the author

1. **`_signins.js` was missing from `_prove-registration.js`'s `NEEDED` list.**
   `login.js` and `google-auth.js` require it, so inside the prover's temp copy
   both died on ENOENT and **eight unrelated faults reported "failed, but not on
   the named check"**. The exact trap that list exists for, hit the moment a new
   shared module arrived.
2. **Two of the new faults were NOT caught, because the fixtures did not
   discriminate.** The no-accounts-write check ran against an EMPTY accounts
   list — so the fault that stamps the account record found nobody to stamp,
   wrote nothing, and the check would have passed **on the very mistake it
   exists to catch**. And the never-signed-in fixture had no `createdAt`, so a
   card falling back to the join date still rendered "Never". Both fixtures
   fixed; the faults are real. *The fixture has to DISCRIMINATE* — recorded
   again, in a third form.
3. **Renaming those checks then orphaned a fault anchored on the old name**, and
   the run named that too.

One prover fault was repointed: `accounts-admin.js`'s listing line gained a
field, so its anchor no longer matched.

### Verified

**33 files green on cafnet at `5c72eaf`** (`runall.ps1` exit 0, 34 headers),
**414/414 injected faults caught by the named check, 28 suites clean** — up from
403/403. 11 new faults, including one for the storage decision itself. Tree hash
`9c603e8d…` matched between the sandbox and the PC.

**Everybody reads "Never" until their next sign-in**, including Jay — the store
starts empty and nothing backfills it, because there is nothing to backfill
from.

## MY ACCOUNT — merged to `main`, LIVE, 3 Aug 2026 (`78f1697` + `688cd71`)

Design: `claude/specs/spec-my-account.md`, agreed with Jay the same day and
built in two commits — the endpoint first, then everything a person can see.
**One 15-credit deploy** (`6a7091c14d8bb40008ded65e`, production, `ready`,
`commit_ref` confirmed, secret scan clean — 121 files, 0 matches, **32
functions**, up from 31 because `my-account` is new; 9 redirect rules, 3
changed pages). It also carried the `/organizer` Accounts help copy that had
been sitting unbuilt on `main` since `83ff9da`.

### What Jay asked for, and the gap underneath it

He asked to link a Google account to an existing login, for both roles, as a
proper card showing a person their own details — and for an organiser to open
the same card on anyone from the Accounts tab.

Underneath it were two gaps nobody had noticed. **A manager could not change
their own password at all**: `changeMine` existed, but in `accounts-admin.js`,
whose door is `requireOrganizer`, so a manager got a 403 — and `/manager` had
no account UI of any kind anyway. And since `ORGANIZER_INVITE_CODE` was deleted
on 3 Aug, **every organiser created from then on is password-only,
permanently**, because `google-auth.js` finds an account exactly one way
(`googleSub === identity.sub`) and nothing but signing up *through* Google ever
sets it. That last part is deliberate and right — auto-matching a Google
identity to an account by email is how somebody ends up in an account that is
not theirs. Linking closes it by making the person prove both halves.

### `78f1697` — the endpoint

`netlify/functions/my-account.js`. **The door is ANY valid session, not an
organiser session**, which is the whole reason it is not in
`accounts-admin.js`. `GET` returns your own safe fields; `POST
{action:'password'}` changes your own password with the current one required;
`POST {action:'linkGoogle'}` attaches an identity.

⚠️ **The account acted on is ALWAYS the one in the verified token.** There is
deliberately no code path that reads a username, id or role off the request.
It is the only thing between "link my Google account" and "link my Google
account to somebody else's login".

**Linking refuses rather than replaces, three ways, each for its own reason:**
an identity already on another account is a 409 (two accounts sharing one would
resolve to whichever `find()` reached first — a silent mix-up in a store
holding children's dates of birth and medical notes); a *different* identity
already on your own account is a 409 too, **not a swap**, or a stolen session
could plant a way back in that survives the real owner changing their password;
and re-linking the *same* identity is a no-op success, so a double-click is
harmless. **Accepted consequence: there is no unlink and no way to move one.**
For ~18 accounts on a volunteer tournament that is the right trade.

`changeMine` was deleted from `accounts-admin.js` in the same commit — two ways
to change your own password is two rules that drift. `action:'password'` (an
organiser resetting SOMEONE ELSE'S, with no current password, because the point
is that it is lost) stays there, behind that door.

### `688cd71` — the card, and `/signin`

**One card, two modes**, on `/organizer` and `/manager`: name, username, role
in words (a manager's age group by its real NAME, not `u14b`), sign-in method,
member since. Your own gets Change password and Link Google; somebody else's
gets Reset password and Approve/Reject/Revoke, opened by clicking any row in
the Accounts tab.

⚠️ **LINK GOOGLE IS ABSENT FROM OTHER-PERSON MODE BY DESIGN, NOT OMISSION.** An
organiser attaching a Google identity to someone else's login would be
attaching their OWN — precisely the takeover the `googleSub`-only lookup exists
to prevent. **Two guards, each with its own injected fault:** the
`!s.acctSubject` clause in `acctCanLinkGoogle`, and an early return in
`onAccountGoogleCredential`. The second is provable alone because the test
calls the handler directly and bypasses the first — a guard nothing can catch
on its own is a guard too many.

The card's markup is a second copy on purpose (no build step, no shared
component system). Its DATA LAYER is not: both pages call the same three
functions out of `scores-data.js`, asserted by name.

**`/signin` lost the signup role picker, both flows** — password and Google.
With `ORGANIZER_INVITE_CODE` gone an organiser signup can only ever be refused,
and refused with a wrong-code message that reads as "you typed it wrong": the
worst kind of dead end, because the person retypes a code that was never going
to work. The blurb, the organiser-only title inputs and the ADMIN/AGE GROUP
label switching went with it. `signupRole` stays in state, fixed at `'manager'`
with no setter, so both payloads keep their exact shape.

### Two things the build found on its own

⚠️ **`accounts-admin.js` could not say "Both".** Its listing derived
`signInMethod` for itself as `googleSub ? 'Google' : 'Password'`, **which
cannot ever return `'Both'`** — so a password login with Google linked read as
"Google only". Invisible while nothing displayed the field; the card displays
it as one of five facts about a person, and linking made `'Both'` an ordinary
state rather than an impossible one. Now `_auth.js`'s `signInMethodOf()`, one
copy for both readers, **driven** in `test-my-account.js` rather than grepped.

⚠️ **`/organizer` called `api.googleClientId()` and `organizer-data.js` did not
export it.** Caught by `test-accounts.js`'s `api.*` sweep — the exact failure
mode that sweep exists for, since two password features were dead and silent
for weeks in July for the same reason. **A general sweep beats a second copy of
it**, again.

### Three assertions and two faults repointed, not deleted

All for the same reason: their subject **moved rather than died**.

- `test-google-auth.js`'s `signInMethod` check followed the derivation out to
  the shared helper, and gained one asserting it is NOT derived locally.
- `test-signin-page.js`'s "no Google sign-in machinery remains on /organizer"
  was **NARROWED, in four parts** — both pages legitimately load Google's
  script now to LINK an identity. Two negative checks (no `googleAuth` call, no
  sign-in button) plus two positive ones naming the link machinery, because a
  widened check is a check with less to say and the newly-allowed thing needs
  its own assertions rather than silence.
- `test-signin-page.js`'s organiser-signup check used to set
  `signupRole:'organizer'` by hand — **a state the shipped page can no longer
  reach**, so it proved nothing about what anyone can actually do. It now
  asserts the closure itself, on the page source.

Two prover faults had rotted the same way and were repointed with their
subjects.

### Verified

- **33 test files green on cafnet at `688cd71`** (`runall.ps1` exit 0, 34
  `--- <file>` headers counted), **403/403 injected faults caught by the named
  check, 28 suites clean** on an undamaged copy — up from 389/389. **15 new
  faults**, including one per guard on the Link-Google split, one for a
  username creeping into the password-change payload, one for the
  loading-vs-failed distinction, and one for `/manager` growing an
  organiser-only accounts-admin call.
- **Content identity by tree hash on every transfer** — `5eecd6a5…` in,
  `58e44c8a…` out, both matching between the sandbox and the PC. Moved by
  `git bundle`, so the SHAs are identical.
- **The deploy verified via the Netlify MCP**, including that the function
  count rose to 32 with `my-account` in the deployed list.
- **NOT walked through on the live site by a human** — flagged in
  `state-of-play.md`'s Jobs for Jay.

### One thing found while verifying the deploy, unrelated to this work

**The site-wide password is OFF** (`requiresPassword: false` on the live
project, 3 Aug). `state-of-play.md` had said ON since it was set, and several
decisions were taken on that basis — including the framing of the invite-code
rate limit a few hours earlier as "safe for now because the password hides it".
It does not hide it. The fix had already shipped; the reasoning about *why it
was urgent* was wrong in the reassuring direction. **A fact about the
environment is not a fact about the repo, and nothing in the suite can notice
it changing.**

## RETIRING THE OLD LOGINS, RATE-LIMITING THE INVITE CODES, AND CLOSING ORGANISER SELF-SIGNUP — 3 Aug 2026 afternoon (`ff5ba3d`, `c5df5fa`, `83ff9da`)

Three commits after the morning's venue/Manager batch. **One 15-credit deploy
covered the two that changed the build** (`6a70513ece942b0008d62059`,
production, `ready`, `commit_ref` confirmed, secret scan clean — 119 files, 0
matches, **31 functions, down from 33**, which is the retirement visible in
production). The third is `[skip ci]` and cost nothing.

Also this afternoon, before any of it: **cafnet's clone was found 38 commits
behind** — sitting on `dev` at `cdd36bc`, before the whole unify / light-mode /
design-audit / HSBC run. Clean tree, so it fast-forwarded straight up. It then
ran the repo suite **for the first time ever** and gated every push below on it.
The GitHub MCP token on that machine is confirmed dead (`Bad credentials`); the
Desktop Commander / Filesystem write path is unaffected and did all the work.

### `ff5ba3d` — `organizer-login.js` and `manager-login.js` retired

The last deliberately deferred piece of the 2 Aug unification. Nothing had
called either since `/signin` shipped; they were kept byte-identical only so
`test-accounts.js` and `test-google-auth.js` could pass byte-unchanged through
that merge. On a public repo whose root IS the deployed site, dead code is
still published — and a second password endpoint carries its own rate-limit
bucket, which is exactly the extra guess budget the shared bucket exists to
deny.

**The risk was that deleting them removes assertions without failing anything.**
Those two files were the *reference* for every parity check on `login.js`'s
session and token shapes. Delete the file a check compares against and you do
not get a red test — you get a check that has quietly stopped checking. Every
reader moved to its subject instead:

- **`test-unified-login.js`** — parity became **hardcoded literals** on
  `login.js` alone. That was always the half doing the work: a parity check
  between two copies passes on a change made to both. Plus two new checks that
  the retired files have not come back.
- **`test-google-auth.js`** — the Google-vs-password session parity now reads
  `login.js`. Strictly better: it pins against the live endpoint rather than a
  dead one, and both sides are asserted, so a drift in either fails it.
- **`test-accounts.js`** — the no-length-check-at-login rule reads `login.js`,
  the only password endpoint that can now make that mistake.
- **`_prove-registration.js`** — both `NEEDED` entries dropped; the "a length
  check is added to organizer-login.js" fault **repointed** to `login.js`
  rather than deleted, because the rule it guards is still alive.

**Two fault anchors were orphaned by the renaming and repointed in the same
change** (the `:login` bucket check, the organizer session literal), found by
sweeping every fault's `expect` string against its suite before running
anything. `expect` uses `.some()`, so a fault with two anchors keeps "passing"
on the surviving one while the renamed half guards nothing.

**Check count 3140 → 3121, fully accounted:** −16 is `test-functions-load.js`
no longer loading and calling two files that no longer exist; −1 is
`test-accounts.js`'s loop over two files becoming one; −2 is the rate-bucket
loop over three endpoints becoming one (−4) plus the two new retirement checks
(+2). No assertion was dropped without its subject. 374/374 faults caught (was
370 — four new: each file resurrected, and `login.js` drifting on each session
shape against `test-google-auth.js`).

### `c5df5fa` — the invite codes took unlimited guesses

Found while investigating an unrelated question. `organizer-signup.js`,
`manager-signup.js` and `google-auth.js`'s signup branch each check an invite
code with a plain string compare, and **none of them counted attempts**. The
site-wide password hid it; that comes off about 20 days before the tournament.

`_ratelimit.js` gains `checkSignupRate()` / `SIGNUP_RATE_OPTS` /
`tooManyResponse()`: **ten attempts per address per 15 minutes, ONE
`${ip}:signup` bucket shared by all three** — the same argument that put the
old three login endpoints in one bucket, since three endpoints guessing the
same secrets with a budget each is one budget three times over. Kept apart from
`:login` so a mistyped password does not eat a new manager's signup budget.
Fails OPEN like every other use of the module. `tooManyResponse()` is now the
only copy of the 429 sentence, `login.js` included, so four endpoints cannot
drift apart on the wording.

⚠️ **In `google-auth.js` the check sits on the SIGNUP branch, below the
`if (!inviteCode)` return — not at the top of the handler.** Above that line
the request is a Google SIGN-IN, and rate-limiting those would lock managers
out of a venue where fifteen of them share one wifi address on tournament
morning: an outage we would have caused ourselves on the one day it must not
happen. Moving it up is the tidy-up that looks harmless, so it has a fault of
its own.

New `tests/test-signup-ratelimit.js` **drives all three real handlers** against
an in-memory store rather than grepping for the call — a text check passes on a
guard whose answer is never read. 22 checks, seven faults, added to
`runall.ps1` by hand in the same commit.

⚠️ **AND THE FAULT RUN'S OWN BASELINE LIST WAS A SECOND EXPLICIT LIST.** The
new suite did not join it by itself, so it ran seven faults with no baseline and
the run reported **381/381** — the number that was supposed to be reassuring.
It was meaningless for those seven: **a suite that fails on an UNDAMAGED copy
fails for every fault too, so all of its faults report "caught" while proving
nothing.** `BASELINE` is now DERIVED from the faults' own `suite` names so the
two lists cannot drift, with a hardcoded floor so a derived list that collapsed
to nothing could not report a clean bill of health. Proven by deliberately
breaking a suite: the run named it `BASELINE FAIL` and dropped its faults to
374/381 rather than passing.

⚠️ **The severity was OVERSTATED in this commit's own message, and the record
now says so.** A self-signed-up organiser lands `approved: false` — the
auto-approve only fires when no organiser exists — and `login.js` refuses a
pending account with a 403. **Guessing the code never yielded access to
anyone's data; it yielded a pending account awaiting approval.** The real risks
were account spam filling the store, a plausible pending account being approved
by mistake, and the bootstrap if the accounts store were ever emptied. Worth
fixing. Not the emergency the message described. A severity claim needs the
same proof as a technical one.

### `83ff9da` — `ORGANIZER_INVITE_CODE` deleted, docs caught up (`[skip ci]`)

**Jay deleted the variable in Netlify the same afternoon**, which closes
organiser self-signup outright: both `organizer-signup.js` and
`google-auth.js`'s organiser branch refuse every signup while it is absent, and
the back office (Accounts → Create a login → Organiser) is now the only way an
organiser account is made. No deploy needed — the variable is read per request.

Why it was redundant: the back-office route arrived on 27 Jul and is better in
three ways — a shared code has no expiry, cannot be revoked for one person, and
leaves no record of who used it, where a named account has all three. Deleting
it also shut the first-organiser-auto-approved bootstrap.

Nine places still described the variable as present or as a decision pending:
`organizer-signup.js`'s header (its ONE-TIME SETUP told you to add it),
`google-auth.js`, `accounts-admin.js`, `organizer-data.js` in three places,
`CLAUDE.md`'s env-var list and Accounts section, and the Accounts tab help copy
in `Organizer.dc.html`.

**`organizer-signup.js` is KEPT rather than deleted, and the header now says
why: it is the recovery path.** If every organiser account were ever lost there
would be no way back in — re-add the variable, sign up (the first organiser
auto-approves), delete it again. That is also why the bootstrap stays.

⚠️ **The deletion promoted an ordinary check into a load-bearing one, with
nothing in the repo changing.** The closed state depends on BOTH signup paths
refusing on the variable's ABSENCE, not merely on a mismatch.
`test-accounts.js` pinned `organizer-signup.js`'s half; `test-google-auth.js`
pinned only the mismatch clause, so the Google half would have passed with the
absence clause deleted. Now asserted, with a fault of its own — 382 faults.

**`MANAGER_INVITE_CODES` stays**, and the reasoning is recorded because it is
not the same shape: fifteen age groups means the alternative is creating
fifteen accounts by hand and transmitting fifteen passwords — and a password is
a working credential the moment it exists, where an invite code yields only a
PENDING account somebody still has to approve. The manager codes are scoped one
per age group; the organiser code was one secret for total access.

### Verified

- **32 files green on BOTH machines at `83ff9da`; 382/382 injected faults
  caught by the named check; 27 suites clean on an undamaged copy.** Every push
  was gated on cafnet's own run of `runall.ps1` before `git push`.
- **Content identity proved by tree hash on every transfer** — `d356b78c…`,
  `9540cdd1…`, `bb61a659…` all matched between the sandbox and the PC. Commits
  moved by `git bundle`, so the SHAs are identical and nothing read and rewrote
  the bytes.
- **`[skip ci]` verified twice by the deploy NOT moving** — the current deploy
  id was unchanged after both `f3b0348` and `83ff9da` landed on `main` and
  `dev`. For a `[skip ci]` push, that is the verification.

### Found, recorded, not fixed

⚠️ **The `"admin"` key in `MANAGER_INVITE_CODES` does not work as documented.**
`manager-signup.js` stores whichever KEY NAME matched the code, and the
all-groups check in `_auth.js` is `ageGroupId === '*'` — a literal asterisk. A
key called `"admin"` creates a manager scoped to a group that does not exist,
with access to nothing. It fails CLOSED, so it is a documentation bug rather
than a hole — but a master code set up that way would silently not work, and
both `manager-signup.js`'s setup comment and `CLAUDE.md` give the wrong
instruction. **The key has to be `"*"`.** Nothing validates that the keys in
that map are real age-group ids either, so a typo also fails closed and
silently.

## THE `tests/` ACCURACY PASS — 3 Aug 2026, docs only (`f3b0348`, `[skip ci]`, no deploy, 0 credits)

The 2 Aug CLAUDE.md accuracy pass (`8cd90e0`) never reached `tests/`, so for a
day the test runner itself went on giving superseded instructions. `runall.ps1`
was still telling every session, after every green run, that thirteen more
files in `C:\Users\jayjm\adhjrt-sim` were the missing half of the suite and
that BOTH had to be run — an instruction the 2 Aug triage had already
superseded. Corrected there and in `tests/README.md`.

The same pass fixed the fault count, which was written down as **17 in
`tests/README.md`'s prose, 171 in its own table and 333 in `CLAUDE.md`** while
the real answer was **370**; `_prove-registration.js`'s header claim that it is
"NOT part of runall.ps1" (it IS run by runall.ps1, as a separate step,
skippable with `-NoProve`); and `_lib.js` describing the sim folder as a
pending migration.

**`runall.ps1` is also pure ASCII now.** The 3 Aug suite run's own output
proved PowerShell 5.1 was mis-decoding the em dashes in its comments into
mojibake on every run — the same trap that had broken the morning's land
script a few hours earlier.

## VENUE RESET, READABLE CHIPS, AND THE MANAGER-AREA BATCH — merged to `main`, LIVE, 3 Aug 2026 (`dea297c`)

Five commits (`8cd90e0..dea297c`), built over 2–3 Aug on `dev`, merged as
one fast-forward on Jay's "all good, merge to main" — **one 15-credit
deploy for all of it.** Netlify deploy `6a70235fe202f000081ae784`,
production, `ready`, `commit_ref` confirmed matching, secret scan clean
(120 files, 0 matches), 33 functions, 9 redirect rules. Not re-verified
live page-by-page after the merge — the deploy is the same tree the dev
branch preview served.

**`453c1f7` — Venue & days: Reset clears assignments (Jay).** The old
"Reset to 2025 layout" button posted `{reset:true}` to the server
immediately — the one control on a tab whose promise is "nothing changes
until you press Save". Replaced with a working-copy Reset that empties
every age group's pitch assignment on both days (splits, surfaces and
day membership kept), behind a confirm that says exactly that, saved only
via the ordinary Save path. The 2025 running-order blurb is gone from the
explanation, `resetVenue()` deleted from `organizer-data.js` (the server
still honours `{reset:true}` as a documented escape hatch). New Reset
section in `test-venue-splits.js`; 8 faults.

**`63cd590` + `3b59868` — venue map & schematic chips redesigned (Jay:
"difficult to read, especially the age group text").** Second legibility
complaint against ink-on-tint, so the model changed rather than the math:
chips are now opaque white cards with constant dark ink, and the age
group's tint appears as an 11px outlined swatch beside the code — contrast
is constant by construction. The whole chipInk/chipFill computation layer
was deleted with a tombstone; `test-venue-map.js`'s legibility section
rewritten (exact-tint swatch sweep over all 15 groups, U6+U7 two-swatch
time-share check), 8 chip-design faults replacing the 7 machinery ones.
`3b59868` hardened the time-share check to report instead of throw under
fault injection (guarded `|| {}` access), caught by the PC land script's
suite gate before push.

**`600147b` — the Manager-area & homepage batch (Jay's seven-item list,
3 Aug).** All seven items:

1. **Organiser path back to `/organizer`** — a "View organizer area" link
   in the Manager header, inside the one `isOrganiser` sc-if gate, so a
   manager never sees a door they cannot open.
2. **Today tab REMOVED** (Jay's pick from three options) — it was a strict
   subset of Fixtures & scoring (next match + recent results). Managers
   land on Fixtures & scoring; sign-out resets there; MANAGER_TABS is five.
3. **"Viewing as"** label on the organiser age switcher.
4. **Fixtures & scoring as click-to-score cards** — pool and knockout
   matches sit on an auto-fill grid (`minmax(230px,1fr)`) of compact white
   cards instead of full-width rows; the row template survives only on
   Results, asserted by counting both.
5. **Spirit nominee inputs moved inside each team's score-sheet box**,
   directly under that team's Cards row (bottom-of-sheet placement was
   being missed); per-side label, team name kept as placeholder so the
   sides cannot be filled in swapped; `sheetShowSpirit` gating and all
   bindings unchanged, so the payload tests passed untouched.
6. **"Click to score"** in green on every unscored card via
   `statusLine`/`statusStyle` on the shared `matchRows()` view-model —
   a scored card shows the score in Anton instead.
7. **Homepage header "Menu" dropdown** — every section link plus BOTH
   sign-ins as real hrefs to `/organizer` and `/manager` ("functional, not
   just jump to bottom"). The visible desktop nav bar is unchanged (seven
   public links); the two sign-ins ride in the nav as `display:none`
   anchors that the phone hamburger panel's own `display:block!important`
   rule un-hides, and the dropdown itself is hidden under 760px. Nav +
   dropdown share a `.hdr-right` wrapper so the header row keeps three
   direct children. **This deliberately amends the 2 Aug "footer only"
   decision at Jay's explicit request** — `test-back-office-links.js` was
   rewritten to the new contract with the history recorded in its header:
   footer unchanged, agreed names everywhere, and exactly two of each
   back-office href above the footer, both in the header.

**`dea297c` — dropdown follow-up (Jay: no word "Menu"; click-away should
close it).** The button is the bare ☰ icon, flipping to ✕ while open — the
same pair as the phone toggle so it reads as "menu" everywhere; the words
moved into aria-label. Click-away closing is a DOCUMENT listener that
ignores clicks inside `.hdr-menu` and is removed on unmount — deliberately
not a backdrop div: the sticky header's `backdrop-filter` makes it a
containing block, so a `position:fixed` backdrop inside it covers only the
header strip, not the viewport. Measured before switching approach (a hero
click sailed past the backdrop in a real render), and the working behaviour
verified the same way: opens from the button, closes on an outside click,
button still toggles both ways. Three new faults (listener never
registered / stops ignoring the dropdown / leaks past unmount) plus the
word-creeps-back fault; `test-back-office-links.js` at 58 checks.

### Verified

Sandbox and jay-pc: full suite green (`runall.ps1` exit 0), **370/370
injected faults caught, 26 baseline suites clean** (up from 333/24 —
16 new faults for the Manager batch, 11 rewritten back-office faults,
plus the venue/chip faults). test-manager-dc 149 checks, score-sheet 80
(new structural placement section), back-office-links 52 under the
rewritten contract, test-sponsors re-anchored for `.hdr-right` (the
header-row three-children invariant still holds). Rendered and reviewed:
Manager fixtures grid, the score sheet with in-box nominees, homepage
with the dropdown open. Landed on the PC via git bundle; two land-script
lessons recorded in state-of-play (ASCII-only .ps1; ErrorActionPreference
Stop vs native stderr).

## DESIGN AUDIT, BATCHES A/B/C — merged to `main`, LIVE, 2 Aug 2026 (late night, `32ff4d4`)

Jay invoked a design-audit skill and chose "whole site" as the scope. A
diagnosis came first — three parallel reviewers over all seven pages at
`ea7a2b0` against a typography / colour / layout / interaction-states /
content checklist, every high-severity claim re-verified in source before
it reached him — written up as `claude/specs/design-audit-aug-2026.md` in
three batches. Jay approved all three "into a new branch named potential",
then said "merge it" after the summary and renders. Three commits,
fast-forwarded `potential` → `dev` → `main` as ONE 15-credit deploy
(`6a6f8806ce942b0008b2df28`, production, `ready`, `commit_ref` confirmed,
secret scan clean, 120 files); the remote branch deleted after the merge.

**Batch A (`7415830`) — broken things.** apple-touch-icon pointed at a
folder that never existed on six of seven pages; "Open in maps" went to
bare maps.google.com; five `color-scheme:dark` leftovers made the light
back office's date/time picker icons near-invisible; the Organizer confirm
modal was near-black-on-red; `/scores` pool tables clipped the +/−, T and
PTS columns on phones (overflow:hidden around ~660px of fixed columns —
now one scrollable unit) and the awards grid overflowed; the app's bottom
sheet caps at 92dvh so iOS Safari's toolbar cannot hide Close, and a
dropped connection shows a retry card instead of "Loading…" forever; plus
the small dead things (double Google error on /signin, one `#0E6B34`
typo, missing `html lang` on six pages, `/legal` bare-`#` back-to-tops,
leftover Manager CSS on /scores).

**Batch B (`31014e5`) — states and feedback.** The site's one systematic
gap: almost nothing reacted to hover, press, keyboard focus or being
disabled. One blanket rule set per page (filter/transform only, so no
inline style is ever overridden), `tabular-nums` page-wide, loading told
apart from empty on /organizer, /scores, /manager and the app, disabled
buttons that look disabled, the app's two native `confirm()` dialogs
replaced with inline confirms, /signin autocomplete for password managers
plus Enter-to-submit, Escape closes modals, and `scroll-margin-top` so
anchor jumps stop hiding headings under the sticky header. Also:
Manager's "+ Add pool" no longer throws with no draw loaded, Save gets
its busy label, and the draw editor's chips/drop zones became
keyboard-reachable (role="button" + tabindex + Enter/Space — not a
`<button>` conversion, since the chips contain buttons and nesting would
be invalid HTML).

**Batch C (`32ff4d4`) — polish, consistency, and the pinning test.** The
back office reads as one product (venue-tab type scale normalised, grey
table-header bands both pages, green role picker both places,
ORGANISER / BACK OFFICE header with the sentence-case link, wrapping tab
bar, 70ch help copy, age-ordered filter via the AGE_GROUP_ORDER map that
already existed for exactly this); homepage small stuff (10px band
labels, one light green `#3bd070`, warmed cream-section greys with the
one dark-modal grey kept cool, fixed 2×2 mobile stat dividers,
reduced-motion extended to the hero shards); `assets/share-card.png` — a
rendered 1200×630 brand card behind og:image/twitter:image on the
homepage, /scores and /legal (re-render it if the dates change — noted in
CLAUDE.md's brand section); and a branded `404.html`. Deliberately left:
toast-vs-inline feedback grammar (no user-facing conflict worth the
churn), and everything test-pinned as a decision.

### Verified

Full suite green on jay-pc (`tests/runall.ps1` exit 0, 31 files including
the new `tests/test-design-polish.js` — 48 checks, added to runall.ps1 by
hand), **333/333 injected faults caught, 24 suites clean** on the
undamaged copy. 22 new faults; the fault run caught one weak assertion
mid-build — the og:image check used a bare `.includes(url)` that the
twitter:image tag also satisfied, so a fault swapping og:image alone
passed; tightened to assert the full tag. Smoke renders (homepage desktop
+ phone, venue tab, /signin signup, 404) were compared against an
`ea7a2b0` baseline worktree — no layout regressions; the organiser-names
strip in the hero was confirmed pre-existing. The branch reached the PC
as a git bundle, identical SHAs. Two old anchors moved with the code
(`test-fixtures-results-sync.js`'s onSelect literal,
`test-organizer-manager-link.js`'s sentence-case label), both re-proven
by the fault run. New NEEDED entries in `_prove-registration.js`:
`legal.html`, `404.html` and four asset files — which flipped
`test-sponsors.js`'s assets-directory gate and required the HSBC lockups
to ride along too (a skip condition is part of the contract).

**Not re-verified live page-by-page after the merge** — the deploy is the
same tree the branch preview served; Jay's next ordinary visit exercises
it. WhatsApp/Twitter cache old link previews, so an already-shared link
may show the stale crest card for a while; fresh shares get the new one.

## LIGHT MODE FOR THE BACK OFFICE — merged to `main`, LIVE, 2 Aug 2026 (night, `ea7a2b0`)

Jay: "i want the organizer and manager area to be in light mode" — scoped
with him to `/organizer`, `/manager` AND `/signin` (the door to both),
always-light, no toggle. The public site, `/scores` and `/app` keep the
dark brand. Approved from real rendered screenshots before anything
shipped; one commit, one 15-credit deploy.

One systematic palette conversion: page `#0C0C0E` → `#F3F2EF`, cards
`#151517` → white, ink `#fff` → `#1A1C1F`, the grey ramp re-cut, status
colours darkened for a white ground (success → `#0E6B33`, errors →
`#A62626`, amber → `#8F6400`), white-alpha hairlines → black-alpha at the
same alphas. Deliberately untouched: the red/green brand accents with
their white button text (site-wide pattern, byte-identical), crest
artwork, modal backdrops, and the venue map's age-group TINTS plus their
chipInk/chipFill machinery — **the first mechanical pass DID convert the
U8 tint (`#f5c518`) and `test-venue-map.js`'s own contrast property
caught it immediately; tints are data shared with the standings, not mode
styling.**

Verified by rendering: five key views screenshotted in headless Chromium
with the real Anton/Barlow faces (React + fonts vendored from npm), and
an automated WCAG audit over every visible text node against its
composited background — zero pairs under 4.5:1 (brand accent buttons
excepted, pre-existing). ⚠️ **The audit's first run reported zero
failures because the pages had rendered BLANK** (unpkg unreachable in the
sandbox) — asserting absence over nothing, again; the 5.7 KB screenshots
gave it away. New `tests/test-light-mode.js` pins the light/dark split
BOTH ways with three faults; five existing files re-anchored to the light
literals. All 30 suites green, **311/311 faults caught**, on sandbox AND
jay-pc. Live-verified in Jay's Chrome: `/organizer` light and signed in,
`/manager` + `/signin` serving the light body, `/scores` still dark,
`/app` untouched.

## THE BACK OFFICE UNIFIED: MANAGER AREA OUT OF /scores + ONE LOGIN — merged to `main`, LIVE AND VERIFIED LIVE, 2 Aug 2026 (evening)

Eleven commits, built as branch `unify-back-office` off `dev`, reviewed as
two halves, merged as one fast-forward `91080a2..fc6ae59` — **one deploy,
15 credits, for all of it.** Net −1,722 lines (25 files, +2,844/−4,566).
Designs (both approved by Jay before building, every open question answered
and recorded): `claude/specs/spec-scores-manager-removal.md` (v2) and
`claude/specs/spec-unified-login.md`.

### Half 1 — `/scores` is purely public (7 commits)

- `/organizer` gained a **Tournament** tab holding the organiser-only tools
  that lived nowhere else once the Manager area went: **Publish all /
  Unpublish all**, the **scoring rules editor** (with the tab's own
  age-group picker and per-group drafts), and **Simulate whole tournament /
  Reset the simulation** — including the two-pass knockout, Spirit
  nominations, `breakSpiritTies()`, the typed-word gates and the
  tournament-day guard. Each move its own commit with component-driven
  tests and injected faults; `organizer-data.js` re-exports every call from
  `scores-data.js` rather than reimplementing anything.
- **Import registered teams was NOT moved — the morning spec was wrong**
  that it lived only on `/scores`: the 1 Aug Manager Dashboard rebuild had
  already ported the full feature to `/manager`'s Draw tab. Jay agreed to
  skip the move (no third copy). Instead `/manager` gained the one thing it
  lacked: **`teamNames` rebuilt from the registrations on EVERY draw save**
  (the `withTeamNames()` rule — fetches registrations if never loaded,
  derived names win, empty read is a no-op), covering both save sites.
- **The rehearsal-data cleanup panel was DELETED, not moved.** Jay reported
  the cleanup done; **verified live before the deletion commit** through
  his signed-in Chrome: `get-results` → 0 stored results,
  `get-schedule-override` → no published copy in any of the 15 groups.
  CLAUDE.md's section is now a tombstone recording those numbers.
- `/app`'s More-tab tools link and the organizer-login manager-fallback
  redirect were repointed at `/manager`; then the deletion commit took
  `Scores & Standings.dc.html` from 3,819 lines to ~670 — sign-in, score
  entry, the drag-and-drop editor, knockout generation, per-group publish
  (and with it the known Republish stale-closure bug's home), the clash
  panel, registrations tabs and the modal machinery all gone. The page
  keeps a quiet footer "Manager sign-in →" link. **Parked item 5 — the two
  draw editors' pool-preference matchers disagreeing — is RESOLVED BY
  DELETION**: `/manager`'s `/[A-Z]/i` is the only matcher left and no
  reading rule changed.

### Half 2 — one login (4 commits)

- **`netlify/functions/login.js`** — one endpoint, both roles: account
  looked up by username alone (the role filter is exactly what forced the
  old fallback chains), session/token shapes character-for-character the
  old per-role ones, same `${ip}:login` rate bucket so the attempt budget
  stays one pool, same null-passwordHash guard for Google accounts, no
  password-length check ever. **The old `organizer-login.js` /
  `manager-login.js` stay byte-identical and uncalled** — Jay's gate was
  that `test-accounts.js`, `test-session-permissions.js`,
  `test-google-auth.js` and `test-functions-load.js` pass BYTE-UNCHANGED,
  and two of them read those files by name. Parity checks in
  `test-unified-login.js` pin all three together; retirement is a later
  commit of its own.
- **One session key, `adhjrt_session_v2`**, both data layers, with a
  one-time `migrateSession()` (single copy, in scores-data.js): organizer
  key beats manager key for anyone holding both, old keys are cleaned,
  malformed JSON reads as absent, tokens untouched — **nobody signed out**.
  `logout()` clears all three keys.
- **`Signin.dc.html` at `/signin`** — password + Google + BOTH signup flows
  (role picker chooses the invite-code gate), routing by the account's role
  after sign-in, `?next=` honoured only from the `/organizer`|`/manager`
  allow-list and only when the role permits (a manager asked for
  `/organizer` goes to `/manager`). `/organizer` and `/manager` lost their
  sign-in views and redirect signed-out visitors there. **The localStorage
  hack — organizer login falling back to manager-login and hand-writing the
  token into the other data layer's key — is deleted whole.**

### Verified

- **Sandbox AND jay-pc: 29 test files green, 308/308 injected faults
  caught by their named checks** (`tests/runall.ps1` exit 0 on the PC).
  Five new test files: `test-organizer-tournament.js`,
  `test-scores-public.js` (asserts what REMAINS by driving the public
  page), `test-unified-login.js` (drives the real handler end to end
  through a discriminating stub harness, including a real 10-then-429
  rate-limit run), `test-session-migration.js` (drives the real
  scores-data module under a fake localStorage), `test-signin-page.js`.
- **The branch reached the PC as a git bundle** — same commit SHA both
  sides, so content identity was cryptographic; no byte ever passed
  through the model.
- **The old adhjrt-sim suite (13 files, jay-pc only): no regressions.**
  Its `test-venue.js`, `test-venue-panel.js`, `test-layout.js` and 2
  clash-check checks fail IDENTICALLY on base `91080a2` (stale since
  before the branch); `test-cleanup.js`, `test-pool-pitch.js`,
  `test-teamnames.js` and 14 clash-check checks are obsolete because their
  subject was deliberately deleted — that coverage now lives in the repo
  suite.
- **Dev-preview verification before the main merge**, in Jay's Chrome on
  the permanent dev URL: `/signin` recognised an old-key organizer session,
  migrated it and routed straight to `/organizer`; the Tournament tab
  rendered all three cards; `/scores` rendered public with the footer
  link; `/manager` showed the organiser switcher.
- **Production verification after the merge**, on adhjrt.com with Jay's
  REAL session: `/scores` public (old keys still present and untouched —
  the public page reads no session, correctly); `/manager` **migrated the
  real session live** (org key → v2, old keys removed, still signed in as
  organiser `jay`); `/signin` routed the existing session straight to
  `/organizer`; the unified endpoint answered a wrong password with a
  clean 401 and the right sentence. Deploy `6a6f6ba3928d840008b79941`,
  state `ready`. The remote branch was deleted after the merge (branch
  deploys build automatically — no reason to keep paying for it).

### ⚠️ One discovery during live verification, NOT caused by this branch

**The registration sheets are NOT empty: 241 teams / 961 players** showed
in `/organizer` on the dev preview — invented rows from the 1 Aug
simulation work (state-of-play's "sheets clean" row dated from 30 Jul,
before that work refilled them). The deleted cleanup panel never touched
sheets by design; clearing them is Jay's hand, by the old recipe: filter
any phone column on `971500000000` and delete. Must happen before the site
password comes off.

## COPY FIXES, HSBC PLACEMENTS, CLUB REGISTRATION REMOVED — merged to `main`, LIVE, 2 Aug 2026 (afternoon, `91080a2`)

Recorded in brief — the full design reasoning is in `CLAUDE.md` (HSBC
section, club-removal section) and the unusually complete commit messages
(`5832817`, `c00925d`, `b148944`, and the club-removal commits up to
`91080a2`). Six commits, one fast-forward, one deploy. Highlights: the
medal claim removed from the shared copy block (byte-identical in both
files); HSBC as principal partner in the sticky header (measured 1000px
hide), a `#partner` band and the sponsors section; nineteen unconfirmed
sponsor names deleted and asserted absent BY NAME; "thousands" not
"hundreds" asserted as an invariant against the stat strip; club-level
registration removed entirely, leaving `club-registration` an UNKNOWN FORM
the gateway refuses. 62 checks and 18 faults shipped with the copy/HSBC
work. The earlier entries for club registration below describe a feature
that no longer exists on the site — kept as history.

## CLUB-LEVEL REGISTRATION — merged to `main`, LIVE but NOT YET USABLE, 1 Aug 2026

Parked item 1, and the largest of the day. A club registers **itself**, once,
declaring which age groups it is sending teams to and how many in each.
Nothing before this answered "how many teams is this club bringing", so
pools, the draw and pitch allocation could not be planned until every team
had separately registered — days before the tournament.

**Design: `claude/specs/spec-club-registration.md`. Commit `1cdc521`.**

### Jay's three decisions, which shaped everything

1. **Declaration first, teams later.** The existing team form is completely
   unchanged. Two things to chase a club about, in exchange for planning
   numbers weeks earlier.
2. **A declaration mints NO team codes.** Planning information only, so a
   club that declares 3 and sends 2 never leaves a phantom team in a draw.
   `_teams.js` numbering is untouched.
3. **Declared vs actual is shown, never enforced.** A plan, not a promise —
   capping registrations at the declared number would refuse a genuine late
   team on tournament run-up, which is a phone call, not a fix.

### What was built

**A third form through the SAME gateway, with no adapter change at all.**
`FORMS` already carried a `sheetEnv` per form and `submit-registration.js`'s
`appendRow` already resolved `process.env[spec.sheetEnv]` generically. So the
rate limit, honeypot, registration window, length caps and the
no-field-values-in-logs rule all apply unchanged — it is the same
`handleSubmission()`. Netlify Blobs was considered and rejected: it would
have needed its own branch inside that function, whose whole design is that
it has one path.

**21 columns, one row per club, `A:U`.** One row per club rather than one per
club-per-age-group, so "how many U12 teams are coming" is a single column to
sum and `rowFrom()` — which builds exactly one row per submission — works
unchanged.

⚠️ **The fifteen count columns are WRITTEN OUT, not derived from
`AGE_GROUPS`.** Deriving them would guarantee they never drift from the
age-group table, but it would also mean reordering `AGE_GROUPS` silently
reshuffles the columns of a sheet that already has rows in it — the exact
disaster the comment above `TEAM_COLUMNS` warns about. Written out, the sheet
order is permanent, and a test compares the two lists **both ways** so adding
a sixteenth age group fails loudly and a human decides what to do about the
sheet. They are in real age order, so `u12g` sits between `u12` and `u13`
where an alphabetical sort would not put it.

**No `total-teams` column.** Derivable, and a derived fact stored twice is a
fact that eventually disagrees with itself.

⚠️ **`colLetter()` only reaches Z, and this sheet is the closest yet.** At 27
columns it silently produces `[` and Sheets drops the overflow with no error.
A test now asserts every range stays inside A–Z.

**Validation:** club / contact-name / contact-email required, phone optional;
every count a whole number 0–10; and **at least one group must be 1 or
more**. That last rule is what makes a declaration mean something — nothing
is wrong with any single field, the submission just does not say anything,
and storing it would put a row of fifteen blanks in the sheet. Blank and
whitespace both mean "not coming", matching how `filled()` treats whitespace
everywhere else in the file.

**The confirmation email's closing paragraph is the point of the email**, not
a footnote: it says in as many words that this is **not a team entry** and
each team still registers separately. The single most likely way this feature
fails in practice is a club secretary declaring five teams, getting a
friendly confirmation, and believing the job is done. The success screen says
the same thing in a red-bordered panel.

**On the page:** a third button in the register section, placed first (it is
step one), and a modal with a count box per age group and a live total. The
team modal's own heading said "Register your club" — actively wrong once a
real club form exists — and now says "Register a team".

### Verified

**Full suite green: 23 files, 2,733 checks (up 24), 228/228 injected faults
caught.** `test-intake.js` 523 → 598.

**Six new faults injected, each caught by exactly its own checks:**

| | Fault | Result |
|---|---|---|
| A | the "declares nothing" rule removed | 4 checks (594/598) |
| B | the per-group cap not applied | 17 checks (581/598) |
| C | the whole-number check removed | 6 checks (592/598) |
| D | the loop truncated to the first age group | 21 checks (577/598) |
| E | a count column reordered | 3 checks (595/598) |
| F | the page stops submitting the form | 1 check (597/598) |

**D and E are the two that earn their keep.** D proves the fifteen-group
sweep actually covers the tail of the list and is not decorative. E's third
failing check is a round-trip **read** coming back blank — which is precisely
what a reordered column costs you in production, and is why the columns are
written out rather than derived.

Also: `sc-if` 56/56, `sc-for` 26/26, `node --check` clean on the homepage
x-dc block, `_intake.js` and `_email.js`.

⚠️ **One of the new tests was wrong and the code was right.** A
whitespace-only count trims to blank and means "not coming"; the test had it
in the rejected list. Refusing a stray space would charge the page's fault to
the club. Test fixed, with a note recording that it was the test that moved.

### ⚠️ NOT USABLE UNTIL JAY DOES FOUR THINGS

The form is live but **cannot save anything** until a Google Sheet exists and
`GOOGLE_SHEET_ID_CLUBS` is set in Netlify. Full steps, including the 21
header names in order, are in `claude/parked-requests.md` item 1.

**Why it was safe to ship first:** the whole Netlify site is behind a
site-wide password — confirmed live at merge time
(`requiresPassword: true`, all deploys) — so no real club can reach the form
until Jay lifts that, about 20 days before the tournament. Until the sheet
exists a submission fails safely: parked for replay, and the club told
nothing was saved and to email admin@adhjrt.com.

### Still to build

**The `/organizer` Clubs tab** — declared vs registered per club per age
group, with disagreements flagged. `get-registrations.js` already reads the
Teams sheet, so it is a reconciliation of two things already in hand. Until
then the declarations are readable in the sheet itself, which is why this was
a sensible place to stop.

## REGISTRATION SECTION REWORDED, AND POOL D + "NO PREFERENCE" DROPPED — merged to `main`, LIVE, 1 Aug 2026

Two of Jay's parked items (3 and 4), built together and shipped alongside the
hero-button change and club registration in one deploy.

### The reword (parked item 3)

"Bring your club" described whole-club registration, which that section is
not — it is where a coach clicks Register a team or Register player. With
club-level registration coming as a separate feature, the two would have
been actively confusing. Jay picked **"Sign up now"** from three options
and chose to reword the body copy as well.

**The body copy is not in the page.** It comes from `registrationCopy()` in
the SHARED BLOCK, so it was changed in `netlify/functions/_registration.js`
AND `scores-data.js`, kept **byte-for-byte identical** — `test-registration.js`
compares the two character by character. "sign up your club or player" →
"your team or player"; "check back then to enter your club" → "enter your
team". The `/organizer` preview reads the same function and followed
automatically, which is the whole point of that block existing.

### Pool D and "No preference" (parked item 4)

`POOL_OPTIONS` goes from A/B/C/D/No preference to **A/B/C**.

⚠️ **The important half was server-side, and it did not exist.**
`preferred-pool` was only ever checked for being NON-EMPTY — its value was
never validated at all. The browser's dropdown was the only thing
restricting it, which means it restricted nothing: anyone editing the page
could store any string in column N. Exactly the shape of the squad-cap bug
already recorded in `CLAUDE.md`. **Narrowing the dropdown alone would have
been purely cosmetic and no test in the suite would have noticed.**
`_intake.js` now matches the value against `POOL_OPTIONS` exactly, the same
way it already matches the age group against the fifteen, trimming first.
Inserted as step "4b" rather than renumbering, because
`_prove-registration.js` patches several of those blocks by literal text.

Two copies of the list (page + server), no build step, and a test that
fails if they drift — the same pattern as `AGE_GROUP_INFO` and
`DEFAULT_VENUE`. The parity check derives both sides from the code, so it
is **paired with a hardcoded assertion that the list is exactly `['A','B','C']`**
— otherwise a change made in both places at once would sail through it.

**Confirmed with Jay before building: a draw can still HAVE a pool D.**
This is only what a club may ASK for. An organiser can still create and
fill pool D, and the 4-pool Cup/Bowl/Plate/Shield bracket depends on being
able to. Neither import matcher was narrowed, and there are checks
asserting they have **not** been.

**It also fixed a real existing bug.** The import matchers read the first
matching letter of the stored value as the requested pool, so a team that
picked "No preference" was read as asking for a pool it never asked for.

⚠️ **A finding, recorded not fixed: the two draw editors disagree.**
`Manager.dc.html` matches with `/[A-Z]/i`; `Scores & Standings.dc.html`
matches with `/[A-D]/i`. On "No preference" that meant Manager read `N` (a
pool that does not exist, shown as unavailable) while Scores read `c` and
put the team in **pool C** — two different wrong answers to the same
string. The "uniform draw editor" project was meant to make these two match
and did not reach this line. **Asserted as it actually is rather than
quietly changed**, because changing the Scores matcher changes how real
stored preferences are read, which is a behaviour change in the draw and
Jay's call. See `claude/parked-requests.md` item 5.

⚠️ **Consequence worth knowing:** the field is still mandatory, so every
club must now name a pool — there is no way to say "don't care". That
reverses the original reason "No preference" existed, and the old reasoning
is kept in the code comment rather than deleted. If it turns out wrong in
practice the fix is to make the field optional, not to put "No preference"
back.

### Verified

**Tests: +27 checks (2,658 → 2,685), all green across 23 files, 228/228
injected faults caught.** `test-intake.js` 478 → 500,
`test-registration-panel.js` 283 → 288.

**Five new faults injected to prove the new checks**, each caught by exactly
its own checks and nothing unrelated:

| | Fault | Result |
|---|---|---|
| A | the server pool check never fires | 8 checks fail (492/500) |
| B | the page offers D / "No preference" again | 2 checks fail (498/500) |
| C | the heading reverts to "Bring your club" | 2 checks fail (286/288) |
| D | shared block drifts, CLIENT side only | byte comparison fails (195/196) |
| E | shared block drifts, SERVER side only | comparison + all 3 blurb checks (195/196, 285/288) |

D and E together are the point: the panel test's blurb checks read the
**server** copy, and the byte-for-byte comparison in `test-registration.js`
is what ties the client copy to it. Neither alone covers both files;
together they cover it symmetrically. That was confirmed by running the
drift in both directions rather than assumed.

Also: `sc-if` 50/50, `sc-for` 24/24, `node --check` clean on the homepage
x-dc block, `_intake.js` and `_registration.js`. "Bring your club" gone from
the page entirely; "No preference" surviving only inside the explanatory
comment.

⚠️ **One trap hit for real and worth recording.** The first version of the
matcher checks read `Manager.dc.html` with a bare `readRepo()`. Those files
are **not** in the temp copy `_prove-registration.js` builds — it copies only
what the registration path needs — so it threw ENOENT, killed the whole test
file and cascaded: **60-odd unrelated faults reported as "failed, but not on
the named check"**, and the real cause was one line in the baseline output.
Precisely the "a test that throws is not a test that caught something" trap.
They read through a guard now. A second, sillier one straight after: the
explanatory comment was inserted *after* the previous comment's closing
`*/`, turning prose into bare code — a `SyntaxError` that made the file fail
to load at all. Both were found by reading the actual error rather than
theorising about the cascade.

**Commit `fa28095`.**

## HOMEPAGE: THE TWO HERO REGISTER BUTTONS NOW REGISTER — merged to `main`, LIVE, 1 Aug 2026

Jay: "the top area register a team and register player need to be functional,
instead of just jumping to the buttons lower down, keep the buttons lower
down though."

**What they were.** Both hero buttons were `<a href="#register">` — plain
jump links that scrolled you down the page to a SECOND pair of buttons, in
the `#register` section, which did the real work via
`onClickRegisterTeam` / `onClickRegisterPlayer`.

**What they are now.** The same two `<button onClick="{{ ... }}">` bindings
the lower pair already used. That is the whole change: no new logic, no new
handler, and critically **no second lever** — the registration-window
gating, the refusal wording and the modal opening all still live in exactly
one place. A shut window refuses at the top for the same reason and with the
same sentence as at the bottom, out of the same `regState()` and the same
`closedToast()`. **The lower pair is untouched and stays, as asked.**

**One addition that wasn't asked for but was needed.** `ctaToast` — the
sentence a shut button gives back ("Registration opens 8 October — check
back then to register your team.") — is a single shared state value, but it
was only *rendered* inside the `#register` section. With the hero buttons
now handling their own clicks, someone clicking a "Coming Soon" button at
the top of the page would have got no visible answer at all: the toast
would have fired into a div most of a screen below the fold. That is worse
than the jump link it replaced, which at least landed you on the
explanation. So the same `{{ ctaToast }}` is now also rendered under the
hero button row, styled to match the hero's existing green pill. Same
state, same sentence, nothing decides anything twice.

**Eight new checks in `tests/test-registration-panel.js`** — this project's
standard is that a change nothing asserts is a change that silently
regresses, and the hero markup had no coverage at all. They assert: both
hero buttons are wired to the handlers; no `reg-btn` is left as a jump link;
the lower pair is still present (explicitly asked for, so explicitly
guarded); and the toast is rendered in both places. **The page is split on
`<section id="register">`, deliberately not on any comment text** — see this
project's own "a comment CAN be load-bearing" lesson, where rewording a
comment silently changed which markup a test's binding scan covered.

**Verified, and proven against real injected faults:**

- **Fault 1** — hero team button reverted to `<a href="#register">`. Failed
  exactly two checks ("the hero Register a team button calls the handler"
  and "no Register button is a jump link to #register any more"), the second
  reporting the offending markup as its actual value. 281/283.
- **Fault 2** — the hero toast block deleted. Failed exactly one check ("the
  hero renders the toast, so a shut click is answered where it was made").
  282/283. Neither fault was caught by anything unrelated, and neither
  crashed the file.
- `sc-if` 50/50, `sc-for` 24/24; `node --check` clean on the extracted x-dc
  block; zero `href="#register"` left in the file.
- Full `tests/runall.ps1` on `jay-pc`: **all green, 23 files, 2,658 checks
  (up 8 from 2,650), 228/228 injected faults caught**, full
  `_prove-registration.js` run included.
- **The layout risk was measured, not assumed.** Swapping `<a>` for
  `<button>` can change rendering even under identical CSS. Built a
  standalone reproduction with the real `.reg-btn` rules and rendered both
  variants side by side in headless Chromium: **identical width to two
  decimal places, identical height, and zero differences across every
  computed style that matters** (font-family, size, weight, letter-spacing,
  padding, background, colour, display, box-sizing). Screenshot confirms
  pixel-identical. This is the "a design preview can be accurate about
  colour and wrong about layout" rule applied before, not after, shipping.

**Commit `a0e9c39`.**

## MANAGER.DC.HTML: ORGANISER AGE-GROUP SWITCHER — merged to `main`, LIVE, 1 Aug 2026

Jay: "when an organizer views the manager section in a browser, they should
have the ability to switch between age groups." Confirmed by reading
`Manager.dc.html` directly (not just an agent summary) that this was a real,
total gap — `boot()`'s own code comment said as much: *"There is no
age-group switcher on this page for that to race against."* An organiser
signing into `/manager` was locked to whichever age group `boot()` happened
to pick (the first competitive group, or their own group if they're a
manager) for the rest of the session, with no way to look at another group's
Today/Fixtures/Results/Tables/Draw/Registrations tabs without signing out
and back in. `/scores`' own Manager area already has this ability; `/manager`
did not.

**What shipped.** Three changes, all in `Manager.dc.html`:

1. `renderVals()` gained `isOrganiser` (`s.session.ageGroupId === '*'`,
   reusing the same check `sessionRole` already makes), `ageId` (not
   previously exported — needed as the select's bound value), and
   `ageSwitcherOptions` (mapped from `s.ageGroups`, already fetched by
   `boot()` and otherwise unused after login).
2. A `<select>` in the dashboard header, next to the existing crest/"ADH
   JRT · MANAGER" block, wrapped in `<sc-if value="{{ isOrganiser }}">` —
   so a manager account (which has exactly one age group and nothing to
   switch to) sees no change at all; only an organiser session gets the
   dropdown.
3. A new `switchAge(agId)` method, wired to the select's `onChange`.

**Why it isn't just `this.load(agId)`.** `load()` already has a `keepDraw`
carry-through — if `state.drawDirty` is true when `load()` runs, it keeps
whatever's in `state.draw` rather than blanking it, specifically so a score
save/clear mid-Draw-edit doesn't destroy in-progress work. That's correct
for RELOADING THE SAME age group. It would be wrong for switching TO a
different one — carrying a dirty draft across would attach one age group's
unsaved pool/knockout edits to a completely different group's data the
moment it loaded. `switchAge()` handles this explicitly: if there's a dirty
draft, it confirms first (`confirmModal`, the same in-app modal every other
destructive action in this file uses, never `window.confirm`) with "Switch
age group? You have unsaved changes to the draw you were editing — they
will be discarded," then explicitly clears `draw`/`drawLoadedFor`/
`drawDirty`/`drawMsg` before calling `load(agId)` — which makes `load()`'s
own `keepDraw` a no-op on this path, since `drawDirty` is already `false`
by the time it reads it.

**Verified.** `sc-if`/`sc-for` tag balance checked before commit: 58/58,
25/25. `node --check` on the extracted `<script type="text/x-dc">` block:
clean. Full `powershell tests/runall.ps1` on `jay-pc`: all 23 files green,
**228/228 injected faults caught**, including the full
`_prove-registration.js` run (not skipped).

⚠️ **No test coverage was added for the switcher itself** — no
`{{ token }}` binding-contract check, no behavioural test of `switchAge()`'s
dirty-draft confirm path. That is a real gap by this project's own
standards. Flagged in `state-of-play.md`'s "Jobs for Jay" rather than left
silent. **The three later pieces of work the same day did NOT repeat this** —
the hero buttons shipped with 8 checks and 2 injected faults, the
registration reword with 27 and 5, club registration with 24 and 6.

**Merged and deployed.** Commit `33bfe20`, fast-forward `6113315..33bfe20`.
Netlify deploy `6a6da725a75e680008ce13fe`, `state: ready`, `commit_ref`
confirmed matching, secret scan clean (106 files, 0 matches), 32 functions,
8 redirect rules.

**⚠️ The second merge-status discrepancy of the day, found at merge time.**
`state-of-play.md` (rewritten twenty minutes earlier, in this same session)
stated `main` was at `b6415af` with two commits unmerged. `git fetch origin`
before the merge showed `main` was actually at `6113315` — BOTH supposedly
unmerged commits were already live (`d885204`, the Organizer width-stretch
fix), plus one substantial feature commit this page had never mentioned at
all: `6113315`, "Add 4-pool Cup/Bowl/Plate/Shield bracket format and Spirit
of Rugby nominations to Simulate." Jay had merged all of it directly from a
PC, outside any session. Flagged to Jay before pushing. **This is the same
failure mode as the `design/team-codes-everywhere` discrepancy earlier the
same day — and it happened to the very session that had just written the
warning about it.** Run
`git fetch origin && git log --oneline origin/main..origin/dev` before
believing that page about anything merge-related. Writing the warning down
demonstrably does not prevent the mistake; only the fetch does.

## 4-POOL BRACKET + SPIRIT OF RUGBY NOMINATIONS IN SIMULATE — merged by Jay directly, LIVE, 1 Aug 2026

Discovered on `main` at merge time (commit `6113315`) with no write-up
anywhere. Recorded here from its own commit message and from this session's
own full-suite run, not from having built it:

- `buildBracket()` / `computeAutoKnockout()` in `scores-data.js` now handle
  a **4-pool draw**: each tier (Cup/Bowl/Plate/Shield) is the four teams
  that finished at that rank in their own pool, semis then a final. The
  2-pool and single-pool paths are explicitly unchanged.
- `runSimulateTournament()` in `Scores & Standings.dc.html` now submits a
  **Spirit of Rugby nominee for both teams in every match** of a
  spirit-eligible age group (U14+), pulled from the real registered roster.
- A fixed `roster[0]`-per-team scheme reliably TIES at the top, because the
  symmetric bracket shape means several teams play the same number of games
  — so **`breakSpiritTies()`** runs per age group once its matches are all
  in, demoting rivals one vote at a time until a single unambiguous leader
  remains, and never touching the leader's own matches.
- Two new test files: `test-knockout-brackets.js` (the real `buildBracket`,
  proven against 3 injected faults) and `test-simulate-spirit-award.js`
  (wiring plus an isolated proof of the tie-break algorithm, proven against
  a wrong-target-demotion fault). Two existing `_prove-registration.js`
  fault targets were updated to match the changed `submitResult` call shape.

**Nobody has walked this through on the live site.** Flagged in
`state-of-play.md`'s "Jobs for Jay."

## FULL PITCH ASSIGNMENT ACROSS ALL 15 AGE GROUPS (POOLS + KNOCKOUT), THEN A FULL TOURNAMENT SIMULATION RUN — data entry, not a code change, 1 Aug 2026

Jay: "make sure you assign pitches for matches, split pitch age groups
should use all their available pitches, go" — then, once that was done and
knockout-stage pitches were flagged as still "TBD," "do it" to cover those
too. This is **data**, not code: every pitch assignment was made live, in
the browser, through `/scores`' own Manager area → Edit fixtures, the same
UI Jay would use — nothing in this write-up is a git commit.

**What was done.** Every pool in all 15 age groups' draws now has a real
pitch assigned, spread across ALL of that age group's allocated pitch
surfaces (not stacked onto one), for both the pool stage and the knockout
stage (semis/finals) — confirmed via a direct, no-cache API check across
every group afterward: zero `"TBD"` pitch values anywhere, pools or
knockout. Then a full simulated tournament run: every age group published,
walkover results recorded for every pool match, the knockout stage
generated from standings and walked over too, then republished — **322
pool results + 130 knockout results = 452 total results stored, all 15
groups published**, confirmed via the public `get-results` API (not just
the admin view).

**Two real app bugs found during this work, both worked around rather than
fixed in source — worth a proper source fix later, flagged below and in
"Jobs for Jay":**

1. **The "Republish" button on `Scores & Standings.dc.html`'s Manager area
   can publish the WRONG age group** — a stale closure bug, confirmed by
   monkey-patching `window.fetch` and inspecting the actual POST body,
   which showed the PREVIOUS age group's id while the visible page had
   already switched to a new one. This is a genuine client-side bug, not
   something caused by this session's automation. **Workaround used
   throughout:** bypass the button entirely and POST directly to
   `/.netlify/functions/publish-schedule` with the correct
   `{ageGroupId, action:'publish'}` and a Bearer token — proven reliable
   across roughly 13 repeated uses. Reading `netlify/functions/publish-schedule.js`
   and `_publish.js` directly ruled out the server as the cause (it does a
   verbatim deep-copy of the draft, no stripping/regenerating of
   `knockout`/`pitch` fields) — the bug is client-side, in whatever wires
   the Republish button's click handler to a captured `ageGroupId`.
2. **The age-group `<select>` switch itself (native-setter + dispatched
   `change` event, the standard way to drive this framework's dropdowns
   from outside the page) is intermittently flaky** — sometimes silently
   fails to switch, leaving the page header showing the previous age group
   even after the switch function runs and a wait elapses. Worked around
   with a retry-with-verification wrapper (re-attempt up to 5 times,
   waiting and re-checking the header text between attempts) rather than a
   source fix, since the root cause wasn't chased down.

**A third, narrower issue, also worked around rather than root-caused:**
after a full page reload, U8's and U13's DRAFT schedule (not the published
copy) had their knockout pitch values silently revert to empty string —
found systematically by comparing draft vs. published across all 13
non-festival groups, only these two showed a mismatch. The published/live
data was never wrong, only the draft. Fixed pragmatically by re-running the
assign+save+publish sequence for those two groups and reconfirming
draft/published consistency across all 13 afterward, rather than chasing
the framework-level cause.

**No test coverage was added for any of the three bugs above** — they live
in the browser's interaction with the deployed site, not in a testable unit
of source, and none of the three affect what a parent/coach actually sees
(the published/live copies were correct throughout).

---

# The design refresh — moved out of `RESTORE.md`, 7 Aug 2026

Merged to `main` 24 Jul 2026 and live. It sat in the durable file describing a
change that had already landed, which is a changelog's job.

A visual pass, now live. To preview a branch before merging, **open a PR** — that
triggers a free, password-protected Netlify **deploy-preview** at
`deploy-preview-<N>--adhquins-jrt.netlify.app` (only merging to
`main` spends the 15 credits). **There is also a permanent branch URL —
`https://dev--adhquins-jrt.netlify.app` — which always serves the
latest `dev` build and never changes.** Use that in preference to a PR
preview; see "Three kinds of preview URL" below.

⚠️ **THIS PARAGRAPH USED TO END "the whole site is also behind a site-wide
Netlify password, so previews prompt for it too." THAT IS NO LONGER TRUE and
was corrected on 5 Aug 2026.** The password was verified OFF on the live
project on 3 Aug (`projectAccessControls.requiresPassword: false`) and again on
5 Aug, and the correction reached `state-of-play.md` at the time but not this
file — so the claim went on giving instructions here for two more days, in two
separate places (see §6 Traps, corrected in the same pass). **adhjrt.com and
every preview URL are publicly reachable.** When you reason about whether
something is safe, check what is actually protecting it; this gate is not
there.

- **Logo** is now transparent `assets/crest.png` (white background + the white
  badge circles behind the nav/about/organiser crests removed), from a high-def
  original.
- **Format section** rebuilt as two day-cards ("Day 01/02" watermark, date
  pills, MINI & MIDI / YOUTH, age chips still driven by `groupsSaturday/Sunday`).
- **About-section crest is a static badge, beside the heading.** It is a plain
  96px `<img>` of `assets/crest.png` sitting to the LEFT of the eyebrow and the
  `<h2>` together, inside `.m-crestrow`, so "About the festival" and "Rugby the
  way it should be" share one left edge. On a phone the row stacks and the crest
  goes above.

  It has moved twice, and the reasons are worth keeping:
  1. It was pinned over the top-left corner of the photo box by `.cstage` /
     `.crest-anim`. Once the photos underneath started rotating it read as a
     sticker stuck on a moving thing.
  2. It was then beside the `<h2>` only, which pushed the heading right and left
     it out of line with the eyebrow above it.

  ⚠️ **It cannot hang in the left margin.** Putting it left of the heading while
  keeping the heading at the column's left edge needs ~116px outside the content
  column. The section caps at 1200px with 32px padding, so below roughly 1430px
  viewport there is no margin to hang in and it would be clipped. That is why the
  eyebrow moved inside the row instead.

  ⚠️⚠️ **THE TWO PARAGRAPHS BELOW ARE WRONG. THE BAT IS LIVE ON PRODUCTION AND
  THERE IS NO `.m-crestrow` (verified 7 Aug 2026).** Read this correction, not
  them.

  Measured on adhjrt.com, comments stripped so only live code counted:
  `@keyframes batfly`, `@keyframes batflap`, `@keyframes batmorph`,
  `.cstage`, `<div class="cstage">` and the `.play` boot script are **all
  present and serving**. `assets/crest-shield.png` is the About badge and
  answers 200. `m-crestrow` appears **zero** times.

  So the "mothballed in one commit, pull it from git history" instruction was
  never true, or was reverted and nobody recorded it. **Acting on it would do
  real damage**: a session told the bat is gone would "restore" it and put
  **two bats on screen**, or swap the badge to `crest.png` — which already has
  a bat printed on it — on top of a bat that is already flying.

  ⚠️ **The shield/bat pairing on production is CORRECT as it stands**:
  `crest-shield.png` is the crest with a bat-shaped hole, and the animated bat
  fills that hole. Shield + bat = a complete crest. Do not "fix" either half
  on its own.

  (Kept below, struck through in meaning, because the REASONING about the
  animation is still accurate and useful — only its claim about current state
  is false.)

  ⚠️ **The bat animation was described as MOTHBALLED (5 Aug 2026)** — Jay was
  said to have parked it when the rotating photo board went into the same
  section. **It is not parked; it runs.** What it used to
  do: at rest the flat logo bat; on scroll-into-view it cross-faded to a shaded
  realistic version (`crest-bat-real.png`) and flew a two-direction loop across
  the photo, then landed. Pure CSS keyframes (`batfly`, `batflap`, `batmorph`) on
  `.cf` / `.cfl` / `.breal`, plus a small head-script that added `.play` via
  IntersectionObserver; a local `.cstage` clip stopped the flight ever adding a
  page scrollbar.

  **`assets/crest-bat.png` and `assets/crest-bat-real.png` are still in the
  repo** and must stay — the whole point of mothballing is that this comes back
  cheaply. The CSS, the markup and the script all came out in one commit, each
  with a comment where it was; pull them from there.

  ⚠️ **Restoring it also means swapping the badge back to `crest-shield.png`.**
  `crest.png` already has a bat printed on it, so leaving both would put two bats
  on screen. See the crest-shield warning earlier in this file — an earlier
  version of this very note claimed the shield "reads as a complete club crest on
  its own", which is FALSE and caused a live bug; it is the crest with a
  bat-shaped hole in it.

  If it does come back: the script used the **find-it-once boot pattern**, which
  is precisely the bug the photo board hit on the same day — worked from a local
  file, did nothing deployed, because the component engine re-renders the body
  after first paint. Use the re-scanning boot the board now has, not the old one.
- **Results follows Fixtures.** Homepage passes `age="{{ fxSelectedId }}"` to the
  embedded `<dc-import name="Scores & Standings">`; the scores component syncs its
  public `selectedAgeId` in `componentDidUpdate` (public view + groups that have
  standings only; never overrides a manual pick).
- **Single-pool Fixtures width fix.** `fixturePoolsGridStyle` caps a lone pool at
  `minmax(0,560px)` and centres it, instead of one `1fr` column stretching the
  full section; two-or-more pools unchanged.
- **Organisers photo is now `assets/organisers.jpg`**, referenced by filename —
  it used to be a ~168 KB inline base64 `data:` blob that bloated
  `Quins JRT.dc.html` to ~300 KB. Extracted, the homepage is ~133 KB.
  **Do NOT re-inline images into any `.dc.html`** — keep them as `assets/`
  files. It keeps the page light and the `.dc.html` fast to load.
---

