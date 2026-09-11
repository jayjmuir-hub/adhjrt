# The site-password state and the registration window are read live and never written into a document

**Ruling.** No durable file records whether the site password is on or whether registration is open. A session reads the password state from the Netlify project's access controls, and the window from the `registration-window` function, at the moment it needs the answer. Whether a branch URL exists is judged by its deploy id, not inferred from a 401 or 404.

**Why.** Both are switched outside the repo and have flipped repeatedly, sometimes more than once in a day. Every written copy went stale, and each one was then read as fact and used to plan a verification or explain a status code.

**Against, and why it lost.** A newcomer benefits from a stated default, and a live read takes a tool call. That call is cheap and never stale. A wrong sentence cost more each time than all the reads it would have saved.

**Where in the code.** `netlify/functions/registration-window.js`; the rest is not in code and is enforced by `CLAUDE.md` (facts this file is not allowed to answer).
