# No shared blob is read, changed and written back on a path many people use at once

**Ruling.** Netlify Blobs has no compare-and-set, so every write overwrites. Anything written often by many people gets one key per writer. A result is one blob per match, and saving it reads nothing it is about to overwrite. A sign-in time is one key per person in its own `signins` store, never a field on the shared accounts blob. It is stamped only after a successful sign-in, and fails open both ways. The organiser Fixtures tab is read-only; draws and scores are edited only through `/manager`.

**Why.** The one-blob and one-blob-per-group results layouts both lost results: two people read, both wrote, and both got a success message. Stamping sign-ins on the accounts blob would make it a write on every login, and fifteen managers signing in while an organiser approves someone would silently lose the approval.

**Against, and why it lost.** One document is simpler to read and back up. Two people saving the same match still means the last write wins, which is correct: the second person is correcting the first.

**Where in the code.** `netlify/functions/_results.js`, `netlify/functions/_signins.js`, `netlify/functions/login.js`, `Organizer.dc.html`, `tests/test-results-storage.js`.
