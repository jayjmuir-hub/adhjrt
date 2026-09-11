# Every registration passes through our own gateway, which refuses before it stores or mails anything

**Ruling.** Every form POSTs to `submit-registration`. All decisions sit in the dependency-free `_intake.js`, fed a real store, mailer and clock. The order: rate limit, form allow-list, club key, validation (a filled honeypot is silently discarded), registration window, storage, email. Unknown fields are dropped. `submittedAt` and `team-code` are generated, never taken from the request. Field values never appear in a log. A failed store write goes to the dead letter, with no email or team code. Email goes only after the record is written; a mail failure is logged and swallowed.

**Why.** The endpoint is public, stores children's data, and mails from the tournament domain to an address in the request; unguarded, it is an open relay. A mail failure must never lose a registration or prompt a duplicate resubmission. A dependency-free module tests from a fresh clone.

**Against, and why it lost.** Netlify Forms gave spam filtering and throttling free, but accepted a submission before our code saw it, so nothing could refuse a late or over-age entry.

**Replaces.** Netlify Forms and the `submission-created` webhook.

**Where in the code.** `netlify/functions/submit-registration.js`, `netlify/functions/_intake.js`, `netlify/functions/_ratelimit.js`, `tests/test-intake.js`.
