> **ARCHIVED 30 July 2026.** The 25 July 2026 test plan for the rehearsal that
> found most of the bugs fixed in PR #11. The rehearsal itself is long done and
> cleaned up — see `claude/runbooks/runbook-clearing-the-rehearsal-data.md` and
> `claude/changelog.md`. Kept as a reference for how a future large-scale
> rehearsal (if ever needed again) was structured.

# ADH JRT — simulated tournament: full test plan

_Written 25 July 2026. Covers everything that runs on 7–8 November, tested
against production with simulated data, plus how to remove it afterwards._

## Ground rules

- **No deploy is needed for any of this.** Every phase exercises data and
  runtime behaviour, not code. Nothing here spends Netlify credits. The one
  exception is the Today-tab test in Phase 7, which uses a free PR preview.
- **Label every step by system.** Steps below are marked "In Google Sheets",
  "In Organizer", "In /scores", "In the app".
- **Two known bugs to watch for, already identified — don't re-diagnose them:**
  - Phone numbers lose their `+` prefix (`USER_ENTERED` treats `+` as a formula
    start). Every phone in the sheets is stored as a number.
  - `nextTeamCode()` reads-then-appends, so two simultaneous registrations can
    be issued the same code. Only bites under concurrent submission.

## The simulated dataset

| | |
|---|---|
| Clubs | 10 — 6 with fixed prefixes (`ADH DE DS DH DT BAR`), 3 on the initials fallback (`AAA DD ADSB`), 1 via the "Other" free-text path (Dubai Warriors) |
| Teams | 255 — 17 per age group across all 15 groups |
| Players | 3,825 — exactly 15 per team |
| Coaches / managers | 150 each — one per club per age group, shared across that club's sides |
| Tournament managers | The 15 Abu Dhabi Harlequins managers (host club), listed in `managers.csv` |
| Real inbox | 1,065 addresses — all coaches, 3 parents per team, and the 15 host managers |
| Undeliverable | 3,270 addresses on `@example.com` |
| Cleanup handle | Phone `971500000000` — on every simulated row, on no real row |

Teams per age group break down as: Harlequins 3, Exiles 3, Sharks 2,
Hurricanes 2, Tigers 2, and one each from Barrelhouse, Amblers, Dragons, Small
Blacks and Warriors.

---

## Phase 0 — Load the registrations

**In Google Sheets**, for each sheet in turn (Team Registrations, then Player
Registrations):

1. Open the sheet.
2. **File → Import → Upload**, select `teams.tsv` (or `players.tsv`).
3. Import location: **Append to current sheet**.
4. Separator type: **Tab**.
5. **Untick "Convert text to numbers, dates, and formulas."** Left on, Google
   reinterprets the DOBs and ISO timestamps as date values and may render them
   differently when read back, which breaks parsing for reasons unrelated to
   the code.
6. Click **Import data**.

**Do a 10-row smoke test first.** Import a trimmed file of 10 rows, open
`/organizer`, confirm the rows read correctly, then import the rest.

**Verify:** Team Registrations rows 3–257, Player Registrations rows 3–3,827.
Your real 22 Jul test row stays at row 2 in both.

---

## Phase 1 — Create the 15 manager accounts

**In Organizer** (`/organizer`), signed in as an organiser:

1. Go to the **Accounts** tab.
2. In the **Create manager login** card, fill: **NAME**, **USERNAME**,
   **PASSWORD**, **AGE GROUP**.
3. Take name, username and age group from `managers.csv`, row by row.
4. Use one password for all 15 so the test is manageable — minimum 6 characters.
5. Repeat for all 15 rows.

These accounts are created already approved, so no invite code and no approval
step. They appear immediately under **All accounts**.

**Verify:**
- All 15 show as approved, one per age group.
- A duplicate username is rejected with "That username is already taken."
- A 5-character password is rejected.

**Also create one `admin` manager** using the `admin` key from
`MANAGER_INVITE_CODES` (age group `*`). That account sees every group, which
saves logging in and out 15 times during Phases 4–6.

---

## Phase 2 — Build the draw

This is the feature that shipped in PR #8 and has never been driven at volume.

**In /scores**, signed in as organiser or the age group's manager, open the
fixture editor for an age group:

1. Find the **Registered teams** panel above the pool cards.
2. Check the header count reads **17 registered** for the group.
3. Choose **Replace the pools**.
4. In the review table, confirm each row shows its code chip, club, stated
   preference and destination pool, flagged `New` / `In draw` / `Moved`.
5. Click **Review & import**, then commit.
6. Set pitches in the **Pitches for this age group** panel (type-to-add chips).
7. Set kick-off times, then **Save draw**.

**Verify, and this is the part most likely to break:**
- **17 teams across 4 pools.** The preference field offers A/B/C/D and "No
  preference", so the import has to build four pools of 4–5. Two-pool layouts
  are the well-trodden path; four is not. Watch the Fixtures section width on
  the homepage too — `fixturePoolsGridStyle` has a special case for one pool,
  and four is untested.
- **Harlequins' three sides land in different pools** where possible, and are
  flagged if they can't.
- **Codes not names.** `getFixtures()` returns pool teams as *names* while
  standings and knockout slots use *codes*. This exact mismatch silently broke
  "follow my team" once before — check the team key card legend resolves.
- **`teamNames` is written into the draw** so published fixtures show readable
  club names, not raw codes.
- **Replace is blocked once any fixture in the group has a result**; **Add the
  missing ones** stays available.

Do this for all 15 groups. Time this — it's the organiser's real workload and
if it takes 20 minutes a group, that's a finding in itself.

---

## Phase 3 — Publish

**In /scores**, as organiser:

1. Publish a single age group first. Confirm it flips from **Not published**.
2. Open the site signed out (private window) and confirm that group's fixtures
   are public and the others are not.
3. Use **Publish all age groups**.
4. Test **Unpublish** on one group and confirm it disappears from the public
   view but survives in the editor.

**Verify:** the published copy carries `teamNames`, so a signed-out visitor
sees club names on `/scores` and the homepage without ever touching
`get-registrations`.

---

## Phase 4 — Score entry (the actual tournament day)

**In the app** (`/app`), signed in as an age-group manager.

Full round-robin at 17 teams is roughly 40 pool matches per group, 600 across
the tournament. Don't hand-enter all of them.

- **Score three age groups exhaustively:** one Saturday mini (`u8`), one Sunday
  youth (`u14b`), one double-bracket group (`u16b`).
- **Spot-check the rest** — two or three results per group, enough to prove
  standings compute.

For each match: open the match sheet, enter both scores and try counts, save.

**Verify:**
- Scores appear on `/scores` and the homepage Fixtures section immediately.
- A manager can only enter scores for **their own** age group. Try a match id
  from another group and confirm the server refuses — `submit-result.js`
  derives the age group from the match id itself, so it must reject.
- **Walkover**: record one. Expect 20–0 with 4 tries, and confirm it reads as a
  walkover rather than a normal 20–0 everywhere it appears.
- **Clear result** puts the match back to unscored.
- **Jump to current match** scrolls to the first unscored match.
- U6 and U7 show **no standings table** (`hasStandings: false`) but still
  accept scores.

---

## Phase 5 — Standings and tie-breaks

Standings are computed **in the browser** from raw results, so every device
must derive the same table.

**Verify each tie-break in order** by entering results that force it:

1. Points difference
2. Most points scored
3. Head-to-head
4. Least conceded
5. Mini-league for 3+ tied teams
6. Coin toss

The mini-league case is the one worth constructing deliberately — engineer a
three-way tie in one pool and confirm the resolution is right and stable.

**Verify:** 4 points a win, 2 a draw, 0 a loss; walkover counts as a win.
Standings match between `/scores`, the homepage and the app **on the same
data** — a mismatch means the shared data layer has drifted.

---

## Phase 6 — Knockouts

**In /scores**, in the fixture editor:

1. With all pool scores in, click **Generate knockout from standings**. It
   should be gated until every pool match is scored — confirm the gate works by
   trying it one result short.
2. Check seeding under **Knockout Seeding**.
3. Score the knockout matches.
4. Click **Generate finals from knockout** and confirm Cup/Bowl/Plate/Shield/
   Final fill from the winners so far.
5. Test **Clear knockout**.

**Verify:**
- **U16B and U16G use the special double bracket** — this is the distinct code
  path and the one most worth breaking.
- Knockout cells and the bracket show **codes**, with the team key card as the
  legend; pool fixtures and results show **names**.
- With 17 teams across 4 pools, check how many qualify and whether the bracket
  shape makes sense. A 4-pool group is untested territory.

---

## Phase 7 — Public views and the app

**Signed out, in a private window:**

- Homepage Fixtures section: scores on pool rows and in the knockout/finals
  bracket, blank where unscored, walkover-aware.
- Results follows Fixtures — changing the age group in Fixtures should sync the
  embedded Scores & Standings component.
- `/scores` public view: pool fixtures, results, standings.
- **Results nav link is still `#results`** (line ~152 of `Quins JRT.dc.html`).
  Once the draw is real this should become `/scores`. Decide during this test
  whether the simulated draw counts as "real enough" to flip it — it does not,
  because the data is fake and the site is public.

**In the app:**

- **Follow my team** — pick a team, confirm it's highlighted in tables and
  fixtures. This is the one that broke before via the names/codes mismatch.
- **Results view.**
- **Tables, Knockout, Fixtures, Following, More** tabs.
- U6/U7 manager is not locked out.

### The Today tab needs a date shim

**The Today tab cannot be meaningfully tested in July.** It shows the current
day's matches, and the fixtures are dated 7–8 November 2026, so it will be
empty no matter what you do.

Don't fake it by editing the tournament date — that's public-facing. Instead:

1. **In GitHub:** branch off current `main`, shim the app's "today" to
   7 Nov 2026 in `app.html` only.
2. Open a **PR** — that publishes a free password-protected deploy preview.
   Branches alone have no preview URL on this site.
3. Test the Today tab on the preview against the same production fixtures.
4. **Close the PR without merging.** Cost: zero credits.

---

## Phase 8 — Edge cases

- **Late entry:** after a group has results, use **Add the missing ones** to add
  a team. Existing pools, times and results must be untouched.
- **Withdrawal:** remove a team by hand in the editor. Import never deletes.
- **Guest team:** add a free-text team with no registration. `teamLabel` should
  fall through to the raw string.
- **Same club twice in a pool:** confirm the import avoids it, and flags when it
  can't.
- **Permissions:** a manager must not reach another group's registrations.
  `get-my-registrations` takes the group from the signed token, never the
  request — try to tamper and confirm it refuses.
- **Sheet unreachable:** the import panel should show the error and disable
  Import while leaving the editor usable by hand.

---

## Cleanup

**In Google Sheets**, for each sheet:

1. Select all data, **Data → Create a filter**.
2. Filter any phone column to `971500000000`.
3. Select the filtered rows, right-click, **Delete selected rows**.
4. Remove the filter.

That single filter catches all 4,080 simulated rows and leaves your real 22 Jul
test row alone.

**In /scores / Organizer:**

- Unpublish every age group.
- Clear results, or leave them — they are Netlify Blobs under the production
  `results` store, keyed by match id, and a real draw will overwrite the ids.
  Decide deliberately rather than by default.
- Revoke the 15 manager accounts, or keep them and reset the passwords before
  November. Keeping them saves redoing Phase 1.

**Do not** commit, log or paste any registration values anywhere — the rule
holds even for simulated data, so the habit stays intact.

---

## What this test is actually for

Three things worth knowing by the end:

1. **Does the organiser workload scale?** 15 groups × 17 teams is the real
   shape. If building the draw takes an hour a group, that's the finding.
2. **Does a 4-pool age group work end to end?** Everything shipped so far has
   been exercised at two pools.
3. **Do names and codes stay straight?** It is the one mismatch that has
   already caused a silent bug, and it touches every surface.
