> **ARCHIVED 30 July 2026.** Original QA/role review, 25 July 2026. A follow-up
> verification pass (`qa-review-jul-2026-verification.md`) withdrew four
> findings and corrected two after independently re-checking against the repo
> and live API — read that alongside this one, and trust it where they
> differ. Most items below have since shipped; see `claude/changelog.md` and
> `claude/state-of-play.md` for current status.

# ADH JRT — QA and role review

_25 July 2026. Reviewed against the PR #11 deploy preview and production, with
the simulated tournament data loaded. Every item below was reproduced in the
browser or read straight out of the live API — nothing here is inferred from
reading code alone._

**First, the thing I owed you.** The new save path works end to end against real
Netlify Blobs. Saving U8 Pool A, AD Harlequins 1 v DS2 returned the toast
**"Score saved: 10–10."** and stamped the row **"Saved ✓ 10–10 · 12:28:25 AM"**.
Both figures come off the server's reply after it read the write back, so a
"saved" message now means the score is genuinely stored.

Findings are ranked within each section by how much damage they do on 7–8
November. Each one is: **what's wrong → why it matters → how to fix it.**

---

## Part 1 — QA: functionality, flow, copy, layout

### 1. The marketing homepage has no mobile layout at all

**Issue.** `Quins JRT.dc.html` line 132 wraps the whole page in
`<div style="min-width:1200px; …">`, and the file contains exactly **one**
layout media query — `@media(max-width:760px){.fmt-days{grid-template-columns:1fr}}`.
Measured at a 642px viewport: `scrollWidth` 1200px against `clientWidth` 642px,
so 558px of horizontal overflow. The header nav, both **Register** buttons and
the right-hand half of every section sit off-screen, with no hamburger menu. The
`viewport` meta tag is correct, so a real phone gets the same thing, worse.

**Why it matters.** This is the page that sells the tournament, and the audience
is parents and coaches on phones. They land on a sideways-scrolling desktop page
where the registration buttons are off the right edge. Every other surface is
fine — `/scores` and `/app` measured zero overflow at the same width — which
makes the homepage the odd one out, and the one visitors see first.

**Fix.** Two steps, and the first is one line:

1. Change line 132 to `max-width:1200px; margin:0 auto;` — every inner container
   is already `max-width:1200px; margin:0 auto`, so they start flowing
   immediately.
2. Add a `@media(max-width:760px)` block collapsing the fixed grids to one
   column: line 230 `repeat(4,1fr)` (the 20+/3000+/15/16 stat bar), line 251
   `1fr 1fr` (About), line 519 `1fr 1fr` (App), line 632 `2fr 1fr 1fr` (footer),
   and line 397's `min-width:520px`. Then collapse the header nav to a menu
   button under the same breakpoint.

Do this on a branch and check the PR preview on your actual phone before merging
— it is the one change here you cannot properly judge from a desktop.

### 2. Team registration collects no medical, consent or emergency data

**Issue.** The two registration paths ask for completely different things about
the same child:

- **Register a player** — DOB, parent/guardian name, parent mobile and email,
  emergency contact, medical/allergy notes, and a **required** signed Medical
  Declaration & Consent.
- **Register a team** — per-player rows with **first name, last name, DOB only**.
  No parent contact, no emergency contact, no medical notes, no consent.

**Why it matters.** A club registering fifteen players creates fifteen player
records with nothing behind them. On match day an age-group manager opening a
player's record after a head knock finds a name and a date of birth. The player
form treats the consent as legally required; the team form does not ask for it
at all. The copy makes it worse: the player form is framed as "joining without a
team already? Register here" — so nobody registered through a club is ever
prompted for any of it.

**Fix.** Pick one deliberately, don't leave it as an accident:

- **Option A (recommended).** The team form captures the roster; each player's
  parent completes the player form separately. Then say so, loudly, on the team
  form and in the confirmation email, and give the organiser a screen showing
  which rostered players have no matching player registration.
- **Option B.** Add parent contact, emergency contact, medical notes and the
  consent tick to each player row on the team form. Honest, but it makes a
  fifteen-player registration very long.

Either way the organiser needs a **"players missing medical consent"** view
before November. That is a safeguarding question, not a nice-to-have.

### 3. Every published draw is missing `teamNames`, so the public sees raw codes

**Issue.** I read the published schedules straight off the API. `u6`, `u8`,
`u10`, `u14b` and `u16b` all return `teamNames: false`. The published `u8`
object contains only `pools`, `slots`, `knockout`, `pitches`.

The result on the public site: names resolve only for the nine hard-coded
placeholder clubs, so first sides read "AD Harlequins 1" and every second and
third side reads as a bare code — `DS2`, `DH2`, `DW1`, `ADH2`, `ADH3`, `DE2`,
`DE3`, `DT2`. The Team Key card underneath lists only the nine placeholders, so
a parent looking at `DW1` has no way to find out who that is.

**Why it matters.** This is exactly the bug PR #11 fixes in code — `saveDraw()`
was dropping `teamNames` from its allow-list — but **merging the PR will not fix
the data**. Both the drafts and the published copies were written by the broken
code, so they have no `teamNames` to publish.

**Fix.** Two parts:

1. **After merging**, re-run *Review & import* on each age group so the draft is
   re-saved with `teamNames`, then **Republish**. Republishing alone does nothing.
2. **Better, and worth adding to the PR**: have Save Draw rebuild `teamNames`
   from the current registrations every time, rather than only on import. Then a
   draw can never drift back into codes, and you never have to re-import a live
   draw to repair a display bug. If you'd rather not touch the save path, add a
   small **"Refresh team names"** button to the editor.

### 4. "Open in maps" goes to the Google Maps homepage

**Issue.** The Venue section's **OPEN IN MAPS** button links to
`https://maps.google.com` — no place, no coordinates, no query.

**Why it matters.** It is the one action on the whole page a parent takes in the
car on the morning of the tournament, and it drops them on a blank map.

**Fix.** Point it at the venue, e.g.
`https://www.google.com/maps/search/?api=1&query=Zayed+Sports+City+Abu+Dhabi`,
or better, a pin on Gate 16 specifically, since that is what the copy tells
people to use.

### 5. Registration inputs have no `name`, `autocomplete` or `<label for>`

**Issue.** There is no `<form>` element on the page at all — the modals are bare
inputs submitted by JavaScript. Consequences I confirmed in the DOM: no `name`
attributes, no `autocomplete` hints, no `required` attributes, and
`input.labels` is empty for every field, so the visible captions are styled divs
rather than real labels.

**Why it matters.** Browser and password-manager autofill can't fill a single
field, so a parent types their name, email, phone and address by hand on a
phone. Nothing is announced to a screen reader. The input `type`s are right
(`email`, `tel`, `number`), so the mobile keyboards are correct — this is purely
about autofill and accessibility.

**Fix.** Add `name` and `autocomplete` to each field (`name`, `email`, `tel`,
`bday`, `given-name`, `family-name`) and wrap each caption in
`<label for="…">`. No visual change, and a long form gets noticeably faster.

### 6. Date of birth is entered in whatever format the browser feels like

**Issue.** Both the team form's player rows and the player form render DOB as a
native date input, which showed **mm/dd/yyyy** in this browser. On the team form
the field has no label at all — it is a bare box sitting to the right of first
and last name.

**Why it matters.** In the UAE people write dates day-first. A parent entering
7 November 2015 as `07/11/2015` into an mm/dd/yyyy field silently records
11 July. DOB drives age-group eligibility against the UAERF 31 August cut-off, so
a wrong date puts a child in the wrong age group — and nothing anywhere checks
that a player's DOB matches the age group their team entered.

**Fix.** Label the field **"Date of birth"** on the team form, add a
`dd / mm / yyyy` hint next to it, and validate on submit: reject a DOB that
falls outside the selected age group's window and say which group it fits. That
last check also saves the organiser reconciling it by hand later.

### 7. Copy and navigation inconsistencies

- **"Results" in the header still scrolls to `#results`** rather than going to
  `/scores`. Known and already logged as Outstanding item 2, but now that there
  is a real live scores page it is worth flipping as soon as the draw is real.
- **The footer's Explore list omits Results entirely** (About, Format, Fixtures,
  Venue, Match-day app) while the header nav has it. Add it.
- **Pitch counts contradict each other.** The homepage stat bar says
  **"16 PITCHES"**, the app's More tab says **"Pitches A, B, C & D"**, and the
  U16B draw actually has pitches named **"D1"** and **"D2"**. Pick one
  vocabulary and use it everywhere.
- **U6's pools are named "Festival Pool, Pool B, Pool C, Pool D"** — confirmed
  in the published data. Rename to "Festival Pool A–D" or plain "Pool A–D".
- **The three organiser names appear twice** — once above the date badge in the
  hero, once again in "The people behind it". In the hero they read like film
  credits and push the date and venue down. Drop the hero copy; keep the
  section at the bottom.
- **"Get in touch"** in the sponsors block is a `mailto:` — that one is fine.
  I checked all 24 links; the only bad destination is the maps link above, and
  there are no broken `#` anchors.

### 8. Layout and interaction details

- **The Fixtures and Results sections default to different age groups.** On
  first load the Fixtures picker sits on U6 Tag while the embedded standings
  show U8 Tag, because U6 and U7 have no standings and the component falls back.
  Neither section prints which age group it is showing, so you get "Pool B"
  fixtures above a "Pool B" table for a different age group. **Fix:** put the
  age-group name in each section heading, and when Fixtures is on a festival
  group, have the Results section say so rather than silently switching.
- **A registration modal stays open when you click a nav link.** The hash
  changes behind it and you are left looking at the form. **Fix:** close the
  modal on `hashchange`.
- **The consent box is a scroll region inside a scrolling modal.** Awkward on a
  phone, and the agree tick is enabled without scrolling to the end. **Fix:**
  let the consent flow inline, and enable the tick only once it has been
  scrolled through.
- **Opening the match sheet on desktop shifts the whole app column sideways**
  as the body scrollbar disappears. Cosmetic, phone-only users never see it.
  **Fix:** `scrollbar-gutter: stable` on the app shell.

### Checked and *not* a bug

Two things looked broken and turned out not to be, so nobody re-diagnoses them:
the app's bottom tab bar appears dead on the deploy preview because Netlify's
"Deploy Preview" drawer is an iframe sitting on top of it (`elementFromPoint`
returns the iframe) — it works fine on production; and the organiser
registrations table is not clipped, its wrapper is `overflow-x:auto`.

---

## Part 2 — As the tournament organiser

### What works

The back office is genuinely good at the things it does. The registrations table
with search, club filter, age-group filter and CSV export is the right shape.
The draft/published split is the correct model and the publishing panel states
it plainly — *"Any edits since then are draft only — press Republish to push
them out"* is exactly the sentence an organiser needs. Publish-all and
unpublish-all across fifteen groups in one click is the right escape hatch. The
import review step, showing each team's code, club, stated preference and
destination pool flagged New / In draw / Moved, is well judged. And per-age-group
scoring — ticking which of tries, conversions, penalties and drop goals count —
means the U8 manager's phone shows one box instead of four.

### What doesn't

#### O1. Nothing has a pitch, and there's no way to assign them in bulk

Every published age group returns **`pitches: []`** except U16B, which has two.
So every fixture on every surface reads **TBD** — public site, app, and the
manager's own match sheet.

To fix it by hand you add pitch names in each age group's editor (fifteen
groups), then set a dropdown on each match individually. At roughly 600 pool
matches plus knockouts, that is 600-plus dropdown selections. Realistically it
will not get done, and "TBD" goes live.

**Fix.** Add, in rough order of value: a **"set this pitch for the whole pool"**
control on each pool card; a **shared pitch list** across age groups so you name
your 16 pitches once; and a **pre-publish warning** — "12 of 15 age groups have
no pitches set" — on the Publish all button.

#### O2. Everything kicks off at 08:00, and nothing checks for clashes

Every pool in U8 starts at 08:00 on a 20-minute cadence, and the same pattern
repeats across all fifteen age groups. That is potentially sixty matches
scheduled at 08:00 against sixteen pitches. The editor lets you assign the same
pitch to two matches at the same time and says nothing.

**Fix.** A clash check that runs on Save Draw and on Publish, across all age
groups, flagging any pitch double-booked at a given time and any team scheduled
in two places. Also let the generator stagger pool start times rather than
starting everything at 08:00.

#### O3. U16B's knockout still names clubs from the old placeholder draw

The published U16B knockout reads:

```
u16b:TSF1  Top Bracket — Semi-Final 1   Abu Dhabi Harlequins 1 v Abu Dhabi Harlequins 2
u16b:CUP   Cup Final                    Abu Dhabi Harlequins 1 v Dubai Tigers
…
```

Those are free-text names from the original nine-club placeholder draw. The
pools now hold imported codes (`ADH1`, `DE1`, `DT2`…), so **the bracket and the
pools describe different tournaments**. It displays without error because
`teamLabel` passes an unknown string through as a guest team.

**Why it matters.** PR #11 clears stale knockout *results* when a matchup
changes. It does not clear stale knockout *matchups*. Replace the pools and the
old bracket survives, pointing at teams that are no longer in the competition —
and it is published.

**Fix.** When "Replace the pools" runs, clear the knockout too, or at minimum
refuse to publish a bracket containing a team that appears in no pool. A
validation line in the editor — "3 knockout slots name teams that aren't in this
draw" — would catch it.

#### O4. The bracket can be generated from a tie that hasn't been resolved

U8 Pool A currently has four teams identical on every measure — played 3, drawn
3, 30–30, 6 tries, 6 points. The standings correctly badge all four **COIN
TOSS**. But nothing stops the knockout being generated from that table, and when
it is, whoever the sort happened to put first becomes the pool winner. There is
nowhere to record who actually won the toss.

**Fix.** Block **Generate knockout from standings** while any qualifying
position is unresolved, and add a small "record the coin toss" control that lets
the organiser set the order and stores it, so every screen agrees and the result
survives a page refresh.

#### O5. The registrations table is hard to work at real volume

- **No sticky header.** 256 team rows and 3,826 player rows, and the column
  headings scroll away after about twenty rows. Confirmed `position: static` on
  the header cells. One CSS line fixes it.
- **All rows rendered at once.** No pagination or virtualisation; the players
  tab builds 3,826 rows in one go.
- **No way to edit or remove a row.** A withdrawal or a typo means opening
  Google Sheets. Worth at least a "mark withdrawn" flag so the import knows to
  skip it.
- **Phone numbers lost their `+`.** Every existing row shows `971500000000` /
  `9715XXXXXXXX` (a real number, redacted). The `USER_ENTERED` → `RAW` fix in PR #9 protects *new*
  submissions; existing rows need a one-off repair in the sheet.

#### O6. Nothing tells you the draw is ready to publish

There is no pre-flight view. Before publishing fifteen age groups you'd want to
see, on one screen: teams per group, pools built, pitches set, kick-off times
sane, no clashes, no stale knockout, `teamNames` present. Right now you check
fifteen editors by eye.

**Fix.** A **"Tournament readiness"** panel on the organiser page — one row per
age group, green ticks and red flags. It is the single highest-value thing you
could add for match day, because it turns fifteen manual inspections into one
glance.

---

## Part 3 — As an age group manager on the day

### What works

The flow is genuinely good and I'd not change its shape. Open `/app` on a phone,
your age group is already selected from your login, tap a fixture, the match
sheet slides up showing the two teams, the current score and only the scoring
boxes that count at your age group. Enter tries, save. **Jump to current match**
takes you to the first unscored game. **Clear result** properly removes a result
rather than storing 0–0, and it asks first. Saving an all-zero score asks
whether you really mean a 0–0 draw, which is the right question. Since PR #11
the save also reads itself back and shows you the stored figures, so a "saved"
message is trustworthy. The Tables note — *"On a narrow phone PF and PA are
hidden to make the table fit; turn the phone sideways to see them"* — is a nice
touch. And U6/U7 managers can get into the app rather than being locked out.

### What doesn't

#### M1. The pitch says TBD on every match

The single most-asked question of a manager all day is "where is this game?" and
the app answers TBD for every fixture, all weekend. This is O1 above, but it
lands hardest here. Until pitches are set, the app is not usable as a wayfinding
tool and managers will fall back to a paper sheet — at which point scores stop
going in live.

#### M2. The app's Tables tab shows codes, the rest of the app shows names

The app's Tables tab renders `ADH1`, `DS2`, `DH1`, `DW1`, `BAR1`, `DT2` while
the Fixtures tab in the same app shows "AD Harlequins 1" and "Dubai Hurricanes
1", and `/scores` shows names too. `CLAUDE.md`'s own rule is that pool
fixtures, results and standings show **names** and only knockout shows codes, so
Tables is the odd one out — it isn't even applying the fallback that resolves
`ADH1`.

**Why it matters.** A manager glancing at the table to see if their side has
qualified has to translate codes in their head, at pitch-side, under time
pressure. It is also the exact names-versus-codes mismatch that has already
caused one silent bug on this project.

**Fix.** Route the app's Tables renderer through the same `teamLabel` the
Fixtures tab uses.

#### M3. The app never mentions a coin toss

`/scores` badges a dead-level pool **COIN TOSS**; the app's Tables tab shows the
same four teams in a confident 1-2-3-4 order with no indication anything is
unresolved. A manager reading the app believes their team finished second when
in fact it is one of four tied for first.

**Fix.** Carry the badge into the app's table, and once O4's coin-toss recording
exists, show the resolved order everywhere.

#### M4. "All matches played" while the knockout is empty

The app's home card said **"All matches played."** for U8. The pool matches are
all in, but U8's published knockout is four empty finals — Cup, Bowl, Plate,
Shield, all with no teams. So the group is not finished, and a manager reading
that card would stop looking.

**Fix.** Count knockout slots in the "what's left" logic, and say something like
"Pools complete — knockout to be drawn" instead.

#### M5. Fixtures rows say FULL TIME but not the score

Every played fixture shows the time, the teams, the pool and a **FULL TIME**
badge — and no score. To see it you tap in, or switch to the Results tab. I
know Fixtures-is-the-schedule and Results-is-the-scores is deliberate, but
"FULL TIME" with no number next to it reads as missing data rather than as a
design decision.

**Fix.** Show the score on the row once a match is played, or drop the badge and
let the Results tab own it entirely.

#### M6. Small things that cost seconds, repeatedly

- **The age-group pills scroll horizontally with no affordance** — no fade, no
  arrow. On a phone you have to discover the swipe. Add a gradient fade at the
  right edge.
- **The toast appears at the top of the page.** A manager scrolled to match 30
  never sees it. The inline "Saved ✓ 10–10 · 12:28" on the row does cover this,
  so it is minor — but if you ever drop the inline mark, don't.
- **"Pitch map" in the More tab** promises "the venue layout, as on the website"
  and the website has no pitch map. Either add one or change the copy. On the
  day, "which one is Pitch C?" is a top-three question.

---

## If you only do six things before November

1. **Fix the homepage mobile layout** (QA-1). One line plus one media query
   block, and it is the first thing every parent sees.
2. **Decide the medical-consent question** (QA-2). Safeguarding, and the answer
   changes the registration flow, so it needs deciding early.
3. **Rebuild `teamNames` on save, then re-import and republish** (QA-3). Turns
   raw codes back into club names on every public surface.
4. **Bulk pitch assignment plus a clash check** (O1, O2). Without it, "TBD" goes
   live and the app stops being useful pitch-side.
5. **Clear stale knockouts when pools are replaced** (O3). U16B is publishing a
   bracket for a tournament that no longer exists.
6. **Build the tournament-readiness panel** (O6). It is the cheapest way to stop
   any of the above reaching match day unnoticed.
