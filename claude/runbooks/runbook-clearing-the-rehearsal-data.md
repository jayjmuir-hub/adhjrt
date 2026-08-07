# Clearing the rehearsal data — runbook

> ## ⚠️ TOMBSTONE — THIS RUNBOOK IS HISTORICAL. DO NOT FOLLOW STEP 2 OR THE
> ## "FOR THE FUTURE" LINE IN STEP 4.
>
> _Tombstoned 7 August 2026._
>
> **Written 26 July 2026, against a UI that no longer exists.** The
> **"Clear the rehearsal data"** card was **deleted** from
> `Scores & Standings.dc.html` in Aug 2026, as part of retiring that page's
> Manager area (see `claude/specs/spec-scores-manager-removal.md`). Its
> `test-cleanup.js` went with it.
>
> **What is no longer followable:**
>
> | Where | What it tells you to press |
> |---|---|
> | Step 2, sub-steps 1–4 | "Organiser screen, **Clear the rehearsal data**" → "**Show me what is stored**" → "**Remove every result**", type `ALL` |
> | Step 2, "What if you press it by accident?" | describes a safety behaviour of that card (it switched itself off on tournament days) |
> | Step 4, "For the future" | "**Clear the rehearsal data** → **Delete every saved draw** → type `ALL`" |
>
> **What still works, unchanged:**
>
> - **Step 1** (unpublish, per age group) — still the same screen.
> - **Step 3** (delete sheet rows by hand in Google Sheets) — never involved the card.
> - **Step 4's actual method** — `save-schedule-override` with
>   `{ ageGroupId, reset: true }`. That is an API call, not the card, and it
>   still stands. The card was only ever a wrapper around 15 of those calls.
> - **Step 5** (`/organizer` → Accounts) — still the way to revoke a login.
>
> **If bulk clearing is needed again:** *"Reset the simulation"* on
> `/organizer` → Tournament does most of the job — it unpublishes every group,
> removes every result one write-and-verify call at a time, and clears
> generated brackets. ⚠️ It deliberately does **NOT** touch saved pools, team
> assignments, or the Google Sheets. **This has not been re-verified since the
> card was deleted** — read the code before trusting that sentence, and do not
> assume the steps below map onto it one for one.
>
> **Kept, not deleted**, because the reasoning is still worth having: why
> nothing deletes in one shot, why there is a match-day guard, and why the
> confirmation is typed rather than clicked. A deletion with no trace is an
> invitation to re-add it. Design notes also survive in git history —
> `git log -- 'Scores & Standings.dc.html'`, Jul 2026.
>
> ⚠️ **Personal data was redacted from this file on 7 Aug 2026** before it
> entered a PUBLIC repo: one real manager account username, one real person's
> name paired with a live sheet row, and the two Drive backup filenames. The
> facts they carried survive; the identifiers do not.

_Written 26 July 2026. Branch `fix/team-names-persist` @ `6a16a8e`._

**Status 26 July, re-verified against live production:**

- **Step 1 (unpublish) — DONE.** 0 of 15 published, confirmed by querying all 15 groups.
- **Step 2 (clear 415 results) — DONE 26 July, after the PR #11 merge.** All 415 removed
  through the Clear the rehearsal data card, each one written and read back. The card
  reported "Removed all 415 results across every age group" and an independent read of
  `get-results` returns **0**.
- **Step 3 (sheet rows) — DONE, both sheets.** Backups taken first. Both sheets now export
  as a header row and nothing else — zero data rows, including the 22 July test rows.
- **Step 4 (delete the 15 saved draws) — DONE 26 July.** All 15 reset on production via
  `save-schedule-override` `{reset:true}`, one at a time, each verified afterwards.
  Final sweep: 0 of 15 drafts, 0 of 15 published, 15 of 15 `awaitingPublication`, and an
  anonymous (no-token) read of all 15 groups returns no draw at all.
- **Step 5 (manager logins) — Jay's decision, deliberately left alone on 26 July.** Four accounts exist: your own organiser
  login, one real u18b manager (created 14 Jul; username redacted), and `test-u14b` + `test-u13`
  (both created 22 Jul for the rehearsal).

---

## Backups taken before anything was deleted (26 July)

Both registration sheets were copied inside Google Drive, into the same folder as the
originals, before a single row was removed. Sizes were checked after the copy to confirm
the copies actually carry the data, not just the file names.

| Copy | Size check |
|---|---|
| Teams sheet backup *(exact filename redacted — it is in Drive, dated 2026-07-26)* | 41,596 vs original 41,585 |
| Players sheet backup *(exact filename redacted — same folder, same date)* | 115,473 vs original 115,577 |

(The small size differences are the file title and sheet metadata, not missing rows.)

**This is what makes the row deletion recoverable.** Delete the backups only once you are
happy the tournament has moved on — there is no reason to hurry.

---

## Verified inventory, read off the live sheets 26 July

Read by exporting each sheet as CSV and counting, then cross-checked against the sheets
themselves with `Ctrl+Down` on column A. Both methods agree.

| | |
|---|---|
| Teams sheet | 257 rows = header + **256** data. **255** carry `971500000000` in Head Coach Phone. |
| Players sheet | 3,827 rows = header + **3,826** data. **3,825** carry `971500000000` in Parent Phone. |
| Real club registrations | **none yet** |
| Stored results | **415** (u16b has 76, its double bracket) |
| Published | **0 of 15** — done |

**The one non-rehearsal row in each sheet is your own 22 July test, and in both sheets it
sits at row 2** — Barrelhouse / BAR1 / U16B Contact in the teams sheet, and the
matching player row (name redacted) in the players sheet. Everything from row 3 down is rehearsal, with no gaps.

That last fact matters: because the rehearsal rows are one unbroken block starting at
row 3, no filter is needed. Select rows 3 to the end and delete. Simpler and harder to
get wrong than filtering.

**A note on the earlier count of 176 rows:** an initial read of the teams sheet through
the Drive connector returned only 176 of the 256 rows without saying it had stopped
early. The CSV export is the count to trust.

---

## Do these in order. Order matters.

### 1. Unpublish everything — DONE 26 July

Done one group at a time, then verified from the anonymous public view rather than
trusting what the writes returned: **0 of 15 published, 15 showing "coming soon"**.

Your drafts are untouched. **Publish all** puts it all back if you want it back.

This was the only step that changes what the public sees, and it was the bit that
mattered.

### 2. Clear the 415 results — DONE 26 July

PR #11 was merged first, which is what made this safe. The run took about six minutes,
counting up "Removing 20 of 415…" to the end, then reported **"Removed all 415 results
across every age group"**. Verified independently afterwards: `get-results` returns 0,
and the card itself now says "Nothing stored — the results are already clear."

The original reasoning, kept because it is the rule for next time:

**Do not clear these on production as it stands.** Production still keeps every result
in **one shared blob** with a read-modify-write and no compare-and-set — the exact bug
`b2da6bb` and `c7f895f` fix, both sitting in PR #11. Today a run of 415 clears has no
write-and-verify behind it: a clear can silently fail and report success, which is the
failure mode that started this whole branch.

After the merge, each clear is written, read back and confirmed, and the run names
anything that did not stick so you can press again. So: **merge, then clear** — the
merge makes the operation safe, not merely convenient.

1. Organiser screen, **Clear the rehearsal data**.
2. Press **Show me what is stored**. You get a line per age group: how many results,
   and how many are *orphans* (scores left behind when a pool was regenerated, which
   no fixture refers to any more).
3. **Check the numbers look like a rehearsal, not a tournament.** They should total
   around 415. If a group shows something you did not expect, stop and tell me.
4. Press **Remove every result**, then type `ALL`.

It removes them one at a time and reports as it goes — about two minutes. If any
fail it says how many and you press again.

**What if you press it by accident?** You cannot on 7 or 8 November — the card
switches itself off on the tournament days. And the original recording of every
result survives in an untouched backup blob, so it is recoverable by anyone with
Netlify blob access.

### 3. Delete the sheet rows — DONE 26 July

Teams rows 3–257 were deleted in one operation and verified. Jay then cleared the
players sheet and both row-2 test rows.

Re-verified by CSV export on 26 July: **both sheets are a header row and nothing else.**
Zero data rows in either.

Side effect, and a good one: `nextTeamCode()` numbers a new team from what is already in
the teams sheet, and the sheet is now empty. So the first real Harlequins team gets
`ADH1` and the first Barrelhouse team gets `BAR1` — no leftover test row to renumber
around.

### 4. Delete the 15 saved draws — DONE 26 July

Done on production without waiting for the merge. `save-schedule-override` already
accepts `{ ageGroupId, reset: true }`, which deletes the draft; the cleanup panel on the
branch is only a convenience wrapper around 15 of those calls. Each reset was fired
individually and the draft re-read afterwards to confirm it was gone.

Final sweep, all 15 age groups:

| | |
|---|---|
| Drafts remaining | 0 of 15 |
| Published | 0 of 15 |
| `awaitingPublication` ("coming soon") | 15 of 15 |
| Anonymous, no-token read returns a draw | 0 of 15 |

Every group is now on the deterministic auto-generated draw, exactly as an untouched
age group always was — and because nothing is published, the public still sees "coming
soon" everywhere rather than those placeholder pools.

For the future: **Clear the rehearsal data** → **Delete every saved draw** → type `ALL`
does the same thing in one press, once PR #11 is merged.

A reset draft is not recoverable and, unlike the sheets, had no backup copy. What was
lost is a rehearsal draw naming teams that no longer exist anywhere, so the loss is nil —
but that is the reason, not an assumption.

### 5. Decide about the manager logins

Four accounts exist on production right now:

| Account | Role | Created | Suggested |
|---|---|---|---|
| *(your organiser login)* | organiser | 11 Jul | keep — yours |
| *(a real person's manager login — username redacted)* | manager, u18b | 14 Jul | your call |
| ~~`test-u14b`~~ | manager, u14b | 22 Jul | **REVOKED — Jay, 7 Aug 2026** |
| ~~`test-u13`~~ | manager, u13 | 22 Jul | **REVOKED — Jay, 7 Aug 2026** |

In **/organizer → Accounts** you can revoke any of them.

✅ **BOTH `test-*` LOGINS ARE GONE — Jay revoked them on 7 Aug 2026.** They had
working passwords and no reason to exist. ⚠️ **This is Jay's word, not a
measurement** — a session cannot read the account store without signing in, the
same basis on which the `testclub` revocation was recorded on 5 Aug. Nothing in
the repo can verify it, and nothing should claim to.

---

## What "clean" looks like when you are done

| | |
|---|---|
| Public fixtures | "Coming soon" on every age group — **done, 0 of 15 published** |
| Teams sheet | header only — **done** |
| Players sheet | header only — **done** |
| Saved draws | none — **done, 0 of 15** |
| Stored results | 0 — **done** |
| Rehearsal logins | ✅ **NONE — `test-u14b` and `test-u13` revoked by Jay, 7 Aug 2026** (his word; not independently checkable) |

---

## Three things to know

**The registration form keeps working throughout.** Nothing here touches the form, the
email confirmations or the code that receives a registration. A club registering while
you are doing this lands in the sheet as normal.

**Team codes now start clean.** Both sheets are empty, so `nextTeamCode()` has nothing to
count from and the first team of every club gets `1` — `ADH1`, `BAR1`, and so on.

**Step 1 is done, so the urgency is gone.** Nothing is published, so nobody can see
invented fixtures. Steps 2 and 4 want the merge first. Step 5 is a decision, not a task.

_(Note: this cleanup's inventory is now historical — a separate, smaller test-data clear
happened again on 28 July 2026. See `claude/changelog.md`'s "Test data cleared 28 Jul
2026" for the current state of the registration sheets.)_
