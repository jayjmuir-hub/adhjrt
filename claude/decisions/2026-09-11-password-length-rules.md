# A new password must be 10 characters to 72 bytes; a longer one is refused, never trimmed

**Ruling.** `passwordProblem()` applies whenever a password is set, whether by signup, create, reset or change: at least 10 characters, and at most 72 bytes of UTF-8. It counts bytes, not characters. A password over the limit is refused with a sentence saying why. Neither rule is checked at login.

**Why.** bcrypt ignores everything after the 72nd byte, so a longer password is not stronger, only misleading: its first 72 bytes alone would unlock it. Counting bytes matters because accented and Arabic characters take several bytes each. Trimming would store a password the person never typed. Checking at login would lock out any account whose password predates a rule.

**Against, and why it lost.** Pre-hashing the password would lift the ceiling, but it changes every stored hash for a limit no real password reaches. A longer minimum is stronger, but the accounts are few and each sign-in is throttled.

**Where in the code.** `netlify/functions/_password.js` (`MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_BYTES`), `netlify/functions/_auth.js`, `tests/test-accounts.js`.
