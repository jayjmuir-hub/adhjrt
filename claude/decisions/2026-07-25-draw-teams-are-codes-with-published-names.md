# In a draw, a team is its registration code, and a name map published with the draw turns it into a name

**Ruling.** Pools list the team codes issued at registration. A `teamNames` map in each age group's draw gives display names; `teamLabel()` in `scores-data.js` turns a code into its name, falling back to the code. Codes are unique only within an age group. The public Scores page shows codes everywhere; full names appear in the fixture and team lists `scores-data.js` builds through `teamLabel()`. The manager Draw tab's import panel seats teams by stated pool preference, spreads the rest evenly, and shows every move it makes. It reads only club, team name, age group and preference. Replacing the pools is blocked once any result exists. Adding missing teams skips those already in the draw and duplicate codes, and reports what it skipped. It never deletes, renames pools or writes back.

**Why.** Registration codes otherwise appear nowhere. Publishing names with the draw keeps the public off the organiser-only registrations endpoint.

**Against, and why it lost.** Free-text names are simpler but drift from what was registered. A global code lookup would collide across age groups. Swapping teams under recorded results would leave them describing matches that never happened.

**Where in the code.** `scores-data.js` (`teamLabel`), `Scores & Standings.dc.html`, `Manager.dc.html` (the import panel), `app.html`, `netlify/functions/_teams.js`.
