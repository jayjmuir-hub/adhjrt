# Pitch names are derived from a main pitch and its split, never typed, and a split change keeps a group's ground

**Ruling.** A day's pitches come from `derivePitches()`: each of the fixed `MAIN_PITCHES` is whole, halves or quarters (`SPLITS`), and its surfaces are named from that. There is no free-text pitch box. When a split changes, `remapGroupPitches()` keeps each group on the same ground under new names: a group that had a whole pitch gets every part of it after a split, and a group on any part gets the whole pitch after a merge. A group loses an allocation only when its main pitch leaves the day.

**Why.** Typed names produced `C4`, `c4` and `Pitch C4` as three pitches that the clash check could not reconcile. A naming change must not silently take an organiser's allocation away; nobody would notice until a team arrived with nowhere to play.

**Against, and why it lost.** A free-text box can describe a pitch the list does not know, such as a borrowed field. Adding it to `MAIN_PITCHES` is one line and keeps every name comparable.

**Where in the code.** `netlify/functions/_venue.js` (`MAIN_PITCHES`, `SPLITS`, `derivePitches`, `remapGroupPitches`), `tests/test-venue-splits.js`.
