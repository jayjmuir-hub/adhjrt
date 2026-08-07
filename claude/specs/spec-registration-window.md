# Spec — the registration window

_Designed 27 July 2026 with Jay. This is the agreed design, written down before any
code._

> ## STATUS — updated 27 July 2026
>
> **Sub-project 3's DISPLAY half is BUILT** and pushed as branch
> `feat/registration-window` (commit `6605ac9`). Not merged, not deployed.
> **`claude/plans/registration-window-build.md` is what actually shipped** — read that
> before touching any of this, and trust it over this document where they differ.
>
> Sub-projects **1 (the gateway) and 2 (the rules) are NOT built**, and the
> enforcement half of this spec waits on 1.
>
> Four places where the build deliberately went past or away from what is written
> below are marked **[BUILT DIFFERENTLY]** in-line. Nothing here was abandoned;
> each one is a decision that got better once there was real code in front of it.

## Why

The site and registration are currently the same switch, and neither is really a
switch — `registrationOpen` is a hardcoded prop defaulting to `true`, so changing it
costs a deploy. What Jay actually needs is two independent levers:

- **The site goes public** — around 45 days out. That is removing the Netlify site
  password, a platform setting. No code.
- **Registration opens later** — around 30 days out, on a date not yet chosen, and it
  **closes again** before the tournament so the squads are fixed while the draw is
  built.

"Or whatever date we choose" is the requirement that matters: the dates will move, and
moving them must not need a deploy.

## Two decisions taken during design

**Times are Abu Dhabi time, not the visitor's.** The existing date code uses
browser-local time (`new Date(2026, 7, 31)`), so "opens 8 October" would be a different
instant for a club in the UK than for one in Dubai. Stored dates carry an explicit
`+04:00`. A deadline for an Abu Dhabi tournament is an Abu Dhabi deadline.

**The browser decides what to SHOW; the server decides what to ACCEPT.** Anyone can
change their clock and make the form appear. That is fine, because the submission still
bounces. This is only true once submissions go through the validating function — see
"Enforcement".

## The setting

One object, stored in a `settings` blob:

```
{
  opensAt:  '2026-10-08T00:00:00+04:00' | null,
  closesAt: '2026-11-01T23:59:59+04:00' | null,
  mode:     'auto' | 'open' | 'closed'
}
```

**Three states, not a date plus a toggle.** `auto` follows the dates; `open` and
`closed` are deliberate exceptions. One source of truth — a date field and an
independent on/off switch is how you end up with the two disagreeing and nobody sure
which wins.

**Null dates mean closed.** Before anyone sets a date, `auto` resolves to closed. The
panel says so in words rather than leaving a blank date looking like an oversight.

_(Built as the `config` blob store at key `registration`, alongside `venue`.)_

## One function decides

```
registrationState(settings, now) -> { open, phase, opensAt, closesAt, forced }
```

`phase` is `'before' | 'open' | 'after' | 'unset'`. `forced` is true when `mode` is not
`auto`, so the UI can say which.

**Pure and synchronous** — no fetching, no clock of its own, `now` passed in. That is
what makes it testable at the boundaries: one second either side of each end, in each
mode, with dates unset, and with `closesAt` before `opensAt`.

It exists **twice** — once in `scores-data.js` for the front end, once in the shared
server module — because the front end needs an answer before any fetch resolves. A test
asserts the two copies are identical, exactly as `test-venue.js` does for
`DEFAULT_VENUE`. That duplication is deliberate and guarded, not accidental.

> **[BUILT DIFFERENTLY] — `phase` never reflects the mode.**
> Writing the copy made it obvious that `phase` and `open` are two different
> questions. `phase` is now **pure date arithmetic** and the mode never touches it;
> `open` is whether the form works, mode first and dates second. Keeping them apart
> is what stops a force-closed window having to lie about which phase it is in.
> `mode` also comes back on the result.

> **[BUILT DIFFERENTLY] — the shared block is bigger than one function.**
> `validateSettings`, `registrationWarnings` and `registrationCopy` are in it too,
> and `organizer-data.js` **re-exports** the lot rather than reimplementing. So the
> back office calls the *server's own* validator: Save cannot go green on something
> the server will reject, and the preview cannot show wording a coach will not see.
> That is one better than the venue panel, where two hand-written copies of one rule
> need `test-venue-panel.js` to catch them drifting. Cost: `/organizer` now loads
> `scores-data.js`.

## Where it lives

A new `registration-window` function following `venue-layout.js` line for line, because
that pattern is already proven in this codebase:

- **Public GET** — the homepage reads it with no auth.
- **Organiser POST** — validated server-side, rejected with a reason the panel shows.
- **Defaults in a shared module**, with `mergeSettings()` replacing wholesale rather
  than field-by-field, same as `mergeVenue()`.
- **A reset that DELETES the key** rather than writing defaults back, so a later change
  to the defaults reaches a reset site.

Edited from a new tab in `/organizer`, alongside Venue & days. Organiser-only,
re-checked server-side.

**Validation the server enforces:** a date that does not parse, `closesAt` before
`opensAt`, and a `mode` outside the three values. All refused with the reason shown,
not silently coerced.

> **[BUILT DIFFERENTLY] — `mergeSettings` is field-by-field, and there is no cache.**
> `mergeVenue` replaces a day wholesale because merging its pitch list would make
> removing a pitch impossible — the default would keep putting it back. That trap
> does not exist here: there are no lists, and `null` is already the default for both
> dates, so no value is unreachable. Copying the pattern for its own sake would just
> throw away a half-written blob.
> `_venue.js` also caches per instance because the layout is read on every fixtures
> request. This blob is read once per homepage view and it decides whether a form is
> open, so it is **not cached** — a warm instance serving dates an organiser changed
> ten minutes ago is the worse trade.
>
> One rule got **stricter** than written: `closesAt` on or *equal to* `opensAt` is
> refused, not just before. A zero-length window is never what anyone meant.
> `isRealDate()` was also added, because `Date.parse` accepts `2026-02-31` and rolls
> it forward to 3 March — the same trap `composeDob()` closes on the player form.

## What the public sees

Three phases, not two. Each drives the copy that already exists behind
`registrationOpen`, plus one new state:

| Phase | The page says |
|---|---|
| `unset` / `before` | "Registration opens 8 October" with a countdown; the existing closed-state copy underneath |
| `open` | "Registration closes 1 November" — **a deadline is more use to a coach than an open date** |
| `after` | "Registration closed on 1 November" — say what happened rather than showing a dead form |

The buttons and both modals are gated on `open`, exactly as `registrationOpen` gates
them today.

**A TEST MODE strip** shows whenever the form is open because `mode` is `'open'` rather
than because of the dates. So a test session can never be mistaken for the real thing,
and a visitor who gets in early knows it is not live.

This replaces the `?register=test` URL override discussed earlier. A back-office
setting is better: no secret to leak, no query string to remember, and the same switch
the real opening uses — so the mechanism is exercised before it matters.

> **[BUILT DIFFERENTLY] — `unset` and `before` are separate, and there is a fifth line.**
> `unset` cannot say "opens 8 October" because there is no date; it says
> "REGISTRATION OPENS SOON" and names no month. And force-closed *inside* the dates
> needed its own line — "REGISTRATION IS CLOSED" — because "opens soon" would be
> untrue and the phase wording would print a closing date that has not happened.
> The `registrationOpen` prop is **retired**, not repointed: one lever, not two.
> The homepage recomputes off the one-second countdown timer it already runs, so the
> page opens and closes itself at the exact instant on a tab nobody reloaded.

## Enforcement

The window is checked in the **same function that validates ages and squad caps** —
the one being built to sit in front of team and player submissions. A submission
outside the window is refused with a real error the form shows.

One place, both rules. This is the argument for building the window and the age
validation as **one piece of work**: they are the same function, and building them
separately means touching the submission path twice.

The override applies server-side too. Forcing open has to let Jay submit a real test
registration end to end, or it is not a test.

**None of this is built.** `registration-window.js` says so in its header, and so does
`_registration.js`. Nothing yet refuses a late submission — submissions still go
straight to Netlify Forms. The only thing keeping the public out is the site-wide
Netlify password. Do not mistake the display half for enforcement.

## Testing

- `registrationState()` at every boundary — a second before and after each end, each
  mode, dates unset, and `closesAt` before `opensAt`.
- The two copies of the function are identical (`test-venue.js` pattern).
- The panel: save disabled while invalid and the reason shown; client and server agree
  on what is valid (`test-venue-panel.js` pattern).
- The homepage renders the right phase for a given `now`, driven through the component
  rather than grepped — the lesson from the pitch-count test.
- **Every assertion proven against an injected fault before it is trusted.** That is now
  a rule on this project, not a nicety: it has caught four hollow tests so far.

_Built: 380 checks across `test-registration.js` and `test-registration-panel.js`, plus
`_prove-registration.js`, which injects 17 faults and requires each to be caught by the
check that claims to guard it. The timezone claim is tested by running the display
answers in five timezones from +14 to −11 — the only thing that catches `fmtWindowDate`
being rerouted through a `Date` object, which passes everything else on a UTC machine.
Three assertions were wrong when first written and were corrected against the code; the
list is in the footer of `test-registration.js`._

## Not in scope

- Removing the Netlify site password. That is Jay's, on the day, in the Netlify UI.
- Any change to what a registration *contains* — this is only about when the form is
  open.
- Separate windows for team and player registration. One window covers both. Revisit
  only if Jay wants players to keep registering after teams close.

## How this gets built — three sub-projects, in this order

The scope check says this is not one plan. It is three, and they have a dependency
order. Each one produces working, testable software on its own.

### 1. The submission gateway — do this first  ⟵ **STILL THE NEXT THING**

Team and player submissions POST to a Netlify **function** that validates and returns a
real error, instead of going straight to Netlify Forms. Nothing about the *rules*
changes yet; this is purely moving the door.

Why first: it is the foundation both other pieces need, and it is the only piece with
real architectural risk — the confirmation emails and the sheet append currently hang
off the Forms `submission-created` event, and moving the front door means deciding what
still triggers them.

**Those emails are now PROVEN to work** (27 July, on a live test registration), which
raises rather than lowers the care needed here: the gateway must not break a path that
is known good. Re-test both confirmation emails end to end before and after the change,
and treat a regression there as a blocker, not a follow-up. **Do it while there is no
traffic and 80 days of runway**, not in October.

Ships nothing visible. That is the point.

### 2. The rules

Age against the UAERF cut-off on the team form's roster rows — client-side for the
coach, and in the gateway so it is actually enforced. Per-player play-up consent tick.
Squad cap moved server-side too, since it is the same shape of rule and currently
client-only.

**This is the one with a real-world reason to exist.** An over-age player in a 12-a-side
contact age grade is an injury risk, and today nothing stops one.

### 3. The window

Everything above in this document. The display half needs nothing from 1 and 2; the
enforcement half is three lines inside the gateway once it exists.

Can ship last, and can ship in halves if the dates are needed before the rest is ready.

**The display half is done** (27 July). What is left of sub-project 3 is those three
lines inside the gateway: call `registrationState()` from `_registration.js` and refuse
a submission outside the window with a reason the form shows. The function is already
there, already shared with the front end, and already tested at every boundary.

## Why there is no code-level plan attached yet

Deliberate. This spec was written at the end of a very long session, and a
step-by-step plan with real code in every step, written on fumes, is worse than no plan
— it reads as authoritative and quietly contains invented detail. Today has already
produced two tests that passed with the code deleted and a visual regression that
survived a review, both from exactly that failure mode.

**A fresh session should read this spec and write the plan for sub-project 1.** It will
do it better with a full context window than this one would now. That is still true —
the display half was built without one because it touched no submission path.

## Open questions

None. The dates themselves are not chosen yet, and do not need to be: `unset` resolves
to closed, and the dates are entered in the back office when decided — which now
actually works.
