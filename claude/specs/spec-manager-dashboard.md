# Spec — Manager Dashboard

Status: approved by Jay (design), not yet built. 31 Jul 2026.

## Problem

Managers (one login per age group — e.g. `u18b` — not one per club team) currently
sign in from inside `/app` (`app.html`), a page built for the general public.
Sign-in is a modal reached via the "More" tab; once signed in, score-entry
buttons simply appear on top of the same public Fixtures/Today rows everyone
else sees. There is no dedicated manager experience — everything a manager
needs is mixed in with public browsing (other age groups, "follow a team",
general navigation) that they don't need.

Jay's ask: a separate, clean, purpose-built dashboard for managers, similar in
shape to `/organizer` — its own page, own login, own tabs — carrying the exact
same functionality managers have today, just decluttered.

## Scope decisions made during brainstorming

- **New page, `/app` untouched** (not a redesign of `/app` in place). `/app`
  keeps working exactly as it does today for the general public and as a
  fallback, for the whole build. Chosen over editing `/app` directly because
  `/app` is the live matchday tool — building and proving the new page
  separately means no risk to a tool used for real, live tournament scoring
  while it's being built.
- **"Manager" = one age group, not one club team.** There is no club-team-level
  manager role in this system — clarified explicitly with Jay after an early
  misunderstanding in the brainstorming questions (the first couple of
  clarifying questions wrongly assumed a manager owns one team's roster; Jay
  corrected this — a manager runs scoring for an entire age group's matches).
- **No new capabilities** — this is a UI/structure rebuild, not new manager
  functionality. Everything on the new page is something a manager can already
  do today via `/app`; nothing is added, nothing is removed (at build time).
- **Rollout is staged, not a swap.** `/app`'s manager sign-in is NOT removed as
  part of this build. Only after Jay has tried the real `/manager` page and is
  happy would a later, separate, small change remove the sign-in option from
  `/app`'s More tab.

## Design

### Route

New page `Manager.dc.html`, added to `netlify.toml`:

```
[[redirects]]
  from = "/manager"
  to = "/Manager.dc.html"
```

Same pattern as the existing `/organizer` → `Organizer.dc.html` and
`/app` → `app.html` redirects.

### Login

Own login screen on the page itself (not a modal), same shape as
`Organizer.dc.html`'s login screen. Calls the EXISTING `manager-login.js`
backend function unchanged — no backend changes needed for this build. Session
token handling (role `manager`, `ageGroupId` from the account) is unchanged
from what `/app` already does.

### Tabs

Four tabs, all scoped to the signed-in manager's own `ageGroupId` only — no
browsing other age groups, no "follow a team," no general public "More" menu:

1. **Today** — same "jump to the next unscored match" behaviour as `/app`'s
   Today tab.
2. **Fixtures & scoring** — every match in the manager's age group, with the
   same score-entry sheet `/app` already has: enter tries, save, Clear result,
   walkover handling, the "did you mean 0–0?" confirmation on an all-zero
   save. This merges what are currently two separate things in `/app`
   (browsing Fixtures, and the sign-in-gated scoring UI layered on top of it)
   into one tab, since a manager only opens Fixtures in order to score them.
3. **Results** — same as `/app`'s Results tab, scoped to the manager's age
   group.
4. **Tables** — standings for the manager's age group: same computation,
   same tie-break order, same coin-toss badge as `/app`'s Tables tab.

Deliberately NOT carried over: "follow my team," browsing other age groups,
the general "More" menu. These are public-facing features a manager running
their own age group has no use for. (If review turns up something a manager
actually relies on in `/app` today that isn't captured above, add it before
building — this list is the point to catch that, not after.)

### Data layer

`Manager.dc.html` calls the SAME functions in `scores-data.js` that `app.html`
already calls (`getSchedule`, `submitResult`, the standings computation, etc.)
— no duplicated logic. A fix to the underlying data layer only ever needs
making once, and both pages stay correct together. No new backend functions,
no new Netlify functions, no schema changes.

### Styling

Matches `Organizer.dc.html`'s visual language: a tab bar (not `/app`'s bottom
mobile-app nav), the same larger touch-target and text-size treatment the
Venue & days tab redesign already established (14–19px body/checkbox sizing).
Still built mobile-first — this is used pitch-side on a phone, same as `/app`
is today.

## Out of scope (explicitly, for this build)

- Removing the sign-in option from `/app`'s More tab — later, separate,
  small follow-up, only after Jay has used the real `/manager` page.
- Any new manager capability not already present in `/app` today.
- A club-team-level manager role — does not exist in this system; not being
  added here.
- Backend/API changes — `manager-login.js` and `scores-data.js`'s existing
  functions are reused unchanged.

## Testing plan

- Full existing suite re-run (2,012 checks / 228 injected faults as of 30 Jul)
  must still pass unchanged — this build touches no shared logic files in a
  way that should change their behaviour, only adds a new page on top.
- New checks specifically proving the new page's score entry, Fixtures/Today,
  Results and Tables tabs work — each proven against a real injected fault
  (per project convention: a check that only confirms its own change was
  applied is not a verification).
- Verified in the sandbox and on the `cafnet` PC with matching file hashes
  before anything is pushed, same as every other change on this project.

## Rollout

1. Build `Manager.dc.html` + the `netlify.toml` redirect on `dev`. `/app` is
   not touched.
2. Show Jay the diff, get a yes, push to `dev` (free).
3. Jay tries `/manager` for real (a manager account, real or test).
4. Once approved, merge `dev` → `main` (15 credits) — `/manager` goes live
   alongside `/app`, which still works exactly as before.
5. Separate future step (not part of this build): remove the sign-in option
   from `/app`'s More tab, once Jay is fully happy with `/manager` and wants
   to retire the old path.
