# A marshal token saves a score only for its own age group's match on its own pitch, and reaches nothing else

**Ruling.** Only an organiser or a manager of that age group can list, issue or revoke a group's links: `marshal-links.js` checks `hasAgeGroupAccess` first. A marshal token cannot call `marshal-links` at all, since it names no account and `resolveSession` refuses it. The day is computed on the server from the venue layout, never taken from the request, and the pitch must be one the group holds that day. `submit-result.js` refuses a marshal save unless the match's age group equals the token's and its pitch in the published draw equals the token's pitch. The token is never stored: the `marshals` store keeps a random id, the issue time and issuer, enough to recognise the current token. Issuing returns the token once; the listing and every error leave it out.

**Why.** A link travels by message and screenshot and will be forwarded. Each check limits a forwarded link to one pitch's published matches on one day.

**Against, and why it lost.** Taking the day or pitch from the request is simpler, but a token could then be aimed anywhere. Storing the token would simplify checking, but a store leak would leak every live link.

**Where in the code.** `netlify/functions/marshal-links.js`, `netlify/functions/_marshal.js`, `netlify/functions/submit-result.js`, `netlify/functions/_auth.js`, `tests/test-pitch-marshals.js`.
