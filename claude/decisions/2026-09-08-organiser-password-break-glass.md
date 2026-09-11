# Organiser password logins stay as a break-glass for the desk; managers are meant to arrive only through the club hub, which the code does not yet enforce

**Ruling.** Organisers keep password accounts, behind a desk sign-in disclosure, and each also holds a hub-linked account; the two are never merged. `login.js` refuses any account without a `passwordHash`. The intent: managers hold no passwords and `accounts-admin` reset serves organiser accounts only. The code enforces neither yet — `accounts-admin` `password` resets any account. Three paths still create manager password accounts: `manager-signup.js` with an age-group invite code, the invite-code form on `/signin` calling it, and `create` in `accounts-admin.js`. Outstanding: retire the signup path and form once every manager holds a hub-linked account, limit `create` and `password` to organiser accounts, and revoke each old manager password account once its owner's hub account is approved — never by automatic linking.

**Why.** If the club hub is unreachable on tournament morning, existing sessions keep working, but nobody new can sign in. A site-held password lets the desk act regardless.

**Against, and why it lost.** Keeping any password code keeps a credential store and a reset path, accepted until the hub proves reliable across both tournament days. Merging the desk account into the hub account would make the break-glass depend on what it covers for.

**Where in the code.** `netlify/functions/login.js`, `netlify/functions/accounts-admin.js`, `netlify/functions/manager-signup.js`, `Signin.dc.html`, `scores-data.js`, `tests/test-hub-auth.js`.
