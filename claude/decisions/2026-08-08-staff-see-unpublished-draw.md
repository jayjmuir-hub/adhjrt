# Managers and organisers see and score an unpublished draw, marked as a draft or a sample, through the one existing door

**Ruling.** Fixtures, standings and the Spirit award are read through one helper, `viewModeOf()`, returning `published`, `draft`, `sample` or `none`. A draft shows behind the marker `Draft — not published`, only when the server answers `isDraft: true`. With no draft saved, an entitled reader sees the auto-generated draw behind `Sample draw — not real fixtures`. Public pages never see a draft. Draft data has one door, `get-schedule-override.js`, serving a draft only to a session passing `hasAgeGroupAccess`, otherwise falling through to the published draw. No new endpoint and no new sign-in check may be added for draft data.

**Why.** Without it a manager could not read back a draw they had built, and no score could be entered for an unpublished group. A second authorisation surface for the same data is a second place for a check to go missing, which is how the `manager-signup` rate limit was once bypassed.

**Against, and why it lost.** Sample draws put invented team names on staff screens, and a badge is weaker than an absence. The marker says in words that these are not real fixtures, and a test fails if it stops rendering.

**Where in the code.** `scores-data.js` (`viewModeOf`), `netlify/functions/get-schedule-override.js`, `Manager.dc.html`, `Organizer.dc.html`, `app.html`, `tests/test-draft-visibility.js`.
