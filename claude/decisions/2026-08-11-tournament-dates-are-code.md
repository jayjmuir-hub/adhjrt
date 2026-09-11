# The tournament dates are code, set in one place, and no saved layout can override them

**Ruling.** Each day's `date`, `label` and `short` come from `DEFAULT_VENUE` in `_venue.js`. `mergeVenue()` ignores them in a saved layout and `validateVenue()` drops them from a save. There is no back-office control for the dates. The countdown and each group's day on the homepage derive from the layout at runtime, with written-down fallbacks. The JSON-LD `startDate` and `endDate` stay hardcoded in the homepage head, and a test pins them to `DEFAULT_VENUE`.

**Why.** Saved layouts used to win. The panel posts back the whole layout it was given, so a stored date could only be round-tripped, never changed, and it outranked the code for good. A date change deployed cleanly and changed nothing parents saw, while the static JSON-LD moved. Crawlers do not run JavaScript, so the JSON-LD cannot derive.

**Against, and why it lost.** A date control in the back office would make a date change free. Dates rarely move; one source of truth is worth a deploy. Clearing the blob would also wipe the splits and groups.

**Where in the code.** `netlify/functions/_venue.js` (`DEFAULT_VENUE`, `mergeVenue`, `validateVenue`), `scores-data.js`, `Quins JRT.dc.html`, `tests/test-homepage-dates.js`, `tests/test-venue-splits.js`.
