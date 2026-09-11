# A revoked account is recorded as revoked, kept out of the pending queue, and deleted only on purpose

**Ruling.** Revoking sets `approved: false`, stamps `revokedAt`, and stamps `sessionsValidFrom`, so existing tokens stay dead even if the account is later restored. A revoked account appears in its own Revoked section on the Accounts tab, with Restore and Delete permanently, and never in the pending queue. Restoring is approving a revoked account: it clears `revokedAt` and leaves the session cutoff in place. Reject, which deletes the record outright, is never offered as the routine answer to a queue row.

**Why.** While revoked and never-approved shared one boolean, a revoked person reappeared as a new request. The natural tidying click, Reject, deleted the account for good. The other button, Approve, silently reinstated them.

**Against, and why it lost.** Inferring revoked from `sessionsValidFrom` needs no new field. But a password reset stamps the same field, so a reset account that was later unapproved would read as revoked. Two facts need two fields. Removing Reject altogether was also rejected, because an organiser does sometimes need to delete an account.

**Where in the code.** `netlify/functions/accounts-admin.js`, `netlify/functions/_auth.js`, `Organizer.dc.html`, `tests/test-session-revocation.js`.
