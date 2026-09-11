# The team form checks every player's age: one group young is flagged, anything further is refused

**Ruling.** Every squad row on the coach's form runs the player form's own age check. A player more than one group out is refused, in the browser and in the gateway. A player exactly one group young passes but is flagged, because play-up needs parental consent and a coach cannot give it. A named row with no date of birth blocks the whole squad. Dates are entered as day/month/year dropdowns, never a native date input. The server copy of the check is verbatim with a drift test; the flag is derived, not stored.

**Why.** Most age groups span a single year, so one year out is usually the wrong group. In contact grades, an over-age player is an injury risk.

**Against, and why it lost.** Blocking play-up players would push coaches to fudge a date. Letting blank dates through would mean nothing is checked. Dropdowns are slower for a full squad, but a native date input quietly turns 31 February into 3 March. A flag nobody reads is decoration, so it needs an organiser display.

**Where in the code.** `netlify/functions/_agegroups.js`, `netlify/functions/_intake.js`, `Quins JRT.dc.html`, `tests/test-intake.js`, `tests/test-agegroups.js`.
