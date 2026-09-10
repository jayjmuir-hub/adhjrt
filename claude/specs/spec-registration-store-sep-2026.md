# Spec — registrations move from Google Sheets to Netlify Blobs

**Status: SPECCED 10 Sep 2026, not yet built.** Jay: *"this is for this
year"* — finished and rehearsed before registration opens in early October
2026. Decisions in § 10 were all taken in the discussion of 10 Sep; none is
open.

## 1 · The problem, in one paragraph

Every accepted registration — a child's name, date of birth, medical note
and a parent's contact — is appended to one of three Google Sheets that live
in Jay's personal Google account, written by a service account whose private
key sits in Netlify. Organisers only ever READ those sheets (Jay: *"organizers
should never really edit the sheets, they basically just read them"*), so the
spreadsheet is a viewer, not a workspace, and the site already has a viewer:
the organiser page. What the sheets add is a dependency on Google, a key that
can leak, a tab-name quirk that has broken the site twice, and children's
data owned by a volunteer rather than by the tournament. This spec moves the
store to Netlify Blobs — which already holds accounts, results, schedules and
the failed-submission dead letter — and replaces the one thing Sheets did
better, its version history, with an emailed snapshot and a rehearsed
restore.

## 2 · What exists today — measured from the code, 10 Sep 2026

| Piece | File | What it does with the sheets |
|---|---|---|
| The front door | `netlify/functions/submit-registration.js` | `appendRow` writes one row per accepted submission; `readTeamsSheet` reads the teams sheet to compute the next team number |
| The decisions | `netlify/functions/_intake.js` | Dependency-free. `FORMS[form].sheetEnv` names the sheet; `range` names the columns. Validation, allow-list, honeypot and rate limit all run BEFORE the append |
| Organiser reader | `netlify/functions/get-registrations.js` | Reads teams, players and clubs sheets; answers the organiser page |
| Manager reader | `netlify/functions/get-my-registrations.js` | Reads teams and players; filters to the age group in the signed token |
| Google client | `netlify/functions/_sheets.js` | Service-account auth, private-key repair, first-tab lookup. Not loadable by a test |
| Dead letter | `submit-registration.js` `parkFailed` | Writes a failed submission to `config/failed-submissions/…` — a BLOB. So the fallback for a failed sheet write is already the store this spec moves to |

The pages (`Organizer.dc.html`, `Manager.dc.html` via `organizer-data.js`
and `scores-data.js`) call only the two reader functions. Nothing else in the
repo reads or writes a sheet. Three env vars name the sheets:
`GOOGLE_SHEET_ID_TEAMS`, `_PLAYERS`, `_CLUBS`; two carry the service account.

The sheets currently hold nothing that must carry over (Jay: *"nothing"*).
The new store starts empty.

## 3 · The record and where it lives

One Blobs store, `registrations`, opened through the existing `blobStore()`
helper. **One record per accepted submission.** Key:

    <form>/<ISO timestamp, filesystem-safe>-<6 random chars>

e.g. `player/2026-10-03T08-15-42-117Z-k3f9qa`. Keys sort in arrival order and
two submissions in the same instant cannot collide.

The record:

| Field | Meaning |
|---|---|
| `v` | Record format version, `1`. Restore and readers accept every version they know |
| `form` | `team-registration`, `player-registration` or `club-registration` |
| `receivedAt` | ISO stamp, server clock |
| `row` | The cleaned values in the SAME column order `_intake.js` uses for the sheet today, so nothing downstream learns a new layout |
| `rehearsal` | `true` when the club name starts with `Rehearsal` (case-insensitive). Self-declaring, so the delete tool can remove rehearsal records alone |
| `supersedes` | Optional. The key of an earlier record this one replaces. Readers hide the earlier one |

**The rule that makes everything else safe: the store module exposes a
write that REFUSES if the key already exists, and no update at all.** A
correction is a new record carrying `supersedes`. No code path can overwrite
a child's registration, because none has the ability.

## 4 · The write path

`submit-registration.js` changes only at its last step. Validation,
allow-list, honeypot and rate limit run exactly as now, in `_intake.js`,
untouched. `appendRow` writes a record through the store module instead of a
sheet row. `readTeamsSheet` becomes a count of existing team records for the
same numbering. A failed store write is parked by the existing dead letter
and the confirmation email is NOT sent — a coach never receives a team code
for a registration that was not saved. That is today's behaviour, kept.

Nothing a coach or parent sees changes: same fields, same wording, same
errors, same email, same team code.

## 5 · The read path and export

`get-registrations.js` and `get-my-registrations.js` list the store and
answer in the shape the pages expect today, so the pages do not change.
Organisers see everything; a manager sees their own age group, from the
signed token, never the request (unchanged, `RESTORE.md` § Sensitive data).
Superseded records are hidden but kept. Rehearsal records are shown to
organisers with a visible marker so a rehearsal is never mistaken for a
real club.

**Export**: a button on the organiser page's registrations tab calls a new
organiser-only function that returns plain CSV, one file per form, which
Excel and Sheets open directly. It contains exactly what the organiser page
already shows — it widens nobody's access.

## 6 · The snapshot

A scheduled function, `snapshot-registrations.js`: nightly, and hourly while
the registration window is open (read from the same `_registration.js`
setting the homepage uses). It lists every record and emails TWO
attachments to the registrations mailbox through the Microsoft Graph
permission that already exists in `_email.js`:

1. the readable CSV set, for humans;
2. a machine file — every record exactly as stored, including its key. This
   is the ONLY thing restore reads. Readable columns can be reformatted by a
   spreadsheet (a leading `+` on a phone number is the known case) and a
   restore built from them would quietly corrupt what it puts back.

Subject line: the date, the record count per form, and `REHEARSAL` if any
rehearsal record is present. **If the store cannot be read, the email still
goes, saying so** — a snapshot that fails silently is not a snapshot. Mail
goes only to `MAIL_FROM`'s own mailbox, never to an address from anywhere
else.

Why the mailbox and not a drive: the tournament's Microsoft 365 is GoDaddy's
Email Essentials — mail only, no OneDrive or SharePoint (checked by Jay,
10 Sep). The Google account is Jay's personal one. The mailbox is the one
store the tournament owns, needs no new licence, and each email is a dated
copy, so the history is the inbox.

## 7 · The command-line tool and its runbook

`tools/registrations-admin.js` (the `tools/` folder is already 404'd from
the served site). It reaches the store through the Netlify CLI, which Jay
signs into ONCE through a browser window — the same shape as the git push
credential. **No token in any file, ever.** Three modes:

| Mode | Does | Writes? |
|---|---|---|
| `check <snapshot file>` | Compares the machine file with the store; prints missing / present / rehearsal counts | No |
| `restore <snapshot file>` | Writes back ONLY records missing from the store. Refuses unless `check` ran on the same file first | Missing records only. Never overwrites |
| `delete --rehearsal` / `delete --all` | Removes records. Prints the count first; `--all` requires the word `ALL` typed; both refuse unless a snapshot newer than the newest record exists, confirmed by pasting that snapshot's date | Deletes |

Running it twice is harmless. Restoring after a partial loss puts back only
what went missing and leaves newer registrations alone. Whoever runs it —
usually a Claude session on Jay's PC at Jay's word, but the runbook is
written for a person and must not depend on one being available.

`claude/runbooks/runbook-registrations-restore-and-delete.md` carries three
procedures — restore, clear rehearsal, end-of-season delete — each with the
exact command, what good output looks like, what bad output looks like. The
end-of-season procedure includes deleting the snapshot emails from the
mailbox by hand, because they hold the same data.

**Retention is MANUAL.** Jay: *"lets give it a manual option, not an
automatic date or time period"*. Nothing fires on a date. The rule that the
data is deleted after the tournament is written in the runbook; the trigger
is a person.

## 8 · Roles

No new role. The code has two, organiser and manager, all organisers equal,
no owner (`_auth.js` `hasAgeGroupAccess`; `organizer-signup.js` only
auto-approves the first). Restore and delete live in the CLI tool, not on
any page, so no organiser can trigger them from a browser. If an owner flag
is ever wanted for other reasons, restore can move onto the page then.

## 9 · What is NOT built

- No automatic deletion (§ 7).
- No in-place editing of a registration by anyone. A correction is a new
  record (§ 3). If organisers ever need to edit, that is a new spec.
- No maintained index. A few hundred records list fast enough.
- No Supabase. Considered (§ 11) and rejected.
- The rate limiter's fail-open stays as it is. It is the last of four guards
  and the trade still holds with the site password off; confirmed in the
  10 Sep discussion.

## 10 · Decisions taken, with the arguments against

**A — Move this year, not after November.** Against: it is the one path
that must work in October, rebuilt four weeks out. For: after October it is
a migration of real children's data every time; this is the last cheap
moment for years. Mitigation: the rehearsal in § 12 and Sheets left in place
until it passes.

**B — Blobs, not Supabase.** Against Blobs: no dashboard, no built-in undo.
Against Supabase: a new provider to own (a trial project was created and
deleted 8 Sep), a client dependency and a server key, row-level security in
SQL that fails silently when wrong, no backups on the free tier, and free
projects PAUSE after a week idle — the first person to open registration in
September would find a broken form. The scale is a few hundred records read
by a handful of people; Supabase's strengths (queries, many writers, a
dashboard for non-users of the site) do not apply.

**C — Blobs, not "lock Sheets down".** Against moving: Sheets has version
history for free and organisers know it. For moving: organisers only read,
and the site already has the reader; the sheets live in a personal account;
the service account key and tab-name quirk go away. Version history is
replaced by § 6 and § 7 together.

**D — Snapshot to the mailbox, not a drive or a Google account.** Against:
organisers read a CSV attachment instead of a live sheet; restore needs a
download step. For: zero new accounts, zero cost, data stays in the
tournament's own domain, history is the inbox. Alternatives priced: a
tournament Gmail (a shared password nothing enforces), Google Workspace or a
GoDaddy plan upgrade (a licence bought for one snapshot).

**E — Restore and delete from the command line, not the page.** Against: a
restore needs a keyboard, not an organiser on a phone. For: it is a
once-in-years action, the operator should be reading a runbook anyway, and
the flat role model stays flat.

**F — Manual retention.** Against: a rule nobody triggers is a rule that
rots. For: Jay's call, and an automatic delete on a wrong date is
unrecoverable in exactly the way this spec exists to prevent. The runbook
names the procedure; state-of-play records whether it has been run.

**G — Rehearsal records self-declare by club name.** Against: a real club
called "Rehearsal…" is impossible, but a rehearsal that forgets the prefix
becomes a "real" record. For: no hidden flag on the form, no second code
path, the delete tool can scope to rehearsal only, and the snapshot subject
shouts REHEARSAL. The runbook says to use the prefix.

## 11 · Arguments against the whole thing, for the next person who makes them

- *"Sheets works and organisers like it."* True; they read it. The organiser
  page shows the same rows and the export gives a spreadsheet on demand.
- *"Blobs has no undo."* Correct, and § 3 (never overwrite) plus § 6
  (hourly snapshots in season) plus § 7 (rehearsed restore) is the answer.
  Losing data needs a provider-level loss and a failed snapshot on the same
  day.
- *"A Google Workspace Shared Drive fixes ownership without any code."* It
  does, at a monthly cost, and leaves the key, the quirk and the provider.
- *"This is a lot to build before October."* The surface is one writer,
  two readers, three sheets. The pages do not change. The riskiest part is
  the snapshot mailer, and it reuses `_email.js`.

## 12 · Proof

**Tests, each proven red against an injected fault before it is trusted
(`CLAUDE.md` rules 6 and 7):**

| Check | Fault that must turn it red |
|---|---|
| Store write refuses an existing key | Make the write overwrite |
| Record carries the sheet column order | Swap two columns |
| Rehearsal flag set by prefix | Drop the prefix test |
| Team numbering counts team records | Count player records instead |
| Failed store write parks the submission and sends no email | Send the email anyway |
| Readers hide superseded records | Show them |
| Manager reader filters by token age group | Filter by the request instead |
| Snapshot includes every record | Skip the last one |
| Snapshot email goes even when the store read fails | Swallow the error |
| Snapshot recipient is `MAIL_FROM` only | Take a recipient from input |
| Restore writes only missing records | Make it overwrite a present one |
| Restore refuses without a prior check | Drop the check gate |
| Delete refuses without a newer snapshot | Drop the snapshot gate |
| Delete `--rehearsal` leaves real records | Delete one real record |

The store module, snapshot builder and restore/delete logic are
dependency-free with the store passed in, the same pattern as `_intake.js`
and `_ratelimit.js`, so the suite proves them without `node_modules`.
The prover's second number (`M suite(s) clean`) must go UP by the number of
new test files.

**Rehearsal, on the live site, by 30 Sep 2026, before Sheets is switched
off:**

1. Register a team and a player through the real forms for club
   `Rehearsal Quins`.
2. See both on the organiser page with the rehearsal marker; see the team in
   a manager view for its age group.
3. Receive a snapshot email; open both attachments.
4. Export from the organiser page; open the CSV.
5. `delete --rehearsal`; confirm the organiser page is empty.
6. `check` then `restore` from the snapshot; confirm both records are back
   and byte-identical to the export from step 4.
7. `delete --rehearsal` again.

Only after step 7 passes: remove the five Google env vars from Netlify,
delete `_sheets.js` and the sheet branches of the three functions with a
tombstone in `RESTORE.md`, and Jay archives or deletes the sheets when he
chooses.

## 13 · Build order

1. Store module + tests.
2. Front door write path + tests.
3. Two readers + tests. Pages unchanged.
4. Export function + button + test.
5. Snapshot function + tests.
6. CLI tool + tests.
7. Runbook.
8. Rehearsal (§ 12). Then cutover.

Each step lands on `dev` and is looked at on the free branch URL. One
production deploy when the whole thing is ready for the rehearsal, one more
for the cutover.
