# A manager's draw editor offers only the group's own pitches, pitch clashes warn but never block, and only organisers publish

**Ruling.** Pitch dropdowns on the Draw tab list `TBD`, the pitches an organiser assigned to the group, and any pitch already saved on that slot — never free text or every pitch at the venue. The weekend clash check fetches draws through `loadAllDraws`: an organiser's token reads every draft; a manager's reads their own draft plus every other group's published draw. Those reach the manager's browser in full; they are public anyway, holding no contacts or rosters. The clash text shown is limited to pitch and time. Clashes involving the group appear as a warning in the publish confirmation, which offers Publish anyway. Managers cannot publish — `_publish.js` refuses them, so they send the draft for review instead. `canPublishNow` tells the page whether to show Publish; the server decides.

**Why.** Groups edit draws alone while pitches are shared, so only a whole-weekend check catches a double booking. Publishing changes what parents see, so it is the organiser's act.

**Against, and why it lost.** Blocking publication on a clash guarantees a clean schedule, but a clash is often fixed by the other group, and a hard block stops work at the worst moment.

**Where in the code.** `Manager.dc.html`, `scores-data.js` (`loadAllDraws`, `canPublishNow`), `netlify/functions/_publish.js`, `netlify/functions/publish-schedule.js`.
