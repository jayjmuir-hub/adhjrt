# Registration live rehearsal — prove the store end to end on the live site

Puts one test team and one test player through the real registration forms on
the live site. It follows them into the store, the snapshot email and the
export, then through a delete and a restore, and removes them again. It is also
the pattern to follow after **any** change to the submission path
(`submit-registration.js`, `_intake.js`, `_regstore.js`). Why the store exists:
`claude/decisions/2026-09-10-registrations-live-in-a-write-once-store.md`.

## When to use

- Before registration opens to clubs, and **before** the Google Sheets cutover
  (`runbook-google-sheets-cutover.md`), which must not start until this has
  passed. Tracked in Linear as JRT-1.
- After any change to the submission path has been deployed.

## Before you start

- The one-off PC setup in `runbook-registrations-restore-and-delete.md` →
  *Before you start* (Netlify CLI installed, `netlify login`, `netlify link`)
  is done on the PC you will use.
- Use a club name that **starts with the word `Rehearsal`**, for example
  `Rehearsal Quins`. The store marks a record as a rehearsal by that prefix
  (`isRehearsal()` in `netlify/functions/_regstore.js`: whole word, any case),
  and `delete --rehearsal` removes only marked records.
  `Rehearsals FC` does **not** count.
- ⚠️ The organiser page shows **no** rehearsal badge. You find rehearsal rows
  by the club name. Do not go looking for a marker.
- **Snapshots cannot be triggered by hand.** The snapshot function uses the
  same `registrationState()` check as the forms, so while registration is open
  one arrives every hour. That includes **Force open**. On a closed store the
  only snapshot is the 22:00 UTC run (02:00 Abu Dhabi), and the rehearsal then
  spans more than one day. Detail: `runbook-registrations-restore-and-delete.md`
  → *When the next snapshot arrives*.
- Note the Registration tab's current mode before you change it, so you can
  put it back.

## Steps

1. **In `/organizer` → Registration tab:** if the forms are not open, choose
   **Force open** and save. The public page shows a TEST MODE strip for as
   long as it is on.
2. **On the live site:** register one team, then one player, for club
   `Rehearsal Quins`, through the real forms. Confirm **both confirmation
   emails arrive**. If an email does not arrive, stop here: nothing later in
   this runbook can explain it.
3. **In `/organizer` → Registrations tab:** find both records by the club
   name. **In `/manager`**, for that team's age group, check the team is
   listed.
4. **In Outlook (the registrations mailbox):** wait for the next snapshot
   email. Its subject ends `— REHEARSAL`. Open the CSV attachments, and save
   the `.json` attachment to a folder **outside the repo** (for example
   `C:\Users\<you>\Downloads\snap.json`).
5. **In `/organizer` → Registrations tab:** press **Export CSV** and open the
   file. Keep it outside the repo; step 7 compares against it.
6. **In PowerShell, in the repo folder:** remove the rehearsal records with
   `runbook-registrations-restore-and-delete.md` § B, using the `.json` from
   step 4. **In `/organizer`:** both records are gone.
7. **In PowerShell:** `check`, then `restore`, from the same `.json`, as in
   `runbook-registrations-restore-and-delete.md` § A. **In `/organizer`:** both
   records are back. Export again and compare with the file from step 5. The
   two records must be identical.
8. **In Outlook:** wait for a snapshot taken **after** the restore (the delete
   refuses a snapshot older than the newest record) and save its `.json`. Then,
   **in PowerShell**, run § B again.
9. **Refusal checks, only when the change was to the submission path:**
   - **In a browser:** edit the page to submit a team with more players than
     its squad cap, and confirm the refusal sentence comes from the server.
   - **In `/organizer` → Registration tab:** choose **Force closed**, submit
     again, and confirm the answer is *"Registration is not open at the
     moment…"*.
   - Clear any record these checks created with § B, as in step 8.
10. **In `/organizer` → Registration tab:** put the mode back to what you noted
    in *Before you start*. That is normally **Follow the dates**.

## How to verify

- Both confirmation emails arrived (step 2).
- The snapshot subject said `REHEARSAL` while rehearsal records existed.
- The records came back identical after the restore (step 7).
- **In `/organizer`:** no `Rehearsal…` club remains, and the count of real
  rows is what it was before you started.
- The Registration tab mode is back to what it was. The TEST MODE strip is
  gone from the public page.

## If it fails

- **No confirmation email, but the record is in the store:** saving works and
  email does not. Check the mail variables exist in Netlify (names only:
  `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MAIL_FROM`). See
  `RESTORE.md` § Environment variables.
- **The form refuses with "Registration is not open":** step 1 did not save,
  or someone changed the mode back. Check the Registration tab preview.
- **The tool prints a `REFUSED:` line:** find that line in
  `runbook-registrations-restore-and-delete.md` and follow it. A refusal
  never writes anything.
- **The restored record differs from the export:** stop. Do not run the
  cutover. Keep both files outside the repo, and record the difference in
  Linear against JRT-1.
