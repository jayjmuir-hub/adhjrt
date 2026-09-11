# Full tournament rehearsal — drive the whole weekend with test data

A structure for rehearsing everything that runs on the tournament days, on
production, with test data, and then removing that data. It covers
registrations, accounts, the draw, publishing, scores, standings, knockouts
and the public views. No deploy is needed, because it exercises data, not
code.

## When to use

- Before a tournament, when you need to prove the organisers' workload at full
  size, or a draw shape that has not been used before.

## Before you start

- Test registrations use club names starting with **`Rehearsal`**, so the store
  can remove them. See `runbook-registration-live-rehearsal.md` → *Before you
  start*.
- ⚠️ Not yet worked out: how to load a full-size set of test registrations
  (hundreds of teams, thousands of players) into the registrations store. There
  is no import path into the store. The old method loaded rows into Google
  Sheets, and the site no longer reads the sheets. Until there is a way, use as
  many teams as can be entered through the real forms.
- Never commit, log or paste any registration value, test data included.
- Note every test account you create, so you can revoke it afterwards.

## Steps

1. **Registrations, on the live site:** register the test teams and players
   through the real forms. If the forms are closed, use **Force open** (see
   `runbook-registration-live-rehearsal.md` step 1). **In `/organizer` →
   Registrations tab:** check that they appear, grouped by club and age group.
2. **Manager accounts, in `/organizer` → Accounts tab:** approve test hub
   accounts (`runbook-hub-accounts.md` § A), or make test managers with
   **Create a login** → **Manager**. Alternatively, an organiser can act for
   every group through **View manager area** and the age-group switcher.
3. **The draw, in `/manager` → Draw tab, for each age group:** in **Registered
   teams**, choose **Replace the pools**, review the moves, and import. Set the
   pitches and kick-off times, and save. Check that teams from one club are
   kept apart where possible. Check that replacing is blocked once a match in
   the group has a result, while **Add the missing ones** still works.
4. **Publish, in `/manager`:** publish one group. In a private (signed-out)
   window, check that group is public and the others are not. **In
   `/organizer` → Tournament tab:** press **Publish all**. Unpublish one group,
   and check it leaves the public view but stays in the editor.
5. **Scores, in `/app`, in `/manager`, or through a pitch marshal link:** score
   three groups fully and spot-check the rest. Check that a manager cannot
   score another group's match, and that a walkover records as 20–0 with 4
   tries and shows as a walkover. Check that U6 and U7 take scores but show no
   table.
6. **Standings:** enter results that force each tie-break, in the order
   `scores-data.js` applies them: margin, points for, head-to-head, fewest
   points conceded, a mini-league for three or more tied teams, then the
   coin-toss flag. Check that `/scores`, the homepage and the app show the same
   table.
7. **Knockouts, in `/manager` → Draw tab:** press **Generate knockout from
   standings**. It stays blocked until every pool match is scored, so try it
   one result short first. Score the knockout, then press **Generate finals
   from knockout**. Check the double-bracket groups (`SPECIAL_BRACKET_AGE_IDS`
   in `scores-data.js`) separately.
8. **Public views, signed out:** check the homepage fixtures and results,
   `/scores`, and every tab of `/app`, including following a team. Test app
   navigation on production (`runbook-rendered-audits.md` § F). The app's Today
   tab shows only the current day's matches. To test it early, change the date
   the app uses on a branch and look at the free branch deploy. Never move the
   real tournament dates.
9. **Edge cases:** add a late entry with **Add the missing ones** after
   results exist; remove a withdrawn team by hand; add a guest team typed as
   free text; and, as a manager, try to read another group's registrations.
   That read must be refused, because the group comes from the signed session,
   not the request.
10. **Clean up:** clear draws, results and publishing with
    `runbook-clearing-the-rehearsal-data.md`, and registrations with
    `runbook-registrations-restore-and-delete.md` § B. **Revoke** the test
    accounts in `/organizer` → Accounts tab.

## How to verify

- Each step's checks held. Anything that did not hold has a Linear ticket.
- After step 10: every group shows "coming soon" publicly, no `Rehearsal…`
  club is left in `/organizer`, and every test account is revoked.

## If it fails

- **Something breaks mid-rehearsal:** record it in Linear, and carry on with
  the steps that do not depend on it. Finding breakages is the point.
- **A cleanup step refuses:** follow the *If it fails* section of that
  runbook.
