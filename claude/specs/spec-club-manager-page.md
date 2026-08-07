# Club youth manager page — DESIGN (sub-project 1 of 2)

> ## ⛔ PARKED — 2 August 2026
>
> **Jay decided against club sign-in after walking it through, and does not want
> it.** Do not list this as outstanding work and do not raise it unprompted.
>
> It was fully built and is green — branch **`club-manager-page`**, thirteen
> commits, 156 checks and 327/327 injected faults. **Never merged, never
> deployed.** Nothing about it reached the live site.
>
> This document stays so that nobody rebuilds the thinking from scratch if it is
> ever revived. Two pieces of setup are already done and still true: the **Club
> Registrations** Google Sheet exists with headers verified against
> `CLUB_COLUMNS`, and `GOOGLE_SHEET_ID_CLUBS` is set in Netlify.
>
> Everything below is the original design, unchanged.

> **Status: designed 2 Aug 2026. Not built.** Jay asked for a landing page per
> club youth manager and answered the five questions that decided its shape.
>
> **This spec covers SUB-PROJECT 1 only: the account, the page, and the
> declaration.** Viewing team and player registrations, and flagging the
> mismatches between them, is sub-project 2 and gets its own spec — that is
> where every children's-data decision lands, and it was deliberately split so
> it does not ride along with the easy half.
>
> ⚠️ **BLOCKED, ALREADY, ON A JOB THAT IS NOT CODE.** Nothing club-related can
> save until the club registrations Google Sheet exists and
> `GOOGLE_SHEET_ID_CLUBS` is set in Netlify — see
> `claude/specs/spec-club-registration.md`, "What Jay has to do in Google and
> Netlify". Sequencing this half first was partly to force that blocker to the
> front rather than discover it at the end.

## What it is

A page at `/club` where one named youth manager per club signs in with Google
and declares which age groups their club is bringing and how many teams in
each — and can **change that later**, which the current public form cannot do.

It replaces the public "Register your club" form. The public button becomes
**Club sign-in**.

## What problem it solves

Three, and only the first was asked for out loud.

1. **A club has nowhere to look.** Everything a club has told the tournament is
   invisible to them the moment they press submit.
2. **A declaration cannot be corrected.** `spec-club-registration.md` ruled
   editing out explicitly, and gave the reason: *"building an edit flow means
   identity, authentication and an audit trail for a club that has no
   account."* This sub-project gives them an account, so that objection is
   answered rather than ignored.
3. **Nobody owns the club's data.** A coach registers a team, a parent
   registers a player, and no single person at the club can see whether the two
   add up. That is sub-project 2, and it is the reason this one exists.

## The decisions Jay made (2 Aug 2026)

**1. Google sign-in only, one account per club, created by Jay.** Asked
directly whether password sharing within a club could be prevented. It cannot —
not here, not anywhere; anyone can hand over a password or simply log in for a
colleague. What CAN be done is make sharing cost something personal. A club
account has **no password at all**, so there is nothing to pass on: sharing
access means handing over that person's own Google account.

**2. A club manager sees everything their club submitted** — including medical
notes, parent names and contact details. Jay's call, and consistent with a
decision this project already made deliberately: age-group managers see their
own group's registrations in full, for player welfare. A club's youth manager
is the person on the touchline with those children, so the argument applies to
them more strongly. **This is a deliberate widening of access to children's
data to roughly twenty people outside the committee, and it is recorded here as
one.** It also means a club account is exactly as sensitive as a manager
account, which is what makes decision 1 load-bearing rather than a nicety.
(Detail belongs to sub-project 2; it is recorded here because it is what makes
the login decision matter.)

**3. Build the club list so it is easy to change.** Jay was not sure whether
nine is the real number. It ships with the existing nine and adding one is a
one-line change, with aliases covering the gap in the meantime.

**4. Account first — everything happens on their page.** The declaration is
created and edited there. The public form retires.

**5. Two sub-projects, this one first.** So the Google Sheet blocker surfaces
immediately, and so the sensitive half gets its own pass.

## The account

A third role, `club`, alongside `manager` and `organizer`.

Created in `/organizer` → Accounts → *Create a login*: role **Club**, a club
from the canonical list, and the youth manager's Google address. No password is
set, ever — the account is created with `passwordHash: null`, exactly as a
Google-created account already is, and both login endpoints already refuse an
account with no password hash. That refusal is existing, tested behaviour and
is what makes "no password" real rather than decorative.

### ⚠️ The one-time claim, and why it is not just "match on email"

`google-auth.js` matches an account by its stored `googleSub` — the Google
account's own permanent id — and **deliberately never by email address**.
`_prove-registration.js` carries a fault for exactly that
(*"google-auth.js starts matching an existing account by email instead of
googleSub"*) and it is caught. Email matching is how somebody with a lookalike
or re-registered address walks into an account. That rule does not get relaxed.

But a club account is created *before* its owner has ever signed in, so there
is no `googleSub` to store yet. The mechanism is a **one-time claim**:

- The account is created with `claimEmail` set to the address Jay typed, and no
  `googleSub`.
- The first Google sign-in presenting a **verified** email equal to
  `claimEmail` binds that Google account's `googleSub` to the account and
  **clears `claimEmail`**.
- From then on the account matches on `googleSub` only. The email is never
  consulted again.

Three properties this has to keep, each of which gets a test and an injected
fault:

- **`email_verified` is required.** `_googleAuth.js` already refuses an
  unverified email and there is already a fault for removing that check. An
  unverified address is a claim about an inbox nobody has proven they own.
- **The claim is consumed, not merely matched.** If `claimEmail` survived the
  first sign-in, the account would be claimable again by anyone who later
  controlled that address — which is email matching by the back door.
- **An account that already has a `googleSub` never looks at `claimEmail`,
  even if one is somehow present.** Belt and braces, and cheap.

**Consequence Jay must accept:** typing the wrong address hands that club to
whoever owns it. Same exposure as emailing a password to the wrong person. The
Accounts tab therefore shows unclaimed accounts distinctly — *"awaiting first
sign-in"* — so a typo is visible before it is used, and an unclaimed account's
email can be corrected in place.

## The club list

### Today there are THREE lists and they already disagree

| Where | Contents |
|---|---|
| `CLUB_NAMES` in `Quins JRT.dc.html` | the nine offered in the entry forms' dropdown |
| `CLUB_PREFIXES` in `netlify/functions/_teams.js` | seven, for team codes — includes **Dubai Warriors**, which the form does not offer, and is missing **Al Ain Amblers**, **Dubai Dragons** and **Abu Dhabi Small Blacks**, which it does |
| the homepage stat strip | claims **20+ clubs** |

Nothing compares them. This sub-project introduces the canonical one and a test
that fails when any copy drifts — the same treatment `AGE_GROUP_INFO` and
`DEFAULT_VENUE` already get, for the same no-build-step reason.

### `netlify/functions/_clubs.js`

- `CLUBS` — the canonical list, shipping with the existing nine.
- `normaliseClub(s)` — **the existing `norm()` from `_teams.js`, moved here and
  re-exported**, not a second implementation. It already lowercases, strips
  `rfc` / `rugby` / `football` / `club` / `fc`, strips punctuation and collapses
  whitespace, so "Dubai Exiles RFC" already reduces to "dubai exiles".
- `clubMatches(accountClub, aliases, rowClub)` — the single place that decides
  whether a sheet row belongs to a club account.

⚠️ **NORMALISATION CAN COLLIDE, AND A COLLISION MEANS ONE CLUB SEEING
ANOTHER'S CHILDREN.** `norm()` deletes the words "rugby", "club" and "fc", so
two clubs whose names differ only by those words would become the same key.
Checked against the shipped nine on 2 Aug 2026: **no collisions.** A test
asserts that for the whole list, so adding "Dubai Rugby Club" alongside a
"Dubai FC" fails loudly at the point of adding it rather than quietly at the
point somebody signs in. This is the single most important assertion in the
sub-project.

### Aliases

Each club account carries `aliases: []`, editable in the back office. When a
coach used "Other" and typed something the normaliser does not reduce to the
canonical name, Jay adds it and the club's page fills in immediately — no
deploy, no code change.

**"Other" stays on the entry forms.** A club that turns up late must always be
able to register. Removing it would make mismatches impossible and make a
genuine late entry impossible too, days before a tournament.

⚠️ **An alias must be checked against every OTHER club before it is accepted.**
Adding "Exiles" to two different accounts, or adding an alias that normalises to
another club's canonical name, is the only realistic route to cross-club
exposure. Refused, by name, at save time.

## The page

`/club` → `Club.dc.html`, via a `netlify.toml` rewrite, alongside the four
existing `.dc.html` pages and following the same component pattern.

- **Signed out:** what the page is for, in two sentences, and a Google sign-in
  button. Nothing else — no club list, no hint about which clubs exist.
- **Signed in:** the club's name, their current declaration, and a Save.
- A signed-in club manager reaching `/organizer`, `/manager` or the Manager
  area of `/scores` is refused server-side, not merely un-linked.

## The declaration

The same fields as the current public form — contact name, email, phone, the
fifteen counts, notes — with one difference: **the club is taken from the
signed token and cannot be typed.**

### It saves through a NEW signed-in endpoint, not the public gateway

`save-club-declaration.js`. It verifies the bearer token, derives the club from
it, and appends a row using `_intake.js`'s existing `CLUB_COLUMNS` and
`clubRow()` — the column definitions are reused, the write path is not.

**Why not reuse `submit-registration.js`.** That function's design, stated in
`CLAUDE.md`, is that it is the anonymous front door: rate limit first, allow-list,
honeypot, registration window, no assumptions about the caller. Adding an
authenticated branch would give one function two security models and two ideas
of where the club name comes from. The property that protects one club from
writing as another is *the club comes from the token, never the body* — and that
property is only legible in a function that has no other path.

The registration window does **not** gate a signed-in declaration edit. A club
correcting its numbers after entries close is exactly what an organiser wants;
refusing it would send them to the phone.

### Editing appends, it does not overwrite

Each save writes a new row. Every reader takes the **most recent row per club**.

- No new write mode into a live spreadsheet — `append` is the only Sheets write
  this codebase does, and it stays that way.
- A dated history of what each club said and when, for free. That matters the
  first time a club insists they told you they were bringing four teams.
- `spec-club-registration.md` already anticipated this: *"If duplicate rows
  become a nuisance in practice, the fix is for the dashboard to show the most
  recent per club — a display change, not a new mechanism."*

⚠️ **"Most recent" must be decided by `submittedAt`, not by row order.** Row
order is right today and stays right only while nobody ever sorts or edits the
sheet by hand, which is not a promise anybody can make about a spreadsheet a
human can open.

### Small things settled here so nobody has to guess

- **A club with no declaration yet** sees an empty form and a line saying so,
  not an error and not a blank screen.
- **The contact fields are pre-filled** from that club's most recent row, so
  editing the U12 count does not mean retyping a phone number. The counts are
  pre-filled the same way.
- **Saving shows what was saved**, including the date and time, so a club can
  see their change landed. This is the same reasoning as the team form showing
  the team code back: a form that says nothing after submission gets submitted
  twice.
- **Sign-out is on the page.** A shared laptop at a club is a realistic thing.

## What changes on the public page

- The **Register your club** button becomes **Club sign-in**, linking to
  `/club`.
- The public club declaration modal and its form are removed.
- The team and player registration forms are **untouched**.

⚠️ `test-sponsors.js` and `test-back-office-links.js` both assert things about
the register section and the footer. Removing a button touches markup they read.
Expect to update them, and check no assertion is silently satisfied by the
wrong element afterwards.

## Testing

New `tests/test-club-accounts.js`, plus faults in `_prove-registration.js` for
every assertion below.

- **The canonical list has no normalisation collisions.** Swept across the whole
  list, not sampled.
- **The three club lists agree**, in the directions that matter: every
  `CLUB_PREFIXES` key is a canonical club; every canonical club appears in the
  form's dropdown.
- **The one-time claim:** binds on a verified matching email; refuses an
  unverified one; refuses a non-matching one; is consumed, so a second attempt
  by a different Google account fails; and is ignored entirely once a
  `googleSub` exists.
- **Scoping:** a club token reads its own club's rows and no others — asserted
  with two clubs' fixtures present, because a scoping bug that returns
  *everything* passes any test that only checks its own rows are there.
- **Aliases:** an alias that normalises to another club's name is refused; a
  duplicate alias across accounts is refused; a legitimate alias matches.
- **The club never comes from the request body** — a save that puts a different
  club in the body writes the token's club.
- **A club token is refused** by `get-registrations.js`, `accounts-admin.js`
  and every manager-only endpoint.
- **`normaliseClub` has exactly one implementation** — asserted by text, since
  the point of moving it is that a second copy cannot appear.

⚠️ Per this project's standing rule, every new assertion is proven against a
deliberately injected fault, and a fault that changes nothing (a no-op) is not a
fault. The scoping and collision checks especially: both have obvious versions
that pass against a broken implementation.

## What Jay has to do

1. **Create the club registrations Google Sheet and set
   `GOOGLE_SHEET_ID_CLUBS`** — four steps in
   `claude/specs/spec-club-registration.md`. Nothing works without it.
2. **Walk through Google sign-in with a real Google account.** It is live and
   tested, but nobody has ever actually signed in with one — it is job 10 on the
   state-of-play list. This design puts roughly twenty clubs on top of it. That
   walkthrough belongs *before* the build, not after.
3. **Decide the real club list**, or confirm nine is right. Not blocking —
   aliases cover the gap — but the sooner it is right the fewer aliases exist.

## Deliberately NOT in this sub-project

- **Viewing team and player registrations, and mismatch flagging.** Sub-project
  2. The matching logic already exists inside `Scores & Standings.dc.html` and
  will be **extracted into the shared data layer, not copied** — this project
  has been bitten twice by two hand-written copies of one rule drifting apart.
- **Any editing of teams or players by a club manager.** They see; they do not
  change. A club manager fixing a parent's typo is a different feature with a
  different consent story.
- **Self-service account creation.** Decision 1.
- **More than one account per club.** Jay was explicit: one youth manager per
  club. A second account is a second person to trust and there is no request for
  it.
- **Passwords for club accounts, in any form.** Adding one later would silently
  undo decision 1, which is why the account is created with `passwordHash: null`
  rather than with a password nobody uses.
- **A separate registration window for club declarations.** One fact, one
  switch — `CLAUDE.md` is explicit about why.
