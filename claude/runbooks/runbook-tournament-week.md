# Tournament week — pitch sheets, marshal links, and pitch names

What managers and organisers do in the week before the tournament and on both
days. It gets volunteer marshals scoring at the pitch, and makes the pitch
names in the app match the flags on the ground. Why:
`claude/decisions/2026-09-08-pitch-marshal-links.md` and
`claude/decisions/2026-09-08-marshal-token-reaches-one-pitch-only.md`.
Behaviour: `RESTORE.md` § Pitch marshals and § Venue — pitches and days.

## When to use

- When the pitch flags are ordered or printed (step 1).
- The week before the tournament, and on each tournament day (steps 2–6).

## Before you start

- The venue layout in `/organizer` → Venue & days tab is final.
- Every manager has signed in the day before
  (`runbook-hub-accounts.md` § C).
- An A4 printer, and a phone to scan with.

## Steps

1. **With whoever prints the pitch flags:** agree the sub-pitch letters. The
   names the app gives the split pitches (for example `B1A`–`B1D` inside pitch
   B1) were invented for this project and are not on the venue map. Either
   the flags use the app's names, or the layout is renamed to match the flags
   in `/organizer` → Venue & days.
2. **In `/manager` → Marshals tab, the week before (each manager):** issue a
   link for each pitch, press **Print pitch sheet**, and scan one sheet with a
   phone to see pitch mode work. A link is shown only once; if you lose it,
   press **Issue new**. Links issued early only become live on their day.
3. **On the morning (Saturday):** the sheets go out to the pitches with the
   flags. Each manager keeps a phone on the Marshals tab.
4. **A marshal swaps mid-morning:** nothing to do. The new parent scans the
   same sheet and types their first name on their first save.
5. **A sheet goes missing, or a link is forwarded somewhere it should not be:**
   the manager presses **Issue new** for that pitch and hands out a fresh
   sheet. Every phone on the old link gets the "no longer live" screen on its
   next save.
6. **On day 2 (Sunday):** the day-2 groups' links become live on their own,
   and Saturday's stop working. Nothing to do.

## How to verify

- The test scan in step 2 opens pitch mode for that pitch only.
- On the day, results entered at a pitch appear on `/scores` and in the app.

## If it fails

- **The print sheet does not open:** allow pop-ups for the site. The page says
  *"Allow pop-ups to print the sheet."*
- **A scan says the link is not live:** check that it is that group's day, and
  that the link was not replaced by **Issue new**.
- **The pitch names do not match the flags:** step 1 was skipped. Rename the
  pitches in the venue layout, or tell the marshals which name is which. Do
  not reprint in the middle of the day.
