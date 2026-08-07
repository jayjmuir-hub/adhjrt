> **ARCHIVED 30 July 2026.** Verification pass on `qa-review-jul-2026.md`, same
> day (25 July 2026). Most items on both docs have since shipped — see
> `claude/changelog.md` and `claude/state-of-play.md` for current status.

# ADH JRT — verification pass on the QA review

_25 July 2026. I re-ran the review from scratch using a deliberately different
method: the first pass was mostly browser screenshots, this one is repo source
read straight from git plus direct API queries against live data. Where the two
disagree, the source wins._

**Headline: nine findings confirmed and several strengthened, but I got six
things wrong — four of them badly enough to withdraw.** Details below, with the
corrections first because those are the ones that change what you should do.

---

## Corrections — things I got wrong

### C1. I recommended building a feature that already exists (was QA-2)

I wrote that you need "a *players missing medical consent* view before
November". **It is already built, and it works.**

The manager/organiser **Registrations** tab in `/scores` already does full
two-way reconciliation between team rosters and player registrations:

- a red banner when anything is unmatched (`regHasUnmatched` / `regUnmatchedTotal`)
- a per-team **"N unregistered"** badge next to the roster count
- expand a team and each player reads **"✓ registered"** or
  **"⚠ no parent registration"**
- the reverse direction too: each player registration reads **"✓ on a roster"**
  or **"⚠ not on a roster"**, with a red row background
- and the player table already carries medical-notes and consent columns, the
  consent cell colour-coded on `consent === 'Yes'`

I verified it against the live data rather than trusting the markup. Pulling the
registrations and recomputing the match myself, aggregates only:

| | |
|---|---|
| Teams | 256, **all 256** carrying a roster |
| Roster entries | 3,826 — 3,826 distinct keys, so no duplicates |
| Player registrations | 3,826 |
| **Players not on any roster** | **0** |
| **Roster players with no parent registration** | **0** |
| Players with consent = Yes | **3,826 of 3,826** |
| Players with medical notes | 836 |
| DOB format on both sides | `yyyy-mm-dd`, 3,826 each — no drift |

That last row matters more than it looks. The reconciliation key is an exact
string match on name + DOB, so if the two forms or Google Sheets ever disagreed
on date format, every player would falsely show as unregistered. They don't.

**What actually survives of QA-2.** Two things, both small and both real:

1. The team form still collects **first name, last name, date of birth** per
   player and nothing else — confirmed in the source, the only fields are
   `PLAYER FIRST NAME`, `PLAYER LAST NAME`, `DATE OF BIRTH`.
2. **Nothing tells the club that a second, separate registration is needed.**
   The team confirmation email in `_email.js` lists the squad with DOBs and
   explains team codes and pool preference, but never says each player's parent
   must also complete the player registration with the medical declaration.

So the design is sound and the safety net is built — the gap is purely that
nobody is told to use it. That is a paragraph on the team form and a paragraph
in the team email template, not a feature.

### C2. The app showing codes in the standings is deliberate — withdrawn (was M2)

I called this an inconsistency to fix. It isn't. The app's tables call
`tShort()`, which is documented in `scores-data.js`:

> *"The short form, for the two places a full name does not fit: the app's
> pinned standings column and the knockout bracket cells."*

And `viewTables()` ends with `+ teamKeyCard()` — the Tables tab already renders
the code-to-name legend underneath. A deliberate design, with the decoder right
there. Withdrawn.

The codes you and I actually saw — `ADH1`, `DS2`, `DH1` — look worse than they
are because of the `teamNames` problem (V2 below). Fix that and this reads as
intended.

### C3. "All matches played" is correct — withdrawn (was M4)

I said the logic ignores knockout matches. It doesn't. The source is:

```js
const all = fx && !fx.awaitingPublication
  ? (fx.pool || []).concat((fx.knockout || []).filter(k => k.home || k.away)) : [];
```

Knockout matches **are** included; only slots with no teams yet are filtered
out, which is right — an undrawn bracket isn't an unplayed match. U8's published
knockout is four empty finals, so "All matches played." is factually true.

All that survives is a copy preference: *"Pools complete — knockout to be
drawn"* would tell a manager more than *"All matches played."* Nice to have, not
a defect.

### C4. The pitch map exists — withdrawn (was M6)

I said the app promises "the venue layout, as on the website" and the website
has no map. Both halves were wrong. `/assets/venue-map.png` is in the repo
(539 KB) and serves **200 OK**, and the homepage displays it at line 521 of
`Quins JRT.dc.html`. The copy is accurate. Withdrawn.

### C5. The knockout gate does exist — corrected (was O4)

I said nothing stops the knockout being generated. There is a gate:

```js
knockoutGenDisabled: !(s.fixtures && s.fixtures.pool && s.fixtures.pool.length > 0
  && s.fixtures.pool.every((fx) => fx.result && fx.result.homeScore != null))
```

…with the message *"Enter every pool score first — then you can generate the
knockout from the final standings."* Credit where it's due.

**The narrower point still stands.** The gate checks whether the pools are
*complete*, not whether the resulting standings are *decidable*. U8 Pool A has
every score in, so the button is live — and the table underneath is a four-way
dead tie badged COIN TOSS. Generate it and whoever the sort happened to put
first becomes the pool winner, with nowhere to record the actual toss. So:
extend the existing gate to also block on an unresolved qualifying position,
rather than build a gate from scratch.

### C6. `required` and `<label>` are both present — corrected (was QA-5)

I said there were no `required` attributes and that the captions were styled
divs rather than real labels. Counting in the source:

| | |
|---|---|
| `<form>` elements | **0** — this part was right |
| `<input>` elements | 27 |
| …with `name=` | **0** — right |
| …with `autocomplete=` | **0** — right |
| …with `required` | **11** — I was wrong |
| `<label>` elements | **28** — I was wrong |
| …with `for=` | **0** |
| `<input>` with `id=` | **0** |

So the markup is better than I said, and the fix is cheaper than I said. The
labels are real `<label>` tags, just never associated — no `for=` on any of
them and no `id=` on any input, which is why the browser reported no label for
every field I sampled. And the 11 `required` attributes are **inert**, because
constraint validation only runs on submit inside a `<form>`, and there isn't
one.

**Revised fix:** wrap each modal's fields in a `<form>` — that alone switches on
the eleven `required` markers you already have — then add `id`/`for` pairs and
`autocomplete` hints. Smaller job, better payoff than I described.

### C7. Softened: "FULL TIME with no score" (was M5)

Deliberate, and there's a comment saying so: *"Fixtures is the schedule now —
when and where. Scores have their own tab, so a played match carries a quiet
'Full time' mark here instead of repeating the scoreline. Tapping the row still
shows it."* Downgrade from finding to a judgement call you may or may not agree
with.

---

## Confirmed — and several are worse than I first reported

### V1. Homepage has no mobile layout — confirmed, and it hits production

Read straight from the repo rather than the browser this time:

- Line 132: `<div style="min-width:1200px;overflow:hidden;background:#F3F1ED">` ✔
- Exactly **two** `@media` rules in the file, and only one is layout:
  `@media(max-width:760px){.fmt-days{grid-template-columns:1fr}}` ✔
- `git diff main -- "Quins JRT.dc.html"` is **empty** — the file is identical on
  `main`, so **production has this exactly as the preview does**. I asserted
  that last time without checking; now it's checked.

Because the 1200px is a hard floor, the overflow doesn't shrink with the screen
— it grows. Measured 558px of horizontal overflow at a 642px viewport; on a
390px phone it is 810px.

Worth noting for contrast, since it sharpens the fix: `/scores` and
`/organizer` also contain `min-width:1200px`, but on **tables inside
`overflow-x:auto` wrappers** — the correct pattern, where the table scrolls
inside its box. The homepage's is on a page-level wrapper `div`, which is why
the whole page moves.

### V2. No published age group has `teamNames` — confirmed across all 15

Last time I checked five groups. I queried all fifteen:

**15 of 15 published groups return `teamNames: false`.** Every one. So every
public surface falls back to the nine hard-coded placeholder names, and every
second and third club side renders as a bare code.

### V3. Nothing has a pitch — confirmed, and worse than I said

I reported empty pitch lists. Checking the slots as well:

- **14 of 15** groups have an empty pitch list (U16B has two names, `D1`/`D2`)
- **0 slots across all 15 groups have a pitch assigned** — including U16B's,
  despite it having the names available

So it is not just that pitches are unnamed; not a single one of roughly 430 pool
slots plus knockouts has a pitch on it. Every fixture on every surface reads
TBD, and the app's own fallback is literally `m.pitch || 'TBD'`.

### V4. Every age group kicks off at 08:00 — confirmed 15 of 15

Minimum `startMins` is **480 (08:00) in all fifteen groups**, each with four
pools running concurrently. That is around 60 matches nominally scheduled at
08:00, against 16 pitches, with no clash detection anywhere.

### V5. Stale knockout — confirmed, and it is U16B only

I checked every group for knockout slots naming a team that appears in no pool:

**1 of 15 — U16B.** Its bracket holds free-text club names from the original
placeholder draw ("Abu Dhabi Harlequins 1 v Dubai Tigers") while its pools hold
imported codes. The other fourteen are clean. So the blast radius is smaller
than I implied, and the fix is a one-off clear plus a guard.

### V6. Other confirmations

- **Maps link** — `href="https://maps.google.com"`, line 540. ✔
- **No sticky table header in the organiser** — zero occurrences of
  `position:sticky` in `Organizer.dc.html`. ✔
- **No `hashchange` handler on the homepage** — zero occurrences, so a
  registration modal does stay open when a nav link is clicked. ✔
- **`RAW` fix is in place** — `valueInputOption: 'RAW'` in
  `submission-created.js` with a comment explaining why. Protects new
  submissions; existing rows still display without a `+` and want a one-off
  repair. ✔
- **`"Pitches A, B, C & D"`** is hardcoded in the app's More tab, against
  "16 PITCHES" on the homepage. ✔

### V7. The coin-toss fix, independently re-derived

Rather than trust the badge, I pulled U8's raw results and recomputed Pool A
from scratch. All six matches were **10–10**:

```
ADH1 10-10 DS2    DH1 10-10 DW1    ADH1 10-10 DH1
DS2  10-10 DW1    ADH1 10-10 DW1   DS2  10-10 DH1
```

Every team: played 3, drawn 3, PF 30, PA 30, margin 0, 6 tries, 6 points —
identical on **every** measure, and the head-to-head mini-league is equally
level because they all drew with each other. There is genuinely nothing in the
rules to separate them, so a coin toss is the correct outcome and badging all
four is right. The old code would have left the first team unbadged, reading as
though it had won something. The fix behaves correctly on real data.

---

## What I could not verify

Stated plainly so nobody treats these as cleared:

- **Anything below about 500px.** Chrome won't size a window narrower than that,
  so my measurements are at 642px. The homepage conclusion is safe because the
  1200px floor is width-independent — but my "`/scores` and `/app` are fine"
  claim is only tested at 642px. `/app` has seven media queries and is very
  likely fine; **`Scores & Standings.dc.html` has zero media queries** and is
  fluid-by-construction rather than fluid-by-design. Open the PR preview on your
  own phone before you trust it.
- **Manager scope.** I was signed in as an organiser, which returns all 256
  teams and 3,826 players in one call. I could not test that a real age-group
  manager sees only their own group, because I have no manager password and I
  won't ask for one.
- **Confirmation emails.** Still untested end to end. Unchanged from the
  original review, and it still needs four live submissions against production.

---

## Revised priority list

1. **Homepage mobile layout** (V1) — unchanged at number one, and now confirmed
   to affect production.
2. **Rebuild `teamNames` on save, then re-import and republish** (V2) — 15 of 15
   groups affected, and it is also what makes the app's standings codes look
   like a bug when they aren't.
3. **Bulk pitch assignment plus a clash check** (V3, V4) — zero pitches assigned
   anywhere, everything at 08:00, no clash detection.
4. **Extend the existing knockout gate to block on unresolved ties** (C5) —
   smaller than I first described, because the completeness gate is already
   there.
5. **Clear U16B's stale bracket and guard against it recurring** (V5) — one
   group, not a systemic problem.
6. **Wrap the registration modals in a `<form>`** (C6) — switches on eleven
   `required` attributes you already have.
7. **Tell clubs their parents must register separately** (C1) — one paragraph on
   the form, one in the team confirmation email. The reconciliation view that
   catches the failures is already built and working.
