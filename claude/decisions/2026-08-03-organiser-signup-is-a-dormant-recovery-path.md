# Organiser self-signup stays in the code as a recovery path, shut by leaving its variable unset

**Ruling.** `organizer-signup.js` refuses every request while `ORGANIZER_INVITE_CODE` is unset, which is its normal state. Organisers are created on the Accounts tab through the `accounts-admin` `create` action. If every organiser account is ever lost: set the variable, sign up, then unset it. The variable is read per request, so no deploy is needed. Separately, a manager invite code whose key is a literal `*` grants every age group, because the code compares `ageGroupId === '*'`; a key with any other name grants nothing extra.

**Why.** A shared code has no expiry, cannot be revoked for one person, and records nothing about who used it; a named account does all three. With the code unset, the first-signup-is-approved bootstrap is also shut, so a lost accounts blob cannot hand organiser access to whoever signs up first.

**Against, and why it lost.** Deleting the file removes an unused public endpoint, but leaves no way back in if the accounts are lost. A test that a missing code refuses every signup keeps the path safe.

**Where in the code.** `netlify/functions/organizer-signup.js`, `netlify/functions/manager-signup.js`, `netlify/functions/_auth.js` (`hasAgeGroupAccess`), `tests/test-accounts.js`.
