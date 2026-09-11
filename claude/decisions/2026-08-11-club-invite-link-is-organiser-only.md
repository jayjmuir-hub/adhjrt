# The stored club invite link is organiser-only and reports whether its key still works

**Ruling.** The back office keeps the club form's full link in the `config` store at key `club-link`. Both reading and saving it are organiser-only. On read, the server compares the link's `k` against `CLUB_FORM_KEY` and returns one of four states: working, rotated, form switched off, or nothing saved. It never returns, logs or echoes the key itself. Saving only checks that the link has the right shape. A wrong key is accepted and then reported. Clear is separate from Save.

**Why.** The key is the only protection on the club form. It also lives in two places, so rotating it in Netlify silently kills a saved link that still looks fine. Only the server knows the real key, so only the server can make the comparison.

**Against, and why it lost.** Copying the public `registration-window` GET for consistency would publish the key. Refusing a wrong key on save would let anyone use the endpoint to test guesses. Masking the link was rejected as theatre on a page that already shows medical notes.

**Where in the code.** `netlify/functions/club-link.js`, `organizer-data.js`, `Organizer.dc.html`, `tests/test-club-link.js`.
