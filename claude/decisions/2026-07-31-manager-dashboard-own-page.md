# Managers work from their own /manager page, scoped to one age group and styled like the organiser back office

**Ruling.** `/manager` is a dedicated `.dc.html` page, separate from the public `/app`. A manager account covers one age group, never one club team, and every tab shows that group only. Public features such as following a team or browsing other groups are left out. The page uses the organiser back office's visual system, not the phone app's styles. It calls the same `scores-data.js` functions as the other pages and has no logic of its own for scoring or standings. Only an organiser gets an age-group switcher. `/app` sends a signed-in user to `/manager` for full tools.

**Why.** Managers were scoring on top of a public page cluttered with things they never use. Sharing one data layer means a fix is made once and every page stays right.

**Against, and why it lost.** Redesigning `/app` in place avoids a second page, but `/app` is the live match-day tool. A CSS-only reskin was cheaper and did not risk working score-entry code, but it matched Organizer only in shape, which was the complaint.

**Where in the code.** `Manager.dc.html`, `netlify.toml`, `scores-data.js`, `app.html`, `Organizer.dc.html`.
