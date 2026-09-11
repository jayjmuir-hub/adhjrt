# The rules page keeps its undated promise until the real rules replace one marked block

**Ruling.** Until the real rules arrive, `/rules` keeps the placeholder that promises them before registration opens in October; the wording is not changed to name a month. When they arrive, only the block marked for replacement changes, and the prepared Last updated line under the heading goes live in the same change. The checks and faults that pin the placeholder text are repointed, never deleted. The change rides with another commit rather than buying its own production deploy.

**Why.** A vague promise cannot go stale; a dated one goes publicly wrong if the rules slip. A rules page with no date cannot be trusted mid-tournament. The settled items on the page are also stated elsewhere on the site, so a contradiction would be live in more than one place: search before editing.

**Against, and why it lost.** Naming the month is more precise. It costs a production deploy for copy, needs test and fault edits, and trades a robust sentence for a fragile one.

**Where in the code.** `rules.html`, `legal.html`, `tests/test-about-board.js`, `tests/_prove-registration.js`.
