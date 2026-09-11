# An account's sign-in method is worked out in one function and nowhere else

**Ruling.** `signInMethodOf()` in `_auth.js` is the only code that decides how an account signs in: `Club Hub` if it holds a hub id, `Both` for a password plus a Google link, then `Google` or `Password`. The Accounts listing and the My account card both call it; neither works it out for itself. The answer is for display only and never decides access.

**Why.** The two views once carried their own copies. The listing's copy could never say `Both`, so it showed an account with a password and a Google link as Google only. Nobody noticed until a card displayed the field. Two copies of one rule drift.

**Against, and why it lost.** A one-line expression inline is shorter than an import. It is also the exact form that went wrong.

**Where in the code.** `netlify/functions/_auth.js` (`signInMethodOf`), `netlify/functions/accounts-admin.js`, `netlify/functions/my-account.js`, `tests/test-my-account.js`.
