# Organiser password logins stay as a break-glass for the desk; managers arrive only through the club hub — and the manager self-signup path is now retired

**Ruling.** Organisers keep password accounts, behind a desk sign-in disclosure, and each also holds a hub-linked account; the two are never merged. `login.js` refuses any account without a `passwordHash`. Managers arrive only through the club hub and are given a role, at approval, in the back office.

The **manager self-signup path is retired** (12 Sep 2026, JRT-30): `manager-signup.js` is deleted, the invite-code form on `/signin` is removed, and the client/dev-backend plumbing (`scores-data.js` `signup()`'s manager branch, `local-backend.js` `managerSignup`) with it. The **`MANAGER_INVITE_CODES` Netlify env var is now dead — delete it from the site config.**

What **stays** is the organiser back-office `accounts-admin` `create` action, which can still mint a manager login with a password. **That is the break-glass.** Because it stays, retiring the *public* path locks nobody out: if the club hub is unreachable on tournament morning, an organiser at the desk can still create a working manager login by hand.

**Reset now refuses Club Hub logins (JRT-19, done 12 Sep 2026).** `accounts-admin` `password` refuses an account carrying a `hubSub`: a hub login has no password, and minting one would open a standalone `login.js` path against this ruling. It was deliberately **not** locked to organisers only — a reset CHANGES an existing password, so it still serves organiser desk accounts AND break-glass manager password accounts (both carry a `passwordHash`, no `hubSub`); an organiser-only lock would have broken resetting a break-glass manager, which `create` deliberately still makes. `create` itself stays unrestricted (the break-glass; JRT-30).

**Why.** If the club hub is unreachable on tournament morning, existing sessions keep working, but nobody new can sign in through it. A desk that can still mint a login lets the organiser act regardless. Retiring the *self-serve* path removes an anonymous, public, password-account-minting endpoint from a public repo without removing that safety valve.

**Against, and why it lost.**
- *Keep the manager self-signup too, until the hub is proven across both tournament days.* Lost: the desk `create` already covers the "hub is down" case, so the public path adds risk (a shared per-group code, no expiry, no per-person revocation, no record of who used it) without adding a capability the desk lacks.
- *Neuter `manager-signup.js` in place rather than delete it.* Lost: a public endpoint that mints password accounts, on a repo whose root is the live site, is worth removing outright; the organiser recovery pattern (`organizer-signup.js`, gated by an unset env var — see `2026-08-03-organiser-signup-is-a-dormant-recovery-path.md`) is the documented way back if a manager self-signup is ever wanted again.
- *Go all the way now and lock `create`/`password` to organisers.* Lost: see above — that removes the break-glass; JRT-19 owns the reset question.

**Consequence to remember.** The master **`*`** manager code (all age groups) went with `manager-signup.js`; an all-access person is an **organiser** now. The `*` sentinel in `_auth.js` (`session.ageGroupId === '*'`) is left in place as defensive handling for any restored legacy all-groups account, not because a new one can be created.

**Where in the code.** `netlify/functions/login.js`, `netlify/functions/accounts-admin.js`, `netlify/functions/organizer-signup.js` (recovery path, untouched), `Signin.dc.html`, `scores-data.js`, `local-backend.js`, `tests/test-hub-auth.js`, `tests/test-signin-page.js`, `tests/test-accounts.js`, `tests/test-signup-ratelimit.js`.

**Tombstone — `netlify/functions/manager-signup.js` (deleted 12 Sep 2026, JRT-30).** It created a *pending* age-group manager account from a per-group invite code in `MANAGER_INVITE_CODES`; the account could not sign in until an organiser approved it. It was removed because managers now arrive through the club hub and are given their role at approval in the back office. Do not re-add it: the organiser `create` action is the break-glass, and `organizer-signup.js` is the documented recovery pattern if a self-signup path is ever needed again.
