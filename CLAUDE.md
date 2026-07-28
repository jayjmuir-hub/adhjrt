# ADH JRT — project notes for Claude

Abu Dhabi Harlequins Junior Rugby Tournament. A public marketing site plus a live
scores app plus an organiser back office, for a two-day youth rugby festival on
**7–8 November 2026** at Zayed Sports City, Abu Dhabi.

Run by volunteers. The maintainer (Jay) is not a developer — explain changes in
plain language and say which system each step applies to (GitHub / Netlify /
Google). Avoid unexplained jargon. (Full working-with-Jay etiquette and the
GitHub access channels live in the project instructions, not here — read those
first, every session.)

---

## The single most important thing

**There is no build step.** No bundler, no `index.html`, no compile.
`netlify.toml` rewrites URLs straight onto the `.dc.html` source files:

| URL | serves |
|---|---|
| `/` | `Quins JRT.dc.html` |
| `/scores` | `Scores & Standings.dc.html` |
| `/organizer` | `Organizer.dc.html` |
| `/app` | `app.html` — the match-day app (plain static file, not a DC component) |
| `/legal` | `legal.html` — Legal & Privacy page (disclaimer, privacy, photography). Plain static file like `app.html`, not a DC component. Linked from the homepage footer. |

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
Scores & Standings.dc.html live scores + manager area  →  /scores
Organizer.dc.html          organiser back office  →  /organizer
scores-data.js             data layer for the scores page (fixtures, standings,
                           tie-breaks, brackets, auth calls)
organizer-data.js          data layer for the organiser page
netlify-forms.html         decoy file — Netlify's crawler scans it at deploy time
                           to register the two forms. Never linked, never visited.
                           Field names must mirror the real forms exactly.
support.js, deck-stage.js, doc-page.js, image-slot.js, local-backend.js
                           framework/runtime support — do not edit
netlify/functions/         all backend (see below)
assets/                    crest.jpeg, crest.png (+crest-bat/-shield), action
                           shots, venue map, sponsor logos, organisers.jpg
                           (the "Run by volunteers" group photo)
```

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
| `manager-signup.js` | per-age-group invite code decides the age group; account starts pending |
| `manager-login.js` | returns a signed session token |
| `organizer-signup.js` | shared invite code; first organiser account auto-approved |
| `organizer-login.js` | as above |
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

`SESSION_SECRET`, `MANAGER_INVITE_CODES`, `ORGANIZER_INVITE_CODE`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_SHEET_ID_TEAMS`, `GOOGLE_SHEET_ID_PLAYERS`,
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
homepage `og:image`/`twitter:image`. `assets/crest.jpeg` is the older
white-background version. As of 25 Jul 2026 nothing references it: the homepage,
`/scores` and `/app` all use `crest.png`. It is kept only as the original.
Check what a page actually uses before changing a reference — a broken crest reference once killed every social
share preview.

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
- Sign-in tries `manager-login` then `organizer-login` — different endpoints,
  different localStorage keys; an organiser session is marked `isOrganizer`
  rather than carrying a `role` field. Check all three shapes when testing a
  role (`isOrganizerSession` in scores-data.js — missing one silently hid the
  Publish button once).
- Managers get score entry on their own age group; organisers on all.
- Fixture editor and publishing controls are deliberately NOT in the app — the
  More tab links to `/scores` for that drag-and-drop work.
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

**The point of being able to create an organiser here is that
`ORGANIZER_INVITE_CODE` can now be DELETED in Netlify.** `organizer-signup.js`
already refuses every signup when that variable is absent, so removing it shuts
self-signup off with no deploy and no code change. That closes two things at
once: one shared code for everybody with no expiry, no per-person revocation and
no record of who used it; and the first-organiser-auto-approved bootstrap, which
would hand an approved organiser account — and children's medical notes — to
whoever signed up first if the accounts blob were ever lost.

Jay's call whether to delete it. Until he does, the old route still works.

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
in `manager-login.js` or `organizer-login.js` would lock out every account whose
password predates the change — the whole committee, on the morning somebody
needed to get in. `test-accounts.js` asserts neither login file has one.

`Organizer.dc.html` carries its own copy of the number so the form can complain
before sending; the test asserts the two match. A client floor *lower* than the
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

## Clearing the rehearsal data (added 26 Jul 2026)

The tournament was rehearsed on the real site — **255 invented teams, 3,825
invented players, 415 invented results, all 15 groups published** — which is how
most of the bugs since fixed were found. It has to come back out, and the
"Clear the rehearsal data" card in `/scores` → Manager area does the part that
needs code.

**The cleanup handle for the sheets: phone `971500000000`.** It is on every
invented row and no real one. Filter any phone column on it and delete.
Jay's original 22 Jul test rows are at row 2 of each sheet.

### Three rules the panel follows

1. **Nothing is deleted in one shot.** Removal goes one match at a time through
   `clearResult()` → `submit-result.js` `{ clear: true }`, so each removal is
   written, read back and confirmed by the same write-and-verify path a real score
   uses. No bulk "empty the blob" endpoint was added, deliberately: it would be
   faster and far easier to get catastrophically wrong.
2. **It refuses to run on 7–8 November.** `isTournamentDayNow()` reads the dates
   off the **venue layout**, so the guard follows the tournament if the dates move.
   It is a UI guard on the browser's clock, not a security boundary — but what it
   protects against is a mis-click on match morning, and for that it is right.
   Orphan removal is *not* gated: it changes nothing anyone can see.
3. **The destructive actions need a word typed** — the age group id, or `ALL`. A
   confirm dialog is muscle memory by the fifth press; typing is not. A near miss
   is refused and says what was typed.

### Two things it deliberately does not do

- **It does not touch the Google Sheets.** Those hold children's names, dates of
  birth and medical notes, the deletion is irreversible, and it is Jay's hand on
  that one.
- **It does not unpublish.** "Unpublish all" already exists in the same view and is
  reversible; a second way to do it is a second way to get it wrong.

### What it shows, and why the counts matter

`allResults()` enumerates **every stored id**, including **orphans** — ids no
current fixture refers to, left when a pool was regenerated and its matches were
re-minted. Counting from the current draw alone misses those, which is exactly how
they accumulated unnoticed (it was an open finding for weeks).

An age group whose draw fails to read reports orphans as **unknown, never 0**. Zero
is the number that invites someone to press *Remove all* believing nothing is at
risk.

**Delete every saved draw** removes each group's override so it falls back to the
auto-generated draw. Worth doing once the invented registrations are out of the
sheets, because until then every saved draw names teams that no longer exist.

### The safety net nobody should rely on but everybody should know about

The legacy `all` blob is **never written and never deleted** (see `_results.js`). A
group's own blob takes precedence, so a cleared result *stays* cleared — but the
original recording survives in `all`. This operation is recoverable by anyone with
blob access, which is a large part of why it is safe to offer at all.

### A bug the test found

`runClear()` originally set its outcome message and *then* refreshed the inventory.
The refresh blanks the message on the way in, so the only thing telling you whether
the removal worked — including "3 could not be removed" — was silently erased. The
refresh now happens first and the message is set last. `test-cleanup.js` caught it;
five injected faults proved that file, including a `Remove orphans` that quietly
removed every result in the group.

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
`claude/plan-submission-gateway.md`) is the first thing that will check it
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

⚠️ **A test whose two possible answers are the same number proves nothing.** The
first version of the case-sensitivity check used U16B, whose cap (18) is also the
unknown-group fallback (18) — so a lookup made case-insensitive returned the same
answer either way and the check passed on the fault. It uses U16G (12) now. Only
injecting the fault found it.

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
- The homepage claims **"16 PITCHES"**. The real counts are 18 and 10.

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
  instead of being masked by a stale copy of the old defaults.
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
open when it should be shut is a registration nobody expected, arriving with no
age check behind it (the gateway is sub-project 1 and does not exist yet).

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

**It is display only.** Submissions still go straight to Netlify Forms, so
nothing yet *refuses* a late one — that is the gateway in
`claude/spec-registration-window.md`, sub-project 1. Adding it is three lines
inside that function once it exists. Until then the only thing keeping the
public out is the site-wide Netlify password.

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
  `claude/spec-import-registered-teams.md`.

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

- Stat strip (20+ clubs / 3000+ players / 15 age groups / 16 pitches) is
  correct, static, with a scroll count-up animation — not a bug.
- Footer email is `admin@adhjrt.com` (previously mangled Cloudflare
  obfuscation markup rendered as "[email protected]" — fixed).
- Sponsors section is a deliberate placeholder.
- Pool fixtures/results/standings show full team NAMES; knockout and the
  bracket stay CODES (team key). `teamLabel()` in scores-data.js maps
  code→name and auto-shortens "Abu Dhabi …" to "AD …" for any club.
- Homepage Fixtures section shows each match's SCORE (pool rows + knockout/
  finals bracket) from `getSchedule` — walkover-aware, blank until a result
  exists.
- Fixture editor has two gated knockout buttons ("Generate knockout from
  standings" needs all pool scores; "Generate finals from knockout" fills
  Cup/Bowl/Plate/Shield/Final from the winners so far) plus "Clear knockout."
  Organisers also have "Publish all"/"Unpublish all."
- `/scores` has "Jump to current match" (scrolls to first unscored match) and
  "Back to menu."
- Pitches are picked, not typed — "Pitches for this age group" panel
  (type-to-add chips) stored on the draw as `pitches`; each match's pitch is a
  dropdown of those pitches (editor rows + score-entry tab).


---

## Design refresh (merged to `main` 24 Jul 2026 — live)

A visual pass, now live. To preview a branch before merging, **open a PR** — that
triggers a free, password-protected Netlify **deploy-preview** at
`deploy-preview-<N>--serene-gingersnap-1d0eb6.netlify.app` (only merging to
`main` spends the 15 credits). NB: this site has no per-branch deploy URL, so
`<branch>--…netlify.app` 404s — use the PR deploy-preview. The whole site is
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

## Outstanding

1. **The real draw.** All 15 groups still start from nine placeholder clubs
   (Harlequins, Exiles, Sharks, Hurricanes, Barrelhouse, Amblers, Dragons,
   Tigers, Small Blacks) auto-split Pool A/B, kickoffs from 08:00, pitches
   default "TBD" until an organiser sets them via the pitch picker. Everything
   else waits on this.
2. **Results nav link.** Line ~152 of `Quins JRT.dc.html` is still
   `href="#results"`. Change to `/scores` and swap the coming-soon standings
   preview for "View live scores" — only once the draw is real, or placeholder
   pools go public.
3. **Nobody has actually been scheduled yet.** The layout is editable, pools can be
   put on a pitch at a time, and the whole weekend can be checked for clashes (see
   Venue above) — but **every slot is still "TBD" at 08:00** until someone works
   through the editor age group by age group. That is now data entry, not code.
   Step 5 (one set of pitch names) is the only code left.
4. **The rehearsal data is still live.** All 15 groups published showing invented
   clubs, 415 invented results, 4,080 invented sheet rows. The tooling to clear the
   results and the saved draws exists (see Clearing the rehearsal data above);
   unpublishing and the sheet rows are Jay's to press. Until this is done a coach
   visiting adhjrt.com sees fiction.
5. **Sponsors** placeholder — when artwork arrives, a comment directly above
   the section gives the exact `<img>` tag to swap in.
6. **Deploy cost** — every production deploy costs 15 Netlify credits
   (3,000/month Pro), whatever its size. Batch changes into one commit; iterate
   on a branch/preview (free), merge to `main` once. (Full deploy-credit and
   working-agreement rules live in the project instructions.)

(The `/app` header crest white-tile cleanup that used to be item 5 is done —
`background:#fff;padding:3px` is gone from `.crest` in `app.html`.)

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
   `deploy-preview-<N>--serene-gingersnap-1d0eb6.netlify.app`. This site has no
   per-branch deploy URL, so `<branch>--….netlify.app` 404s.
4. Verify a live deploy reached `ready` (Netlify site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).

### 5. The tests — half in the repo, half still on one disk

**`tests/` in this repo is the destination.** Plain Node, no dependencies, no
build step. `powershell tests/runall.ps1`, or `node tests/<file>` for one. Each
file finds the clone itself, so any checkout on any machine can run them.

It currently holds the registration window, the Venue & days views, the main
pitch / split model, the age-group table, the sheet columns and the account
rules — **1,087 checks** across seven files — plus `_prove-registration.js`,
the fault-injection script (**87 faults**, all of
which must be caught by the check that claims to guard them, and none of which
may be "caught" by the suite throwing).

**A test file must not fall over on a fault.** Reaching blind into a lookup that
a fault makes `undefined` throws, kills the process, and every check after that
point silently never runs — so the fault looks caught while proving nothing about
the check that was supposed to catch it. Hence the `|| {}` fallbacks dotted
through `test-venue-splits.js` and `test-venue-map.js`: the *guarding* check
reports, and the file carries on.

**The other thirteen files — 577 checks, plus `validate-bindings.js` — are still
in `C:\Users\jayjm\adhjrt-sim` on jay-pc and are in no version control at
all.** Until they move, **run both suites** before trusting a change.

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
