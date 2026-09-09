# Spec — sign in to the tournament site with a Quins Club Hub account

**Status: BUILT AND LIVE, 8 Sep 2026 — deploy 1 of this spec.** Specced,
built and deployed the same day. Tournament side on `main` at `bca6242`
(hub-auth, the role picker, the roleless repair), club hub side merged as
PR #787 (`debf2361`). Jay drove the loop live: hub sign-in → pending →
approved as Organiser with the picker → hub sign-in → organiser dashboard.
Behaviour: `RESTORE.md` § Sign in with Quins Club Hub. **Of § 4's removals,
Google sign-in went the same day** (Jay: *"no longer needed"*):
`google-auth.js`, `_googleAuth.js`, `google-config.js`, the button, the
first-time code step, and Link Google on both account cards, with their two
test files. ⚠️ **The rest of deploy 2 — invite codes and manager passwords —
is NOT done** and waits until every organiser holds a hub-linked account. It went FIRST, before `spec-draw-rights-sep-2026.md` and
`spec-pitch-marshals-sep-2026.md` (both also live), because both assume an
account exists and neither cares how it was signed in. Each piece deployed
as it landed (Jay: *"we will deploy what we do immediately, not wait"*).

Jay, 8 Sep 2026: *"couldn't we federate login between club hub and jrt? no
other clubs can log into club hub, its just our club and we already have all
the age group managers documented there."*

He is right, and the fact that makes it right is the first sentence: the
tournament's age-group managers and organisers are all Quins people with
club hub logins already. Nobody from another club needs to sign in to the
tournament site. Pitch marshals are handled by links, not accounts, in the
marshal spec.

---

## What was measured, 8 Sep 2026

| Fact | How it was checked |
|---|---|
| The club hub's Supabase project is `quins-club-hub`, ref `lusmshimxdcxpnrktlgz` | Supabase MCP `list_projects` |
| It signs access tokens with **ES256, a public/private key pair** | `GET https://lusmshimxdcxpnrktlgz.supabase.co/auth/v1/.well-known/jwks.json` answers one EC P-256 key, `use: sig`, with a `kid` |
| So the tournament site can verify a club hub token from that **public URL and holds no secret** | consequence of the above; the alternative, a shared HS256 secret copied into Netlify, is not needed |
| The club hub's `memberships` rows carry `role in ('coach','manager','medic','admin')` per team | `db/schema/functions.sql` in the club hub repo |
| ⚠️ A **second** Supabase project exists, `adhjrt-app`, ref `nnlfjbnoiyqcvxwbwsjf`, created 21 Jul 2026, and **nothing in this repo references it** | `list_projects`, then a repo-wide grep for its ref and name: no hits |

The `adhjrt-app` project is **not used by this spec**. Identity lives in the
club hub's project because that is where the people are. What `adhjrt-app`
is for, and whether it should be deleted, is an open question for Jay below.
It is on the same paid organisation, so it is not free to leave lying about.

---

## The decision

1. The tournament sign-in page gets one button: **Sign in with Quins Club
   Hub**. It sends the person to the club hub.
2. The club hub, once the person is signed in, sends them straight back with
   their **access token** in the URL fragment.
3. A tournament function verifies that token against the club hub's public
   key, finds or creates the tournament account for that person, and mints
   the tournament's own session, byte-identical to today's.
4. **Roles stay on the tournament side.** The club hub says who you are; the
   tournament site says what you may do. An organiser assigns roles on the
   Accounts tab as now, with a suggestion pre-filled from the club hub's
   own membership records.
5. Passwords, invite codes and Google sign-in are removed from the
   tournament site, with one exception: **organiser password logins stay as
   break-glass** for the desk, in case the club hub is unreachable on the
   morning.

---

## 1 · The club hub side — one screen, one allow-list

New route in the club hub, `/connect/tournament`:

- If the visitor is not signed in, the ordinary login screen shows, and on
  success returns here (the existing deep-route preservation in
  `signInWithEmail` / `signInWithPassword` already does this).
- Once signed in, the screen reads the `return` query parameter, checks it
  against an **allow-list of exact origins**, and redirects to
  `<return>#hub_token=<access token>`. Anything not on the list gets a plain
  "that address is not allowed" and no redirect. `AuthConfirm.jsx` already
  has a safe-redirect guard for Supabase's own `redirect_to`; this is the
  same shape and should share the helper.
- The allow-list: `https://adhjrt.com`, `https://www.adhjrt.com`,
  `https://dev--adhquins-jrt.netlify.app`,
  `https://compare--adhquins-jrt.netlify.app`, and `http://localhost:8888`
  for the local Netlify dev server. Deploy previews
  (`deploy-preview-N--…`) are deliberately **not** on it; use the `dev`
  branch URL to test.
- **Only the access token crosses, never the refresh token.** An access
  token lives about an hour; that is plenty for one redirect, and a leaked
  one cannot renew itself.
- The fragment, not the query string, so the token is never in a request
  log or a referrer.

This is a change in the **club hub repo**, with its own tests and its own
deploy. It is small, about one screen and one helper, and it carries no
tournament knowledge beyond the allow-list.

---

## 2 · The tournament side — `hub-auth.js`

    POST { hubToken }
    -> 200 { ok, session, token }                       approved account
    -> 403 { ok:false, pending:true, error }            known, awaiting a role
    -> 401 { ok:false, error }                          token did not verify

Verification, in this order, each a 401 with its own sentence:

1. Fetch the JWKS from the club hub's `.well-known/jwks.json`, cached in
   module scope by `kid`; on an unknown `kid`, refetch once (keys rotate).
   Node's built-in `crypto.createPublicKey({ key: jwk, format: 'jwk' })`
   plus `crypto.verify` handles ES256; **no dependency is added**. The site
   has no `package.json` dependencies and this does not start one.
2. Signature verifies under the key named by the token's `kid`.
3. `iss` equals `https://lusmshimxdcxpnrktlgz.supabase.co/auth/v1`,
   `aud` equals `authenticated`, `exp` is in the future. The issuer is a
   constant in `_hubAuth.js`, not an environment variable, because it is
   public and there is exactly one club.
4. `email_confirmed_at` or `email_verified` is present; the club hub
   confirms emails on signup, and an unconfirmed address is not an identity.

From the payload: `sub` (the club hub user id), `email`, and the display
name from `user_metadata`. Then:

- **Match on `hubSub`**, never on email. This is the same ruling
  `google-auth.js` made about `googleSub` and it stands for the same reason:
  an email match is a weaker proof than the thing that just verified. The
  club hub's own onboarding trap (`RESTORE.md` there: an invite at a work
  address, a signup at a personal one) is what email matching produces.
- Found and approved: `recordSignIn`, return `sessionFor(account)`, the
  same function `login.js` uses, so every downstream check is untouched.
- Found and not approved: the pending message.
- Not found: create `{ username, hubSub, email, name, role: null,
  approved: false, createdAt, source: 'hub' }` and return pending. The
  username is derived from the email's local part with the existing
  `usernameFromName()` dedupe loop, because `username` is the key every
  other store uses (`sessionsValidFrom`, sign-ins, `submittedBy`) and
  changing that key is a migration this spec does not want.
- ⚠️ **`role: null` is new.** Today every pending account already has a
  role, because the invite code decided it. Here the organiser decides at
  approval, so `accounts-admin`'s `approve` action takes `role` and, for a
  manager, `ageGroupId`, validated exactly as `create` validates them. An
  approve without a role on a `role: null` account is a 400.

### The suggestion from the club hub (optional, phase 2)

➡️ **Specified 9 Sep 2026 as `spec-hub-auto-approve-sep-2026.md`** — and
promoted from a suggestion to an approval where the club hub's answer is
unambiguous (one junior squad as coach or team manager). The paragraph
below is the original thought and stays as written.

The club hub already knows which squad each manager runs. On first sign-in,
`hub-auth.js` can call the club hub's REST endpoint **with the person's own
token** and read their `memberships` rows; row-level security there already
limits that to their own rows. A small table in `_hubAuth.js` maps a club
squad to a tournament age group (`U16 Boys` → `u16b`), and the pending
account carries `suggestedRole` / `suggestedAgeGroupId` for the Accounts
tab to pre-fill. **Ship the sign-in without this first**; it is a
convenience, it adds a network call to the club hub's data API, and the
mapping table is one more thing to keep in step with `AGE_GROUPS`.

---

## 3 · The sign-in page

`/signin` (the unified page from `spec-unified-login.md`) becomes:

- **Sign in with Quins Club Hub** — the button. Sends to
  `https://<club hub origin>/connect/tournament?return=<this origin>`.
- On return, `/signin` reads `#hub_token=` from the fragment, clears the
  fragment, POSTs it to `hub-auth.js`, stores the session under the existing
  `adhjrt_session_v2` key, and continues to wherever the person was going.
  A `pending` answer shows *"You're in. A tournament organiser will give
  you a role shortly."*
- **Organiser password sign-in** stays, folded under a small *"Organiser
  desk sign-in"* disclosure, not a second tab. It calls `login.js` as today
  and only accounts holding a `passwordHash` can use it.
- The signup tab, the invite-code field, the Google button and the
  Manager/Organiser chooser go. Tombstones below.

`app.html`'s sign-in sheet does the same two things: the hub button, and
the disclosure. Pitch mode from the marshal spec is unaffected.

---

## 4 · What is removed, with tombstones

| Removed | Was | Why it goes |
|---|---|---|
| `manager-signup.js`, `MANAGER_INVITE_CODES` | per-age-group shared invite code → pending manager | one code per group known to a whole WhatsApp group, no expiry, no record of who used it. The club hub's identity replaces it |
| `organizer-signup.js` | shared organiser code; already refusing everything since `ORGANIZER_INVITE_CODE` was deleted 3 Aug 2026 | dead since August; finally deleted |
| `google-auth.js`, `_googleAuth.js`, `google-config.js`, `GOOGLE_CLIENT_ID` | Google sign-in and Google-linked accounts | the club hub is the identity provider now; two outside providers is two sets of rules |
| `accounts-admin` `create` for **managers** | organiser types a manager's username and password | managers arrive through the hub. `create` stays for **organiser** break-glass accounts only |
| `accounts-admin` `password` (reset someone else's) | organiser resets a manager's password | only organiser accounts hold one now; keep it, scoped to them |
| `test-signup-ratelimit.js`, the invite-code checks in `test-accounts.js`, `test-google-auth.js`, `test-google-auth-behaviour.js` | their subjects | ⚠️ **delete the test with the code, in the same commit**, and repoint any anchor `_prove-registration.js` had on them. A fault that can no longer be injected is a failed run, not a pass |

`_ratelimit.js`'s sign-up limiter loses its callers; keep the file, its
login limiter still guards `login.js`. `hub-auth.js` gets the **login**
limiter, not the signup one: a verified token is a sign-in, and the
reasoning in `google-auth.js` about fifteen managers behind one venue
address applies.

`_email.js`, `_signins.js`, `my-account.js` (name change, and password
change for break-glass accounts) are unchanged.

---

## 5 · Existing accounts

Nobody signs in between now and October, so this is clean:

- Every existing **manager** account is revoked by the organiser once its
  person has signed in through the hub and been approved. Old manager
  accounts are not linked automatically, because linking on email is the
  thing § 2 refuses to do. There are about fifteen; it is one morning.
- Existing **organiser** password accounts stay as break-glass. Each
  organiser also signs in through the hub and gets a second, hub-linked
  organiser account; the Accounts tab shows both, and the password one is
  labelled *desk*. Two accounts per organiser is the price of a break-glass
  that does not depend on the hub, and it is deliberately not merged.
- `sessionsValidFrom` semantics are untouched.

---

## 6 · Break-glass, and what "the hub is down" looks like

If the club hub or Supabase is unreachable on tournament morning:

- Every session minted on the Friday keeps working; the tournament site's
  own session does not call the hub after sign-in. Managers should sign in
  the day before as a matter of routine; the Marshals tab in the marshal
  spec is where they will be anyway.
- The desk signs in with an organiser password account and uses the
  age-group switcher to act for any group.
- The hub button shows the hub's own error, not a tournament one.
  `hub-auth.js` is not involved until a token comes back.

---

## Tests, and the faults each must catch

New `tests/test-hub-auth.js`, in `runall.ps1` and in
`_prove-registration.js`, so the prover's clean-suite count goes **up by
one** for it and **down by four** for the deleted files in § 4. Record both
movements in `claude/state-of-play.md`; that is where counts live.

The fixture signs test tokens with a **throwaway P-256 key generated in the
test**, and serves its JWKS from a stub, so no real key and no network.
Control: a token signed by the test key verifies; every fault below is a
one-line change that must turn that green into red.

| Assertion | Injected fault |
|---|---|
| A token signed by a different key is 401 | skip signature verification |
| Wrong `iss`, wrong `aud`, expired `exp`: each 401 with its own sentence | drop each check |
| An unknown `kid` triggers exactly one JWKS refetch, then 401 | refetch forever; never refetch |
| Unconfirmed email is 401 | drop the check |
| Match is on `hubSub`; a token with a matching email but a different `sub` creates a new pending account rather than signing in | match on email |
| Approved account returns a session byte-identical to `login.js`'s for the same account | reshape it |
| Pending account returns 403 with `pending: true` | return a session |
| First sign-in creates `role: null, approved: false, source: 'hub'` | create it approved; give it a role |
| `accounts-admin` `approve` on a `role: null` account requires a valid role and, for a manager, a valid age group | drop each |
| `accounts-admin` `create` refuses `role: 'manager'` | restore it |
| `login.js` refuses an account with no `passwordHash` | drop the guard |
| The login limiter, not the signup limiter, wraps `hub-auth` | swap them |
| `/signin` names the hub button and carries no invite-code field, no Google button | markup checks, same style as `test-unified-login.js` |
| `hub-auth.js` and `_hubAuth.js` add no `require` of anything outside `netlify/functions/` and Node built-ins | add `require('jose')` |
| `test-functions-load.js` still loads every function | already exists; it catches a deleted `require` target |

On the club hub side, in its own suite: the allow-list refuses an origin not
on it, refuses a path-only value, and passes each listed origin; the
redirect carries `#hub_token=` and never a refresh token.

---

## Rollout, in deploys

Each lands on `dev`, is looked at on `dev--adhquins-jrt.netlify.app`, then
merges to `main` and deploys. Per Jay, no batching this time. Three deploys
is 45 credits; that is the cost of not waiting and it is his call.

1. **Club hub**: the `/connect/tournament` screen and allow-list. Its own
   repo, its own deploy, its own tests. Nothing on the tournament side
   changes until this is live.
2. **Tournament, deploy 1**: `hub-auth.js`, `_hubAuth.js`, the `/signin`
   button, `approve` taking a role. Password and invite paths still present
   and working. Jay signs in through the hub on the live site; that is the
   live verification, not a green suite.
3. **Tournament, deploy 2**: the removals in § 4, with their tests and
   tombstones, once every organiser has a hub-linked account. Environment
   variables `MANAGER_INVITE_CODES` and `GOOGLE_CLIENT_ID` are deleted in
   Netlify **after** this deploy is verified, not before.

Then the draw-rights spec, then the marshal spec.

---

## Open questions for Jay

1. ~~**What is the `adhjrt-app` Supabase project for?**~~ **Answered 8 Sep
   2026, and it is a tombstone.** Created 21 Jul 2026 ~17:00 Gulf time, in
   the middle of a day of thirty back-end uploads to this repo (registration
   functions, manager logins, `_email.js`). Measured empty: zero users, zero
   own tables, zero migrations, zero edge functions, zero buckets. Referenced
   by nothing in either repo, any doc, or any session transcript, except one
   line in the club hub's `RESTORE.md` saying it is not used. The club hub's
   own project was created the next afternoon. Reading: a trial made while
   deciding where this site's data would live, superseded by Netlify Blobs
   here and by `quins-club-hub` there. **Deleted by Jay in the Supabase
   dashboard, 8 Sep 2026.** If the ref `nnlfjbnoiyqcvxwbwsjf` ever turns
   up again, this paragraph is why it should not.
2. **The club hub's public origin** for the button. The club hub repo's own
   docs name two: `https://adhquins-clubhub.com` and
   `https://quins-club-hub.netlify.app`. The custom domain is presumably
   the one. Both answered **200** on 8 Sep 2026; re-check before
   hard-coding, because this project has already shipped a dead Netlify
   subdomain once.
3. **Phase 2 suggestion from club hub memberships**: wanted, or leave the
   organiser to pick the role by hand? Fifteen managers once a year argues
   for by hand.

---

## Arguments against this spec, for whoever makes them next year

- *"Now the tournament site cannot sign anyone in if the club hub is
  down."* True for **new** sign-ins. Sessions already minted keep working,
  and the desk has a password account. That is the same exposure every
  "sign in with X" site accepts, and here X is a system the same committee
  runs.
- *"Just add an email field to the tournament accounts instead."* That was
  the first proposal on 8 Sep and it solves password reset and the review
  email. It does not remove the invite codes, it does not remove passwords,
  and it leaves two account lists for the same fifteen people to drift.
- *"Move the tournament site onto Supabase properly."* A rebuild of every
  function and every test for thirty logins a year, and it would put the
  tournament's data next to the club's under one security model. Identity
  federation takes the one thing worth sharing and leaves the rest apart.
- *"Match on email so existing accounts link themselves."* Refused for the
  reason `google-auth.js` refused it in July and the club hub relearned in
  August. Fifteen re-approvals is cheaper than one wrong link.
- *"Why keep any password code at all?"* Break-glass. Delete it the first
  year the hub proves reliable through both tournament days, and not before.
