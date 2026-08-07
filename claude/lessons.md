# ADH JRT — the mistakes worth remembering

**Durable. This file does not rot.** It was the largest section of
`claude/state-of-play.md` until 7 Aug 2026 — 357 lines of the most expensive
knowledge in the project, sitting in the one file defined as *"rots weekly by
design"*. That was the wrong home and it was the wrong home for weeks.

Each entry is a mistake that cost real time, written so the next session does
not pay for it again. **Add to this file rather than to the status page.**

⚠️ **No dates, no counts, no "currently".** Those belong in
`claude/state-of-play.md`. A lesson that needs a date to make sense is a
changelog entry, not a lesson.

---


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

