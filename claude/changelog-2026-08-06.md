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

---

# Moved from `state-of-play.md`, 7 Aug 2026

The sections below were per-commit narratives sitting in the status page. They
are **history** — what happened and why — which is this file's job, not that
one's. `state-of-play.md` went from 1,596 lines to roughly 300 by moving them.

## The 6 Aug production deploy — verified live, not assumed

Jay: **"go live."** `main` fast-forwarded `1c26612 → f49e6c6`, three commits,
**one 15-credit deploy**.

| check | result |
|---|---|
| `[skip ci]` on any of the three | **none** — checked BEFORE the merge, in the sandbox and again on jay-pc |
| deploy id | `6a747eca…` → **`6a74bbd775ee230008107bd3`**, `ready` — **it MOVED**, which is the whole verification for a deploy that is supposed to happen |
| adhjrt.com `/`, `/app`, `/scores`, `/rules`, `/legal`, `/signin`, `/manager`, `/organizer` | **200** ×3 each |
| `/app` serves the new picker | `ag-chip` ×10, `ag-age` ×5, `ag-fmt` ×3 |
| `/app` still serves the OLD one | **`pill-row` 0, `centreActivePill` 0** |
| `/scores` serves the new picker | `ageDayBlocks` ×3, old flat tab row **0** |
| `/manager` carries the fix | the `loadDraw()` entry guard comment, present |
| `main` / `dev` / `Compare` after | **all `f49e6c6`, 0 ahead, 0 behind** |

⚠️ **THE POSITIVE AND THE NEGATIVE WERE BOTH READ, off the live site rather than
inferred from a green suite.** "The new markup is there" and "the old markup is
gone" are different claims, and a half-deployed page satisfies the first. **A
green suite is not a working site** — the deploy id moving says a build ran, and
only reading the bytes back says it shipped what was built.

## Re-verified live, end of 6 Aug — the numbers, not the memory

Everything below was measured after the last land, not recalled. Probed ×3
each, because a single `000` from a transient connection failure reads exactly
like "the site is gone" — and did, again, on the first `dev` probe of this
sweep before returning 401 twice.

| | result |
|---|---|
| adhjrt.com `/`, `/rules`, `/legal`, `/scores`, `/signin`, `/manager`, `/organizer` | **200** ×3 each |
| `compare--adhquins-jrt.netlify.app` | **401** ×3 |
| `dev--adhquins-jrt.netlify.app` | `000`, then **401, 401** |
| `nosuchbranch-xyz--adhquins-jrt.netlify.app` (control) | **404** |
| `/tests/runall.ps1`, `/tools/make-board-photo.py` | **404** both |
| current deploy | `6a747ecabee6a40008856b06`, `ready` — **same id as before, so nothing has redeployed** |

⚠️ **Three distinct outcomes — 401 / 200 / 404 — from the same host pattern is
what makes it a real check.** A gate that answered 401 to everything would look
identical to a working one.

⚠️ **`/.netlify/functions/manager-signup` answers 405, not 400, to a GET.** The
400 recorded elsewhere on this page was a POST. Not a discrepancy in the site —
but a status code written down without its METHOD is a reading nobody can
reproduce, and this one cost a minute of confusion. Say which verb you used.

## ⚠️ `5f55217` — THERE ARE THREE AGE-GROUP PICKERS, AND THE FIRST PASS DID TWO (6 Aug, LIVE)

**The miss, first, because it is the lesson.** `f49e6c6` regrouped `/app` and
`/scores` and shipped to production. **The homepage Fixtures section has its own
picker, in its own file** (`fixtureAgeDayBlocks`, formerly `fixtureAgeTabs`, in
`Quins JRT.dc.html`) — and the Results section **directly beneath it on the same
page** is the embedded scores component, which HAD been regrouped. So one page
carried two pickers that disagreed with each other, live, and **Jay spotted it,
not the suite.**

⚠️ **THE SCOPE CAME FROM ASKING "WHICH SURFACES" AND ACCEPTING "BOTH" AS A
NUMBER.** Nobody checked whether two was the right count, and `CLAUDE.md`
documented the third the whole time (*"Results follows Fixtures. Homepage passes
`age="{{ fxSelectedId }}"`…"*). **The count is asserted now** — a fourth picker
fails `tests/test-age-group-picker.js` rather than shipping.

| | |
|---|---|
| `/app` | `pills()` — vanilla template strings |
| `/scores` | `ageDayBlocks` — nested `<sc-for>` |
| **homepage Fixtures** | **`fixtureAgeDayBlocks`** — its own component, its own file |

⚠️ **THE HOMEPAGE KEEPS ALL FIFTEEN GROUPS; `/scores` KEEPS THIRTEEN. THAT IS
NOT AN INCONSISTENCY TO TIDY.** `/scores` filters on `hasStandings` because a
standings tab for U6 can only ever say "no standings are kept" — but **U6 and U7
do have FIXTURES**, and the homepage picker is the fixtures picker. Jay
confirmed, 6 Aug. Asserted from BOTH ends so the two lists can never be "made
consistent" into one wrong answer.

**And the second half of the same commit: the blocks COLLAPSE.** Jay: *"like the
days condensed and then clickable to expand, no need to have age groups on both
days visible all the time."*

- ⚠️ **THE OPEN DAY FOLLOWS THE SELECTION** — it is derived from whichever day
  holds the current pick. **Open a fixed day instead and half the readers arrive
  looking at a list that does not contain their own group**, with theirs hidden
  behind a heading, which is worse than the wall of chips it replaced.
- ⚠️ **THE PIN IS STORED WITH THE SELECTION IT WAS MADE UNDER**, so a new pick
  releases it on its own. Two benefits: nobody is stranded on a morning their
  group is not on, and **no `onSelect` needed a new field — which left the fault
  anchors on those untouched.**
- ⚠️ **A CLOSED DAY THAT HOLDS THE PICK NAMES IT**; one that does not shows a
  count. Without it, opening the other day hides the selection and the picker
  starts lying about where you are.

⚠️⚠️ **TWO FIXTURES HAD TO BE REWRITTEN BECAUSE THEY COULD NOT DISCRIMINATE.**
Pinning day two and then picking a **day-two** group gives the same answer
whether the pin survives or not — and the first version of that check passed
against the very fault it existed to catch. **Pin day ONE, then pick on day
TWO.** Caught only by running the prover, not by reading the test.

⚠️ **TWO FAULT ANCHORS REPOINTED** — the wrapping rule moved behind
`.ag-day.open`, and the block heading gained a badge and a caret. **Two more
test stubs gained `isDayOne`/`dayLabelOfAgeGroup`** because the homepage picker
asks the layout too: fifth time that trap has been hit.

**647 → 653 faults. Baseline 32, unchanged. `test-age-group-picker.js` 52 → 84.**

## `f49e6c6` — THE AGE-GROUP PICKER IS TWO DAY BLOCKS NOW, ON BOTH SURFACES (6 Aug, superseded by `5f55217`)

Jay: the age group selection in Fixtures and Results should be **"cleaner"**.
Spec: `claude/specs/spec-age-group-selector.md`. **A mockup was sent and
approved BEFORE any code** — deliberately, because iterating on appearance one
deploy at a time is the most expensive way to do it.

**What it replaced, measured before anything was written:** `/app` had 15 pills
in ONE horizontally scrolling strip **whose scrollbar is hidden on purpose**, so
eleven sat off the right edge with nothing saying they existed; `/scores` had 13
identical chips (U6/U7 excluded — no standings) wrapping over three or four
lines with no grouping at all. Both carried the full name as one string, **6 to
16 characters** ("U6 Tag" against "U9 Mixed Contact"), so every chip was a
different width. And the **day** — the one fact that halves the list — was
visible only as the colour of the pill you had already chosen.

⚠️⚠️ **THE DAY SPLIT IS DERIVED FROM THE VENUE LAYOUT, NEVER TYPED.**
`isDayOne()` and `dayLabelOfAgeGroup()` answer from the layout, where a group is
on Saturday **because that is where it holds pitches**, so moving a group in the
back office moves it between blocks with no deploy. `app.html` once carried
`const SATURDAY = [...]` and showed **U12G and both U18 groups on the wrong
day**, on the public site, with registration open. **Grouping the picker BY DAY
is the first thing in a year that has made that list tempting again**, which is
why the new suite both sweeps for a literal list **and drives the answer** —
a call to `isDayOne()` proves nothing about whether its answer is used, and
there is a fault for exactly that (`filter(() => sat)`).

⚠️ **THE LABEL SPLITS ON THE FIRST SPACE**, band big and format small. A name
with **no** space keeps the whole string as the band and renders no format line,
so a future `U20` degrades rather than disappearing. Asserted against **all
fifteen real names, read out of `_agegroups.js`** rather than typed, plus a
fault that splits on the LAST space (which still renders, still looks like a
chip, and is wrong on every multi-word format).

**Two implementations, one design.** `pills()` in `app.html` (vanilla) and
`ageDayBlocks` in `Scores & Standings.dc.html` (nested `<sc-for>`). They share
no code and there is no build step, so `tests/test-age-group-picker.js` reads
**both** and asserts the parts that must agree — that is the only thing that can
stop them drifting into two pickers that merely started the same.

- ⚠️ **`pills()` is shared by Fixtures, Results AND Tables** on `/app`.
- ⚠️ **`onSelect` still reports upward through `props.onAgeChange`** — the
  homepage embed contract. A regroup that dropped it would look perfect and
  silently unlink the public Results section from the homepage's pick.
- ⚠️ **Selected chips keep the DAY's colour** — red day one, **green day two**.
  Both asserted, or *"it goes red"* passes on a picker that has lost the green.
- `centreActivePill()` **deleted with a tombstone** — nothing scrolls sideways
  now, and dead code here is published code.
- ⚠️ **ONE FAULT ANCHOR HAD TO BE REPOINTED.** The HSBC-band fault hung off the
  flat tab row's wrapper div, which no longer exists, so it could not be
  injected — **a failed run, not a pass.**
- ⚠️ **TWO TEST STUBS NEEDED THE NEW API FUNCTIONS.** `test-scores-public.js`
  and `test-fixtures-results-sync.js` both died on
  `s.api.isDayOne is not a function`. Same class as the `NEEDED` trap: **when
  code-under-test starts calling something new, every stub gains it in the same
  commit** or the file dies and its faults report as caught while proving
  nothing.

**638 → 645 faults. Baseline 31 → 32 — it MUST go up, a file was added.**
36 → 37 test files, added to `runall.ps1` in the same commit.

✅ **`dayTag()` IS GONE — `2f94fcf`, LIVE.** It printed a solid day marker and
the date directly under the picker, which after the regroup was a second copy of
the block heading 30px above it. Removed from all three tabs, with its function,
its CSS and its entry in the shared letter-spacing rule; tombstoned.
⚠️ **THE RULE IS "SAY THE DAY ONCE", NOT "NEVER SAY IT"**, so there are TWO
faults: one that brings the duplicate back, and one that EMPTIES the block
heading — because an absence check on its own is satisfied by the day vanishing
altogether. 645 → 647 faults, baseline unchanged at 32.

⚠️ **AND THE LIVE VERIFICATION NEARLY REPORTED A FALSE ALARM.** `grep -c dayTag`
on the deployed page returned **1**, not 0 — the match was inside the tombstone
COMMENT ("dayTag() lived here"). `function dayTag` was 0 and so was `.daytag` in
code. **A check that matches a comment is not a check on the code**, written
down in this file for months and nearly walked into while verifying the very
commit that added the comment.

## `3bfd9b7` — A RELOAD FOR A GROUP THE ORGANISER HAD LEFT COULD WIPE THE DRAFT ON THE ONE THEY WERE ON (6 Aug, on `Compare`)

**A real defect on `/manager`, found by AUDIT and never reported by anybody.**
It changes a served file, so unlike `6c429b9` this one needs a production
deploy. ⚠️ **Not merged. Needs Jay's explicit yes.**

**The shape.** Only an ORGANISER gets the age-group switcher, and it is a plain
`<select>` with **no `disabled` binding**, so it stays live while the Draw tab
is busy. `saveDraw()`, `doPublish()` and `doUnpublish()` each capture `ageId`
out of state, await a network call, then call `loadDraw(thatId)` to take the
server's copy as the new clean baseline. Flip the switcher mid-flight — easily
done, because `doPublish()` reads **all fifteen groups** for the clash check
first — and that reload is aimed at a group the organiser has already left.

`loadDraw()` opened with an unconditional
`this.setState({ draw: null, drawDirty: false })` and only checked `ageId`
**after** its fetch resolved. So the reload **blanked the draw for the group now
on screen and cleared its dirty flag** — unsaved edits discarded with no confirm
and no message, and **the next switch unable to warn either, because the flag it
warns on had gone.** Silent, and compounding.

⚠️ **THE GUARD EXISTED AND WAS IN THE WRONG PLACE.** `loadDraw()` already had
`if (this.state.ageId !== agId) return;` — after the fetch. That reads as
coverage, and it cannot help: the destructive `setState` has already run by the
time it fires. **A guard placed after the await is not a guard against anything
the await let happen.** The fix is the same line at the TOP.

⚠️ **PUBLISHING THE GROUP THE BUTTON WAS PRESSED ON IS CORRECT, and is asserted
rather than treated as the bug.** The confirm names that group in its own text
("Publish these fixtures for U14 Boys?"), so honouring it is the honest reading.
**The damage was never the write. It was the reload after it.** Worth saying
because the obvious "fix" — re-reading `ageId` at confirm time — would publish
whatever group happened to be on screen, which is worse.

**One entry guard in `loadDraw()`, not three checks in three callers** — a
general guard beats three copies. ⚠️ **`saveDraw()` is the one that would have
bitten first**, being the write an organiser runs most; the audit started at
Republish and the bug was next door.

**Also now covered: `switchAge()`'s dirty-draft confirm, driven rather than
read.** It fires, nothing moves until it is answered, dismissing it leaves the
draft intact, a clean draft switches with no question, and re-picking the
current group is a no-op. **A structural check cannot tell a confirm that fires
from one that is asked and ignored.**

⚠️ **ONE OF THE FIVE FAULTS INVERTS THE ENTRY GUARD**, because *"return early"*
would satisfy every other check by never reloading anything at all. The ordinary
path — a reload for the group you ARE on — is asserted separately.

⚠️ **AND THE FIRST PROVER RUN CAUGHT A FAULT ON THE WRONG CHECK.** Removing the
confirm made a bare `c.state.modal.onConfirm()` throw, which killed the file, so
every check after it silently never ran and the fault reported as caught while
proving nothing. `answerModal()` was added so the guarding check reports and the
file carries on — the same reasoning as the `|| {}` fallbacks in
`test-venue-splits.js`. **A test that throws is not a test that caught
something**, hit again, in a new disguise.

**633 → 638 faults. Baseline 31 → 31.** `test-manager-dc-draw.js` 249 → 275.

## `/app` ON A PHONE — TWO FINDINGS, NEITHER OF THEM A BUG IN THIS REPO (6 Aug)

Jay sent two screenshots from an Android phone. **Nothing in the repo is wrong
and nothing was changed.** Both findings are environment, and both will hit
real parents in November, so they are recorded rather than waved away.

### 1. The app rendered in its DESKTOP layout on a phone

Symptoms: the five tabs sat in the header instead of a bar along the bottom,
everything looked shrunken, and there was a grey strip down each side.

⚠️ **SOLVED BY MEASURING THE SCREENSHOT, NOT BY READING THE CSS.** The image is
1440px wide and the dark app column ran x=59 to x=1381 — **gutters of 59 and 58
px.** `.app` is `max-width:900px;margin:0 auto`, so:

    viewport = 900 / (1 - 2 x 58.5/1440) = 900 / 0.91875 = 979.6 px

**979.6 is 980 — Android's layout viewport for "Desktop site" mode.** That one
number explains both symptoms at once: 980 ≥ 820 fires
`@media(min-width:820px){ .nav-desktop{display:flex} .tabbar{display:none!important} }`,
and 980 > 900 leaves 40 CSS px of paper each side. **`app.html`'s viewport meta
is correct** (`width=device-width, initial-scale=1, viewport-fit=cover`) and was
checked before any theory was formed; the browser was overriding it.

⚠️ **CHROME STORES "Desktop site" PER ORIGIN, AND AN INSTALLED PWA INHERITS
WHATEVER WAS SET WHEN IT WAS INSTALLED.** That is the likely reason a
home-screen icon was stuck in desktop layout while the same page was fine in a
browser tab. **Chrome → ⋮ → Settings → Site settings → Desktop site → remove
`adhjrt.com` from Allowed** — and do it BEFORE installing, or the new install
inherits it too.

**Confirmed fixed in a browser: gutters 59/58 → 0/0, header edge to edge, the
bottom tab bar present.** ⚠️ **NOT confirmed in the installed PWA**, which is
the thing that was actually broken — the second screenshot was Samsung Internet
with an address bar, so two variables moved at once. **A fix has to be verified
in the thing that failed**, and this one has not been.

⚠️ **A `max-width` container plus a `min-width` breakpoint means a screenshot
can TELL YOU THE VIEWPORT WIDTH.** Solve the gutter fraction. It turned a vague
"doesn't scale properly" into an exact number in one step, and it beats
theorising about viewport metas.

### 2. Google Play Protect blocks the PWA install from Samsung Internet

*"Unsafe app blocked — this app was built for an older version of Android and
doesn't include the latest privacy protections."*

⚠️ **READ WHAT IT SAYS. THIS IS NOT A MALWARE VERDICT ON adhjrt.com.** It is a
packaging complaint about the generated APK's `targetSdkVersion`, and **nothing
in this repo can fix it** — our side of a PWA install is a JSON manifest; the
APK is minted by the browser's own service. Chrome uses Google's WebAPK Minting
Server (current target); Samsung Internet builds its own, which has a history of
tripping exactly this block. **Installing from Chrome is the resolution.**
Never "Install anyway", never disable Play Protect.

⚠️ **AND THIS IS AN ARGUMENT FOR NOT PROMOTING THE INSTALL AT ALL**, which is
already `CLAUDE.md`'s position (*"treat `/app` as a fast mobile web page"*). A
parent on a Samsung phone who tries to install it sees the club crest beside the
words **"Unsafe app blocked"**. They will not read the small print about SDK
levels. A plain bookmark loses only the hidden address bar.

## ⚠️ STALE BRANCH DEPLOYS WERE SERVING PRE-SECURITY CODE AGAINST LIVE DATA — CLOSED 6 Aug

**Read this before touching branch deploys, and before believing any "it's gone
now" measurement.** Full account in `claude/changelog-2026-08-06.md`.

Two branch deploys were publicly serving 200: `club-manager-page` (2 Aug, **68
commits behind**) and `design/team-codes-everywhere` (30 Jul, **112 behind**).
Neither had any of the security work from 2–5 Aug.

⚠️ **A BRANCH DEPLOY'S FUNCTIONS READ THE SAME ENV VARS AND THE SAME BLOBS
STORES AS PRODUCTION.** There is no sandbox. Old code, live data. The
`club-manager-page` build predates `c5df5fa`, so its `manager-signup` had **no
rate limiting** while production's did — **the throttle on manager invite codes
was bypassable by changing the hostname**, and a manager sees squad lists.

**Checked before being written down, and both alarms were wrong:**
`organizer-signup` there **fails CLOSED** (it tests
`!process.env.ORGANIZER_INVITE_CODE`, and that variable is deleted);
`manager-login`/`organizer-login` are alive there but still gate on
`account.approved`. **One hole, not four.**

⚠️ **TWO FIXES LOOKED RIGHT AND DID NOTHING.** Restricting branch deploys to
`dev` stops *future* builds of other branches — **it does not unpublish a deploy
already published.** And **deleting the git branch does NOT take the site
down** (Netlify's own support; measured — still 200 four minutes after
`origin/club-manager-page` was deleted).

**What closed it: password protection scoped to non-production deploys**, set by
Jay in the UI. Branch root and its `manager-signup` went 200/400 → **401/401**,
probed ×3; production swept endpoint by endpoint and unchanged.

✅ **DEPLOY PERMALINKS ARE COVERED TOO — measured 6 Aug, and this was the last
open question.** Netlify's docs do not say whether the non-production scope
reaches `<deploy-id>--adhquins-jrt.netlify.app`, and the obvious control could
not answer it: the *production* permalink returns 200, which fits both "they
bypass the gate" and "production is not gated anyway". Settled by driving
Chrome to the Netlify Deploys page, pulling **all twelve** `club-manager-page`
deploy ids out of the DOM, and probing every one — **not just the tip, because a
per-item sweep has to cover the tail:**

| | result |
|---|---|
| all 12 branch permalinks, `manager-signup` | **401 — 12 of 12** |
| tip permalink root, ×3 | 401 401 401 |
| production permalink (control) | 200 |
| nonexistent deploy id (control) | 404 |
| adhjrt.com (control) | 200 |

⚠️ **Three distinct outcomes is what makes it a real check.** 401 / 200 / 404 from
the same host pattern means the gate is discriminating, not that everything
happens to fail. Deleting the individual deploys is no longer necessary.
**Nothing about this exposure is left open.**

⚠️ **AND TWO MEASUREMENT MISTAKES MADE WHILE FIXING IT, both mine, both worth
more than the fix.** I reported *"the design branch site went 200 → 404,
verified"* having **never taken the 200** — and a branch name that never existed
returns 404 too, so that reading proved nothing. Separately, one probe returned
`000` (a transient connection failure) which reads exactly like *the site is
gone*; retried it was 200, 200, 200. **Take the baseline BEFORE the change, and
probe more than once.**

## `6c429b9` — THE POINTER-GATE HOVER SWEEP GOES SITE-WIDE (6 Aug, on `Compare`)

**Test-only. No CSS, no markup, nothing served changed, nothing deployed.**
Spec: `claude/specs/spec-hover-sweep-all-pages.md`.

`c3ea255` fixed the stuck-hover bug on the homepage and added a sweep so the
next component to grow a hover effect would be caught. **That sweep reads
`HDRCSS` — `Quins JRT.dc.html` and nothing else.** A site-wide rule was being
enforced on one page in ten. It is now swept across all ten in
`test-design-polish.js`.

⚠️ **IT FIXES NO LIVE BUG, AND THAT IS RECORDED IN THE CODE ITSELF.** Measured
at `1c26612` before writing a line: **nine hover rules in the whole repo carry
`transform`/`animation`/`box-shadow`, all nine are on the homepage, and all nine
are already gated. Zero outside.** Every other page changes `filter:brightness`,
`background`, `color` or `text-decoration` only — and
`test-about-board.js` already says why that is fine, in its own words: *"A hover
rule that only changes colour is harmless when it sticks."*

⚠️ **THE SESSION THAT BUILT THIS RECOMMENDED IT ON AN ASSUMPTION THAT WAS
FALSE.** The pitch was "the other five pages probably have the same bug". They
do not, and one scan before recommending would have said so. The work still
earns its place as coverage — the homepage's version of this was also
satisfied-everywhere right up until it was live and invisible for four days —
but the reason given for it was wrong, and a right conclusion reached through a
wrong premise does not stay right.

**What is worth not re-learning:**

- ⚠️ **THE HOMEPAGE'S OWN SWEEP IS DELIBERATELY LEFT ALONE.** Three faults are
  anchored on its text and it carries the four checks named individually
  (`.fmt-grp`, `.reg-btn`, `.fmt-day`, `.rules-btn`) that were actually measured
  on a 390px touch viewport. **Moving a check orphans the fault anchored on its
  old name, silently.** The new sweep overlaps it on purpose: a general sweep
  with the specific one still inside it, not two copies of one rule.
- ⚠️ **THE GATE IS FOUND BY MATCHING BRACES, NOT BY MATCHING FORMATTING, AND
  THIS IS WHY THE OLD SWEEP COULD NOT SIMPLY BE POINTED AT MORE FILES.** It
  anchors on `/@media \(hover:hover\)\{[\s\S]*?\n  \}/` — one space after
  `@media`, no spaces around the colon, closing brace at exactly two spaces of
  indent. **`app.html` writes it `@media(hover:hover){` with no space at all**,
  so that anchor does not see `app.html`'s gate AT ALL and would have reported
  its correctly-gated rules as ungated the moment one grew a `transform`.
- ⚠️ **`ALL_PAGES` WAS NOT EXTENDED.** It drives three other loops in that file
  (apple-touch-icon, `og:image`, `twitter:image`) and adding two files to it
  would silently change what those assert — a different change wearing this
  one's clothes. The sweep carries its own list: `ALL_PAGES` plus
  `Club.dc.html` and `rules.html`.
- **Out of scope, recorded so nobody re-opens it:** `deck-stage.js` and
  `image-slot.js` carry `:hover` rules in injected CSS, and **no page in the
  repo references either file** (grepped). Editor-side, not the public site.
- ⚠️ **ONE OF THE FOUR CHECKS CANNOT BE PROVEN BY THE SWEEP, WHICH IS THE REASON
  IT EXISTS.** `app.html` is the only non-homepage page with a pointer gate, and
  its rules are colour-only — so removing the gate makes nothing "loud" and the
  sweep stays green. It is named separately, with a fault that rewrites
  `@media(hover:hover)` to `@media(pointer:fine)`. Until now that gate was right
  by somebody's good habit, not by a check.
- **Three faults, each in a DIFFERENT file** so no single anchor covers two:
  `Manager.dc.html`, `rules.html` (chosen precisely because it is **not** in
  `ALL_PAGES` — a sweep falling back to that list stops being proven), and
  `app.html`.
- **The floors are per page as well as total.** "No ungated rules" passes
  beautifully over an empty set, and this repo has hit that failure in three
  separate disguises.

**Numbers: 630 → 633 faults. Baseline 31 → 31, UNCHANGED — which is the proof it
extended a file rather than adding one. 36 files, unchanged.
`test-design-polish.js` 56 → 70 checks.** `NEEDED` needed no change; all ten
page files were already in it, checked before the spec was written rather than
after.

Carried to jay-pc as a bundle, **tree hash `98b0b17…` matched on both
machines**, suite re-run green there at `6c429b9`, then pushed to `Compare`.

## THE `Compare` BRANCH IS MERGED AND LIVE (6 Aug)

Jay: *"push all the changes to live."* Eight commits plus a docs fix, landed as
`690d208`. Detail in `claude/changelog-2026-08-06.md`; the carousel has its own
spec at `claude/specs/spec-about-coverflow.md`.

**What is live now, and the traps in each:**

- **The About photos are a COVERFLOW CAROUSEL, not the ring.** Six cards
  recycling eleven photos, hero card pinned where the ring's front panel was,
  the rest fanning off the right edge of the page. ⚠️ **The box deliberately
  bleeds past its grid column** — that is what buys the width without taking a
  pixel from the 66px heading. ⚠️ **`100vw` includes the scrollbar and the
  centred section does not**, so the bleed subtracts `--sbw`, published from
  the head script and watched with a ResizeObserver. Both halves shipped wrong
  once and were caught only by reading the deployed page in a real browser.
- **PURELY AUTOMATIC.** No drag, no arrow keys, nothing focusable. ⚠️ Which is
  why `prefers-reduced-motion` does NOT stop the timer — with no controls left
  that would strand a visitor on photo 1 for ever. It cuts instead of gliding.
- **The crest and the flying bat are back**, on the carousel. ⚠️ The badge is
  `crest-shield.png` — the holed one — and **the shield and the bat stand or
  fall together**, or you get a crest with a piece missing or two bats. One
  flight per 30s.
- **The rules button glows Quins red**, derived from `Register a team` rather
  than pinned.
- **THE HEADER CONDENSE LOOP IS FIXED** — this was a live production bug from
  `24fb84c`. Stop scrolling near 90px and the bar used to flip size ~46 times a
  second. Two thresholds now, 90 on / 56 off, the gap sized off the measured
  18px height change.
- **Both drop-downs animate**, .42s with 20–22px of travel, and fade rather
  than vanish under reduced motion.

**Tests: 224 checks in `test-about-board.js`, 621/621 faults, 31 suites clean,
36 files green**, run on jay-pc at every commit with the tree hash matched.
(Both fault counts have moved since — see the section above and the table
below; trust `runall.ps1`'s own output over any number written in prose.)

## What shipped on 5–6 August

**Detail in `claude/changelog-2026-08-06.md` and
`claude/changelog-2026-08-05.md`. These are pointers.**

- **`dde10d5` — THE CREDIT CLAIM CORRECTED, AND A SUITE FOR DOC CLAIMS THAT GIVE
  INSTRUCTIONS. `[skip ci]`, no deploy, 0 credits** (verified by the deploy id
  not moving). ⚠️ **BRANCH DEPLOYS AND DEPLOY PREVIEWS COST NOTHING** — Netlify's
  credit plans do not meter build minutes: production **15**, branch deploy /
  preview **0**, failed deploy 0, rollback 0. `CLAUDE.md` had told the next
  session to look at branch builds when credits ran high, which is the one place
  that could never be the cause; tombstoned, not deleted. Jay caught this — I
  asserted the cost without checking, and the file already contradicted me two
  hundred lines away. Also records that a branch deploy **outlives its branch**
  and reads production's data. New `tests/test-doc-claims.js`, **31 checks, 11
  faults**; the retraction is asserted **by POSITION** because presence and
  absence both pass on the broken file, and two checks are **DERIVED** so the two
  copies of the deploy cost cannot drift apart. 582/582 faults, 31 suites clean.
- **`f24ae0d` — THE TOURNAMENT RULES BUTTON, CENTRED AND THEMED. LIVE, verified
  live.** Jay: *"centered under the two text boxes above it… themed similar to
  the register a team and register a player buttons."*
  ⚠️ **"Centred" meant centred under the PAIR, not centred in the column.** The
  two notes above it are `width:fit-content` and narrower than their column, so
  the obvious reading is **91 / 39 / 22px off** at 1400 / 900 / 390px. The pair
  and the button now share one `width:fit-content` wrapper and the button is
  `margin:30px auto 0` inside it — **0px off at all three widths, by
  construction.** ⚠️ **Do not "simplify" that wrapper away**; it looks redundant
  and removing it silently returns the 91px error.
  The theming was a **deletion**: the button carries `class="reg-btn rules-btn"`
  and `.rules-btn`'s own CSS shrank to `text-decoration:none` plus the label flex
  and the arrow slide. Borrowing `.reg-btn` also inherits the
  `@media (hover:hover)` gate from `c3ea255` for free. It stays deliberately
  **smaller** than the Register buttons — it is the secondary action. 150 checks,
  571/571 faults.
- **`d6f0533` — THE RING IS ON A BLACK GROUND AGAIN. LIVE, verified live.**
  `#F3F1ED` → `#0C0C0E`, back to what it was before `65f319c`. Cream made the box
  the same colour as the section so the photos floated; black makes it a framed
  object and the wedges that open while it turns become part of the effect. Both
  arguments are recorded in the CSS — **do not flip it a third time without
  asking.** ⚠️ **The colour lives in THREE places — box, scene and PANEL — and
  the panel is the one that gets forgotten:** it shows only while a photo is
  decoding, so a cream panel against a black box flashes as a pale rectangle
  that reads like a broken image, and it survives every screenshot taken a
  second later. It WAS forgotten on the first pass here. All three are pinned
  and asserted to agree.
- **`c3ea255` — THE STUCK-HOVER FIX REACHED THE CARDS AND THE REGISTER BUTTONS.
  LIVE, verified live.** The same bug in the place the header inherited it from:
  `.fmt-grp`, `.reg-btn`, plus `.fmt-day` and `.rules-btn` in the same pass. All
  now behind `@media (hover:hover)`; measured on a 390px touch viewport, nothing
  running 2.5s after a tap. ⚠️ **The desktop look is deliberately unchanged** —
  `infinite` stays for a mouse, verified against the deployed page in the same
  harness. The new coverage is a **sweep**: every `:hover` rule whose body
  carries `transform`/`animation`/`box-shadow` must sit inside a pointer query,
  so the next component to grow one is caught. ⚠️ **That sweep read the homepage
  ONLY until `6c429b9` widened it to all ten pages** — see the section above.
- **`2e57420` — THE HEADER SHIMMER WAS STUCK FOR EVER ON TOUCH. FIXED, LIVE,
  verified live.** Jay: *"the header buttons continue to shimmer forever after
  being pressed."* ⚠️ **A touch device has no pointer to move away, so it applies
  `:hover` on tap and keeps it applied until you touch something else** — and the
  sweep was `infinite`. Measured on an 820px touch viewport: still running 3.4s
  after a tap, with nothing that could ever end it. On desktop it stopped
  correctly the moment the mouse left, which is exactly why it shipped — one
  rule, two experiences, only the forgiving one looked at. Fixed two ways: all
  hover treatment behind `@media (hover:hover)`, and the sweep runs **once**
  (`holoSweep`, .9s, `forwards`, ending past the far edge) instead of looping.
  ⚠️ **`:focus-visible` stays OUTSIDE the pointer query** — a keyboard user has
  no pointer at all.
- **`24fb84c` — THE HEADER NAV, AND THE TOURNAMENT RULES PAGE. LIVE, verified
  live.** Jay picked three treatments combined: the club **holo sweep** (copied
  from `.fmt-grp`/`.reg-btn`, not invented), a **gradient underline** that wipes
  in, the **section you are in staying underlined**, and the bar **condensing
  past the hero** (73px → 53px). ⚠️ **The state is written to `<html>`, not to
  the header or the links** — the engine re-renders the body after first paint,
  so a class on a nav link dies with it. ⚠️ **The HSBC mark does NOT condense**
  (19px in both states, asserted). ⚠️ **The wider nav broke the header twice:**
  an 11px pill on seven links adds 154px, and the sticky bar scrolled sideways
  from ~1015px down — gap cut to 2px, pill tightened to 6px in the 761–900px
  band, which **also fixed a 6–12px overflow that was already live at
  762–770px**. Swept every 20px, 1440→360, clean.
  **`/rules` is live** — built like `/legal`, linked from the About section and
  from the footer, indexable and in the sitemap. It says **coming soon** because
  the rules do not exist yet, but says *when* and lists four things that are
  settled.
- **`961fb14` — THE ABOUT PHOTO IS HIDDEN ON PHONES, AND NOT DOWNLOADED THERE.
  LIVE, verified live.** ⚠️ **`display:none` does NOT stop the download** —
  measured at **16 requests / ~290KB** to `assets/board` with the block fully
  hidden. So it is THREE things and any one alone is cosmetic: the CSS hides the
  whole grid CELL (`.about-media`) below 760px; the fail-safe `<picture>` gains a
  FIRST source at `max-width:760px` carrying an inline 1x1 GIF, with both real
  sources fenced at `min-width:761px`; and `build()` returns early on a host with
  no client rects. **390px: 16 requests → ZERO. 1400px: unchanged, and slightly
  better (16 requests for 8 files → 9).** ⚠️ The guard does NOT set `__built`,
  and `boot()` now re-scans on resize, or a phone turned sideways would never get
  a ring. ⚠️ **Adding that source caused a silent bug:** `point()` addressed the
  sources by INDEX, so everything shifted by one and the front panel quietly
  served WebP instead of AVIF — ~30% more bytes, no error. It finds them BY TYPE
  now. Found by reading `currentSrc` off a render, not by a check; it has one now.
- **`19e8f5d` — THE ABOUT SECTION RE-PROPORTIONED. LIVE, verified live.** Jay:
  photo smaller, Quins crest gone, wording back to its original size. ⚠️ **Three
  asks, ONE change:** the photo column had been widened to `1fr 1.5fr` when the
  ring went in, and that is WHY the heading had been cut 66px → 52px. Back to two
  equal columns with a 70px gap: photo 646×648 → **533×541**, heading back to
  `clamp(34px,5.5vw,66px)`, crest removed and **tombstoned** (it is still in the
  header and footer). ⚠️ **`--pw` had to follow the narrower column** — 480px was
  74% of the OLD column and would have been 90% of the new box, running the
  photos edge to edge with nothing erroring; it is
  `clamp(190px, 37vw - 50px, 394px)` now, and **the `sizes` attribute moved with
  it in all three places.** The two new checks are DERIVED, not pinned: `sizes`
  must agree with `--pw`, and `--pw` must be ~74% of whatever column the grid
  gives it — so the next resize fails in the suite rather than on Jay's screen.
- **`fc39e2f` — THE RING HAD SHIPPED A PARSE ERROR ON EVERY PAGE LOAD. FIXED,
  LIVE.** `support.js` runs `encodeCase()` over the whole component before
  parsing, and its regex `/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g` rewrites a
  camelCase name followed by `=` into a `sc-camel-…` attribute name. **It does
  not stop at `<script>` boundaries.** The board's `onScreen` flag became
  `sc-camel-on-screen=` and the head-mounted copy of the script stopped parsing.
  Renamed to `onscreen`. ⚠️ **Nothing looked broken, and that is the point** — a
  second unmangled copy runs in place. The same commit added
  `tests/test-about-board.js` (the ring had arrived across eleven commits with
  **no assertions at all**) and corrected five doc claims that were actively
  giving instructions — see below.
- **`987ba40` — the master manager invite key is `"*"`, not `"admin"`.** Docs
  only, `[skip ci]`, no deploy, 0 credits. `manager-signup.js` derives the age
  group from **whichever KEY NAME matched**, and `_auth.js`'s all-groups test is
  a literal asterisk, so a key called `"admin"` mints a manager scoped to a group
  that does not exist. It fails CLOSED — a documentation bug, not a hole. The
  check asserts the two **agree**, reading the sentinel out of `_auth.js`.
- **`2f1dfae` → `ba5028d` — THE SUPPORTERS GRID. LIVE, verified live.** Eighteen
  logos, zero distorted, tiles alternating white/dark at every width, short last
  row centred, **all nineteen logos linking to their sponsor** (19 links, 19
  distinct hrefs, every one https with `rel="noopener"`, read back from the live
  page). Every URL was checked for a 200 before it went in.
  ⚠️ **ITS TESTS WERE GREEN AGAINST A REAL BUG**: one fixed `height:44px` for
  fourteen logos whose aspect ratios span 1.1:1 to 11.5:1 squashed the wide
  marks and shrank the near-square ones. Found by looking at a render, not by a
  check. Each row now carries its own `h`.
  ⚠️ **NOTHING IS RECOLOURED.** ⚠️ **A nineteenth sponsor breaks the
  alternation** — the fix is to measure and accept one repeat, never to flip a
  tile. ⚠️ **OVG, V&P and Yas Cycles can never take a white box.**
- **`f6e991a` → `e7056ba` — THE ABOUT-SECTION ROTATING RING. LIVE.** Eleven
  commits: a cylinder of eight panels turning on its vertical axis, cycling
  eleven photos, replacing the single static lineout shot. AVIF + WebP at two
  sizes, three images on arrival and five on idle, ~23 KB on a 1x screen against
  the 110 KB static photo it replaced. Geometry is one variable (`--pw`); the
  radius is `1 / (2 tan(180/PANELS))`. `tools/make-board-photo.py` makes all four
  files — do not hand-crop.
  ⚠️ **It worked locally and did nothing deployed, twice, for two different
  reasons** (a `__built` flag set on entry, and a find-it-once boot scan).
  **Local green is not deployed green.**
  ⚠️ **The crest went live with a piece missing** — `crest-shield.png` is the
  crest with a bat-shaped HOLE in it, and `CLAUDE.md` had claimed it read as a
  complete crest on its own. Jay spotted it.
- **`f587c56` — the `tests/` 404 rule had never worked.** It pointed at itself
  (`to = "/tests/:splat"`), and **Netlify silently DROPS a self-referential
  redirect** rather than applying it, so `/tests/runall.ps1` had been served
  with a plain 200 for as long as the rule existed while the comment above it
  said otherwise. Found by fetching the URL on the deploy instead of trusting
  the config. Both rules point at `/404.html` now — **re-verified live 6 Aug:
  `/tests/runall.ps1` and `/tools/make-board-photo.py` both 404.**
- **`c6f3871` — the crest bat animation is MOTHBALLED, not deleted.** Assets
  stay. If it comes back, swap the badge back to `crest-shield.png` in the same
  change or there will be two bats on screen.

## Doc corrections carried in `fc39e2f`

Each of these was being read and acted on:

- **The site-wide password is OFF.** `CLAUDE.md` said it was on in two places.
- **Every Netlify preview URL in `CLAUDE.md` was dead.** The host is
  **`adhquins-jrt`**, not `serene-gingersnap-1d0eb6` — wrong in seven places.
  Measured: `dev--adhquins-jrt.netlify.app` → **200**,
  `dev--serene-gingersnap-1d0eb6.netlify.app` → **404**. Anyone following the
  file to preview a branch got a 404 and would reasonably have concluded branch
  deploys were broken. The site was renamed at some point and nothing recorded
  it.
- **"401 means the deploy exists" died with the password.** An existing deploy
  answered **200** — and since the non-production gate went on, a branch deploy
  answers **401 again**, for a different reason. For anything that matters,
  read the deploy id from the Netlify MCP rather than inferring existence from
  a status code.
- **Test counts:** 31 files / 370 faults → 35 files / 514 faults (**38 files / 719 now, measured 7 Aug 2026**).
- **Outstanding item 3** still said only HSBC was confirmed. Eighteen
  supporters shipped on 5 Aug.

## What shipped 2–4 August

**Pointers only — the record is `claude/changelog.md`.**

- **`42fcad6` — the `/organizer` Clubs tab.** Declared vs registered, per age
  group, chase-list filter. ⚠️ The join is free text typed by two people;
  `normaliseClubName()` is deliberately LAZY — a wrong match is a plausible
  number, a missed match lands visibly in "registered but never declared".
  Until October every club reads Short, because registered is zero.
- **`4955a5a` — the club form could never have worked**, being gated by a
  registration window that does not open until 8 October. Now exempt.
- **`da6aacb` / `28f0df9` / `035f639` / `bee7a30` — the HSBC placements settled
  at three:** header (19px, hides below **900px**, not 800), hero (128px,
  centred by `margin:auto` on BOTH sides), sponsors section (96px). The
  `#partner` band was removed and is asserted gone four ways, with a tombstone.
  ⚠️ The hero lockup must NOT move beside the lower Register pair — that
  section's background is our red and the HSBC-red hexagon would vanish with no
  error reported.
- **`622f0e8` — club registration behind a silent link.** ⚠️ **Unlisted is NOT
  protected** — the repo is public and its root is the site. `CLUB_FORM_KEY`
  is the guard. `robots.txt` must NOT name the path; a `Disallow` advertises it.
- **`5c72eaf` / `688cd71` / `78f1697` — My account, both halves + last sign in.**
  ⚠️ Sign-ins go in their own blob store, not the accounts list, which is
  rewritten whole with no compare-and-set. ⚠️ Link Google is absent from
  other-person mode by design.
- **`83ff9da` — `ORGANIZER_INVITE_CODE` deleted; organiser self-signup CLOSED.**
  `organizer-signup.js` is kept as the documented recovery path.
- **`c5df5fa` — invite codes rate limited**, ten per address per 15 minutes in
  one shared `${ip}:signup` bucket.
- **`ff5ba3d` — the old per-role login endpoints retired.**
- **`fc6ae59` / `ea7a2b0` / `32ff4d4` (2 Aug) — the back office unified onto one
  login, one session key and one `/signin`; light mode; the design audit.**

