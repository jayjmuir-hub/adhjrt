> **ARCHIVED 30 July 2026.** Progress log for the 25 July 2026 rehearsal (255
> simulated teams, 3,825 simulated players) that surfaced most of the bugs
> fixed in PR #11. All cleanup described here is long done — see
> `claude/runbooks/runbook-clearing-the-rehearsal-data.md` and
> `claude/changelog.md`'s "Test data cleared 28 Jul 2026" for current state.

# Simulated tournament — progress log

_Last updated 25 July 2026._

## Done

**Phase 0 — registrations loaded.** 255 simulated teams and 3,825 players are in
the two Google Sheets (rows 3 onward in each). Generated on Jay's PC at
`C:\Users\jayjm\adhjrt-sim` by `generate.js`, verified byte-identical to a
sandbox copy that passed 8 checks, and pasted in via the clipboard. Jay's
original 22 Jul test rows are untouched at row 2 of each sheet.

Cleanup handle: **phone `971500000000`** appears on every simulated row and on
no real row. Filter either sheet on any phone column and delete.

**Phase 2 — draws built.** All 15 age groups have a draw imported from the
simulated registrations, saved as **drafts**. 17 teams each (18 in U16B, which
includes Jay's real Barrelhouse row), spread across 4 pools. U6 and U7 are
festival groups — one "Festival Pool" plus three added pools, no standings.

**Phases 3–6 — published and scored.** All 15 groups were published and 415
results entered across pools and knockouts, which is what surfaced the bugs now
sitting in PR #11. **The fake fixtures and results are still live** — see
Cleanup below.

**QA and role review, plus a verification pass.** See
`claude/archive/qa-review-jul-2026.md` and `claude/archive/qa-review-jul-2026-verification.md`.
The verification pass withdrew four findings and corrected two — read it before
acting on the original.

## Bug fixes shipped

**PR #9** → `main@9552e04`. Five fixes: import panel not loading registrations
(said "none found" until you visited the Registrations tab), wrong
pool-preference count (`/[A-D]/i` matched the "c" in "No preferen**c**e"),
import leaving stale fixtures after a replace, `USER_ENTERED` → `RAW` on sheet
writes, and the organiser CSV header mismatch.

**PR #10** → `main@fcb337d`. Duplicate team codes, in two layers:

- `_teams.js` — `nextTeamCode()` counted a club's rows in an age group and added
  one, so deleting a withdrawn team's row reissued an existing code (ADH1 +
  ADH3 on the sheet → next issued ADH3). Verified against the old module. Now
  goes one past the highest number already issued, which also respects a code
  corrected by hand. 10 unit tests in `test-teamcodes.js` on Jay's PC.
- `Scores & Standings.dc.html` — the import's dedupe only looked inside the pool
  being built, so a duplicate code landed in two pools with fixtures in each. A
  code is now claimed once across the whole draw, and a skipped duplicate is
  named in the editor message rather than dropped silently.

**Known limit, deliberately left:** `nextTeamCode` reads the sheet then appends,
so two clubs registering in the same instant can still both be issued one code.
A sheet-backed counter can't be made atomic from a Netlify function without a
lock. The import-side guard is what contains that case.

## PR #11 — open, not merged (branch `fix/team-names-persist`)

Five commits, all validated. **Needs Jay's yes before merging — 15 credits.**

1. `67063b3` — imported team names never persisted (`saveDraw()`'s allow-list
   silently dropped `teamNames`, so the public site showed raw codes), and
   U6/U7 accepted scores via a direct API call.
2. `b2da6bb` — results split one blob per age group. Previously everything sat
   in one object, so two managers in *different* groups saving at the same
   moment could delete each other's scores. Biggest match-day risk found.
3. `5ed16b5` — knockout ids are stable, so regenerating a bracket left the old
   score attached to a slot now holding two different teams. Cleared, and only
   for slots whose teams actually changed.
4. `c7f895f` — **write-and-verify**: a save now writes, reads the group back,
   and looks for its own `submittedAt`; if missing it re-reads, merges and
   retries, three attempts, then returns 409 with a visible error rather than a
   false OK. The reply carries the stored figures and both score screens show
   them ("Saved 15–10"). Also fixes the **COIN TOSS badge** (it re-compared the
   figures that define a tied group, so it was always true, and it skipped the
   first team of a tied pair), and adds the **Results storage** section to
   `CLAUDE.md`.
5. `06c6859` — **`teamNames` rebuilt from the registrations on every save**
   (`withTeamNames()`, wired into every `api.saveDraw` call site), and
   **a failed registration no longer reports success** (`postRegistration()`
   throws on status ≥ 400; the caller shows an error and keeps the filled form
   so Submit retries it).

Tests on Jay's PC in `C:\Users\jayjm\adhjrt-sim`: `test-results-store.js` (16),
`test-teamcodes.js` (10), `test-cointoss.js` (7), `test-writeverify.js` (12),
`test-teamnames.js` (22), plus `validate.js` for script parse and
`sc-if`/`sc-for` balance. All 67 checks passing against the applied files.

## Recovering the team names — the procedure after the merge

Verified on the preview against real data: the U8 draft had **no** `teamNames`;
one press of **Save changes** — no re-import — gave it **17 names for 17 codes,
none unresolved**. Across all 15 groups, **255 of 255 pool codes** resolve.

So per age group it is just: **Save changes → Republish.** Re-importing is *not*
needed, which also avoids any risk of an import reshuffling pools.

One caveat: registrations load asynchronously when you open an age group, so
pressing Save within the first second of switching may write nothing (the merge
is a deliberate no-op on an empty registration list — it can never blank names).
If the names don't appear, just press Save again.

## Open findings

1. **Same-club pool clash not implemented.** Two sides from one club can land in
   the same pool when both request it. Jay's call: preference is advisory and
   organisers set the final pools, so this is working as intended. No fix needed.
2. **Confirmation emails never tested end to end.** Needs live form
   registrations against production — not testable on a preview, and the same
   run also verifies the `RAW` fix, the CSV header fix, and now the new
   submit-failure path.
3. **Orphaned results accumulate.** Regenerating pools mints new match ids, so
   the old results stay in the blob unreferenced. Harmless but untidy; the
   proposal is an organiser-triggered cleanup, deliberately *not* auto-pruning
   on save.
4. **Top of the remaining QA list**: homepage has no mobile layout
   (`min-width:1200px` on line 132 of `Quins JRT.dc.html`, one layout media
   query in the whole file); zero pitches assigned on any of ~430 slots across
   all 15 groups; every group kicks off at 08:00 with no clash detection; U16B's
   published knockout still names clubs from the old placeholder draw.

## Cleanup still owed

- **Unpublish all 15 age groups** — simulated fixtures are currently public.
- **Clear the 415 simulated results.**
- **Delete 4,080 simulated sheet rows** — filter any phone column on
  `971500000000` and delete; that misses no real row.
- Decide whether to keep the 3 manager logins or revoke them.

## Gotchas hit while doing this

- Do not click the age-group dropdown by coordinate without scrolling to the top
  first. The page keeps its scroll position after a save, so the click lands
  somewhere else and silently re-runs the import on the current group. This
  added Pools E and F to U9 before it was spotted.
- The deploy preview is a different origin, so the manager session does not
  carry over from adhjrt.com — it needs a separate sign-in.
- **Netlify's "Deploy Preview" drawer is an iframe pinned to the bottom of the
  page on preview URLs.** It swallows clicks on the app's bottom tab bar, which
  looks exactly like a dead tab bar. `document.elementFromPoint` proves it.
  Test the app's navigation on production, not on a preview.
- `gh` is not installed on Jay's PC; PRs are opened through the browser.
- Moving edits sandbox → PC: **gzip** the `git diff`, base64 it, write it in
  chunks through Desktop Commander, decode + gunzip with PowerShell, check the
  SHA-256 matches, then `git apply`. Gzip first cuts a 19 KB patch to three
  chunks instead of nine. The working-tree files will still hash differently on
  Windows (`core.autocrlf=true`); compare `git diff` output, not the files.
- `git fetch` can leave the `origin/…` remote-tracking ref stale in the sandbox
  clone while `FETCH_HEAD` is correct. Check `git ls-remote` and reset to
  `FETCH_HEAD` rather than trusting `origin/<branch>`.
