# Google Sheets cutover — remove the old sheets path

Removes the Google Sheets code and credentials now that registrations live in
the store. No function writes to the sheets any more. What is left is dead
code (`_sheets.js`, the A1 ranges in `_intake.js`), five environment variables
and a Google service-account key. Why:
`claude/decisions/2026-09-10-registrations-live-in-a-write-once-store.md`.

## When to use

- **Only after `runbook-registration-live-rehearsal.md` has passed on the live
  site** (Linear JRT-1). This cutover is tracked as Linear JRT-2.
- Never as part of another change. It is a commit on its own.

## Before you start

- Work on `dev` (see `CLAUDE.md` → Working here). This is a code change, and
  it lands on `main` through `runbook-merge-dev-to-main.md`.
- Leave the `googleapis` and `google-auth-library` lines in `package.json`
  alone. Removing a dependency is a separate change with its own ticket.

## Steps

1. **In PowerShell, in the repo folder:** list every remaining sheet
   reference, one term at a time (rule 8: `-F`, no alternation):

   ```
   git grep -n -F GOOGLE_
   git grep -n -F _sheets
   git grep -n -F _RANGE
   git grep -n -F colLetter
   git grep -n -F sheetEnv
   ```

   As a control, `git grep -n -F _regstore` must find hits. Every hit from the
   first five searches is removed or repointed in this change.
2. **In the code:** delete `netlify/functions/_sheets.js`. In
   `netlify/functions/_intake.js`, remove `colLetter`, `TEAM_RANGE`,
   `PLAYER_RANGE` and `CLUB_RANGE`, each form's `range` and `sheetEnv`, and
   their exports. **Keep the column lists** (`TEAM_COLUMNS`,
   `PLAYER_COLUMNS`, `CLUB_COLUMNS`), because the stored record keeps their
   order.
3. **In the tests:** in `tests/test-intake.js`, remove the checks on the
   ranges, on `sheetEnv` and on the contents of `_sheets.js`. In
   `tests/test-functions-load.js`, drop the `GOOGLE_*` names from the list of
   dummy variables. In `tests/_prove-registration.js`, remove `_sheets.js` from
   `NEEDED` and **repoint** the faults that patch `_sheets.js` onto whatever
   now guards the same behaviour. Never just delete a fault (rule 6).
4. **In `RESTORE.md`:** add a tombstone saying what went and why. What went:
   `_sheets.js` (the service-account sign-in, the private-key repair and the
   first-tab lookup) and the A1 ranges in `_intake.js`. Why: the store
   replaced them.
5. **In PowerShell:** run the suite with `powershell tests/runall.ps1`. It must
   be green, and the prover's first number must be no lower than before.
6. **In PowerShell:** commit explicit paths only (`git rm` for `_sheets.js`,
   `git add` for each edited file), with `git commit -F`. When the maintainer
   says merge, land it through `runbook-merge-dev-to-main.md`.
7. **In Netlify** (the maintainer), **after** the deploy is live and a test
   registration has gone through: Site configuration → Environment variables,
   then delete `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEET_ID_TEAMS`,
   `GOOGLE_SHEET_ID_PLAYERS` and `GOOGLE_SHEET_ID_CLUBS`.
8. **In Google Cloud** (the maintainer): delete the service account's key.
9. **In Google Drive** (the maintainer, when they choose): archive or delete
   the team, player and club registration sheets.
10. **In Linear:** open the ticket to remove the two Google dependencies from
    `package.json`, and close JRT-2.

## How to verify

- `git grep -n -F GOOGLE_SHEET` finds nothing in `netlify/`, `tests/` or
  `tools/`, and the `_regstore` control still finds hits.
- **On the live site:** make one registration after step 7, using a
  `Rehearsal…` club. It reaches `/organizer` and sends its confirmation email.
  Then clear it with `runbook-registrations-restore-and-delete.md` § B.

## If it fails

- **The prover reports COULD NOT INJECT for a `_sheets.js` fault:** its anchor
  rotted when the file went. Repoint it in the same commit. Never delete it.
- **A function fails to load after the deploy:** something still `require`s
  `./_sheets`, and step 1 missed it. Run step 1 again and check the control
  still finds hits.
- **Registrations stop working after step 7:** a live path still read a
  `GOOGLE_*` variable. Put the variable back in Netlify and find what reads
  it. A restored variable only takes effect after a deploy (`RESTORE.md` §
  Changing a variable needs a deploy).
