# Registrations — restore from a snapshot, clear a rehearsal, delete at season end

**Purpose.** The registrations store (Netlify Blobs, store name read from
`netlify/functions/_regstore.js`) has no undo built into the website. Its only
copy is the snapshot email sent to the tournament's own mailbox. This runbook
is how a person — not an AI session — puts records back, removes rehearsal
records, or deletes everything after the tournament, using
`tools/registrations-admin.js` on a PC. Ruling:
`claude/decisions/2026-09-10-registration-restore-and-delete-are-command-line-only.md`.

**When to use.**
- **Restore (A):** records are missing from the organiser page's Registrations
  tab that were there before — an accidental delete, a bad deploy, anything
  that leaves the store short of what the last snapshot recorded.
- **Clear a rehearsal (B):** after a rehearsal has been run through the real
  registration form, using a club name starting `Rehearsal`, and you want
  those records gone before the site goes live for real clubs.
- **Season end (C):** when the maintainer decides the season's data is no longer needed.
  Nothing about this is automatic — **retention is entirely manual.** No
  schedule, no expiry, no scheduled function deletes anything. It happens only
  when a person runs the command below.

**Before you start — once per PC.**

1. **In PowerShell:** check whether the Netlify CLI is already installed —
   `netlify --version`. If that fails, install it: `npm install -g netlify-cli`.
2. **In PowerShell, in the repo folder:** `netlify login` — a browser window
   opens; sign in with the Netlify account that has access to this project.
   Then `netlify link` and pick the `adhquins-jrt` site when it asks. Both
   commands are one-off per PC and store nothing in the repo — the tool reads
   your CLI login, never a token in a file or an environment variable (see the
   comment at the top of `tools/registrations-admin.js`).
3. **In Outlook** (the registrations mailbox): find the newest email whose
   subject starts `ADH JRT registrations snapshot`. It carries one `.json`
   attachment (named `registrations-<timestamp>.json`) and three `.csv`
   attachments (`registrations-team.csv`, `registrations-player.csv`,
   `registrations-club.csv`). Save the **`.json`** attachment to a folder
   **OUTSIDE the repo** — for example `C:\Users\<you>\Downloads\snap.json`. Never
   save it inside the `adhjrt` folder: the repo root is the deployed website,
   and anything committed there gets served publicly. The `.csv` files are for
   reading in a spreadsheet only; none of the three procedures below reads
   them — the tool reads only the `.json` file.

Every command below is run **in PowerShell, in the repo folder** (the folder
containing `tools\registrations-admin.js`), on a PC where step 1–2 above have
already been done. `check` never writes; `restore` and `delete` do.

---

## A · Restore

Use when records that used to be on the organiser page's Registrations tab
are missing, and you have a snapshot `.json` from before they went missing.

1. Run a dry check first — it writes nothing:

   ```
   node tools/registrations-admin.js check C:\Users\<you>\Downloads\snap.json
   ```

2. Read the printed lines. Good output looks like:

   ```
   snapshot taken: 2026-09-01T02:00:00.000Z   records in snapshot: 214
   store: 198 record(s)
   missing: 16   present: 198   rehearsal: 0 (among missing)
   check only — nothing written
   ```

   **Good:** `missing` is the number you expected to be missing (for example,
   16 records you know were lost). **Bad:** `missing` is far larger than you
   expected, or close to `records in snapshot` — that suggests the live store
   itself is nearly empty, not that a few records were lost. Stop and check
   the Netlify status page and the `/organizer` Registrations tab before going
   on; restoring on top of a store that is failing to serve records will not
   fix the underlying problem.

3. If the check line reads `REFUSED: N record(s) in the store could not be
   read: <keys>. Nothing written — a partial read of the store is not enough
   to trust a missing/present count or a restore.` — the tool has found
   records in the store it could not read back (a network blip, an expired
   CLI login, or genuine corruption). It refuses to guess at a missing/present
   count from a partial picture, and check mode exits without printing
   `missing:`/`present:` at all. Re-run the same `check` command once — a
   transient read failure usually clears. If it refuses again, note the keys
   it names and stop; do not proceed to restore until a person who can read
   the Netlify Blobs UI directly has confirmed what those keys hold.

4. Once `missing` looks right, run the restore, giving `--confirm` the exact
   number `check` printed for `missing` (this is a deliberate safety check —
   the tool will not add records unless you name the count you expect):

   ```
   node tools/registrations-admin.js restore C:\Users\<you>\Downloads\snap.json --confirm 16
   ```

   Good output is one `restored <key>` line per record added, ending with
   `done: 16 record(s) restored`. Restore only ever **adds** records that are
   missing from the store — it never overwrites a record that is already
   there, however different it might be from the snapshot.

5. **Verify:** open `/organizer` → Registrations tab. The previously missing
   rows are back, and the total count matches `records in snapshot` from
   step 2 (assuming nothing new was legitimately deleted since that snapshot
   was taken).

6. **If it fails:**
   - `REFUSED: restore needs --confirm <N> (the missing count check printed).
     Nothing written.` — the number after `--confirm` did not match the
     current `missing` count. Something changed between your `check` and your
     `restore` (a new registration arrived, or someone else ran a restore).
     Re-run `check`, read the new `missing` number, and use that number.
   - `REFUSED: N record(s) in the store could not be read: <keys>. …` — same
     meaning as step 3, but during restore. Nothing is written when this
     happens. Follow step 3's advice.
   - `ERROR: <message>` — this is a genuine failure talking to Netlify, not a
     safety refusal. It almost always means the CLI is not signed in or the
     folder is not linked on this PC. Go back to step 2 of **Before you
     start** and repeat `netlify login` / `netlify link`, then start again
     from step 1 above.
   - `REFUSED: not a v1 snapshot file: <path>` — the file you pointed at is
     not a snapshot `.json` at all (wrong file, or a `.csv` was given by
     mistake). Go back to Outlook and re-save the correct `.json` attachment.
   - `REFUSED: N record(s) in the snapshot file have no key…` — the snapshot
     file itself is damaged: it holds records the tool can neither look for in
     the store nor write back, so any count it printed would describe a
     restore that quietly leaves them out. Nothing is written. Re-save the
     attachment from Outlook in case the download was truncated; if it says
     the same thing again, use an earlier snapshot email instead and treat the
     damaged one as unusable.
   - `REFUSED: wrote "<key>" but reading it back did not return what was
     written. STOPPED at this key…` — the tool wrote a record and then read it
     straight back, and got something different. It stops at the FIRST such
     key rather than writing the rest the same broken way. **Do not re-run
     restore.** The store may now hold a bad record at that key, and because
     restore only ever *adds*, a later restore would treat that key as already
     present and skip it for good. Get a person who can open the Netlify Blobs
     UI to look at that key and delete it if it is empty or malformed; then
     start again from step 1.

---

## B · Clear a rehearsal

Use after a rehearsal registration has gone through the real form using a
club name starting `Rehearsal`, and you want those test records removed
before real registrations arrive.

1. **Wait for** a snapshot email sent **after** the last rehearsal record was
   written. Its subject line will end `— REHEARSAL` (the tool adds that suffix
   automatically whenever any record in the store is marked as a rehearsal
   record). Save its `.json` attachment as in **Before you start**, step 3.

   ⚠️ **There is no way to trigger a snapshot by hand.** See *"When the next
   snapshot arrives"* at the end of this runbook. While registration is open
   one arrives every hour; when it is closed the only one is the **22:00 UTC**
   run, which is **02:00 in Abu Dhabi** — so if the store is closed, this step
   means waiting until tomorrow morning. Plan the rehearsal around that.

2. Run:

   ```
   node tools/registrations-admin.js delete --rehearsal --snapshot C:\Users\<you>\Downloads\snap.json
   ```

   (The `--snapshot` flag is required for every delete — the tool refuses to
   delete anything without a fresh copy in hand first.)

3. Good output starts with `deleting K rehearsal record(s)`, then one
   `deleted <key>` line per record, ending `done: K deleted`. This mode only
   ever removes records whose stored data marks them as a rehearsal record —
   real club/team/player records are never touched by `--rehearsal`.

4. **Verify:** `/organizer` → Registrations tab shows no row marked as
   rehearsal, and the count of real (non-rehearsal) rows is unchanged from
   before you ran this.

5. **If it fails:**
   - `REFUSED: snapshot <timestamp> is older than the newest record
     <timestamp>. Take a fresh snapshot first.` — a record (rehearsal or
     otherwise) was written to the store after the snapshot you gave it was
     taken. The tool refuses to delete against a stale snapshot, because an
     old snapshot might not be a true copy of what is about to be deleted.
     **Wait for the next scheduled snapshot** — there is no way to trigger one
     by hand; see *"When the next snapshot arrives"* at the end of this
     runbook — then save the new `.json` and try again from step 2.
   - `REFUSED: N record(s) in the store could not be read: <keys>. Nothing
     deleted — an unreadable newest record could let a stale snapshot through
     the freshness gate.` — same underlying problem as Procedure A step 3.
     Nothing is deleted. Re-run once; if it persists, stop and get a person
     who can read Netlify Blobs directly to look at the named keys.
   - `REFUSED: N record(s) in the store carry no usable receivedAt…` — a
     record in the store does not say when it arrived, so the tool cannot tell
     whether your snapshot was taken after it. Rather than let one undated
     record switch the freshness check off for every other record, it refuses.
     Nothing is deleted. Get a person who can read the Netlify Blobs UI to look
     at what is in the store before deleting anything.
   - `REFUSED: say exactly one of --rehearsal or --all` or `REFUSED:
     --snapshot <file> is required — a delete needs a copy first` — a typo in
     the command. Re-type it exactly as shown in step 2.
   - `ERROR: <message>` — same meaning as Procedure A step 6: the CLI is
     probably not signed in or linked. Redo **Before you start**, step 2.

---

## C · Season-end delete (everything)

Use only when the maintainer has decided the season's registration data is no longer
needed. This removes **every** record in the store — real and rehearsal
alike. There is no scheduled or automatic version of this; it only happens
when someone runs it.

1. Get confirmation from the maintainer in writing (email or a message you can point
   back to) that the data is to be deleted. This step is not enforced by the
   tool — it is a human check because the next step is not reversible from
   inside the tool.

2. Save the newest snapshot `.json` (repeat **Before you start**, step 3). It
   must have been sent **after** the last record was written, so that it covers
   every record currently in the store. If it was not, **wait for the next
   scheduled one** — there is no way to trigger a snapshot by hand; see *"When
   the next snapshot arrives"* at the end of this runbook.

3. Run:

   ```
   node tools/registrations-admin.js delete --all --snapshot C:\Users\<you>\Downloads\snap.json --confirm ALL
   ```

   `--confirm ALL` must be typed in upper case exactly as shown — this is
   deliberately not a yes/no prompt, so it cannot be clicked through by
   accident.

4. Good output starts with `deleting K record(s)`, then one `deleted <key>`
   line per record, ending `done: K deleted`, where `K` is every record that
   was in the store.

5. **If it fails:**
   - `REFUSED: snapshot <timestamp> is older than the newest record
     <timestamp>. Take a fresh snapshot first.` — a record was written to the
     store after the snapshot you gave it was taken. The tool refuses to
     delete against a stale snapshot, because an old snapshot might not be a
     true copy of what is about to be deleted — and for this procedure that
     copy is the only record of the data left once the delete runs. **Wait for
     the next scheduled snapshot** — there is no way to trigger one by hand;
     see *"When the next snapshot arrives"* at the end of this runbook — then
     save the new `.json` and try again from step 2.
   - `REFUSED: N record(s) in the store could not be read: <keys>. Nothing
     deleted — an unreadable newest record could let a stale snapshot through
     the freshness gate.` — same underlying problem as Procedure A step 3.
     Nothing is deleted. Re-run once; if it persists, stop and get a person
     who can read Netlify Blobs directly to look at the named keys.
   - `REFUSED: N record(s) in the store carry no usable receivedAt…` — a
     record in the store does not say when it arrived, so the tool cannot tell
     whether your snapshot was taken after it. Rather than let one undated
     record switch the freshness check off for every other record, it refuses.
     Nothing is deleted. Get a person who can read the Netlify Blobs UI to look
     at what is in the store before deleting anything.
   - `REFUSED: --all needs --confirm ALL (upper case)` — the command was
     missing `--confirm ALL`, or it was typed some other way (lower case
     `all`, or `--confirm all`). The word must be exactly `ALL`, upper case,
     nothing else. This check exists so the season's entire dataset cannot be
     deleted by clicking through a prompt or by a slightly-wrong command that
     happens to run — re-type the command exactly as shown in step 3, with
     `--confirm ALL` at the end.
   - `ERROR: <message>` — same meaning as Procedure A step 6: the CLI is
     probably not signed in or linked. Redo **Before you start**, step 2, then
     start again from step 2 above.

6. **Verify:** `/organizer` → Registrations tab is empty — no rows of any
   kind, real or rehearsal.

7. **In Outlook:** delete every email whose subject starts `ADH JRT
   registrations snapshot` (including any `FAILED` or `REHEARSAL` ones — they
   carry the same underlying data or describe it), then empty Deleted Items so
   they are not merely hidden. They hold exactly the same personal data as the
   store you just deleted, so leaving them in the mailbox defeats the point of
   deleting the store.

8. **On this PC (and any other PC or folder where a snapshot was ever saved):**
   delete every downloaded `.json` and `.csv` attachment from step 2 of
   **Before you start** and from any earlier restore/clear you have done.
   Check `Downloads` and anywhere else a snapshot was ever saved to, on every
   PC that has been used for this runbook.

9. Record the date this was done in the season tracker (outside this repo —
   as a comment on the Linear ticket, team "ADH JRT Team";
   this runbook itself carries no dates).

---

## ⚠️ When the next snapshot arrives — there is no way to trigger one

**A snapshot cannot be triggered by hand. Not from a page, not from a URL,
not from the command line.** `snapshot-registrations.js` is a Netlify
*scheduled* function: Netlify invokes it on a timer, and a scheduled function
is not reachable over HTTP, so there is no address anyone could visit to make
one happen. (`_snapshot.js` has a `force` option; it exists for the test suite
and has no production caller. The comment beside it says why adding a trigger
would be a bad idea: it would be a way to make the site email every
registration on demand, and the mailbox is the only copy of that data there
is.)

So the only question is **when the next one arrives**:

| Registration window | Snapshots |
|---|---|
| **Open** | one every hour |
| **Closed** | **one a day, at the 22:00 UTC run — 02:00 in Abu Dhabi** |

⚠️ **Plan a rehearsal around that.** The rehearsal in the spec's § 12 needs a
snapshot at two separate steps (once to `check`/`restore` from, and once more
before the second `delete --rehearsal`). Outside the registration window that
means **the rehearsal spans more than one day** — do the steps up to the first
snapshot on day one, and finish the next morning once the 22:00 UTC email has
landed. It is not a rehearsal that can be done in one sitting on a closed
store, and finding that out halfway through is a bad afternoon.

## Verify a snapshot is arriving at all

The registrations mailbox should be receiving one snapshot email per hour
while registration is open, and one a night otherwise (around 02:00 Abu Dhabi
time). Each subject line carries the record counts, for example `ADH JRT
registrations snapshot 2026-09-01 02:00 UTC — 12 teams, 84 players, 3 clubs`;
a subject ending `FAILED <time> UTC` means the store could not be read at
send time — the snapshot itself failed, not just this runbook, and needs
investigating on its own before you trust any procedure above.

⚠️ **A subject that says `INCOMPLETE` is the half-way case, and it is the
dangerous one.** It means the store read, but some of its records could not
be — so the email *does* carry attachments, they *are* usable, and they are
**short**. The subject names how many records are missing from the backup and
the body names their keys. **Do not restore or delete from an `INCOMPLETE`
snapshot**: a restore from it cannot put those records back, and a delete
against it would remove records the file does not contain. Get a person who
can read the Netlify Blobs UI to look at the named keys first.

**If no snapshot email has arrived in the last two days:** in **Netlify**, go
to the site → **Functions** → `snapshot-registrations`, and read its recent
invocation log. A scheduled function that is failing silently (rather than
sending the `FAILED` email above) will show its errors there even when the
mailbox shows nothing at all.
