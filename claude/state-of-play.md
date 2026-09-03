# ADH JRT — state of play, 3 September 2026

## 3 Sep 2026 — two pubs off the live sponsor strip

Jay asked Sportsman's Arms and The Bottle Store off the homepage supporters
grid. Brighton College Abu Dhabi was already a sponsor and is untouched.
HSBC stays principal. Not merged.

## 3 Sep 2026 — tournament dates restored to 7–8 November 2026

Jay moved ADH JRT back to the original weekend. Source of truth is
`DEFAULT_VENUE` (day1 = Saturday 7 November, day2 = Sunday 8 November).
Homepage JSON-LD, countdown fallback (`2026-11-07T04:00:00Z` = 08:00 Asia/Dubai),
waiver, share-card, and confirmation emails match. Day split unchanged: Saturday
= Mini, Midi & Colts; Sunday = Youth & Girls; U16B still plays Sunday. Not
merged yet — production still serves 14–15 until this lands.

## ✅ 22 Aug 2026 — MERGED AND LIVE at `7b0bc16` — retheme + desktop sidebar

Jay approved on the dev preview ("that looks right now, merge it").
Fast-forward `8615a90..7b0bc16`, one production deploy, `main`/`dev`/`Compare`
all level. **Measured on adhjrt.com after the deploy, with controls:** the
token block serves on `/signin`, the sidebar on `/organizer` and `/manager`,
the `!important` hide rule shipped; the homepage still carries its dark brand,
`/app` has no sidebar, `/scores` and `/register-club` answer 200, and
`/claude/*` still 404s. The section below was written while the work sat
unmerged — its suite numbers and lessons stand.

## 22 Aug 2026 — the back office wears the current club brand (build record)

`claude/specs/spec-backoffice-retheme.md` built the same day it was specced,
with Jay's three calls: dark chrome header band, `/signin` included, teal →
info blue. `/signin`, `/manager` and `/organizer` re-pointed from the club's
abandoned palette (`#E11B22` red, warm greys) to the current one, via one
`:root` token block per file — byte-identical across the three, asserted by
`tests/test-backoffice-retheme.js` (32 checks, contrast computed from the
tokens themselves).

**Suite: 930/930 faults, 48 clean, 48 files.** Seven new faults. The clean
baseline went 47 → 48 — the proof the new file ran undamaged. **19
pre-existing faults quoting old colours reported COULD NOT INJECT** and were
repointed in the same sitting, never deleted.

⚠️ **AND THE PALETTE WAS NOT THE POINT.** Jay, on the preview: *"no side tool
bar, still feels like an app and not a website, that was the main goal."* Same
day, phase 2: **a fixed dark sidebar on both dashboards at ≥1100px**, Club
Hub's shell shape — nav column, active tab in brand red, session block at the
bottom — CSS-gated so phones keep the measured layout, band and sidebar being
two copies of the same controls on the same bindings. **Suite after phase 2:
935/935, 48 clean.** Two faults that deleted only the band's copy of a control
went NOT CAUGHT once a sidebar copy existed and now delete both — a two-copy
control needs two-copy faults.

⚠️ **The 8-digit-hex trap, for the next palette sweep:** `#17A34A30` is hex +
alpha; a 6-digit inventory grep cannot see it, and a var() swapped into it
produces `var(--x)30` — invalid CSS, silently transparent. `AGE_TINT` and the
`${t}30` gradient stops must stay literal hexes; a fault now enforces it.

⚠️ **NOT yet looked at signed-in on a rendered page.** The render audit needs
playwright (absent on the build machine). Jay reviews the dashboards at
`dev--adhquins-jrt.netlify.app` before any merge; production untouched.

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

## ⚠️ A REVIEW OF THE DAY'S WORK FOUND TWO DEFECTS ITS OWN 13 FAULTS DID NOT (8 Aug, on `dev`)

Jay asked for a code review of what had just shipped. **Two real defects, both
introduced by the draft-visibility change, neither caught by any of its faults —
which is the argument for reviewing rather than only testing.**

⚠️ **1. Signing out of `/app` left an unpublished draft on screen.** `act()`'s
signout branch cleared the session and re-rendered but refetched nothing. That
was a **harmless no-op until this change**, because `S.fixtures` /
`S.standings` / `S.followFx` could only ever hold PUBLISHED fixtures. Once they
could hold a draft, signing out left it on screen still wearing the marker that
reads *"You can see this because you are signed in"* — for whoever was handed the
phone next. Tab switches do not refetch; only an age-pill change or the
60-second match-day poll would have cleared it. **Nothing new leaked from the
server, which is exactly why no server-side check could have caught it.**
⚠️ **This is `claude/lessons.md`'s "deleting a config value can promote an
ordinary check into a load-bearing one" running in reverse:** a change elsewhere
made an existing line load-bearing, and nothing pointed at the line.
Fixed by clearing all three caches **before** the render and refetching as the
public. ⚠️ `followFx` is a separate cache from `fixtures` — that is what lets
Today survive browsing another age group — so it is cleared and reloaded **by
name**, and a fault exists for the partial fix that forgets it.

⚠️ **2. The new `/organizer` tab opened on U6, which keeps no table.**
`MANAGER_AGE_GROUPS[0]` is `u6` (`hasStandings:false`), so the first thing an
organiser ever saw was *"Festival age group — no standings are kept"*, reading
like a broken tab. ⚠️ **`MANAGER_AGE_GROUPS` cannot answer this** — its entries
are `{id,name}` with no `hasStandings`, and the festival ids live in
`scores-data.js` / `_scoring.js`. Hardcoding `'u6'`/`'u7'` here would have been a
THIRD copy of that knowledge, which is how the pitch model and the registration
rules each went wrong once; a fault now catches exactly that shortcut. Fixed by
asking the data layer, reusing the list the Tournament tab already fetches, with
`MANAGER_AGE_GROUPS[0]` kept as the floor so a failed fetch still opens on
something. **Verified in a rendered page: it now opens on U8 Tag and the
festival message is gone.**

⚠️ **AND THE REVIEW'S THIRD FINDING WAS ABOUT THE VERIFICATION ITSELF.** The
render audit that closed gap 4b measured the **default tab only** — 13 flex rows
on a file with 72, eight of nine tabs never rendered — and was reported as
"measured in a rendered page". All nine have now been walked at 390px: **0
controls under 16px, 0 buttons under 44px, 0 sideways scroll, 0 clipped, every
flex row wrapping, on every tab.** The conclusion held, but it held by luck
rather than by the check. ⚠️ **Still unmeasured:** the venue schematic's
absolutely-positioned drag markers never render without a backend, and one of
them contains a flex row the blanket rule matches.

**Suite: 792/792 faults, 34 clean, 39 files.** Six new faults, all six on the
review's findings.

---

## 9 Aug 2026 — session revocation closed (LIVE — merged in #16)

An outside code review of the whole repo found nine issues; this is the first
of them fixed. **Revoke, Reject and an organiser's password reset were all
cosmetic** — they changed the accounts blob and nothing else, so the person's
token kept working for up to 182 days. A revoked *organiser* could re-approve
themselves. Durable detail in `RESTORE.md` → "Revoke actually ends a session".

`resolveSession()` in `_auth.js` is the new door; all 13 call sites moved to it
(11 required, 2 optional). `accounts-admin.js` stamps `sessionsValidFrom` on
revoke and on a reset.

**Suite: 801/801 faults, 35 clean, 40 files.** Nine new faults; the clean
baseline went 34 → **35**, which is the proof `test-session-revocation.js` is a
new FILE that ran undamaged rather than checks bolted onto an existing suite.

⚠️ **Three PRE-EXISTING faults had to be re-anchored** (44, 288, 408) because
they quoted the exact lines the fix replaced. They reported COULD NOT INJECT,
which is a failed run and not a silent pass — the mechanism worked.

⚠️ **A fourth anchor failed for a different reason worth knowing:**
`seed()` normalises the temp copy to LF (line 206), so a fault anchor written
with this repo's own CRLF never matches. Write `\n` in fault strings, always.

⚠️ **Two of the nine faults exist because my first attempt at the check passed
against the bug.** The `|| 0` on `sessionsValidFrom` was documented — by me — as
what keeps pre-Aug-2026 accounts signed in; injecting its removal proved that
false (`x < NaN` is already false), and the comment in `_auth.js` was corrected
to say what actually carries it. Separately, removing the account lookup made
the suite die on a stack trace rather than fail the check that claims to guard
it; the suite now wraps the call so a throw goes red on the right line.

⚠️ **Behaviour changes to expect on deploy:** a manager hitting an
organiser-only endpoint now gets **403, not 401** (401 told a signed-in person
"Not signed in", which sent them to re-enter a password that would not help); a
deleted account gets 401 rather than my-account.js's 404; a transient blob
failure now gives **503 "try again"** rather than letting the request through.
**Existing sign-ins survive** — accounts with no `sessionsValidFrom` are
unaffected, so this does not log the committee out on deploy.

---

## 9 Aug 2026 — result storage moved to one blob per match (LIVE — merged in #16)

The second review finding. Results were one blob per age group,
read-modify-written, which carried two defects the write-and-verify could not
see: **a failed read fell through to an empty slice and the caller wrote THAT
back as the whole group** (fourteen results gone, green tick shown), and **two
managers scoring the same group could both be told it saved** while one score
no longer existed. Durable detail in `RESTORE.md` → "Results storage".

One blob per match removes the cause instead of narrowing the window: a save
writes exactly one key. **No migration, deliberately** — both older layouts stay
on disk and are read as fallbacks, so nothing is in flight and a rollback loses
only what was saved while the change was live. Clearing writes a tombstone
rather than deleting, or the fallback would resurrect the cleared result.

Card counts were sanitised in the same commit (they were the one figure taking
the client's value raw — `-3` and `null` were both storable and both served to
the public Standings page).

**Suite: 809/809 faults, 36 clean, 41 files.** Eight new faults.

⚠️ **One of those eight exists because my first rewrite introduced a NEW bug and
all 32 checks passed.** `readGroup` merged the group blob over the legacy slice
while `readAll` replaced it — so a result cleared under the old layout stayed
gone in the public view and came back from the dead on the manager's own
dashboard. Every supersession check went through `readAll`; nothing asserted the
two readers agree. **Two callers, two merges; a test of one says nothing about
the other.**

---

## 9 Aug 2026 — login rate limiting fixed (LIVE — merged in #16)

Third review finding, and the one that would have bitten on the day. One bucket,
keyed on the connection address alone, incremented **before** the password was
checked. Every manager at Zayed Sports City shares one connection address, so
ten CORRECT sign-ins used the whole venue's budget and the eleventh manager to
arrive would have been refused with the right password. Durable detail in
`RESTORE.md` → "Signing in is rate limited per ACCOUNT".

Now two buckets — per account (10/15 min) and a per-connection sweep backstop
(50/15 min) — with **only failed attempts counting**, and a correct password
clearing the per-account bucket. The username-enumeration timing leak went in
the same commit (bcrypt now always runs, against a published dummy hash;
measured 63 ms vs 64 ms).

**Suite: 817/817 faults, 37 clean, 42 files.** Eight new faults.

⚠️ **TWO BUGS FOUND BY WRITING THE TEST, NOT BY THE REVIEW:**

1. **`readWindow()` measured expiry against the module's one-hour constant, not
   the caller's window.** Every 15-minute limit — login AND signup — really
   lasted an hour, while telling the person to retry in fifteen minutes. Found
   by the first test that ever advanced a clock past a bucket's own window.
2. **My headline check did not guard what I said it did.** "Fifteen managers all
   get in" passes even with the bucket put back to connection-wide, because
   nothing increments on success any more. It guards the failures-only half
   only; the per-account half is held by a different check. Found by injecting
   the half I thought it covered. The claim in the test header was corrected.

⚠️ **Four PRE-EXISTING faults (83, 182, 403, 405) had to be re-anchored** and
one existing suite (`test-unified-login.js`) gained two checks for the new
shape. All four reported COULD NOT INJECT rather than passing silently.

---

## 9 Aug 2026 — head metadata moved into the real `<head>` (LIVE — merged in #16)

Fourth and sixth review findings, done together because they share a file.
Every crawler-facing tag lived in `<helmet>` in the `<body>` and was moved into
`document.head` by JavaScript at boot — so **every link to this site shared on
WhatsApp, Facebook, LinkedIn or Slack arrived as a bare grey URL**, on a site
distributed entirely by parents forwarding links. Durable detail in
`RESTORE.md` → "Page metadata lives in the real `<head>`".

It also **silently voided a security claim**: `netlify.toml` said the unlisted
club form was protected partly because the page carries `noindex`. It did not —
the tag only existed after JS ran. That comment has been corrected in place, and
the tag is now where a crawler sees it.

`/app` gained a canonical (it was reachable as both `/app` and `/app.html` with
nothing joining them) and share tags. `/legal` was added to `sitemap.xml`.
`/netlify/*`, `/netlify.toml` and `/package.json` are now 404'd — ⚠️ **not yet
verified on a deploy**; do it on a free branch deploy with an unruled sibling
returning 200 as the control.

**Suite: 823/823 faults, 38 clean, 43 files.** Six new faults. The clean
baseline has gone 34 → 38 across the four fixes on this branch.

⚠️ **THREE SEPARATE THINGS BROKE ON THE SAME MISTAKE IN ONE SITTING, ALL MINE:
a comment that mentions a string is indistinguishable from the string.**

1. My `<head>` comment contained the word `<helmet>`, so my own verification
   script sliced from the comment instead of the tag and reported tags "still in
   the helmet" that had been moved correctly.
2. The same comment contained a literal script tag, which `test-about-board.js`
   read as opening a script region — it then reported the rest of the file as
   script body and failed the encodeCase check.
3. A comment naming the club form's path failed `test-intake.js`, which proves
   the path's absence with a plain substring search over the file.

**Real tags start a line; prose never does.** Match structurally, and do not
name a string in a comment that sits inside the file a checker greps.

---

## 9 Aug 2026 — image weight (LIVE — merged in #16)

Fifth review finding. The hero background was a **1.8 MB PNG** — the Largest
Contentful Paint, bigger than the rest of the homepage put together, pulled in
full by every parent on venue mobile data before the page could paint. Durable
detail in `RESTORE.md` → "Image weight".

Now avif/webp at two widths in a `<picture>`: **1.8 MB → 30 KB**. Same treatment
for `venue-map` (527 KB → 16 KB) and `format-action` (227 KB → 114 KB).
`sponsors-logos.png` deleted — 371 KB with zero references anywhere in the repo.
Encoded with ffmpeg, quality chosen by measuring SSIM (hero 0.958, map 0.967)
rather than by guessing a CRF.

**Suite: 830/830 faults, 39 clean, 44 files.** Seven new faults.

⚠️ **THE PROVER'S BASELINE EARNED ITS KEEP.** My first version of
`test-image-weight.js` weighed files on disk, which fails on the prover's temp
copy — `seed()` reads with `utf8` and mangles binaries, so `assets/` is not
seeded there. The suite failed UNDAMAGED, the clean count stayed at 38 instead
of rising to 39, and every one of its faults would have reported "caught" while
proving nothing. That is exactly the failure the baseline exists to detect and
it detected it. Split into markup checks (everywhere, and what the faults aim
at) and weight checks (only where the bytes exist), with the mode printed.

⚠️ **FOURTH AND FIFTH TIME on the prose-contains-a-tag trap in one branch.** My
hero-`<picture>` regex matched a `<picture>` written inside an existing comment;
anchoring it to the start of a line did not help, because that comment is
indented. The fix is to strip HTML comments before matching — these files
genuinely contain prose about markup, and no pattern can tell the two apart.

⚠️ **Two checks of my own passed against the bug and had to be tightened:**
`action-run-sm` matched anywhere in the `<picture>` (so dropping it from the
AVIF source alone stayed green), and `test-about-board.js` located the board's
`<picture>` as "the first one in the file" — true only while the board was the
only one on the page. Both now match by content, per source.

---

## 9 Aug 2026 — accessibility (LIVE — merged in #16)

Eighth review finding. **Not one form control on the site had an accessible
name** — 60 label/control pairs associated, 30 `aria-label`s added where there
is no visible label. The `/app` bottom sheet declared `aria-modal` and had no
Escape handler, no focus management and no trap; its submit buttons changed
label but were never disabled. Durable detail in `RESTORE.md` → "Accessibility".

**Suite: 838/838 faults, 40 clean, 45 files.** Eight new faults.

⚠️ **MY BULK TRANSFORMER EDITED TEXT INSIDE COMMENTS.** It added `id=` to an
`<input type="date">` written as *prose* in two explanatory comments, then
pointed two real labels at those non-existent controls. Caught by the new
suite's own "every label's `for=` resolves to a control" check. **Eighth time in
this branch that prose containing a tag was read as the tag** — and the ninth
was writing the warning about it: the first draft of
`tests/test-accessibility.js` spelled out a JavaScript block comment's
delimiters inside a JavaScript block comment and would not parse.

⚠️ **Two of my own checks passed against the bug, again:**
`/sheetReturnFocus/.test(code)` survived deleting both the capture and the
restore, because one bookkeeping line kept the substring alive — all 49 checks
passed against a sheet that no longer returned focus. And the ordering check
beside it compared `indexOf` results with a bare `<`, where **−1 is less than
everything** — the same trap already fixed once in `test-documents.js` this
month. Both now prove the positions exist before comparing them.

⚠️ **Five pre-existing faults had to be re-anchored** because I inserted
`aria-label` in the MIDDLE of existing tags rather than appending. Appending
would have broken nothing. All five reported COULD NOT INJECT.

⚠️ **"THE REVIEW IS FULLY CLOSED" WAS WRONG — I WROTE IT AND THEN CHECKED.**
Seven of nine findings are closed plus all the housekeeping. **Three items were
dropped between one open-items list and the next**, and the claim went in
unverified — the exact failure this whole branch was about. What is actually
left:

1. **The homepage still hardcodes tournament dates the back office can change.**
   `Quins JRT.dc.html`: the countdown target `2026-11-14T04:00:00Z`, the
   per-group `day: 'Saturday'|'Sunday'` in `AGE_GROUP_CARDS`, and `startDate` /
   `endDate` in the JSON-LD. `_venue.js` shows both are organiser-editable, and
   `/app` reads them live — so moving a group between days updates `/app`,
   `/scores` and the back office, and **silently leaves the homepage wrong**.
   The homepage already calls `api.loadVenue()` for the pitch count, so the
   data is there.
2. **`test-google-auth.js` has ZERO behavioural coverage** — 0 handler calls,
   34 of 40 checks are regexes over source. Google sign-in is the
   highest-security surface in the repo (audience check, googleSub lookup,
   invite-code gate) and reformatting the code breaks tests while a real bug
   that preserves the text passes. `test-functions-load.js` already stubs
   `google-auth-library`, so the machinery exists.
3. **`/app` polls every 1s and 60s with no `visibilitychange` gate** (measured:
   0 occurrences), so a backgrounded PWA keeps hitting the API. Browsers
   throttle background timers so the impact is small — this is the genuinely
   minor one.
⚠️ What is NOT done: nothing is merged to `main`, so **production still runs the
old code**. And everything behind a login — revocation, per-match score storage,
the rate limit — has been proven only by the suite, never on a deploy. Doing the
revoke test on the preview is the single most valuable remaining check.

`fix/review-aug-2026` pushed; PR #16 opened purely to get a free Deploy Preview.
**Production is untouched.** Branch deploys are set to "all branches" but no
`fix-review-aug-2026--…` host ever appeared; the PR preview did, so that is the
route that works here.

Preview: `https://deploy-preview-16--adhquins-jrt.netlify.app`

**The before/after that discriminates** — same paths, production vs preview, at
the same moment:

| path | production | preview | verdict |
|---|---|---|---|
| `/netlify/functions/_auth.js` | **200** | **404** | ✅ real hole, now closed |
| `/package.json` | **200** | **404** | ✅ real, now closed |
| `/netlify.toml` | 404 | 404 | ❌ **never was exposed** |
| `/` (control) | 200 | 200 | ✅ site still works |
| `/robots.txt` (control) | 200 | 200 | ✅ |
| `/no-such-page-xyz` (control) | 404 | 404 | ✅ 404s are real |

⚠️ **The controls earned their place twice.** The first attempt used a
branch-deploy URL that did not exist — every path returned 404 including the
homepage, which looks exactly like "the rules work" if you only check the three
paths you expect to be hidden.

⚠️ **TWO CLAIMS I REPEATED FROM THE REVIEW WERE WRONG, AND I HAD NOT MEASURED
EITHER.**

1. **`/netlify.toml` was never served.** 404 on production already. Its rule is
   redundant; kept as a cheap pin, but recorded as an error rather than
   quietly left looking like a fix.
2. **The head metadata was not ABSENT, it was in the BODY.** Measured:
   production serves `<title>` at line 14 and `og:title` at line 182 with
   `</head>` at line 7; the club form's `noindex` at line 19. All present in
   the served HTML, all below `</head>`, where head-only metadata is out of
   spec and unreliably honoured. The move to `<head>` is still correct — the
   preview puts them at lines 34/39 and 34, inside head — but I wrote "did not
   exist" and "arrived as a bare grey URL" in a commit message and a code
   comment without ever fetching the page. **I described a WEAK control as an
   ABSENT one, in a note criticising this repo for asserting unverified
   properties.**

✅ **Also measured live:** hero image 1,801 KB on production → **30 KB** on the
preview.

⚠️ **Still unmeasured on a deploy:** everything behind a login — revocation,
score storage, the rate limit. Those need a signed-in session on the preview
and have only been proven by the suite.

## 9 Aug 2026 — the sign-in dead end, found by Jay failing to sign in

Not from the review. **Jay could not sign in to the deploy preview because he
typed his email address**, and the answer was "Incorrect username or password."
with nowhere to go from there. The field is labelled USERNAME; that was not
enough, because a browser autofills an email into anything that looks like a
login and on the live site the password manager had been filling the username
for him.

**If the person who BUILT the site gets caught by this, a coach who signed up in
July will too — on tournament morning, at a pitch, with no one to ask.**

Fixed in the message and beside the field, both surfaces:
> Incorrect username or password. **Sign in with your username, not your email address.**

⚠️ **"Just accept the email too" was considered and rejected.** Only
Google-created accounts store an email at all (`google-auth.js`); password
accounts have none. Accepting emails would work for some managers and fail for
others with an identical message — worse than the current behaviour. One rule
true for everybody is the only kind worth printing.

⚠️ **The refusal still must not say WHICH half was wrong** — naming a valid
username confirms the account exists. Held by a fault.

⚠️ **`test-unified-login.js` had pinned the exact sentence**, so improving the
copy broke three checks. Rewritten to capture the refusal text ONCE and compare
every other refusal against that — the property is "one message for every
refusal", not any particular wording. The wording can now improve freely and the
day two refusals diverge, it still fails.

**Suite: 842/842 faults, 40 clean, 45 files.** Four new faults.

⚠️ **Also confirmed while diagnosing: Google sign-in cannot work on a deploy
preview.** `Error 400: origin_mismatch` — the preview host is not in the OAuth
client's authorised JavaScript origins, and should not be added permanently
because every PR gets a different host. Test Google on production only. Nothing
in this branch touches that path.

## 9 Aug 2026 — validate-not-coerce: the last four review findings (same branch)

Four bugs of one shape, all fixed. Durable detail in `RESTORE.md` →
"Validate on a write; coerce only on a read".

1. **A failed teams-sheet read minted a DUPLICATE team code** — two squads, one
   identity, in the draw and the standings and every match id. Now refuses.
2. **A single player registration had no server-side age check at all** — only
   the coach's bulk roster was checked. The parent path, which is the primary
   one, was unguarded.
3. **`scoring-rules.js` coerced malformed input into tries-only and answered
   200 ok**, silently zeroing conversions, penalties and drop goals for an age
   group while echoing the stored figures back as if intended.
4. **`mergeVenue` could produce a tournament day with no pitches**, because
   `normaliseSplits()` returns `{}` — truthy — and `||` cannot tell empty from
   absent. The write path had the right guard all along; the reader had its own
   broken copy. One shared `resolveSplits()` now.

**Suite: 850/850 faults, 41 clean, 46 files.** Eight new faults.

⚠️ **A PROVER FAULT HAD ITS PREMISE INVERTED, not merely moved.** Fault 260
asserted "a failed numbering read does not cost the registration" — the trade
that turned out to be backwards. Repointed at the half that still holds (the
refusal must be a clean 503, never an exception escaping `handleSubmission`)
with the inversion written down in place. Repoint never delete — **and say so
when the thing repointed was wrong rather than relocated.**

⚠️ **My own age-check test passed for the wrong reason first.** It used invented
field names, so the submission was refused at the required-field step and never
reached the age rule — it would have passed identically with no age check in the
code. Rewritten with the real field names from the spec, and with the in-age
CONTROL asserted *before* the refusal so a check that rejected everything cannot
look like a working gate.

## 9 Aug 2026 — housekeeping done; the review is fully closed

Durable detail in `RESTORE.md` → "Dependencies, the password ceiling, and the
scoring model".

- **`package-lock.json` committed** — 49 packages pinned. Netlify was
  re-resolving four caret ranges on every deploy. ⚠️ 404'd in the same commit
  that created it: the root IS the site.
- **`bcryptjs` 2.4.3 → ^3.0.2** (lock resolves 3.0.3). Verified against the real
  package: `require()` works, old `$2a$` hashes still verify, nobody is locked
  out.
- **Password ceiling at 72 BYTES**, because bcrypt silently discards everything
  past it. Measured: an 80-character password equals its first 72. Counted in
  bytes, not characters — one emoji is four, and on a UAE site that matters.
- **`test-scoring-model.js`** — the scoring model is carried twice and nothing
  asserted the copies agree. Same duplication that already broke the pitch model
  and the registration rules; this one decides what a match was won by.
- **Service worker** bounded to 60 entries, navigations and shell only, cache
  key dated. It was caching every asset forever and `adhjrt-v1` had never been
  bumped, so the escape hatch had never been exercised.
- **184 KB of dead JS deleted** after verifying nothing loads or reads it.

**Suite: 855/855 faults, 42 clean, 47 files.** Five new faults. The clean
baseline has gone **34 → 42** across this branch.

⚠️ **The review claimed the three dead JS files had "zero references". They did
not** — `support.js`, `deck-stage.js` and `image-slot.js` all mention them, and
so does `test-design-polish.js`. All the mentions turned out to be in COMMENTS,
so the deletion was right, but "grep found nothing" was not what the evidence
said and checking took four greps rather than one.

## ✅ 9 Aug 2026 — THE REVIEW BRANCH IS MERGED AND LIVE (`321e8fd`, PR #16)

Ten commits from `fix/review-aug-2026`. **Production deploy — 15 credits.**
Everything below was MEASURED on adhjrt.com after the merge, not inferred.

**No longer served** (all 404, having been 200 before the merge except where
noted): `/netlify/functions/_auth.js`, `/package.json`, `/package-lock.json`
(new file, 404 from birth), `/deck-stage.js`, `/image-slot.js`, `/doc-page.js`.

**Controls, all 200:** `/`, `/robots.txt`, `/scores`, `/app`, `/signin`,
`/rules`, `/legal`, `/register-club`. `/no-such-xyz` 404.

**Head metadata is in the real `<head>`:** `</head>` at line 48, `<title>` at
34, `og:title` at 39. `/register-club`'s robots tag at line 34, inside head —
the claim `netlify.toml` had been making for months is finally true.

**Hero image:** 30 KB avif served; the 1,801 KB PNG is still on disk as the
re-encode master and is named by nothing.

**The login endpoint survived the bcryptjs 2.4.3 → 3.x upgrade** — a fake
account gets a clean 401 with the new username/email hint, not a 500. All five
public function endpoints 200.

⚠️ **THE BUILD MARKER IS `sw.js`'s CACHE KEY, and use it rather than a 404.**
`adhjrt-v1` = old code, `adhjrt-2026-08-09` = this deploy. I first waited for
the preview by polling `/package-lock.json` for a 404 — which it returns on the
OLD build too, because the file did not exist there. The loop exited instantly
and everything after it measured the wrong build, reporting deleted files as
still served. **A missing file and a hidden file are indistinguishable; wait on
something that becomes PRESENT.**

⚠️ **STILL UNMEASURED ON PRODUCTION: everything behind a login.** Revocation,
per-match score storage and the rate limit have been proven by the suite and by
the preview's public surface, never by a signed-in session on adhjrt.com. The
revoke test is the one worth doing: sign in on a phone, revoke that account from
/organizer, refresh — it should be locked out immediately, where before it would
have kept working for up to six months.

## 9 Aug 2026 — the last two review findings (`fix/homepage-dates-and-google-tests`)

The two items I had wrongly reported as closed. Durable detail in `RESTORE.md`.

**1. The homepage no longer disagrees with the venue layout.** The countdown
target and the Saturday/Sunday split are now derived from the layout an
organiser can edit — the same `isDayOne()` `/app` and `/scores` use, so all
three agree by construction. No extra request: the layout was already being
fetched on that page for the pitch count. Everything falls back to the
written-down table if the fetch fails.

⚠️ **The JSON-LD dates stay hardcoded and MUST.** Structured data is read by
crawlers that do not run JavaScript. They are pinned to `DEFAULT_VENUE` by a
test instead — which catches drift from the default but **cannot** catch an
organiser changing the dates in the back office. If the tournament moves, the
JSON-LD needs a human edit; the check makes that hard to forget, it does not do
it for you.

**2. Google sign-in is now driven, not grepped.** `test-google-auth.js` had 34
of 40 checks as regexes over source and never called the handler — on the
highest-security surface in the repo.

**Suite: 864/864 faults, 44 clean, 49 files.** Nine new faults.

⚠️ **MY STUB COULD NOT EXPRESS THE VULNERABILITY IT WAS TESTING.** The first
version threw whenever the caller's `audience` was not our client id — so
injecting "stop pinning the audience" made every sign-in fail, and the check
that names that exact risk went on PASSING, because it expects null and got
null. Twenty-three unrelated checks caught the fault; the one guarding it did
not. What unpinning really does is remove the restriction, so a foreign token is
ACCEPTED. **A stub that cannot express the failure cannot test for it** — and
the prover's "failed, but not on any of" report is what surfaced it.

⚠️ **Two faults CRASHED the suite instead of failing a named check**, because
assertions read `r.session._role` on a response that had become `needsSignup`.
An explicit "a session came back at all" now precedes every session read.

## 10 Aug 2026 — repo tidy-up, and a rule I broke twice

**`dev` and `Compare` were fifteen commits behind `main`, and that is a rule
violation, not untidiness.** `CLAUDE.md` says *"`Compare` MUST NEVER BE LEFT
BEHIND `main` … after every land, fast-forward it in the same breath"*, and
explains why: a long-lived branch that lags is one somebody eventually treats as
current — how `club-manager-page` shipped a bypassable rate limit, 68 commits
behind. **I merged to `main` twice and fast-forwarded neither time.** Both are
now level; the rule's own check reads 0 for both.

**Two stale claims in `CLAUDE.md` corrected while reading that rule:**

1. **It asserted `Compare` is "password-gated with every other non-production
   deploy". It is not.** Measured 9 Aug via the Netlify MCP:
   `requiresPassword: false`, off everywhere including production. That was the
   **fifth** recording of this fact in these files and the fourth wrong one, in
   the very paragraph explaining why a public branch deploy was an exposure.
   The paragraph now **refuses to answer** and sends you to the MCP, exactly as
   this file's own ruling required.
2. **It carried a "State now: … ALL `5f55217`" line** — a `currently` in the
   file whose own precedence rule sends dates, counts and "currently" here
   instead. It said `5f55217` while `main` was twelve commits past it. Replaced
   with the two-line check that cannot go stale.

**Merged branches deleted:** `fix/review-aug-2026`,
`fix/homepage-dates-and-google-tests` — both fully in `main`, purpose served.
⚠️ **`dev` and `Compare` are NOT clutter and were not touched beyond the
fast-forward** — `Compare` is the standing preview branch, kept on purpose, and
deleting the pair has already caused trouble once (8 Aug).

## 11 Aug 2026 — the tournament moved to 14–15 November, and it is LIVE and verified

`4d63b37` (the move) and `54b3b02` (the spellings the first pass missed).
`main`, `dev` and `Compare` are all level at `54b3b02`; nothing is unpushed.
Reasoning is in the commit messages and is not repeated here — the two copies
that mattered were `mergeVenue()` reading the date out of the saved venue blob,
where production's real blob outranked the repo, and `_publish.js`
hand-computing the manager publish window as two UTC timestamps.

**Verified on adhjrt.com, with a control, not inferred from the repo:** the
homepage serves `SAT 14 &amp; SUN 15 NOVEMBER 2026` and the old
`SAT 7 &amp; SUN 8` string is **absent from the same page** — the pair is what
makes it a reading rather than a hopeful grep. `/app` carries the new hero, the
JSON-LD reads `2026-11-14`/`2026-11-15`, and the Netlify deploy
`6a7ae855…` is `ready` and current.

⚠️ **This clone (cafnet, `C:\Users\Jay\GitHub\adhjrt`) was 47 commits behind**
when the session opened, and its `main` 50 behind. Both fast-forwarded. The
rule in `CLAUDE.md` — check every clone on every machine, every session — paid
for itself again; a clone that is behind looks exactly like a clone that is
fine.

## 11 Aug 2026 — /app stopped polling from a pocket (on `dev`, NOT deployed)

The last of the nine August review findings, and the minor one. `/app` ran a
1-second clock and a 60-second API poll with **no `visibilitychange` gate
anywhere in the file**, so an installed PWA went on requesting fixtures and
standings every minute from a phone in a pocket, all weekend.

⚠️ **THE OBVIOUS FIX WOULD HAVE BEEN A REGRESSION, AND THAT IS THE WHOLE
DESIGN.** Gating the timers is the easy half. A gate with no catch-up leaves a
manager who unlocks their phone at a pitch reading a score up to a minute
stale — worse than the requests it saved. So the handler refreshes immediately
on return, and **four of the six injected faults are not the original bug at
all: they are the fix done badly**, which is the version somebody would
plausibly ship.

Two smaller calls, both with a fault behind them: the gate is **inside** each
callback rather than a start/stop on visibility (one missed `clearInterval`
leaves a second poll loop running, and nothing on screen looks wrong), and the
catch-up still honours `sheetOpen()` — a sheet can be open across a hide, and
refreshing under a half-typed score is exactly what the 60-second poll already
refuses to do.

**`tests/test-app-polling.js` DRIVES the shipped callbacks.** The three bodies
are cut out of `app.html` and executed against stubs, so the assertions are
about what gets **called**, not which words appear in the source — the lesson
from `test-google-auth.js`. ⚠️ **The extractor must strip comments first, and
that is load-bearing:** `app.html`'s own comment above the timers contains the
words `setInterval` and `clearInterval`, explaining why it does not use them.
**Tenth time in this repo that prose mentioning a string was indistinguishable
from the string.**

**Suite: 884/884 faults, 45 clean, 50 files.** Six new faults. ⚠️ The clean
baseline went **44 → 45**, which is the proof this is a new FILE that ran
undamaged rather than checks added to an existing one.

✅ **LIVE** — merged in `807e0e1` and verified on production; see the deploy
record below.

## 11 Aug 2026 — revoking somebody now visibly works (on `dev`, NOT deployed)

**Jay ran the revoke test on production — the check this page had called the
single most valuable remaining one — and it found two defects.** Spec, with the
arguments against each choice: `claude/specs/spec-session-refusal-aug-2026.md`.
Do not re-derive it.

⚠️ **THE LOCK WAS NEVER BROKEN, AND THE FIRST DIAGNOSIS FROM THE SYMPTOM WOULD
HAVE BEEN WRONG.** "I revoked the account and still got in" reads as a broken
revocation. Driving the real `my-account.js` against the real `_auth.js` with a
passing CONTROL showed every state refusing: revoked 403, cut-off 401, deleted
401, approved 200. What was broken was that **nothing turned a refusal into a
signed-out state** — `logout()` was called by the Sign out button and nothing
else, and `currentSession()` returns a session whenever a token STRING is in
localStorage. The dashboard drew from browser storage while every request
behind it was turned away. Jay's account had been **deleted outright** by the
end and the page still rendered, fifteen refreshes running.

⚠️ **THE MARKER EXISTS BECAUSE STATUS CODES CANNOT ANSWER THIS.** Measured, on
the same endpoint: a manager touching an organiser-only feature gets **403 and
must stay signed in**; a revoked manager gets **403 and must not**. A store
outage gets 503 and must never sign anyone out — fifteen managers at a pitch
over a blob blip is worse than the bug. So `resolveSession` sets
`sessionEnded`, the browser reads that and nothing else, and **half the
injected faults make the code sign people out MORE**, because "it signs out on
a refusal" passes against code that signs out on everything.

**One shared `sessionRefusal()` builder**, because the ten endpoints hand-rolled
the response in nine idioms and a missed copy fails silently — that endpoint
alone never signs anybody out. ⚠️ `/app` deliberately does NOT navigate to
`/signin`: it is the match-day PWA with its own sheet, and its sign-out cleanup
is now one `dropToPublic()` shared by both routes rather than a second copy
that could forget a line.

**Defect 2, and the worse one.** `revoke` set `approved = false`, which is also
what the pending queue means — so a revoked person appeared among new signups
under **Approve** (silently reinstates them) and **Reject** (deletes the record
outright, with no confirmation of any kind). **Jay pressed the delete by
accident**, describing it as dismissing a stray row, which is exactly how it
reads there. Now `revokedAt` is its own field, revoked accounts have their own
section with *Restore access* and *Delete for good*, and the delete asks first
and names the person. ⚠️ Restoring does NOT clear `sessionsValidFrom` — the old
tokens stay dead.

**Suite: 900/900 faults, 46 clean, 51 files.** Sixteen new faults. ⚠️ The clean
baseline went **44 → 46**, one for each new FILE, which is the proof both ran
undamaged.

⚠️ **SIX PRE-EXISTING FAULTS REPORTED `COULD NOT INJECT`** — three quoting the
refusal lines that moved into the shared builder, three quoting the `/app`
sign-out branch, which survived intact but changed INDENTATION when it moved
into a function. All six repointed, none deleted. **A fault that cannot be
injected is a failed run, not a pass**, and this is the third branch running
where that mechanism has earned its keep.

⚠️ **An existing check caught a new button.** `test-documents.js` requires every
user-facing "Delete" on `/organizer` to be the irreversible one; the new control
was labelled "Delete permanently". The rule is right, so the button was renamed
to match the house phrase rather than the rule widened to admit it.

✅ **LIVE** — merged in `807e0e1`; see the deploy record directly below.

## ✅ 11 Aug 2026 — deployed and MEASURED on adhjrt.com (`807e0e1`)

**Two commits, ONE 15-credit production deploy.** `main`, `dev` and `Compare`
are all level; `Compare` was fast-forwarded in the same breath as the merge,
which is the rule that stops it becoming the next `club-manager-page`.
Gate before merging: `runall.ps1` **All green**, 900/900 faults, 46 clean,
52 headers, exit 0. Deploy `6a7ae855…` → **`6a7b08fe…`**, `ready`.

⚠️ **THE VERIFICATION THAT ACTUALLY PROVES SOMETHING IS THE BEHAVIOURAL ONE,
AND IT NEEDS NO CREDENTIALS.** A made-up bearer token against the live
`my-account` endpoint returns:

    401  {"ok":false,"error":"Not signed in.","sessionEnded":true}

That is the new marker doing its job on production, not a string found in a
file. **Anyone can re-run it**, and it costs nothing:

    curl -H "Authorization: Bearer nonsense" https://adhjrt.com/.netlify/functions/my-account

**Waited on something that becomes PRESENT, not on a 404.** `noteSessionEnded`
was measured **absent (0)** in `adhjrt.com/scores-data.js` before the merge with
`migrateSession` **present (2)** in the same file as the control, then appeared
within ~20s. The 9 Aug lesson — a missing file and a hidden file are
indistinguishable — applied deliberately.

Also live: the `visibilitychange` gate and `dropToPublic()` in `/app`, the
signed-out line on `/signin`, and the Revoked section with *Restore access* and
*Delete for good* on `/organizer`. Nine pages answer 200, a nonexistent path
404s, and both public functions still answer 200.

⚠️ **ONE MEASUREMENT OF MINE READ ZERO AND WAS WRONG.** Grepping
`adhjrt.com/Signin.dc.html` reported the new code missing — the raw filename
**301s** to the pretty URL, so the grep read a redirect body. At `/signin` it is
present. **Fetch the URL the page is SERVED at, not the file it is built from**,
and treat a zero from a path you have not status-checked as unmeasured rather
than as absent.

## ⚠️ 11 Aug 2026 — the sign-out fix SHIPPED WITHOUT THE HALF THAT MAKES IT FIRE

**It was deployed, verified, reported done — and Jay reloaded the page and was
still in.** He was right and the verification was not wrong, which is the
uncomfortable part: everything it measured was true.

**The cause.** `noteSessionEnded()` signs somebody out when a request is
REFUSED. **`/manager` makes no request that can be refused while it boots.**
Measured: `scoring-rules` GET has **no auth at all**, and `venue-layout` GET
and the draw are **optional-session**, which by design answers a dead token as
the PUBLIC rather than refusing it. So both calls succeeded exactly as they
would for an anonymous visitor, and the dead token was never questioned. A
revoked login rendered the whole dashboard until the person happened to open
**My account** — which is a strict call, and is precisely why that was the one
thing telling Jay the truth all along.

⚠️ **A MECHANISM VERIFIED IN ISOLATION IS NOT A MECHANISM THAT RUNS.** Every
check written for the fix was about whether the rule behaves correctly *when
handed a refusal*. Not one asked whether the page ever GETS one. The live
verification had the same shape — a bogus token against the endpoint proves the
server marks the refusal, and says nothing about whether the dashboard ever
asks. **Both instruments agreed with the intention. Neither touched the gap.**

⚠️ **AND THE FIRST GREP FOR IT READ 2 AND MEANT NOTHING.** Checking whether
`/manager` called `myAccount` at boot, a plain count over the page returned 2 —
a comment and the My account card's own handler. It nearly went into a report
as evidence the boot check existed. **Count where a call happens, not whether
its name appears.**

**The fix:** `verifySession()` in `scores-data.js`, re-exported by
`organizer-data.js`, called once at boot by `/manager`, `/organizer` and
`/app`. It asks **only when a token exists** (otherwise it is an authenticated
request on every public page load), swallows everything (it runs during boot; a
throw takes the page with it), and **cannot lock anybody out** — signing out
still happens only on the `sessionEnded` marker, so a 503 or a dead network
leaves the session exactly where it was.

⚠️ **An eighth pre-existing anchor rotted** — `test-my-account.js` pinned
organizer-data's export list character for character. Repointed to require the
property (re-exported AND not locally defined) rather than the literal list,
which is the second time today that repointing made a check stronger than the
version that broke.

## 11 Aug 2026 — the share card said the wrong dates, and the supporters grid went all-dark

**Two things a text sweep could not see.**

### The og:image card was a PICTURE of the old dates

`assets/share-card.png` still read **SAT 7 & SUN 8 NOV** after the tournament
moved. The cross-page day-number sweep added the same morning found every other
spelling and could not read this one, because it reads text and the card is
pixels. **Every link shared on WhatsApp, Facebook, LinkedIn or Slack previewed
the wrong dates**, on a site that spreads mainly by parents forwarding links —
and this page had literally predicted it: *"If the tournament dates ever change,
`assets/share-card.png` carries them and must be re-rendered."* **A note telling
a human to remember something is not a mechanism.**

`tools/make-share-card.py` renders it, and **reads the dates out of
`_venue.js`** rather than having them typed — weekday and month computed too, so
a move to a different weekend cannot leave "SAT"/"SUN" lying. It refuses if it
cannot parse them. The wordmark nit went with it: the card said "AD HARLEQUINS"
where the brand rule says "ABU DHABI HARLEQUINS".

### Eighteen supporters, one dark ground (Jay's call)

Jay supplied dark-mode AND light-mode artwork for all eighteen, and chose
all-dark over keeping the checkerboard with the new files. **That removes three
fragilities the old design carried**: a nineteenth sponsor broke the
alternation; the light/dark flag had to be MEASURED rather than chosen; and
three logos could never take a white tile at all. Adding a sponsor is now one
row and one file. `tools/make-sponsor-logos.py` does the processing.

⚠️ **TOMBSTONED IN THE CODE AND THE TESTS, because the checkerboard was Jay's
own request on 5 Aug.** Without a note saying why it went, someone restores it.

⚠️ **A CONTACT SHEET STOPPED THIS SHIPPING BROKEN, AND EVERY NUMBER LOOKED
FINE.** "Dark Mode" in the pack means DESIGNED FOR DARK, not transparent: six
files carry an opaque black rectangle and would have rendered as visible
off-black boxes on the tiles. BEOND's ground is mid-GREY, so the first keying
left it semi-transparent and it still showed a box. And **Arabian Swim
Academy's two files are byte-identical and both sit on white** — it is excluded
entirely and keeps its original asset. **Ratios and file sizes were plausible
for all of it. Only looking caught it.**

⚠️ **THE PROVER REJECTED THIS CHANGE THREE TIMES, EACH FOR A DIFFERENT REAL
REASON**, while all 51 test files were green:

1. **I silently weakened a check.** Repointing "the widest mark is sized down"
   also re-anchored the SQUAREST-marks check on the widest mark — so shrinking
   a square logo from 68 to 35 still cleared 27 and passed. The claim is
   `widest < mid-pack < squarest`; the middle term has to be a middle mark.
2. **A tombstone became a decoy.** My Bili Boys tombstone QUOTES the retired
   wording, so the fault anchored on that string patched the tombstone and
   proved nothing. Same trap as 8 Aug, from the other side.
3. **A check's NAME is part of its contract.** Renaming "Crompton leads the
   list" to "Crompton STILL leads…" broke the prover's phrase match: the fault
   failed on a different check and reported `caught, WRONG CHECK`.

⚠️ **AND `git checkout -- assets/` SILENTLY REVERTED THE SHARE CARD.** Restoring
the sponsor logos after the first bad render took the card with it, because it
lives in the same folder. Caught only by reading `git status` before committing
and noticing the file that started all this was absent. **A restore is as wide
as the path you give it.**

**Suite: 906/906 faults, 46 clean, 52 headers, `All green`.**

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
| The supporters grid | **LIVE, 5 Aug** — 16 sponsors, every logo linked. Sportsman's Arms and The Bottle Store came off 3 Sep 2026; Brighton College Abu Dhabi was already on the list and stays. |
| **The header nav** | **LIVE (`24fb84c`)** — holo pill + underline on hover, current section underlined, bar condenses past 90px of scroll. ⚠️ `data-sec` and `.hdr-tight` live on `<html>`; never move them onto the header. ⚠️ The nav's width is now load-bearing — pill padding and gap are pinned by tests because widening them overflows the sticky bar. |
| **`/rules`** | **LIVE (`24fb84c`), button themed and centred (`f24ae0d`)** — placeholder page. ⚠️ **Jay owes the actual rules;** the block to replace is marked in `rules.html` and nothing else on that page needs touching. ⚠️ The button's `width:fit-content` wrapper is load-bearing — see `f24ae0d` above. |
| **The About section** | **LIVE, 6 Aug.** A **coverflow carousel** — six cards recycling eleven photos, auto-advancing every 6s, no drag and no keys. ⚠️ **The box bleeds past its grid column to the right edge of the page**, which is what buys the width without shrinking the 66px heading; `100vw` counts the scrollbar and the centred section does not, so it subtracts `--sbw`. ⚠️ **The crest and flying bat are back** — badge is the HOLED `crest-shield.png` and it stands or falls with the bat. ⚠️ **Hidden below 760px and the photos are not fetched there.** ⚠️ `prefers-reduced-motion` does NOT stop the timer — with no controls there is nothing to press. Phone walkthrough still **pending**. |
| HSBC | ⚠️ **FIVE placements on the homepage since 8 Aug, not three** — 19 / 128 / auto / **150** / 18px — plus **three** in `/app`. ⚠️ The sponsors-section mark went 96 → **150px** on 11 Aug at Jay's request, and **150 is the CEILING** the 560px card allows at the lockup's 3.71:1 ratio; above it `max-width:100%` clamps it straight back and the change appears not to have worked. The rendered size is the CSS rule, NOT the inline tag, which still reads 96px as the no-CSS fallback and has a fault pinned to that literal. Never more than two visible at once; the pairings share breakpoint numbers (800 and 900 on the homepage, 359 in the app) and both are asserted. Full table in `RESTORE.md` § HSBC. Phone walkthrough **still pending**. |
| **Phone layout** | **ALL of it is LIVE (8 Aug): homepage, registration modals, `/rules`, `/app`, `/manager`, `/organizer` and `/signin`.** Only `Scores & Standings.dc.html` still has zero media queries, deliberately — Jay's call 8 Aug: `/app` is the match-day phone answer. ⚠️ `/signin` was recorded here and in `RESTORE.md` as "2/2 inputs under 16px"; **measured, it is SIX, all at 15px.** One rule covers them and a test now pins the count. ✅ All three back-office blocks are **measured in a RENDERED page** by `tools/render-audit.js`, with a desktop width as the control — table in `RESTORE.md` § Phone layout, along with the counts and the three traps. |
| The real draw | **still placeholder clubs** in all 15 groups. Pitches and kick-off times are real; the pools wait on real registrations. Everything else waits on this. |
| Results nav link | still an in-page `#results` jump — change to `/scores` only once the draw is real |
| Tests | **39 files green; 792/792 faults caught; 34 suites clean undamaged; 40 `--- ` headers** — the fault count moved 773 → 786 with the `/organizer` and `/signin` phone work and → 792 with the two defects the code review found, and the clean baseline **stayed at 34, which is the proof those checks EXTENDED `test-design-polish.js` rather than arriving in a new file.** The 773/34/40 figures were measured twice at `7c78a16`, in the cloud sandbox on plain Node **and** by `powershell tests/runall.ps1` on jay-pc, which agreed exactly. ⚠️ The header count was first read as **0** by a poll using `Select-String -SimpleMatch '^--- '`, which treats the regex literally — the trap already in `claude/lessons.md`, hit again. Re-read without it: 40, with a deliberately-unmatchable control returning 0. ⚠️ 12 stderr lines in that run are the prover's own injected faults (`verify is not defined` and friends), read rather than counted. ⚠️ The fault count went 719 → … → 759 → **773** across 8 Aug as each change added its own; **the number in prose is worth nothing — trust the runner's own output.** This row has previously been wrong as 37/653/32 while `CLAUDE.md` said 38/672/33 and `tests/README.md` said 36/630/31. ⚠️ **The baseline `M` going UP is the only proof a new suite ran undamaged, and it staying PUT is the proof an existing one was extended.** It moved 33 → **34** because `tests/test-draft-visibility.js` is a new FILE; it was added to `runall.ps1` in the same commit. |

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
green, never merged); the Junior Manager's account (name redacted) is dropped.

⚠️ **THE "DO NOT RAISE THE DOCUMENTS FEATURE" INSTRUCTION IS GONE — IT WAS
WRONG (corrected 11 Aug 2026).** It said *"parked by Jay the same day … no code
written"*, which was true on 5 Aug and false from 7 Aug, when Documents shipped
in five commits (`c3fc11c` … `26dd9d2`). The same wrong sentence sat in
`CLAUDE.md`. **A standing instruction not to discuss something is exactly the
kind of note that never gets re-read when the thing changes** — it works by
stopping the conversation that would have corrected it.

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
