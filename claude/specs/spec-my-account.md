# My account — DESIGN

> **Status: SPEC, 3 August 2026.** Agreed with Jay in conversation the same day.
> Supersedes the narrower "link Google" idea he first asked for: he asked for a
> real My account card showing a person their own details, with the actions on
> it, for BOTH roles.

## What Jay asked for

1. **Link a Google account to an existing login**, so someone whose account was
   created in the back office can use the Google button afterwards.
2. **The same for managers, not just organisers.**
3. **A proper "My account" card for both roles that shows them their own
   information as well as offering the actions.**
4. **An organiser can click any account in the Accounts tab and see the same
   card for that person.**

## Why it is needed

`google-auth.js` finds an existing account exactly one way —
`accounts.find((a) => a.googleSub === identity.sub)` — and nothing ever sets
`googleSub` except signing up *through* Google. `accounts-admin.js`'s create
action does not set it, and no action anywhere links one. That is deliberate
(the file says so: *"it never silently attaches itself to someone's existing
password login"*), and it is the right default — auto-matching a Google
identity to an account by email or name is how somebody ends up in an account
that is not theirs.

The consequence, since `ORGANIZER_INVITE_CODE` was deleted on 3 Aug: **every
organiser created from now on is password-only, permanently.** The same is true
of any manager created in the back office or self-signed-up with a password.
Linking closes that, safely, by making the person prove both halves.

**And two gaps turned up while scoping it:**

- **A manager cannot change their own password.** `changeMine` exists in
  `accounts-admin.js`, but that file's door is `requireOrganizer`, so a manager
  gets a 403 — and there is no UI for it on `/manager` anyway.
- **`/manager` has no account UI at all**, just a logout button.

## The design

### 1. One endpoint: `netlify/functions/my-account.js`

**The door is ANY valid session, not an organiser session.** That is the whole
reason this cannot live in `accounts-admin.js`, whose `requireOrganizer` gate
applies to every action behind it.

⚠️ **THE ACCOUNT ACTED ON IS ALWAYS THE ONE IN THE VERIFIED TOKEN, NEVER A
USERNAME FROM THE BODY.** Standing rule in this codebase, and here it is the
only thing standing between "link my Google account" and "link my Google
account to somebody else's login."

| | |
|---|---|
| `GET` | your own account's safe fields (below) |
| `POST {action:'password', currentPassword, password}` | change your own password |
| `POST {action:'linkGoogle', idToken}` | attach a Google identity to your own account |

**Safe fields only, on the way out:** `name`, `username`, `role`, `title`,
`ageGroupId`, `createdAt`, and a derived `signInMethod` of `'Password'`,
`'Google'` or `'Both'`. **Never `passwordHash`. Never `googleSub` itself** —
it is an internal Google id, the caller does not need it, and
`accounts-admin.js` already strips it from its own listing for the same reason.
A boolean is enough to drive the UI.

### 2. Linking rules, and why each refusal exists

- **No or invalid session → 401.** **No or invalid Google ID token → 401.**
  Both halves have to be proved; either alone is worthless.
- ⚠️ **That Google identity already on ANOTHER account → 409.** The one that
  really matters. `google-auth.js` resolves a sign-in with
  `accounts.find((a) => a.googleSub === sub)`, so two accounts sharing an
  identity would silently resolve to whichever comes first in the list — a
  quiet account mix-up in a system holding children's dates of birth and
  medical notes. Checked against every account before writing.
- ⚠️ **Your own account already has one → 409, refuse; do not replace.**
  Replacing would let a stolen session swap the Google identity to the
  attacker's own, giving them a way back in that survives the victim changing
  their password. Re-linking the SAME identity is a no-op success, so a
  double-click or a retry is harmless.
- **Consequence, accepted deliberately: there is no unlink and no way to move a
  Google account.** For ~18 accounts on a volunteer tournament that is the
  right trade. If it is ever needed, an organiser-only clear action is the
  place to add it — not a replace-on-link.
- **A pending account cannot link**, because it cannot sign in, so it has no
  session. Falls out of the design rather than needing a rule.
- **The password floor applies to the password action** (`passwordProblem()`,
  the shared rule) — it is a password being SET. It must NOT apply anywhere a
  password is merely checked.

### 3. `changeMine` is retired from `accounts-admin.js`

Once `/organizer` calls the new endpoint, `accounts-admin.js`'s `changeMine`
has no caller. **Delete it in the same commit** rather than leaving it — this
repo's root IS the deployed site and the repo is public, so an uncalled action
is still published, and two ways to change your own password is two rules that
drift. Its test coverage moves to the new suite with its subject; the fault
that guards it gets repointed, not dropped.

(`action:'password'` — an organiser resetting *someone else's* password — stays
in `accounts-admin.js`. That is genuinely an organiser power and belongs behind
that door.)

### 4. The card

One modal, opened from the header on both pages, showing:

- **Name**, and **username** labelled as what they sign in with.
- **Role** in words: "Organiser" plus their title if set, or "Age-group
  manager" plus the age group's real NAME (U14B Contact), not its id.
- **Sign-in method**, and when it is Password only, the button to add Google.
- **Member since**, from `createdAt`.

Actions: **Change password**, **Link Google**. Both roles, same card.

The Google button only appears when `GOOGLE_CLIENT_ID` is configured — the same
`clientId === null` rule `/signin` already uses to decide whether Google exists
at all.

### 5. One card, two modes — and the line between them

The same card serves "my account" and "an organiser looking at somebody
else's". Only the actions differ, and the difference is not cosmetic.

| | Your own account | Someone else's (organiser only) |
|---|---|---|
| The information | same | same |
| Change password | ✓ needs your current password | — |
| Reset password | — | ✓ `accounts-admin` `action:'password'`, no current password: the point is they lost theirs |
| Approve / reject / revoke | — | ✓ existing `accounts-admin` actions |
| **Link Google** | ✓ | ⚠️ **NEVER** |

⚠️ **Link Google is absent from the other-person mode by design, not omission.**
The entire security property is that the account holder proves control of BOTH
halves — the account (by being signed in as it) and the Google identity (by
producing a valid token for it). An organiser attaching a Google identity to
someone else's login would be attaching *their own* Google identity, which is
precisely the account takeover the `googleSub`-only lookup exists to prevent.
If a manager wants Google, they link it themselves from their own card.

**No new endpoint is needed for the viewing half.** `accounts-admin.js`'s GET
already returns every account with `passwordHash` and `googleSub` stripped and
a derived `signInMethod`, which is exactly the field set the card renders. The
organiser-only door on that file is correct and stays.

### 6. The duplication to respect

There is no build step and no shared component system, so the card is written
into both `Organizer.dc.html` and `Manager.dc.html`. That is the same cost
already paid by `DEFAULT_VENUE` and the registration copy block. **The data
layer is NOT duplicated:** `myAccount()`, `changeMyPassword()` and
`linkGoogle()` go in `scores-data.js`, and `organizer-data.js` re-exports them,
the existing pattern.

A test asserts both pages call the same `api.*` functions, so one page cannot
quietly grow its own version.

## Testing

New `tests/test-my-account.js`, driving the real handler with the same
discriminating-stub harness `test-unified-login.js` uses:

- GET returns the signed-in account and **never** `passwordHash` or
  `googleSub` — asserted with a sentinel, both roles.
- **A MANAGER can use every action.** The whole point; a role check creeping in
  would silently re-break it.
- The account acted on comes from the TOKEN: a body carrying another username
  changes nothing on that other account. Fault: read the username from the body.
- Linking an identity already on another account is refused, and **the other
  account is left untouched**.
- Linking over an existing identity is refused; re-linking the same one is a
  no-op success.
- After linking, `google-auth.js` resolves that person — driven end to end
  through the real handler, not asserted from the stored field.
- Password change verifies the current password and applies the shared floor.
- Signed out, every action is 401 and nothing is written.
- **A MANAGER cannot reach the other-people actions.** `accounts-admin.js` is
  organiser-only and stays that way; asserted, because the new card living on
  `/manager` is exactly the change that might tempt someone to relax it.
- The organiser's account listing still strips `passwordHash` and `googleSub` —
  re-asserted here because the card is now what renders it.

Every new assertion proven against an injected fault. New file added to
`runall.ps1` **by hand in the same commit**, and it will join
`_prove-registration.js`'s baseline automatically now that the baseline is
derived from the faults.

## Deploy

New function plus two changed pages (three counting the Accounts tab rework),
so this needs a real deploy. It batches
with the two changes already waiting: the `/organizer` Accounts help copy
(`83ff9da`) and the removal of the organiser signup option from `/signin`. One
15-credit deploy covers all three.

## Open questions

None. The refuse-rather-than-replace choice and the no-unlink consequence are
recorded above as decisions, not oversights.
