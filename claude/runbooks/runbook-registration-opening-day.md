# Registration opening day — open the site and the forms

Two separate levers, on purpose. Making the site public is a Netlify setting.
Opening registration is a date in the back office. Neither needs a code
change or a deploy. Why the server decides the window:
`claude/decisions/2026-07-27-registration-window-server-decides.md`.
Behaviour: `RESTORE.md` § The registration window.

## When to use

- The day the site goes public, and the day registration opens. These need
  not be the same day.
- Whenever the opening or closing date moves.

## Before you start

- `runbook-registration-live-rehearsal.md` has passed.
- **Read the site-password state; do not assume it.** It has been recorded
  wrongly many times. Read it from the Netlify MCP (`get-project` →
  `projectAccessControls`) or from the Netlify UI.
- You are signed in to `/organizer` as an organiser.

## Steps

1. **In Netlify** (the maintainer, on the day): if the site password is on for
   production, turn it off in the site's password-protection setting. The
   password never goes into a chat or a tool call.
   ⚠️ Not yet worked out: the exact menu path in the Netlify UI is not
   recorded anywhere in this repo. Write it here the first time it is done.
2. **In `/organizer` → Registration tab:** enter the opening and closing dates
   in Abu Dhabi time. The date printed under each box is what the public page
   will show. Check it for a mistyped month.
3. **In `/organizer` → Registration tab:** set the mode to **Follow the dates**
   and save. **Force open** is for testing and **Force closed** is for closing
   early. Do not leave either on by accident.
4. **In `/organizer` → Club invite link box:** if clubs should declare now,
   check that the saved link reports as working (`runbook-club-form-key.md`).

## How to verify

- **In a private browser window, signed out:** `https://adhjrt.com` loads with
  no password prompt (step 1). The registration section says what the tab's
  preview said: the opening date and a countdown before it opens, and the
  closing deadline once it is open.
- **At the opening moment:** the homepage re-checks every second, so an open
  tab changes state by itself. A real submission goes through.
- No TEST MODE strip is showing.

## If it fails

- **The public page still says "opens soon":** no opening date is saved. With
  no opening date, registration stays closed by design.
- **Save is refused:** read the reason under the button. A closing date equal
  to or before the opening date is refused.
- **Visitors still get a password prompt:** step 1 has not taken effect, or it
  changed a scope other than production. Read `projectAccessControls` again.
