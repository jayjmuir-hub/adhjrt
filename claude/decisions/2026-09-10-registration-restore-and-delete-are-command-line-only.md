# Restoring and deleting registrations happens only in a command-line tool, behind confirmations the tool computes itself

**Ruling.** Restore and delete exist only in `tools/registrations-admin.js`, never on any page or function, so no organiser can trigger either from a browser, and no new role exists. The tool reaches the store through the Netlify CLI, signed in once in a browser; no token sits in any file or the environment it reads. `restore` adds only records missing from the store, needs `--confirm N` where N equals the missing count the tool computes, and reads each write back, stopping at the first mismatch. Both delete modes need a `--snapshot` file taken at or after the newest record, refusing any undated or unreadable record. `delete --all` also needs `--confirm ALL`, upper case.

**Why.** Deleting children's registration data cannot be undone, so it sits behind a person at a terminal, a fresh backup, and a number they had to read. A button in every organiser session is one stolen session from an empty store.

**Against, and why it lost.** A back-office button is easier for a volunteer than a terminal, but it puts a data-destroying endpoint on a public site, for a job done a few times a year.

**Where in the code.** `tools/registrations-admin.js`, `netlify/functions/_snapshot.js` (`restorePlan`, `deletePlan`, `canDelete`), `netlify/functions/_regstore.js`, `tests/test-registrations-admin.js`.
