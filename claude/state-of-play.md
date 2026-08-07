# ADH JRT — state of play, 7 August 2026

> **If you are picking this up:** read `CLAUDE.md` from a fresh clone first —
> it is **the rules**. Then `RESTORE.md` for how the code behaves. Then this
> page. Then `git fetch origin`.

## ⚠️ `cfcac4f` — THE DOCS MOVED INTO THE REPO AND `CLAUDE.md` WAS SPLIT (7 Aug, LIVE on all three branches)

**Docs-only, `[skip ci]`, deploy id did NOT move — 0 credits.** Verified by
reading `get-project` before and after: `6a75bf018a29730008db8490` both times.

**What changed.** `CLAUDE.md` was 3,379 lines doing four jobs and pointed at
**fourteen `claude/*.md` paths that were not in the repo** — they lived only in
the Claude project, so a bare clone got one file and fourteen dead pointers.

| File | Role |
|---|---|
| `CLAUDE.md` (462 lines) | the rules, precedence, git route, verification standards |
| `RESTORE.md` (2,961) | durable — how the code actually behaves |
| **this file** | volatile — rots by design |
| `claude/decisions/` | rulings; first entry is the `/rules` deferral |
| `claude/{specs,plans,runbooks,archive}/` | history, not instruction |

⚠️ **Precedence is now written down: the code wins, then `RESTORE.md`, then
this page, then `CLAUDE.md`.** Before this there was no tie-breaker and a
session arbitrated by whichever file it happened to read last.

⚠️ **THE `/claude/*` 404 RULE IN `netlify.toml` IS UNVERIFIED.** It points at
`/404.html` (not at itself — the mistake that left the `tests/` rule broken for
months), but **reading the toml proves nothing.** No deploy has run since the
commit, so the docs are not in the deployed snapshot and a 404 on
`adhjrt.com/claude/state-of-play.md` today means "the file is not there", not
"the rule caught it" — a nonexistent path 404s identically. **On the next
production deploy, fetch that URL and confirm 404.** The docs and the rule land
on the same deploy, so they cannot get out of sync — but if the rule is wrong,
the docs get served.

⚠️ **THE REPO IS PUBLIC AND THE 404 RULE DOES NOT CHANGE THAT.** Every file in
`claude/` is readable on github.com regardless of what Netlify serves. All 51
documents were scanned file by file before the commit: **zero secrets** (11
patterns, control-paired) and **zero children's data** — the rehearsal fixtures
are verifiably invented. **Eight redactions** were made: one real phone number,
a third party's name and personal email (4 files), two production account
usernames, one real name tied to a live sheet row, two Drive backup filenames,
one unlisted preview domain. ⚠️ **Rule 11 in `CLAUDE.md` now covers this: if
real data turns up in a doc or a fixture, say so and STOP — do not sanitise it
quietly.**

**Doc claims corrected, each checked against the code or a live API rather than
against another document:**

- ⚠️ **`CLAUDE.md` rule 1 forbids `git add -A` and line 3114 handed a session a
  copy-paste command containing it.** That command published `_commitmsg.txt`
  to adhjrt.com on 27 Jul. **A rule contradicted by an example in the same file
  is not a rule.**
- ⚠️ **THE PASSWORD CLAIM WAS WRONG FOR THE FOURTH TIME.** The bullet written
  on 7 Aug and flagged *"READ THIS ONE"* said `requiresPassword: true` /
  `non_production`. Measured the same day: **`false` / `null` — off
  everywhere.** All three bullets are gone, replaced by one that **refuses to
  answer** and sends you to the Netlify MCP, plus a dated table of all four
  recordings. **Do not write this fact down again.**
- The functions table listed `submission-created.js` (deleted 28 Jul with
  Netlify Forms) and omitted **14 real functions**.
- The env-var list omitted `GOOGLE_CLIENT_ID` and `ORGANIZER_INVITE_CODE`.
  ⚠️ The latter is **deleted in Netlify on purpose** — its absence is what
  closes organiser self-signup, verified in `organizer-signup.js`. "Fixing" the
  missing variable re-opens the door.
- The URL table omitted `/rules`, live and in the sitemap.
- *"HSBC are the principal partner and the only confirmed sponsor"* — false
  since 5 Aug, and contradicted by the supporters-grid section **120 lines
  below it in the same file.**
- ⚠️ **Dead pointers removed.** `~/GitHub/claude-rules/rules.md` and
  `~/.claude/CLAUDE.md` were cited as where "the full rules" live. **Neither
  has ever existed on either PC.** The block called itself "ten lines" while
  holding six. It holds eleven now and says it is the whole set.

⚠️ **THE LOSS CHECK'S FIRST RUN WAS ITSELF BROKEN, AND THAT IS THE LESSON.** It
stripped backticks from the search key but not from the files, so four surviving
claims reported as lost. Re-run with both sides normalised and a control that
had to be FOUND. Of twelve flagged: four false alarms, four correctly dead, and
**four genuinely lost** — rescued into
`claude/decisions/2026-08-07-rules-page-deferred.md`, including *"repoint, never
delete, the checks that pin the placeholder"*, which would have gone silently.
**A verification tool needs a control as much as the thing it verifies.**

## ⚠️ The suite was RUN, not quoted — 719/719, 33 clean, 38 files (7 Aug)

`powershell tests/runall.ps1` on jay-pc at `5bb5f1e`: **719/719 faults caught,
33 suites clean on an undamaged copy, `All green.`, zero `FAILED:` lines, 39
`--- ` headers** (38 test files + the prover's own).

⚠️ **Three files carried three different numbers and none was right:**
`tests/README.md` said 630/31, `CLAUDE.md` said 672/33, this page said 653/32.
All three now carry the measured figure and a note that they disagreed.
**Nothing asserts a number in prose — trust `runall.ps1`'s own output over any
sentence, including this one.**

---

> **The older entries below are from 6 August and earlier.** Then `git fetch origin`. This page has been
> wrong about merge status three times and was **twelve commits stale within a
> day** the last time somebody trusted it.
>
> **`main` and `dev` are at `1c26612`, deployed and LIVE** — deploy
> `6a747ecabee6a40008856b06`, state `ready`. **`Compare` is at `3bfd9b7`, TWO
> COMMITS AHEAD of `main` and 0 behind.** ⚠️ **One of the two is a REAL FIX to
> a served file** (`Manager.dc.html`, `3bfd9b7`) and is therefore waiting on a
> 15-credit production deploy and Jay's explicit yes; the other (`6c429b9`) is
> test-only. Nothing else that is deployed differs from `main`; the whole
> `Compare` branch of 6 Aug landed on production earlier that day: the coverflow
> carousel, the crest and flying bat, the red rules button, the header condense
> fix, and the two menu animations.
>
> ⚠️ **THE MERGE DID NOT DEPLOY ON ITS OWN, AND THE REASON IS A TRAP THIS FILE
> ALREADY WARNED ABOUT.** The tip commit carried `[skip ci]` — it was a
> docs-only commit made on the branch — and **`[skip ci]` survives a
> fast-forward**, so Netlify skipped the production build and `main` sat merged
> but undeployed showing `Published main@f24ae0d`. Caught by the deploy id not
> moving, which is the check that exists for the opposite case. Fixed with
> **Deploys → Trigger deploy → Deploy project** in the UI; the MCP cannot
> redeploy an existing commit.
> **Never put `[skip ci]` on a commit that will become the tip of `main`.**
>
> ⚠️ **THE PRODUCTION SITE PASSWORD IS STILL OFF, BUT BRANCH DEPLOYS ARE NOW
> GATED** — changed 6 Aug 2026. The API reads
> `requiresPassword: true, whichProjectsRequirePassword: "non_production"`.
> **adhjrt.com is publicly reachable and must stay that way** — swept endpoint
> by endpoint after the change: `/`, `/rules`, `/legal`, `/scores`, `/signin`,
> `/manager`, `/organizer` all **200**, production `manager-signup` still 400.
> Every `<branch>--adhquins-jrt.netlify.app` URL now answers **401**, including
> `dev`. Nothing may be left resting on the production gate; it does not exist.
> See the branch-deploy section below for why this was necessary.
>
> ⚠️ **A NETLIFY ENV-VAR CHANGE DOES NOT TAKE EFFECT UNTIL A DEPLOY.** Proven
> twice on `CLUB_FORM_KEY`. This page said the opposite for a week.
>
> ⚠️ **The club form is EXEMPT from the registration window** (`4955a5a`).
> `CLUB_FORM_KEY` is its gate. The team and player forms are still gated and
> must stay that way.

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

## `Compare` IS THE STANDING PREVIEW BRANCH — KEPT ON PURPOSE

Jay, 6 Aug: *"we will keep compare to use for edits, its fine."* It is not
clutter to be cleaned up; it is the workflow. Build on `Compare`, look at it at
`compare--adhquins-jrt.netlify.app` for **nothing**, then merge to `main` for
one 15-credit deploy when it is right.

It stays in the Netlify branch-deploy allow-list (`dev, Compare`) and is
password-gated with every other non-production deploy, so it is not the
exposure that `club-manager-page` was.

⚠️ **ONE RULE MAKES IT SAFE, AND IGNORING IT IS HOW `club-manager-page`
HAPPENED: `Compare` MUST NEVER BE LEFT BEHIND `main`.** A long-lived branch
that lags is a branch somebody eventually looks at thinking it is current, or
merges without noticing what it is missing — 68 commits behind, in that case,
which is how a rate limit ended up bypassable.

**So after every land, fast-forward it in the same breath:**

    git checkout Compare && git merge --ff-only main && git push origin Compare

and before starting new work on it:

    git fetch origin && git rev-list --count origin/Compare..origin/main

**must be 0.** If it is not, fast-forward before writing a line — a feature
branch based on the wrong thing is already on this page's list of mistakes.

⚠️ **AND `[skip ci]` NEVER GOES ON A COMMIT MADE ON `Compare`.** It survives
the fast-forward into `main` and silently suppresses the production build for
everything behind it — which happened on 6 Aug and left `main` merged but
undeployed. `[skip ci]` is only for a docs commit pushed straight to `main` on
its own.

**State now: `main`, `dev` and `Compare` are ALL `5f55217` — 0 ahead, 0
behind.** The three commits went to production together on 6 Aug, and `Compare`
was fast-forwarded in the same breath, which is the rule that keeps it safe.
⚠️ **Batching worked exactly as intended: three commits, two of them touching
served files, ONE 15-credit deploy instead of three.**

## ⚠️ THE STOP HOOK WAS EDITED, AND THE EDIT DOES NOT SURVIVE THIS SESSION

The Stop hook fired **on every turn** with *"There are uncommitted changes in
the repository. Please commit and push these changes to the remote branch."*
Its two working-tree gates (uncommitted changes, untracked files) were removed
on 6 Aug; the gate on **commits that are on no remote** was kept, because that
one describes real unlanded work. Proven both ways against injected state: dirty
tree + untracked file → exit 0; a real local-only commit → exit 2.

**The kept gate fired correctly later the same day** — one unpushed commit on
`Compare` in the sandbox, which was exactly true. It was answered by landing the
commit properly, not by pushing to quieten it. ⚠️ **The sandbox cannot push
anyway** (403), so a hook asking for a push there is asking for something only
jay-pc can do.

**Why the other two were wrong here:** on this project a dirty tree is the normal
mid-task state — work is written in the cloud container, committed there, carried
to jay-pc as a `git bundle` and pushed from the PC. A hook that is always red is
a hook nobody reads, and this one was asking for a push on a repo where a push
to `main` costs 15 credits and needs Jay's explicit yes.

⚠️ **The file is `~/.claude/stop-hook-git-check.sh` IN THE EPHEMERAL CLOUD
CONTAINER**, registered from `~/.claude/launcher-settings.json`. Both are
root-owned and both are re-provisioned by Anthropic's launcher at the start of
every session, and the container is reclaimed when the session ends. **It is not
on jay-pc** — there is no such file under `C:\Users\jayjm\.claude\`. A
project-level `.claude/settings.json` cannot help either: hook sources are
additive, so a project cannot switch off a user-level hook.

**So if the nagging is back, that is why.** Reapplying the same edit takes about
a minute. The durable fix is at the provisioning end, outside this project.
**Never push to silence it.** Detail in `claude/changelog-2026-08-06.md`.

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

## Where things stand

| | |
|---|---|
| Tournament | **7–8 November 2026**, Zayed Sports City |
| Registration | not open; the link goes out ~mid-October. No real club has registered. |
| Site password | **OFF for production — re-verified 6 Aug, ×3 per endpoint. Publicly reachable.** ⚠️ **ON for non-production**: every `<branch>--adhquins-jrt.netlify.app` answers 401. Jay holds the password; it has never been in a message or a tool call. |
| Branch deploys | allow-list is **`dev, Compare`**, and all non-production deploys are password-gated. ⚠️ **Free — 0 credits.** ⚠️ A branch deploy outlives its branch and reads production's env vars and stores. |
| Teams / Players sheets | **CLEAN** (0 / 0), cleared by Jay 2 Aug |
| Rehearsal data | **CLEARED**, verified 2 Aug |
| Registration window | force OPEN. **Jay decides on his own — do not raise this.** |
| `ORGANIZER_INVITE_CODE` | **DELETED.** Organiser self-signup closed. |
| `MANAGER_INVITE_CODES` | stays — 15 age groups. **Checked in Netlify 6 Aug: no `"admin"` key exists, so nothing is silently broken.** ⚠️ A master key must still be named `"*"`, a literal asterisk — never `"admin"` (see Jobs 5, kept as a tombstone). |
| Google sign-in | LIVE, confirmed working |
| Manager dashboard `/manager` | LIVE |
| `/organizer` Clubs tab | LIVE, 4 Aug |
| Club registration | **LIVE, WORKING, AND READY TO SEND.** Key rotated; Jay tested the live link 5 Aug and the sheet is verified EMPTY (header row only). Nothing left to do before emailing clubs. |
| The supporters grid | **LIVE, 5 Aug** — 18 sponsors, every logo linked |
| **The header nav** | **LIVE (`24fb84c`)** — holo pill + underline on hover, current section underlined, bar condenses past 90px of scroll. ⚠️ `data-sec` and `.hdr-tight` live on `<html>`; never move them onto the header. ⚠️ The nav's width is now load-bearing — pill padding and gap are pinned by tests because widening them overflows the sticky bar. |
| **`/rules`** | **LIVE (`24fb84c`), button themed and centred (`f24ae0d`)** — placeholder page. ⚠️ **Jay owes the actual rules;** the block to replace is marked in `rules.html` and nothing else on that page needs touching. ⚠️ The button's `width:fit-content` wrapper is load-bearing — see `f24ae0d` above. |
| **The About section** | **LIVE, 6 Aug.** A **coverflow carousel** — six cards recycling eleven photos, auto-advancing every 6s, no drag and no keys. ⚠️ **The box bleeds past its grid column to the right edge of the page**, which is what buys the width without shrinking the 66px heading; `100vw` counts the scrollbar and the centred section does not, so it subtracts `--sbw`. ⚠️ **The crest and flying bat are back** — badge is the HOLED `crest-shield.png` and it stands or falls with the bat. ⚠️ **Hidden below 760px and the photos are not fetched there.** ⚠️ `prefers-reduced-motion` does NOT stop the timer — with no controls there is nothing to press. Phone walkthrough still **pending**. |
| HSBC | three placements — 19 / 128 / 96px. Walkthrough **pending**. |
| The real draw | **still placeholder clubs** in all 15 groups. Pitches and kick-off times are real; the pools wait on real registrations. Everything else waits on this. |
| Results nav link | still an in-page `#results` jump — change to `/scores` only once the draw is real |
| Tests | **38 files green; 719/719 faults caught; 33 suites clean undamaged** — MEASURED on jay-pc 7 Aug 2026 at `5bb5f1e`, `runall.ps1` reported `All green.` with zero FAILED lines and 39 `--- ` headers (38 files + the prover). ⚠️ This row previously said 37/653/32 while `CLAUDE.md` said 38/672/33 and `tests/README.md` said 36/630/31 — **three files, three different numbers, none correct.** `test-about-board.js` 238 checks; `test-design-polish.js` 70; `test-manager-dc-draw.js` 275; `test-age-group-picker.js` 84. ⚠️ **The baseline went 31 → 32 because a FILE was added** — it must move up for a new file and stay put for an extended one. ⚠️ **The baseline number going UP is the only proof a new suite ran undamaged — and it staying PUT is the proof an existing one was extended.** |

## ⚠️ JOBS FOR JAY

**Jobs 1–4 are DONE — Jay confirmed on 5 Aug.** Do not raise them again.

1. ~~Delete the "DIAGNOSTIC DELETE ME" row from the Club Registrations sheet.~~
   **DONE, and independently verified 5 Aug**: the sheet was read through the
   Drive connector and holds **the header row and nothing else**.
2. ~~Test the club link end to end and delete the resulting row.~~ **DONE.**
   Consistent with the sheet being empty — a submission would have left a row.
   ⚠️ **Jay is therefore clear to email clubs**: the key is rotated, the old one
   403s, the link works, and the sheet is clean. `CLUB_FORM_KEY` is the only
   thing gating that form — deleting the variable in Netlify switches it off
   instantly, no deploy, and that is the off switch.
3. ~~Revoke the `testclub` account.~~ **DONE** (Jay's word — a session cannot
   check the account store without signing in).
4. ~~Walk the My account card on `/manager`, `/organizer` and an Accounts row.~~
   **DONE.**

**Still open:**

5. ~~Check whether `MANAGER_INVITE_CODES` holds a live key named `"admin"`.~~
   **DONE — Jay checked Netlify on 6 Aug 2026 and confirmed there is no
   `"admin"` key.** Nothing to rename, and nothing was ever broken in the live
   configuration. ⚠️ **THE RULE STILL STANDS AND MUST NOT BE FORGOTTEN NOW THAT
   THE ALARM IS CLOSED: a master key has to be named `"*"`, a literal
   asterisk.** `manager-signup.js` stores whichever KEY NAME matched as the
   account's `ageGroupId`, and the all-groups test in `_auth.js` is
   `ageGroupId === '*'` — so a key called `"admin"` would mint a manager scoped
   to an age group that does not exist, signing in perfectly well and able to
   see nothing. It fails CLOSED, which is why this was always a documentation
   bug rather than a hole. The docs that gave the wrong instruction were fixed
   in `987ba40` and a check asserts the two copies agree. **This entry stays as
   a tombstone** — the danger is the next person setting a master key up from
   memory, not the current value.
6. **Chase better artwork from two sponsors.** **Recover** (143x32) and **Bili
   Boys Biltong** (154x90) are the smallest assets on the site. One sentence
   covers both: *"do you have your logo as a vector, or a PNG at least 800px
   wide with a transparent background — ideally a white or single-colour
   version?"* Low priority; both are legible.
   ⚠️ **Ashurst's teal is settled — approved, not pending. Do not raise it.**
7. **Send me the tournament rules when you have them.** `/rules` is live and
   says "coming soon"; replacing the placeholder is a docs-shaped change to one
   marked block, and it can ride with anything else rather than costing its own
   deploy.
8. **Try the new sign-in once from a signed-out device** — `/signin`, password
   and separately the Google button.

**First-look walkthroughs, all already live:** the supporters grid and the
About carousel on a phone; HSBC in three places; `/manager` + the organiser
age-group switcher; age-group trading cards; team codes and club crests; squad
list expand; Venue & days; the 4-pool bracket and Spirit of Rugby; `/signin`;
the `/organizer` Tournament tab; public `/scores`; the design-audit polish.

**One thing worth asking HSBC** — not the orientation, which was checked and
closed on 3 Aug (hexagon LEFT of the wordmark is their standard horizontal
lockup). Ask instead: *"can you send your partner asset pack, and are you happy
with where we have put the mark?"* — that settles clear space, minimum size and
placement approval at once.

**Standing instructions:** do not raise the registration-window decision; do not
raise the `club-manager-page` branch (parked 2 Aug — thirteen commits, finished,
green, never merged); **do not raise the DOCUMENTS feature** (specced 5 Aug,
parked by Jay the same day — `claude/specs/spec-documents.md`, backlog item 7,
no code written); the Junior Manager's account (name redacted) is dropped.

⚠️ **THE DEAD GitHub MCP TOKEN IS THE INTENDED STATE — DO NOT "FIX" IT.** That
server was deliberately removed on 25 Jul 2026 because it parked a live
`repo`-scoped WRITE token in plain text in `claude_desktop_config.json`. Its
tools still appear and still answer `Bad credentials`; that is correct. Never
re-add it, never ask Jay for a token, never accept one pasted into chat, never
print that config file. The only consequence is that an agent cannot open a PR —
Jay clicks the green button.

## Known gaps, flagged rather than left silent

1. ~~The stuck-hover bug on the age-group cards and Register buttons.~~
   **CLOSED 5 Aug (`c3ea255`).** ~~The other pages were NOT swept.~~
   **SWEPT 6 Aug (`6c429b9`, on `Compare`)** — all ten page files are now
   checked, and the scan found **nothing ungated anywhere**: every hover rule
   that moves or animates is on the homepage and already gated. ⚠️ **What is
   still true, and is a different claim:** `/scores`, `/app`, `/organizer`,
   `/manager` and `/signin` have **never been looked at on a real touch
   viewport**. A source check says their hover rules cannot stick in the way
   that mattered; it cannot say the pages feel right in a hand.
1b. **`/app`'s bottom tab bar is width-gated only** —
   `@media(min-width:820px)` hides it. A phone whose browser is in desktop mode
   reports 980px and loses the primary navigation entirely (see the `/app`
   section above). Gating on `(pointer:fine)` as well would make a touch device
   keep the tab bar whatever width it claims — ⚠️ **but a real tablet in
   landscape has a coarse pointer too and would then get the phone bar instead
   of the desktop nav.** Offered to Jay 6 Aug, not decided, no code written.
2. ~~`/manager`'s Republish has never been separately audited.~~ **AUDITED
   6 Aug (`3bfd9b7`) — AND IT FOUND A REAL DEFECT**, in `loadDraw()` rather
   than in Republish itself. See the section above. Fixed, driven end to end,
   five faults.
3. ~~No behavioural test of `switchAge()`'s dirty-draft confirm path.~~
   **DONE 6 Aug (`3bfd9b7`)** — the gate is now driven: it fires, nothing moves
   until it is answered, dismissing it leaves the draft intact, a clean draft
   switches silently, and re-picking the current group is a no-op.
4. **Splitting oversized `Organizer.dc.html`** — not started.
5. **The team-code race** — in progress.
6. **The adhjrt-sim suite on jay-pc is stale** and no longer coverage you are
   missing. Worth pruning that folder; the repo says so now.
7. **If the tournament dates ever change, `assets/share-card.png` carries them**
   and must be re-rendered.
8. **The stop hook's fix is container-only and dies with the session** — see the
   section at the top.
9. ~~Deploy permalinks are not proven closed.~~ **CLOSED 6 Aug** — all twelve
   `club-manager-page` deploy permalinks answer 401, with production at 200 and
   a nonexistent id at 404 as controls. See the branch-deploy section at the top.

## The two machines

`jay-pc`: `C:\Users\jayjm\GitHub\adhjrt`. `cafnet`: `C:\Users\Jay\GitHub\adhjrt`
— username `Jay`, not `jayjm`.

- **Check every clone on every machine, every session.** cafnet was 38 commits
  behind on 3 Aug and nothing said so. A clone that is behind looks exactly like
  a clone that is fine. ⚠️ **cafnet has STILL not been touched — assume it is
  behind until fetched.** It has not been checked since 3 Aug.
- ⚠️ **jay-pc's local branches were pruned 6 Aug.** Six fully-merged `fix/*`
  branches were deleted with `git branch -d` (which refuses anything unmerged).
  **`club-manager-page` was deliberately KEPT as a local branch** even though it
  was deleted from `origin` — that is the only copy on disk of thirteen
  finished, unmerged commits, plus a full-history bundle Jay was sent. Do not
  tidy it away. Confirmed still present 6 Aug.
- jay-pc's checked-out branch is **`dev`**; `Compare` exists locally and is at
  `6c429b9`.
- The GitHub MCP token on cafnet is dead and stays dead (above).
- cafnet's Filesystem MCP allows `C:\`, so its clone is readable and writable
  without a connected folder. `device_commit_files` still needs a folder grant,
  per session.
- ⚠️ **A folder grant is per session AND per folder, and the dialog TIMES OUT.**
  Granting the repo folder is not enough to write a bundle, because a scratch
  folder must be a SIBLING of the clone, not a child — so `C:\Users\jayjm\GitHub`
  is the grant to ask for. The dialog timed out once on 6 Aug and simply had to
  be asked for again; there is no way round it and inventing one is worse.
- cafnet does not have `adhjrt-sim` and does not need it.

## The mistakes worth remembering

**⚠️ CHECK THE CODE BEFORE RECOMMENDING THE WORK, NOT AFTER.** On 6 Aug I
recommended sweeping five pages for the stuck-hover bug as the best use of a
session, on the assumption they were shaped like the homepage. One grep, run
after Jay said yes, showed **not one of them carries a hover rule that moves or
animates** — the bug was not there and could not have been. The coverage was
still worth adding, but the reason given for it was false, and **a right
conclusion reached through a wrong premise does not stay right.** Same shape as
the branch-deploy credit claim two days earlier. **Scan first, pitch second.**

**⚠️ "BOTH" IS NOT A NUMBER — COUNT THE SURFACES BEFORE SCOPING THE WORK.** The
picker was rebuilt on `/app` and `/scores` and shipped to production while a
THIRD picker sat on the homepage, flat, directly above a Results section that
had been changed. The scope came from a multiple-choice answer of "both", and
nobody asked "both of how many?" — while `CLAUDE.md` named the third the whole
time. **When a change is "everywhere X appears", enumerate X first and write the
count into a check**, so the next one fails the suite instead of the user's eye.

**⚠️ A FIXTURE CAN GIVE THE SAME ANSWER WITH AND WITHOUT THE FAULT.** The check
that a pinned day is released by a new pick pinned day TWO and then picked a
day-TWO group — identical result either way. It passed against its own fault
until the prover said so. **When a test asserts that state A is overridden by
state B, A and B must DIFFER**, and the only thing that proves it is injecting
the fault.

**⚠️ WHEN CODE-UNDER-TEST STARTS CALLING SOMETHING NEW, EVERY STUB GAINS IT IN
THE SAME COMMIT.** The picker made `renderVals()` call `api.isDayOne()`, and two
test files died on `s.api.isDayOne is not a function` — the whole file, so every
check after it silently never ran. **This is the `NEEDED` trap wearing a
different coat** (fifth time in this repo, now: `_signins.js`, `Club.dc.html`,
the sitemap pair, the sponsor logos, and now an api stub). The rule generalises:
**a test dies on the first thing it cannot find, and a dead file reports its
faults as caught.**

**⚠️ CALLING THE RIGHT FUNCTION IS NOT THE SAME AS USING ITS ANSWER.** A sweep
that finds `isDayOne(` in the source proves the layout is consulted and nothing
at all about whether the result reaches the layout of the page. The fault that
catches it is one line — `filter(() => sat)` — and it passes every
source-reading check ever written. **Pair every "it asks" check with one that
moves the input and watches the output move.**

**⚠️ REGROUPING A LIST BREAKS THE ANCHORS OF FAULTS THAT HUNG OFF ITS
CONTAINER.** The HSBC-band fault anchored on the flat tab row's wrapper div;
the row became day blocks and the anchor stopped existing. **Repoint to what the
rule was always really about** — here, "above the picker" — never delete.

**⚠️ A GUARD PLACED AFTER THE AWAIT IS NOT A GUARD AGAINST WHAT THE AWAIT LET
HAPPEN.** `loadDraw()` on `/manager` carried
`if (this.state.ageId !== agId) return;` **after** its fetch — which reads as
coverage in review and could never fire in time, because the destructive
`setState` ran first. **Ask what state can change during each await, and where
the first irreversible line sits relative to it.** The fix was the same line,
moved to the top.

**⚠️ THE CONTROL THAT LETS THE RACE HAPPEN CAN BE THE THING NOBODY LOOKED AT.**
The bug above needs the age-group `<select>` to stay usable while a write is in
flight, and it does — no `disabled` binding, never questioned, because it is a
one-line control in a header. **When auditing an async path, list what the user
can still touch while it runs.**

**⚠️ AN AUDIT'S TARGET AND ITS FINDING NEED NOT BE THE SAME THING.** This was
opened as "check Republish for the stale-closure shape the deleted `/scores`
button had". Republish is fine. The defect was one function along, in the
reload every write path calls — and `saveDraw()`, not Republish, is where it
would have bitten first. **Follow the shape, not the file name.**

**⚠️ THE OBVIOUS FIX CAN BE WORSE THAN THE BUG.** Re-reading `ageId` at confirm
time would have "fixed" the stale capture by publishing whatever group happened
to be on screen — against a confirm naming a different one. Publishing the group
the button was pressed on is CORRECT and is now asserted, so nobody tidies it
into the worse version.

**⚠️ THE ENGINE REWRITES YOUR JAVASCRIPT, AND IT DOES NOT STOP AT `<script>`.**
`encodeCase()` turns whitespace + camelCase + `=` into a `sc-camel-…` attribute
name anywhere in a `.dc.html`, code included. `onScreen` became
`sc-camel-on-screen=` and the head-mounted copy of the board script threw on
every page load — while the page looked perfect, because a second copy ran in
place. **Use lowercase or snake_case for locals in inline scripts.** Spacing
does not help. The general lesson is bigger than the regex: **a page that looks
right is not a page with no errors, and nothing in this repo was reading the
console until something forced it to.**

**⚠️ A CHECK CAN ENFORCE A SITE-WIDE RULE ON ONE PAGE AND NOBODY NOTICES.** The
pointer-gate sweep was written as a general rule, described as a general rule in
its own comment, and read `Quins JRT.dc.html` alone for two days. **A sweep's
SCOPE is as load-bearing as its predicate**, and scope is the half that never
appears in the check's name. When you read "every X must Y", ask *every X in
what?*

**⚠️ A REGEX ANCHORED ON FORMATTING IS A CHECK THAT SILENTLY DOES NOT APPLY
ELSEWHERE.** The homepage's gate anchor requires one space after `@media` and a
closing brace at exactly two spaces of indent. `app.html` writes
`@media(hover:hover){`. Pointed at more files unchanged, that anchor would have
reported correctly-gated rules as ungated — a FALSE ALARM, which is the failure
mode that gets a check deleted rather than fixed. Match structure, not whitespace.

**⚠️ WORKING IS NOT THE SAME AS VISIBLE.** A menu animation ran, completed,
settled at the right opacity, threw no errors and passed every check — and Jay
could not see it, twice. **A change nobody can perceive has not been made**, and
"technically runs" is not the claim anybody asked for. The second miss was
`prefers-reduced-motion`: the rule killed the animation outright, so a machine
asking for less motion got *nothing*. **That preference is about MOVEMENT** — a
slide makes somebody motion-sick, a cross-fade does not — so dropping the fade
as well turns an accessibility courtesy into a feature that looks broken.
Perceptibility is asserted now, with a floor and a ceiling.

**⚠️ A DRIVEN BROWSER TAB RUNS IN THE BACKGROUND, AND CHROME FREEZES ANIMATION
THERE.** `document.visibilityState` is `"hidden"`, so `requestAnimationFrame`
and CSS animations do not advance. Every live reading taken through
Claude-in-Chrome about *animation* on 6 Aug was worthless: a `currentTime`
frozen at 0 that was one sentence from being reported as "the panel is stuck
invisible on the deployed page", and a series counting 1000ms of animation per
45ms sample. **A screenshot is what caught it** — the menu was plainly visible
while the instruments said nothing was happening. **Measure animation in a
foreground page**; a local Playwright render is the honest reading.

**⚠️ A BRANCH DEPLOY IS NOT A COPY OF THE SITE — IT IS THE SAME SITE RUNNING
OLD CODE.** Its functions read production's environment variables and
production's Blobs stores. So a stale branch deploy does not expose an old
snapshot; it exposes **live data through code that predates the fix**. The
`club-manager-page` build was 68 commits behind and had no rate limiting on
`manager-signup`, which made production's throttle bypassable by changing the
hostname. **And it outlives its branch:** deleting the git branch does NOT take
the site down, and restricting branch deploys does not unpublish one already
published. Only password-gating non-production deploys (or deleting the deploys
themselves) closes it.

**⚠️ A 404 WITH NO BEFORE-READING PROVES NOTHING, AND ONE READING IS NOT A
READING.** I reported a branch site "went 200 → 404, verified" having never
measured the 200 — a branch name that never existed 404s identically. And a
single `000` from a transient connection failure reads exactly like "the site is
gone"; three probes said 200. **Take the baseline BEFORE the change. Probe more
than once. A negative check that fails for the wrong reason proves nothing** —
already written in this file, and broken by the person who wrote it. ⚠️ **It
happened AGAIN on 6 Aug** — a `000` on the first `dev` probe of the verification
sweep, 401 on the two after it. This is now a property of the connection, not a
fluke.

**⚠️ A STATUS CODE WITHOUT ITS METHOD IS NOT REPRODUCIBLE.** This page recorded
production `manager-signup` at 400; a GET answers 405. Nothing was wrong with
the site — but the next person to check gets a different number than the file
promises and has to work out why. Write down the verb.

**⚠️ CHECK WHAT A THING COSTS BEFORE BUILDING AN ARGUMENT ON IT.** I told Jay
branch deploys cost a build on every land and recommended turning them off partly
on that basis. **They cost 0 credits** — Netlify does not meter build minutes at
all. `CLAUDE.md` already said "iterate on a branch/preview (free)" two hundred
lines from the sentence I quoted at him. **He caught it; the doc had caught it
first.** The security argument survived, but it was nearly carried by a false
one.

**⚠️ THE OBVIOUS READING OF A LAYOUT ASK CAN BE THE WRONG ONE.** "Centre it
under the two boxes above" and "centre it in the column" are different requests
and differ by **91px** at desktop width, because those boxes are `fit-content`
and narrower than their column. **Measure the offset from BOTH candidate centres
before choosing** — one of them is 0 and the other is not, and neither errors.

**⚠️ A DOC CLAIM CANNOT FAIL, SO IT NEEDS A TEST LIKE CODE DOES.** Five wrong
sentences in `CLAUDE.md` have now cost real time: the password recorded as ON
after it went off, every preview URL pointing at a renamed subdomain, "401 means
the deploy exists" outliving the password, `"admin"` as the master key, and
"look at branch builds when credits are high". Each was corrected by hand with
nothing holding it in place. `tests/test-doc-claims.js` exists so the sixth one
fails in the suite. ⚠️ **And a retracted sentence must be asserted BY POSITION** —
a tombstoned sentence and a restored one are the same string, so presence and
absence checks both pass on the broken file.

**⚠️ A NEW FEATURE CAN ARRIVE WITH NO ASSERTIONS AT ALL AND NOTHING WILL SAY
SO.** ~520 lines of homepage went in across eleven commits and the fault count
was 499 before and 499 after. A green suite says nothing about code it does not
read. **When a commit adds a feature, check the fault count moved.**

**⚠️ A FAULT ANCHOR ROTS WHEN THE CODE IT POINTS AT IS REWRITTEN — REPOINT IT,
NEVER DELETE IT.** `f24ae0d` replaced the rules button's bespoke CSS with a
borrowed class, and the fault anchored on the old rule could no longer be
injected. **A fault that cannot be injected is a failed run, not a pass**, and
deleting it would have turned a live check into silence.

**⚠️ A CONFIG RULE CAN DOCUMENT A PROTECTION IT DOES NOT PROVIDE.** The
`/tests/*` 404 pointed at itself; Netlify silently drops a self-referential
redirect, so the folder was served with a plain 200 for months while the comment
above it said otherwise. **Reading the config proves nothing — fetch the URL.**
The identical mistake was then made again in the new `/tools/*` rule by copying
the broken shape.

**⚠️ A DOC'S URLS ROT WITHOUT ANYTHING FAILING.** Every Netlify preview URL in
`CLAUDE.md` was dead for an unknown length of time — the site's subdomain had
changed. Nothing errors; the next session simply gets a 404 and draws a wrong
conclusion about branch deploys. **Fetch a URL before writing it into a doc, and
again before believing one you read there.**

**⚠️ AN ACCURACY PASS SCOPED TO ONE FILE LEAVES EVERY OTHER COPY STILL GIVING
INSTRUCTIONS.** The password correction reached this page on 3 Aug and
`CLAUDE.md` on 5 Aug. **When you retire a claim, grep the whole repo for it.**

**⚠️ THE FIXTURE HAS TO DISCRIMINATE.** A test that would pass against the very
bug it exists to catch is worse than no test, because it reports confidence.
Written down four times now, in four disguises: a stub that always says yes; a
"nothing was written" check running against an empty list; `'' === ''` turning
"no data about either" into "the same club"; and a hover sweep that would report
"no ungated rules" while reading nothing at all — which is why its set is floored
per page as well as in total.

**⚠️ A SUITE THAT FAILS ON AN UNDAMAGED COPY REPORTS EVERY FAULT AS CAUGHT WHILE
PROVING NOTHING.** Hence the second number in the prover's output — clean
baseline suites. **It must go UP when you add a test file** (29 → 30 with
`test-about-board.js`) **and it must STAY PUT when you extend one** (31 → 31 with
the site-wide hover sweep). Four times now a new file that code-under-test
requires was left out of `NEEDED` and eight unrelated faults were blamed on the
wrong thing: `_signins.js`, `Club.dc.html`, `sitemap.xml`/`robots.txt`, and the
sponsor logos. **Whenever you add a file a test reads OR code-under-test
requires, it joins `NEEDED` in the same commit** — and check it BEFORE writing
the spec, not after.

**⚠️ A CHECK THAT MATCHES A COMMENT IS NOT A CHECK ON THE CODE — AND IT GOES
BOTH WAYS.** This repo documents the traps it avoids, so an absence check for
`box-shadow` matches the warning telling you not to write it. Strip comments
before any absence check. And **a comment CAN be load-bearing** — grep `tests/`
for its exact text before rewording one.

**⚠️ RENAMING A CHECK ORPHANS THE FAULT ANCHORED ON ITS OLD NAME**, silently.
**DELETING A FILE CAN SILENTLY RETIRE AN ASSERTION** — repoint, don't drop, if
the rule still lives somewhere. **WIDENING AN ANCHOR IS HOW A CHECK QUIETLY
STOPS GUARDING ANYTHING** — split it and give the newly-allowed thing its own
positive assertions. **A CHECK THAT DRIVES A STATE THE UI CANNOT PRODUCE PROVES
NOTHING.** **AND MOVING A CHECK TO A BETTER FILE ORPHANS ITS FAULTS TOO** —
which is why the homepage's hover sweep was left where it was and overlapped
rather than relocated.

**⚠️ A SEVERITY CLAIM NEEDS THE SAME PROOF AS A TECHNICAL ONE.** The guessable
invite code did not expose medical notes — a self-signed-up organiser lands
`approved: false` and `login.js` 403s a pending account. The fix was right; the
alarm was not checked before it was written down.

**⚠️ DELETING A CONFIG VALUE CAN PROMOTE AN ORDINARY CHECK INTO A LOAD-BEARING
ONE with nothing in the repo changing.** When a setting changes outside the
repo, ask which existing assertions just became the guarantee.

**⚠️ "HIDE IT" AND "PROTECT IT" ARE DIFFERENT ASKS, AND ON A PUBLIC REPO THE
FIRST BUYS ALMOST NOTHING.** Weigh what is behind the door before pricing the
lock: the club form holds a club name, a contact and fifteen counts — no
children's data — which is why one shared key is defensible there and would be
indefensible on the team or player forms.

**⚠️ LOCAL GREEN IS NOT DEPLOYED GREEN.** The ring worked from a local file and
did nothing on the deployed site, twice, for two different reasons. **Verify
live after deploying.** And **a design preview can be accurate about colour and
wrong about layout** — render with the REAL fonts, measure against a baseline
worktree, not an opinion.

**⚠️ THE SANDBOX CANNOT REACH unpkg OR GOOGLE FONTS, AND A SCREENSHOT OF AN
EMPTY SHELL LOOKS LIKE A FINDING.** Fourth time hit. Vendor React and Babel from
npm and serve them with Playwright's `route()` — **and the fulfilled response
needs `access-control-allow-origin`**, because the tags are `crossorigin` with
SRI hashes and without the header the integrity check fails and React never
boots, which looks exactly like the original problem.

**⚠️ CHECK THE ARTEFACT, NOT THE CONTAINER IT WAS MADE IN.**

**⚠️ BYTES DO NOT SURVIVE BEING RE-EMITTED THROUGH THE MODEL — not even
base64.** Use `device_stage_files` in and `SendUserFile` → `device_commit_files`
out. If a folder-access dialog times out, ask Jay and retry; do not invent a way
round. **This is also why the changelog is now three files rather than one** —
see the header of `changelog-2026-08-06.md`.

**⚠️ THE TREE HASH IS THE PROOF A TRANSFER WORKED, AND IT IS CHEAP.** A bundle
carried to jay-pc on 6 Aug was confirmed by `git rev-parse 'Compare^{tree}'`
returning the same `98b0b17…` on both machines. `git bundle verify` says the
bundle is intact; the tree hash says the checkout is the one that was built and
tested. Take both.

**⚠️ MY OWN FAILURE SWEEP GREPPED FOR THE WRONG WORDS.** Grepping output for
`FAILED:`/`MISSING`/`Error:` reported all clean while three suites were red —
their failure lines start with `•` and `FAIL`. **Trust the runner's own summary
and exit code, not a grep you invented for the occasion.** Expected noise is
where a real failure hides. ⚠️ **And the inverse bites too:** grepping a green
run for `FAIL` returns sixteen hits, every one a fault DESCRIPTION containing
the words "fails closed" or "a failed sheet write". Twenty-six stderr tracebacks
in the same run are the prover injecting faults, not breakage. **Read what the
match says before treating a count as a result.**

**⚠️ THE TEST RUNNER ITSELF CAN BE SILENTLY SKIPPING A THIRD OF THE RUN.**
Count the `--- <file>` headers — **37 is correct: 36 test files plus the
prover's own header.** **A NEW TEST FILE DOES NOT JOIN THE SUITE BY ITSELF** —
add it to `runall.ps1` in the same commit.

**⚠️ AN APPROVAL IS NOT A LANDING, AND THE GAP BETWEEN THEM IS WHERE WORK GETS
LOST.** On 3 Aug cafnet went offline between Jay's yes and the push. **Record
the approval, the exact commands, and that the suite already gated them, before
doing anything else.**

**⚠️ THE BIGGEST RECURRING ONE: this page's claims go stale without warning.**
`git fetch origin` then `git log --oneline origin/main..origin/dev` before
trusting anything here. It was twelve commits stale on 5 Aug. **Sync the sandbox
clone and the PC's too** — and after a PC merge the sandbox's tracking refs go
stale, which a stop hook reads as unpushed work. **Never push to silence a
hook.**

**⚠️ AND A BRANCH CAN BE BASED ON THE WRONG THING.** A feature branch goes off
`dev`, not `main`.

**Shorter ones, all hit for real:** a bare substring check can be satisfied by
the wrong tag (assert the FULL tag) · a spec's "verified" claim can be stale by
the time it is built · an anchor shared by two call sites proves neither ·
mutually-masking guards are unprovable, and unprovable means untested ·
removing a button is not closing a door · `node --check` proves nothing about
behaviour · a count is only meaningful against the block it belongs to · a
general sweep beats a second copy of it · a fault that cannot be injected is a
failed run, not a pass · a check on a constant is not a check on the guard ·
asserting absence is not a test, pair it with one that RUNS the thing · calling
it signed OUT is not enough · a client-side restriction is not a restriction ·
code that nothing renders is still published · a copy fact has more copies than
you think · a change nothing asserts silently regresses · a test whose two
possible answers are the same number proves nothing · a parity check between two
copies can pass on a change made to both · derived is safer for consistency,
written-out safer for order · a rule that cannot fire is worse than no rule · a
no-op is not a fault · a sentinel test can be poisoned into uselessness · a new
check can borrow an old one's cover · a boundary sweep can self-mask · a per-item
sweep must be proven to cover the TAIL · a stable sort can hide a missing
tiebreak · a fallback hides a fault in the thing it covers for · a gate on a
directory's existence flips when something else creates the directory · a lazy
regex can match the wrong block entirely and still "pass" · a test that throws is
not a test that caught something · sometimes the test is wrong and the code is
right · a fire-and-forget click handler races a test that doesn't wait ·
`promptModal` silently discards an empty value · an end-to-end test can be blind
to a fault in its middle · a code comment can be wrong, load-bearing, or an
instruction to the next session · line endings broke a check that was right ·
a supplied asset can be wrong in a way the filename denies (check the alpha
channel) · a real gap can hide behind a plausible-sounding test · a live bug
report can be a UX gap, not broken data · a mock that echoes its argument is not
a stand-in for the real shape · one page can have two things a user calls "the
schedule" · applying a display function doesn't mean the raw value survives it ·
two copies of one rule drift invisibly (the cheapest copy to maintain is the one
that no longer exists) · an unbounded scrollable container hides its own
scrollbar · a stale preview branch looks exactly like a regression · fixing "no
expiry" can itself be a disruption — migrate, don't bump · a six-month token
outlives a decision · a single-task review misses what only shows up once every
task's changes sit together · a design handoff's schema can already exist in the
codebase verbatim · a visually-driven bug isn't always caused by the visual
effect it appears during · a missing external credential needn't block the task
if there is a fallback one layer down · `git reset --hard` destroys uncommitted
edits carried across a branch switch · `git fetch <bundle> dev:dev` is refused
while `dev` is checked out · check which directory the shell is in before
assembling a doc · a hook you can edit is not a hook you have fixed, if the file
is re-provisioned every session · the MCP bridge strips `$` from a PowerShell
`-Command` string, so variables and `$_` vanish and the line fails to parse —
write a `.ps1` or avoid variables entirely.

**⚠️ WRITING THIS PAGE CAN DESTROY IT.** For a document this size, write it to a
local file first and pass `local_path` to `project_write` (inside the session's
working directory, not /tmp). If an inline write times out, check whether the
doc still exists before doing anything else — on 2 Aug a timed-out write DID
delete it and the immediate retry restored it. **And `project_read` on a big doc
times out far more often than it succeeds** — `changelog.md` needed six attempts
on 3 Aug. A timed-out READ is harmless: confirm the doc exists with
`project_info` and keep retrying.

## How to write to the repo

**Work on `dev`. `main` is what is deployed.** 15 credits per deploy whatever its
size. Merge is `git checkout main && git merge --ff-only origin/dev && git push
origin main`, then `git checkout dev && git merge --ff-only main`. Do not delete
`dev`. **Batch related changes.** A docs-only commit that must go straight to
`main` takes `[skip ci]` — no deploy, no credits — then ff `dev` up to it, and
**verify by the deploy id NOT moving.**

⚠️ **A feature branch goes off `dev`, not `main`.** **An agent cannot open the
PR** (no `gh` CLI on either PC, and the GitHub connector is read-only): Jay
clicks the green button. A `.../pull/new/<branch>` URL is the FORM, not a PR.

**Three ways to write, all proven.** SMALL surgical change:
`Filesystem__edit_file` straight against the PC's clone. LARGE change:
`SendUserFile` then `device_commit_files` — content never passes through the
model. A BRANCH or multiple commits: **`git bundle`** — create it in the sandbox
(`git bundle create x.bundle origin/dev..branch`), ship via SendUserFile →
device_commit_files, then on the PC `git bundle verify` +
`git fetch x.bundle branch` and `git branch -f branch FETCH_HEAD`. Identity is
cryptographic. **Git in the sandbox can read but never write to origin** — a
push returns 403, *"not in this session's authorized repository set"*.

⚠️ **Prefer the bundle over writing files straight into the clone even for three
text files.** Git normalises line endings on its own; a file written directly
lands LF where the checkout is CRLF, and "line endings broke a check that was
right" is already on the list above.

⚠️ **A bundle made with `origin/main..HEAD` names its ref `HEAD`, not the
branch.** `git bundle list-heads` before writing the fetch refspec.

⚠️ **`git fetch <bundle> dev:dev` is REFUSED while `dev` is checked out** —
`fatal: refusing to fetch into branch 'refs/heads/dev'`. Fetch the bundle
without a destination refspec and `git merge --ff-only FETCH_HEAD` instead. Hit
again on 6 Aug.

⚠️ **Put the scratch folder OUTSIDE the repo** — a sibling of the clone, not a
child. Delete it afterwards. `C:\Users\jayjm\GitHub\_scratch` is the one used;
it needs a grant on `C:\Users\jayjm\GitHub`, not on the clone.

⚠️ **`Filesystem__edit_file` is atomic across its whole `edits` array** — one
bad `oldText` and NOTHING is applied. A very large payload can be truncated in
transit; for a big block use `Filesystem__write_file` + a small PowerShell
splice.

**Read source from the sandbox clone, edit there, then ship over.** Sync the
sandbox FIRST and again AFTER committing on the PC. Clone with
`git clone https://github.com/jayjmuir-hub/adhjrt.git` — the owner is
**`jayjmuir-hub`**, not `jayjmuir`; guessing wrong costs a round of 403s.

**Netlify branch-deploy URLs work without a PR**, at
`https://<branch>--adhquins-jrt.netlify.app` — ⚠️ **`adhquins-jrt`, not the old
`serene-gingersnap-1d0eb6`, which 404s.** With non-production password
protection ON, **401 means the deploy exists and 404 means it does not** — the
opposite of the rule that held while the password was off, and the third time
that sentence has had to be rewritten. Read the deploy id from the Netlify MCP
if it matters.

**The remote-devices bridge drops mid-session and comes back.**
`RefreshMcpTools({"server": "remote-devices"})` re-registers its tools.

**Running a PowerShell script file needs `-ExecutionPolicy Bypass`.** For
anything non-trivial write a `.ps1` into the scratch folder and run it rather
than fighting `-Command` quoting. ⚠️ **The bridge STRIPS `$` from a `-Command`
string** — `$log`, `$p.Id` and `$_` all vanish and the line dies on a parse
error. Use literal paths and `Select-Object -ExpandProperty`, or write a script
file. ⚠️ **A `.ps1` shipped through the bridge must be PURE ASCII** — PowerShell
5.1 reads an un-BOM'd file as ANSI and an em dash breaks parsing.
`grep -n "[^ -~]"` before sending. ⚠️ **`$ErrorActionPreference = 'Stop'` makes a
native command's first stderr line fatal** — land scripts run under `'Continue'`
and gate on `$LASTEXITCODE`. ⚠️ **An MCP `start_process` call caps out around
60s but the process keeps running** — redirect to a file and poll; a PowerShell
`*>` redirect writes UTF-16LE. **The full suite takes about seven minutes on
jay-pc**, so use `Start-Process` with `-RedirectStandardOutput` /
`-RedirectStandardError` and poll the log rather than waiting on the call.

⚠️ **NEVER `git add -A` — the repo root IS the served site.** Stage explicit
paths. `_commitmsg.txt` was committed that way on 27 Jul 2026 and served at
adhjrt.com/_commitmsg.txt; it is in `.gitignore` now, and the next scratch file
will not be. A land script's clean-tree check must use
`git status --porcelain --untracked-files=no`. `git commit -F` does NOT stage
anything.

⚠️ **THIS RULE USED TO BE JUSTIFIED BY "`claude/` on jay-pc is UNTRACKED AND NOT
GITIGNORED". THAT FOLDER NO LONGER EXISTS THERE** (checked 6 Aug 2026:
`Test-Path claude` → False, and `.gitignore` never mentioned it). The rule
stands on its own merits — the reason given for it did not. Left as a tombstone
because half a true rule is how somebody talks themselves out of the other
half.

**The tree-hash proof still applies**, and `git write-tree` on a clean checkout
is the safe way to take it — `HEAD^{tree}` gets mangled through `cmd /c`, and
**PowerShell eats it too unless quoted** (`git rev-parse 'dev^{tree}'`);
unquoted, PowerShell reads `^{tree}` as `-encodedCommand` and git fails on a
base64 string.

**Traps, all hit for real:** multi-line/apostrophe commit messages need `-F`
with a message FILE · `cmd /c "... && ..."` breaks on parentheses and on the
space in `Quins JRT.dc.html` · PowerShell 5.1 has no `&&`, no heredoc, and
`-Encoding utf8NoBOM` throws · `findstr` double-`/C:` misparses ·
`Select-String -SimpleMatch` treats regex escapes literally · piping through
`start_process` truncates · `git push`/`git checkout`/`git fetch` write to
stderr on SUCCESS, and the bridge renders that as a red `NativeCommandError` —
read the payload, not the colour · `[skip ci]` survives a fast-forward, so never
put it on an ordinary `dev` commit · a `grep -c` returning 0 kills an `&&` chain
· the bridge hits transient Cloudflare 502s, retry · diverged branches happen
silently between sessions · Playwright in the sandbox needs `playwright-core`
and the browser at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

⚠️ **BRANCH DEPLOYS AND DEPLOY PREVIEWS ARE FREE — 0 credits.** Production is 15,
failed deploys 0, rollbacks 0; build minutes are not metered. Iterate on
`Compare` and merge once. But see the branch-deploy warning at the top of this
page before leaving one published.

**Verifying a deploy.** `get-project` on site id
`8bb8cade-864f-416d-a4b8-eadda5f1997e` → current deploy id; `get-deploy` →
`state`, `commit_ref`, secret scan. ⚠️ **`get-deploy` returns a very large
payload** — every function, every hash, plus the whole commit message. Poll
`get-projects` for the current deploy **id** and only pull the full deploy when
you actually need `commit_ref`. Netlify needs ~30–60s after a push. A redeploy of
the SAME commit needs the dashboard's "Trigger deploy" button, not the MCP.
**For a `[skip ci]` push, the verification is that the deploy id has NOT
changed.**

**Verifying against the live site.** A signed-in Chrome tab driven through
Claude-in-Chrome reads what the sandbox cannot. Synthetic clicks don't always
register; `javascript_tool` with a real `.click()` does. Never trust a cached
element ref across a re-render. For anything that is just "is the byte there and
does the URL answer 200", `curl` from the sandbox against adhjrt.com is faster
and sufficient — **three times, not once.**

## The project docs

`specs/` (designs), `plans/` (build plans), `runbooks/` (procedures),
`archive/` (superseded). Four docs stay at the top level — status, history,
backlog, write-path rules. `state-of-play.md` and
`writing-to-github-from-claude.md` are referenced by those exact paths from the
live claude.ai Custom Instructions field.

| Doc | What it is for |
|---|---|
| `claude/handoff-2026-08-06.md` | **The two-minute version of this page.** Read it first if you are picking the project up cold. |
| `claude/changelog-2026-08-06.md` | **Newest changelog — read this one FIRST.** The stale branch deploys that were serving pre-security code against live data and how they were actually closed (`club-manager-page`, `design/team-codes-everywhere`), the credit correction and the new doc-claims suite (`dde10d5`), the rules button (`f24ae0d`), and the stop-hook change plus why it does not persist. |
| `claude/changelog-2026-08-05.md` | The About-section ring (`f6e991a` → `e7056ba`), the `netlify.toml` 404s that had never worked (`f587c56`), the parse error the ring shipped (`fc39e2f`), the `"admin"` → `"*"` correction (`987ba40`), the re-proportioning (`19e8f5d`), the mobile hide (`961fb14`), both stuck-hover fixes (`2e57420`, `c3ea255`) and the black ground (`d6f0533`). |
| `claude/changelog.md` | The detailed shipped record **up to and including the supporters grid (`ba5028d`)**. Still the record for everything before that. ⚠️ Do not try to prepend to it. |
| `claude/parked-requests.md` | The backlog — item 7 is the parked DOCUMENTS feature |
| `claude/writing-to-github-from-claude.md` | The write-path rules — read before the first write |
| `claude/specs/spec-hover-sweep-all-pages.md` | **SHIPPED to `Compare` 6 Aug (`6c429b9`)** — the site-wide pointer-gate sweep, why it fixes no live bug, and why the homepage's own sweep was left where it was |
| `claude/specs/spec-about-coverflow.md` | **SHIPPED 6 Aug** — the About carousel |
| `claude/specs/spec-documents.md` | **PARKED by Jay, 5 Aug — do not raise.** Organisers sharing documents with managers. Specced, no code. |
| `claude/specs/spec-sponsors-grid.md` | **SHIPPED 5 Aug** — the supporters grid, the `h` sizing formula and the argument against it |
| `claude/specs/design-audit-aug-2026.md` | **SHIPPED 2 Aug** |
| `claude/specs/spec-scores-manager-removal.md`, `spec-unified-login.md` | **SHIPPED 2 Aug** |
| `claude/specs/spec-my-account.md` | **SHIPPED 3 Aug** — walkthrough pending |
| `claude/specs/spec-club-manager-page.md` + plan | **PARKED — do not raise** |
| `claude/specs/spec-club-registration.md` | history of the public form |
| `claude/specs/spec-age-validation.md`, `spec-registration-window.md`, `spec-pitches-and-clash-detection.md`, `spec-import-registered-teams.md`, `spec-manager-dashboard*.md`, `spec-uniform-draw-editor.md` + plans | done, live |
| `claude/runbooks/runbook-clearing-the-rehearsal-data.md` | historical — the cleanup is done |
| `claude/archive/*` | history |

**⚠️ The About ring has no spec.** Eleven commits and ~520 lines went in without
one, against the rule that anything bigger than a tweak gets a spec before it
gets code. Its reasoning survives only in `CLAUDE.md`'s Layout section and the
commit messages — which is better than nothing and is not the same thing. **The
header nav and `/rules` (`24fb84c`) have no spec either.**
