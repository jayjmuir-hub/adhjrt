# A person's own account actions act only on the account named in their verified token, and no view of accounts ever carries a secret

**Ruling.** `my-account.js` accepts any valid session, manager or organiser, and acts only on the account in the verified token, never a username from the request body. Its one action, `password`, needs your current password and applies the shared floor, returning safe fields only. The widest account view, the organiser listing in `accounts-admin.js`, strips `passwordHash`, `googleSub` and `hubSub` from every account before it leaves the server. Powers over other accounts — reset, approve, revoke, delete — stay behind the organiser-only door in `accounts-admin.js`, unreachable by a manager. There is no account-linking action: a hub identity attaches only when `hub-auth.js` creates the account for it.

**Why.** If the account came from the body, anyone signed in could act on someone else's account. A password hash in a listing is an offline guessing target for anyone reading that traffic; an outside identity id has no use on a page.

**Against, and why it lost.** Self-service inside `accounts-admin.js` means one endpoint, not two. But its organiser gate covers every action, so managers would be locked out, or the gate loosened for all.

**Replaces.** `changeMine` in `accounts-admin.js`, and `linkGoogle`, which went with Google sign-in (tombstone in `my-account.js`).

**Where in the code.** `netlify/functions/my-account.js`, `netlify/functions/accounts-admin.js`, `netlify/functions/hub-auth.js`, `netlify/functions/_password.js`, `tests/test-my-account.js`.
