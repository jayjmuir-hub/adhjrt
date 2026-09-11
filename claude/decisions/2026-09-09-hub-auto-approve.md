# A club hub coach or team manager of exactly one junior squad is approved as that age group's manager on first sign-in

**Ruling.** After verification, `hub-auth.js` reads the person's own active membership rows from the club hub, using their own token, filtered to the verified `sub`. Only role `coach` or `manager` counts. A squad maps by rule, not table: the first word of the team name must be an id in `AGE_GROUPS`; a non-matching name maps to nothing. U6 and U7 festival groups are in `AGE_GROUPS`, so a coach of one U6 or U7 squad is approved too. Exactly one mapped squad approves as its manager, marked `autoApproved`. More than one means pending, with `suggestedAgeGroupIds`, never `'*'`. None means pending. Organisers are never automatic. Each sign-in rechecks accounts marked `autoApproved` and drops a lapsed one to pending with `autoRevoked`. Approving by hand clears the marker. If the membership read fails, the person silently stays pending.

**Why.** The club hub already knows which squad each coach runs, and asking an organiser to confirm it cost every manager two visits.

**Against, and why it lost.** A token claim listing squads changes the hub's auth and goes stale. The read is filtered to the verified `sub` because an admin's token otherwise reads the whole club.

**Where in the code.** `netlify/functions/hub-auth.js`, `netlify/functions/_hubAuth.js`, `netlify/functions/_agegroups.js`, `netlify/functions/accounts-admin.js`, `Organizer.dc.html`, `tests/test-hub-auth.js`.
