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

✅ **THE `/claude/*` 404 RULE IS VERIFIED (8 Aug 2026)** — see the section
below. The paragraph that follows is kept because its *reasoning* about why a
bare 404 proves nothing is still right.

⚠️ **[SUPERSEDED] THE `/claude/*` 404 RULE IN `netlify.toml` IS UNVERIFIED.** It points at
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

## ⚠️ THE FIRST RESTRUCTURE SHIPPED A RED SUITE, AND THE LOSS CHECK IS WHY (7 Aug)

**`cfcac4f` broke `tests/test-doc-claims.js` — 27/31 — and was pushed.** Four
checks anchored on the deploy-cost paragraph in `CLAUDE.md`'s "Outstanding"
list, that section was moved out, and the anchors rotted. Nothing deployed
(`[skip ci]`), so the live site was never affected. **Fixed by repointing, not
by deleting the checks:** the deploy-cost rule is back in `CLAUDE.md` where a
rule about money belongs, in two deliberate copies that the test asserts must
agree, with a warning above them saying so.

⚠️ **THE LOSS CHECK READ 986 OF 8,381 BYTES — 12% — AND REPORTED ALL CLEAR.**
It extracted only **bold spans of 25–110 characters**. `every production deploy
costs 15 Netlify credits` was never bolded, so the check never looked at it.
**A sweep's SCOPE is as load-bearing as its predicate, and scope is the half
that never appears in the check's name** — already in `claude/lessons.md`, and
walked into anyway.

**The line-level replacement caught two more real losses** on the second pass:
the PowerShell/bridge traps and the base64 fallback, dropped while consolidating
the write-path doc — and a tombstone that claimed "nothing was dropped" while
they were gone. **Run the line-level check, not the bold-span one.**

**Second pass, same day:** `state-of-play.md` **1,596 → 314 lines**. 357 lines
of lessons moved to `claude/lessons.md` (they were durable, sitting in the file
that rots); ~670 lines of per-commit history to `changelog-2026-08-06.md`; the
write-path rules consolidated into `CLAUDE.md`, and
`claude/writing-to-github-from-claude.md` **deleted with a tombstone** — it was
the THIRD copy (`git bundle` appeared 6× here, 2× there, **0× in `CLAUDE.md`**).
`RESTORE.md` 2,961 → 2,816 with **42 dated headings reduced to 0**, because its
own head forbids dates.

**Suite after all of it: 38 files green, 719/719 faults, 33 suites clean —
baseline UNCHANGED, which is the proof files were reorganised rather than
added.**

## ✅ BOTH REDIRECT RULES VERIFIED, AND `dev`/`Compare` WERE DELETED AND RESTORED (8 Aug)

**The rules are proven, by a measurement that discriminates.** A branch deploy
is FREE, and that is how it was done without spending 15 credits.

| | `compare--` (carries the rules) | production (does not) |
|---|---|---|
| `/CLAUDE.md` | **404** ×3 | **200** |
| `/RESTORE.md` | **404** | **200** |
| `/claude/state-of-play.md` | 404 | 404 |
| `/` · `/robots.txt` · `/no-such-xyz` | 200 · 200 · 404 | — |

⚠️ **THE 404s ON THEIR OWN PROVE NOTHING** — a file that is simply absent 404s
identically, and that ambiguity wasted two earlier attempts. **The 200 on an
unruled sibling in the same snapshot is what makes it a measurement.**

✅ **AND IT IS CLOSED ON PRODUCTION TOO (measured 8 Aug 2026).** This block used
to end *"`adhjrt.com/CLAUDE.md` and `/RESTORE.md` ARE STILL SERVED ON
PRODUCTION"*. They are not — the sixth deploy of 8 Aug carried the rule.
Measured live with controls in the same snapshot: `/CLAUDE.md` **404**,
`/RESTORE.md` **404**, `/claude/handoff-2026-08-08b.md` **404**,
`/claude/no-such-file-xyz.md` **404**, while `/`, `/rules`, `/app` and
`/manager` all answer **200**. ⚠️ **The stale sentence survived in this file for
the length of a day and was the first thing a fresh session read about the
subject** — which is the whole argument for this page having a size budget and
for checking a live fact live.

## ⚠️ `dev` AND `Compare` WERE DELETED FROM GITHUB AND FROM jay-pc (8 Aug) — restored

Jay deleted them by accident. **Both were gone from `origin` AND from jay-pc's
clone**, leaving `main` only. One commit — the `netlify.toml` root-doc fix —
existed **nowhere but an ephemeral cloud sandbox**. It was bundled to disk
first, then restored; `dev` and `Compare` are both back at that commit and
`Compare` is 0 behind `main`.

⚠️ **A BRANCH THAT EXISTS ONLY IN THE SANDBOX IS ONE SESSION FROM GONE.** The
container is reclaimed when the session ends. **Anything not on a PC or on
`origin` is not saved.**

## ⚠️ I DIAGNOSED A BROKEN WEBHOOK. IT WAS NOT BROKEN. (8 Aug)

Six pushes produced zero deploys, so I concluded Netlify had stopped receiving
events from GitHub, and said so confidently. **Wrong.** Five of the six carried
`[skip ci]` and were *correctly* not built. The sixth went to `dev` — which by
then had been deleted, so Netlify reported
`git ref refs/heads/dev does not exist`. Branch deploys work fine: `Compare`
built in 37s the moment the branch existed again.

⚠️ **"NOTHING HAPPENED" IS NOT EVIDENCE OF A BROKEN MECHANISM WHEN YOU HAVE
ALSO SUPPRESSED THAT MECHANISM.** Every commit that day was `[skip ci]`.
A silent system that you have told to be silent proves nothing — and I built a
confident diagnosis on it. **Check the thing you disabled before blaming the
thing you did not.**

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
> ⚠️ **THE 6 AUGUST STATUS BLOCK THAT SAT HERE IS GONE (7 Aug 2026).** It
> named `main`/`dev` at `1c26612`, a deploy id that has since moved, a `Compare`
> state that no longer holds, and — for the FIFTH and SIXTH time — a site
> password setting that was wrong. It said *"branch deploys are now gated,
> `requiresPassword: true`"*. **Measured 7 Aug: `false` / `null` — off
> everywhere.**
>
> ⚠️ **IT WAS WRONG WHILE SITTING 100 LINES BELOW A SECTION SAYING THE CLAIM
> HAD BEEN WRONG FOUR TIMES.** Writing down that a fact keeps rotting does not
> stop it rotting. **Deleting the copy does.**
>
> **Current branch state:** `git fetch origin` and
> `git rev-list --left-right --count origin/main...HEAD`. **Current deploy and
> password state:** Netlify MCP `get-project`. Neither answer belongs on this
> page, and neither is written here.
>
> ⚠️ **The club form is EXEMPT from the registration window** (`4955a5a`).
> `CLUB_FORM_KEY` is its gate. The team and player forms are still gated and
> must stay that way.

## ⚠️ FIVE PRODUCTION DEPLOYS ON 8 AUG, ALL PHONE WORK — AND FOUR CHECKS THAT LIED (8 Aug)

**Live at `79d57fd`.** Started from *"one of the club committee members already
[looked at it on a phone]"*.

⚠️ **THE FIRST DIAGNOSIS WAS WRONG AND IT WAS THE OBVIOUS ONE.** Measured before
touching anything: `scrollWidth` equalled the viewport at 360/390/430 and no box
crossed the right edge. **The homepage did not overflow.** Every complaint was a
layout decision that reads badly on a phone, not a bug. Chasing "the page
overflows" would have gone nowhere.

| Shipped | What it was |
|---|---|
| Hero CTAs side by side | Never stacked *on purpose* — 221+224+16 = **461px against 296px** of row, so they wrapped at every phone width, 430 included |
| Stats bar one row of four | Was a deliberate 2×2; padding and type had to come down with it |
| Sponsors 2/3 across | 18 tiles were **full-width rows** because the flex-basis stayed 190px — **not** the 260px cap the old comment blamed. Page **1,545px shorter** at 360 |
| Fixed HSBC strip, homepage + `/app` | Header has ~17px spare at 360px, which is *why* the header lockup was hidden below 900 |
| Registration modals | Email input crushed to a **~40px square** — the `+971` block is `flex:none` and cannot shrink, so its grid track starved the email track |
| `/rules` bracket claim | See below |
| `/manager` first phone layout | **106px of sideways scroll**, measured in a real signed-in session |

⚠️ **FOUR TIMES A CHECK REPORTED SUCCESS WHILE MEASURING THE WRONG THING.** This
is the same thread as the four traps in the 8 Aug morning handoff, walked into
four more times in one afternoon:

1. **A harness that had not booted.** The homepage loads React from unpkg; the
   sandbox could not reach it, so "no overflow, sections empty" was measuring an
   unrendered document. Then the fonts silently failed and the headline rendered
   in a serif — `document.fonts` said `error`, the screenshot just looked
   slightly off. **Trust `document.fonts.ready`, not the picture.**
2. **`overflow-x:hidden` "fixed" the `/manager` overflow.** It hid it. Two nav
   links were clipped off the screen where they could not be scrolled to, and
   the audit reported `sidewaysPx: 0`. Caught only by counting
   *overflowing-and-unreachable* separately.
3. **A CSS rule that matched nothing.** The source spells inline styles
   `display:flex`; the renderer emits `display: flex`. Verified live:
   `.matches('[style*="display:flex"]')` → `false`. **The source is not what
   ships.**
4. **A test that passed against its own bug.** The check for the rendered
   spelling matched a different rule further down, so deleting the spelling it
   guarded passed. The fault run caught it.

⚠️ **And one decoy I created myself:** a tombstone comment quoting the old
`@media(max-width:640px){.spon-tile{...}}` rule verbatim was matched by a test's
regex instead of the live rule, reporting a whole fix as missing. **A tombstone
that quotes code becomes a decoy for the next search — anchor on something only
the live rule has.**

⚠️ **THE REGISTRATION MODALS HAD NEVER BEEN SEEN ON A PHONE, AND THE REASON IS
STRUCTURAL:** they only render while the window is OPEN, and it had been shut
every previous time the page was checked at phone width. **A screen that only
renders in one state is not tested by looking at the page.**

⚠️ **`/rules` said something false, not merely vague.** *"Everyone plays through
… a Cup, Bowl, Plate and Shield bracket."* `scores-data.js` contradicts it five
ways, and the one that matters is a comment: *"A 5th-place team (odd pool sizes)
sits out of the knockouts entirely."* **That makes the heading wrong, not just
the bracket names.** Replaced with the only guaranteed part — the pool stage —
and the tests now assert that claim **against the homepage too**, because the
same promise on two surfaces is the hundreds-vs-thousands mistake again.

**Bundle route note:** `CLAUDE.md` § 1b said to fetch a bundle *"without a
destination refspec"*. That drops the source as well, and a bare fetch asks for
`HEAD`, which a `origin/dev..dev` bundle does not carry. Corrected to
`git fetch <bundle> dev` with all three forms tabulated.

## ⚠️ MANAGERS AND ORGANISERS COULD NOT SEE AN UNPUBLISHED DRAW (8 Aug, LIVE)

**Live at `f0abde9`** — one production deploy carried all five commits (the
draft-visibility work, the `/organizer` and `/signin` phone layouts, the render
harness and two docs corrections). **Batching worked as intended: five commits,
ONE 15-credit deploy instead of five.** `main`, `dev` and `Compare` are all level
at that commit; ⚠️ **`Compare` was found 30 commits behind `main` at merge time
and fast-forwarded in the same breath**, which is the rule that stops it becoming
the next `club-manager-page`.

⚠️ **THE DOCS RECORD OF THIS DEPLOY REACHED `main` WITHOUT A BUILD, AND THE
MECHANIC IS WORTH KNOWING.** The commit that wrote the paragraph you are reading
was already pushed to `dev` **without** the skip-ci marker, and Netlify reads the
**tip** commit of the push — so amending was out (the commit was published) and
the marker had to go on a **new tip above it**. A marker on the tip suppresses the
build for everything behind it, which is normally the bug and here is the whole
point. Verified the way it has to be: **the deploy id did NOT move** —
`6a783af707db59000800e3f4` before and after. **0 credits.**
⚠️ **The inverse of this is the 6 Aug incident**: a marker that survived a
fast-forward onto `main` and left it merged-but-undeployed while the dashboard
showed the old commit as published. Same mechanism, opposite intent — which is
why the marker is only ever written deliberately, and never into a message that
merely *discusses* it.

**Verified on production after the deploy, not inferred:** the deploy id moved
`6a7741aa…` → `6a783af7…` and reached `ready`; eight pages answer 200; the new
`tools/render-audit.js` answers **404** alongside `/tests/*`, `/claude/*`,
`/CLAUDE.md` and `/RESTORE.md`, with `/` and `/robots.txt` at 200 in the same
snapshot as controls and a nonexistent path 404ing to show the null result; the
new rules are present in the **delivered bytes** of `/signin`, `/organizer` and
`/app` (with a deliberately-absent string as a control); and
`get-schedule-override?draft=1` returns `isDraft: false` both with **no** token
and with a **bogus** one — the server verifying rather than the client asking
nicely.

Jay: *"the managers and organizers should be able to see fixtures, tables, and
standings in their sections even if they aren't published, because they have to
be able to make fixture changes when not published, the way it is now they are
blind"*. Right, and wider than described. Full reasoning, including the argument
AGAINST each choice, in `claude/specs/spec-draft-visibility-aug-2026.md` — **do
not re-derive it.**

**The cause was one word in three signatures.** `getDraw(agId, session)` served
the draft, so the editor always worked; `getFixtures(agId)`,
`getStandings(agId)` and `getSpiritAward(agId)` took no session at all, so every
other view of the same draw asked as the public and got "not released yet".
⚠️ **`get-schedule-override.js` already served the draft correctly — no backend
change was made, and none was needed.** The hole was the client not passing the
session it was already holding.

⚠️ **THE PART NOBODY ASKED ABOUT IS THE MATCH-DAY ONE.** `/manager`'s score
sheet builds its match list from the same fetch, so **no score could be entered
for an unpublished age group.** Managers can publish on tournament days only, so
with nothing published before the weekend, scoring sat behind a manager
publishing it themselves first.

| Shipped | What it was |
|---|---|
| `viewModeOf()` in `scores-data.js` | one derivation, four modes — `published` / `draft` / `sample` / `none`. ⚠️ Discriminated on the SERVER's `isDraft`, not on `!!session` — see RESTORE.md § Which reader sees which draw |
| `/manager` | Fixtures, Results and Tables tabs, the score sheet and the Spirit award all read the draft |
| `/app` | six fetch calls across three functions, none of which passed the session it was holding |
| **`/organizer`** | **a new read-only "Fixtures & tables" tab — it had no view of a draw at all.** Ninth tab; two pinned counts went red and both were moved |
| The marker | worded, not coloured, in three files, because `sample` renders INVENTED team names |

**Jay's two calls:** show the sample draw rather than hiding it, and give
`/organizer` its own panel rather than leaning on the `/manager` switcher.

⚠️ **THE FAULT PROVER CAUGHT THREE FAULTS IN THE NEW TESTS THEMSELVES**, all the
same shape — the stub answered identically whether or not the session was
passed, so the likeliest regression of all was invisible; and a source check
anchored on a string that appears in two methods of the same file passed while
the method it named was broken. Detail in the spec. **This is the fourth
consecutive piece of work where the instrument agreed with the intention.**

⚠️ **THE SUITE RUNS IN THE CLOUD SANDBOX AND NOTHING SAID SO.** `CLAUDE.md` §5
describes `powershell tests/runall.ps1` on jay-pc, ~7 minutes, polled through a
log because an MCP call caps at 60s. The files are plain Node with no
dependencies and each finds the clone itself:
`for f in tests/test-*.js; do node "$f"; done` plus
`node tests/_prove-registration.js` reproduces the entire run with no PowerShell
and no bridge. **Iteration is free.** `runall.ps1` is still the authority for
the header count on jay-pc.

## Where things stand

| | |
|---|---|
| Tournament | **7–8 November 2026**, Zayed Sports City |
| Registration | not open; the link goes out ~mid-October. No real club has registered. |
| Site password | ⚠️ **NOT RECORDED HERE, DELIBERATELY.** Read `projectAccessControls` from the Netlify MCP. This row has been wrong six times. Jay holds the password; it has never been in a message or a tool call. |
| Branch deploys | allow-list is **`dev, Compare`**. ⚠️ **Free — 0 credits.** ⚠️ A branch deploy outlives its branch and reads production's env vars and stores. **Whether they are password-gated: read the Netlify MCP, not this page.** |
| Teams / Players sheets | **CLEAN** (0 / 0), cleared by Jay 2 Aug |
| Rehearsal data | **CLEARED**, verified 2 Aug |
| Registration window | ⚠️ **NOT RECORDED HERE ANY MORE — the same treatment as the site-password row above, and for the same reason.** It was force **OPEN** and then force **CLOSED** inside two hours on 8 Aug 2026, so any value written here is wrong by the time it is read. **Read it live: `GET https://adhjrt.com/.netlify/functions/registration-window`** — `state.open` and `state.forced`, and the `warnings` array says in plain English which way a force is pointing. **Jay decides on his own — do not raise this.** ⚠️ **The registration MODALS only exist while it is open**, so a phone or layout check made while it is shut has not seen them (this is exactly how they shipped unusable — see 8 Aug below). |
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
| HSBC | ⚠️ **FIVE placements on the homepage since 8 Aug, not three** — 19 / 128 / auto / 96 / **18px (new fixed bottom strip)** — plus **three** in `/app`. Never more than two visible at once; the pairings share breakpoint numbers (800 and 900 on the homepage, 359 in the app) and both are asserted. Full table in `RESTORE.md` § HSBC. Phone walkthrough **still pending**. |
| **Phone layout** | **ALL of it is LIVE (8 Aug): homepage, registration modals, `/rules`, `/app`, `/manager`, `/organizer` and `/signin`.** Only `Scores & Standings.dc.html` still has zero media queries, deliberately — Jay's call 8 Aug: `/app` is the match-day phone answer. ⚠️ `/signin` was recorded here and in `RESTORE.md` as "2/2 inputs under 16px"; **measured, it is SIX, all at 15px.** One rule covers them and a test now pins the count. ✅ All three back-office blocks are **measured in a RENDERED page** by `tools/render-audit.js`, with a desktop width as the control — table in `RESTORE.md` § Phone layout, along with the counts and the three traps. |
| The real draw | **still placeholder clubs** in all 15 groups. Pitches and kick-off times are real; the pools wait on real registrations. Everything else waits on this. |
| Results nav link | still an in-page `#results` jump — change to `/scores` only once the draw is real |
| Tests | **39 files green; 786/786 faults caught; 34 suites clean undamaged; 40 `--- ` headers** — the fault count moved 773 → 786 with the `/organizer` and `/signin` phone work, and the clean baseline **stayed at 34, which is the proof those checks EXTENDED `test-design-polish.js` rather than arriving in a new file.** The 773/34/40 figures were measured twice at `7c78a16`, in the cloud sandbox on plain Node **and** by `powershell tests/runall.ps1` on jay-pc, which agreed exactly. ⚠️ The header count was first read as **0** by a poll using `Select-String -SimpleMatch '^--- '`, which treats the regex literally — the trap already in `claude/lessons.md`, hit again. Re-read without it: 40, with a deliberately-unmatchable control returning 0. ⚠️ 12 stderr lines in that run are the prover's own injected faults (`verify is not defined` and friends), read rather than counted. ⚠️ The fault count went 719 → … → 759 → **773** across 8 Aug as each change added its own; **the number in prose is worth nothing — trust the runner's own output.** This row has previously been wrong as 37/653/32 while `CLAUDE.md` said 38/672/33 and `tests/README.md` said 36/630/31. ⚠️ **The baseline `M` going UP is the only proof a new suite ran undamaged, and it staying PUT is the proof an existing one was extended.** It moved 33 → **34** because `tests/test-draft-visibility.js` is a new FILE; it was added to `runall.ps1` in the same commit. |

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
3b. ~~Revoke the two rehearsal manager logins.~~ **DONE — `test-u14b` and
   `test-u13` revoked by Jay on 7 Aug 2026.** They had working passwords and
   no reason to exist; they were the last of the rehearsal accounts. Jay's
   word, on the same basis as item 3 — not independently checkable.

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
   ⚠️ **PARTLY ANSWERED 8 Aug, and only partly.** `/manager` HAS now been
   measured on a real touch viewport — in Jay's signed-in Chrome under DevTools
   device emulation at 430px, before and after. `/organizer` was measured too
   (3/3 controls under 16px; wide tables scroll in their own box, no page-level
   overflow). `/scores` and `/signin` still have not been. ⚠️ **And "measured"
   is still not "used": nothing in this project has been checked on a REAL
   handset.** Everything is headless Chromium or DevTools emulation. The two
   things neither can see are **iOS Safari's dynamic toolbar** under the new
   fixed HSBC strips, and **whether the 16px rule actually stops zoom-on-focus**
   — which is real-iOS-only behaviour and does not reproduce in an emulator at
   any width. Both are one-line fixes if wrong. **This is the single largest
   unverified claim in the 8 Aug work.**
   ⚠️ **NARROWED, NOT CLOSED, LATE ON 8 AUG.** `tools/render-audit.js` now takes
   a genuine rendered reading — computed styles and bounding boxes in headless
   Chromium, with a desktop width as the control — for `/signin`, `/organizer`
   **and** `/manager`. `/signin` has therefore now been measured, closing half of
   the sentence above it, and `/manager`'s shipped block was independently
   re-verified by a different instrument. **What none of it can say is whether
   WebKit then behaves**, because Chromium is an emulator too. Do not let
   "measured in a rendered page" blur into "verified on a phone" — the handset
   job is unchanged, and `/scores` still has not been looked at.
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
4. **Splitting oversized `Organizer.dc.html`** — not started, and it grew by a
   tab on 8 Aug (the read-only Fixtures & tables panel).
4b. ~~**`Organizer.dc.html` HAS NO PHONE LAYOUT AT ALL.**~~ **DONE AND LIVE 8 Aug.** Both questions were answered by Jay: (a) **"make it work"**, the same
   five blanket rules `/manager` got, not a redesign; (b) the technique question
   he left open and it was decided on the failure mode — **attribute selectors,
   both spellings** — because they fail loudly and globally where hand-named
   classes fail quietly and locally, and this is the file carrying the draw
   editor. Reasoning in `RESTORE.md` § Phone layout. ⚠️ **Its wide tables were
   NOT touched** — all five already scroll inside their own boxes, checked line
   by line, and a test now counts scrollers against wide tables. ✅ **MEASURED IN
   A RENDERED PAGE** by the new `tools/render-audit.js`: at 390px, 0/3 controls
   under 16px (16px against 14px at desktop), 0/13 buttons under 44px (13/13 at
   desktop), 0px sideways scroll, and **13 of 13 flex rows both matched and
   wrapping** — which is the reading that proves the attribute selectors select
   anything at all. Its 21 overflowing elements all sit inside real scrollers
   (unreachable = 0): the wide tables, working as intended.
4c. ~~**`Signin.dc.html` has 2/2 inputs under 16px.**~~ **DONE AND LIVE 8 Aug
   — and it was SIX inputs, not two.** All six at `font-size:15px`. Two rules:
   16px on inputs, 44px floor on buttons. The "2/2" was wrong in this file and in
   `RESTORE.md`; both corrected, and a test pins the six so the number cannot go
   stale again.
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


## Where everything lives (rewritten 7 Aug 2026 — the old version of this section was wrong)

⚠️ **This section used to describe a `claude/` folder that was not in the
repo.** It is now, so a clone gets everything.

| File | Role |
|---|---|
| `CLAUDE.md` | **The rules.** Git route, branch rules, deploy cost, secrets, verification standards, precedence |
| `RESTORE.md` | **Durable.** How the code actually behaves |
| **this file** | **Volatile.** Shipped / blocked / on whom / which clone is behind. Rots by design |
| `claude/lessons.md` | **Durable.** The mistakes worth remembering — moved out of this file 7 Aug |
| `claude/decisions/` | The rulings — why a settled question was settled |
| `claude/changelog*.md` | What happened, in order. Newest first: `-08-07b`, `-08-07`, `-08-06`, `-08-05`, then `changelog.md` |
| `claude/parked-requests.md` | The backlog |
| `claude/specs/`, `claude/plans/` | Designs and build plans — history, not instruction |
| `claude/runbooks/` | Procedures. ⚠️ **Check the tombstone header before following one** |
| `claude/archive/` | Superseded |

**Precedence: the code wins, then `RESTORE.md`, then this file, then
`CLAUDE.md`.** `claude/lessons.md` is durable but advisory — it tells you how
to avoid a mistake, not what the code does.

⚠️ **THIS FILE HAS A SIZE BUDGET NOW: about 300 lines.** It reached 1,596 by
absorbing 357 lines of durable lessons, 130 lines of write-path rules that
existed in two other files, and ~670 lines of per-commit history. **If you are
adding more than a paragraph here, ask which of the files above it belongs in.**

⚠️ **`claude/writing-to-github-from-claude.md` IS GONE (7 Aug 2026).** It was
the third copy of the write-path rules — `CLAUDE.md` had them, this page had
them, and that file had them, all partial and none identical. `CLAUDE.md` is
the only copy now. A tombstone sits at `claude/archive/` explaining the move.
