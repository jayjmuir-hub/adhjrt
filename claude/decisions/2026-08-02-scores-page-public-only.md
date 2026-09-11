# The scores page is public only; everything signed-in lives on the manager and organiser pages

**Ruling.** `/scores` is a public results page with one footer link, Manager sign-in, pointing to `/manager`. It has no sign-in, no score entry, no draw editor and no publish controls. Per-group work (the draw, scoring, knockout generation, the weekend clash check, Spirit nominations, sending a draft for review) is on `/manager`. Publishing is an organiser's act, and so are the bulk tools (publish all, scoring rules, simulate and reset the tournament) on `/organizer`.

**Why.** Two copies of the same manager job drift. The two draw editors already read a pool preference differently, and a publish-wrong-group bug lived in only one of them. A page a parent reads should carry no manager code at all.

**Against, and why it lost.** Moving tools makes `Organizer.dc.html`, already the largest page, bigger still. Accepted: `/scores` loses far more than `/organizer` gains, and splitting the organiser page is a separate job. Removing the old sign-in also removed the only home of manager self-signup, so it could only ship together with the unified login page.

**Where in the code.** `Scores & Standings.dc.html`, `Manager.dc.html`, `Organizer.dc.html`, `netlify/functions/_publish.js`.
