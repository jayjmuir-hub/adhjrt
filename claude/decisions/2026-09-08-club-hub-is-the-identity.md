# The Quins Club Hub proves who a person is; the tournament site alone decides what they may do

**Ruling.** A person signs in through the club hub, returning only a short-lived access token in the URL fragment, to an exact-origin allow-list excluding deploy previews. `hub-auth.js` verifies it with Node's built-in crypto against the hub's public ES256 keys: signature under the named `kid`, fixed issuer, audience `authenticated`, future expiry. The email check refuses only `email_verified === false`; a missing field passes, since a hub session implies confirmation. The account matches on `hubSub`, never email. A new person becomes a pending account with no role. Approving it needs role `manager` or `organizer`, and for a manager a known age group, checked as `create` checks them. Hub sign-in keeps a per-address failure bucket, `${ip}:hub`, about fifty per fifteen minutes, sharing the rate-limit module, not login's buckets.

**Why.** Every manager and organiser already has a club hub login. An email match lets one address claim another's account.

**Against, and why it lost.** Email matching would link old accounts automatically, but a few re-approvals cost less than one wrong link. Depending on the hub for new sign-ins is accepted: minted sessions keep working without it.

**Replaces.** Google sign-in (`google-auth.js`, `googleSub`). Do not re-add it.

**Where in the code.** `netlify/functions/hub-auth.js`, `netlify/functions/_hubAuth.js`, `netlify/functions/accounts-admin.js`, `Signin.dc.html`, `tests/test-hub-auth.js`.
