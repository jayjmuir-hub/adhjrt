# Declared and registered clubs are matched by a deliberately conservative name normaliser

**Ruling.** The organiser's Clubs view joins club declarations to team registrations on `normaliseClubName()`. It lower-cases, folds accents, removes apostrophes, turns every other run of punctuation into a space, then strips one trailing club-type suffix (RFC, RUFC, Rugby Club, RC, FC and similar), at the end only and at most once. Nothing fuzzier is attempted. A club that does not match shows in the registered-but-never-declared panel.

**Why.** A wrong match gives a believable wrong number that nobody questions. A missed match shows in its own panel, where an organiser can see it and act. Anchoring the suffix keeps a club whose name starts with "RC" intact. A dot must become a space and an apostrophe must vanish, or two common spellings of one club stop matching.

**Against, and why it lost.** Fuzzy matching would pair more clubs automatically, and it would also pair different clubs with similar names, silently. Making clubs pick from a list would mean changing a form clubs have already been sent.

**Where in the code.** `Organizer.dc.html` (`normaliseClubName`, `CLUB_SUFFIX_RE`), `tests/test-organizer-clubs.js`.
