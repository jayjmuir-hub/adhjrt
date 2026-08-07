# Registration window — the display half. Built, shipped and verified, 27 July 2026

> **DONE.** `main` fast-forwarded `69ae88e → 6605ac9`. Netlify deploy
> `6a672466…` → `6a673427b7fa86000871d2a7`, `ready` in 32s, 24 functions
> deployed (was 22), secret scan clean. **15 credits.**
>
> **Smoke-tested on production by Jay, all five steps, and the window cleared
> afterwards.** There is nothing outstanding on this piece.

Sub-project 3's **display half** from `claude/specs/spec-registration-window.md`. The
enforcement half waits on the submission gateway (sub-project 1). **Nothing here
refuses a late submission** — it decides what the site *shows*.

---

## What Jay gets

**`/organizer` → a fifth tab, Registration.** Two date pickers, three mutually
exclusive modes (follow the dates / force open / force closed), and a live
preview of exactly what the public page will say. Each date is echoed back with
the weekday spelled out — "Thursday 8 October 2026, Abu Dhabi time" — the same
defence `fmtDobLong()` gives the player form, so a mis-typed month is visible the
moment it is typed.

**The public CTA drives itself off that setting.** Four phases:

| Phase | The page says |
|---|---|
| no dates set | REGISTRATION OPENS SOON |
| before | REGISTRATION OPENS 8 OCTOBER, with "Opens in 12 days" under it |
| open | REGISTRATION CLOSES 1 NOVEMBER — a deadline, not an open date |
| after | REGISTRATION CLOSED |

Force-closed *inside* the dates gets its own line, because "opens soon" would be
untrue and the phase wording would print a closing date that has not happened.

**Changing the dates costs nothing.** No deploy, no credits. With no dates set —
the state it is in now — the page says "REGISTRATION OPENS SOON" and both buttons
carry the Coming Soon ribbon, which is correct.

---

## What was verified, and how

**Before the deploy.** `git write-tree` on cafnet matched the sandbox tree hash
exactly (`bb0b5753…`) — byte-perfect transfer across seven files, two of them
`.dc.html` over 100 KB. 380 checks green on cafnet, which runs Gulf Standard
Time, giving the cross-timezone assertions an independent reading (they had only
ever run under UTC).

**After the deploy.** Deploy state `ready`, commit `6605ac9`, both new functions
in the deployed list.

**On production, by Jay — the full smoke test.**

1. adhjrt.com — "REGISTRATION OPENS SOON", Coming Soon on both buttons, click
   gives a toast and no modal. ✅
2. /organizer → Registration — tab present, dates empty, "Follow the dates"
   selected, amber warning, preview matching the homepage. ✅
3. Dates set and saved — the homepage moved to "REGISTRATION CLOSES *date*" and
   both modals opened. ✅
4. Force open with dates cleared — form open, TEST MODE strip showing. ✅
5. Window cleared. Back to closed. ✅

Steps 3 and 4 were the first writes the panel ever made to real **Netlify
Blobs**, and the first time the public page read one back. The whole path is
confirmed: organiser POST → `validateSettings` → `config` blob at key
`registration` → public GET → `registrationState` on the homepage's one-second
tick. Everything before that was logic tested in isolation.

Keep that five-step walk for the next time this is touched. Step 4 is the one
worth repeating every time — it exercises the switch the real opening will use.

---

## The design decision worth knowing about

The spec called for `registrationState()` to exist twice with a test asserting
the copies are identical — the `DEFAULT_VENUE` pattern.

**It went further.** The whole rule set — the state function, the validator, the
warnings and the public wording — sits in one **SHARED BLOCK**, byte-for-byte
identical in `netlify/functions/_registration.js` and `scores-data.js`, and
`organizer-data.js` **re-exports** it rather than reimplementing.

So the back office calls the *server's own* validator. It cannot show Save as
green on something the server will reject, and its preview cannot show wording a
coach will not see, because they are the same function call.

Deliberately one better than the Venue & days panel, where `validateVenue()` and
`venueProblems()` are two hand-written copies of one rule and
`test-venue-panel.js` exists to catch them drifting. The cost is that
`/organizer` now loads `scores-data.js` — one extra module on a back-office page,
against a third copy of the rules.

`phase` and `open` answer two different questions on purpose: `phase` is pure
date arithmetic and the mode never touches it, `open` is whether the form works.
Keeping them apart is what stops a force-closed window having to lie about which
phase it is in.

---

## Two bugs the tests found

**`Date.parse` accepts `2026-02-31`** and quietly rolls it forward to 3 March. The
first version checked the shape and then checked it parsed, which let a day that
does not exist through as a real one — registration would have opened three days
after the date on the poster. `isRealDate()` now guards both entry points.
Exactly the trap `composeDob()` already closes on the player form.

**`organizer-data.js` was not forwarding three of the functions the panel calls.**
Invisible in the test run that used a stub; the binding check caught it. It would
have been `undefined` in the browser.

---

## Fails closed, everywhere

Null settings, an unparseable date, an unreadable clock, a closing date with no
opening date, a failed fetch, and the fraction of a second before the fetch lands
all resolve to a **shut form**.

That direction is the whole point. A form shut when it should be open is a phone
call. Open when it should be shut is a registration nobody expected, arriving
after the draw is built, with **no age check behind it** — because the age
validation is sub-project 2 and does not exist yet.

---

## Tests

`tests/test-registration.js` (196) and `tests/test-registration-panel.js` (184),
driven **through the component** rather than grepped — the lesson from the
pitch-count test. `tests/_prove-registration.js` injects faults and requires each
to be caught by the check that claims to guard it.

**Three assertions were wrong when first written** and were corrected against the
code rather than the other way round. The temptation each time was to "fix" the
code to match the test:

- *"an unrecognised mode fails closed"* — it does not and should not. A junk mode
  is a junk exception to the dates, so the dates stand.
- *"31 February is refused"* — it was not. That is bug one above.
- *"the same-day check catches `c <= o`"* — it did not distinguish `c <= o` from
  `c < o`, because a bare same-day pair spans 24 hours. The zero-length case had
  to be added before that rule was guarded by anything at all.

**The timezone claim is tested across timezones.** The display answers are
computed in five child processes from +14 to −11 and all five must agree. That is
the only thing that catches `fmtWindowDate` being rerouted through a `Date`
object — a version that does that passes every other assertion on a UTC machine
and prints "31 October" to somebody in Los Angeles for a window opening
1 November.

---

## What is left

**On this piece: nothing.**

**Next in the sequence: sub-project 1, the submission gateway.** It needs an
implementation plan written — deliberately not written yet, see the end of
`claude/specs/spec-registration-window.md`. Once it exists, the enforcement half of the
registration window is three lines inside it: call `registrationState()` and
refuse a submission outside the window with a reason the form shows. The function
is already there, already shared with the front end, already tested at every
boundary.
