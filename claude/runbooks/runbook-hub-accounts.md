# Hub accounts — onboarding, draw rights, hub outages, and retiring the old sign-in

Managers and organisers sign in with Quins Club Hub. This runbook covers
approving them, giving a manager draw rights, what the desk does if the hub is
down, testing and proving hub sign-in, and removing the old password and
invite paths. Why: `claude/decisions/2026-09-08-club-hub-is-the-identity.md`,
`claude/decisions/2026-09-08-organiser-password-break-glass.md`,
`claude/decisions/2026-09-09-hub-auto-approve.md`,
`claude/decisions/2026-09-08-draw-rights.md`. Behaviour: `RESTORE.md`
§ Sign in with Quins Club Hub and § Draw rights.

## When to use

- A new manager or organiser needs access (**A**).
- A manager has asked to edit their group's draw (**B**).
- Tournament week, as routine, and when the hub is unreachable on the day
  (**C**).
- Testing a change to hub sign-in (**D**).
- Every organiser holds a hub-linked account and the old paths can go (**E**).

## Before you start

- You are signed in to `/organizer` as an organiser.
- The club hub side (the `/connect/tournament` screen and its list of allowed
  origins) lives in the club hub's own repo, with its own tests and deploy.
  Nothing in this repo changes it.

## Steps

**A · Onboard a manager or organiser**

1. **The person, in a browser:** goes to `/signin` and signs in with the Club
   Hub. A coach whose hub squad maps to one age group is approved
   automatically. Anyone else lands as pending.
2. **In `/organizer` → Accounts tab:** for a pending row, use the row's picker
   to choose the role (and, for a manager, the age group), then press
   **Approve**. An auto-approved account shows *"from the Club Hub · <group>"*.
3. **If the person also had an old manager password account:** once their hub
   account is approved, **Revoke** the old one. Old accounts are never linked
   automatically.
4. **For an organiser:** keep their password account as the break-glass
   *desk* account, and make its name say so. Both accounts appear in the list,
   on purpose.

**B · Turn on draw rights for a manager**

1. **Tell the manager first**, in person or by message. A manager who finds
   the draw read-only should hear why from a person.
2. **In `/organizer` → Accounts tab:** open the manager's card. Under **Draw
   rights**, tick the switches they need (**Edit pools and teams**, the times
   switch, or both). Each is one click.
3. **If the manager has only one of the two rights** and their group has no
   saved draft yet: an organiser opens that group (`/manager`, then the
   age-group switcher) and saves the draw once. Until then, the manager is
   told *"Ask a tournament organiser to save this group's draw once…"*.

**C · Tournament week and a hub outage**

1. **The day before:** ask every manager to sign in once. A session made then
   keeps working on the day without the hub.
2. **If the hub is unreachable on the day:** the desk signs in to `/organizer`
   with an organiser **password** (desk) account, opens **View manager area**,
   and uses the age-group switcher to act for any group.

**D · Test hub sign-in, and prove the membership read**

1. **In a browser:** test the full loop on
   `https://dev--adhquins-jrt.netlify.app` or
   `https://compare--adhquins-jrt.netlify.app`. **Not on a deploy preview.**
   Preview origins are not on the hub's list of allowed origins, so the hub
   will not send a token back to one.
2. **To prove the squad read after changing it:** in a browser signed in to
   the Club Hub, copy the access token from the hub session. POST it to the
   deployed function `/.netlify/functions/hub-auth` as
   `{ "hubToken": "…" }`.
   ⚠️ The token is a live credential. Never paste it into a chat, a commit or
   a Claude tool call; run the request yourself, in your own browser or
   PowerShell.
   ⚠️ Not yet worked out: where in the hub's browser session to read the token
   from is not recorded.
3. **Control:** POST `{}`, with no token, to the same function. It must answer
   **401**. A success in step 2 means nothing without this refusal beside it.

**E · Remove the old sign-in paths ("deploy 2")**

1. **Check first:** in `/organizer` → Accounts tab, every organiser has a
   hub-linked account. If any does not, stop.
2. **In the code, on `dev`:** remove `manager-signup.js`, `organizer-signup.js`,
   the `MANAGER_INVITE_CODES` handling, `accounts-admin`'s `create` for
   **managers** (it stays for organiser break-glass accounts), and
   `tests/test-signup-ratelimit.js`. Delete each test in the same commit as the
   code it tests, repoint any `_prove-registration.js` anchor on it, and add a
   tombstone in `RESTORE.md`. This change is big enough to need a spec first
   (`CLAUDE.md` rule 9).
3. **Land it** through `runbook-merge-dev-to-main.md`, and check it live.
4. **In Netlify** (the maintainer), **only after** step 3 is verified live:
   delete `MANAGER_INVITE_CODES` and `GOOGLE_CLIENT_ID`.

## How to verify

- **A:** the person signs in again and lands on the right dashboard for the
  right group. The old password account shows as revoked.
- **B:** signed in as that manager, they can edit the parts of the draw they
  were given, and nothing more.
- **D:** the real token returns the expected account state, and the no-token
  control returns 401.
- **E:** `/signin` still works through the hub on production, and a desk
  password account still signs in.

## If it fails

- **Approve is refused for a hub row:** the account has no role yet. Pick one
  on the row first. A hub account cannot be approved without a role.
- **An auto-approved coach lands as pending again:** their hub squad changed
  or was renamed. Approve them by hand. A renamed squad also means checking
  the name mapping in `_hubAuth.js`.
- **Hub sign-in fails only on a preview URL:** expected. Use `dev--` or
  `compare--`.
- **The no-token control does not return 401:** step D2's result proves
  nothing. Find out what answered before believing either reading.
