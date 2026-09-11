# The browser signs a person out only when a refusal carries the explicit sessionEnded marker, never because of a status code

**Ruling.** `resolveSession` in `_auth.js` is the only place deciding a session is finished: a bad token, a deleted account or a cutoff (401), or a revoked account (403). Every call site builds that refusal with `sessionRefusal(auth)`, setting `sessionEnded: true`. In the browser, `noteSessionEnded` in `scores-data.js` acts on that marker alone: it clears the session and goes to `/signin`. `organizer-data.js` imports it rather than copying it, and `app.html` registers its own handler through `onSessionEnded`, dropping to the public view instead. A role refusal, a 503, a network failure or an unreadable reply never signs anyone out. Known gap: `publish-schedule.js` uses `optionalSession`, so a revoked person pressing Publish gets an ordinary refusal and no marker, signed out only by the next endpoint that resolves the session.

**Why.** Without this, a dashboard kept rendering from browser storage after its account was revoked. A status code cannot tell a revoked person from a manager pressing an organiser-only button.

**Against, and why it lost.** Treating any 403 as signed out would sign out legitimate managers. Signing out after a failed 503 retry would turn a brief store failure into mass sign-outs on tournament morning.

**Where in the code.** `netlify/functions/_auth.js`, `netlify/functions/publish-schedule.js`, `scores-data.js`, `organizer-data.js`, `app.html`, `tests/test-session-refusal.js`.
