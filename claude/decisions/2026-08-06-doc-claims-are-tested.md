# Instructions written in the docs are asserted by a test, like code

**Ruling.** A doc sentence that tells a session what to do, costs or measures is pinned by `tests/test-doc-claims.js`. Numbers that appear in two places are derived from both and required to agree, not pinned twice. A retracted sentence is asserted by position, after its tombstone marker, together with an occurrence count. Moving a pinned paragraph means repointing the test in the same commit.

**Why.** A wrong sentence in a doc never errors. Five had cost real time before this: a password state recorded after it changed, preview URLs on a renamed subdomain, a status-code rule that outlived its premise, a wrong master key, and a claim that branch builds cost credits. Each had been corrected by hand with nothing holding it in place.

**Against, and why it lost.** Tests on prose are churn: every rewrite of a doc breaks a check. That churn is the point, because it forces the rewrite to carry the claim across rather than drop it. Presence or absence checks alone were rejected, because a tombstoned sentence and a restored one are the same string.

**Where in the code.** `tests/test-doc-claims.js`, `tests/_prove-registration.js`.
