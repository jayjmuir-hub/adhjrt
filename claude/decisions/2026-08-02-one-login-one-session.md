# Every account signs in through one endpoint, one session key and one sign-in page, and the account's stored role decides where it lands

**Ruling.** `login.js` looks up the account by username alone, no role filter, and mints a session for its role. The browser keeps one session key, `adhjrt_session_v2`. `migrateSession()` copies an older key in — organiser first — deletes both old keys, treats malformed JSON as absent, never signing anyone out. `logout()` clears all three keys. `/signin` sends an organiser to `/organizer`, a manager to `/manager`, honouring `?next=` only for those paths when the role permits. The password floor applies when a password exists, never at login. Password sign-in has two rate-limit buckets counting only failures: per account per address, `${ip}:${uname}:login`, and per address across usernames, `${ip}:login`.

**Why.** The token carries the role and every backend check reads it, so two endpoints and two keys were a purposeless split. It had grown a fallback writing tokens into the other page's storage.

**Against, and why it lost.** Two endpoints is less change, but kept the cross-wired fallback and doubled the guessing budget. One address-only bucket counting every attempt is simpler, but a venue shares few connections, locking out managers who typed nothing wrong.

**Replaces.** `organizer-login.js`, `manager-login.js`, and the `adhjrt_session_v1` and `adhjrt_organizer_session` keys.

**Where in the code.** `netlify/functions/login.js`, `netlify/functions/_ratelimit.js`, `scores-data.js`, `organizer-data.js`, `Signin.dc.html`, `tests/test-unified-login.js`, `tests/test-session-migration.js`, `tests/test-signin-page.js`.
