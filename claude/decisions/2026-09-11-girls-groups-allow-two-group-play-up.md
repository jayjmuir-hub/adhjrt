# The girls' groups allow a player up to two age groups young, contact grades included

**Ruling.** For U12G, U14G, U16G and U18G, `ageGroupCheck` measures how far below the group's lowest age the player is. One or two groups young passes, flagged as a play-up that needs a parent's consent; anything further is refused. Every other group allows only one group young, through the `PREV_GROUP_ID` chain. The list is `TWO_YEAR_PLAYUP_GROUP_IDS`, copied verbatim into the homepage form.

**Why.** The governing body's rules allow girls to play up two age groups. There is no girls' group at age 12, so a one-step chain would leave the youngest girls nowhere to play. Including the two contact grades was a deliberate safety call made with that rule in view, not an oversight.

**Against, and why it lost.** Limiting contact grades to one group young would be more cautious about injury. It would also refuse players the rules allow. The consent flag and an organiser's review remain the safeguard.

**Where in the code.** `netlify/functions/_agegroups.js` (`TWO_YEAR_PLAYUP_GROUP_IDS`, `ageGroupCheck`), `Quins JRT.dc.html`, `netlify/functions/_email.js`, `tests/test-agegroups.js`.
