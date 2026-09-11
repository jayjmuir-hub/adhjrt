# The public results endpoint serves scoring fields only, never who entered them or Spirit nominees

**Ruling.** `get-results` returns per match only the scoring fields: scores, tries, kicks, cards, walkover and submission time. It strips the entering username, the `enteredBy` record and both Spirit-of-Rugby nominee fields. Result history sits under a `hist:` prefix the result readers never list, so entries can never appear as public matches. History, including who scored a match, is readable through `get-result-history.js` only by an organiser or a manager of that match's age group, checked with `hasAgeGroupAccess`; a manager of another group is refused. A marshal sees the first name on their own pitch only.

**Why.** The entering username is a production account name, and the repo rules forbid publishing those. A marshal's name is a volunteer parent's name. Spirit nominees are children's names. None is needed by a public page, and a manager of one group has no need for another's.

**Against, and why it lost.** Stripping fields might break a reader relying on them. Every reader was checked first; the only one needing the name moved to the signed-in history endpoint. A test fetches with no session against a fixture holding every stripped field, with a control asserting the score is present.

**Where in the code.** `netlify/functions/get-results.js`, `netlify/functions/get-result-history.js`, `netlify/functions/_results.js`, `tests/test-pitch-marshals.js`.
