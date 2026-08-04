# ADH JRT — project notes for Claude

Abu Dhabi Harlequins Junior Rugby Tournament. A public marketing site plus a live
scores app plus an organiser back office, for a two-day youth rugby festival on
**7–8 November 2026** at Zayed Sports City, Abu Dhabi.

Run by volunteers. The maintainer (Jay) is not a developer — explain changes in
plain language and say which system each step applies to (GitHub / Netlify /
Google). Avoid unexplained jargon.

## ⚠️ The rules that must reach you wherever you are running

**These ten lines are duplicated on purpose.** The full set lives in
`~/GitHub/claude-rules/rules.md` on Jay's PCs and in the Claude project's
instructions box — but **a cloud session sees neither**: it gets a fresh
container with no home directory of his, and a task not attached to a Claude
project has no instructions box either. This repo travels everywhere, so the
rules that are expensive to break are repeated here. Keep the block short and
identical wherever it appears, so drift shows up in a diff.

1. **Never `git add -A`.** This repo's root IS the deployed website. Stage
   explicit paths; delete scratch harnesses before committing.
2. **Never put a secret in a tool call, a URL or a commit.** Use a dummy value
   to test plumbing and a SHA-256 fingerprint to compare a real one. If one is
   disclosed — including by Jay pasting it — say so and tell him to rotate it.
3. **Never push to `main` without an explicit yes.** It costs 15 credits, and a
   stop hook asking is not Jay asking.
4. **Never answer from memory about current state.** `git fetch origin` first.
5. **Read the RESPONSE, not the screenshot.** Every refusal renders in the same
   red box; "same error" can be visually true and factually wrong.
6. **Prove every new test assertion against an injected fault**, and verify live
   after deploying. A green suite is not a working site.

(The longer version — how to talk to Jay, diagnosis habits, docs discipline —
is in `claude-rules/rules.md`, which is also pasted into each Claude project's
Instructions box. That text is deliberately project-NEUTRAL, so everything
specific to ADH JRT lives here instead. The rest of this section is that.)

## What is specific to THIS project

**A production deploy costs 15 credits**, whatever its size. `[skip ci]` on a
docs-only commit costs nothing — verify by the deploy id not moving. ⚠️ Do NOT
assume branch previews are free; that was claimed for months and is probably
wrong. Confirm in Netlify before relying on it to save money.

**The repo root IS the deployed site.** There is no build step — `netlify.toml`
rewrites URLs straight onto the `.dc.html` source files. Anything committed to
the root is published, including scratch scripts. This is why rule 1 above is
rule 1.

**The `claude/` docs folder is organised — keep it that way.** Specs in
`claude/specs/`, build plans in `claude/plans/`, procedures in
`claude/runbooks/`, superseded material in `claude/archive/`.
`state-of-play.md`, `changelog.md`, `parked-requests.md` and
`writing-to-github-from-claude.md` stay at the top level.

**Read `claude/state-of-play.md` and `git fetch origin` before believing
anything about what is merged or deployed.** That page has been wrong about
merge status three times.

**How to write to GitHub from a cloud session:**
`claude/writing-to-github-from-claude.md`. The sandbox can read `origin` but
never write to it.

**Standing instructions, so they are not buried:**

- ⚠️ **The dead GitHub MCP token is the INTENDED state — do not "fix" it.** It
  was removed deliberately on 25 Jul 2026 because it parked a live write token
  in a plain-text config file. `Bad credentials` is correct. Ignore those tools.
- Do not raise the `club-manager-page` branch — parked at Jay's request.
- Do not raise the registration-window decision; Candice's account is dropped.

---

## The single most important thing

**There is no build step.** No bundler, no `index.html`, no compile.
`netlify.toml` rewrites URLs straight onto the `.dc.html` source files:

| URL | serves |
|---|---|
| `/` | `Quins JRT.dc.html` |
| `/scores` | `Scores & Standings.dc.html` — purely public since Aug 2026; the Manager area moved to `/manager` and `/organizer` |
| `/organizer` | `Organizer.dc.html` |
| `/manager` | `Manager.dc.html` — the age-group manager dashboard (score entry, draw editor, registrations) |
| `/signin` | `Signin.dc.html` — THE sign-in page, both roles (added Aug 2026). Routes by role after sign-in; carries both signup flows and the Google button. |
| `/app` | `app.html` — the match-day app (plain static file, not a DC component) |
| `/legal` | `legal.html` — Legal & Privacy page (disclaimer, privacy, photography). Plain static file like `app.html`, not a DC component. Linked from the homepage footer. |
| `/register-club` | `Club.dc.html` — the club declaration form. **UNLISTED: nothing links to it, it is out of the sitemap and carries noindex.** Guarded by `CLUB_FORM_KEY`, not by being unlisted — see the club section below. |

Edit the `.dc.html` file, push, done. There is no bundling step to look for — an
earlier version used an inliner that produced `index.html`; that's gone.

Anything in the repo root is **served publicly**. Do not leave stray copies of
backend files there — `adhjrt.com/<filename>` will serve them.

---

## Layout

```
app.html                   match-day app  →  /app. Plain vanilla HTML/CSS/JS,
                           NOT a DC component. Imports scores-data.js and
                           organizer-data.js as ES modules — shares the
                           website's data layer, auth and permissions, no
                           second source of truth.
manifest.webmanifest       PWA manifest (start_url /app)
sw.js                      service worker — network-first, never caches
                           /.netlify/functions/
Quins JRT.dc.html          public marketing site  →  /
Scores & Standings.dc.html public live scores (no manager area since Aug 2026)  →  /scores
Organizer.dc.html          organiser back office  →  /organizer
Signin.dc.html             THE sign-in page, both roles  →  /signin (Aug 2026)
Manager.dc.html            age-group manager dashboard  →  /manager. Rebuilt
                           from the old plain-HTML Manager.html onto the same
                           DC component engine as the pages above, so all four
                           .dc.html pages now work the same way underneath.
                           Reads scores-data.js only — no backend of its own.
scores-data.js             data layer for the scores page (fixtures, standings,
                           tie-breaks, brackets, auth calls)
organizer-data.js          data layer for the organiser page
404.html                   branded not-found page (Aug 2026). Netlify serves it
                           automatically for any URL matching no rewrite — no
                           netlify.toml rule needed.
support.js, deck-stage.js, doc-page.js, image-slot.js, local-backend.js
                           framework/runtime support — do not edit
netlify/functions/         all backend (see below)
assets/                    crest.jpeg, crest.png (+crest-bat/-shield), action
                           shots, venue map, sponsor-hsbc-white.webp (used) +
                           sponsor-hsbc.webp (master), organisers.jpg
                           (the "Run by volunteers" group photo),
                           share-card.png (the og:image card — see Brand),
                           apple-touch-icon.png + icon-*.png (home-screen icons)
```
(`netlify-forms.html` used to sit here as the Forms decoy — deleted 28 Jul
2026 with the move off Netlify Forms; see that section below.)

`scores-data.js` computes standings, tie-breaks and brackets **in the browser**
from raw results. Results are the single source of truth; every device derives
the same table. Keep it that way — don't move that logic server-side without a
good reason.

---

## What to read for which task (context scoping)

A session has a limited reading budget. Read only what the task needs — do NOT
read files "just to understand the code." Map:

- Homepage / marketing → `Quins JRT.dc.html` only.
- Live scores, standings, brackets, fixture editor → `Scores & Standings.dc.html`
  and `scores-data.js`.
- Organiser back office → `Organizer.dc.html` and `organizer-data.js`.
- Match-day app → `app.html` (add `scores-data.js` only if the change touches
  data or permissions).
- A backend change → the one file in `netlify/functions/` plus `_auth.js` (and
  `_scoring.js` / `_publish.js` / `_teams.js` / `_results.js` only if that area
  is involved).
- A scores/fixtures change → also check **"Shipped, don't rebuild"** below
  first, so you don't redo something that already exists.

**Do NOT read these unless something is provably broken inside them** — they are
framework/runtime plumbing, never edited, and together larger than the rest of
the repo combined: `deck-stage.js`, `support.js`, `image-slot.js`,
`doc-page.js`, `local-backend.js`.

---

## Functions (`netlify/functions/`)

| File | Purpose |
|---|---|
| `_auth.js` | shared helpers — Blobs store, bcrypt hashing, HMAC session tokens, `hasAgeGroupAccess` |
| `login.js` | **THE sign-in endpoint (Aug 2026)** — and since 3 Aug, the ONLY password endpoint. Both roles, account looked up by username alone, session/token minted from the account's own stored role. `${ip}:login` rate bucket, kept separate from the registration bucket. |
| `manager-signup.js` | per-age-group invite code decides the age group; account starts pending |
| `organizer-signup.js` | shared invite code; first organiser account auto-approved |
| `accounts-admin.js` | organiser-only: list / approve / reject / revoke; create a manager **or organiser** login directly (`action:'create'`); reset someone's password (`action:'password'`) or change your own (`action:'changeMine'`) |
| `_password.js` | `MIN_PASSWORD_LENGTH` and `passwordProblem()`. Dependency-free on purpose — see Accounts below |
| `get-results.js` | public read of all match results (merges every age group's blob) |
| `submit-result.js` | write one result; re-verifies role + age group from the token; write-and-verify retry |
| `_results.js` | results storage layout — one blob per age group, legacy merge (see Results storage below) |
| `get-schedule-override.js` / `save-schedule-override.js` | custom draw + kickoff times + pitches (draft/published, see Publishing below) |
| `publish-schedule.js` | makes an age group's fixtures public, or withdraws them |
| `_publish.js` | draft/published keys, publish permission rule |
| `venue-layout.js` | GET (public) the pitch and day layout; `?usage=1` adds per-pitch fixture counts (organisers); POST saves or resets it (organisers only) |
| `registration-window.js` | GET (public) when the entry forms are open; POST saves or resets it (organisers only) |
| `_registration.js` | the registration window — `registrationState()`, `validateSettings()`, `registrationCopy()`, defaults, and the SHARED BLOCK duplicated in `scores-data.js` (see Registration window below) |
| `_venue.js` | `DEFAULT_VENUE` (pitches per day + which groups play each day), `loadVenue()`, `mergeVenue()`, `validateVenue()`, `venueWarnings()`, `countPitchUsage()` |
| `submit-result.js` | also **clears** one result with `{ clear: true }` — the only removal path, and what the clean-up panel loops |
| `_teams.js` | club prefixes and team code generation |
| `_email.js` | confirmation emails via Microsoft Graph |
| `get-registrations.js` | organiser-only; reads both Google Sheets |
| `get-my-registrations.js` | manager: own age group only (teams + players, medical notes included); organiser/`*` admin: all groups — group always comes from the signed token, never the request |
| `submission-created.js` | fires on every Netlify Forms submission; appends a row to the matching Sheet |

Storage: **Netlify Blobs** (`results` — one blob per age group, see **Results
storage** below; `accounts`; schedule overrides) plus two **Google Sheets** for
registrations.

Permissions are always re-checked server-side from the signed token — never
trust an age group or role sent by the browser (`submit-result.js` derives the
age group from the match id itself; preserve that pattern).

---

## Environment variables (set in Netlify, never in the repo)

`SESSION_SECRET`, `MANAGER_INVITE_CODES`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_SHEET_ID_TEAMS`, `GOOGLE_SHEET_ID_PLAYERS`, `GOOGLE_SHEET_ID_CLUBS`,
`CLUB_FORM_KEY` (the silent club link — absent means the club form is CLOSED),
`BLOBS_SITE_ID`, `BLOBS_TOKEN`,
`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MAIL_FROM`

**Never commit a value for any of these.** If a fix seems to need a secret in
code, it doesn't — fix the variable in Netlify instead. All should read *"All
scopes · Same value in all deploy contexts"*; several values across contexts is
almost certainly a mistake.

---

## Age groups

15 groups, used as manager roles and as the prefix of every match id:

`u6 u7 u8 u9 u10 u11 u12 u12g u13 u14b u14g u16b u16g u18b u18g`

- Which day each group plays comes from the **venue layout**, not a list — see
  the Venue section below. Saturday is U6–U12 plus **U18B and U18G**; Sunday is
  U13–U16 plus **U12G**. Do not write that split down anywhere else.
- `u6`/`u7` are festival only — `hasStandings: false`, no table, hidden from
  public standings tabs (but available in the Manager area).
- `u16b`/`u16g` use a special double-bracket knockout.
- Spirit of Rugby award applies to U14 and up.
- Match id format: `<ageGroupId>:<poolId>:<i>-<j>` e.g. `u14b:A:0-1`.

**Playing format and squad size per group** (2025, expected to hold for 2026),
carried on `AGE_GROUP_INFO` in `Quins JRT.dc.html` as `format` and `squad`:

| Format | Squad | Groups |
|---|---|---|
| 7s | 12 | u6, u7, u8, u9, **and all four girls' groups** — u12g, u14g, u16g, u18g |
| 10s | 15 | u10, u13 |
| 12s | 18 | u11, u12, u14b, u16b, u18b |

`squad` is a MAXIMUM and it is what the entry form caps at — per group, via
`_squadCap()`. It used to be a flat `MAX_TEAM_PLAYERS = 15`, wrong at both ends:
7s clubs could enter three more than allowed, and **every 12s group was blocked
three players short of a legal squad** — the Add button just stopped at fifteen
and typing 18 into the count box silently rewrote it to 15. Do not reintroduce a
single cap. Before a group is picked the cap is `MAX_SQUAD_ANY_GROUP` (18) so a
club filling the roster first is never blocked; it tightens on selection, and
`submitTeam` refuses a roster over the cap rather than dropping the extra
players. Note the girls' groups differ from the boys' groups of the same age.

Scoring: 4 win/walkover, 2 draw, 0 loss. Walkover recorded 20–0 with 4 tries.
Tie-breaks in order: points difference → most points → head-to-head → least
conceded → mini-league for 3+ → coin toss.

---

## Brand

Black base, red `#E11B22`, green `#17A34A`, white. From the Akuma kit — **not**
London Harlequins magenta/blue. Fonts: Anton (display), Barlow (body).

**Two crest files exist — use the right one.** `assets/crest.png` is the current
transparent-background logo: the homepage nav/about/organiser crests and the
favicons. `assets/crest.jpeg` is the older
white-background version. As of 25 Jul 2026 nothing references it: the homepage,
`/scores` and `/app` all use `crest.png`. It is kept only as the original.
Check what a page actually uses before changing a reference — a broken crest reference once killed every social
share preview.

**The wordmark is "ABU DHABI HARLEQUINS"** (changed 3 Aug 2026 at Jay's
request, from the shortened "AD HARLEQUINS"). It appears in **four** places, all
renamed together: the homepage header and footer, and `legal.html`'s topbar and
footer. `test-design-polish.js` asserts all four and counts them, because a
half-renamed brand reads as a bug and nothing had covered any of them before.

⚠️ **NOT the same thing as `teamLabel()`'s "Abu Dhabi …" → "AD …" shortening in
`scores-data.js`.** That one is deliberate, it is for TEAM names in narrow
standings columns, and it must not be dragged into line with the wordmark. Two
different rules that look identical in a grep.

⚠️ The header wordmark carries `white-space:nowrap`: seven characters became
twenty inside a **sticky** header whose whole layout budget is one line. It also
forced the HSBC header hide up to 900px — see the HSBC section below, and note
that the re-measurement found a **pre-existing** horizontal overflow.

**Social share images are `assets/share-card.png`** (added Aug 2026, design
audit) — a rendered 1200×630 dark-brand card (crest + wordmark + dates), used
by the `og:image`/`twitter:image` tags on the homepage, `/scores` and `/legal`.
The bare square crest used to sit in those tags and rendered as a tiny logo on
an arbitrary background in every WhatsApp/Twitter preview. If the tournament
dates ever change, this image carries them and must be re-rendered.

---

## HSBC — the principal partner (added 2 Aug 2026)

HSBC are the tournament's **principal partner** and the only confirmed sponsor.
The mark appears in **three** places on the homepage, all on `#0C0C0E`:

| Where | Size | Notes |
|---|---|---|
| sticky header, beside the crest | 19px | not a link; hidden below 900px |
| hero, centred in the space after the Register buttons | **128px** | added 3 Aug 2026; `margin-left:auto` AND `margin-right:auto` — auto on BOTH sides is what makes it halfway rather than hard right, which Jay rejected. `max-width:100%` because at 128px it is ~510px wide, wider than a phone. "In partnership with" above it, divider to its left |
| `<section id="sponsors">` | 64px | "Principal partner", plus a paragraph |

⚠️ **There WAS a fourth — `<section id="partner">`, a 54px band between the hero
and the stat strip — and it was removed on 3 Aug 2026**, the same day the hero
lockup went to 128px. Jay: *"lets remove the HSBC section between the hero and
the stat numbers area, and lets make the HSBC in the hero section double in
size."* The two said the same thing a few hundred pixels apart.

**The band's own argument is still a good one and somebody will make it again:**
HSBC deserved "the first slot after the fold, with nothing else competing for
the eye". The 128px hero lockup is the answer to that now, and **the two must
not both exist** — that was the whole complaint. A tombstone comment sits where
the band was, `test-sponsors.js` asserts the section is gone, that no 54px
lockup survives, that "In partnership with" appears exactly ONCE, and that the
tombstone itself is still there. Four faults, including one that simply puts
the band back.

⚠️ **The hero placement cannot be moved to the other Register pair.** Those two
buttons appear again in `<section id="register">` ("Sign up now"), whose
background is `{{ accent }}` — **our** red, `#E11B22` by default. The reverse
lockup's hexagon is HSBC red, so it would sit red on red and disappear, with no
error reported anywhere. The hero's `#0C0C0E` is why it works there. There is a
fault for exactly this move.

The hero row was two buttons and carried no `flex-wrap`. A third item overflows
a phone without one, so the rule was added in the same commit; below 800px the
row wraps and `.hero-partner` drops its divider and indent (`!important` — the
block is styled inline, same trap as `.hdr-partner`). Measured in headless
Chromium with the real faces at 1440 / 1180 / 390px: one line down to 1180,
own line at 390, nothing overflowing.

**Two assets ship and only one is used.** `assets/sponsor-hsbc-white.webp` is
the reverse lockup (white wordmark, red hexagon, transparent) and is what every
placement references. `assets/sponsor-hsbc.webp` is the black-wordmark master,
kept **only** so a future light-background placement does not need the artwork
found again. Referencing the black one on the page makes the wordmark vanish
into the background — a failure that renders no error anywhere, the same shape
as the crest reference that once killed every social share preview.
`test-sponsors.js` asserts the black one is not referenced.

⚠️ **The header hide is at 900px, NOT at the 760px nav breakpoint, and the
number was measured — twice.** Rendered in headless Chromium with the real Anton
and Barlow faces (fallback fonts are wider and give a different, wrong answer).

The first measurement checked for WRAPPING only, and reported a healthy header
that was already broken: on 3 Aug 2026, re-measuring for the longer
"ABU DHABI HARLEQUINS" wordmark found the bar **overflowing the viewport
horizontally from about 875px down** with the mark still showing — and doing it
with the OLD short wordmark too (identical 874px scrollWidth at a 870px
viewport). So it was a pre-existing bug, not the rename's doing. A sticky header
that scrolls sideways follows a visitor down every page. **900 is 875 with
margin**, and a sweep from 1440px to 360px is now clean at every width.
**A measurement only answers the question you asked it.**

Folding the rule into the 760 block — which looks like tidying — puts
a second line back into a *sticky* header, and nobody sees
it on a 1440px screen. There is a fault for exactly
this tidy-up.

The header mark is deliberately **not a link**. The header is sticky, so a tap
target leaving the site follows a visitor down every page — including a parent
part way through the registration form.

The crest link and the mark are wrapped in **one** flex child of `.hdr-row`,
because the row is `justify-content:space-between`: a fourth direct child would
have been spread into the middle of the bar. As a side effect the wrapper's
`min-width:0` also fixed a pre-existing ~42px horizontal overflow of the header
just above the mobile breakpoint.

### Nineteen company names were in this repo as if they had signed

`sponsorNames` in `Quins JRT.dc.html` listed Transguard Group, MODON, Kibsons,
Crompton Partners and fifteen others, and `renderVals()` returned it doubled as
`sponsors:` for a marquee. **Nothing rendered it** — the markup that consumed it
had already been replaced by the "coming soon" placeholder — so it was invisible
on the site and fully visible in a PUBLIC GitHub repo. Jay confirmed on 1 Aug
2026 that none of them are confirmed. All of it is deleted, and
`test-sponsors.js` asserts each of the nineteen names ABSENT **by name** — a
check on the identifier alone would pass the moment somebody re-added the same
list under a different one.

---

## Gotchas found the hard way

- **The homepage's outer wrapper must carry NO width bound.** It has now been
  wrong in both directions. It started as `min-width:1200px`, which forced a
  1200px canvas onto phones — the site rendered zoomed out and the registration
  modal came out tiny. `2b8fd97` swapped it for `max-width:1200px;margin:0 auto`,
  which fixed the phone and left the site as a 1200px column with black gutters
  on every desktop wider than that. Neither belongs there: every section caps its
  own content with its own `margin:0 auto`, so the backgrounds run edge to edge
  and the text stays readable. `test-layout.js` holds the line on the wrapper,
  on each section capping itself, and on the phone fix surviving.
- **Netlify form detection is off by default** — forms must be enabled *and* a
  fresh deploy run afterwards; the crawler only scans at deploy time.
- **Google Sheets tab is not called `Sheet1`.** Both functions look up the
  first tab's real name at runtime. Don't hardcode a tab name.
- **Service account private key**: use the raw `private_key` value from the
  JSON, no wrapping quotes; literal `\n` is expected and converted in code. A
  malformed key throws `ERR_OSSL_UNSUPPORTED` at `Sign.sign` — that error
  always means the key, never Sheet permissions.
- **Netlify Forms and the Sheets are separate stores** — deleting a submission
  in Netlify does not remove the Sheet row. To remove a registration, delete
  the sheet row.
- **Date of birth is stored as `yyyy-mm-dd`, and that shape is load-bearing.**
  The organiser's Registrations tab reconciles a club's roster against parent
  registrations on an exact string match of name + DOB, so a different format on
  either side makes every player read "no parent registration". The player form
  therefore uses three dropdowns (day / month by NAME / year) feeding
  `composeDob()`, which is the only thing that decides the value — not a native
  `<input type="date">`, whose displayed order follows the device locale and
  shows `mm/dd/yyyy` to a UAE parent on a US-English phone, where a day/month
  swap is silent. `composeDob` also refuses impossible dates (31 February)
  rather than letting `new Date` roll them forward to a birthday nobody typed,
  and `fmtDobLong()` echoes the stored date back with the month spelled out so a
  transposition is visible at the moment it is made. The team form's roster rows
  still use a native date input — deliberate, coaches fill those in on a desktop.
- **A failed registration must fail loudly.** Both forms post through
  `postRegistration()` in `Quins JRT.dc.html`, which throws on status ≥ 400;
  the caller then shows an error and, critically, **leaves the filled form
  intact** so Submit retries it. Do not restore the old shape — it awaited
  `fetch` inside a try/catch that swallowed the error and never looked at the
  status, so a network drop *or* an undetected form (Netlify answers an unknown
  form with a plain 404) showed the club a success screen for a registration
  that was never stored. Nothing downstream would catch it: the confirmation
  email comes from the same submission, and mail errors are swallowed too.
  The check is deliberately lenient — only ≥ 400 or a thrown error fails, so a
  followed redirect still counts as success.
- **`registrationOpen` is gone.** It was an editor prop with a hardcoded
  `true` default plus four hardcoded "October 2026" strings in the markup, so
  every date change was a production deploy. Registration is now a back-office
  setting — see "The registration window" above. Do not add a second lever for
  it; one fact with two switches is how they end up disagreeing.
- Netlify Identity is *not* used; auth is the custom bcrypt + HMAC system above.
- **`.dc.html` templates only bind what `renderVals()` returns.** Raw
  `this.state.X` is not directly bindable — every value used as `{{ X }}` in the
  markup must be re-exported from `renderVals()` (it re-lists state by name, e.g.
  `fixtureTeamFilter: fxFilter`). A `{{ X }}` that isn't returned silently
  resolves to empty. (This broke the Fixtures→Results link until `fxSelectedId`
  was added to the return.)
- **`style-hover` / `style-before` / `style-after` generate a single-class
  pseudo rule with NO `!important`.** So a `style-hover` that changes a property
  also set inline in the base `style=""` (e.g. `box-shadow`) is silently
  overridden — inline wins. Put `!important` inside the `style-hover` value to
  make it apply. (Why the button hover-glow did nothing at first.)
- **`dc-import` forwards its attributes to the imported component as reactive
  props.** The child reads `this.props.X` and gets `componentDidUpdate(prevProps)`
  on change — the channel the homepage uses to drive the embedded Scores app.
- **Fixtures and standings do not speak the same language.** `getFixtures()`
  runs BOTH pool teams and knockout slots through `teamLabel()` (knockout was
  added 25 Jul 2026), so everything it returns is a readable name
  ("AD Harlequins 1"). `getStandings()` does NOT: `pools[].teams` and every
  `tables[]` row come back as the raw draw string, which is a code ("ADH1") on
  a default draw. Anything comparing a team from one source against a team from
  the other must normalise through `teamLabel()` first — a plain `===`
  silently matches nothing and the UI just looks empty rather than erroring.
  This is exactly what broke "follow my team" in `/app`; the fix there is the
  `sameTeam()` helper in `app.html`. `teamLabel()` is idempotent, so applying it
  to something already resolved is safe.
- **`/app` holds TWO age groups at once** — `S.ageId` (the group you follow,
  feeding the Today tab via `S.followFx`) and `S.browseId` (the pill you tapped,
  feeding Fixtures/Tables via `S.fixtures`). They are deliberately separate; one
  shared slot meant browsing another group blanked Today. A match opened from
  either place derives its own age group from the match id (`ageOfMatch()`), the
  same way the backend does.

---

## The match-day app (`/app`)

Club Hub-style phone app: bottom tab bar (Today / Fixtures / Results / Tables /
More — Results became its own tab 25 Jul 2026),
top nav on desktop above 820px, bottom sheets for match detail and score entry.
JRT palette, Anton + Barlow.

- Reads through `scores-data.js` — publishing, permissions and "coming soon"
  behave exactly as on the website.
- **Fixtures is the schedule, Results is the scores.** Fixtures deliberately
  does not show a scoreline; a played match carries a "Full time" chip instead,
  and tapping the row still opens the result. Do not add scores back to the
  Fixtures rows — having them in two places is what the Results tab replaced.
- **The standings table is tuned to fit a phone.** The position and team columns
  are `position:sticky` (a pinned cell needs its row tint restated or it scrolls
  past as plain white), and below 430px PF and PA are hidden and cell padding
  tightens. Keep the team column narrow: this is why the app shows team CODES in
  the table while showing full names in fixture rows.
- **Two age groups are live at once:** `S.ageId` (followed, feeds Today via
  `S.followFx`) and `S.browseId` (the pill you tapped, feeds Fixtures / Results /
  Tables via `S.fixtures`). A match opened from either derives its own age group
  from the match id via `ageOfMatch()`, the same way the backend does.
- Sign-in is ONE call to the unified `login.js` endpoint (Aug 2026), one
  localStorage key (`adhjrt_session_v2`) for either role. An organiser
  session still reaches manager-side callers marked `isOrganizer` rather
  than carrying a `role` field — there are still three historical session
  shapes, so keep using `isOrganizerSession` in scores-data.js when testing
  a role (missing one shape silently hid the Publish button once).
- Managers get score entry on their own age group; organisers on all.
- Fixture editor and publishing controls are deliberately NOT in the app — the
  More tab's "Full manager tools" row links to `/manager` for that
  drag-and-drop work (it pointed at `/scores` until Aug 2026, when that page's
  Manager area was retired).
- A follower's chosen age group is remembered in localStorage, per device.
- PWA install works but isn't promoted (push notifications would justify it
  but there's no backend for that). Treat `/app` as a fast mobile web page.

---

## Accounts and passwords (rewritten 27 Jul 2026)

### Making a login

**Both roles are created in the back office now** — Accounts tab → *Create a
login* → pick Manager or Organiser. Approved immediately, no invite code, no
approval round trip. `accounts-admin.js` `action:'create'` takes a `role`
(defaulting to `manager`, so older callers still mean what they meant).

- A **manager** needs an `ageGroupId`. That is the only thing scoping them away
  from every other group's registrations, and the signed token carries it.
- An **organiser** needs none — they see everything — and takes an optional
  free-text title.

⚠️ **`ORGANIZER_INVITE_CODE` WAS DELETED IN NETLIFY ON 3 AUG 2026, so this is
now the ONLY way an organiser account gets made.** `organizer-signup.js`
refuses every signup while that variable is absent, so the deletion shut
self-signup off with no deploy and no code change. It closed two things at
once: one shared code for everybody with no expiry, no per-person revocation
and no record of who used it; and the first-organiser-auto-approved bootstrap,
which would hand an approved organiser account — and children's medical notes —
to whoever signed up first if the accounts blob were ever lost.

**Google organiser signup is closed by the same deletion** — `google-auth.js`
reads the same variable. Signing IN with Google is unaffected, both roles.

⚠️ **`organizer-signup.js` is kept rather than deleted, because it is the
recovery path.** If every organiser account were ever lost there would be no
way back in: re-add `ORGANIZER_INVITE_CODE` in Netlify, sign up (the first
organiser auto-approves), then delete it again. The variable is read per
request, so neither step needs a deploy. `test-accounts.js`'s "a missing invite
code refuses every signup" is what keeps the closed state true and is now
load-bearing.

**`MANAGER_INVITE_CODES` is NOT redundant the same way and stays.** Fifteen age
groups means the alternative is creating fifteen accounts by hand and
transmitting fifteen passwords — and a password is a working credential the
moment it exists, where an invite code yields only a PENDING account somebody
still has to approve. The manager codes are also scoped one per age group,
where the organiser code was one secret for total access.

### One sign-in for everything (Aug 2026)

**Sign-in lives at `/signin`, and only there.** `Signin.dc.html` carries
password sign-in, the Google button and BOTH signup flows. After sign-in it
routes by the account's role — organizer → `/organizer`, manager →
`/manager`; `?next=` is honoured only from the allow-list of exactly those
two paths and only when the role permits it. `/organizer` and `/manager`
redirect signed-out visitors to `/signin` and carry no sign-in UI of their
own; `/scores` is purely public. `/app` keeps its own inline sheet (it is
the match-day PWA) but calls the same unified endpoint.

**One endpoint** — `netlify/functions/login.js`, the password twin of
`google-auth.js`: account looked up by username alone (no role filter),
session/token minted from the account's stored role, same `${ip}:login`
rate bucket as the old per-role endpoints so the attempt budget stayed one
pool while all three existed.

⚠️ **`organizer-login.js` and `manager-login.js` are RETIRED — deleted
3 Aug 2026, and they must not come back.** They were kept byte-identical and
uncalled through the unification for one reason: `test-accounts.js` and
`test-google-auth.js` read them by name, and Jay's gate was that those files
pass byte-unchanged. That scaffolding is spent. On retirement every check
that read them moved to its subject rather than being deleted with it — the
parity checks became hardcoded literals on `login.js`, `test-google-auth.js`
now pins the Google session against `login.js` (better: that is the live
endpoint, not a dead one), and `test-accounts.js`'s no-length-check-at-login
rule reads `login.js`. `test-unified-login.js` asserts both files are absent,
with a fault that writes one back to prove the check fires. A resurrected
copy would be dead code published on a public repo AND a second password
endpoint with its own rate-limit bucket.

**One session key** — `adhjrt_session_v2`, both data layers. The one-time
migration (`migrateSession()` in scores-data.js, imported by
organizer-data.js — one copy) moves the two pre-Aug-2026 keys across on
first read, organizer key winning for anyone who held both, and cleans the
old keys up; malformed JSON reads as absent, never a throw. Tokens were
untouched, so nobody was signed out. `logout()` clears all three keys.

⚠️ **The old fallback hacks are gone and must not return.** organizer-data's
login used to retry manager-login and hand-write the token into the scores
page's localStorage key before redirecting; scores-data's login used to
retry organizer-login into a second key. Both chains existed only because
each endpoint had a role filter. The unified endpoint has none — one call,
the account's own role decides where you land. test-signin-page.js,
test-session-migration.js and test-unified-login.js hold all of this.

### The signup role picker is GONE (Aug 2026)

**Both signup flows on `/signin` — password and Google — now create an
age-group manager, and nothing else.** The picker that chose between Manager
and Organiser is deleted, along with its blurb, the organiser-only "role /
title" inputs, and the invite-code label that switched between ADMIN INVITE
CODE and AGE GROUP INVITE CODE.

**Why:** `ORGANIZER_INVITE_CODE` was deleted in Netlify on 3 Aug 2026, so
`organizer-signup.js` and `google-auth.js`'s organiser branch refuse EVERY
organiser signup while it is absent. Leaving the option would have offered a
choice that can only ever fail, answered by a wrong-code message that reads as
"you typed it wrong" — the worst kind of dead end, because the person retypes
a code that was never going to work.

`signupRole` survives in state, fixed at `'manager'` and with no setter, so
both signup payloads keep the exact shape they had. `signupTitle`/`googleTitle`
survive the same way (always `''`, as a manager signup already sent), but their
renderVals bindings are DELETED — a binding with no markup is dead code, and on
a public repo whose root IS the deployed site, dead code is still published.

**Organiser accounts are made in the back office only**: `/organizer` →
Accounts → Create a login → Organiser. `test-signin-page.js` asserts the
closure on the page source rather than on state — a check that drives a state
the UI cannot reach proves nothing about what anyone can actually do.

### My account (added Aug 2026)

Design: `claude/specs/spec-my-account.md`. **One card, two modes**, rendered on
both `/organizer` and `/manager`.

**`netlify/functions/my-account.js` — the door is ANY valid session, not an
organiser session.** That is the whole reason it is not in `accounts-admin.js`,
whose `requireOrganizer` gate applies to every action behind it: a manager
could not previously even change their own password. `GET` returns your own
safe fields; `POST {action:'password'}` changes your own password (the current
one required); `POST {action:'linkGoogle'}` attaches a Google identity.

⚠️ **THE ACCOUNT ACTED ON IS ALWAYS THE ONE IN THE VERIFIED TOKEN.** There is
deliberately no code path that reads a username, id or role off the request,
and the cards send none. It is the only thing between "link my Google account"
and "link my Google account to somebody else's login".

**Linking refuses rather than replaces.** An identity already on another
account → 409 (two accounts sharing one would resolve to whichever `find()`
reached first — a silent mix-up in a store holding children's dates of birth
and medical notes). A different identity already on YOUR account → 409, not a
swap, or a stolen session could plant a way back in that survives the real
owner changing their password. Re-linking the same identity is a no-op
success. **Consequence, accepted: there is no unlink and no way to move one.**

⚠️ **LINK GOOGLE DOES NOT EXIST IN OTHER-PERSON MODE, BY DESIGN.** An organiser
attaching a Google identity to someone else's login would be attaching their
OWN. Two guards, each with its own injected fault: the `!s.acctSubject` clause
in `acctCanLinkGoogle`, and an early return in `onAccountGoogleCredential`.

**`changeMine` was deleted from `accounts-admin.js`** in the same commit — two
ways to change your own password is two rules that drift. `action:'password'`
(an organiser resetting SOMEONE ELSE'S, with no current password, because the
point is that it is lost) stays there, behind that door. `/manager` reaches
none of the accounts-admin actions, asserted by name.

⚠️ **`signInMethodOf()` lives in `_auth.js` and is the ONE copy.**
`accounts-admin.js`'s listing used to derive the same field for itself as
`googleSub ? 'Google' : 'Password'`, **which cannot ever return `'Both'`** — so
a password login with Google linked read as "Google only". Invisible while
nothing displayed the field; the card displays it as one of five facts about a
person, and linking made `'Both'` an ordinary state rather than an impossible
one. Both readers now call the shared function, and its behaviour is DRIVEN in
`test-my-account.js`, not grepped.

**The card's markup is a second copy on purpose** (no build step, no shared
component system — the cost already paid by `DEFAULT_VENUE` and the
registration copy block). Its DATA LAYER is not: `myAccount()`,
`changeMyPassword()` and `linkGoogle()` live in `scores-data.js` and
`organizer-data.js` re-exports them, along with `googleClientId()` — which the
Link Google button needs and which was missing until `test-accounts.js`'s
`api.*` sweep caught it. That sweep exists because this is exactly how the two
password features below died.

⚠️ **`/organizer` and `/manager` load Google's script now, and that is NOT a
sign-in path.** `test-signin-page.js` used to assert no Google machinery of any
kind existed on `/organizer`; that check was NARROWED, deliberately and in
four parts, to "no Google SIGN-IN" plus positive assertions that the only
Google code there is the LINK button. A widened check is a check with less to
say, so the linking machinery got its own assertions rather than being covered
by silence.

### Last sign in (added Aug 2026)

The My account card shows when each account last signed in, under *Member
since*. On your own it is trivia; on somebody else's it answers the question an
organiser actually has — **which managers have never got in.** No record reads
as **Never**, which covers both "never signed in" and "the store could not be
read": honest either way, since we do not know that they have.

⚠️ **THE STAMPS LIVE IN THEIR OWN BLOB STORE (`signins`), ONE KEY PER PERSON —
NOT ON THE ACCOUNT RECORD, AND THIS IS THE WHOLE DESIGN.** Every account lives
in ONE blob under the key `list`, and `saveAccounts()` writes the whole array
back; Netlify Blobs has no compare-and-set. That is tolerable today only
because the accounts blob is written rarely — create, approve, reject, revoke,
a password change, a Google link. **A field on the account record would make it
a write on EVERY LOGIN**, and then fifteen managers signing in inside a minute
on tournament morning, while an organiser approves somebody, means one write
silently discards the other and the approval just quietly did not happen.

That is not hypothetical. It is exactly the bug that lost match results in July
2026 and forced the results store to be split one blob per age group — see
**Results storage** above. One key per person means two people signing in at
the same moment touch two different keys and cannot collide at all, and no
sign-in can ever damage an account record. `test-my-account.js` **proves** it
rather than asserting it in a comment: it interleaves two sign-ins with an
organiser approval and checks the approval survives, and there is an injected
fault that moves the stamp back onto the account record.

- **Recorded AFTER the password and approval checks, never before.** A failed
  attempt is not a sign-in, and stamping one would let anyone move somebody
  else's "last signed in" just by guessing at their username. Two faults.
- **Both doors record it** — `login.js` and `google-auth.js`, including a
  brand-new account that is approved immediately, or the first organiser would
  read as never having signed in.
- **It FAILS OPEN, both ways.** `recordSignIn()` swallows everything: a display
  nicety must never cost somebody a sign-in on the one morning it matters.
  `readSignIn()` answers null rather than throwing.
- **The username is sanitised before it becomes a blob key**, the same way
  `_ratelimit.js` sanitises the client address.
- Your own card reads it from `my-account.js`; somebody else's reads it from
  `accounts-admin.js`'s listing, which the card already renders — no second
  endpoint and no second round trip.
- The card shows the **time as well as the date**: "3 August" alone cannot
  answer "did they get in this morning?", which is the only question the line
  exists for. There is a fault for dropping the time.

### Passwords

**One floor, `MIN_PASSWORD_LENGTH` in `netlify/functions/_password.js`, currently
10.** It was 6, written out separately in three functions. An organiser reads
every registration and a manager reads their own group's in full, medical notes
included — both reach the same class of data, so both get the same floor.

`_password.js` is deliberately **separate from `_auth.js` and dependency-free**:
the rule is policy, not cryptography, and `_auth.js` pulls in `bcryptjs`, which
Netlify installs at build time and which is not in the clone. Keeping them apart
is what lets `test-accounts.js` require the rule directly. A test that needs
`npm install` first is a test that eventually stops being run. `_auth.js`
re-exports it, so every existing `require('./_auth')` is unaffected.

⚠️ **The floor applies when a password is SET, never at login.** A length check
in `login.js` would lock out every account whose password predates the change —
the whole committee, on the morning somebody needed to get in. `test-accounts.js`
asserts it has none, and so does `test-unified-login.js` from its own angle;
each is proven by its own injected fault. (This rule named the two per-role
endpoints until they were retired on 3 Aug 2026.)

`Organizer.dc.html` **and `Manager.dc.html`** each carry their own copy of the
number so the My account form can complain before sending; the test asserts
they match the server's. A client floor *lower* than the
server's means Create goes ahead and bounces off a 400 with the password already
typed.

### Two features that were dead and silent

Until 27 Jul 2026 `Organizer.dc.html` called `api.resetAccountPassword()` and
`api.changeMyPassword()`. **Neither function existed in `organizer-data.js`, and
neither action existed in `accounts-admin.js`.** Both dialogs opened, took a new
password, closed, and did nothing — the `TypeError` was swallowed by the dialog's
own `.catch()` and reached only the browser console. On screen it looked exactly
like success. Nobody could reset a password and nobody could have known.

Both are built now. More importantly, **`test-accounts.js` mechanically checks
every `api.X` the page calls against what `organizer-data.js` actually exports**,
and every action the data layer posts against what `accounts-admin.js` handles.
Add a UI call and its data-layer function in the same commit, or that test fails.

This is the failure mode this codebase is most prone to: the `.dc.html` files
call into a data layer through a plain object, so a missing function is not a
build error, not a runtime crash the user sees, and not visible in review. It is
the same shape as the `{{ token }}` binding trap already recorded above.

---

## Sensitive data — read this section, always

The player registration sheet holds children's names, DOBs, medical notes and
parent contact details.

- Never widen access to `/organizer` or to `get-registrations.js`.
- Age-group managers see their OWN group's registrations in full (deliberate,
  for player welfare) via `get-my-registrations.js` — the group comes from the
  signed token, never the request. Keep it that way.
- Never log registration field values or paste sheet contents into a commit,
  issue, or public file.
- First-organiser-auto-approved means the account list is worth auditing —
  flag anything unexpected rather than fixing it silently.

---

## Results storage (changed 25 Jul 2026 — the old layout is gone)

Match results live in the `results` Blobs store, **one JSON object per age
group**, key `ag:<ageGroupId>`, results keyed by match id inside it. All of it
goes through `_results.js` — `readGroup` / `writeGroup` / `readAll`. Nothing
else should touch the store directly.

- **Why it was split.** Everything used to sit in one object under the key
  `all`. Blobs has no compare-and-set, so a write is a whole-object overwrite:
  two managers in two different age groups saving in the same second both read
  `all`, both wrote it back, and the second one — which had never seen the
  first's score — silently deleted it. With 15 groups scoring at once on a
  tournament day that was the single biggest match-day risk.
- **The legacy `all` key is read-only.** `readGroup` falls back to the matching
  slice of `all` when a group blob doesn't exist yet, and `readAll` layers the
  per-group blobs over it. Nothing writes or deletes `all` — it is the pre-split
  history and stays as a safety net. Don't "tidy" it away.
- **Same-group collisions are handled by write-and-verify.** `submit-result.js`
  writes, reads the group back, and looks for its own `submittedAt`. If it
  isn't there, someone overwrote it — re-read, merge, write again, three
  attempts, then return **409 and an error the manager can see**. Never return
  `ok:true` without that read-back: a score reported as saved but missing isn't
  noticed until the standings are wrong. The reply carries `stored:{homeScore,
  awayScore,walkover}` and both score screens display those figures rather than
  echoing the form.
- **U6 and U7 refuse scores at the API**, not just in the UI (`FESTIVAL_AGE_IDS`
  in `_scoring.js`). Clearing stays allowed so results stored before that check
  existed can still be removed.
- **Knockout results are cleared when their matchup is replaced.** Knockout
  match ids are stable (`u16b:CUP`), so regenerating a bracket used to leave the
  old score attached to a slot now holding two different teams.
  `clearResultsFor(ids)` in `Scores & Standings.dc.html` handles it, and only
  for slots whose teams actually changed.

---

## Clearing the rehearsal data — DONE, panel deleted (Aug 2026)

The tournament rehearsal (255 invented teams, 3,825 invented players, 415+
invented results, all 15 groups published — later re-run at 452 results on
1 Aug) was fully cleared by Jay in early Aug 2026. Verified live before the
panel came out: `get-results` returned **0 stored results** and
`get-schedule-override` returned **no published copy for any of the 15
groups**.

The "Clear the rehearsal data" card and its code were deleted from
`Scores & Standings.dc.html` in the same change (part of retiring that page's
Manager area — `claude/specs/spec-scores-manager-removal.md`). Its
`test-cleanup.js` (one of the adhjrt-sim files on jay-pc, never in this repo)
is obsolete with it.

**If bulk clearing is ever needed again**, "Reset the simulation" on
`/organizer` → Tournament does most of it — unpublishes every group, removes
every result one write-and-verify call at a time, clears generated brackets —
and deliberately does NOT touch saved pools/team assignments or the Google
Sheets. The old panel's design notes (why nothing deletes in one shot, the
match-day guard, typed confirmation) live on in that tool and in git history
(`git log -- 'Scores & Standings.dc.html'`, Jul 2026).

---

## Publishing fixtures

Fixtures are draft-first. The `schedules` blob store holds two copies per age
group: `<ageGroupId>` is the DRAFT the fixture editor reads/writes, `pub:<id>`
is the PUBLISHED copy and the only thing the public sees.

- `save-schedule-override.js` writes the draft only — never makes anything public.
- `publish-schedule.js` copies draft → published, or deletes the published copy.
- `get-schedule-override.js` serves published to the public, draft to a
  signed-in editor asking with `?draft=1` + Bearer token.
- Organisers can publish any time; managers only on tournament days, own age
  group only (`_publish.js`).
- **An auto-generated draw is never shown publicly** — no published copy means
  "coming soon," before/during/after the tournament, because a parent can't
  tell placeholder pools from real fixtures.
- The draft draw object also carries a `pitches` array (set in the editor) —
  rides in the same blob, no schema change needed.
- It also carries a **`teamNames`** map (`{ ADH1: 'AD Harlequins' }`). Same
  trick as `pitches`: it rides in the blob, `publish-schedule` copies it to the
  public copy, and no Netlify function needed changing. This is what lets the
  public site show club names while the draw itself stores short codes — a
  parent never has to touch `get-registrations`, which is organiser-only and
  sits next to children's data.
- **`teamNames` is rebuilt from the registrations on every save**, by
  `withTeamNames()` in `Scores & Standings.dc.html` — every `api.saveDraw` call
  site goes through it, so none can forget. It used to be written only by
  "Import registered teams", which meant a draw built before the import existed,
  or built by hand, carried an empty map and showed parents raw codes. Derived
  entries win over what is already stored (nothing else authors the map —
  `onRenameTeam` rewrites the CODE, not the display name), and an empty derived
  map is a no-op so a failed registrations fetch can never blank the names.
  `teamNamesFromRegistrations()` is the single source of the naming rule and the
  import review table reads it too, so the two cannot drift.

## The sheet columns — one copy, at last (added 28 Jul 2026)

`netlify/functions/_intake.js` holds the column order for both registration
sheets, the row builders, and the two mappers that turn a row back into what
`/organizer` displays.

**It was hardcoded three times** — `submission-created.js` (a positional array),
`get-registrations.js` and `get-my-registrations.js` (`TEAM_FIELDS` plus a
sixteen-name positional destructure, duplicated verbatim between them). Each
file was individually consistent, so a one-column drift between them would have
read as correct in review and put a parent's phone number in the
emergency-contact box. The sheet is what somebody rings from at a tournament.

- **The round-trip test is the point.** Write a registration with the writer,
  read it back with the reader, get the same thing. That check could not be
  written at all while the two halves lived in different files, and it is what
  catches a shift of one.
- The A1 ranges (`A:N`, `A:P`) are **derived** from the column counts, not
  typed. A range narrower than the row makes Sheets drop the overflow with no
  error anywhere.
- `submittedAt` and `team-code` are spread **after** the submitted data, so a
  submission cannot supply its own timestamp or claim another club's team code.
- Sheets returns a **short array** when the trailing cells are blank — it does
  not pad. Every field comes back `''`, never `undefined`, or the dashboard
  renders the word "undefined" in a column.
- `preferred-pool` is the LAST team column, not next to `age-group` where it
  reads as if it belongs. It was added after the sheet had rows in it. Leave it.
- ⚠️ `valueInputOption: 'RAW'` is load-bearing and asserted. `USER_ENTERED`
  makes a typed `=` a live formula in a sheet holding children's names, dates of
  birth and medical notes, and eats the `+` off every phone number.

### The allow-list (added 28 Jul 2026)

`cleanSubmission(form, data)` in `_intake.js` decides what a submission may
contain at all. Until the gateway, Netlify Forms decided that. From the gateway
on the **request body** decides — and the body is public input to an
unauthenticated endpoint that writes children's data to a sheet and sends mail
from `admin@adhjrt.com` to an address taken out of that same body.

- Unknown keys are **dropped, not refused** — a browser extension or a corporate
  proxy adding a field must not cost a coach their registration — but the drop
  is **reported by NAME** so it can be logged. ⚠️ Never log a field VALUE.
- `submittedAt`, `team-code` and `team-name` are absent from both field lists.
  All three are generated. The team code is what the sheet, the draw and the
  printed pitch flags key on, so a body that could supply its own would let
  anyone claim another club's.
- The form name is matched **exactly**, and an unknown one returns `null` rather
  than an empty result — "we do not know what this is" and "a valid form with
  nothing filled in" are different answers and the caller needs both.
- The result is `Object.create(null)`. On a plain `{}` a submitted `__proto__`
  does not become an own property, it walks the prototype chain — a worse
  surprise than being dropped.
- `bot-field` (the honeypot) is allowed **through** the filter so validation can
  see it, but it is not a sheet column, so it can never be written.
- **The field lists and the columns are asserted against each other both ways.**
  A field with no column is silently thrown away after validation passes; a
  column with no field is permanently empty and nobody notices.

## Club-level registration is BACK, behind a silent link (3 August 2026)

**Jay, 3 Aug: a link he can email to clubs that does not appear anywhere on
adhjrt.com.** The feature he had removed on 2 Aug is restored — recovered by
reverse-applying `91080a2`'s `_intake.js`/`_email.js` half rather than rewritten,
so the columns, row builder, mappers, validation and email are byte-identical to
what shipped on 1 Aug. The tombstone section below is kept for the reasoning; it
describes the removal, not the current state.

**The page is `Club.dc.html`, served at `/register-club`.** It is NOT the old
homepage modal: that stayed deleted, and a test asserts the club form has not
crept back onto the public page.

### The `/organizer` Clubs tab — declared vs registered (4 Aug 2026)

The seventh tab, and the reason declarations exist at all. One row per club:
declared total, registered total, a **Short / Over / On track** badge, and the
contact. Expand a row for the per-age-group breakdown, mismatching rows tinted.
A "Show only clubs to chase" filter, and the flagged count on the tab button
itself so it is visible without opening the tab.

⚠️ **THE JOIN IS FREE TEXT TYPED BY TWO DIFFERENT PEOPLE, MONTHS APART.** The
club contact types the club name once on the declaration; a coach types it again
on every team registration. **There is no club id anywhere in the system.** So
`normaliseClubName()` in `Organizer.dc.html` lowercases, folds accents, removes
apostrophes, turns other punctuation into spaces, collapses whitespace, and
strips ONE trailing club-type suffix.

**Each of those rules exists because of a specific pair of names, and two were
found by the test rather than by inspection:**

- Apostrophes are **removed**, not spaced — or `St George's` becomes
  `st george s` and stops matching `St Georges`.
- Other punctuation becomes a **space** — or `St.Georges` collapses to one word
  while `St Georges` stays two.
- The suffix strip is **anchored to the end** and runs once. A blanket strip
  would turn `RC Sharks` into `Sharks` and merge two real clubs. ⚠️ **An eager
  normaliser is worse than a lazy one**: a wrong match produces a plausible
  number nobody questions, where a missed match shows up in the
  "registered but never declared" panel and is visible.

⚠️ **That panel is half the answer, not a leftover.** A club that registers
without declaring is invisible to a declared-clubs-only view — and it is also
where a failed name match lands, so a bad match reads as an odd row rather than
as a club that silently under-registered.

**Other decisions worth not re-litigating:**

- Over-registration flags too (Jay, 4 Aug). More teams than planned still
  changes pools, pitches and the draw.
- Blank, `0` and rubbish in a declaration box all mean "none declared". The club
  form says "leave a group blank if you are not entering it".
- Only age groups with something on either side are listed under a club —
  fifteen rows of `0 / 0` is noise.
- The age-group join goes through `MANAGER_AGE_GROUPS` (the teams sheet stores
  the display NAME, a declaration stores the ID), never a second mapping. An
  unrecognised name still counts towards the club total so a team cannot vanish.
- ⚠️ **`get-registrations.js` reads the clubs sheet FAIL-SOFT**, alone among the
  three. Declarations are a planning nicety; teams and players are the
  tournament. A missing `GOOGLE_SHEET_ID_CLUBS` must not cost an organiser their
  Teams table. `clubsUnavailable` tells that apart from "nobody has declared
  yet" — the loading-vs-empty trap, one level down.

`tests/test-organizer-clubs.js` drives the real component (113 checks), sweeps
the name pairs BOTH ways, and sweeps all fifteen age groups. Thirteen faults.

### ⚠️ THE CLUB FORM IS EXEMPT FROM THE REGISTRATION WINDOW (4 Aug 2026)

**A declaration is not an entry.** It is *"we expect to bring three U12 teams"*,
collected WEEKS BEFORE registration opens so pools, the draw and pitch
allocation can be planned. Registration opens **8 October**. Gated behind the
window, the silent link could not be used until the exact moment it stopped
being useful — by October the teams themselves are registering and the planning
numbers are moot.

**It rode in by accident, not by decision.** The club form was deliberately
routed through the same gateway with no adapter change, which was right for the
rate limit, the honeypot, the length caps and the no-values-in-logs rule — and
the window came along with them. Nobody asked. It shipped on 1 Aug, survived a
removal and a restoration, and was found the first time Jay actually tried the
link on 4 Aug. **The feature could never have worked as intended.**

⚠️ **This is not a hole, because the club form has a STRONGER gate and it has
already been passed by the time the window check is skipped:** `CLUB_FORM_KEY`,
at step 2b. Only somebody sent the link can reach that line, and deleting the
variable shuts the form instantly with no deploy. **The team and player forms
are public and stay gated** — widening the exemption to them would quietly open
registration for the whole tournament months early, and there is an injected
fault for exactly that, plus one for inverting it and one for folding the key
check into the exemption.

**Declarations are NOT stopped when the window closes at the far end either** —
Jay's explicit choice, 4 Aug. The key is the switch.

`test-intake.js` asserts the exemption through **every** shut state (closed
window, unreadable window, throwing `registrationState`), not just "closed" —
the window has three ways of saying no and an exemption covering one of them
would fail on the day it mattered. It also asserts the window is **not read at
all** for a declaration.

### ⚠️ UNLISTED IS NOT PROTECTED — this is the whole design

Four things keep the page out of sight, each asserted separately because they
fail independently and three of four is not hidden: nothing on adhjrt.com links
to it, it is absent from `sitemap.xml`, the page carries `noindex, nofollow`,
and **`robots.txt` deliberately does NOT name it** — a `Disallow` line would
advertise the path in a public file to exactly the people it is hidden from,
which is the obvious-looking way to do this and the wrong one.

**None of that is protection.** This repo is PUBLIC and its root is the deployed
site, so `netlify.toml`'s rewrite and the filename are visible to anyone reading
the source — and the site-wide Netlify password is now OFF, so there is no
second layer. What actually guards it is a secret that is not in the repo:

**`CLUB_FORM_KEY`, an environment variable, checked SERVER-SIDE** in
`_intake.js`'s `clubKeyOk()`. The page carries it in the query string
(`/register-club?k=…`) and hands it back with the submission. A page that hid
itself in JavaScript would be fully visible in view-source; a client-side
restriction is not a restriction.

- **Checked at step 2b of `handleSubmission`** — after the allow-list has said
  which form this is, and BEFORE validation, the window, the numbering, the
  sheet and the email. A caller without the key must not be able to make us do
  that work. Faults cover removing it and moving it below the write.
- ⚠️ **FAILS CLOSED.** An absent variable refuses every club submission. That is
  the safe default while the page is live and un-keyed, and it is Jay's off
  switch — deleting the variable closes the form with no deploy, exactly as
  deleting `ORGANIZER_INVITE_CODE` closed organiser signup. **Contrast the rate
  limiter, which fails OPEN**; making these consistent would be a mistake, and
  has its own fault.
- ⚠️ **ONLY the club form is gated.** Widening it to every form would shut
  registration for every club in the tournament — the loudest possible failure
  and exactly the kind of consistency tidy-up that looks harmless in a diff.
  Asserted with the variable UNSET, so a leaked gate cannot pass by having a key
  lying around.
- ⚠️ **The key rides BESIDE `data`, never inside it** — a top-level property of
  the request body next to `form`. So it can never become a sheet column, the
  same guarantee `team-code` gets by being absent from the allow-list. A key
  smuggled *inside* `data` authorises nothing.
- **Never logged**, and a wrong key and an unset variable return the identical
  sentence — those are the same answer to whoever is asking.
- Guessing is bounded by the rate limit at step 1: twenty attempts per address
  per hour against a random key.

**The page's fifteen age groups are a second copy** of `_agegroups.js`'s list,
for the same no-build-step reason `DEFAULT_VENUE` is duplicated — the page
imports nothing. `test-intake.js` compares them both ways and asserts the order,
so a sixteenth group fails loudly rather than quietly offering fifteen boxes.

**What is still NOT built: the `/organizer` Clubs tab.** Declarations are
readable in the Google Sheet only. Deferred deliberately on 3 Aug — with no real
registrations until October it would show "declared 3, registered 0" for every
club — and recorded in `claude/parked-requests.md` with the reasoning.

## Club-level registration was REMOVED (2 August 2026) — superseded, kept for the reasoning

**Jay asked for the "Register your club" feature to be removed entirely**, and
it was — the button, the modal, the whole `club-registration` form. It had
shipped on 1 Aug (`1cdc521`), was live on `adhjrt.com`, and never worked,
because `GOOGLE_SHEET_ID_CLUBS` was never set.

Removed from all four files that referenced it: the button and modal in
`Quins JRT.dc.html`; `CLUB_COLUMNS`, `CLUB_OUT`, `CLUB_RANGE`, `clubRow`,
`mapClubRow`, `clubCountKey`, `MAX_TEAMS_PER_GROUP`, the `FORMS` entry, the
validation branch and the `handleSubmission` branch in `_intake.js`;
`clubEmail()` and its dispatch in `_email.js` (along with the `AGE_GROUPS`
import that then had no other caller); and the club assertions in
`test-intake.js`.

⚠️ **`club-registration` is now an UNKNOWN FORM, and that is the real guarantee.**
`cleanSubmission()` returns `null` for it, so the gateway refuses it before
anything else — there is no half-removed path where the button is gone but the
endpoint still accepts a POST. `test-intake.js` asserts exactly that, and
asserts `FORMS` holds exactly the two remaining forms, hardcoded, so a third
arriving unnoticed fails.

**What was deliberately NOT touched:** the `club` FIELD on the team and player
forms (a registration names its club — unrelated), and the Teams/Players
grouping-by-club in `/organizer`.

**Two inert leftovers outside the repo**, harmless and Jay's to clear whenever:
a Google Sheet called *Club Registrations*, and `GOOGLE_SHEET_ID_CLUBS` in
Netlify. Nothing reads either any more.

⚠️ **A related design exists and is PARKED, not pending** —
`claude/specs/spec-club-manager-page.md`, a Google-login club page on branch
`club-manager-page`. Jay decided against it the same day. Do not raise it and
do not treat this removal as a step towards it.

## Netlify Forms is GONE (28 July 2026)

Registrations do not touch Netlify Forms at any point any more. `POST` goes
straight to `/.netlify/functions/submit-registration`, which validates, writes
the sheet row and sends the confirmation itself.

**Deleted:** `netlify-forms.html` (the hidden decoy that registered the two
forms with Netlify's build-time crawler) and `netlify/functions/submission-created.js`
(the webhook Netlify called after each submission). Nothing posts to Forms, so
the webhook could never fire again, and a second untested write path into a
sheet of children's data is worse than none.

**The Forms feature is still switched on in Netlify.** It costs nothing and no
form is registered any more, so it does nothing. Turning it off is a separate,
reversible decision.

⚠️ **If you ever need to go back**, both files are in git history at `577b7fe`.
But read `claude/plans/plan-submission-gateway.md` first — going back means giving up
the age checks, the squad cap, the registration window and the rate limit, all
of which only exist because our code is the front door.

### ⚠️ Nothing tested these functions until 28 July 2026

`tests/test-functions-load.js` loads **and calls** every file in
`netlify/functions/`. It is the only test that executes them at all. It exists
because of a bug that reached production.

**What happened.** Extracting the Google client into `_sheets.js` sliced a range
out of `get-registrations.js` that also contained `require('./_auth')` and the
whole of `readRows()`. The file still parsed. `node --check` passed. All 1,526
checks passed — because every check on that file asserted what it must **not**
contain ("no copy of `getAuth()`") and **nothing asserted what it needs**. It
deployed, and the organiser's Teams and Players tabs went blank.

**A missing require is a ReferenceError at CALL time, not at parse time.** The
handler's own catch turned it into a 500, and a 500 looks to a user exactly like
"there is no data".

- The three packages a fresh clone lacks (`googleapis`, `@netlify/blobs`,
  `bcryptjs`) are **stubbed**, and the stubs answer plausibly rather than
  throwing — a throwing stub would turn every authenticated call into a 500 and
  hide the very faults this file catches.
- It calls every handler **signed out** (expecting 401/403/405, never 500) and
  the readers **signed in**, with a real token minted by the same `sign()` the
  login functions use.
- ⚠️ **The signed-in half is not optional.** Renaming a function the handler
  calls was NOT caught by any unauthenticated check — a 401 comes back long
  before the call is reached. Everything behind the auth check is invisible
  until something logs in.
- `submission-created.js` is the one exemption from the no-500 rule: it is a
  Forms webhook, not an HTTP endpoint, and a 500 on a bogus body is correct —
  it is what makes Netlify retry.

**The lesson, stated plainly: asserting the absence of things is not a test.**
Every text-based check in this repo that says a file does not contain something
should be paired with one that runs it.

### The page posts to us now (added 28 Jul 2026)

`postRegistration(form, data)` in `Quins JRT.dc.html` posts JSON to
`/.netlify/functions/submit-registration`. It used to POST to `/`, where
Netlify Forms caught it before any of our code ran — which is why there was
nowhere to stand and refuse one.

⚠️ **A REFUSAL AND A NETWORK FAILURE ARE DIFFERENT AND MUST STAY DIFFERENT.**

| | means | so the page |
|---|---|---|
| refusal | we received it and it is wrong | shows **the server's own sentence** and keeps the form |
| network failure | we do not know whether we received it | says try again, and keeps the form |

Telling a coach to check their connection when the real answer is "that squad
is one player over" sends them round in circles for ever. `SubmitError` carries
`isNetwork` so the two can never be collapsed.

- A reply that will not parse as JSON is a **network failure**, not a refusal —
  something answered instead of our function: a proxy, a captive portal, the
  platform password page.
- `ok: false` inside a **200** is still a refusal. Reading only `res.ok` would
  miss it; the old code read nothing at all.
- The client-side checks still run first. They are not redundant — instant
  feedback, no round trip — and the server is the authority, not the
  replacement.
- The success screen now shows the **team code**. A coach used to learn it only
  from the confirmation email.
- `encodeFormData()` and every `'form-name'` field are **gone**. Netlify Forms
  is no longer addressed from the page at all.

⚠️ **An old check anchored on `'form-name'` and had to move.** It asserted the
page submitted the form names `_intake.js` knows — by looking for the Netlify
Forms field. That field no longer exists, so the check broke, and the
fault-run's baseline caught it. That baseline exists for exactly this.

### The gateway function, and _sheets.js (added 28 Jul 2026)

`netlify/functions/submit-registration.js` is the front door. It builds the real
Google client, mailer and blob store, hands them to `handleSubmission()`, and
turns the answer into an HTTP response. **It contains no decisions.**

⚠️ **It cannot be loaded by a test** — it requires `googleapis`, and a fresh
clone has no `node_modules`. That is exactly why it must stay thin: a rule added
there is a rule nothing can check. `test-intake.js` asserts the split holds
(no `validateSubmission`, no `teamRow`, no column list), not what the file does.

- **POST only**, body capped at 64 KB **before** the parse.
- The rate-limit bucket comes from `x-nf-client-connection-ip` — Netlify's own
  header. **Never `x-forwarded-for`**, which is caller-supplied and would let
  anyone pick their own bucket.
- No CORS header. Same origin only. Every reply `no-store`.
- `valueInputOption: 'RAW'`, never `USER_ENTERED` — asserted here as well as in
  `submission-created.js`.
- A failed write parks the submission at `config`/`failed-submissions/<stamp>`.
  ⚠️ **That blob holds children's personal data.** Do not widen access to the
  `config` store, do not expose it, and clear it once entries are replayed.

`netlify/functions/_sheets.js` holds `privateKey()`, `getAuth()`,
`getReadAuth()` and `firstSheetName()`. Those were written out **three times**
and the gateway would have made it four — and the private-key repair is the kind
of thing you fix once, at 2am, and must never fix again in a copy somebody
forgot about. The two dashboard readers now use a **read-only** scope, so a bug
in a reader cannot write to a sheet full of children's data.

⚠️ **A check on a constant is not a check on the guard.** The body-size test
first looked for `MAX_BODY_BYTES` appearing before `JSON.parse` — which the
`const` declaration at the top satisfies by itself, so deleting the actual size
check passed. It asserts `Buffer.byteLength(` before `JSON.parse` now.

### The submission flow (added 28 Jul 2026)

`handleSubmission(body, deps)` in `_intake.js`. Every dependency is injected —
not for tidiness, but because a fresh clone has no `node_modules`, so anything
requiring `googleapis` cannot be loaded by a test at all. `submit-registration.js`
is a thin adapter that builds the real clients and calls this.

**The order is the design**, and most of the injected faults leave every
individual rule working perfectly while still breaking the whole:

1. **Rate limit** — first, because it is the only thing between a public
   endpoint and unbounded sheet writes and emails. Fails OPEN.
2. **Allow-list** — an unknown form refused before anything else.
3. **Validation**, which also answers the honeypot. A filled honeypot returns a
   reply **byte-identical to a real success** and stops here, so a bot cannot
   even make us read a blob, and gets nothing to learn from.
4. **The registration window** — sub-project 3's remaining "three lines".
   ⚠️ **Fails CLOSED**, unlike the rate limiter: there, allowing costs nothing;
   here, allowing means taking entries after the squads were meant to be fixed.
5. **Team code** — a failed numbering read costs the tidy number, never the
   registration.
6. **The row.** On failure: park the submission for replay, return 500, and send
   **no email** — a confirmation for something not in the sheet is worse than
   none, because the coach stops chasing it.
7. **The confirmation**, after the row and swallowed. A mail failure must never
   cost a registration or make anyone resubmit into a duplicate row.

`handleSubmission` **never rejects** — asserted against every dependency
throwing. A rejection behind a public handler is a 500 with no explanation.

⚠️ **No field VALUE may reach a log.** Asserted with a sentinel in every
free-text field, down every path including the failures. Dropped field NAMES are
logged; values never are.

⚠️ **A sentinel test can be poisoned into uselessness.** The first version put
the sentinel in *every* field including `age-group` and `consent` — which made
every submission fail validation, so it never reached the write, the mailer or
the parking. It passed against a fault that logged the entire submission as
JSON. It now poisons only free-text fields and asserts the poisoned submission
still returns 200 before relying on it.

### Rate limiting (added 28 Jul 2026)

`netlify/functions/_ratelimit.js`. **Twenty submissions per address per hour**,
counted in a blob under `ratelimit/<address>`.

The biggest squad in the tournament is 18, so a club secretary entering a whole
age group by hand is the legitimate heavy user; twenty is comfortably past that
and far short of anything useful to an abuser.

- ⚠️ **IT FAILS OPEN.** If the counter cannot be read or written, the submission
  is **allowed**. Losing a real registration because a blob read hiccupped is far
  worse than the abuse it would have prevented, and the site password is still in
  front of all of this. Deliberate, asserted, and not to be quietly reversed.
- **Fixed window, not sliding** — anchored to the FIRST hit in the hour. A
  sliding window means continuous traffic never lets the hour elapse, so an
  address stays blocked for as long as it keeps trying.
- A missing address collapses to **one shared bucket**, never a skip. Skipping
  would make "send no address header" the way round the limit.
- The address comes from a request header, so the key is **sanitised** — a
  header containing a slash must not be able to write to a key of its choosing
  in a store that also holds the venue layout and the registration window.
- A window stamped in the **future** is treated as stale. Clock skew between
  instances must not lock somebody out for longer than the window.

### Signup attempts are rate limited too (added 3 Aug 2026)

`SIGNUP_RATE_OPTS` / `checkSignupRate()` / `tooManyResponse()` in
`_ratelimit.js`. **Ten attempts per address per 15 minutes, in ONE
`${ip}:signup` bucket shared by `organizer-signup.js`, `manager-signup.js` and
`google-auth.js`'s signup branch.**

**Why it exists:** all three check an invite code with a plain string compare
and none of them counted attempts, so `ORGANIZER_INVITE_CODE` took unlimited
guesses from an anonymous POST — and an organiser account reads every
registrant's name, date of birth and medical notes. The site-wide Netlify
password hid this; that comes off about 20 days before the tournament.

- **ONE bucket across all three**, same argument as `:login` — three endpoints
  guessing the same secrets with a budget each is one budget three times over.
  Kept separate from `:login` (someone mistyping a password must not eat a new
  manager's signup budget) and from the registration bucket.
- ⚠️ **In `google-auth.js` the check sits on the SIGNUP branch, below the
  `if (!inviteCode)` return — NOT at the top of the handler.** Above that line
  the request is a Google SIGN-IN, and rate-limiting those would lock managers
  out of a venue where fifteen of them share one wifi address on tournament
  morning. Moving it up is the tidy-up that looks harmless; there is a fault
  for exactly that.
- Fails **OPEN**, like every other use of this module, and whoever does get
  through still lands PENDING and needs an organiser's approval.
- `tooManyResponse()` is the single copy of the 429 sentence — `login.js` uses
  it too, so the four endpoints cannot drift apart on the wording.
- `tests/test-signup-ratelimit.js` DRIVES all three handlers; seven faults.

**The cheaper half of this was not code, and it is DONE:**
`ORGANIZER_INVITE_CODE` was deleted in Netlify on 3 Aug 2026, so organiser
self-signup is closed outright and the rate limit is defence in depth there.
It still does real work on the manager codes, which stay. See Accounts above.

⚠️ **The severity of this was overstated when it shipped, and the record should
say so.** A self-signed-up organiser lands `approved: false` (the auto-approve
only fires when NO organiser exists), and `login.js` refuses a pending account
with a 403 — so guessing the code never yielded access to anyone's data. It
yielded a pending account awaiting an organiser's approval. The real risks were
account-spam filling the store, a plausible pending account being approved by
mistake, and the bootstrap if the store were ever emptied. Worth fixing; not
the emergency the commit message described.

⚠️ **Twenty hits at the same instant cannot tell a fixed window from a sliding
one.** The first rollover test did exactly that and missed a fault that pushed
the window start forward on every write. The check that catches it spreads the
hits out and asserts the window still starts at the first.

### Validation (added 28 Jul 2026)

`validateSubmission(form, clean)` in `_intake.js`. **No new rules** — every one
is already applied in the browser. What is new is that the browser was the ONLY
place they were applied, so anyone editing the page could register a squad of
any size for a contact age grade. The roster's dates of birth are checked here
too, as of sub-project 2 — see "Age validation on the roster" below.

**The wording is copied character for character** from `submitTeam()` and
`_playerFormError()`, and `test-intake.js` reads both out of the page and fails
if either moves. Same reason as `test-venue-panel.js`: two hand-written copies
of one rule always drift, and when they do a coach either gets a refusal the
page never warned about or the page blocks something the server would have taken.

- ⚠️ **`age-group` is required on the TEAM form and NOT on the player form.**
  That is not an oversight — `_playerFormError()` does not ask for it and
  `emptyPlayerForm()` starts it blank, so the browser accepts a player without
  one. A rule the coach was never shown is a rule that looks like a bug. (Worth
  raising with Jay as a gap in the *form*, not in this code.)
- Consent must be the exact string `'Yes'`. `'true'`, `'on'`, `'yes'` are a
  client we did not write, and treating them as agreement records consent
  nobody gave.
- **The honeypot is accepted, not refused**, and checked FIRST. A bot told "no"
  tries again with the field blank; a bot told "thank you" goes away. Checking
  it first also stops a bot filling it and reading the validation rules back out
  of the error messages.
- A squad list that is not a JSON array is a broken client, not a coach mistake,
  and says so differently — telling a coach to fix a list the page mangled sends
  them round in circles.

⚠️ **A rule that cannot fire is worse than no rule.** A flat `MAX_ROSTER` of 30
sat in the cap check and was dead: `age-group` is required and an unrecognised
one is refused first, so the cap applied is always a real group's, and the
largest is 18. Deleting the branch changed no test — which is how it was found.
The test now asserts the invariant that actually holds: every group's cap is
enforced at its own number, checked across all fifteen.

⚠️ **A no-op is not a fault.** The first version of the range fault hardcoded
`A:N` — which is the correct answer today, so nothing changed and nothing was
caught, correctly. The real mistake is adding a column *and* leaving the range
behind; the fault had to do both before it meant anything.

## Age groups, server side (added 28 Jul 2026)

`netlify/functions/_agegroups.js` carries the fifteen age groups — id, name,
`ages` at the UAERF cut-off, format, `squad` cap. It is a **second copy** of
`AGE_GROUP_INFO` in `Quins JRT.dc.html`, for the same no-build-step reason
`DEFAULT_VENUE` is duplicated. `test-agegroups.js` compares them deep-equal.

**Why it exists: the squad cap has never been enforced.** `_squadCap()` runs in
the browser only, so anyone editing the page could register a squad of any size
and nothing downstream noticed. The submission gateway (sub-project 1,
`claude/plans/plan-submission-gateway.md`) is the first thing that will check it
server-side.

- `squadCap(name)` matches the group name **exactly** and falls back to
  `MAX_SQUAD_ANY_GROUP` (18) when it does not recognise it — same rule as the
  client, so a roster typed before a group is chosen is never refused. The
  fallback can only ever be *more* permissive than the real cap.
- ⚠️ **Do not "tidy" the caps.** All four girls' groups play 7s with a squad of
  12, including U16G and U18G, which is why they differ from the boys' groups of
  the same age. They are not derivable from a rule.
- The ids must match the ones `DEFAULT_VENUE` keys its `groups` object on — a
  drift there silently detaches a registration from the day it plays.
  `test-agegroups.js` asserts that too.

### Age validation on the roster (added 28 Jul 2026 — sub-project 2)

**The team registration form never checked a player's date of birth against
the age group they were entered into.** All the age logic lived on the
*player* form only (`_playerAgeCheck()`); a coach entering a whole squad at
once had no check at all. Design decisions:
`claude/specs/spec-age-validation.md`; the plan: `claude/plans/plan-age-validation.md`.

**No new rule — the existing one, reused.** `_agegroups.js` now carries a
server copy of the same rule `_playerAgeCheck()` already runs on the player
form: `PREV_GROUP_ID`, `AGE_GRADE_CUTOFF_DATE`, `calcAge()` and `fmtAges()` are
copied character for character, and `ageGroupCheck(dob, groupName)` is the
server's version of the check. `test-agegroups.js` compares `PREV_GROUP_ID`
against the client's copy the same way it already compared `AGE_GROUP_INFO`,
and sweeps the boundary — one year either side of every group's band, for all
fifteen groups, not one example.

⚠️ **A different algorithm that happens to agree today is not good enough.**
`calcAge()` stays a literal `Date`-based copy rather than being rewritten as
"safer" string arithmetic — a different implementation is one more thing that
can drift from the client with no test able to see it. It is timezone-safe as
written: it never round-trips through UTC, unlike the registration window's
dates (see below), so whatever timezone the runtime is in, the calendar day it
reads back out is the one that was typed in.

**Exactly one age group young is a PLAY-UP, allowed through, not blocked.** On
the player form this is gated on a parent ticking a consent box. A coach
entering a whole squad cannot tick that box on a parent's behalf, so a play-up
roster row is simply flagged — client side in amber under the row, nothing
gated on it — and lets the squad submit. **Anything worse (two groups out, or
too old) is a hard block**, both client and server side, same rule the player
form has always had. Nothing is written to the sheet for the flag: it is
derivable later from the stored `dob` and the team's stored `age-group`, so it
needs no column of its own. Where it eventually surfaces in `/organizer` is
still an open question, tied to the separate "squad list is invisible in
`/organizer`" question — see `claude/state-of-play.md`.

**A named roster row with no date of birth blocks the whole squad.**
Confirmed with Jay, 28 Jul 2026, both client and server side — the same
requirement the player form has always had for `dob`. The alternative (let it
through unchecked) would mean a coach could leave every date of birth blank and
this project would check nothing. A row nobody has touched (both names blank)
is never inspected at all — every roster starts with several blank rows and
none of them may block a submission on their own.

**The roster's date of birth input changed to three dropdowns**, matching the
player form, via the same `composeDob()` — not a second date-composition
function. The team form's roster rows used to be a native `<input
type="date">`; see "Date of birth is stored as `yyyy-mm-dd`" above for why the
player form never used one, and the same trap (`31 February` silently rolling
forward to `3 March`) applied here too.

⚠️ **A test whose two possible answers are the same number proves nothing.** The
first version of the case-sensitivity check used U16B, whose cap (18) is also the
unknown-group fallback (18) — so a lookup made case-insensitive returned the same
answer either way and the check passed on the fault. It uses U16G (12) now. Only
injecting the fault found it.

### The wide (two-year) girls' play-up allowance (added 28 Jul 2026)

**Real registration found a real gap.** A parent tried to register a genuine
12-year-old girl (Mike Yohotu, DOB 1 Sep 2013) for U14G QR (age 13) and was
blocked outright. U14G QR's one-hop `PREV_GROUP_ID` chain points at U12G QR,
which is age **11** — there is no girls-specific group at age 12 at all, so a
real 12-year-old falls straight through the gap the one-hop chain assumes
doesn't exist.

**Decision (Jay, 28 Jul 2026):** all four girls' groups — `u12g` (U12G QR),
`u14g` (U14G QR), `u16g` (U16G Contact), `u18g` (U18G Contact) —
`TWO_YEAR_PLAYUP_GROUP_IDS` in both copies — now allow play-up **up to two age
groups young**, not one, and the basis is **plain arithmetic on the group's
lowest age**, not the `PREV_GROUP_ID` chain. Every other group is unaffected
and still uses the one-hop chain exactly as before.

⚠️ **U16G and U18G are Contact (tackle), not Quick Rip like U12G/U14G.**
Extending a two-year-younger tolerance to a contact age grade is a materially
different injury/age-grade-safety call than doing so for non-contact QR — Jay
chose to include all four explicitly, not just the two literally named "QR".

**Mechanism is unchanged — same flag, same consent checkbox, same submit-time
gate.** This is not a new feature, just a wider version of the existing one:
`ageGroupCheck()` / `_playerAgeCheck()` still return
`{status: 'ok'|'playUp'|'blocked'}`, a `playUp` roster row is still flagged,
not gated, and a `playUp` on the standalone player form still requires the
same `playUpConsent` checkbox before it can submit. The wording of the
checkbox and the client's generic "please consent" message were both
loosened from "one age group" to a neutral "as described above" /
"before submitting", since the specific message above it now correctly says
either one or two groups.

**The confirmation email now says so.** `playerEmail()` in `_email.js` reads
`d['play-up-consent']` (already collected, previously never rendered) and, when
`'Yes'`, suffixes the Age group row with `(playing up)` and adds a sentence to
the closing paragraph naming the player and crediting parent/guardian consent.
Team registration emails are unaffected — a coach's whole-squad play-up flag
is not something a team email can attribute to any one parent's consent.
`tests/test-email.js` is the first test file to actually render these
templates rather than mocking `sendConfirmation()` out whole.

## The Teams/Players tables are grouped by club and age group (added 28 Jul 2026)

**Jay asked whether filtering `/organizer`'s Teams or Players tab by one age
group groups the results per club, and whether filtering by one club groups
its results per age group.** Before this, neither: `_filteredTeams()` and
`_filteredPlayers()` in `Organizer.dc.html` only filtered — rows kept
whatever order they arrived from the sheet in, i.e. submission order, so two
entries from the same club would only land next to each other by
coincidence.

**One compound sort answers both questions.** Every row is now sorted by
`byClubThenAgeGroup()` — club name first (case-insensitive), then the
group's real youngest-to-oldest band, then `submittedAt` as a stable
tiebreak. Filtering to one age group makes the age-group key a constant
across every visible row, so the club key is what actually orders them:
clubs land grouped. Filtering to one club makes the club key the constant,
so the age-group key orders them instead: that club's age groups land
grouped, youngest first. No separate code path exists for either direction —
it is the same two-key sort in both cases, because whichever filter is
active is what turns its own key into a no-op.

⚠️ **The age-group band is NOT alphabetical.** `AGE_GROUP_ORDER` maps each
group's name (as the sheet stores it, e.g. `"U12G QR"`) to its position in
`MANAGER_AGE_GROUPS`, which is already in real age order. A plain string sort
would put `"U12G QR"` after `"U18B Contact"` (`'1'` == `'1'`, then `'2'` vs
`'8'`) — wrong, since 12 is younger than 18. An unrecognised group name sorts
last rather than throwing.

**`exportCsv()` reads through the same two filtered methods**, so the CSV
export is grouped identically to what's on screen — one code path, not two
that could disagree.

`tests/test-organizer-grouping.js` drives the real component (`build()`,
same pattern as `test-venue-map.js`) with fixtures whose submission order
deliberately disagrees with both the club-alphabetical and age-band order,
so a fault that quietly left sheet order untouched, or that only partially
sorted, could not pass by coincidence.

**A sorted list is not a visibly grouped one (added 28 Jul 2026).** Jay
looked at three players from two clubs, correctly sorted, and could not tell
they were grouped — a sort with no visual break looks identical to sheet
order at a glance. `groupRowsByClub()` turns the already-sorted flat list
into `[{ club, count, rows }, ...]` — one entry per club, in the order the
club first appears — and `renderVals()` hands this as `teamGroups`/
`playerGroups` instead of `teamRows`/`playerRows`. The template renders a
highlighted sub-header row (`CLUB NAME (n)`, spanning all 12 columns) before
each club's block, via a nested `<sc-for>` (outer over the groups, inner over
`g.rows`) — the same nested-list pattern `Scores & Standings.dc.html` already
uses for pools. `teamRows`/`playerRows` themselves are unchanged and still
feed `exportCsv()`, so the CSV stays a plain sorted list without header rows
mixed into the data — the sub-header is a display-only concern.

⚠️ **Group boundaries are detected by "club changed since the previous row",
not by a first pass over the whole list.** This only works because the input
is already sorted by `byClubThenAgeGroup()` — `groupRowsByClub()` does not
itself sort anything, it just chunks an already-grouped list. If it were ever
called on unsorted rows, the same club appearing twice non-consecutively
would produce two separate header blocks instead of one.

**CSV export was turning phone numbers into formulas (added 28 Jul 2026).**
Jay reported phone numbers showing up as equations when he opened the
exported CSV in Excel/Sheets. Every stored phone number starts with `+`
(e.g. `+971569135186`), and both Excel and Google Sheets read a CSV cell
starting with `=`, `+`, `-`, or `@` as the start of a formula, not literal
text. `Component.csvSafe()` prefixes any such cell with a leading apostrophe
before it goes into the CSV — Excel/Sheets hide that apostrophe on display
but treat the cell as forced text, so the number reads normally instead of
evaluating (or erroring) as a formula. Applied to every cell in `exportCsv()`,
not just the phone columns, since name/notes fields are free text a coach or
parent could type anything into.

**Squad list — Teams table "click to expand" (added 28 Jul 2026).** A coach's
roster **was already being saved** — `players`, column M of the Teams sheet,
a raw JSON string of everyone typed into the registration form — but nothing
in `Organizer.dc.html` ever read it. The Teams table showed only the number
typed into "# Players"; Jay had no way to see who was actually on a squad
without opening the sheet directly. Jay was offered three options (a count
with names only in the CSV; names in the table behind a click-to-expand; all
names crammed into one cell) and picked click-to-expand.

No backend change was needed — `r.players` was already flowing through
untouched on every team row returned by `_intake.js`'s `mapTeamRow()`.
Everything here is client-side:

- `Component.parseRoster(playersJson)` (static, next to `csvSafe()`) turns the
  raw JSON into `[{ name, dob }]`. Deliberately defensive: wrapped in
  try/catch and checks `Array.isArray()` before mapping, because one
  hand-typed or historical row with a malformed `players` cell must not throw
  and take down the whole Teams table — it should just show an empty roster
  for that one team. A roster entry with no name still shows as `(no name)`
  rather than vanishing silently; a missing `dob` shows `—`.
- `state.expandedTeam` holds the **team code** (`r.teamName` — despite the
  name this is the generated code like `ADH1`, not a free-text field, so it's
  safe as a unique key) of whichever team's row is currently expanded, or
  `''` if none are. Only one team can be expanded at a time.
- `toggleTeamExpand(teamName)` flips `expandedTeam` between that team's code
  and `''` — this is a genuine toggle, not a one-way "open": clicking an
  already-open team's button closes it again.
- `renderVals()`'s `teamRows` mapping now also computes, per row: `roster`,
  `rosterCount`, `hasRoster` (only teams with a non-empty roster get a
  clickable toggle — no dead click target on an empty count), `isExpanded`,
  `toggleLabel` (▼/▲), and `onToggleRoster` (a closure over that row's team
  code).
- The template turns the "# Players" cell into a button (only when
  `hasRoster`) and adds a conditional detail `<tr>` directly below the data
  row, rendered only when that row's `isExpanded` is true, listing every
  roster entry as `Name (dob)`.

⚠️ **This is deliberately scoped to display only.** The registration form
(`Quins JRT.dc.html`) already has a client-side per-player play-up/age check
(`_rosterPlayerAgeCheck()`) that runs when a coach builds a roster — surfacing
*that* flag inside the Organizer roster view (e.g. highlighting a player who
was allowed to play up) is a separate, materially larger piece of work
(reusing/duplicating that age-check logic here) that was intentionally left
for a later decision, not built silently alongside this.

## Venue — pitches and days (added 26 Jul 2026)

**Which day an age group plays is derived from where it has pitches.** It is not
a separate list, and it must never become one again.

The layout is `DEFAULT_VENUE`: for each of the two days, a `date`, a `label`, a
`splits` object saying how each main pitch is cut up that day, the derived list of
playing surfaces in `pitches`, and `groups` mapping each age group to the surfaces
it is allowed to use. An age group is on Saturday because Saturday is where it has
pitches — so the day and the pitch allocation cannot contradict each other.

**`splits` is the input; `pitches` is output.** See "Main pitches and splits"
below before touching either.

Read off `Pitch maps_Final.pdf` (Sat 25 / Sun 26 Oct 2025), confirmed by Jay on
26 Jul 2026 as the same running order for 2026:

| | Pitches | Groups |
|---|---|---|
| **Saturday** | 18 — D5A/B, D4A/B, D3A/B, D2, D1, C4, C5, B1A–D, A1A–D | u6, u7, u8, u9, u10, u11, u12, u18b, u18g |
| **Sunday** | 10 — D3, D2, D1, C4A/B, C5, B1A/B, A1A/B | u12g, u13, u14b, u14g, u16b, u16g |

- **D4 and D5 are time-shared on Saturday** — U5/6 in the morning, U7 in the
  afternoon. `u6` and `u7` therefore hold the *same four* pitches. This needs no
  special case: it is two pools on one pitch at different times.
- Sub-pitch letters (`B1A`–`B1D`, `D3A`/`D3B`, …) are **ours**. The map draws the
  boxes inside one outline without naming them, so these have to match whatever
  goes on the printed pitch flags.
- The homepage's PITCHES stat is **derived from the layout** (day one's
  count — 18 on this layout, with a written-down fallback of 18; see "The
  homepage PITCHES stat comes from the layout" below). Saturday runs 18
  surfaces, Sunday 10.

### Main pitches and splits (added 27 Jul 2026)

Zayed Sports City has **fifteen main pitches** and that list does not change:

```
D5 D4 D3 D2 D1  C4 C5 C3 C2 C1  B1  A1 A2 A3 A4
```

Confirmed by Jay against the site on 27 Jul 2026. **There is no B2** — the B2 on
the venue's own map is the softball diamond and is not ours. The order above is
`MAIN_PITCHES` and it is the *layout* order, not alphabetical: it is the order the
schematic draws them in, and `derivePitches()` emits surfaces in it.

Each main pitch is run **whole, in halves or in quarters, on a given day** —
`SPLITS = [1, 2, 4]`. Nothing else: thirds do not happen on a rectangle you are
marking out with cones, and a third suffix letter would break every name
downstream parses.

| stored | surfaces |
|---|---|
| `{ D2: 1 }` | `D2` — a whole pitch keeps the **bare name**, which is what makes this backwards compatible: every saved fixture on `D2` still means D2 |
| `{ D3: 2 }` | `D3A`, `D3B` |
| `{ B1: 4 }` | `B1A`, `B1B`, `B1C`, `B1D` |

**A main pitch absent from a day's `splits` is not in use that day.** Absence
rather than a `0`, because "not on the map today" and "on the map, cut into
nothing" are not two different states.

**The split is per pitch AND per day**, which is not decoration — the weekend runs
that way. D3 is halves on Saturday and whole on Sunday; C4 is the other way round.

#### The functions

Both `netlify/functions/_venue.js` and `scores-data.js` carry them (`_venue.js` for
the server, `scores-data.js` because the front end needs an answer before any
fetch lands). `organizer-data.js` **re-exports from `scores-data.js`** — there is
deliberately no third copy.

- `derivePitches(splits)` → the surface names, in `MAIN_PITCHES` order. Skips an
  illegal split rather than guessing at it.
- `splitsFromPitches(pitches)` → the other direction, for a layout saved before
  splits existed. An odd count **rounds UP**: three surfaces on one pitch is
  somebody's half-finished edit, and inventing a fourth is recoverable where
  deleting a third is not.
- `remapGroupPitches(list, oldSplits, newSplits)` → renaming caused by a split
  change.

**THE INVARIANT, and the reason this is worth a section: a group keeps the same
GROUND, only the names change.** Split a pitch a group had whole and it gets every
part — it had all of it before and it has all of it now. Merge the parts and a
group on any one of them gets the whole pitch, because there is now only one
pitch and they are on it. Get this wrong and an organiser silently loses an
allocation to a rename, which nobody notices until a team turns up at a pitch that
is not theirs. `test-venue-splits.js` asserts it as a property across **all nine**
legal transitions, not as one example.

A main pitch taken **out** of the day is the one case where a group does lose the
allocation — there is no honest place to put it — and the panel confirms first,
naming the groups affected and how many saved matches are on it.

#### On the server

`validateVenue()` treats `splits` as the source of truth and **always rebuilds
`pitches` from it**, never trusting the payload's list. If the two could disagree,
the site would read one while the panel edited the other. A payload with only
`pitches` (an older client, or a blob edited by hand) still validates, with the
splits inferred — **nothing to migrate by hand**. A split of 3, a pitch name
nobody recognises, or a group on a surface that does not exist are all refused
**by name** rather than silently dropped.

`derivePitches(DEFAULT_VENUE.dayN.splits)` reproduces both shipped `pitches`
arrays **character for character** — asserted, because if it did not, this model
would have quietly moved live fixtures.

### Where it lives, and the duplication you must respect

| Copy | Why it exists |
|---|---|
| `netlify/functions/_venue.js` | the server's answer, and what `venue-layout.js` serves |
| `scores-data.js` (`export const DEFAULT_VENUE`) | the front end's offline fallback and its answer before any fetch resolves |
| `Quins JRT.dc.html` (`AGE_GROUP_CARDS[].day`) | the public "Find your age group" cards; the page has no build step and no import of the data layer |

Three copies is not a mistake, it is the cost of having no build step. **`test-venue.js`
compares all three and fails if any drifts** — proven against three deliberately
injected errors. Change one, change them all, run the test.

### Reading it

From `scores-data.js`: `loadVenue()` once at start-up, then the synchronous
`venue()`, `dayIdOfAgeGroup()`, `dayOfAgeGroup()` (yyyy-mm-dd), `isDayOne()`,
`dayLabelOfAgeGroup(id, short)`, `pitchesForAgeGroup()` and `pitchesOnDayOf()`.
All of them answer from the built-in default until the fetch lands, so **nothing
ever waits on a config fetch and nothing is ever undefined**. A group missing from
the layout returns `null` from `dayIdOfAgeGroup()` but still gets day 1 from
`dayOfAgeGroup()` — the countdown does date arithmetic on it and a null would
render "kick-off in NaN minutes".

### What was wrong before

`app.html` had `const SATURDAY = ['u6','u7','u8','u9','u10','u11','u12','u12g']`
and the homepage cards had the same two errors. So **U12G was shown on Saturday
and U18B/U18G on Sunday — both the opposite of the truth, on the public site,
with registration open.** The array is gone. If you find yourself typing a list
of age groups next to a day, stop.

### Editing it — the Venue & days tab (added 26 Jul 2026)

`/organizer` has a fourth tab beside Teams / Players / Accounts. **Organisers
only**: which day a group plays and which pitches it owns affect every other age
group, so it is a tournament-wide decision, same reasoning as `scoring-rules.js`.
Managers are refused server-side with a 403 that explains why.

- `POST /venue-layout` `{ venue }` validates then saves to the `config` store at
  key `venue`. `{ reset: true }` **deletes** the key rather than writing the
  defaults back, so a later change to `DEFAULT_VENUE` reaches a reset site
  instead of being masked by a stale copy of the old defaults. ⚠️ **Since
  2 Aug 2026 NO page calls it** — the panel's Reset button now clears the
  working copy's pitch assignments instead (Jay's ask: days and splits kept,
  saved with the normal Save button). The server branch is kept as a
  deliberate escape hatch.
- `mergeVenue()` **replaces a day wholesale rather than merging field by field.**
  Merging pitch lists would make removing a pitch impossible, because the default
  would keep putting it back.
- `validateVenue()` is the gate. Hard errors: an age group on **both** days (a
  silent `dayIdOf()` coin-flip), on **neither** day (no date, broken countdown), a
  pitch **not on that day**, or two pitches whose names differ only by case (the
  clash check could not tell them apart). It also trims, drops blanks, and
  canonicalises a group's pitch names to the day's spelling.
- Deliberately **allowed**: an age group with an **empty** pitch list. "Which day"
  and "which pitches" are separate decisions and the day has to be settable first.
  Shown as a warning by `venueWarnings()`, not a block.
- Also deliberately allowed: **two groups on the same pitch.** D4/D5 run U6 in the
  morning and U7 in the afternoon — that is a time-share, and the Step 4 clash
  check is what will tell them apart by time.
- **The same rules run client-side** in `venueVals()`/`venueProblems()` so Save
  can be disabled with the reason shown rather than bouncing off a 400. The server
  is still the authority. `test-venue-panel.js` drives both and asserts they
  **agree** — if they diverge, either Save goes green on something the server will
  reject, or it bounces with no explanation.
- Moving a group to the other day **clears its pitch assignment**, after a confirm
  that names what is being cleared. The two days have different pitch lists and
  silently keeping names that exist on both (`B1A`, `D2`, `D1`) would put a group
  on a pitch nobody chose for it.
- **All fifteen main pitches are listed on every day card, in use or not** (Jay,
  27 Jul 2026), each with four buttons: Not used / Whole / Halves / Quarters. A
  pitch you are not using this day is a decision, and one you cannot see is one
  you cannot change.
- **There is no box to type a pitch name into any more.** `addPitch`,
  `removePitch` and `vNewPitch` are gone. That box is how `C4`, `c4` and
  `Pitch C4` became three pitches the clash check could not reconcile — a bug
  that had to be dug out of this codebase once already. Names are now derived and
  cannot be typed. `test-venue-splits.js` asserts the box has not come back.
- `setPitchSplit(dayId, main, n)` calls the **server's own** `derivePitches()` and
  `remapGroupPitches()` through `api.*`, so the panel cannot disagree with what
  will be stored.
- **Taking a pitch out** of the day confirms first, naming the groups that lose it
  and how many saved matches are on it. **Changing a split** that would strand
  saved fixtures also confirms, and says plainly that age-group allocations move
  across on their own but **fixtures do not** — `countPitchUsage()`, draft first
  and published as a fallback, because the draft is what a change here is about
  to break. Organiser-only, since drafts are not public.
- The age-group rows show surfaces **grouped by main pitch**, with one click to
  take or drop a whole pitch. With B1 and A1 both in quarters the old flat list
  was eighteen identical-looking boxes. Only pitches **in use that day** are
  offered — the rest are on "Not used" in the day card above and have no surfaces.

### A pool is a pitch's day (added 26 Jul 2026)

A pool is already a run of matches `SLOT_MINS` apart, which is what one pitch does
for a stretch of the day. So the Fixture Editor sets the pitch and the first
kick-off **once per pool** — about 40 across the weekend instead of ~430 slots —
and pushes them down onto that pool's matches.

**Nothing new is stored.** Both values are **derived from the slots**, and setting
one rewrites them. That is deliberate, and it is the thing to preserve:

- the public fixtures page, the standings and the app keep reading `slot.pitch`
  and `slot.startMins` exactly as before — **no reader changed**;
- `saveDraw()`'s allow-list needs no new field (the trap that lost `teamNames`);
- an old saved draw needs **no migration** — it displays correctly because the
  display is computed from what it already holds;
- and the pool header can never disagree with the fixtures under it, because
  there is only one copy of the fact.

`poolPitchOf()` returns the single pitch all a pool's matches share, `'TBD'` if
none, or `''` when they disagree — `''` renders as **Mixed**, which is honest
rather than picking one to show. `poolStartOf()` is the earliest match, `null` for
an empty pool. `slotLengthMins()`, `dayStartMins()` and `poolEndMins()` are
exported from `scores-data.js` so the editor's arithmetic cannot drift from the
generator's.

- Changing a pool's pitch **overwrites per-match overrides**, after a confirm
  naming the pitches involved. Changing the first kick-off re-times the run
  20 minutes apart **in the order it is already in** — a hand-reordered pool
  stays reordered.
- Moving a pool onto a pitch another pool of the same age group is already using
  **offers** to shift it to the first free time. An offer, not a rule: a manager
  may be mid-rearrangement.
- **Two pools on one pitch at different times is a time-share, not a clash** —
  that is exactly how D4/D5 ran U6 then U7. Only overlapping ranges are reported,
  and touching exactly (one ends 10:00, the next starts 10:00) is fine.
- `+ Add match slot` inherits the pool's pitch and continues its run; it used to
  default to `'TBD'` regardless, silently creating an unplaced fixture.
- `Regenerate from pool` keeps the pool's pitch and start time. It rebuilds every
  slot on `'TBD'` at 08:00, so without that a regenerate silently unplaced a pool.

**The free-text pitch list is gone.** `onAddPitch()`/`onRemovePitch()` and the
chips UI are deleted: every age group used to type its own names into
`draw.pitches`, so `C4`, `Pitch C4` and `c4` were three different pitches to
anything trying to spot a clash. The panel is now read-only — it reports the
group's pitches from the layout, which pools are on each and when (an **in-group**
clash check), and points at the Venue & days tab. `draw.pitches` is still *read* so
an older draw's pitch does not vanish; those show separately, flagged as not in the
layout.

**`test-pool-pitch.js` exists because `validate-bindings.js` cannot see any of
this.** Every new binding is `{{ pool.something }}` inside an `sc-for`, so its root
identifier is the loop variable and the validator skips it by design. That test
reads the `{{ pool.X }}` tokens out of the markup — scoped to the editor's loop,
since the public section has its own loop also named `pool` — and asserts the pool
card objects carry them. Proven against four injected faults, including a renamed
binding.

### The whole-weekend clash check (added 26 Jul 2026)

`weekendClashes(drawsByAge, ageNames)` in `scores-data.js` — **pure and
synchronous** on purpose: no fetching, no session, no clock, so it can be tested
exhaustively. `loadAllDraws(session)` does the fetching; `describeClash(c)` writes
the sentence.

It turns draws into **bookings**, of two kinds, because there are two kinds of
fixture: a **pool** is one booking covering its whole run, and each **knockout
match** is a booking of its own. Two bookings clash when they are on the same
**day** and the same **pitch** and their `[start, end)` ranges **overlap**.

Four things are deliberately NOT clashes, and each one is a test:

| | Why |
|---|---|
| anything on `TBD` or blank | unscheduled is not conflicting; reported separately as still-to-place |
| the same pitch at **different times** | that is a **time-share** — exactly how D4/D5 ran U5/6 then U7. A check that cries wolf here gets ignored. |
| the same pitch name on **different days** | `D1`, `D2`, `B1A` and `A1A` exist on both days and are unrelated fields |
| **touching exactly** — one ends 10:00, the next starts 10:00 | half-open ranges |

Three ways a booking could have escaped, all closed and all tested:

- **A per-match override.** A pool "on C4" with one match moved by hand to C5 is
  booked as *two* bookings, one per pitch, each from its own earliest match. Treated
  as one booking, the moved match would be invisible.
- **Knockout matches.** They have their own pitch and time and are not in a pool.
  A Cup Final on a pitch another group is using is a real clash.
- **Case and spacing.** `' c4 '` and `'C4'` are the same pitch. The layout keeps
  names canonical now, but a legacy `draw.pitches` name may not be.

Two soft warnings ride along: `unplaced` (no pitch yet) and `offAllocation` (on a
pitch the age group is not allocated in the layout).

**What the check can see depends on who is asking, and the panel says so.** An
organiser's token reads every group's **draft**; a manager's reads their own draft
plus everyone else's **published** draw (`get-schedule-override` falls through to
published when the token has no access). The manager's comparison is the right one —
published is what people turn up for — but **two managers editing unsaved drafts
cannot see each other**, and the UI states that rather than implying the check is
exhaustive. A group that fails to read is named, not silently dropped.

**Publishing warns, never blocks.** `onPublishDraw()` runs the check first and lists
any clash involving that age group in the confirm, with the button reading **Publish
anyway** instead of OK (`confirmModal(msg, fn, { okLabel, wide })`). If the check
itself fails, publishing is still offered — a validator that cannot run must not
become a validator that says no. On the morning of the tournament the person who
needs to move a game must not be locked out.

`isOrganizerSession()` is now **exported** and the Scores component uses it instead
of repeating the three-shape session test. There are three session shapes and this
file already records that missing one silently hid the Publish button; a second copy
was one more place for that to happen again.

### The homepage PITCHES stat comes from the layout (added 26 Jul 2026)

The headline stat used to be a literal, `Math.round(16 * sp)`, against a real
Saturday count of 18. Wrong in the one place a club is most likely to read it, and
nothing in the codebase could have noticed, because the number had no connection to
the layout that knows the answer.

`Quins JRT.dc.html` now carries `pitchCount: 18` in state as a written-down fallback
— Saturday, the busier day — and `loadFixtureData()` awaits `api.loadVenue()` and
replaces it with `venue.day1.pitches.length`. `loadVenue()` already falls back to the
layout built into `scores-data.js` when the endpoint is unreachable, so the stat is
never blank. **Change the pitches in the Venue & days back office and the homepage
number changes too, with no deploy.**

`test-venue.js` holds the fallback to the layout's day-one count and refuses a
literal in `statPitches`. If the default layout ever changes, that test tells you to
change the fallback with it.

**"Pitches A, B, C & D"** on the homepage and in `app.html` is deliberately left
alone. A, B, C and D are the real block letters at Zayed Sports City (A1x, B1x,
C4/C5, D1–D5), so that line is wayfinding, not a count.

### Dialogs in the Venue & days panel (added 26 Jul 2026)

`Organizer.dc.html` had three `window.confirm()` calls. It now has the same
`confirmModal(message, onConfirm, opts)` the Scores page uses — confirm-only, no
prompt variant — and `test-venue-panel.js` leaves `window.confirm` as a **trap that
throws**, so a handler cannot quietly go back to it.

Two things the pattern buys, beyond looking like the rest of the site: the confirm
button says what it does (`Remove pitch`, `Move to Sun`, `Reset the layout`) rather
than `OK`, and nothing reaches the server until the dialog is answered — which is why
`doResetVenue()` is now a pair, the handler that asks and `reallyResetVenue()` that
does it.

### Where each group plays — two views (added 27 Jul 2026)

At the top of the Venue & days tab, with a toggle. Both are built from the
**working copy**, so both redraw as you tick boxes further down the tab, before
anything is saved.

**SCHEMATIC** — every sub-pitch as its own labelled cell, blocks laid out in
roughly their real positions by `BLOCK_GRID`. This is the view with room for the
pitch names and the one that reads on a phone.

**MAP** — `assets/venue-map.png` with a chip per block dragged onto it.

**The map is block-level, and that line is the whole design.** The image draws
ONE outline per block — D3, C4, B1 (which is the athletics track) — with a name
and a car-park number, and it neither names nor divides what is inside them. The
layout's pitches are `D3A`/`D3B`, `C4A`/`C4B`, `B1A`..`B1D`, and **those
sub-pitch names are ours**. So a map chip names the BLOCK and the groups on it;
the individual pitches are read in the schematic. Do not put a box labelled
"B1C" on that image — nobody has decided where B1C sits.

**Where a block sits IS real knowledge, so it is dragged and stored, not
guessed.** `DEFAULT_POSITIONS` in `_venue.js` is the code's eyeballed starting
point; an organiser unlocks the map and drags each block to where it actually
is, and that replaces the guess. Percentages of the image, measured to the
block's **centre** (a corner anchor drifts when the map resizes, because the
offset and the box width scale differently). **One position per block for the
whole weekend** — D3 is the same field on Saturday and Sunday.

**Positions are stored under their OWN blob key** (`config`/`venue-positions`),
not on the venue layout, and this is not a style preference:
`validateVenue()` rebuilds each day from a known list of fields, so an extra
field riding on the layout is **silently dropped on save**. The map would have
appeared to save and then reverted. `test-venue-map.js` asserts that dropping
behaviour directly so nobody re-learns it.

- They still save together — one Save button, `venueDirty()` watches both — but
  reset separately. Putting a group on a different day has nothing to do with
  the map image, and someone fixing one must not lose the other.
- **Dragging is locked by default.** The screen is mostly read; blocks sliding
  under a mis-click would be worse than one deliberate unlock.

#### Making the chips readable (added 27 Jul 2026)

Jay: *"the labels over the map are a little difficult to read."* The cause was
not the font size. The chips were the age-group tint at **88% opacity with white
text on top**, sitting on a bright, light drawing that carries its own
white-on-green labels. So the map showed through every label — and on the
lighter tints white text was around **1.8:1**, which is not hard to read, it is
not readable.

**THE INK IS CHOSEN, NOT FIXED.** `chipInk()` uses the real WCAG relative
luminance and contrast formulas, and picks near-black or near-white by
**maximising the worst case** across every tint on the chip. A time-shared block
is a gradient of two tints with one piece of text lying across both, so
averaging would leave a chip legible on one half and not the other — U6 red plus
U7 orange is exactly that: white is 4.8:1 on the red but 2.9:1 on the orange, so
dark wins.

**AND THE FILL IS TOPPED UP WHEN IT HAS TO BE.** Even with the better ink, two
of the fifteen tints land just under 4.5:1 and a red/orange time-share lands at
3.9. Rather than accept that or hand-edit a palette shared with the schematic and
the standings, `chipFill()` nudges the chip's own fill away from the ink in 5%
steps until it clears — **only when needed** (13 of 15 tints are returned
byte-identical) and **capped at 40%**, so a colour cannot quietly become a
different colour.

`test-venue-map.js` asserts the ratio as a **property over all 120 chips the
layout can produce** — 15 groups alone plus all 105 pairs — not as a handful of
examples. That is the point: a number can be checked, "looks alright" cannot, and
"looks alright" is what shipped the problem.

⚠️ **The gamma step is load-bearing and nothing downstream notices it missing.**
Drop the sRGB conversion in `relLuminance()` and every contrast ratio still
clears 4.5, because the top-up compensates for the worse ink choice. The only
things that catch it are the direct assertion that mid-grey reads **21.6%**
rather than 50%, and the count of how many tints needed adjusting at all. A
system with a fallback will hide a fault in the thing the fallback covers for.

Also on the chip: the split, as **`×2` / `×4`** rather than the word. `QUARTERS`
spelled out made the chips wide enough to overlap each other on the drawing,
which cost more legibility than it bought. `splitLabel()` keeps the words for the
tooltip, which also lists every surface name on the block.
- `touch-action:none` on an unlocked chip, or a drag on a phone scrolls the page
  instead — which looks exactly like the feature not working.
- The chips capture the pointer on `pointerdown`, so a fast drag cannot outrun a
  small chip and drop it. The map image is `pointer-events:none` so it can never
  swallow a drag.
- `mapRect()` reads the rectangle from the DOM **at drag time**, never cached:
  the panel is responsive and a stale rectangle silently offsets every drop
  after a resize. If it cannot be measured, `pointerPct()` returns **null** and
  the drag does nothing. It must not return a fallback — see the note in
  `test-venue-map.js`, where a constant fallback passed a full end-to-end drag
  test because the grab offset cancelled it exactly.
- A block with no position (an unrecognised pitch name) goes in a **tray** beside
  the map with a button to drop it on, rather than being dumped at 0,0 where it
  would look placed.

- `blockOfPitch()` maps a pitch to its block — `D5A`→`D5`, `C4B`→`C4`,
  `D2`→`D2`. Everything up to and including the last digit; one optional
  trailing letter is the sub-pitch marker. A name with no digit becomes its own
  block rather than throwing, because the pitch box upstairs is free text.
- `BLOCK_GRID` is the **only** stored geometry, and it only says roughly which
  row and column a block sits in. A block it does not know is still drawn, in
  rows underneath. `test-venue-map.js` asserts every block in the shipped layout
  is one it knows, so the table cannot silently fall behind.
- **Two groups on one pitch is drawn as a TIME-SHARE, not a problem.** D4 and D5
  run U6 in the morning and U7 in the afternoon, deliberately. The cell splits
  both colours and names both groups in a neutral tone — never amber or red. A
  drawing that cried wolf on the one arrangement someone set up on purpose would
  be worse than no drawing. There is an explicit test for this, and the first
  version of that test **passed for the wrong reason** (it scanned the whole
  style string, and U6's tint IS the brand red `#E11B22`).
- It shows the two things a grid of tick-boxes cannot: a pitch **no group is on**,
  and a group on the day with **no pitches yet**. The second is amber — it is
  something to fix; the first is grey — it may well be deliberate.
- `venueMaps()` is pure: layout in, objects out, no state and no clock, which is
  what lets the test drive it directly. It tolerates a half-built layout — a
  missing day, no pitch array, a group pointing at a pitch that is gone — without
  throwing, because the tab is reachable mid-edit and a drawing that crashes
  takes the whole panel with it.

Organiser-only, deliberately. It shows draft state and unallocated groups, which
are not things the public should see.

### The registration window (added 27 Jul 2026)

**When the entry forms are open is a setting, not a deploy.** It used to be
`registrationOpen`, a hardcoded editor prop on the homepage defaulting to
`true`; moving the date cost 15 Netlify credits and the page still said
"REGISTRATION OPENS OCTOBER 2026" in four hardcoded places. That prop is
**retired** — do not reintroduce it. There is one lever and it lives in
`/organizer` → **Registration**.

The stored setting is three fields in the `config` blob store at key
`registration`:

```
{ opensAt: '2026-10-08T00:00:00+04:00' | null,
  closesAt: '2026-11-01T23:59:59+04:00' | null,
  mode: 'auto' | 'open' | 'closed' }
```

**Three states, not a date plus a toggle.** `auto` follows the dates; `open`
and `closed` are deliberate exceptions. A date field and an independent on/off
switch is how you end up with the two disagreeing and nobody sure which wins.

**Null dates mean CLOSED.** With no opening date `auto` resolves to closed, and
so does a closing date on its own. Every ambiguous input in this area fails
closed on purpose: a form that is shut when it should be open is a phone call;
open when it should be shut is a registration nobody expected. (When this
was written the gateway did not exist yet; it does now — see "The submission
flow" above, where the window check is step 4 and fails CLOSED.)

**Times are ABU DHABI time.** Every stamp carries an explicit `+04:00`, and
every date is formatted from the string's own characters rather than through a
`Date` object — `new Date(stamp).getMonth()` answers in the *reader's*
timezone and prints "31 October" to somebody in Los Angeles for a window that
opens on 1 November. `test-registration.js` runs the display answers in five
timezones from +14 to −11 and requires them all to agree; that is the only
thing that catches this class of bug.

**`Date.parse` accepts 31 February** and rolls it forward to 3 March, so
`isRealDate()` exists and is called at both entry points. Same trap
`composeDob()` closes on the player form.

### The shared block — the duplication you must respect

`registrationState()`, `validateSettings()`, `registrationWarnings()`,
`registrationCopy()` and their helpers sit between two marker comments:

```
/* ===== REGISTRATION WINDOW — SHARED BLOCK (start) ===== */
…
/* ===== REGISTRATION WINDOW — SHARED BLOCK (end) ===== */
```

That text is **byte-for-byte identical** in `netlify/functions/_registration.js`
and `scores-data.js`, and `test-registration.js` compares the two character for
character. Plain `function` declarations with no `export` keyword are what let
one text serve a CommonJS file and an ES module; each file exports the names
separately, outside the block. Change one, change both, run the test.

**This goes one better than the venue panel, and that is the point.** There,
`validateVenue()` on the server and `venueProblems()` in the panel are two
hand-written implementations of one rule, and `test-venue-panel.js` exists to
catch them disagreeing. Here the back office calls the *server's own*
`validateSettings` — re-exported through `organizer-data.js` from
`scores-data.js` — so Save cannot go green on something the server will reject.
The preview works the same way: `registrationCopy()` decides the public wording
once, and the homepage and the back-office preview both print what it returns.
**If you find yourself writing a date rule in a `.dc.html`, stop.**

`organizer-data.js` re-exports rather than reimplementing, which does mean
`/organizer` now loads `scores-data.js`. That is a deliberate trade: one extra
module on a back-office page is cheaper than a third copy of the rules.

### `phase` and `open` are different questions

`registrationState(settings, now)` returns
`{ open, phase, opensAt, closesAt, forced, mode }`.

- **`phase`** is pure date arithmetic — `'unset' | 'before' | 'open' | 'after'`.
  The mode never touches it.
- **`open`** is whether the form works. Mode first, dates second.

Keeping them apart is what stops a force-closed window having to lie about which
phase it is in. `registrationCopy()` reads both and picks the wording; nothing
else should make that judgement.

Pure and synchronous, `now` passed in, no clock of its own — which is what makes
it testable one millisecond either side of each boundary. The homepage feeds it
`Date.now()` from the same one-second timer the kick-off countdown already runs,
so **the page opens and closes itself at the exact instant, on a tab nobody
reloaded.**

### What the public sees

| Phase | The page says |
|---|---|
| `unset` | "Registration opens soon" — no date is promised that has not been set |
| `before` | "Registration opens 8 October", with a one-unit countdown under it |
| `open` | "Registration closes 1 November" — **a deadline is more use to a coach than an open date** |
| `after` | "Registration closed" — say what happened rather than showing a dead form |

Force-closed *inside* the dates gets its own line ("Registration is closed"),
because falling through to "opens soon" would be untrue and falling through to
the phase wording would print a closing date that has not happened.

**A TEST MODE strip** shows whenever the form is open because `mode` is
`'open'` rather than because of the dates — so a test session can never be
mistaken for the real thing. This replaced a `?register=test` URL override:
no secret to leak, no query string to remember, and it exercises the same
switch the real opening will use.

**It is no longer display only** (updated 2 Aug 2026 — the paragraph above
described the pre-gateway world). The submission gateway now ENFORCES the
window server-side: `handleSubmission()` step 4 refuses a submission outside
the window and fails CLOSED if the setting cannot be read. The homepage
display and the server refusal read the same `registrationState()` from the
shared block, so they cannot disagree.

---

## Team codes and names — the rule

**Codes are the identity, names are the display.** `pools[].teams` holds a code
(`ADH1`); `draw.teamNames` turns it into a club name.

- `teamLabel(code, agId)` resolves: the draw's `teamNames`, then an unambiguous
  match across loaded draws, then the hardcoded `TEAM_NAMES`, then the raw
  string. Always shortens "Abu Dhabi" to "AD". **Idempotent** — safe to apply
  to a value that is already a name.
- `teamShort(code)` is the code itself.
- **Full names** go everywhere with row width: homepage fixtures, app match
  rows and match sheet, `/scores` pool fixtures and results, editor chips.
- **Codes** go in the two places a name does not fit: the app's pinned standings
  column and the knockout bracket cells. The team key card is their legend.
- **`DRAW_NAMES` is keyed per age group and must stay that way.** `_teams.js`
  numbers teams *within* an age group, so `ADH1` in U16B and `ADH1` in U14B are
  different teams. A single global code lookup would silently show one club's
  name on another club's fixture. Where two loaded draws disagree about a code,
  `teamLabel` declines to name it rather than guessing.
- Full design, edge cases and decisions: the project doc
  `claude/specs/spec-import-registered-teams.md`.

---

## Team codes and pool preference

Team names are generated: `_teams.js` builds `<prefix><n>`, n counting that
club's teams within the age group — two Quins U16B sides are ADH1/ADH2, their
U14B side is also ADH1. Known prefixes: ADH, DE, DT, DS, DW, DH, BAR. Unknown
clubs fall back to initials (multi-word) or first three letters (single-word).

Team form asks for a preferred pool (A/B/C/D/No preference, mandatory) — stored
in column N of the Team Registrations sheet, shown on the Organizer dashboard.
Request only; organisers set the final draw.

---

## Email

Confirmation emails go from `registrations@adhjrt.com` via Microsoft Graph
(Entra app, Mail.Send permission — config in `MS_TENANT_ID`/`MS_CLIENT_ID`/
`MS_CLIENT_SECRET`/`MAIL_FROM`).

- Player registration emails the parent; team registration emails the head
  coach and manager.
- Sending happens after the sheet write, in its own try/catch — the row is the
  record, a mail failure must never lose a registration or cause a retry that
  duplicates the row.
- Medical notes are deliberately NOT echoed in the email.
- **Client secret expires ~July 2028** — when it does, emails stop silently.
  Diagnose from the AADSTS code in the function log.

---

## Shipped, don't rebuild

- Stat strip (20+ clubs / 3000+ players / 15 age groups / pitches from the
  venue layout — 18 today) is correct, with a scroll count-up animation —
  not a bug.
- Footer email is `admin@adhjrt.com` (previously mangled Cloudflare
  obfuscation markup rendered as "[email protected]" — fixed).
- Sponsors: **HSBC is the principal partner and is live in three places** — see
  the HSBC section below. Everyone else is unconfirmed; the section says so.
- Pool fixtures/results/standings show full team NAMES; knockout and the
  bracket stay CODES (team key). `teamLabel()` in scores-data.js maps
  code→name and auto-shortens "Abu Dhabi …" to "AD …" for any club.
- Homepage Fixtures section shows each match's SCORE (pool rows + knockout/
  finals bracket) from `getSchedule` — walkover-aware, blank until a result
  exists.
- The fixture editor (on `/manager` since Aug 2026 — `/scores` is public
  only) has two gated knockout buttons ("Generate knockout from standings"
  needs all pool scores; "Generate finals from knockout" fills
  Cup/Bowl/Plate/Shield/Final from the winners so far) plus "Clear knockout."
  Organisers have "Publish all"/"Unpublish all" on `/organizer` → Tournament.
- `/scores` has "Back to menu" and a footer "Manager sign-in →" link.
- Pitches are picked, not typed — each match's pitch is a dropdown of the
  venue layout's pitches for that age group.


---

## Design refresh (merged to `main` 24 Jul 2026 — live)

A visual pass, now live. To preview a branch before merging, **open a PR** — that
triggers a free, password-protected Netlify **deploy-preview** at
`deploy-preview-<N>--serene-gingersnap-1d0eb6.netlify.app` (only merging to
`main` spends the 15 credits). **There is also a permanent branch URL —
`https://dev--serene-gingersnap-1d0eb6.netlify.app` — which always serves the
latest `dev` build and never changes.** Use that in preference to a PR
preview; see "Three kinds of preview URL" below. The whole site is
also behind a site-wide Netlify password, so previews prompt for it too.

- **Logo** is now transparent `assets/crest.png` (white background + the white
  badge circles behind the nav/about/organiser crests removed), from a high-def
  original.
- **Format section** rebuilt as two day-cards ("Day 01/02" watermark, date
  pills, MINI & MIDI / YOUTH, age chips still driven by `groupsSaturday/Sunday`).
- **About-section crest animates.** At rest it's the flat logo bat; on
  scroll-into-view the bat cross-fades to a shaded realistic version
  (`crest-bat-real.png`) and flies a two-direction loop across the photo, then
  lands (also `crest-shield.png` + `crest-bat.png`). Pure CSS keyframes + a small
  head-script that adds `.play` via IntersectionObserver; a local `.cstage` clip
  stops the flight ever adding a page scrollbar; fails safe to a static crest and
  honours `prefers-reduced-motion`.
- **Results follows Fixtures.** Homepage passes `age="{{ fxSelectedId }}"` to the
  embedded `<dc-import name="Scores & Standings">`; the scores component syncs its
  public `selectedAgeId` in `componentDidUpdate` (public view + groups that have
  standings only; never overrides a manual pick).
- **Single-pool Fixtures width fix.** `fixturePoolsGridStyle` caps a lone pool at
  `minmax(0,560px)` and centres it, instead of one `1fr` column stretching the
  full section; two-or-more pools unchanged.
- **Organisers photo is now `assets/organisers.jpg`**, referenced by filename —
  it used to be a ~168 KB inline base64 `data:` blob that bloated
  `Quins JRT.dc.html` to ~300 KB. Extracted, the homepage is ~133 KB.
  **Do NOT re-inline images into any `.dc.html`** — keep them as `assets/`
  files. It keeps the page light and the `.dc.html` fast to load.
---

## Outstanding (pruned 2 Aug 2026 — three of the old six are done)

1. **The real draw.** All 15 groups' saved draws still hold the nine
   placeholder clubs (Harlequins, Exiles, Sharks, Hurricanes, Barrelhouse,
   Amblers, Dragons, Tigers, Small Blacks). Real pitches and kick-off times
   were assigned across every group on 1 Aug 2026 (zero "TBD" anywhere,
   pools and knockout), and the rehearsal RESULTS and publishing were fully
   cleared on 2 Aug — but the pools themselves stay placeholder until real
   clubs register and an organiser builds the real draw. Everything else
   waits on this.
2. **Results nav link.** The homepage top nav's Results link is still
   `href="#results"` (an in-page jump). Change to `/scores` and swap the
   coming-soon standings preview for "View live scores" — only once the
   draw is real, or placeholder pools go public.
3. **The rest of the sponsor line-up.** HSBC is confirmed and live (see below).
   Nobody else is. When another signs, add a card to the second block in the
   sponsors section — do not demote HSBC into a row of equals without asking.
4. **Deploy cost** — every production deploy costs 15 Netlify credits
   (3,000/month Pro), whatever its size. Batch changes into one commit; iterate
   on a branch/preview (free), merge to `main` once. (Full deploy-credit and
   working-agreement rules live in the project instructions.)

(Done and removed from this list: pitch scheduling — data entry completed
1 Aug; the rehearsal-data cleanup — done and verified 2 Aug, see the tombstone
section above; the `/app` crest white-tile cleanup.)

---

## How Claude writes to GitHub (rewritten 25 Jul 2026)

**The only write path: real `git` on Jay's PC, driven through the desktop
bridge.** There is no MCP-server fallback — see the tombstone in §2 below. Never
use the account-level "GitHub Integration" connector either — that one is
OAuth/read-only and 403s on every write, because Anthropic's GitHub app can't
write to a PUBLIC repo by design. It is only good for reading.

### 1. Local git via Desktop Commander (this is how writes happen)

Jay's PC (`jay-pc`) has a clone at `C:\Users\jayjm\GitHub\adhjrt`, remote
`origin` over HTTPS, credential helper = Git Credential Manager with the
credential already cached.

**A second machine, `cafnet`, was set up the same way on 27 Jul 2026** — clone
at `C:\Users\Jay\GitHub\adhjrt` (note the different username: `Jay`, not
`jayjm`). Check which device a session is bridged to before assuming a path.
`cafnet` does **not** have the `adhjrt-sim` test suite — see the Tests note
below. A **cloud** session can drive it: the Desktop
Commander MCP extension exposes a real shell on his machine as
`mcp__remote-devices__Desktop_Commander__start_process`. This does NOT require a
Cowork task started "On your computer" (verified from a cloud session,
25 Jul 2026 — pushed and deleted a test branch).

Why git: it moves bytes on disk and over the git protocol, so file content never
passes through the model's context window. That means **any file size, and
binary files (images) included** — the two things a text-through-context
transfer could never do.

Typical run:

```
cmd /c "cd /d C:\Users\jayjm\GitHub\adhjrt && set GIT_TERMINAL_PROMPT=0 && git checkout main && git pull && git checkout -b feat/thing && git add -A && git commit -m "msg" && git push -u origin feat/thing"
```

- Always `set GIT_TERMINAL_PROMPT=0` — a missing credential then fails fast
  instead of hanging the session on an invisible prompt.
- Edit files on his machine with Desktop Commander `edit_block` (surgical, cheap)
  or `write_file`, or the `mcp__remote-devices__Filesystem__*` tools. Prefer
  `edit_block` over retyping a whole file.
- Verify with `git log`/`git ls-remote`, not `raw.githubusercontent.com`.

### 2. The removed GitHub MCP server — do not re-add or use it

A local GitHub MCP server (tools `mcp__remote-devices__github__*`) once sat here
as a write fallback. It was **removed on 25 Jul 2026**: git covers every case,
and the server meant a live `repo`-scoped write token sitting in
`claude_desktop_config.json`, which is exactly what we didn't want. Its tools may
still surface in a session's deferred-tool list — **ignore them. They will fail
(the token is gone and the server entry is deleted) and must not be reinstated.**
Standing rule regardless: never print `claude_desktop_config.json`, never ask Jay
for a raw token, never accept one pasted into chat.

### 3. Setting up a new PC

Everything here is per-machine. On a new personal PC, in order:

1. Install **Git for Windows** (git-scm.com, defaults — includes Git Credential
   Manager).
2. Install the **Claude desktop app**, sign in.
3. In the app: **Settings → Extensions** → install **Desktop Commander** (and
   **Filesystem** if direct file editing is wanted; grant it the `GitHub`
   folder). These are app extensions, not hand-written config.
4. In the app: **Settings** → give the device a distinct name (this one is
   `jay-pc`) so a session can tell which machine it is bridged to.
5. **Quit the app from the system tray and reopen** — extensions and config only
   load on a real restart.
6. Clone to the same path shape so commands don't change:
   `mkdir %USERPROFILE%\GitHub` then
   `git clone https://github.com/jayjmuir-hub/adhjrt.git` inside it.
7. **Jay primes the push credential once, by hand** — Git Credential Manager
   opens a browser sign-in window that a session cannot drive. Push any throwaway
   branch, approve the window; every later push is silent.

### 4. Deploy rules — and `dev` is where work goes now

**Since 27 Jul 2026 there is a long-lived `dev` branch. Commit there, not to
`main`.** `main` is what is deployed; `dev` is where changes accumulate until
Jay says merge. The point is money: a production deploy costs **15 credits
whatever its size**, so ten changes batched into one merge cost 15 and ten
merges cost 150.

Working shape:

1. Work on `dev`. Push freely — a branch costs nothing and does not deploy.
2. **Do NOT put `[skip ci]` on `dev` commits.** It is pointless there (a branch
   does not deploy) and actively harmful: it suppresses the deploy-preview build
   too, and it survives a fast-forward, so a `[skip ci]` tip merged into `main`
   lands the code and quietly does not deploy.
3. To show Jay a change before it goes live, **open a PR from `dev`** — that
   builds a free password-protected preview at
   `deploy-preview-<N>--serene-gingersnap-1d0eb6.netlify.app`. Note an agent
   **cannot** create the PR: there is no `gh` CLI on either machine and the
   GitHub connector is read-only. Jay has to click the green **Create pull
   request** button. `.../pull/new/<branch>` is the FORM, not a PR — never hand
   over a preview link as though one already exists.
4. When Jay says merge: `git checkout main && git merge --ff-only dev &&
   git push origin main`. Check the tip commit for `[skip ci]` first. Keep it a
   fast-forward — `main` has no merge commits and the history is linear.
5. Verify the deploy reached `ready` (Netlify site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).
6. After merging, bring `dev` back up: `git checkout dev && git merge --ff-only
   main`. Do not delete `dev`.

### 4b. Deploy rules (unchanged, and they matter)

1. Edit, then validate (`node --check` the DC script; tag balance for `sc-if` /
   `sc-for`), and run `powershell tests/runall.ps1`.
2. **Pushing to `main` deploys to production and spends 15 Netlify credits** —
   show the diff and get a yes first. A docs-only commit that has to go straight
   to `main` takes `[skip ci]` so no deploy runs; on `dev` it is never needed.
3. Branches are free. To preview one, **open a PR** — that gives a
   password-protected deploy-preview at
   `deploy-preview-<N>--serene-gingersnap-1d0eb6.netlify.app` — but prefer the
   permanent branch URL, `https://dev--serene-gingersnap-1d0eb6.netlify.app`.

### Three kinds of preview URL, and only one of them is stable (2 Aug 2026)

Jay: *"why do we get a different branch deploy preview link every time we do an
edit, can't we just use one branch for all edits?"* — yes, and one already
exists. Netlify hands out three different URLs and they are easy to confuse:

| URL | Changes when | Use it for |
|---|---|---|
| `<deploy-id>--serene-gingersnap-1d0eb6.netlify.app` | **every single build** | nothing, day to day — it is an archive link to one frozen build |
| `deploy-preview-<N>--serene-gingersnap-1d0eb6.netlify.app` | every new PR | reviewing one specific PR |
| **`dev--serene-gingersnap-1d0eb6.netlify.app`** | **never** | **everything. Bookmark it.** It always serves the latest `dev` build. |

⚠️ **THIS FILE SAID THE OPPOSITE UNTIL 2 AUG 2026** — that the site had no
per-branch URL and `<branch>--….netlify.app` 404s. It does not. Verified by
fetching all three: an invented branch name returns **404**, while both
`main--…` and `dev--…` return **401**, which is the site-wide password gate
answering — and a password prompt only appears for a deploy that exists. That
is the test to use: **401 means it is there, 404 means it is not.**

Consequence worth knowing: branch deploys are **enabled**, so every push to
`dev` triggers a build. That is what makes the stable URL work. If Netlify
credits ever look higher than expected, that is the first place to look —
`main` is not the only branch building.
4. Verify a live deploy reached `ready` (Netlify site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).

### 5. The tests — the repo suite is the suite now (counts updated 2 Aug 2026)

**`tests/` in this repo is the suite.** Plain Node, no dependencies, no
build step. `powershell tests/runall.ps1`, or `node tests/<file>` for one. Each
file finds the clone itself, so any checkout on any machine can run them.

It covers the registration path, venue and pitches, the draw editor and
score sheet (component-driven), auth and the unified login, the public
pages, sponsors, light mode and the design-audit fixes — **31 files,
~3,000 checks** — plus `_prove-registration.js`, the fault-injection script
(**370 faults** as of 3 Aug 2026, all of which must be caught by the check that claims to
guard them, and none of which may be "caught" by the suite throwing). The
counts drift upward with every feature; trust `runall.ps1`'s own output
over this sentence.

**A test file must not fall over on a fault.** Reaching blind into a lookup that
a fault makes `undefined` throws, kills the process, and every check after that
point silently never runs — so the fault looks caught while proving nothing about
the check that was supposed to catch it. Hence the `|| {}` fallbacks dotted
through `test-venue-splits.js` and `test-venue-map.js`: the *guarding* check
reports, and the file carries on.

**The old `C:\Users\jayjm\adhjrt-sim` folder on jay-pc (13 files, plus
`validate-bindings.js`) is now mostly historical** — triaged on 2 Aug 2026:
seven of its files are stale or test deliberately-deleted subjects (their
live coverage moved into the repo suite), and the rest overlap it. It is in
no version control. Worth pruning to the files that still mean something;
until then, treat the REPO suite as the authority and the sim folder as
optional extra signal only.

Moving them in needs a session bridged to jay-pc, and **step one is a data
check**: this repo is public, the registration sheets hold children's names,
dates of birth and medical notes, and it has not been verified file by file that
no fixture was built from a real sheet row. The rehearsal used invented players
(the giveaway is the phone number `971500000000`). **If a real row turns up in a
fixture it does not come in here — say so and stop, do not sanitise it quietly.**
Full procedure in `tests/README.md`.

`netlify.toml` has a `/tests/*` 404 rule, because no publish directory is set and
the repo root IS the deployed site. Tidiness, not security — see above.

**The habit that matters more than the count:** every new assertion is proven
against a deliberately injected fault before it is trusted. It has caught two
tests that passed with the real code deleted, a regex matching a comment instead
of the code, a section check that scanned too wide a block, and three assertions
that were simply wrong about what the code should do.

### 6. Traps

- **Merge conflicts from squash-merges.** Earlier features were squash-merged
  into `main`; a branch still carrying pre-squash commits will conflict on
  re-merge. Branch fresh off current `main` — don't reopen old feature branches
  (`design/meet-organisers` PR #4, `fix/single-pool-width` PR #5 are both done).
- **`raw.githubusercontent.com` serves stale copies for minutes** and ignores
  cache-busting params. Verify with plain `git`.
- **The whole Netlify site sits behind a site-wide password**, so previews prompt
  for it too. That is Jay's setting, not a fault.
