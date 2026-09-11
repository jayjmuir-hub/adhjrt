# Clearing rehearsal data from the fixtures/scores side

Removes rehearsal fixtures, results, and draws from `/organizer` after a
rehearsal has exercised the draw editor and score entry, before real
tournament data is entered. This covers the **draws, results and
publication state** kept in Netlify Blobs by `Organizer.dc.html` /
`scores-data.js`. It does **not** cover club/team/player registration
records — those live in a separate store with their own tool; see
`claude/runbooks/runbook-registrations-restore-and-delete.md` § B for
clearing rehearsal registrations.

The dedicated "Clear the rehearsal data" card this runbook was originally
written against was removed from `Organizer.dc.html` along with the old
Scores & Standings manager area. What replaced it, and what never needed
it in the first place, is below — verified against the current code before
being written down.

## When to use

- After running a rehearsal through the real draw editor and score entry on
  `/organizer` or `/manager`, before real fixtures and results are entered
  for the actual tournament.
- Before publishing anything for real, if a rehearsal draw or result is
  still sitting in the store.

## Before you start

- This is destructive to fixtures, results and publication state. It does
  **not** touch saved pools, team assignments, or anything in the
  registrations store.
- Sign in to `/organizer` with an organiser account first — every step below
  is done from there.
- Note which age groups you touch, so you can confirm the "how to verify"
  section against the same list afterwards.

## Steps

1. **In `/organizer` → Tournament tab:** press **Unpublish all**. Confirm the
   prompt. This unpublishes every age group at once — parents and coaches
   stop seeing any fixtures or standings until something is published
   again. (A single age group can instead be unpublished individually from
   its own draw screen, if only one needs clearing.)

2. **In `/organizer` → Tournament tab:** press **Reset the simulation**.
   Confirm the prompt. This is the current bulk-clear tool: it unpublishes
   every age group (redundant with step 1, but harmless), removes every
   stored result, and clears any generated bracket — while leaving saved
   pools and team assignments untouched. It writes and verifies each
   removal the same way the editor UI does; there is no separate, less
   careful code path for this button.

3. **If a saved draft draw itself (not just its results) needs clearing for
   a specific age group** — Reset the simulation does not delete draws,
   only results and brackets — call `save-schedule-override` for that group
   with `{ ageGroupId, reset: true }`. This is the same server-side action
   the draw editor's own reset control uses; there is no separate manual
   path. Do this per age group that needs it.

4. **In `/organizer` → Accounts tab:** revoke any manager account that was
   created only for the rehearsal (for example a test manager login for one
   age group). Use the **Revoke** action on that account's row. Leave any
   account that belongs to a real manager or organiser.

## How to verify

- **In `/organizer` → Tournament tab:** every age group shows "coming soon"
  (unpublished), with no rehearsal fixtures visible publicly on `/scores` or
  `/app`.
- **In `/organizer` → the draw editor for each age group you touched:** no
  results remain, and no bracket is showing for groups where one was
  generated during the rehearsal.
- **In `/organizer` → Accounts tab:** any rehearsal-only manager account now
  shows as revoked, not approved.
- Real, non-rehearsal saved pools and team assignments are still present —
  confirm nothing beyond fixtures/results/brackets moved.

## If it fails

- **Reset the simulation reports some results could not be cleared:** it
  names which ones. Re-run it — it only re-attempts what is still there,
  since already-cleared results are simply absent on the next pass.
- **A draw still shows old rehearsal teams after step 3:** confirm you used
  the correct `ageGroupId` for that group — `reset: true` clears the draft
  for the exact group named, not a "clear everything" call.
- **An age group still shows as published after step 1:** the bulk
  unpublish reports a count of failures if any occurred; check that count
  and retry just the affected group from its own draw screen.
- **You are not sure whether a wider bulk-clear tool exists for something
  not covered here:** there isn't a "delete every saved draw in one press"
  control any more — clear each affected age group's draw individually with
  step 3. If this ever changes, update this runbook rather than assuming
  the old card's behaviour still applies.
