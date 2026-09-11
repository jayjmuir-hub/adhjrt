# Every request re-reads the account, so a session's role, age group and draw rights come from the account, not the token

**Ruling.** `resolveSession()` verifies the token, then loads the accounts store and takes role, age group and both draw rights from the stored account. A claim in the token that the account does not hold is ignored. If the accounts store cannot be read, the answer is 503 with no sign-out marker, never 401. A missing or unapproved account gets 401 or 403 with the marker. `optionalSession()` turns any refusal into "no session", so an endpoint using it degrades rather than refusing.

**Why.** Before this, Revoke changed the stored account and nothing else: a revoked phone kept posting scores and reading children's data for the life of its token, and a revoked organiser could re-approve themselves. Re-reading also makes a demotion take effect at once. A 401 on a storage blip would sign managers out in the middle of the tournament.

**Against, and why it lost.** It costs one blob read per request, and stateless tokens are the usual design. That read is what makes Revoke mean anything.

**Where in the code.** `netlify/functions/_auth.js` (`resolveSession`, `optionalSession`), `tests/test-session-revocation.js`, `tests/test-session-refusal.js`.
