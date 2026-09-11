# A venue save refuses only layouts that would break the site; everything else saves, some with a warning

**Ruling.** `validateVenue()` refuses a missing day, a day with no pitches, an unknown age group, a group on both days or neither, a group assigned a pitch that is not a surface that day, an unknown main pitch, and any split other than whole, halves or quarters. A group with no pitches saves, with a warning from `venueWarnings()`. Two groups sharing a pitch save silently: that is a time-share, and the clash check judges the times. Map block positions live under their own key, `config`/`venue-positions`.

**Why.** Each refusal is a layout that silently breaks part of the site on match day. A group's day and its pitches are separate decisions, and the day comes first. `validateVenue()` rebuilds each day from a known field list, so a position stored on the layout would vanish on the next save.

**Against, and why it lost.** Refusing a group with no pitches keeps the layout complete, but blocks moving a group's day before choosing its pitches.

**Where in the code.** `netlify/functions/_venue.js` (`validateVenue`, `venueWarnings`, `loadPositions`), `netlify/functions/venue-layout.js`, `tests/test-venue-splits.js`.
