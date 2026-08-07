# Take the Manager area out of `/scores` — DESIGN (v2)

> **Status: SHIPPED — merged to `main` 2 Aug 2026 (`fc6ae59`), live and
> verified on production.** One deviation from this spec, agreed with Jay
> mid-build: Import registered teams was NOT moved (it already lived in full
> on `/manager` — the "verified by comparing the three pages" claim below was
> wrong); `/manager` gained the withTeamNames every-save rule instead. Full
> record: `claude/changelog.md`. Supersedes the morning draft of this spec.
>
> The old precondition — "wait for `club-manager-page` to merge" — is
> **resolved**: Jay parked that branch on 2 Aug and it will not merge. `main`
> and `dev` are both at `91080a2` with nothing unmerged (verified by
> `git fetch` + `git log origin/main..origin/dev` at spec time). The work
> branches off `dev`.
>
> **⚠️ This job must not merge to `main` without job 2 (the unified login,
> `claude/specs/spec-unified-login.md`).** Reason at "Why the two jobs travel
> together" below. Both land on ONE branch, committed as two reviewable halves.

## What it is

`/scores` serves two audiences: the public standings page, and a signed-in
Manager area. `/manager` (rebuilt 1 Aug) now covers the manager job
completely, so the manager half of `/scores` is duplication — and duplication
in this codebase drifts (the two draw editors already read a pool preference
differently).

**End state: `/scores` is a purely public results page with one quiet
"Manager sign-in" footer link. Everything signed-in lives on `/manager` or
`/organizer`.**

## Decisions Jay made (2 Aug, evening)

1. **The rehearsal cleanup has been RUN — fully.** So the "Clear the rehearsal
   data" panel (and its "Remove orphans" button) is **DELETED, not moved**.
   This removes the riskiest part of the job.
2. **`/scores` keeps a small footer link** — "Manager sign-in" → `/manager` —
   so a manager landing there out of habit has somewhere to go.
3. **The scoring rules editor MOVES to `/organizer`.**
4. **Simulate whole tournament / Reset the simulation MOVES to `/organizer`.**
   (This was the fifth tool the original list missed. "Reset the simulation"
   is now also the only bulk-clear tooling anywhere — unpublishes every group,
   removes every result, clears brackets — which matters *because* the
   dedicated cleanup panel is going.)

## ⚠️ Safety gate before deleting the cleanup panel

Jay reports the cleanup fully done, but this spec was written without being
able to see the live stores (site password). **Before the commit that deletes
the panel, verify the stores are actually empty** — one signed-in read of
`get-results` (every group zero results) and the saved-draw overrides. If
anything is still in there, STOP and say so: deleting the only tooling that
empties a store, while the store still has 452 invented results in it, is the
one genuinely irreversible mistake available in this job. (Recoverable via the
legacy `all` blob, but let's not.)

## What moves to `/organizer` — four tools, one new tab

A new **Tournament** tab in `/organizer` (beside Teams / Players / Accounts /
Venue & days / Registration), holding:

| Tool | Notes on the move |
|---|---|
| **Import registered teams** | Needs an age-group picker (on `/scores` it used the Manager area's selected group). ⚠️ Every `saveDraw` call must keep going through `withTeamNames()` — that rule is what stops parents seeing raw team codes. |
| **Publish all / Unpublish all** | Age-group-independent; straight port. `/manager` keeps per-group publish. |
| **Scoring rules editor** | Per age group — shares the tab's age-group picker. `saveScoringRules` is currently called from `Scores & Standings.dc.html` and nowhere else. |
| **Simulate whole tournament / Reset the simulation** | The logic lives as component methods in the Scores page (e.g. `runSimulateTournament()`), not in the data layer — this is a transplant of methods + markup, the heaviest move. Its fire-and-forget/`flush()` test pattern comes with it. |

All four are organiser-scoped already; server-side permission checks don't
change. `/organizer` already loads `scores-data.js` (the registration-window
trade), so the data-layer calls these tools make are reachable from there.

**Accepted cost:** `Organizer.dc.html` (2,697 lines) grows, and splitting it
up is already a flagged background item. The trade is fine — `/scores` loses
far more than `/organizer` gains, and the split can happen later.

## What is duplicated and just goes

- Manager sign-in (password + Google) and score entry — `/manager` has both
  score entry and sign-in. ⚠️ **But see "Why the two jobs travel together".**
- The draw / fixture editor — `/manager`'s Draw tab is the deliberate uniform
  port of it. ⚠️ Before deleting, drive both side by side on real data once —
  the equivalence was asserted by tests, never watched.
- Per-group publish and Republish — `/manager` has them. (Deleting `/scores`'
  Republish also deletes the known stale-closure publish-wrong-group bug's
  home — check `/manager`'s Republish for the same shape before assuming the
  bug only lived there.)
- Knockout generation and the whole-weekend clash check — `/manager` has both.
- Spirit of Rugby nominations — `/manager` has them too (verified 2 Aug).

**Bonus that falls out free:** parked item 5 (the two draw editors' pool
preference regexes disagree) ends by deletion — no reading rule changes.

## Why the two jobs travel together

Two capabilities exist ONLY in the `/scores` Manager area today:

1. **Manager self-signup** (invite code, password AND Google flows).
2. **Google sign-in for managers at all.** `Manager.dc.html` has
   username/password only — a Google-account manager signs in on `/scores`
   and `/manager` picks the session up from localStorage.

Job 1 deletes both homes. Job 2's unified sign-in page is the new home. So:
**job 1 alone on production would lock Google-account managers out and end
manager self-signup.** On the shared branch the gap only exists between
commits, which is fine — but the branch merges as a whole or not at all.

## `/app` follows

- Line ~962 "Full scores page" (public) — **keep**.
- Line ~1005 `act('tools')` → `location.href = '/scores'` — **repoint to
  `/manager`**. Its row copy ("Fixture editor, publishing, spirit award")
  still accurately describes `/manager`.
- `CLAUDE.md`'s sentence "the More tab links to /scores for that
  drag-and-drop work" — update with the link.

## The `/organizer` fallback redirect follows too

`organizer-data.js` `login()` currently signs a manager in and redirects to
`/scores` — which after this job has nothing for them. **In job 1, repoint
that redirect to `/manager`.** (Job 2 then deletes the whole fallback hack —
that is its point.)

## Test impact — job 1

Must pass **byte-unchanged** at every step (Jay's gate): `test-accounts.js`,
`test-session-permissions.js`, `test-google-auth.js`, `test-functions-load.js`.
Nothing in job 1 touches auth code, so these should stay green untouched — if
one goes red, the change is wrong, not the test.

| Test file | What happens |
|---|---|
| `test-scores-draw-editor.js` | Its subject is deleted → file deleted, removed from `runall.ps1` in the same commit. |
| `test-simulate-tournament.js`, `test-simulate-spirit-award.js` | Repointed to drive the tool in its new `/organizer` home. |
| `test-cleanup.js` (jay-pc `adhjrt-sim`, NOT in repo) | Subject deleted → obsolete. Jay deletes it from `adhjrt-sim` (a session can't; it's outside the repo). |
| `test-fixtures-results-sync.js`, `test-team-logos.js`, `test-fixtures-logos.js`, `test-knockout-brackets.js`, `test-sponsors.js` | Cover the public half — must stay green through the deletion. Any anchor that read manager-area markup gets re-anchored, each with its own injected fault (a widened/moved anchor is a check with less to say). |
| **New:** assertions on what REMAINS | The headline lesson: a deletion this size (the Manager area is most of 3,819 lines) is one bad selection from deleting more, and absence-only checks pass on an empty page. New checks DRIVE the public page (build() pattern): standings render, brackets render, footer sign-in link present, no `Manager area` tab, no login markup. |

⚠️ The 2 Aug club-form removal left a dangling unterminated block comment that
silently disabled four unrelated methods while `node --check` passed. Same
class of risk here, bigger file. Component-driving tests, not just source
checks, on every deletion commit.

## Commit shape (all on the one branch off `dev`)

1. Move Publish all / Unpublish all → `/organizer` (new Tournament tab), +tests
2. Move Import registered teams, +tests (age-group picker, `withTeamNames` rule)
3. Move scoring rules editor, +tests
4. Move Simulate / Reset, repoint its two test files
5. **Verify stores empty**, then delete the rehearsal-data panel (and its
   "Remove orphans" button)
6. Repoint `/app` tools link and the organizer-data fallback redirect; CLAUDE.md
7. Delete the Manager area from `/scores`; add footer sign-in link; delete
   `test-scores-draw-editor.js` from disk and `runall.ps1`; add the
   what-remains tests

Each commit: full suite green (26 files) + fault-injection pass, before the
next starts. Job 2's commits follow on the same branch — see its spec.
