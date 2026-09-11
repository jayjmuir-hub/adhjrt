# Registrations are write-once records in Netlify Blobs, backed up by emailed snapshots that always arrive

**Ruling.** Each accepted submission is one record in the `registrations` store, its row in sheet column order. The store refuses an existing key and has no update. A correction is a new record that `supersedes` the old one; readers hide the superseded record. A club name starting `Rehearsal` marks a rehearsal record. `runSnapshot` sends CSVs plus a machine file hourly while the window is open, nightly otherwise, and always emails: if the store cannot be read the subject says FAILED; if any record is malformed or unreadable it says INCOMPLETE and how many are missing. The recipient is `MAIL_FROM` only; a request cannot change it. Restore and delete exist only in the command-line tool, under its own card.

**Why.** Organisers only read registrations, and the site already has a reader. The sheets lived in a volunteer's personal account behind a leakable key. A backup that fails silently is found out on the day it is needed.

**Against, and why it lost.** Sheets has free version history; snapshots plus a rehearsed restore replace it. Supabase adds a provider, and its free projects pause on idle.

**Replaces.** Google Sheets as the registration store.

**Where in the code.** `netlify/functions/_regstore.js`, `netlify/functions/_snapshot.js`, `netlify/functions/snapshot-registrations.js`, `tests/test-regstore.js`, `tests/test-snapshot.js`.
