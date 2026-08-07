# Club-level registration — DESIGN

> **Status: designed 1 Aug 2026, build in progress.** Jay asked for this and
> answered the three questions that decided its shape. This replaces the
> earlier "captured request" stub.
>
> ⚠️ **THERE IS ONE SETUP STEP ONLY JAY CAN DO, AND NOTHING WORKS WITHOUT IT.**
> See "What Jay has to do in Google and Netlify" at the bottom. Do not merge
> this to `main` before that is done.

## What it is

A club registers **itself** — once — declaring which age groups it is sending
teams to and **how many teams in each**. ("Dubai Exiles are coming. U8: 2.
U12: 1. U16B: 3.")

Today nothing answers "how many teams is this club bringing in total," so
pool sizes, the draw and pitch allocation cannot be planned until every
individual team has separately registered — which is days before the
tournament.

## The three decisions Jay made (1 Aug 2026)

**1. Declaration first, teams later.** A club declares intent early; each
team still registers its own roster separately, exactly as it does today.
**Nothing about the existing team form changes.** The cost is that there are
now two things to chase a club about; the benefit is planning numbers weeks
earlier.

**2. A declaration does NOT create teams or team codes.** It is planning
information only. Teams appear in the draw when they actually register, as
now. No phantom teams can end up in a draw, and `_teams.js` numbering is
untouched.

**3. Declared vs actual is shown, never enforced.** `/organizer` shows "3
declared, 2 registered" so Jay can chase. A club can still register more
teams than it declared, or fewer. **The declaration is a plan, not a
promise** — capping registrations at the declared number would refuse a
genuine late team on tournament run-up, which is a phone call, not a fix.

## Storage — a third Google Sheet

`FORMS` in `_intake.js` already carries a `sheetEnv` per form, and
`submit-registration.js`'s `appendRow` resolves `process.env[spec.sheetEnv]`
generically. **So a third form needs no change to the gateway adapter at
all** — it slots into the existing flow.

Netlify Blobs was considered and rejected: it would need its own branch
inside `handleSubmission()`, and that function's whole design is that it has
one path. Consistency with the two existing registration forms wins.

### The columns — 21, order fixed at creation

```
submittedAt, club, contact-name, contact-email, contact-phone,
teams-u6, teams-u7, teams-u8, teams-u9, teams-u10, teams-u11,
teams-u12, teams-u12g, teams-u13, teams-u14b, teams-u14g,
teams-u16b, teams-u16g, teams-u18b, teams-u18g,
notes
```

- **One row per club**, not one row per club-per-age-group. "How many U12
  teams are coming" is then one column to sum, and the whole
  `rowFrom(columns, source)` machinery — which builds exactly one row per
  submission — works unchanged.
- **The fifteen count columns are in real age order**, matching
  `MANAGER_AGE_GROUPS`, not alphabetical. Same rule as `AGE_GROUP_ORDER` in
  `Organizer.dc.html`.
- **No `total-teams` column.** It is derivable, and this codebase's standing
  rule is that a derived fact stored twice is a fact that eventually
  disagrees with itself. The dashboard computes it; a human can `SUM()`.
- `A:U`, derived from the count by the existing `colLetter()` helper, never
  typed.

⚠️ **`colLetter()` has a ceiling of 26 and this sheet is the closest yet.**
It is `String.fromCharCode('A' + n - 1)`, so at 27 columns it silently
produces `[` and Sheets drops the overflow with no error. At 21 there is
room, but a test now asserts every range stays inside A–Z so the next person
to add a column finds out immediately rather than losing data.

## Validation

Mirrors the existing rules and their placement in `validateSubmission()`.

- **`club`, `contact-name`, `contact-email` required.** Phone optional, same
  as the team form's manager fields.
- **At least one age group must have a count of 1 or more.** A declaration
  that declares nothing is not a submission, it is a mis-click, and storing
  it would put a row in the sheet that means nothing. Refused with a sentence
  the coach can act on.
- **Every count must be a whole number from 0 to 10.** Zero and blank are the
  same thing (not coming). Ten is far past any real club — the largest single
  age group in 2025 was well under that — and the point of a ceiling is to
  bound a public endpoint, not to predict entries.
- Unknown keys are dropped by the existing allow-list automatically; a
  submitted `teams-u99` never reaches validation.
- The honeypot, the rate limit, the registration window, the length caps and
  the "no field VALUE in a log" rule all apply unchanged, because this form
  goes through the same `handleSubmission()` as the other two.

**The registration window is the SAME lever.** A club declaration arguably
wants to open earlier than team registration, but `CLAUDE.md` is explicit
that one fact with two switches is how the two end up disagreeing. If Jay
later wants club registration to open first, that is a deliberate second
window and a separate decision — not something to sneak in here.

## The confirmation email

A new `clubEmail(d)` in `_email.js`, dispatched from `sendConfirmation()`
alongside the two existing templates, sent to `contact-email`.

⚠️ **It must say, in plain words, that each team still has to register
separately.** Decision 1 means a club that declares and stops has not
actually entered anyone — and the single most likely way this feature fails
in practice is a club secretary believing the job is done. That sentence is
the feature working.

## What the organiser sees

A new **Clubs** tab in `/organizer`, beside Teams / Players / Accounts /
Venue / Registration.

Per club, per age group: **declared** and **registered**, side by side, with
the rows that disagree flagged. Registered counts come from the existing
Teams sheet, which `get-registrations.js` already reads — so this is a
reconciliation of two things already in hand, not a new source of truth.

- A club that declared and registered nothing yet is the normal early state,
  not a warning.
- A club that registered teams **without** declaring is shown too — it must
  not vanish just because it skipped step 1.
- Sorted with the existing `byClubThenAgeGroup()` rule so it reads the same
  way as the Teams and Players tabs.
- Organiser-only, like everything else on that page. Club declarations carry
  a contact name and email — no children's data — but the page they sit on is
  organiser-only for good reasons and this does not weaken that.

## On the public page

A third button in the `#register` section: **Register your club**, placed
first, since it is step 1. The section heading is already "Sign up now"
(reworded 1 Aug precisely because this feature was coming, so the page no
longer has two things a coach would read as "register the club").

The hero keeps its existing two buttons. Three in the hero would crowd it,
and the club declaration is a once-per-club action rather than the
high-volume one. **Worth Jay's opinion once it is live** — if club sign-up is
the thing he most wants clubs to do first, it may deserve hero placement.

## What Jay has to do in Google and Netlify

⚠️ **Nothing works until these three steps are done. They cannot be done from
a Claude session** — the same steps the Teams and Players sheets each needed.

**In Google Sheets:**

1. Create a new spreadsheet — call it something like *ADH JRT — Club
   Registrations*.
2. Add a header row across columns A to U, in exactly this order:
   `submittedAt`, `club`, `contact-name`, `contact-email`, `contact-phone`,
   `teams-u6`, `teams-u7`, `teams-u8`, `teams-u9`, `teams-u10`, `teams-u11`,
   `teams-u12`, `teams-u12g`, `teams-u13`, `teams-u14b`, `teams-u14g`,
   `teams-u16b`, `teams-u16g`, `teams-u18b`, `teams-u18g`, `notes`.
3. Share it with the service account address in
   `GOOGLE_SERVICE_ACCOUNT_EMAIL`, with **Editor** access — the same address
   the other two sheets are shared with.

**In Netlify** (Site configuration → Environment variables):

4. Add `GOOGLE_SHEET_ID_CLUBS` — the long id out of the sheet's URL, between
   `/d/` and `/edit`. Set it to *All scopes · Same value in all deploy
   contexts*, like the others.

**Then**, and only then, merge to `main`. If the variable is missing the
declaration form fails safely — the submission is parked for replay and the
club is told nothing was saved and to email `admin@adhjrt.com` — but that is
a bad first impression for a feature nobody could use yet.

## What is deliberately NOT in this

- **No team codes.** Decision 2.
- **No enforcement.** Decision 3.
- **No second registration window.** See above.
- **No editing a declaration.** A club that gets it wrong submits again and
  the organiser reads the later row; building an edit flow means identity,
  authentication and an audit trail for a club that has no account. If
  duplicate rows become a nuisance in practice, the fix is for the dashboard
  to show the most recent per club — a display change, not a new mechanism.
- **No link between a declaration and the draw.** The draw is built from
  registered teams, exactly as now.
