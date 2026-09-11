# The venue layout is back-office configuration over a built-in default, and pitch clashes warn but never block

**Ruling.** Which day each age group plays and which pitches it holds come from `DEFAULT_VENUE`, overridable by organisers in the Venue and days panel; a group's day derives from that layout, not a separate list. Tournament dates are not overridable. A pool has no pitch or start time of its own: both read from its slots, `slot.pitch` and `slot.startMins`. The pool header shows the pitch its slots share, or nothing when they disagree. The weekend clash check compares every group's draw and lists overlaps, TBD and unassigned pitches as warnings. The publish confirmation lists any clash and offers Publish anyway; only organisers publish, so only they reach it.

**Why.** Moving a group to the other day or renaming a pitch must not wait for a deploy. A hard block would lock out whoever moves a game on match morning. Reading pool values from slots keeps a header from disagreeing with its fixtures.

**Against, and why it lost.** The default lives in two files with no build step to share it; a test asserts they match. Automatic scheduling needs referee counts, pitch sizes and travel times it lacks.

**Where in the code.** `netlify/functions/_venue.js`, `netlify/functions/venue-layout.js`, `netlify/functions/_publish.js`, `scores-data.js` (`weekendClashes`), `Manager.dc.html` (`poolPitchOf`, `doPublish`), `tests/test-venue-splits.js`.
