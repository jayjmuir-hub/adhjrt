# The scoring model lives in two files, and a test compares them key by key

**Ruling.** The server totals a submitted result from `POINTS`, `BY_AGE` and `FESTIVAL_AGE_IDS` in `_scoring.js`. The browser builds the score form and its running total from `SCORE_POINTS`, `SCORE_BY_AGE` and `hasStandings` in `scores-data.js`. `test-scoring-model.js` extracts both by parsing and fails if any value differs.

**Why.** If the copies drift, the form shows one total and the standings another, with no error anywhere; the first to notice is a coach who thinks the table is wrong. The pitch model and the registration rules had each drifted the same way before this pair was given a test.

**Against, and why it lost.** One shared module would remove the duplicate, but there is no build step. `scores-data.js` is a browser module whose top level calls `fetch`, so the functions cannot simply require it. A comparison test is the cheapest guard that works here.

**Where in the code.** `netlify/functions/_scoring.js`, `scores-data.js`, `tests/test-scoring-model.js`.
