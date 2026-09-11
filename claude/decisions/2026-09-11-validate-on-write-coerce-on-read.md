# Code that reads may fall back on input it cannot parse; code that writes refuses it

**Ruling.** A reader that meets something it cannot make sense of uses a safe default, so one bad blob cannot take the site down. A writer refuses it with a named error. So `scoring-rules.js` answers 400 for an unknown age group, a non-list or an empty list. `validateVenue()` names every unrecognised pitch rather than dropping it. The gateway age-checks a single player as well as a squad. If the existing team records cannot be read, or are not a list, a team registration is refused with 503 rather than numbered from nothing.

**Why.** On a write, somebody is saying what the truth is. Four bugs had the same shape: a read-style fallback used on a write, with the caller told it had worked. A team numbered from an empty list takes a code that already exists, which puts one team in two pools.

**Against, and why it lost.** Refusing costs the coach a resubmission. A duplicate team code is found on match morning by a coach who cannot find their pool.

**Where in the code.** `netlify/functions/scoring-rules.js`, `netlify/functions/_venue.js`, `netlify/functions/_intake.js`, `tests/test-validate-not-coerce.js`.
