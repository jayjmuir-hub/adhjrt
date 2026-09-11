# The rate limiter fails open; the registration window and the club link key fail closed

**Ruling.** Every counter in `_ratelimit.js` allows the request when it cannot be read or written, and marks the answer `degraded`. In the gateway, a registration window that cannot be read refuses a team or player submission. The club form's link key refuses when `CLUB_FORM_KEY` is unset, exactly as when it is wrong. The two directions are opposite on purpose; do not make them consistent.

**Why.** A throttle that fails closed turns a storage blip into lost registrations, and what it would save, a few minutes of extra abuse, is small beside that. The window and the key are the rules themselves: letting a request through when they cannot be checked would accept a late entry, or open the club form to anyone.

**Against, and why it lost.** One failure policy across the gateway is easier to reason about, but either choice is wrong for half of the checks. The rate limiter is also the last of four guards, not the only one.

**Where in the code.** `netlify/functions/_ratelimit.js`, `netlify/functions/_intake.js`, `tests/test-intake.js`.
