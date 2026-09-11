# Club form key — rotate it, or switch the club form off

The club registration form (`/register-club`) is unlisted. The only thing
protecting it is `CLUB_FORM_KEY`, which travels in the invite link as `?k=…`.
This runbook changes that key, or switches the form off by removing it. Why
the link is organiser-only:
`claude/decisions/2026-08-11-club-invite-link-is-organiser-only.md`.
Behaviour: `RESTORE.md` § Club-level registration, behind a keyed link.

## When to use

- **Rotate:** the invite link has reached somebody it should not have.
- **Switch off:** the club declaration stage is over and the form should
  refuse everyone.

## Before you start

- Changing a Netlify environment variable does nothing until the next deploy
  (`RESTORE.md` § Changing a variable needs a deploy). A production deploy
  costs credits (see `CLAUDE.md` → Money), so where you can, make this change
  ahead of a deploy that is already planned.
- Never paste the key into a chat, a commit, a Linear ticket or a tool call.
  It lives only in Netlify and in the saved link.

## Steps

**To rotate the key**

1. **In Netlify** (the maintainer): Site configuration → Environment
   variables, then edit `CLUB_FORM_KEY` and give it a new, long random value.
2. **In Netlify:** deploy production, either with a planned merge or with
   **Deploys → Trigger deploy**.
3. **In `/organizer` → Club invite link box:** the saved link now reports
   *"This link no longer works — the key has been rotated"*. Paste the new
   link (`https://adhjrt.com/register-club?k=<new key>`) and press **Save**.
4. **By email:** send the new link to the clubs that should have it. The old
   link no longer works for anyone.

**To switch the form off**

1. **In Netlify** (the maintainer): delete `CLUB_FORM_KEY`.
2. **In Netlify:** deploy production, as above.
3. **In `/organizer` → Club invite link box:** the box reports *"The club form
   is switched off"*. That is the intended state, not a fault.

## How to verify

- **In a private browser window:** open the old link and submit a test
  declaration. It is refused. A wrong key and a missing key give the same
  refusal on purpose.
- **After a rotate:** the new link opens the form, and the Club invite link box
  shows it as working.

## If it fails

- **The box still says the link works after a rotate:** the deploy has not
  happened yet, so the functions still see the old value. Check that the
  deploy id moved.
- **The new link is refused:** the saved link and the variable disagree.
  Check the saved link for a stray space or a truncated paste.
