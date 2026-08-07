# PR #11 — MERGED AND LIVE

_Last updated 26 July 2026._

**Merged to `main` on 26 July 2026 and deployed to production.** `main` fast-forwarded
`1d067c8 → 6a16a8e`, so all 15 commits are on `main` with no merge commit. 13 files,
+3,012 / −181. Cost 15 Netlify credits.

Verified against **production**, not the preview, after the deploy finished:

| Check | Result |
|---|---|
| `venue-layout` endpoint live | yes — 18 Saturday pitches, 10 Sunday |
| Public day split | U18B/U18G **Saturday**, U12G **Sunday** — the fix is live |
| Homepage day headings | "Day 01 Saturday 7 Nov — Mini, Midi & Colts, U6–U12 plus U18 boys & girls" / "Day 02 Sunday 8 Nov" |
| Squad caps, all 15 groups | 7s 12 · 10s 15 · 12s 18, exactly the table below |
| `MAX_TEAM_PLAYERS` | gone from the served page |
| Results still readable after the storage split | **415 of 415** — the new per-age-group reader still merges the legacy `all` blob, so nothing was lost |

**What the merge unblocked:** the results clear (step 2 of the cleanup runbook) is now
safe to run, because production finally has write-and-verify behind each save. The
**Clear the rehearsal data** card is live on `/organizer`.

**What it did not fix, and what happened next:** the pitch-count wording. The homepage
rendered a `statPitches` stat hardcoded to 16 against real counts of 18 and 10. That was
Step 5 of the pitch work, and it is now **PR #12** — see the section at the bottom.

**Obsolete now:** the old "after merging, Save changes → Republish per age group to get
club names onto the public site" note. The sheets are empty and all 15 draws were reset
on 26 July, so there are no club names to republish and nothing is published.

## Commits

| | |
|---|---|
| `67063b3` | Imported team names never persisted (`saveDraw()`'s allow-list dropped `teamNames`); U6/U7 accepted scores via a direct API call |
| `b2da6bb` | Results split one blob per age group — two managers in different groups could previously delete each other's scores |
| `5ed16b5` | Knockout ids are stable, so regenerating a bracket left the old score on a slot now holding different teams |
| `c7f895f` | **Write-and-verify** on save (409 + visible error rather than a false OK); **COIN TOSS badge** fixed; `CLAUDE.md` Results storage section |
| `06c6859` | **`teamNames` rebuilt from registrations on every save**; **a failed registration no longer reports success** |
| `549f83e` | Merge `main` — picks up the `/legal` page |
| `4cd59d2` | **Date of birth as day / month name / year**, echoed back in words |
| `2b8fd97` | **Homepage works on a phone** — removed the `min-width:1200px` floor |
| `73df4d0` | **Mobile nav collapses behind a button**; hero shards and duplicate names hidden on mobile; `validate-bindings.js` added |
| `bf1f88b` | **Squad cap is per age group, not a flat 15** — `format` and `squad` on all 15 groups; `MAX_TEAM_PLAYERS` gone |
| `77cd0c1` | **Venue layout** — each group's day derived from its pitches; **U12G moved to Sunday, U18B/U18G to Saturday** on the public site |
| `c7989df` | **Venue & days tab** in `/organizer` — organisers can change the pitch names, the day split and each group's pitches without a deploy |
| `9cc0d31` | **A pool is a pitch's day** — one pitch box and one first-kick-off box per pool in the Fixture Editor; the free-text pitch list is gone |
| `077e68c` | **Check the whole weekend** — finds two age groups on one pitch at one time; publishing warns but never blocks |
| `6a16a8e` | **Clear the rehearsal data** — organiser-only, off on match days, typed confirmations; results and saved draws only, never the sheets |

## Verified against the live preview, not just unit-tested

- **Score save** — toast read `Score saved: 10–10.` and the row `Saved ✓ 10–10 · 12:28:25`, both figures off the server's reply after it read the write back.
- **teamNames** — U8 draft had none; one press of **Save changes** (no re-import) gave 17 names for 17 codes, zero unresolved. Across all 15 groups, **255 of 255** pool codes resolve.
- **Coin toss** — recomputed U8 Pool A from raw results: all six matches 10–10, so every team identical on points, margin, PF, PA, tries *and* head-to-head. All four badged is correct.
- **Mobile homepage** at 657px: overflow **558px → 0**, nav **9/9** links on screen, App and both Register buttons reachable, registration modal **600px = 91% of screen**. Confirmed on Jay's actual handset too.
- **DOB dropdowns** — Day 31 / Month 12 as names / Year 19 (2022→2004). `7 November 2015` and `11 July 2015` read completely differently and give different ages. `31 February` clears the confirmation, shows "That date doesn't exist", and empties the stored value so the form won't submit.
- **Nav toggle** — `data-nav-open` goes `false → true` on tap (glyph ☰ → ✕, `aria-expanded` and label follow) and **back to `false` when any nav link is tapped**, so the panel closes on navigation. All nine mobile rules confirmed present in the 760px block.
- **Desktop unaffected** at 1469px and 1909px: media query inactive, toggle `display:none`, header 73px (6% of screen), nav visible, shards and hero names visible, zero overflow. ⚠️ *"wrapper exactly 1200px" was recorded here as a pass. It was the bug — see PR #13 at the bottom. Measuring that the cap was applied is not the same as asking whether the cap should exist.*

## All five browser checks — DONE on production, 26 July

Walked on `adhjrt.com` after the merge, not on the preview.

1. **Squad cap** — all 15 caps correct in the served page; `MAX_TEAM_PLAYERS` gone.
2. **Day split** — U18B/U18G Saturday, U12G Sunday, on the homepage and in the layout.
3. **Venue & days tab** — fourth tab loads: "Saturday 7 November · 18 pitches · 9 age
   groups · 2026-11-07" and "Sunday 8 November · 10 pitches · 6 age groups · 2026-11-08",
   every pitch chip present, one Sat/Sun selector per group. The server gate was tested
   live by POSTing a layout with U11 on both days: **400, "U11 is on both days — pick
   one."**, and the stored layout was unchanged afterwards. `?usage=1` returns the pitch
   counts for an organiser and **omits them for an anonymous caller**.
4. **Pool pitch and first kick-off** — U8's Pitch box offers exactly `TBD, B1A, B1B,
   B1C, B1D` (its own four and nothing else). Setting U6's Festival Pool to `D4A`
   cascaded to all 18 match slots, cleared the "parents will see TBD" warning, and the
   pitch panel updated live to `D4A — Festival Pool 8:00 AM–2:00 PM`. The panel is
   in-group only, as designed: U7's panel showed D4A as free while U6 was on it.
5. **Whole-weekend check** — with nothing placed: *"No pitch clashes, 0 pools and
   knockout matches placed across 15 age groups"* plus the still-to-place list, grouped
   per age group, U6/U7 as "Festival Pool" and U16B/U16G showing their double brackets.
   Then U6 **and** U7 were both saved onto D4A at 08:00 and it reported:

   > 1 pitch clash across the weekend.
   > Pitch D4A · Saturday 7 November — U7 Tag Festival Pool (8:00 AM – 2:00 PM) overlaps
   > U6 Tag Festival Pool (8:00 AM – 2:00 PM)

   Pressing **Publish fixtures** on U7 then showed *"1 pitch clash involving U7"*, the
   clash line, and a **Publish anyway** button next to Cancel. Cancelled — nothing was
   published. Both test drafts were reset afterwards and production re-swept: **0 drafts,
   0 published, 0 results**.

**One finding, cosmetic — since fixed.** Changing an age group's day in the Venue & days
tab used a native browser `confirm()`, which looked out of place and froze the page to
anything driving the browser. Replaced with the site's own dialog in `7bfdf45`; see the
PR #12 section at the bottom.

## The squad cap, in one place (`bf1f88b`)

The form capped every roster at 15. Wrong in both directions: 7s groups have a
squad of **12**, so clubs could enter three too many; 12s groups have a squad of
**18**, so the Add button stopped three players **short** of a legal squad, with
registration already open.

| Format | Squad | Groups |
|---|---|---|
| 7s | 12 | u6, u7, u8, u9, **and all four girls' groups** — u12g, u14g, u16g, u18g |
| 10s | 15 | u10, u13 |
| 12s | 18 | u11, u12, u14b, u16b, u18b |

`squad` is treated as a **maximum**. Before an age group is picked the cap is
`MAX_SQUAD_ANY_GROUP` (18) so filling the roster first is never blocked; it
tightens on selection. `submitTeam` refuses an over-cap roster naming the group,
its cap and how many to remove. A line under AGE GROUP ENTERING states the
format and squad size. The table above also lives in `CLAUDE.md` with a warning
not to reintroduce a single cap.

## The venue layout (`77cd0c1`) — Step 1 of the pitch work

The public site had **U12G on Saturday and U18B/U18G on Sunday. Both are the
opposite of the 2025 pitch map**, with registration open. The cause was the same
fact written down twice and maintained in neither: `SATURDAY` in `app.html`, and
`AGE_GROUP_CARDS[].day` on the homepage.

The day is now **derived from where an age group has pitches**, so the day and the
pitch allocation cannot contradict each other.

| | Pitches | Groups |
|---|---|---|
| **Saturday** | 18 — D5A/B, D4A/B, D3A/B, D2, D1, C4, C5, B1A–D, A1A–D | u6, u7, u8, u9, u10, u11, u12, u18b, u18g |
| **Sunday** | 10 — D3, D2, D1, C4A/B, C5, B1A/B, A1A/B | u12g, u13, u14b, u14g, u16b, u16g |

- `netlify/functions/_venue.js` — `DEFAULT_VENUE`, `loadVenue()`, `mergeVenue()`.
- `netlify/functions/venue-layout.js` — public GET, same shape as
  `scoring-rules.js`. (Step 2 added the write path — see below.)
- `scores-data.js` — the same table plus `loadVenue()` and the synchronous readers
  `venue()`, `dayIdOfAgeGroup()`, `dayOfAgeGroup()`, `isDayOne()`,
  `dayLabelOfAgeGroup()`, `pitchesForAgeGroup()`, `pitchesOnDayOf()`.
- The layout exists **three** times — server, front end (offline fallback), and the
  homepage cards (no build step, no import). `test-venue.js` compares all three,
  proven against three deliberately injected errors.
- The two homepage day headings described the old split and are now "Mini, Midi &
  Colts / U6–U12 plus U18 boys & girls" and "Youth & Girls / U12 Girls, U13–U16".
  **That wording is Claude's — Jay should change it freely.**
- D4/D5 are time-shared on Saturday (U5/6 am → U7 pm), so `u6` and `u7` hold the
  *same four* pitches. No special case needed; it is two pools on one pitch at
  different times.

## The Venue & days tab (`c7989df`) — Step 2

Fourth tab in `/organizer`. **Organisers only**, re-checked server-side with a 403
that explains why: the day split and the pitch allocation affect every age group.

- Two day cards with their pitch lists. Add by name; remove with a confirm that
  first says **how many saved matches are on that pitch** and which groups have it
  ticked. Removing also unticks it everywhere on that day.
- One row per age group: a Sat/Sun selector plus tick boxes for its pitches.
  Changing the day **clears the pitch assignment** after a confirm naming what goes
  — the two days have different pitch lists, and silently keeping names that exist
  on both (`B1A`, `D2`, `D1`) would put a group on a pitch nobody chose for it.
- Save is disabled until something changes, and disabled with the reasons listed
  while the layout is invalid. **Reset to 2025 layout deletes the override** rather
  than writing the defaults back, so a future change to `DEFAULT_VENUE` reaches a
  reset site instead of being masked by a stale copy of the old defaults.

**Hard errors** (`validateVenue()` in `_venue.js`), each one invisible until match
day: a group on **both** days (`dayIdOf()` silently picks day1), on **neither** day
(no date, so the countdown does arithmetic on nothing), a pitch **not on that day**,
and two pitch names differing only by **case** (the clash check could not tell them
apart). It also trims, drops blanks, and canonicalises a group's pitch names to the
day's spelling.

**Deliberately allowed**, both surfaced as warnings: a group with an **empty** pitch
list (which day and which pitches are separate decisions), and **two groups on one
pitch** — D4/D5 is a time-share, and telling those apart by time is Step 4.

The same rules run client-side so Save can be disabled *with the reason shown*
rather than bouncing off a 400. The server stays the authority, and
`test-venue-panel.js` drives **both** and asserts they agree — if they diverge,
either Save goes green on something the server will reject, or it fails silently.

`GET /venue-layout?usage=1` (organisers only) returns the per-pitch fixture counts
behind the removal warning. `countPitchUsage()` reads the **draft** first and falls
back to the published copy, because the draft is what a change here would break.
It lives in `_venue.js` rather than the endpoint so it can be tested against a fake
store without pulling in bcrypt and `@netlify/blobs`.

The panel tests were proven against three injected faults: `setGroupDay` leaving a
group on both days, `removePitch` leaving the pitch ticked, and the server validator
no longer refusing a both-days layout.

## A pool is a pitch's day (`9cc0d31`) — Step 3

A pool is already a run of matches 20 minutes apart, which is what one pitch does
for a stretch of the day. So the editor sets the pitch and the first kick-off
**once per pool** — about 40 across the weekend instead of ~430 slots.

**Nothing new is stored.** Both values are **derived from the slots**, and setting
one rewrites them. The spec said to put `pitch` and `startMins` on the pool;
deriving them is behaviourally identical and strictly safer:

- the public fixtures page, standings and app keep reading `slot.pitch` and
  `slot.startMins` — **no reader changed**;
- `saveDraw()`'s allow-list needs no new field (the trap that lost `teamNames`);
- an old saved draw needs **no migration**;
- the pool header can never disagree with the fixtures under it.

`poolPitchOf()` → the single shared pitch, `'TBD'`, or `''` for **Mixed**.
`poolStartOf()` → the earliest match, `null` for an empty pool.
`slotLengthMins()`, `dayStartMins()` and `poolEndMins()` are exported from
`scores-data.js` so the editor's arithmetic can't drift from the generator's.

- Changing the pitch overwrites per-match overrides **after a confirm**. Changing
  the start re-times the run **in the order it is already in**.
- Moving a pool onto a busy pitch **offers** to shift it to the first free time —
  an offer, not a rule; being locked out on match morning is worse than a clash.
- **Two pools on one pitch at different times is a time-share, not a clash** (D4/D5
  ran U6 then U7). Touching exactly — one ends 10:00, the next starts 10:00 — is fine.
- `+ Add match slot` inherits the pool's pitch and continues its run; it used to
  default to `'TBD'`, quietly creating an unplaced fixture.
- `Regenerate from pool` keeps the pool's pitch and start; it rebuilds every slot on
  `'TBD'` at 08:00, so before this a regenerate silently unplaced a pool.

**The free-text pitch list is gone.** Every age group used to type its own names
into `draw.pitches`, so `C4`, `Pitch C4` and `c4` were three different pitches to
anything checking for clashes. The panel is read-only now: the group's pitches from
the layout, which pools are on each and when (an **in-group** clash check), and a
pointer to Venue & days. `draw.pitches` is still *read*, flagged as not in the layout.

**`test-pool-pitch.js` exists because `validate-bindings.js` cannot see any of
this.** Every new binding is `{{ pool.something }}` inside an `sc-for`, so its root
is the loop variable and the validator skips it by design. This test pulls the
`{{ pool.X }}` tokens out of the markup — scoped to the editor's loop, since the
public section has its own loop also named `pool` — and asserts the pool card
objects carry them, then drives the handlers against the **real** data layer.
Proven against four injected faults, including a renamed binding.

## Check the whole weekend (`077e68c`) — Step 4

`weekendClashes(drawsByAge, ageNames)` in `scores-data.js` — **pure and
synchronous**: no fetching, no session, no clock, so it can be tested exhaustively.
`loadAllDraws(session)` fetches; `describeClash(c)` writes the sentence.

Draws become **bookings**, of two kinds because there are two kinds of fixture: a
**pool** is one booking covering its run, each **knockout match** is a booking of its
own. Two bookings clash on the same **day**, same **pitch**, with **overlapping**
`[start, end)`.

**Deliberately not clashes** (each one a test):

| | Why |
|---|---|
| `TBD` or blank | unscheduled is not conflicting; listed separately as still-to-place |
| same pitch, **different times** | a **time-share** — how D4/D5 ran U5/6 then U7. Crying wolf here means the check gets ignored. |
| same pitch **name, different days** | `D1`, `D2`, `B1A`, `A1A` exist on both days and are unrelated fields |
| **touching exactly** — 10:00 end, 10:00 start | half-open ranges |

**Three ways a booking could have escaped**, all closed and tested: a **per-match
override** (a pool with one match moved by hand is booked once per pitch — booked as
one, the moved match would be invisible); **knockout matches** (own pitch and time,
not in a pool — a Cup Final on someone else's pitch is real); **case and spacing**
(`' c4 '` = `'C4'`).

Two soft warnings ride along: `unplaced` (grouped per age group, so fifteen empty
groups aren't forty lines) and `offAllocation`.

**What it can see depends on who asks, and the panel says so** — an organiser reads
every group's **draft**, a manager reads their own draft plus everyone else's
**published** draw. Two managers on unsaved drafts can't see each other; the UI states
that rather than implying the check is exhaustive. A group that fails to read is named.

**Publishing warns, never blocks.** The check runs first, any clash involving that
group is listed in the confirm, and the button reads **Publish anyway**. If the check
itself fails, publishing is still offered — a validator that cannot run must not
become a validator that says no.

`isOrganizerSession()` is now **exported** and the component uses it instead of its
own copy of the three-shape session test.

**Five injected faults proved the tests** — an off-by-one boundary reporting a clean
time-share as a clash, the day dropped from the pitch key (Saturday D2 vs Sunday D2),
knockout matches not booked, a split pool booked as one, and the publish confirm
reverting to "OK". That last one also **caught a weak test of mine**: `/Publish
anyway/` matched a comment, so it passed with the code gutted. It now matches the
option itself.

## Tests — 495 checks plus two validators (`C:\Users\jayjm\adhjrt-sim`)

`test-results-store.js` 16 · `test-teamcodes.js` 10 · `test-cointoss.js` 7 ·
`test-writeverify.js` 12 · `test-teamnames.js` 22 · `test-dob.js` 24 ·
`test-squad.js` 45 · `test-venue.js` 87 · `test-venue-panel.js` 76 ·
`test-pool-pitch.js` 77 · `test-clash-check.js` 57 · `test-cleanup.js` 62

`runall.ps1` runs the lot against the PC checkout and exits non-zero on any failure.

- `validate.js` — every inline script parses; `sc-if` 37/37, `sc-for` 21/21.
- `validate-bindings.js` — every `{{ token }}` resolves to an identifier in the
  component script (121 / 188 / 124 across the three files). **It cannot see
  `{{ loopVar.x }}` bindings at all** — that gap is what `test-pool-pitch.js` covers. Guards the trap
  `CLAUDE.md` documents: a binding missing from `renderVals` resolves silently to
  empty. Proven against a deliberately injected typo; its limits are stated at
  the top of the file (it does not prove the binding is returned from the *right*
  scope).
- `runall.ps1` in the same folder runs the lot against the PC checkout and exits
  non-zero if anything fails.

## Outstanding on this branch

1. **Jay to check the mobile homepage on his phone again.** The window in his
   Chrome stopped resizing, so the narrow measurements above are from an earlier
   session at 657px; the nav toggle was verified by wiring, not visually.
   Three things: header back to one line with a ☰ button, the hero date and
   venue readable (no green-on-green shard), and the menu closing when a link is
   tapped.
2. **The two browser checks above** — squad cap and day split.
3. **The team form's roster rows still use a native date input.** Deliberate —
   coaches fill those in on a desktop, and three dropdowns across fifteen rows
   is a lot of UI. Jay's call whether to change it.
4. ~~After merging: Save changes → Republish per age group.~~ **No longer applies** —
   the sheets are empty, all 15 draws were reset and nothing is published, so there are
   no club names to put on the public site yet.

## Still open, not in this PR

- Confirmation emails never tested end to end (needs live submissions against
  production; also exercises the new submit-failure path).
- ~~**Step 5**: one set of pitch names.~~ **Done — PR #12**, open and awaiting Jay's
  yes. Section at the bottom of this file.
- **Nobody is actually scheduled.** Every slot is still TBD at 08:00 until someone
  works through the editor age group by age group. That is now data entry, not code.
- **The rehearsal data is mostly gone.** Done 26 July: all 15 groups unpublished, both
  registration sheets emptied (backups in Drive first), all 15 saved draws reset.
  **Still live: the 415 simulated results** — now safe to clear, since the merge put
  write-and-verify behind every save. See `claude/runbooks/runbook-clearing-the-rehearsal-data.md`.
- Orphaned results accumulate when pools are regenerated.

## Working notes

- **Jay's clone gets used by other work.** It was found on `main` mid-session
  with uncommitted changes (the `/legal` page). Always check
  `git status` and `git rev-parse --abbrev-ref HEAD` before applying anything, and
  use `git add -u` rather than `git add -A` so a stray untracked file in the repo
  root never gets committed — anything in the root is served publicly. A **new**
  file outside the root is fine, but add it by explicit path, never with `-A`.
- Sandbox → PC transfer: gzip the `git diff`, base64, write in chunks through
  Desktop Commander, decode + gunzip in PowerShell, check the SHA-256, then
  `git apply`. For a change that adds files, `git add -N` them first on **both**
  sides so `git diff` carries them and the byte comparison covers them.
- **A chunk can arrive with a single character changed.** It happened once on
  this branch (`k` → `s` at offset 1672 of a 5,604-char base64 stream) and the
  only symptom was a gzip CRC error. Verify the SHA-256 *before* trusting a
  transfer, and when it fails, hash the base64 in blocks on both sides to find the
  bad block instead of resending everything. Chunking at 2,000 chars and printing
  per-chunk hashes makes a bad block name its own chunk.
- It has now happened in **every one of four transfers** — a flipped character at
  offset 1672 of 5,604; another at 7905 of 17,460; a block at 8728 of 20,948 that
  lost one character *and* substituted another, shifting every later chunk; and two
  separate substitutions in one 18,728-char stream. Assume roughly one corruption per
  10k of base64. **Always verify before applying** — it has never once been clean.
- A **dropped** character is the nastier case: every chunk after it reports bad. Fix
  it by splicing the correct 100-char window back in (the damaged window will be 99
  chars, so replacing it with 100 restores the alignment and the whole tail lines up
  again) rather than resending from that point.
- Put the **per-chunk expected hashes into the decode script** so one run names the
  bad chunk instead of two round trips.
- **For test files, tar them and send the archive, don't retype the source.**
  `tar -cf … | gzip | base64` then extract on the PC: bytes are preserved exactly,
  there is no CRLF fudging, and one hash check covers every file in the archive.
  Retyping `test-venue.js` as text produced a one-character difference; the tar
  route landed both test files byte-identical first time.
- **Do not capture `git diff` through PowerShell's pipeline** — `& git diff |
  Out-String` decodes git's UTF-8 with the console codepage, so every em-dash
  becomes three mojibake characters and a byte comparison fails for no real
  reason. Redirect through `cmd /c "… > file"` instead; that is byte-clean.
- PowerShell here also mangles `$var` inside `-Command` strings arriving over the
  bridge. Write a `.ps1` and run it with `-File`. `.NET` calls like
  `[IO.File]::WriteAllBytes` ignore `Set-Location`, so pass absolute paths or
  they land in `C:\Windows\System32` and fail on permissions.
- Generate the patch against the *pushed* tip, not a stale local HEAD, or it will
  contain already-committed work and refuse to apply. `git fetch` can leave
  `origin/<branch>` stale while `FETCH_HEAD` is correct — reset to `FETCH_HEAD`.
- **The sandbox cannot reach the `netlify.app` preview** and serving the repo
  locally does not work either — a `.dc.html` needs the deck-stage runtime to lay
  out, so a local Playwright run reports zero overflow everywhere, including
  desktop. That is a false pass; don't trust it. Measure through the browser
  tools on Jay's machine.
- **Netlify's Deploy Preview drawer is an iframe pinned to the bottom** on
  preview URLs and swallows clicks on the app's bottom tab bar. Looks exactly
  like a dead tab bar. Test app navigation on production.
- The homepage uses scroll-reveal, so programmatic `scrollIntoView` lands on
  unrendered sections. Use real wheel-scroll events to walk down the page.

## PR #12 — the pitch count (Step 5, the last of the pitch work)

_Branch `fix/pitch-count`, two commits `9cfb075` + `7bfdf45`. **MERGED to `main` and
deployed 26 July 2026** — `main` fast-forwarded `6a16a8e → 7bfdf45`, no merge commit.
Cost 15 Netlify credits._

The homepage headline said **16 PITCHES**. Saturday runs 18 and Sunday 10, so the number
was wrong in the one place a club is most likely to read it — and nothing in the codebase
could have noticed, because it was a literal (`Math.round(16 * sp)`) with no connection to
the layout that knows the answer.

It now starts from a written-down fallback of **18** — Saturday, the busier day, chosen by
Jay over 21 (distinct surfaces) and 28 (pitch-days) — and `componentDidMount` replaces it
with the live count via `loadVenue()`, which already falls back to the built-in layout if
the endpoint is unreachable. **So changing the pitches in the Venue & days back office
changes the homepage number too, with no deploy.**

`test-venue.js` gains five checks (87 → 92): the fallback must equal day one's count, the
stat must come from state rather than a literal, and the page must load the layout first.
**Proven against three injected faults** — the fallback put back to 16, the stat put back
to a literal, and the `loadVenue()` call removed — each of which fails the run. The full
suite is **500 checks**, all passing on Jay's PC.

**Verified on the deploy preview:** the stats band reads 20+ CLUBS · 3000+ PLAYERS ·
15 AGE GROUPS · **18 PITCHES**.

**Deliberately not changed:** the "Pitches A, B, C & D" wayfinding line on the homepage
and in `app.html`. A, B, C and D are the real block letters at Zayed Sports City (A1x,
B1x, C4/C5, D1–D5), so that line is directions, not a count.

**Housekeeping:** the transfer to Jay's PC left helper scripts in `C:\Users\jayjm\
adhjrt-sim` — `_check.ps1`, `_pitchfix.ps1`, `_run.ps1`, `_verify.ps1`, `_testfix.ps1`,
`_hash.ps1`, `_commit.ps1`, `_state.ps1`, `_msg.txt`, `_pitch.diff`. All outside the repo,
none tracked by git, safe to delete.

**Two transfer notes worth keeping:**

- A PowerShell function that does `Write-Output` for progress **returns that text as part
  of its value**. A helper doing `$text = Swap $text ...` wrote `ok anchor: statPitches ok
  anchor: setState ...` into **line 1 of the HTML file**, ahead of `<!DOCTYPE html>`. The
  diffstat was 14/3 instead of the expected 13/2, which is how it was caught. Use
  `Write-Host` inside any function whose return value matters.
- `git commit -m $msg` with a multi-line message containing quotes gets shredded into
  pathspecs and the commit silently does not happen — the push then puts an *empty*
  branch on the remote. Write the message to a file and use `git commit -F file`.

### `7bfdf45` — the site's own dialog in Venue & days, and a copy refresh

Batched into the same deploy rather than spending a second 15 credits.

**The three `window.confirm()` calls are gone.** Removing a pitch, moving an age group to
the other day and **Reset to 2025 layout** now use the same
`confirmModal(message, onConfirm, opts)` the Scores page uses — confirm-only, no prompt
variant. Beyond looking like the rest of the site, two things it buys:

- **The button says what it does** — `Remove pitch`, `Move to Sun`, `Reset the layout`
  instead of `OK`.
- **Nothing reaches the server until the dialog is answered**, which is why
  `doResetVenue()` is now a pair: the handler that asks, and `reallyResetVenue()` that
  does it.

Moving a group that has no pitches yet still moves without asking — a pointless dialog
trains people to click through them.

`test-venue-panel.js` goes **76 → 93 checks** and now leaves `window.confirm` as a **trap
that throws**, so a handler cannot quietly go back to it. Proven against five injected
faults: `submitModal` not closing the dialog, `confirmModal` running the action
immediately, `setGroupDay` losing its button label, `doResetVenue` calling the server
before asking, and a handler put back on `window.confirm`. Full suite is now **517
checks**, `runall.ps1` exits 0.

**Copy refresh on the Clear the rehearsal data card.** It told you to filter the sheets on
`971500000000`. Those rows were cleared on 26 July and both sheets are empty, so in
November that recipe would only confuse. What the card does and does not do is unchanged.

**Verified on production after the deploy** — the exact action that froze the page before:

> Move U11 to Sunday 8 November?
> Its 1 pitch on Saturday 7 November (C4) will be cleared — that day has different
> pitches. Its saved fixtures keep whatever pitch they were given until you change them.
>   [ Cancel ]  [ Move to Sun ]

Cancelled; U11 still on Saturday with C4 and the stored layout still equals the defaults.

Final production sweep: **0 drafts, 0 published, 0 results, venue 18/10, no warnings.**

### The transfer problem is solved

Every previous sandbox → PC transfer corrupted at least once (roughly one flipped or
dropped character per 10k of base64). This one used the **device bridge** instead: the
files were sent with `SendUserFile` and written straight to disk with
`device_commit_files`, after Jay granted access to `C:\Users\jayjm\GitHub` and
`C:\Users\jayjm\adhjrt-sim`.

**The content never passes through the model, so there is nothing to corrupt.** Proof it
landed exactly: `git write-tree` on Jay's PC returned
`73a25b41c7acc5321d58df2c7b534c678c295c7c`, byte-identical to the sandbox tree.

**Use this route from now on.** Base64 chunking is the fallback for when no folder is
granted, not the default.

---

## PR #13 — the homepage fills the screen again

_Branch `fix/full-width`, one commit `f5f1221`. **MERGED to `main` and deployed
26 July 2026** — `main` fast-forwarded `7bfdf45 → f5f1221`. Cost 15 Netlify credits._

**Jay spotted this within minutes of the previous deploy: black walls either side of
everything on a normal monitor.** He was right, and it was mine.

The outer wrapper has now been wrong in **both** directions:

| | What it did |
|---|---|
| `min-width:1200px` (original) | forced a 1200px canvas onto phones — site zoomed out, registration modal tiny |
| `max-width:1200px;margin:0 auto` (`2b8fd97`) | fixed the phone, capped every desktop at 1200px — a narrow column in black gutters |

**Neither bound belongs on that element.** Every section already caps its own content —
hero 1200, results 1000, register 900, organisers 640, each with `margin:0 auto` — and
carries its own background. With the outer cap gone the section backgrounds run edge to
edge and the text stays centred and readable, which is what the page did before the
mobile work, minus the phone bug.

**The phone cannot regress from this, and it is provable rather than hopeful.** Below a
1200px viewport `max-width:1200px` was never binding — the div was already the width of
the screen. Removing it changes nothing under 1200px. The phone bug came from
`min-width`, and nothing here puts one back.

**`test-layout.js` is new — 21 checks.** The wrapper carries no width bound at all, every
section caps its content on the section tag or one of its own top-level children, and the
phone fix survives (both `@media (max-width:760px)` blocks, the nav toggle, no fixed
width on `body`). Proven against **six** injected faults: the max-width put back, the
min-width put back, `overflow:hidden` dropped, a section losing its cap, one of the two
media queries removed, and a cap left only on a nested card.

**The first version of that section check was worthless** and is worth recording. It
scanned each whole section for any `max-width` and passed happily with the real cap
deleted, because a card deeper inside still had one. It walks the tags now and only
accepts a cap on the section or its own top-level children. This is the second time on
this branch that an injected fault has caught a weak test of mine — the other was
`/Publish anyway/` matching a comment.

**Verified on production after the deploy:** viewport 1643px, stats band 1628px (the
difference is the scrollbar), horizontal overflow **0**, and the wrapper serves with no
`max-width`, no `min-width`, `overflow:hidden` intact.

Suite is now **538 checks**, `runall.ps1` exits 0. `runall.ps1` gained `test-layout.js` —
it is an explicit list, not a glob, so a new test file has to be added to it by hand.

Data untouched by all of this: **0 results, 0 of 15 published, venue 18/10, no warnings.**
