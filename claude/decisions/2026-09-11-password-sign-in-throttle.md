# Password sign-in counts only failures, and a correct password clears only that account's counter

**Ruling.** `login.js` checks two buckets before it compares anything: 10 failures in 15 minutes per address and username, and 50 per address across every username. A wrong password adds to both. A correct password adds nothing and clears the per-account bucket, never the per-address one. An unknown username is still compared, against a fixed dummy hash, so it takes as long as a real one.

**Why.** A venue puts many managers behind a few connections, so counting every attempt would lock out people who typed nothing wrong. Clearing the per-address bucket on success would let an attacker reset their allowance by signing in to an account of their own between guesses. Without the dummy hash, a fast answer would reveal which usernames exist.

**Against, and why it lost.** One bucket per address is simpler, but it shares one allowance across the venue. The dummy hash costs one bcrypt run per unknown name, which is the point.

**Where in the code.** `netlify/functions/login.js` (`ACCOUNT_RATE_OPTS`, `CONNECTION_RATE_OPTS`, `DUMMY_HASH`), `netlify/functions/_ratelimit.js`, `tests/test-login-ratelimit.js`.
