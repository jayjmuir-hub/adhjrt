# The manager Registrations tab is read-only, and the server limits it to the manager's own age group

**Ruling.** Managers see their own group's registered teams and players read-only. The server limits the list from the caller's token, not the page. A player is flagged as unmatched when no team roster has the same name AND date of birth. Importing registered teams into the draw uses only teams registered for this age group. Replace pools is refused once the group has results; the import falls back to adding missing teams and says so.

**Why.** Registration data holds children's details, so the page must not be what limits it. Matching on name alone would clear the warning for a different child with the same name. Replacing pools after results would wipe a roster that real scores depend on.

**Against, and why it lost.** Filtering in the browser is simpler and needs no endpoint, but anyone can edit a page. Matching on name only flags fewer false mismatches from typos in the date, but it hides real mismatches, which is the worse failure.

**Where in the code.** `Manager.dc.html`, `netlify/functions/get-my-registrations.js`, `scores-data.js`.
