# Pitch marshals score through a revocable per-pitch, per-day link, not an account

**Ruling.** An organiser, or a manager of that age group, issues one signed link per pitch the group holds that day, as a copyable URL and a printable QR sheet. The token travels in the URL fragment, working only on its day in Gulf time; reissuing or revoking kills every phone holding the old one. Pitch mode in `/app` shows only that pitch's published matches. The marshal types a name on every save. A marshal may overwrite another marshal's score but not one entered by the table, and may not clear a result. Every overwrite keeps the previous version, up to twenty per match. Festival groups get no links. What a token can reach has its own card.

**Why.** Volunteers are chosen on the morning and swap without telling anyone; anything issued per person fails on the first swap.

**Against, and why it lost.** Sharing the manager login attributes every score to the manager and unlocks registrations. Marshal accounts fail at scale on the morning. A forwarded link reaches one pitch for one day, under a typed name, overwritable by the table — and Issue new is one tap.

**Where in the code.** `netlify/functions/_marshal.js`, `netlify/functions/marshal-links.js`, `netlify/functions/marshal-info.js`, `netlify/functions/submit-result.js`, `netlify/functions/get-result-history.js`, `app.html`, `qr.js`, `tests/test-pitch-marshals.js`.
