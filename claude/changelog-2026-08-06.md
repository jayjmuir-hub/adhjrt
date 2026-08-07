# ADH JRT — changelog, 6 August 2026

> **Third file in the chain, and the reason is the same one that created the
> second.** Read order is: **this file → `claude/changelog-2026-08-05.md` →
> `claude/changelog.md`.**
>
> ⚠️ **Why a new file rather than another entry prepended to the 5 Aug one.**
> That file is now ~25 KB of dense prose that exists **only** in the Claude
> project — there is no copy on either PC. Prepending means re-emitting every
> existing byte back through the model, and **bytes do not survive being
> re-emitted through the model** is a lesson this project has already paid for
> twice. The 5 Aug file was split off `changelog.md` for exactly this reason and
> then says so in its own header; adding a third file is that rule being
> followed, not ignored. If these are ever merged, do it with a real file
> transfer, not by retyping.
>
> **Date note:** the commits below carry 5 Aug in some places and 6 Aug in
> others. The sandbox runs on UTC and Jay is UTC+4, so a run that felt like
> "Wednesday evening" straddles midnight in the deploy timestamps. `f24ae0d`
> deployed at `2026-08-06T03:5xZ`, the same run as `d6f0533` at
> `2026-08-06T03:18Z` which the 5 Aug file records as 5 Aug. **Do not
> re-date the older entries to match — the commits are the record.**

## ⚠️ TWO STALE BRANCH DEPLOYS WERE SERVING PRE-SECURITY CODE AGAINST LIVE DATA — CLOSED, 6 Aug 2026

Found by pulling a thread Jay pulled first. It started as a housekeeping
question — *"is there anything else running that isn't optimally setup?"* — and
ended in a live bypass of a rate limit that exists to protect children's data.

### What was exposed

Two branch deploys were publicly reachable and answering 200:

| | cut | behind `main` |
|---|---|---|
| `club-manager-page--adhquins-jrt.netlify.app` | 2 Aug | **68 commits** |
| `design-team-codes-everywhere--adhquins-jrt.netlify.app` | 30 Jul | **112 commits** |

Neither contained `622f0e8`, `83ff9da`, `c5df5fa`, `ff5ba3d` or `4955a5a` —
**none of the security work from 2–5 August.**

⚠️ **THE FACT THAT MAKES IT A HOLE RATHER THAN UNTIDINESS: Netlify functions on
a branch deploy read the SAME environment variables and the SAME Blobs stores as
production.** There is no sandbox. Old code, live data.

So the `club-manager-page` deploy served a `manager-signup` that predates
`c5df5fa` and therefore **has no rate limiting at all**, while production's is
throttled at ten attempts per address per 15 minutes. Measured, both answering
`POST {}` with `400`:

```
club-manager-page--adhquins-jrt.netlify.app/.netlify/functions/manager-signup  -> 400
adhjrt.com/.netlify/functions/manager-signup                                   -> 400
```

**The throttle on manager invite codes was bypassable by changing the
hostname**, and a manager account can see squad lists.

### ⚠️ Two alarms were checked BEFORE being written down, and both were wrong

A severity claim needs the same proof as a technical one — the lesson from the
guessable-invite-code scare. So:

- **`organizer-signup` on that deploy fails CLOSED.** It predates `83ff9da`, so
  it still honours `ORGANIZER_INVITE_CODE` — but line 29 reads
  `if (!process.env.ORGANIZER_INVITE_CODE || inviteCode !== …)`, and that
  variable is deleted. It 401s everyone. **Not a hole.**
- **`manager-login` and `organizer-login` are alive there** (405/401) and 404 on
  production, so `ff5ba3d` did not retire them everywhere. But both still gate on
  `account.approved`. **An unretired door, not an auth bypass.**

One hole, not four. Writing down the other three as holes would have been the
easy, alarming, wrong thing.

### ⚠️ THE FIX THAT LOOKED RIGHT AND DID NOTHING — twice

**Attempt 1: restrict branch deploys to `dev`.** Saved, verified in the Netlify
API. The site kept serving. Changing the allow-list stops *future* builds of
other branches; **it does not unpublish a deploy that is already published.**

**Attempt 2: delete the branch.** `origin/club-manager-page` deleted. Still
serving 200 four minutes later, functions and all. Netlify's own support
confirms it: *"deleting a git branch does not automatically remove the branch
deploy subdomain."*

**What actually closed it: password protection scoped to non-production
deploys.** Jay set it in the UI (the password never touched a tool call or a
message). Read back from the API as
`requiresPassword: true, whichProjectsRequirePassword: "non_production"`, and
then measured rather than believed:

| | before | after |
|---|---|---|
| branch root, ×3 | 200 200 200 | **401 401 401** |
| its `manager-signup` | 400 | **401** |
| `dev` preview | 200 | 401 (expected — Jay knows the password) |
| **adhjrt.com** `/ /rules /legal /scores /signin /manager /organizer` | 200 | **200 — all seven** |
| production `manager-signup` | 400 | **400** |

That last row is the one that mattered. Scoping this wrong takes the public site
down, so production was swept endpoint by endpoint, not spot-checked.

### ⚠️ TWO OF MY OWN MEASUREMENTS WERE WRONG, AND THEY ARE THE REUSABLE PART

**1. I reported a close off a baseline I never took.** After deleting
`design/team-codes-everywhere` I probed its subdomain, got 404, and wrote *"went
from 200 → 404, verified."* I had **never measured the 200.** Probing every slug
variant afterwards returns 404 — *and so does a branch name that has certainly
never existed.* **A 404 with no before-reading proves nothing**, and this repo's
own rule already said a negative check that fails for the wrong reason proves
nothing. Broken by the person who wrote it down.

**2. A single transient failure nearly produced a false all-clear.** The first
probe after the branch delete returned `000` — curl failing to connect at all,
which reads exactly like *the site is gone*. Retried: **200, 200, 200**. One
reading is not a reading; everything above is probed three times.

### And Jay was right about the money, which is how this started

I told him branch deploys cost a build on every land. **They cost nothing** —
Netlify's credit plans do not meter build minutes: production 15, branch deploys
and previews **0**, failed deploys 0, rollbacks 0. He asked *"aren't preview
branches free?"* and they are. Worse, `CLAUDE.md` already said so at line 2808;
I quoted a different line at him that was a vigilance note, not a cost claim.
**Corrected and pinned in `dde10d5` below.** The cost argument for turning
branch deploys off evaporated; the security argument never depended on it.

### Housekeeping done in the same pass

- **`origin/design/team-codes-everywhere` deleted** (`f76edc4`, 30 Jul).
- **`origin/club-manager-page` deleted** (`86531b2`) — ⚠️ **the work is NOT
  lost**: the local branch on jay-pc is untouched, and a bundle of the complete
  history (304 commits, 14 MB, `git bundle verify` clean) was delivered to Jay
  and written to his disk **before** anything was deleted. Restore with
  `git fetch <bundle> refs/remotes/origin/club-manager-page:club-manager-page`.
- **Six merged local branches deleted** on jay-pc with `git branch -d`, which
  refuses anything unmerged: `fix/duplicate-team-codes`, `fix/full-width`,
  `fix/import-and-export-bugs`, `fix/pitch-count`, `fix/team-names-persist`,
  `fix/venue-off-critical-path`.
- One scheduled task exists and is fine (rotate `MS_CLIENT_SECRET`, June 2028);
  it belongs to quins-club-hub, not this project.

### ✅ THE LAST OPEN QUESTION — DEPLOY PERMALINKS — SETTLED BY MEASUREMENT

`<deploy-id>--adhquins-jrt.netlify.app` permalinks were the one thing not proven
closed, and they were held open deliberately rather than assumed shut: Netlify's
password-protection docs do not say which URL forms the non-production scope
covers, and **the obvious control does not answer it.** The current *production*
deploy's permalink returns 200 — equally consistent with "permalinks bypass the
gate" and "production deploys are not gated anyway". Jay tested exactly that URL
and reported it opening freely, which is correct and proves nothing.

⚠️ **The blocker was enumeration, not access.** The Netlify MCP has no
list-deploys operation, so a *branch* deploy's id can only come from the UI.
Settled by driving Jay's Chrome to the Deploys page filtered to
`club-manager-page` and reading the twelve deploy ids straight out of the DOM —
which took one JavaScript call and removed a round-trip of asking him to squint
at hex strings.

**All twelve probed, not just the tip — a per-item sweep has to cover the tail:**

| | result |
|---|---|
| every branch permalink's `manager-signup` | **401 — 12 of 12** |
| tip permalink root, ×3 | 401 401 401 |
| production permalink (control) | 200 |
| nonexistent deploy id (control) | 404 |
| adhjrt.com (control) | 200 |

⚠️ **Three distinct outcomes from one host pattern is what makes this a check
rather than a coincidence.** 401 for gated, 200 for production, 404 for absent
— if everything had come back 401 the result would have been worthless, because
a gate that refuses things that do not exist is refusing for the wrong reason.
That is the same rule the earlier false 404 broke, applied in the other
direction.

**Deleting the individual deploys is unnecessary. Nothing about this exposure is
left open.**

## `dde10d5` — THE CREDIT CLAIM CORRECTED, AND A NEW SUITE FOR CLAIMS THAT GIVE INSTRUCTIONS — `[skip ci]`, NO DEPLOY, 0 CREDITS

Verified the way a skipped build has to be: **the deploy id did not move**
(`6a74039fe792080008410058` before and 90 seconds after the push).

### The false claim

`CLAUDE.md` told the next session: *"If Netlify credits ever look higher than
expected, that is the first place to look — `main` is not the only branch
building."* A branch build cannot move the credit number **because it does not
cost any**. The sentence sent the reader hunting in the one place that could
never be the cause, while the real cost sat correctly stated two hundred lines
away in the same file.

**Tombstoned, not deleted.** Somebody will re-derive the same wrong answer from
the same true premise — "branch deploys are enabled" — unless the argument
against it is sitting there.

Also added, because they are what the wrong sentence was hiding: that a branch
deploy **outlives its branch**, that its functions read production's env vars and
stores, that restricting branch deploys to `dev` **does not retract what is
already published**, and both measurement mistakes above.

### The new suite — `tests/test-doc-claims.js`, 31 checks, 11 faults

**Why a fifth doc claim finally got its own file.** Four had already been
corrected by hand with nothing holding them in place afterwards: the site
password recorded as ON for two days after it went off; every Netlify preview URL
pointing at a subdomain that had been renamed; *"an existing deploy answers 401"*
outliving the password that made it true; and the manager master key documented
as `"admin"` when the code needs `"*"`. **None of them fail. Nothing errors.** A
wrong sentence in a doc is invisible until somebody spends money or an hour on
it.

Three of the checks are worth keeping for their shape rather than their subject:

⚠️ **The retraction is asserted BY POSITION, because presence and absence both
pass on the broken file.** A tombstoned sentence and a restored one are *the same
string*. A check for its absence fails on the correct file; a check for its
presence passes on the broken one. The only thing that discriminates is whether
`THIS PARAGRAPH USED TO END` comes before it. Its fault demotes that marker and
changes nothing else. **Paired with an occurrence count** — the position check
reads the first match, so a second copy pasted lower down would walk straight
past it. Same shape as the stuck-hover sweep, which needed counting for exactly
the same reason.

⚠️ **Two checks are DERIVED, not pinned.** The `15` in the credit table must
equal the `15` in the outstanding-work list. Pinning "15" twice would pass
happily while the two drifted apart, and **two copies of one rule drifting
invisibly** is this repo's most-repeated lesson. There is a fault that edits
exactly one of the two.

⚠️ **One check was rewritten before it landed.** The dead-preview-host test
started as a nested replace-with-callback that I could not reason about. **A
check nobody can reason about is worse than no check, because it reports
confidence.** It is a readable loop now — every mention of the dead host must be
flagged as dead within the preceding 400 characters — and its fault
re-introduces the host as a live instruction while leaving the tombstone intact,
so a naive "is it mentioned" check would pass.

**582/582 faults caught by the named check, 31 suites clean undamaged, 36 files
green** — run on jay-pc as well as the sandbox. **30 → 31 baseline suites is the
only proof the new file ran against an undamaged copy at all.** Tree hash
`83a7ca2f…` matched both sides. 37 `--- ` headers counted in the runner's output;
the one `FAILURES` grep hit was the check name *"Unpublish all: every age group
is called and failures are reported"* — the same wrong-words trap this repo has
already recorded.

## ⚠️ THE MERGE TO `main` DID NOT DEPLOY, BECAUSE `[skip ci]` SURVIVES A FAST-FORWARD (`690d208`)

Jay: *"push all the changes to live."* The whole `Compare` branch fast-forwarded
onto `dev` and `main` and pushed cleanly — and **production stayed on the old
build**, showing `Published main@f24ae0d`, with the deploy id unmoved at
`6a74039fe792080008410058`.

The cause is a trap this repo had already written down and I walked into
anyway. The tip commit was a small docs fix made on the branch, and I gave it
`[skip ci]` because on its own it deploys nothing. **`[skip ci]` is read from
the tip commit of the pushed branch**, and a fast-forward makes that commit the
tip of `main` — so the marker that correctly suppressed a docs-only build then
suppressed the build for eight commits of real work sitting behind it.

**Caught by the deploy id not moving**, which is the check that exists for the
opposite case: normally you assert it has NOT changed to prove a `[skip ci]`
worked. Here the same reading proved the opposite thing, and only because it
was taken at all.

**Fixed with Deploys → Trigger deploy → Deploy project in the Netlify UI.** The
MCP cannot redeploy an existing commit; that is dashboard-only. New deploy
`6a74767b82c9916b4af6d881`, state `ready`.

⚠️ **NEVER PUT `[skip ci]` ON A COMMIT THAT WILL BECOME THE TIP OF `main`.**
A docs commit intended to ride along with a merge must NOT carry it — the merge
is the thing that needs to deploy. `[skip ci]` belongs only on a commit pushed
straight to `main` on its own.

## THE `Compare` BRANCH — crest + bat, red rules button, a live header bug fixed, and two animated menus (`4fc5c85` → `690d208`, MERGED AND LIVE 6 Aug)

A branch for Jay to look at, off `main@dde10d5`, previewing at
`compare--adhquins-jrt.netlify.app` (behind the non-production password).
**Nothing here is on production.** Four commits.

### What he asked for, and what each one turned into

**1. The crest and the flying bat, back on the rotating ring** (`4fc5c85`).
⚠️ **The badge had to change file, and that is the trap.** `crest-shield.png`
is the crest with a BAT-SHAPED HOLE in it — it exists only as the backdrop the
bat flies out of. `crest.png` has a bat printed on it already. Two ways to get
it wrong and both render perfectly: shield + no bat is **a crest with a piece
missing** (this shipped live on 5 Aug), and crest + bat is **two bats, one
motionless**. The checks assert the PAIRING in both directions, with a fault
for each. The arming script is deliberately NOT the one that was mothballed —
that used the find-it-once boot, which works locally and is dead on the
deployed site. ⚠️ `.cstage` is load-bearing: `batfly` carries the bat outside
the box, and without the clip it puts a horizontal scrollbar on the page.

**2. The rules button glows red** (`4fc5c85`). `#17A34A` → `#E11B22`, and the
check is DERIVED — it reads Register-a-team's red off the page rather than
pinning a hex, because a fault moves this button to a *different* red.

**3. "the top bar starts freaking out"** (`9a92f2f`) — ⚠️ **a live production
bug, and it is a feedback loop.** Measured at 95px with nothing touching the
page: **92 class flips in 2 seconds**, `scrollY` moving on its own over a 19px
range. Cross 90 → the bar condenses → it is 18px shorter → the content above
the viewport shrinks → **the browser's scroll anchoring** pulls `scrollY` back
to hold your view still → you are under 90 again → repeat, once per frame.
Fixed with two thresholds, 90 on / 56 off; **the gap is sized off the measured
18px delta**, and swept every 5px from 30 to 170 at six widths.

**4. The bat flies less often** (`9a92f2f`). 13s with two flights → 30s with
one. ⚠️ **Longer is not the same as less often** — stretching the keyframes
would give a bat drifting in slow motion. Every percentage is the original ×
13/30, computed not typed, so the flight runs at its old speed and the rest of
the cycle is dead air.

**5. Animate both drop-downs** (`9a92f2f` → `824cd02`) — **and this took three
goes.** Detail below, because the failures are the useful part.

### ⚠️ THE MENU ANIMATION: WORKING IS NOT THE SAME AS VISIBLE

First attempt: .18s, 8px. Verified on the deployed preview — running,
completing, `opacity 0 → 1`, no errors, every check passing. Jay: *"i don't see
any animation."* **He was right and the instinct to argue was wrong. A change
nobody can perceive has not been made.**

Second attempt: .32s, 16px. Jay: *"i see nothing."*

⚠️ **THAT ONE WAS `prefers-reduced-motion`, AND MY RULE WAS TOO STRICT.**
Reproduced by sampling the pixels every frame, one variable changed:

| | distinct opacity values over 500ms |
|---|---|
| `no-preference` | **9** — a visible fade |
| `reduce` | **1** — `1, 1, 1, 1`. Nothing to see. |

The rule killed the animation outright and snapped to opacity 1. **The
preference is about MOVEMENT** — a slide makes somebody motion-sick, a
cross-fade does not — so killing the fade as well turned an accessibility
courtesy into a feature that looks broken. Under `reduce` the panels now fade
over .2s with no translate and no scale.

Third attempt (`824cd02`): .42s and 20–22px for everyone else. Jay: *"it sort
of animates, just kind of opens slower from top to bottom"* — the per-link
stagger reading as sluggish — then **"its fine now."** Left alone.

### ⚠️ EVERY LIVE MEASUREMENT I TOOK ON THIS PREVIEW WAS WORTHLESS

The tab a driven browser uses runs in the **background**
(`document.visibilityState: "hidden"`), and Chrome freezes `requestAnimationFrame`
and CSS animations in hidden tabs to save battery. So the live page honestly
answered "nothing is running" — because I was watching a paused tab.

That single fact explains: a `currentTime` frozen at 0 with opacity 0 for
400ms, **which I was one sentence from reporting as "the panel is stuck
invisible on the deployed page"**; and a series advancing 1000ms of animation
per 45ms sample, which is not a thing.

**A screenshot is what caught it** — the menu was plainly visible while the
instruments insisted nothing was happening. Measure animation in a FOREGROUND
page; the local Playwright render was the only honest reading available the
whole time.

### Tests: 150 → 202 checks, 604/604 faults, 31 suites clean, 36 files green

Run on jay-pc at every commit, tree hash matched each time. Worth keeping:

- **Perceptibility is asserted**, with a floor AND a ceiling: duration ≥ .25s,
  travel ≥ 10px, duration ≤ .45s. The fault that matters restores the exact
  .18s that shipped — it runs, it completes, every other check passes, and the
  feature is invisible.
- **The reduced-motion check was REVISED, not deleted.** Its rule never changed
  — somebody who asked for less motion must still SEE the menu open. It asserts
  both halves now: there IS a fade, and the fade moves nothing. A fault keeps
  the fade and lets the movement back in, which is the real accessibility
  failure and renders perfectly.
- **Five faults were repointed when this branch REVERSED two live assertions**,
  and nine more repointed as timings changed. A fault that cannot be injected
  is a failed run, not a pass.

### ⚠️ Four of my own mistakes, all caught by the harness rather than by review

- **I branched off the sandbox's LOCAL `main`, five commits stale.** A branch
  can be based on the wrong thing.
- **The armed-flag check was too weak** — true whether or not a second
  assignment was added on entry. The prover said *"caught, WRONG CHECK"*:
  caught by luck, not by the check claiming to guard it.
- **A page-wide count returned 3 against an expected 1**, because the file
  DOCUMENTS the shield/bat pairing in a CSS comment and a markup comment. Both
  syntaxes are stripped before counting now.
- **A keyframe-stop regex matched `translate(30%,80%)`** — a keyframe VALUE,
  not a stop — and reported the flight ending at 80%.
- Plus **starting the test suite before switching branch**, so it ran against
  the wrong tree. Killed and redone.

## A GRADIENT BORDER ON THREE SIDES, AND THE BAT FLIES ONCE (`1c26612`, LIVE)

Jay: *"lets put a gradient border around the rotating picture box, but only on
the top, bottom, and left, the right side would still be the same, make sure the
quins logo is still in front of it"* and *"have the bat only fly once"*.

⚠️ **THE OBVIOUS ONE-LINER RENDERS A SQUARE CORNER.**
`border-width:3px 0 3px 3px; border-image:linear-gradient(...) 1` is three
sides in one declaration — and `border-image` **ignores `border-radius`
entirely**, so the gradient cuts straight across the 18px rounding on the left
and reads as a mistake. It is a masked pseudo-element instead: a box padded by
the border widths, filled with the gradient, masked so only the padding band
survives. `padding-right:0` is the whole mechanism for "no fourth side", and it
follows the curve.

⚠️ **THE LAYERING LOOKS ARBITRARY AND IS NOT, AND ONE LINE CARRIES IT.** Two
requirements pull opposite ways: the border must sit ABOVE the carousel cards
(z-index 7..12 from the slot table, which would otherwise paint over it as they
swing past) and BELOW the crest. `isolation:isolate` on `.about-photo` traps
every z-index inside the box, so the border can be **50** in there while the box
*as a whole* still loses to `.cstage` at **6** in the page's stacking context.
Delete that one line and the 50 escapes, beats the 6, and the border paints over
the Quins logo — the exact thing that was asked to be prevented. **The two
numbers look directly comparable and are not.** A fault removes only the
isolation.

**The bat:** all three animations — flight, wing flap, flat/real crossfade — go
from `infinite` to `1 forwards`.
⚠️ **ALL THREE OR NONE**: one left looping is wings flapping on a bat that has
landed, on a separate element, which nothing else would notice.
⚠️ **`forwards` IS NOT DECORATION.** Without it the animation snaps back to its
0% frame on ending — which happens to be exactly where the bat lands, so it
would look right today and break silently the moment anybody edits the last
keyframe.

The 30s duration is kept: the flight occupies the first 18.6% and the rest is
inert. Re-deriving forty percentages across three keyframe sets to shorten a
timer that now runs once is work with no visible result.

**Verified on production:** padding `3px 0px 3px 3px`, border z-index 50,
`mask-composite:exclude`, `isolation:isolate`, `.cstage` 6, bat iterations **1**
with fill `forwards`, 6 cards ready, `--sbw` 15px against a real 15px
scrollbar, overshoot 0, page overflow 0.

**Tests: 224 → 238 checks, 9 new faults, 630/630 caught, 31 suites clean, 36
files green.** Deploy `6a747ecabee6a40008856b06`. It built on the push — the tip
commit carried no `[skip ci]` this time.

## `Compare` IS KEPT AS THE STANDING PREVIEW BRANCH

Jay: *"we will keep compare to use for edits, its fine."* Build there, look at
it for nothing, merge to `main` for one 15-credit deploy when it is right.

⚠️ **The rule that makes it safe: `Compare` must never be left behind `main`.**
Fast-forward it in the same breath as every land. A long-lived branch that lags
is one somebody eventually treats as current — `club-manager-page` was 68
commits behind when its branch deploy turned out to be serving a bypassable
rate limit.

### Landed

⚠️ **The header fix reached production with the rest of it.** That bug arrived
with `24fb84c` and had been live on adhjrt.com all day; there is no separate
cherry-pick to do any more.

⚠️ **`Compare` IS STILL IN THE NETLIFY BRANCH-DEPLOY ALLOW-LIST** (`dev,
Compare`) and the branch still exists on `origin`. It is now byte-identical to
`main`, so it is pure clutter with a live URL — **take it out of the list and
delete the branch**, or it becomes exactly the stale branch deploy this same
day was spent closing.

## THE TOURNAMENT RULES BUTTON, CENTRED AND WEARING THE REGISTER BUTTONS' CLASS — merged to `main`, LIVE AND VERIFIED LIVE (`f24ae0d`)

Jay: *"the tournament rules button should be centered under the two text boxes
above it, it should also be themed similar to the register a team and register a
player buttons."* One 15-credit deploy
(`6a74039fe792080008410058`, production, `ready`).

Two asks, and **only one of them is a style change.**

### ⚠️ "Centred" meant centred under the PAIR, not centred in the column

The button sits below the Tag-rugby and UAERF notes. Those two notes are
`width:fit-content` — they are **narrower than the column they sit in**, and they
are not the same width as each other. So "centre it" has two completely different
answers and the obvious one is wrong:

| | offset from the pair's own centre |
|---|---|
| centred on the **column** (the obvious reading) | **91 / 39 / 22 px off** at 1400 / 900 / 390px |
| centred on the **pair** (what Jay asked for) | **0 px at all three widths** |

The fix is structural, not a margin: the two notes **and** the button now share a
single `<div style="width:fit-content">` wrapper, and the button is
`margin:30px auto 0` inside it. The wrapper shrinks to the wider of the two
notes, and `auto` margins centre the button on **that** — so the alignment holds
by construction at every width instead of being a number that happens to be right
at the width it was eyeballed at.

⚠️ **Do not "simplify" that wrapper away.** It looks redundant — a `fit-content`
div around content that is already `fit-content` — and removing it silently
returns the 91px error at desktop width, where it is most visible.

### The theming was a deletion, not an addition

The button already existed as a bespoke outline button with its own CSS. It now
carries `class="reg-btn rules-btn"` — the Register buttons' own class — plus the
three spans that class expects (`.reg-btn-bar`, `.holo`, `.reg-btn-label`), and
a `--glow` of `#17A34A`.

**`.rules-btn`'s own CSS shrank to almost nothing**: `text-decoration:none`, the
label's flex, and the gated arrow slide. Everything else — the fill, the bar, the
holo sweep, the tilt, the shadow — comes from `.reg-btn`.

That matters beyond tidiness: `c3ea255` had just put every hovering component on
this page behind `@media (hover:hover)`, and **a component that borrows
`.reg-btn` inherits that pointer gate for free**. A second bespoke button would
have been a second thing to remember to gate. The size difference is carried
inline (`font-size:14px`, `padding:13px 26px`) because this is deliberately the
quieter, secondary button — it is not a Register call to action and should not
shout like one.

### Tests: 141 → 150 checks, four new faults

- the button carries **both** classes, not just its own;
- the wrapper exists and contains **the pair and the button together** — a fault
  that moves the button outside it is caught;
- `margin:… auto …` survives, because a left margin is how this silently
  de-centres;
- it is still **smaller** than the Register buttons, so "theme it like them" does
  not drift into "make it one of them".

⚠️ **One fault anchor had ROTTED and was repointed rather than deleted.** It was
anchored on the old bespoke outline CSS, which this commit removed — so the fault
could no longer be injected, and **a fault that cannot be injected is a failed
run, not a pass.** It now points at `.rules-btn{text-decoration:none}`, which is
what is left of that rule and still load-bearing (without it the anchor's link
gets an underline through the button label).

**571/571 faults caught by the named check, 30 suites clean undamaged, 35 files
green** — run on jay-pc, not just in the sandbox. Tree hash `bbe6ca64…` matched
both sides. No horizontal overflow 1440 → 360. Cards and Register buttons still
report nothing running 2.5s after a tap, so the pointer gating from `c3ea255` is
untouched.

### Verified live after deploying

Read back off adhjrt.com: `/` → 200 with `rules-btn` present and
`margin:30px auto 0;display:flex;width:fit-content` intact, `/rules` → 200 and
still saying *Coming soon*. Deploy `6a74039fe792080008410058`, state `ready`.

## THE STOP HOOK NO LONGER FIRES ON EVERY TURN — container-only change, NOT in the repo

Jay: *"fix the hook thing."* The Stop hook had been complaining **on every single
turn** with *"There are uncommitted changes in the repository. Please commit and
push these changes to the remote branch."*

### ⚠️ It was not wrong so much as wrong for this project

The hook had three gates, in order: uncommitted changes → untracked files →
commits that are on no remote. **On this project a dirty working tree is the
normal mid-task state.** Work is written and measured in the cloud container,
then committed there and carried to jay-pc as a `git bundle` and pushed from the
PC. So the container's tree is dirty for most of every session and its tracking
refs are stale until a fetch — and the first two gates fired every time.

**A hook that is always red is a hook nobody reads.** Worse, it was asking for a
push on a repo where a push to `main` costs 15 deploy credits and needs Jay's
explicit yes — which a hook is not. The standing rule *"never push to silence a
hook"* exists precisely because of this one.

The two working-tree gates are removed, with the reasoning written where they
were. **The third gate stays**, because commits that exist locally and are on no
remote are real unlanded work and are exactly when somebody should be told.

**Proven against injected faults rather than assumed:**

| injected state | hook |
|---|---|
| dirty tracked file **and** an untracked file | **exit 0** — silent, as intended |
| a real local-only commit | **exit 2** — fires, as intended |

The container clone was also fetched so `origin/dev` and `origin/main` both
resolve to `f24ae0d`; before that there was no `origin/dev` ref at all, which is
its own way for a push check to be meaningless.

### ⚠️ THIS DOES NOT PERSIST, AND THAT IS THE IMPORTANT PART

The hook lives at `~/.claude/stop-hook-git-check.sh` **in the ephemeral cloud
container**, registered from `~/.claude/launcher-settings.json`. Both files are
owned by root and both were re-written by Anthropic's launcher at the start of
this session. **The container is reclaimed when the session ends, and the next
session gets a fresh unmodified copy.**

It is **not** on jay-pc (checked: no such file under `C:\Users\jayjm\.claude\`),
so there is nothing on Jay's machine to edit either. A project-level
`.claude/settings.json` in the repo cannot help — hook sources are additive and a
project cannot switch off a user-level hook.

**So: this fix lasts for this session only.** If the nagging comes back next
session, that is why, and the same edit can be reapplied in about a minute. The
only durable fix is at the provisioning end, which is outside this project.
