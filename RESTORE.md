# ADH JRT — how the code actually behaves

How the site is built and what each part does, in the present tense. Read the
section you need; do not read this file end to end.

This file is not for:

- **Rules** (git route, branches, secrets, verification standards) — those are
  in `CLAUDE.md`.
- **Status** (what is shipped, blocked, outstanding) — that is in the tracker.
  A date, a count, a deploy id or a "currently" does not belong here.
- **History** — why a settled question was settled is in `claude/decisions/`.
  Where a ruling has a card, this file points at it with a `Ruling:` line.

Where this file and the code disagree, the code is right and this file is a bug.

---

## The single most important thing

**There is no build step.** No bundler, no `index.html`, no compile.
`netlify.toml` rewrites URLs straight onto the source files:

| URL | serves |
|---|---|
| `/` | `Quins JRT.dc.html` |
| `/scores` | `Scores & Standings.dc.html` — public only; it has no manager area |
| `/organizer` | `Organizer.dc.html` |
| `/manager` | `Manager.dc.html` — the age-group manager dashboard (score entry, draw editor, registrations, documents, marshals) |
| `/signin` | `Signin.dc.html` — the one sign-in page for both roles; routes by role after sign-in |
| `/app` | `app.html` — the match-day app (plain static file, not a DC component) |
| `/legal` | `legal.html` — Legal & Privacy. Plain static file, linked from the homepage footer |
| `/rules` | `rules.html` — tournament rules. Plain static file; deliberately indexable and in `sitemap.xml` |
| `/register-club` | `Club.dc.html` — the club declaration form. **Unlisted**: nothing links to it, it is out of the sitemap and carries `noindex`. It is guarded by `CLUB_FORM_KEY`, not by being unlisted |
| `/assets/icons/*` | `/assets/:splat` — old icon paths some pages still reference |

Edit the file, push, done.

Anything in the repo root is **served publicly**. `netlify.toml` 404s the
folders and files that must not be (`/tests/*`, `/tools/*`, `/claude/*`,
`/netlify/*`, `/CLAUDE.md`, `/netlify.toml`, `/package.json`,
`/package-lock.json`) with `force = true` and a target of `/404.html`. A rule
whose target is its own path is silently dropped by Netlify. Reading the toml
proves nothing; fetch the URL on a deploy.

---

## Layout

```
app.html                   match-day app -> /app. Plain HTML/CSS/JS, NOT a DC
                           component. Imports scores-data.js and
                           organizer-data.js as ES modules, so it shares the
                           website's data layer, auth and permissions.
manifest.webmanifest       PWA manifest (start_url /app)
sw.js                      service worker; network-first, never caches
                           /.netlify/functions/
Quins JRT.dc.html          public marketing site -> /
Scores & Standings.dc.html public live scores -> /scores
Organizer.dc.html          organiser back office -> /organizer
Signin.dc.html             the sign-in page, both roles -> /signin
Manager.dc.html            age-group manager dashboard -> /manager. Same DC
                           component engine as the other .dc.html pages.
                           Reads scores-data.js; no backend of its own.
Club.dc.html               club declaration form -> /register-club
legal.html, rules.html     plain static pages
404.html                   branded not-found page; Netlify serves it for any URL
                           matching no rewrite
scores-data.js             data layer for scores, fixtures, standings,
                           tie-breaks, brackets, auth calls
organizer-data.js          data layer for the organiser page (re-exports the
                           shared api.* calls from scores-data.js)
support.js, local-backend.js, qr.js
                           framework/runtime support and the vendored QR
                           encoder; do not edit
netlify/functions/         all backend (see Functions)
assets/                    crests, action shots, venue map, HSBC and supporter
                           logos, organisers.jpg, share-card.png,
                           apple-touch-icon.png + icon-*.png
assets/board/              board-NN{,-sm}.{avif,webp}: the About-section
                           photos. Four files each (AVIF and WebP, 960x1200 and
                           528x660), made by tools/make-board-photo.py. Cached
                           immutable, so ADD at a new number, never overwrite.
tools/                     local scripts, not part of the site (404'd)
tests/                     the suite (404'd)
```

Keep source files text-only: no inline base64 images or fonts in a `.dc.html`
beyond a 1x1 placeholder; assets live in `assets/`.

**The DC engine's `encodeCase()`** (in `support.js`) rewrites whitespace +
camelCase + `=` into an `sc-camel-…` attribute name anywhere in a `.dc.html`,
inline `<script>` bodies included. Locals in inline scripts are lowercase or
snake_case — which is why the About script's flag is `onscreen`, not
`onScreen`. Property access (`el.onScreen`) is safe. The `text/x-dc` block is
exempt. `tests/test-about-board.js` sweeps every inline script for it.

**The engine renders the page body after first paint, more than once.** Any
boot code that looks for an element must keep re-scanning, and must set its
"done" flag only once the work has actually succeeded. A local file does not
show this; verify on a deploy.

`assets/action-lineout.jpg` is not referenced by any page; it is kept as a
spare photo.

### The About section — the photo coverflow and the crest bat

Ruling: claude/decisions/2026-08-06-about-section-motion-is-plain-css.md

The right column of `#about` (`.about-media`) holds the crest with a flying bat
and a **coverflow** of board photos. It is plain CSS 3D and a small script; no
animation library.

**The crest here is `assets/crest-shield.png`, and it is not interchangeable
with `crest.png`.** The shield is the crest with a bat-shaped hole cut out; the
bat flies out of the hole and lands back in it. `crest.png` has the bat printed
on it, so using it here shows two bats. The shield is never used anywhere the
bat is not. The bat is one flat PNG (`crest-bat.png`) painted three times and
clipped into left wing, right wing and a body band; the band is painted last
and covers the wedge the rotating wings open. `crest-bat-real.png` is shaded,
not flat, and must not run under the flap. `.cstage` (`overflow:hidden`) clips
the flight path; without it the page gets a horizontal scrollbar. It extends
left and up only.

**One variable drives the coverflow.** `--cw` (centre card width) is set on
`.about-photo`; everything else is a `calc()` off it:

```
--cw     clamp(190px, 26vw, 380px)
--ch     calc(var(--cw) * 1.25)                 card aspect, 600/480
--focal  min(266px, calc(25vw - 33px))          half the original photo column
height   calc(var(--ch) + 48px)                 24px clear above and below
```

The box bleeds off the right edge by `max(32px, 50vw - 568px)`. That arithmetic
depends on the section's 1200px max-width and 32px padding and must be
re-derived by hand if either changes. `100vw` includes the scrollbar and `100%`
does not; a box sized to finish at the viewport edge is one rounding error from
a page-wide horizontal scrollbar. The test sweeps widths from 1440 to 761.

**The `sizes` attribute is load-bearing.** Without it the browser assumes the
image fills the viewport and always takes the 960px file. It must track `--cw`
and reads `(min-width:1461px) 380px, 26vw` in **three places** — the two
`<source>` tags in the markup and `makecard()` in the script. 26vw reaches
380px at a 1461px viewport. `test-about-board.js` asserts all three agree. If
page weight jumps, check this first.

**The dark colour `#0C0C0E` lives in three places** — the box
(`.about-photo`), the scene (`.jrtb-scene`) and each card (`.jrtb-p`) —
because each can show through at a different moment. The card's is visible
only while a photo is still loading; leave it behind and an unloaded card
flashes a pale rectangle. `test-about-board.js` asserts the three agree.

How it stays cheap:

1. **Sized to the card, not the box**: 960px files for a 380px card cap (2x).
2. **AVIF with a WebP fallback** via `<picture>`.
3. **Few cards, many photos.** `CARDS` (6) live cards recycle over `PHOTOS`
   (11) board files; a new photo costs no DOM.
4. **Three load, the rest wait.** The centre card and its two neighbours are
   pointed on arrival (`fetchpriority="high"` on the centre); the rest are
   pointed on `requestIdleCallback` with `fetchpriority="low"`.
5. **Nothing below 760px.** `.about-media` is `display:none` at and below
   760px, and `display:none` does not stop image downloads — so each
   `<picture>` has a first `<source media="(max-width:760px)">` pointing at an
   inline 1x1 GIF, and the script does not build a hidden host. All three are
   needed.

Traps, all of which render as a blank or collapsed scene with no error:

- **Never put `box-shadow` on `.jrtb-p` or its pseudo-elements.** On the
  element no card paints its `<img>`; on `::before` only the front card paints.
  If an edge is wanted, use a `border` with `box-sizing:border-box` and check
  every card.
- **Never put `overflow`, `opacity` or `filter` on `.jrtb-track`.** Any of them
  flattens `preserve-3d`. Clipping belongs on `.about-photo`. (Cards may have
  `overflow`; they have no 3D children.)
- **Angles stay within −180..+180°.** Chrome treats `rotateY` past 180° as
  back-facing, so `315deg` does not paint where `-45deg` does.
- **`build()` sets `host.__built` at the END.** If it bails because the engine
  is mid-re-render (element present, `.jrtb-track` or cards missing), it must
  not have set the flag, so the next scan retries.
- **The hidden-host guard deliberately does not set `__built`.** A host with no
  client rects (hidden below 760px) is skipped unflagged, so a window dragged
  wider still gets a carousel.
- **The boot loop keeps re-scanning** (see the engine note above).
- `touch-action:pan-y` is absent because there is no drag handler. If drag
  comes back, `touch-action:pan-y` on the scene comes back with it.

The carousel is automatic; it pauses off screen and when the tab is hidden.
Under reduced motion it stops auto-motion (see the reduced-motion ruling in
Keyboard access). It falls back to one static photo (card 0 in the markup) if
the script fails.

Verifying by script: forcing `transform:none` on the `[data-reveal]` wrapper
disturbs the 3D compositing and makes cards look blank in screenshots. Scroll
to the section and let the reveal finish.

The old eight-panel **ring** is gone; the coverflow replaced it. A CSS comment
above `--cw` still describes the ring's `--pw`/`--r` geometry, and
`tools/make-board-photo.py --geometry` still prints a ring radius from its own
`PANELS = 8`. Neither drives anything live. Only if a ring is ever rebuilt:
its radius factor `1.20711 = 1 / (2 * tan(180deg / PANELS))` changes whenever
`PANELS` changes.

`scores-data.js` computes standings, tie-breaks and brackets **in the browser**
from raw results. Results are the single source of truth; every device derives
the same table. Do not move that logic server-side without a good reason.

---

## Functions (`netlify/functions/`)

| File | Purpose |
|---|---|
| `_auth.js` | shared helpers — Blobs store, bcrypt hashing, HMAC session tokens, `resolveSession()`, `hasAgeGroupAccess` (a manager whose `ageGroupId` is `'*'` acts on every group) |
| `login.js` | the only password sign-in endpoint. Both roles; account looked up by username; session minted from the account's stored role. `${ip}:login` rate bucket |
| `hub-auth.js` / `_hubAuth.js` | Sign in with Quins Club Hub — verifies a hub access token against the hub's public key (ES256, JWKS), matches on `hubSub`, mints the same session as `login.js`. A first-time person becomes a pending account with no role. See § Sign in with Quins Club Hub |
| `manager-signup.js` | per-age-group invite code decides the age group; account starts pending |
| `organizer-signup.js` | shared invite code; the first organiser account is auto-approved. Closed while `ORGANIZER_INVITE_CODE` is unset (see Environment variables) |
| `accounts-admin.js` | organiser-only: list / approve / reject / revoke; create a manager or organiser login (`create`); reset a password (`password`); change your own (`changeMine`); draw rights (`drawRights`) |
| `_password.js` | `MIN_PASSWORD_LENGTH` and `passwordProblem()`; dependency-free on purpose |
| `my-account.js` | the My account card — read own account, change own password |
| `_signins.js` | last-sign-in records, in their **own** blob store, not the accounts list |
| `get-results.js` | public read of all match results |
| `submit-result.js` | write one result, or clear one with `{ clear: true }` (the only removal path); re-verifies role and age group from the token; the age group comes from the match id |
| `get-result-history.js` | a result's edit history (refuses marshal tokens) |
| `_results.js` | results storage layout — one blob per match (see Results storage) |
| `get-schedule-override.js` / `save-schedule-override.js` | custom draw, kickoff times and pitches, draft and published |
| `publish-schedule.js` / `_publish.js` | publish or withdraw an age group's fixtures; draft/published keys and the publish permission rule |
| `draw-review.js` / `_drawRights.js` / `draw-history.js` / `_drawHistory.js` | manager draw rights, "send for review", and draw history |
| `marshal-links.js` / `marshal-info.js` / `_marshal.js` | pitch-marshal links and what a marshal's token may see and write |
| `venue-layout.js` / `_venue.js` | the pitch and day layout: GET public (`?usage=1` adds per-pitch fixture counts for organisers), POST organiser-only; `DEFAULT_VENUE`, `loadVenue()`, `mergeVenue()`, `validateVenue()`, `resolveSplits()` |
| `registration-window.js` / `_registration.js` | when the entry forms are open: GET public, POST organiser-only; `registrationState()`, `validateSettings()`, `registrationCopy()`, and the shared block duplicated in `scores-data.js` |
| `submit-registration.js` / `_intake.js` | the public registration gateway and its dependency-free decisions (allow-list, validation, window, team code) |
| `_regstore.js` | the write-once registration store (see § Registration store) |
| `get-registrations.js` | organiser-only; reads the registration store (teams, players, clubs) |
| `get-my-registrations.js` | manager: own age group only (medical notes included); organiser or `*` manager: all groups. The group always comes from the signed token |
| `snapshot-registrations.js` / `_snapshot.js` | scheduled (`@hourly` in `netlify.toml`); emails registration snapshots to `MAIL_FROM` |
| `club-link.js` | the club invite link box on `/organizer`. GET is organiser-only because the link carries `CLUB_FORM_KEY`; the key itself is never returned |
| ~~`_sheets.js`~~ | **Tombstone.** The Google Sheets client, deleted when the registration store replaced the sheets (JRT-2) |
| `_teams.js` | club prefixes and team-code generation |
| `_email.js` | email via Microsoft Graph |
| `_ratelimit.js` | the shared IP buckets, keyed on `x-nf-client-connection-ip`, **not** `x-forwarded-for` |
| `_agegroups.js` | the fifteen age groups server-side, and each group's squad cap |
| `_scoring.js` / `scoring-rules.js` | scoring rules — shared helper and its endpoint |
| `_documents.js` / `documents.js` | organiser-to-manager document sharing (see § Documents shared with managers) |
| ~~`_googleAuth.js` / `google-auth.js` / `google-config.js`~~ | **Tombstone.** Google sign-in, removed when the Club Hub became the identity. Accounts created through Google keep a `googleSub` as history and cannot sign in with it; they sign in through the hub |
| ~~`submission-created.js`~~ | **Tombstone.** The Netlify Forms handler, deleted with the move to `submit-registration`. It does not exist |

Storage is **Netlify Blobs** — results, accounts, schedules, config (venue and
registration window), registrations, documents, marshals and sign-ins each have
their own store. Auth is bcrypt accounts in Blobs, not Netlify Identity.

Permissions are always re-checked server-side from the signed token. Never trust
an age group or role sent by the browser (`submit-result.js` derives the age
group from the match id itself; preserve that pattern).

---

## Environment variables (set in Netlify, never in the repo)

Read by the functions: `SESSION_SECRET`, `MANAGER_INVITE_CODES`,
`ORGANIZER_INVITE_CODE`, `CLUB_FORM_KEY`, `BLOBS_SITE_ID`, `BLOBS_TOKEN`,
`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MAIL_FROM`.

- `CLUB_FORM_KEY` — the silent club link. Absent means the club form is
  closed.
- `ORGANIZER_INVITE_CODE` — **deliberately unset.** `organizer-signup.js`
  tests `!process.env.ORGANIZER_INVITE_CODE` and fails closed, so its absence
  is what closes organiser self-signup. Do not "fix" the missing variable.
  Setting it re-opens self-signup, which is the recovery path and nothing else.
- `MANAGER_INVITE_CODES` — the master key is `"*"`, not `"admin"`.
- ~~`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
  `GOOGLE_SHEET_ID_TEAMS`, `GOOGLE_SHEET_ID_PLAYERS`, `GOOGLE_SHEET_ID_CLUBS`~~ —
  tombstone. No code reads them since the Google Sheets path was removed, and
  `test-intake.js` fails if any function reads a `GOOGLE_` variable again.
  Delete them in Netlify: `claude/runbooks/runbook-google-sheets-cutover.md`.
- ~~`GOOGLE_CLIENT_ID`~~ — tombstone; gated the removed Google sign-in button.

**Never commit a value for any of these.** A fix that seems to need a secret in
code does not; fix the variable in Netlify. Every variable should read *"All
scopes · Same value in all deploy contexts"*; different values per context is
almost certainly a mistake.

Branch deploys read the same variables and Blobs stores as production.

### ⚠️ Changing a variable needs a deploy

A running function sees the variables as they were when it was deployed. A newly
created variable is invisible, and a rotated key keeps accepting the old value,
until the next deploy.

**After changing any variable: Netlify → Deploys → Trigger deploy → Deploy
site, then re-test the behaviour, not the config.** Reading the value back in the
Netlify UI proves nothing about what the function sees.

**Test with a payload that cannot write.** For the club form: the right key with
every age-group box empty passes the key gate and trips the "declares nothing"
rule, so 400 means accepted and 403 means refused, and neither stores a record.
A verification whose failure mode writes production data is not a verification.

---

## Age groups

15 groups, used as manager roles and as the prefix of every match id:

`u6 u7 u8 u9 u10 u11 u12 u12g u13 u14b u14g u16b u16g u18b u18g`

- Which day each group plays comes from the **venue layout**, not a list. In
  `DEFAULT_VENUE`, Saturday is U6–U12 plus **U18B and U18G**; Sunday is U13–U16
  plus **U12G**. Do not write that split down anywhere else.
  Ruling: claude/decisions/2026-07-26-venue-layout-is-configuration.md
- `u6`/`u7` are festival only — `hasStandings: false`, no table, hidden from
  public standings tabs, available in the manager area.
- `u16b`/`u16g` use a special double-bracket knockout.
- The Spirit of Rugby award applies to U14 and up (`SPIRIT_AWARD_AGE_IDS`).
- Match id format: `<ageGroupId>:<poolId>:<i>-<j>`, e.g. `u14b:A:0-1`.

**Format and squad size per group**, on `AGE_GROUP_INFO` in `Quins JRT.dc.html`
and `AGE_GROUPS` in `_agegroups.js`:

| Format | Squad | Groups |
|---|---|---|
| 7s | 12 | u6, u7, u8, u9, **and all four girls' groups** — u12g, u14g, u16g, u18g |
| 10s | 15 | u10, u13 |
| 12s | 18 | u11, u12, u14b, u16b, u18b |

`squad` is a maximum and is what the team form caps at, per group, via
`_squadCap()` in the page and the matching cap in `_agegroups.js`. **There is no
single flat cap** — a flat 15 blocks every 12s group three short of a legal
squad and lets 7s clubs enter three too many. Before a group is picked the cap
is `MAX_SQUAD_ANY_GROUP`, derived as the largest `squad`, so a club filling the
roster first is never blocked; it tightens on selection, and `submitTeam`
refuses an over-cap roster rather than dropping players. The girls' groups
differ from the boys' groups of the same age.

Scoring: 4 win/walkover, 2 draw, 0 loss. A walkover is recorded 20–0 with 4
tries. Tie-breaks in order: points difference → most points → head-to-head →
least conceded → mini-league for 3+ → coin toss.

---

## Brand

Black base, red `#E11B22`, green `#17A34A`, white — from the Akuma kit, **not**
London Harlequins magenta/blue. Fonts: Anton (display), Barlow (body), Barlow
Semi Condensed (buttons). The back office wears the club brand tokens instead.
Ruling: claude/decisions/2026-08-22-backoffice-wears-club-brand-tokens.md

**Crest files.** `assets/crest.png` is the complete transparent logo: the
homepage nav and footer, the favicons, `/scores` and `/app`. `crest-shield.png`
is the holed backdrop for the About-section bat only (see Layout).
`assets/crest.jpeg` is the older white-background version, referenced by
nothing, kept as the original. Check what a page actually uses before changing
a reference — a broken crest reference once killed every social share preview.

**The wordmark is "ABU DHABI HARLEQUINS"**, in four places: the homepage header
and footer, and `legal.html`'s topbar and footer. `test-design-polish.js`
asserts and counts all four. The header wordmark carries `white-space:nowrap`
because the sticky header's layout budget is one line.

⚠️ **The wordmark is not `teamLabel()`'s "Abu Dhabi …" → "AD …" shortening in
`scores-data.js`.** That one is deliberate, for team names in narrow standings
columns, and must not be brought into line with the wordmark.

**Social share images are `assets/share-card.png`**, a 1200×630 dark card
(crest, wordmark, dates) used by the `og:image`/`twitter:image` tags on the
public pages. It carries the tournament dates, so it must be re-rendered
(`tools/make-share-card.py`) if the dates change.

---

## HSBC — the principal partner

Ruling: claude/decisions/2026-08-05-hsbc-principal-partner-stays-separate-and-visible.md

HSBC are the **principal partner**, shown above and separate from the supporters
grid, never demoted into a row of equals.

**Five placements on the homepage; never more than two visible at once.** Each
pair below is mutually exclusive on the same breakpoint number; moving one
number without the other gives a band of widths with two marks, or none. Both
pairings are asserted in `test-sponsors.js`.

| Pair | Above the breakpoint | At/below it |
|---|---|---|
| **800px** | hero in-row lockup (`.hero-partner`), up to 128px | mobile hero lockup above the date pill (`.hero-partner-m`), `height:auto` |
| **900px** | sticky-header mark (`.hdr-partner`), 19px | fixed bottom partner strip (`.partner-strip`), 18px |

The fifth is the card in `<section id="sponsors">`, always shown.

- **Header mark**: beside the crest, 19px, not a link. Hidden at 900px, not at
  the 760px nav breakpoint: the header overflows sideways from about 875px down
  with the mark showing, and 900 is that with margin. Folding the hide into the
  760 block puts a second line back into a sticky header. There is a fault for
  that. The crest link and the mark share **one** flex child of `.hdr-row`
  (which is `space-between`), and that wrapper's `min-width:0` also prevents a
  header overflow just above the mobile breakpoint.
- **Bottom strip**: `display:none` by default, shown at ≤900px as
  `position:fixed; bottom:0; z-index:40`, 34px tall. `body` gets
  `padding-bottom:38px` **in the same media query** — nothing ties the two
  numbers together, so change both. Not a link. At ≤380px the "In partnership
  with" eyebrow drops.
- **Hero lockup**: centred in the space after the Register buttons with
  `margin-left:auto` **and** `margin-right:auto` (auto on both sides is what
  centres it). "In partnership with" above, divider to its left. The rendered
  size is set in CSS (`height:auto; max-height:128px`); the inline tag keeps
  `height:128px` because a prover fault pins the tag verbatim. The hero row
  carries `flex-wrap`; below 800px `.hero-partner` drops its divider and indent
  with `!important` (it is styled inline).
- ⚠️ **The hero lockup cannot move to the other Register pair** in
  `<section id="register">`: that section's background is `{{ accent }}`
  (our red), and the reverse lockup's red hexagon would vanish on it with no
  error. There is a fault for that move.
- **Sponsors card**: "Principal partner" plus a paragraph; links to hsbc.ae in a
  new tab. Rendered at up to **150px**, set in CSS
  (`a[href*="hsbc.ae"] img{height:auto;max-height:150px}`). **150 is a ceiling,
  not a taste**: the inner column caps at 560px and the lockup is 3.71:1, so
  anything taller is clamped back by `max-width:100%` and looks unchanged. The
  inline tag still reads `height:96px` as the no-CSS fallback and because a
  fault is pinned to that literal — editing it orphans the fault silently. On a
  phone the width cap governs. All placement sizes are asserted: a mark
  quietly shrinking is the same failure as one quietly vanishing.
- There is **no** separate partner band between the hero and the stat strip. A
  tombstone comment marks where it was; the 128px hero lockup does its job, and
  the two must not both exist. `test-sponsors.js` asserts the section is gone,
  no 54px lockup survives, "In partnership with" appears once in the hero area,
  and the tombstone is present.

**Sticky placements are never links.** A tap target that leaves the site
follows a visitor down every page, including a parent part way through the
registration form. Only the sponsors card links. Asserted from both ends, with a
fault that links the header mark.

**`/app` carries its own marks.** Its header is already `position:sticky`, so
the header mark is on screen at every scroll position from 360px up without a
strip. At **≤359px** the header mark hides (so the bar does not wrap) and
`.app-partner-strip` (26px) shows — same number, same pairing rule. The strip
sits on the bottom edge and **lifts `.tabbar` to `bottom:26px`** rather than
covering it; the safe-area inset moves from the tab bar to the strip (`/app` is
`viewport-fit=cover`). The strip block must stay below `.tabbar` in the file.

**Two assets ship; one is used.** `assets/sponsor-hsbc-white.webp` (white
wordmark, red hexagon, transparent) is what every placement references.
`assets/sponsor-hsbc.webp` is the black-wordmark master, kept only for a future
light-background placement; on a dark ground its wordmark vanishes with no
error. `test-sponsors.js` asserts the black one is not referenced.

---

## The supporters grid

Ruling: claude/decisions/2026-08-05-supporter-logos-own-artwork-sized-by-ratio.md

The supporters sit under **With the support of**, below the HSBC card in
`<section id="sponsors">`.

**The list is data** — `SPONSORS` near the top of the homepage script, bound
through `renderVals()`. Adding a sponsor is one row and one file, anywhere in
the list; never a markup edit. The Bottle Store and The Sportsman's Arms are no
longer supporters; do not re-add them from the old logo pack.

**HSBC stays above and separate.** Folding the card into the grid is the obvious
visual tidy-up and demotes the principal partner. Asserted three ways, with a
fault that injects exactly that merge.

### Every tile is dark

No `SPONSORS` row carries `light: true`, and `renderVals()` gives every tile the
same `bg: '#151517'` and `edge: 'rgba(255,255,255,0.08)'`, derived in one place,
not painted per row. Every logo has a file made for the dark ground. Tests
assert `light: true` is absent and every tile is dark. Do not reintroduce a
`light` flag without reading the tombstone comment in `renderVals()`.

The section stays dark; lightening it would erase the logos that exist only as
white-on-transparent files (Oak View Group, V&P, Yas Mena Cycles). Those three
are asserted **present**, because the remaining risk is a logo quietly dropping
out.

### Tombstone — the white-box checkerboard (do not restore it)

The tiles once alternated dark and white: a `light: true` flag on nine of the
original eighteen rows put marks that did not read on `#151517` into a white
box, and ordering `SPONSORS` so the flag alternated produced the checkerboard.
It was replaced by all-dark artwork. Its fragilities — a new sponsor breaking
the alternation, the flag having to be measured, three white-only logos that
could never take a white tile — went with it. If a checkerboard is ever wanted
again, it must come from per-row data, **never** an `:nth-child` rule, which
paints a tile white regardless of what is in it. Card:
claude/decisions/2026-08-05-supporter-logos-own-artwork-sized-by-ratio.md

### Flex, not grid — because of the last row

`display:flex;flex-wrap:wrap;justify-content:center`, tiles inline at
`flex:1 1 190px;max-width:260px`. A CSS grid leaves an incomplete last row
hanging left and no grid property centres it; flex-wrap plus
`justify-content:center` centres whatever the last row holds, with no count
baked in. The 260px cap stops a short last row stretching into giant tiles.
Below 760px tiles go three across (`calc(33.333% - 10px)`), below 400px two
(`calc(50% - 7px)`), overriding the inline values with `!important`.

⚠️ **The "no hardcoded tile colour" check is scoped to the `sc-for` block.** The
HSBC card above is legitimately `background:#151517`, so a section-wide negative
check fails on it. The slice asserts it is non-empty first — a check over
nothing passes for ever.

### Every logo links to its sponsor

Each `SPONSORS` row carries a `url`, checked for a 200 before it went in. **Do
not guess a URL** — a sponsor's mark pointing at a dead domain, or at whoever
bought the name next, is a commercial problem. Where search is ambiguous
(McCafferty's is the Yas Island site; Sedbergh is the UK school), ask.

The row pattern in `test-sponsors.js` **requires** the url, so a row without one
drops out and trips the count check. Also asserted: https only, every URL
distinct, no bare `#`.

⚠️ **`target="_blank"` requires `rel="noopener"` — a security rule.** Without it
the opened page gets `window.opener` and can navigate this tab (reverse
tabnabbing) — the tab a parent is registering a child in. There is a fault for
dropping it.

The anchor wraps the image and fills the tile (`width:100%;height:100%`), so the
click target is the tile. It carries an `aria-label` saying it opens in a new
tab.

### Artwork rules

Transparent background, trimmed to the ink, **never upscaled** — a file smaller
than the house 160px tall is stored at native size. Saved as `.webp`.
`tools/make-sponsor-logos.py` does the work.

**For a logo that arrives on a white ground:** key the white out with
`alpha = 255 - min(r,g,b)`, un-multiply so the ink keeps its colour, crop to the
ink, scale **down** to 160px tall if bigger.

Ashurst Perkins Coie's teal is approved as supplied. The two smallest assets
(Recover, Bili Boys) are the ones worth replacing if better files arrive.

### `h` — why there is not one height

Each row carries its own **max** height; the markup uses `max-height` plus
`object-fit:contain`, never a fixed `height`:

    h = round(83.5 / sqrt(width / height)), clamped 26..68

68 fits the 104px tile with 16px padding; 26 is the phone legibility floor.
**Recompute `h` when a file is replaced** — a new crop changes the ratio.
Native-size files sit below the formula on purpose.

One fixed height is wrong twice: with a clamped width it squashes a wide mark,
and equal height is not equal presence (a near-square mark reads as a postage
stamp beside a 5:1 wordmark). The sizing checks therefore **discriminate**: the
widest mark must end up smaller than mid-pack and the squarest larger, with
faults that level each back. A wordmark file that is replaced by a tagline
lockup changes its ratio, and its `h` with it.

⚠️ **A render of this page in a sandbox can be an empty shell.** `support.js`
boots React from unpkg; with no network every section measures 0×0 and the
screenshot looks faded rather than blank. Route-intercept unpkg to a vendored
React and fonts.googleapis.com to local Anton/Barlow before believing any
render.

### Test notes

- Every sponsor on the page must have a file behind it; `test-sponsors.js`
  asserts that rather than looping over an empty pending list (an empty
  `forEach` asserts nothing).
- ⚠️ **The `sponsor-*.webp` files stay in `_prove-registration.js`'s `NEEDED`
  list.** The prover creates `assets/`, which flips `test-sponsors.js`'s
  `hasAssets` gate on; without the files the suite fails on an undamaged copy.
- `test-sponsors.js` asserts nineteen company names that never signed are
  **absent by name** (a check on the old `sponsorNames` identifier alone would
  pass if the list came back under another name). Only confirmed supporters
  are ever named in this public repo.

---

## Phone layout — which pages have one

| File | Phone layout |
|---|---|
| `Quins JRT.dc.html` | laid out for a phone |
| `app.html` | laid out for a phone |
| `rules.html` / `legal.html` | simple pages, fine |
| `Manager.dc.html` | the five blanket `.bo` rules — makes it work, not a redesign |
| `Organizer.dc.html` | the same five `.bo` rules |
| `Scores & Standings.dc.html` | none, deliberately — `/app` is the match-day phone answer |
| `Signin.dc.html` | two rules (below) |
| `Club.dc.html` | none; it uses `auto-fit minmax()`, so it collapses anyway |

**Both back offices use five blanket rules scoped to `.bo`**, not per-row rules:
wrap every flex row, give every flex child `min-width:0`, force controls to
16px, floor tap targets at 44px, trim the shell padding. They select flex rows
by **attribute selector on the inline style**. That is deliberate: an attribute
selector fails loudly and globally if the renderer changes how it spells inline
styles, while hand-named classes fail quietly on the one row added later
without the class. On the file carrying the draw editor and score entry, loud is
safer.

**`/signin` is two rules** — `input,textarea{font-size:16px!important}` and
`button{min-height:44px}`. One card, no `.bo` shell, no selects. The 16px rule
covers all six of its inputs (sign-in username and password, sign-up name and
new password, the invite-code fields); a test pins the six.

⚠️ **`/organizer`'s wide tables must not be "fixed".** Each table with a
`min-width` sits inside its own `overflow-x:auto`/`overflow:auto` box and is
supposed to scroll there. Dropping a `min-width` squashes a twelve-column table
into a phone. A test requires at least as many scroll boxes as wide tables.

**Measured in a rendered page — `tools/render-audit.js`.** Headless Chromium,
computed styles and bounding boxes from a live DOM, with a local-only session
for the pages that render nothing without one. Read it this way:

- The **desktop column is a control**: if the phone numbers matched it, they
  did not come from the `@media` block.
- **"Flex rows matched" is the row that matters** — it asks whether the
  attribute selectors select anything at all.
- **Overflow is counted three ways.** Elements overflowing with a real
  scrolling ancestor (`unreachable` 0) are the wide tables working; `sidewaysPx`
  alone reads 0 under an `overflow-x:hidden` clip while content is off-screen
  and unreachable.
- An audit inside a driven browser must exclude the driver's own overlay
  (the Claude-in-Chrome extension, `z-index:2147483646`).

⚠️ **Traps that read as correct CSS:**

1. **The renderer re-emits every inline style with spaces.** Source says
   `display:flex`; the live DOM says `display: flex`. Any rule selecting on an
   inline style must carry **both spellings** and be checked in a rendered page.
2. ⚠️ **Never `overflow-x:hidden` to fix an overflow.** It hides the overflow
   and makes the clipped controls unreachable while `sidewaysPx` reads 0. A
   page that scrolls sideways is the honest symptom. A negative check guards it.

⚠️ **iOS Safari zooms when a focused control's own computed font-size is under
16px, and does not zoom back out.** Hence the 16px rules on the registration
modals, both back offices and `/signin`. It must be on the control, not a
wrapper. It does not reproduce in any desktop emulator; the rendered audit shows
the rule applies, and only a real handset shows Safari's behaviour (and how a
fixed bottom strip sits under Safari's collapsing toolbar).
Ruling: claude/decisions/2026-08-08-home-page-phone-layout.md

⚠️ **The registration modals exist only while the registration window is
open.** A screen that renders in one state is not tested by looking at the page
in another; force the window open to check them.

---

## Page metadata lives in the real `<head>`, never in `<helmet>`

The `.dc.html` pages have a nearly empty literal `<head>`; `support.js` compiles
`<helmet>` out of the `<body>` into `document.head` after boot. Tags left in the
helmet are served in the **body** of the HTML, where head-only metadata is out
of spec and unreliably honoured: most scrapers stop at `</head>`, and Open Graph
and `robots` are head-only.

| Goes in the literal `<head>` | Stays in `<helmet>` |
|---|---|
| `<title>`, description, canonical | font preconnects and stylesheets |
| all `og:` / `twitter:` tags | icons, manifest, theme-color |
| `robots` (noindex) | every script |
| JSON-LD | anything the engine templates |

The test is *does a non-rendering crawler need it*. Everything in the left
column is a constant.

- **The Google site name is `Abu Dhabi Harlequins - Junior Rugby Tournament`**,
  signalled by `og:site_name` plus a `WebSite` JSON-LD (`name`, `alternateName`
  `ADH JRT` then `Abu Dhabi Harlequins JRT`, `url` `https://adhjrt.com/`) in the
  real `<head>` of every public indexable page (homepage, `/scores`, `/app`,
  `/legal`, `/rules`). There is no shared layout: each file carries its own
  copy, and they stay byte-identical. The homepage `SportsEvent` JSON-LD sits
  beside it. Page titles do not carry the site name. `test-head-metadata.js`
  pins the strings.
- ⚠️ **Move, never copy.** The helmet is appended to `document.head`, so a tag
  in both places becomes two `<title>` tags. `test-head-metadata.js` checks
  each tag is in `<head>` **and absent from `<helmet>`**; the negative half is
  the load-bearing one.
- ⚠️ **Match tags line-anchored when writing checks over these files.** Real
  tags start a line; prose never does. A comment that names `<helmet>`, a
  literal script tag, or the club form's path is indistinguishable from the
  thing itself to a substring search, and has broken `test-about-board.js`'s
  script scanner and `test-intake.js`'s absence check.
- `/app` has a canonical and share tags; `/app.html` stays reachable beside the
  `/app` rewrite.
- `sitemap.xml` lists `/`, `/scores`, `/rules`, `/app` and `/legal`. The club
  form is absent and carries `noindex` in its real `<head>`.

---

## Image weight — what the pages actually serve

Every photo the homepage markup names is `.avif` + `.webp` in a `<picture>`, at
two widths where it is large. **No page names a `.png` or `.jpg` original.** The
masters stay in the repo to re-encode from.

- **The hero (`action-run`) is the Largest Contentful Paint.** It carries
  `fetchpriority="high"` and never `loading="lazy"`. The decorative copies
  further down (`action-run-sm`, `format-action`) are the opposite: `lazy` and
  `fetchpriority="low"`.
- **`width`/`height` on every one**, so the box is reserved before decode.
- **The `<img>` fallback is the WebP, never the original.**
- ⚠️ **Both `<source>` elements carry the phone variant** (`-sm`, 700w), not
  just one; otherwise every AVIF-capable phone pulls the full-width file.
  `test-image-weight.js` checks each source separately.
- Encoded with `ffmpeg` (`libaom-av1`, `libwebp`), quality chosen by SSIM
  (hero CRF 24, venue map CRF 26). The venue map is fully opaque, so it carries
  no alpha channel.
- ⚠️ **The venue map's drag markers are positioned as percentages of the image
  box.** `<picture>` has no box of its own and the `img` keeps `inset:0` against
  the same positioned ancestor; re-check that geometry if the markup is edited.

⚠️ **`test-image-weight.js` runs in two modes and prints which.** The on-disk
size checks need real bytes; `_prove-registration.js` seeds its temp copy as
UTF-8 text, which mangles binaries, so `assets/` is not seeded there. In that
copy the markup checks run (and every fault aims at them) and the weight checks
are skipped, with the mode printed. Skipped and passed must never look the same.

---

## Keyboard access — the skip link, landmarks, and reduced motion

**A skip link on the homepage, and only there.** It is the first focusable
element and invisible until focused. ⚠️ **It is deliberately not on the
back-office pages** — single screens with a few links before content, where it
skips nothing.

⚠️ **Off-screen, never `display:none`.** `display:none` removes it from the tab
order. It is `left:-9999px` with `.skip-link:focus{left:0}`.

**One `<main>` landmark per page** on the homepage, `/scores`, `/manager`,
`/organizer`, `/app`, `/legal`, `/rules` and `404.html`. `/signin` and
`/register-club` have none. The homepage's `<main>` sits inside the existing
`overflow:hidden` div (that overflow is load-bearing for the sticky header).
⚠️ **It closes before the footer.** The other `.dc.html` pages had their outer
wrapper renamed to `<main>` rather than wrapped, which is layout-neutral.

**Reduced motion stops movement and keeps fades.**
Ruling: claude/decisions/2026-08-06-reduced-motion-stops-movement-not-fades.md

**The stat counter honours `prefers-reduced-motion`.** ⚠️ **The guard sets the
final values; it does not skip them.** `animateStats()` sets `statsP: 1` at once
under reduced motion. `statsP` drives what the stat row displays, so an early
return that did not set it would leave "0+ CLUBS" on the page permanently. There
is a fault for that.

**Focus.** Every page has a `:focus-visible` rule; the homepage's is global
(`a`, `button`, `input`, `select`, `textarea`), and `404.html`'s covers every
link. **`:focus-visible` rules stay outside the `@media (hover:hover)` block**:
focus is not a hover effect, and a keyboard user has no pointer at all. When
auditing focus, count what a rule covers, not how many times the string
appears.
Ruling: claude/decisions/2026-08-06-hover-motion-behind-pointer-gate.md

---

## Accessibility — naming, and the one dialog

**Every form control has an accessible name.**

- **`for`/`id` where a visible label sits beside the control.** The id is
  derived from the control's `name` where it has one.
- **`aria-label` where there is no visible label** — filters, search boxes, the
  draw editor's pitch and time selects, `/app`'s sign-in and walkover.
- ⚠️ **The honeypot stays unnamed.** It is `aria-hidden="true"` and
  `tabIndex="-1"`; naming it would invite the one person who cannot see it to
  fill it in, which is what it exists to detect.
- ⚠️ **A `<label>` heading a group takes no `for`.** "PLAYERS" and "DATE OF
  BIRTH" head a list and three selects; the selects carry their own
  `aria-label`s (Day/Month/Year of birth).

**The `/app` bottom sheet is a real dialog** (`role="dialog" aria-modal="true"`).
It is the only interaction surface in `/app` — sign-in, score entry and
follow-a-team happen inside it. Escape closes; focus moves to the first control
on open (deferred one frame, because the sheet animates in); focus returns to
whatever opened it; Tab wraps inside. ⚠️ **The keydown listener is removed on
close** — the sheet opens dozens of times on a match day. It uses 92dvh (after
a 92vh fallback).

**Submit buttons cannot be double-tapped.** `busy(id, label)` in `app.html` sets
the label **and** `disabled`, and returns one restore function, so a failure
branch cannot restore one and forget the other.

⚠️ **Append new attributes at the end of an existing tag, never in the middle.**
`_prove-registration.js` anchors faults on exact opening-tag text; inserting
mid-tag breaks those anchors (they report COULD NOT INJECT, which is a failed
run).

---

## Validate on a write; coerce only on a read

**Coercion is right on a read and wrong on a write.** A blob nobody can parse
must not take the tournament down, so a reader falls back. A writer is being
told what the truth is; the only safe answer to input it cannot understand is
to refuse and say why. `tests/test-validate-not-coerce.js` covers the cases
below.

- **Team codes: a failed read of the existing team records refuses the
  registration** with a 503 (`_intake.js`, via `teamRowsForNumbering()` on the
  registration store). A non-array answer refuses too — an unrecognised shape is
  not evidence there are no teams. Numbering from an empty list would mint a
  duplicate code, and per `_teams.js` the code is the team's identity in the
  draw, standings, knockout and every match id, so a duplicate silently puts one
  team in two pools.
- **Every player's age is checked server-side** — single player registrations
  and every roster entry alike, with a play-up player (exactly one age group
  young) let through.
- **`scoring-rules.js` validates instead of coercing.** `cleanRules()` (turn
  anything unrecognised into `['tries']`) is for reads. On a write, a non-list,
  an unknown component, an empty list or an unknown group is refused with a 400
  that names it.
- **`mergeVenue()` cannot build a day with no pitches.** `normaliseSplits()`
  returns `{}` — truthy — when every key is unrecognised, so
  `normaliseSplits(...) || splitsFromPitches(...)` never falls back. ⚠️ **Empty
  is not absent, and `||` cannot tell them apart.** The reader and
  `validateVenue()` (the writer) both call one `resolveSplits()`.

⚠️ **Prover fault 260 was inverted, not deleted.** It once asserted that a
failed numbering read does not cost the registration; it now asserts the half
that still matters — the refusal is a clean 503, never an exception escaping
`handleSubmission` — with the inversion recorded in place. When a fault's
premise turns out wrong, repoint it and say so.

---

## Dependencies, the password ceiling, and the scoring model

**`package-lock.json` is committed**, so every deploy of a commit installs the
same dependency tree. ⚠️ It is 404'd in `netlify.toml`. The repo root is the
site, so any new root file is a public URL by default, and a lockfile naming
exact versions is a fingerprinting target.

**`bcryptjs` is 3.x.** New hashes are `$2b$`; existing `$2a$` hashes still
verify.

⚠️ **Passwords have a ceiling of 72 BYTES (`MAX_PASSWORD_BYTES` in
`_password.js`), because bcrypt silently discards everything past the 72nd
byte.** A longer password would hash the same as its first 72 bytes.

- **Bytes, not characters.** The check counts UTF-8 bytes. An emoji is four
  bytes; Arabic and accented characters are two or three.
- **Refused, never trimmed.** Trimming would store a password the person
  cannot reproduce by typing what they chose.
- **Set-time only**, like the floor. An existing longer password was already
  truncated by bcrypt and keeps working at login.

⚠️ **The scoring model is carried twice, and a test holds the two together.**
`_scoring.js` (`POINTS`, `BY_AGE`, `FESTIVAL_AGE_IDS`) totals a submitted
result; `scores-data.js` (`SCORE_POINTS`, `SCORE_BY_AGE`, `hasStandings`)
builds the entry form and its running total. `test-scoring-model.js` compares
both tables key by key, checks `FESTIVAL_AGE_IDS` against
`hasStandings:false`, and totals a worked example through both paths. Drift
would show as the form and the standings disagreeing about a score.

**Service worker (`sw.js`).** Caches navigations and shell assets only, capped
at `MAX_ENTRIES` (60), evicting oldest first. An uncapped cache fills a phone,
and a nearly-full phone evicts the whole origin's storage, offline fallback
included. ⚠️ `CACHE` is a dated name; bumping it clears every older cache, and
that is the escape hatch for a poisoned entry.

`deck-stage.js`, `image-slot.js` and `doc-page.js` are deleted. Nothing loaded
them.

---

## The homepage reads the tournament dates from the layout

The homepage derives two of its three date facts from the venue layout, the
same source `/app`, `/scores` and the back office read:

| | how it works |
|---|---|
| Countdown target | `Date.parse(venue.day1.date + 'T04:00:00Z')` (08:00 in Abu Dhabi). The hardcoded value is the first-frame value and the fallback. |
| Saturday/Sunday split | `dayOfCard()` → `api.isDayOne()`, the same function `/app` and `/scores` use. Falls back to `AGE_GROUP_CARDS`. |
| **JSON-LD dates** | **Hardcoded, and must be.** Crawlers do not run JavaScript. `test-homepage-dates.js` pins them to `DEFAULT_VENUE`. |

- The layout fetch is the one the page already makes for the pitch count; no
  extra request.
- ⚠️ **Everything falls back to the written-down values.** `loadVenue()` falls
  back to `DEFAULT_VENUE`; a missing or malformed field leaves the hardcoded
  day and target standing. The per-card lookup has its own try/catch so one
  unknown id cannot empty the map and move every group to Saturday.
- ⚠️ **The JSON-LD pin is the weaker guarantee.** It catches the dates
  drifting from `DEFAULT_VENUE` and nothing else. When the tournament moves,
  the JSON-LD needs a human edit; the pin makes that impossible to forget.
- ⚠️ **A test named in a comment is not a test.** The comment above
  `AGE_GROUP_CARDS` in `Quins JRT.dc.html` names `test-venue.js`, which does
  not exist. Check that a cited test exists before trusting the comment.

## Google sign-in — TOMBSTONE

Google sign-in is **removed and must not be re-added**. It was
`google-auth.js`, `_googleAuth.js`, `google-config.js`, a button on `/signin`
with a role and invite-code step, and "Link a Google account"
(`my-account.js` `linkGoogle`) on both account cards. It went because the
Quins Club Hub is the identity; two outside providers means two sets of rules.
Ruling: `claude/decisions/2026-09-08-club-hub-is-the-identity.md`.

What survives: accounts created through Google keep `googleSub` as a
historical field. The Accounts listing strips it, and `signInMethodOf()` still
answers `'Google'` for them so the tab can say why such a login has no
password. None can sign in with it. The ruling it made carries on in
`hub-auth.js`: **look an outside identity up by its subject id, never by
email**, because an email match lets whoever controls an address take over
the account that used it.

## Gotchas

- ⚠️ **Never write a camelCase name followed by `=` inside an inline
  `<script>` in a `.dc.html`.** `support.js` runs `encodeCase()` over the
  whole component before parsing; its regex
  `/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g` turns whitespace + camelCase + `=`
  into a kebab-cased `sc-camel-…` name wherever it appears, script code
  included, and the script stops parsing. Use all-lowercase or snake_case for
  locals. Spacing does not help (`onScreen = true` matches); property access
  (`el.onScreen`) is safe because the regex needs whitespace before the name.
  The `text/x-dc` block is exempt. The engine also mounts a copy of each script
  into `<head>`; if only that copy breaks, the only symptom is a console
  error. `tests/test-about-board.js` sweeps every inline script in every
  component for this.
- **The engine re-renders the body after first paint, more than once.** A boot
  scan must keep re-scanning; set flags at the end.
- **The homepage's outer wrapper carries NO width bound.** `min-width:1200px`
  forces a 1200px canvas onto phones; `max-width:1200px` leaves black gutters
  on wide desktops. Each section caps its own content with `margin:0 auto`, so
  backgrounds run edge to edge. (The `test-layout.js` once cited for this does
  not exist.)
- **Keep source files text-only** — no inline base64 images or fonts in a
  `.dc.html`; assets live in `assets/`.
- **A Netlify environment-variable change takes effect only after a new
  deploy.**
- **Registrations do not go through Netlify Forms or Google Sheets.** Both
  forms post to `netlify/functions/submit-registration.js`, which writes to
  the Blobs store `registrations`. Ruling:
  `claude/decisions/2026-09-10-registrations-live-in-a-write-once-store.md`.
  `_sheets.js` (service-account auth, first-tab lookup, private-key repair)
  and the A1 ranges in `_intake.js` are deleted.
- **Date of birth is stored as `yyyy-mm-dd`, and that shape is load-bearing.**
  Rosters are reconciled against player registrations on an exact match of
  name + DOB. The player form uses three dropdowns (day / month by NAME / year)
  feeding `composeDob()`, the only thing that decides the value — not a native
  `<input type="date">`, whose displayed order follows the device locale.
  `composeDob` refuses impossible dates (31 February) rather than rolling them
  forward; `fmtDobLong()` echoes the date with the month spelled out. The team
  form's roster rows use a native date input on purpose (coaches, desktops).
- **A failed registration fails loudly.** `postRegistration()` in
  `Quins JRT.dc.html` throws `SubmitError` on a network error, on a body that
  will not parse as JSON (something other than the function answered), and on
  `!res.ok || !payload.ok`. The caller shows the error and **leaves the filled
  form intact** so Submit retries it. Never go back to swallowing the error:
  that showed a success screen for a registration that was never stored.
- **Registration open/closed is a back-office setting only** (see "The
  registration window"). The old `registrationOpen` editor prop is gone. Do
  not add a second lever for it.
- Netlify Identity is not used; auth is the custom bcrypt + HMAC system below.
- **`.dc.html` templates bind only what `renderVals()` returns.** A
  `{{ X }}` that is not returned resolves silently to empty.
- **`style-hover` / `style-before` / `style-after` generate a single-class
  pseudo rule with no `!important`**, so an inline base `style=""` wins. Put
  `!important` inside the `style-hover` value.
- **`dc-import` forwards its attributes to the child as reactive props**
  (`this.props.X`, `componentDidUpdate(prevProps)`) — how the homepage drives
  the embedded Scores app.
- **Fixtures and standings do not speak the same language.** `getFixtures()`
  runs pool teams and knockout slots through `teamLabel()`, so it returns
  readable names. `getStandings()` returns `pools[].teams` and `tables[]` rows
  as raw draw strings (codes on a default draw). Normalise through
  `teamLabel()` before comparing across the two; `teamLabel()` is idempotent.
  `sameTeam()` in `app.html` does this for "follow my team".

---

## The match-day app (`/app`)

Phone app: bottom tab bar (Today / Fixtures / Results / Tables / More), top nav
above 820px, bottom sheets for match detail and score entry. JRT palette,
Anton + Barlow.

- Reads through `scores-data.js`, so publishing, permissions and "coming soon"
  behave exactly as on the website.
- **Fixtures is the schedule, Results is the scores.** A played fixture shows a
  "Full time" chip, not a scoreline; tapping it opens the result. Do not add
  scores back to Fixtures rows.
- **The standings table fits a phone.** Position and team columns are
  `position:sticky` (a pinned cell restates its row tint); below 430px PF and
  PA are hidden. The table shows team CODES to keep the team column narrow.
- **Two age groups are live at once:** `S.ageId` (followed; feeds Today via
  `S.followFx`) and `S.browseId` (the tapped pill; feeds Fixtures / Results /
  Tables via `S.fixtures`). One shared slot blanked Today while browsing. A
  match opened from either derives its age group from the match id
  (`ageOfMatch()`), as the backend does. `pills()` is shared by Fixtures,
  Results and Tables.
- **Sign-in is an inline sheet** (not a bounce to `/signin`) that calls the
  unified `login.js` through `api.login()`; the session is stored under
  `adhjrt_session_v2`. There are still three historical session shapes, so
  test a role with `isOrganizerSession()` in `scores-data.js`.
  A refused password shows the refusal, and there is no retry. Until JRT-29
  (11 Sep 2026), `signIn()` retried a failure through `orgApi.login()`, which
  `organizer-data.js` does not export. So a wrong password threw a `TypeError`
  and no message appeared. `test-app-signin.js` runs the handler against that
  module's real list of exports (see "One sign-in for everything").
- Managers enter scores for their own age group; organisers for all.
- The fixture editor and publishing are NOT in the app. The More tab's "Full
  manager tools" row links to `/manager`.
- A follower's chosen age group is remembered in localStorage, per device.
- The PWA installs but is deliberately not promoted (no push backend). Chrome
  stores "Desktop site" per origin and an installed PWA inherits it (980px
  viewport). Play Protect blocks install from Samsung Internet; install from
  Chrome. Treat `/app` as a fast mobile web page.

---

## Accounts and passwords

### Making a login

**Organisers create both roles in the back office** — Accounts tab → *Create a
login* → Manager or Organiser. `accounts-admin.js` `action:'create'` takes a
`role` (default `manager`), a name, username and password; the account is
approved immediately and records `createdBy`. It is a **password** account.

- A **manager** needs a valid `ageGroupId`. That is the only thing scoping a
  manager away from every other group's registrations, and the signed token
  carries it.
- An **organiser** needs none and takes an optional title (default
  `Organizer`).

**Three other doors make accounts:**

| Door | Makes | Approved? |
|---|---|---|
| `hub-auth.js` (Club Hub sign-in) | a hub account, no password | pending, or auto-approved as a manager — see below |
| `manager-signup.js` (invite code on `/signin`) | a **password** manager account | pending until an organiser approves |
| `organizer-signup.js` | a password organiser account | refuses everything while `ORGANIZER_INVITE_CODE` is unset |

⚠️ **`ORGANIZER_INVITE_CODE` is unset in Netlify, and that is what keeps
organiser self-signup shut.** `organizer-signup.js` refuses every signup while
the variable is absent, and `test-accounts.js`'s "a missing invite code refuses
every signup" holds that. With it set, the first organiser to sign up is
auto-approved (`isFirstOrganizer`), which would hand an approved organiser
account — and children's medical notes — to whoever signed up first if the
accounts blob were ever lost.

⚠️ **`organizer-signup.js` is kept as the recovery path.** If every organiser
account were lost: set `ORGANIZER_INVITE_CODE` in Netlify, deploy, sign up
(the first organiser auto-approves), then unset it and deploy again.

**`MANAGER_INVITE_CODES` stays.** It is a JSON map of age-group id → code, one
per group. A code yields only a PENDING account an organiser must approve,
where a password is a working credential the moment it exists.

⚠️ **A master code's key must be `"*"`, a literal asterisk — not `"admin"`.**
`manager-signup.js` stores the matching KEY NAME as the account's
`ageGroupId`, and the all-groups test in `_auth.js` is
`session.ageGroupId === '*'`. Any other key name, including a typo, mints a
manager scoped to a group that does not exist: it signs in and sees nothing,
with no error anywhere. It fails closed. Nothing validates the key names.

### Sign in with Quins Club Hub

**The club hub proves who a person is; this site alone decides the role.**
Ruling: `claude/decisions/2026-09-08-club-hub-is-the-identity.md`.

- `/signin` leads with **Sign in with Quins Club Hub**, which sends the person
  to `<hub>/connect/tournament?return=<this origin>`. The hub returns them to
  `/signin#hub_token=<access token>`. The page reads the fragment once, wipes
  it from the address bar, POSTs it to `hub-auth.js`, and stores the session
  under `adhjrt_session_v2`. **Fragment, never query string** — it must not
  reach a log. The hub's allowed return origins are adhjrt.com,
  www.adhjrt.com, dev--adhquins-jrt.netlify.app,
  compare--adhquins-jrt.netlify.app and localhost:8888. The `compare--`
  entry is left over: the `Compare` branch was retired on 11 Sep 2026 (JRT-34),
  and removing it is a change in the Club Hub's settings, not in this repo.
- `_hubAuth.js` verifies the token with Node's built-in crypto against the
  hub's JWKS (ES256). **No dependency, no secret, no environment variable**:
  the issuer is a constant, and a test fails if it becomes `process.env.…`.
  An unknown `kid` triggers one refetch, then refusal.
- ⚠️ **Matching is on `hubSub`, never on email.** A hub sign-in whose email
  matches an existing password account does NOT sign into it; it creates a
  separate hub account. `hub-auth.js` never links onto an existing record.
- **A first-time hub account** is `{username, hubSub, email, name, role:null,
  approved:false, source:'hub', createdAt}`, username from the email's local
  part (`usernameFromEmail()`, made unique). `hub-auth.js` then reads the
  person's own active club hub memberships (3-second budget, failure logged):
  - exactly one mapped junior squad as coach or team manager → approved on
    the spot as that group's manager (`autoApproved` stamped), 200 with a
    session;
  - two or more → stays pending with `suggestedAgeGroupIds` pre-filled;
  - none, or the read fails → stays pending.

  Organisers are never automatic. Ruling:
  `claude/decisions/2026-09-09-hub-auto-approve.md`.
- **Auto-approved accounts are re-checked on every hub sign-in** and dropped
  back to pending if the squad no longer maps; hand-approved accounts are
  not. A revoked hub account answers 403 pending.
- Answers: 200 `{ok, session, token}`; 403 `{pending:true}` with a sentence
  telling the person to press the button again once a role is given; 401 for
  a bad token.
- The organiser gives a roleless account its role with `accounts-admin`
  `{ action:'approve', username, role, ageGroupId?, title? }`, validated
  exactly as `create` validates, and validated BEFORE `approved` is touched.
  An account that already has a role ignores a role in the payload — Approve
  does not mean "change role". Approving by hand removes `autoApproved` and
  the suggestions.
- The listing strips `hubSub` beside `passwordHash` and `googleSub`;
  `signInMethodOf()` answers `'Club Hub'`. `email` and `source:'hub'` are
  shown, and auto-approved rows read "from the Club Hub · <group>".
- **The Accounts tab's Pending list carries the role picker** on a roleless
  row: a Role select (manager default) and, for a manager, an Age group select
  (pre-filled from suggestions). Approve with no age group sends nothing and
  says so above the list; a server refusal shows there too. An invite-code
  account is approved with the username alone. The account card hides Approve
  for a roleless hub account; Reject works from either place.
- `hub-auth.js` refuses every bad token with ONE sentence. The reason
  (`signature`, `issuer`, `expired`…) is for tests and logs only; naming it
  would tell a forger which check they passed.
- **Rate limit:** only failed verifications count, connection bucket only
  (`${ip}:hub`, 50 per 15 min), so managers behind one venue address never
  share a budget a correct sign-in spends.
- **Organiser password logins stay as break-glass** for the desk if the hub
  is unreachable. Sessions already minted do not call the hub again. Ruling:
  `claude/decisions/2026-09-08-organiser-password-break-glass.md`. (That card
  says managers get no passwords; the code still lets `manager-signup.js` and
  the back office create password manager accounts.)
- `tests/test-hub-auth.js` drives this with a throwaway P-256 key per run and
  a stubbed JWKS.

### One sign-in for everything

Ruling: `claude/decisions/2026-08-02-one-login-one-session.md`.

**Sign-in lives at `/signin`.** `Signin.dc.html` carries the Club Hub button,
password sign-in, and the invite-code manager signup. After sign-in it routes
by the account's role — organiser → `/organizer`, manager → `/manager`;
`?next=` is honoured only from an allow-list of exactly those two paths and
only when the role permits it. Signed-out `/organizer` and `/manager` redirect
to `/signin?next=…` and carry no sign-in UI; a manager session on `/organizer`
is sent to `/manager`. `/scores` is purely public. `/app` keeps its own inline
sheet against the same endpoint.

**One password endpoint — `netlify/functions/login.js`.** The account is
looked up by username alone (no role filter); session and token are minted
from the account's stored role:

- organiser: session `{username, name, role: title||'Organizer',
  _role:'organizer'}`, token `{username, role:'organizer'}`;
- manager: session `{username, name, ageGroupId}`, token `{username,
  role:'manager', ageGroupId}`.

`hub-auth.js` carries a character-for-character copy of `sessionFor()`, and
`test-hub-auth.js` asserts they match. `currentSession()` shows an organiser
to manager-side code as `ageGroupId:'*', isOrganizer:true`. Tokens last about
six months (`SESSION_MAX_AGE_MS`).

⚠️ **`login.js` rate-limits with TWO buckets, and only FAILED attempts count
against either:**

| Bucket | Key | Limit | Guards against |
|---|---|---|---|
| per account | `${ip}:${username}:login` | 10 per 15 min | a script working on one password |
| per connection | `${ip}:login` | 50 per 15 min | a script working through a list of usernames |

Both are peeked, not counted, before the password is checked; a failure
records against both. **A correct password clears the per-account bucket but
never the connection bucket.** Every manager at the venue shares one
`x-nf-client-connection-ip`, so a single bucket counting every attempt would
lock out correct sign-ins on tournament morning.

- ⚠️ **bcrypt always runs**, against a published `DUMMY_HASH` when the
  username is unknown or has no `passwordHash`, so response time does not
  reveal which usernames exist.
- An account with no `passwordHash` (hub, or historical Google) gets the same
  401 as a wrong password. The 401 sentence names neither half and tells the
  person to use their username, not their email address.
- A pending account gets 403 after the password check.

⚠️ **`organizer-login.js` and `manager-login.js` are retired and must not come
back.** `test-unified-login.js` asserts both files are absent. A resurrected
copy would be a second password endpoint with its own rate-limit bucket.

**One session key** — `adhjrt_session_v2`, both data layers.
`migrateSession()` in `scores-data.js` (one copy, imported by
`organizer-data.js`) moves the two older keys across on first read, organiser
key winning, and removes them; malformed JSON reads as absent, never a throw.
`logout()` clears all three keys.

⚠️ **No retry-the-other-endpoint chains.** The data layers carry none: one
call, and the account's own role decides where you land. `test-signin-page.js`,
`test-session-migration.js` and `test-unified-login.js` hold this. (`/app`'s
`signIn()` still has one — see The match-day app.)

### The signup role picker is gone

**Signup on `/signin` creates an age-group manager and nothing else.** There
is no Manager/Organiser picker, no organiser role/title inputs, and no
switching invite-code label. `organizer-signup.js` refuses every signup while
`ORGANIZER_INVITE_CODE` is unset, so an organiser option could only ever fail
with a message that reads as "you typed it wrong".

`signupRole` stays in state fixed at `'manager'` with no setter, and
`signupTitle` stays `''`, so the signup payload keeps its shape; their
renderVals bindings are deleted (dead code here is published code).
`test-signin-page.js` asserts the closure on the page source, not on state.
Organiser accounts are made only in the back office.

### Revoke actually ends a session — `resolveSession()`

**A signed token is not a door on its own.** `verify()` in `_auth.js` proves
only that we signed the token and that it is under six months old. It cannot
know the account was revoked, deleted, demoted or reset: there is no session
table. **Every guarded endpoint goes through `resolveSession(event)`**, which
verifies the token, then loads the account:

| Outcome | Status | `sessionEnded` |
|---|---|---|
| approved, token after cutoff | 200 (session) | — |
| no valid token | 401 | yes |
| account deleted | 401 | yes |
| account not approved (revoked or pending) | 403 | yes |
| token minted before `sessionsValidFrom` | 401 | yes |
| accounts store could not be read | 503 | **no** |

Endpoints turn a refusal into a response only through `sessionRefusal(auth)`.
The browser signs someone out on the `sessionEnded` marker, never on a status
code. Ruling: `claude/decisions/2026-08-11-session-ended-marker.md`.

Load-bearing properties:

- **Role, age group and draw rights are re-derived from the ACCOUNT, never
  read off the token.** That is what makes a demotion take effect at once.
  `ageGroupId` is the account's for a manager and `''` for an organiser;
  `drawPools`/`drawTimes` are true only for a manager whose account has them.
- **A failed accounts read answers 503, never 401** — fail closed, but say
  "try again". `optionalSession()` — for endpoints where the public also gets
  an answer — does the opposite and downgrades to the public view.
- ⚠️ **A missing `sessionsValidFrom` must read as "no stamp".** The `|| 0` in
  `Number(account.sessionsValidFrom) || 0` is not what carries that
  (`x < NaN` is already false); it is there to stop a "tidy-up" to
  `|| Date.now()`, which reads almost the same and refuses every request.

`accounts-admin.js` stamps `sessionsValidFrom` on **revoke** and on an
organiser's **password reset**. `reject` deletes the record; a token whose
account is missing is refused on that alone. Re-approving a revoked account
does not clear the stamp, so its old tokens stay dead. Revoke also stamps
`revokedAt`, a separate field, so a revoked account is listed as revoked and
not in the pending queue. Ruling:
`claude/decisions/2026-08-11-revoked-is-not-pending.md`.

⚠️ **A self-service password change (`my-account.js`) does NOT stamp
`sessionsValidFrom`**, so it does not sign the person's other devices out.
Deliberate: stamping it would sign them out of the device they are using.
Closing it means returning a replacement token and having the page store it.

`tests/test-session-revocation.js` drives the real function against a stubbed
accounts store so the list can change between calls with the token unchanged.

### My account

**One card, two modes**, on both `/organizer` and `/manager`: your own
account, or (organiser only) somebody else's with reset / approve / revoke and
never self-only actions. Fields: name, username, role in words (the age
group's name, not its id), sign-in method, member since, last sign in.

**`netlify/functions/my-account.js` — the door is ANY valid session.**
`GET` returns your own safe fields (never `passwordHash`, `googleSub` or
`hubSub`) plus `lastSignInAt`; `POST {action:'password', currentPassword,
password}` changes your own password, current one required. Any other action
is a 400. Ruling: `claude/decisions/2026-08-03-my-account-acts-on-the-token.md`.

⚠️ **The account acted on is always the one in the verified token.** No code
path reads a username, id or role off the request, and the cards send none.

**`accounts-admin.js` is organiser-only for every action** (`requireOrganizer`
checks the resolved role). Its actions: `GET` listing; `create`; `approve`;
`reject`; `revoke`; `drawRights` (manager targets only — an organiser target
is a 400); and `password`.

⚠️ **`action:'password'` resets ANY account's password — manager or
organiser — with no role check on the target and no current password.** The
authority is the organiser session. It stamps `passwordChangedAt/By` and
`sessionsValidFrom`, because a reset that leaves old tokens alive is a second
way in, not a recovery. There is no self-service path in this file; changing
your own password is `my-account.js`. `/manager` reaches none of the
accounts-admin actions, asserted by name.

**The listing strips `passwordHash`, `googleSub` and `hubSub`** and adds
`signInMethod` and `lastSignInAt`.

⚠️ **`signInMethodOf()` in `_auth.js` is the ONE copy** of the sign-in-method
rule: `'Club Hub'` if `hubSub`, `'Both'` if `passwordHash` and `googleSub`,
`'Google'` if `googleSub`, else `'Password'`. The listing and `my-account.js`
both call it; its behaviour is driven in `test-my-account.js`, not grepped.

**The card's markup is a second copy on purpose** (no build step, no shared
component system). Its data layer is not: `myAccount()` and
`changeMyPassword()` live in `scores-data.js` and `organizer-data.js`
re-exports them. A test asserts it.

### Last sign in

The card shows when an account last signed in, date **and time**, under
*Member since*. On somebody else's card it answers which managers have never
got in. No record reads as **Never**, covering both "never" and "store
unreadable".

⚠️ **The stamps live in their own Blobs store, `signins`, one key per person
— not on the account record.** Every account lives in ONE blob (key `list`)
that `saveAccounts()` rewrites whole, and Netlify Blobs has no conditional
write. A field on the account would make every login a write to that blob, and
a login in the same moment as an organiser's approval would silently discard
one of them. One key per person means two sign-ins cannot collide and no
sign-in can damage an account. `test-my-account.js` interleaves two sign-ins
with an approval and checks the approval survives. (Same reason as Results
storage.)

- **Recorded AFTER the password and approval checks, never before**, or anyone
  could move somebody else's stamp by guessing at their username.
- **Recorded by `login.js` and `hub-auth.js`**, including a hub account
  auto-approved on first sign-in.
- **It fails open both ways.** `recordSignIn()` swallows every error;
  `readSignIn()` answers null.
- **The username is sanitised before it becomes a blob key**
  (`[^0-9a-zA-Z._-]` → `_`, max 60), as `_ratelimit.js` sanitises the client
  address.
- Your own card reads it from `my-account.js`; somebody else's from the
  `accounts-admin.js` listing.

### Passwords

**One floor, `MIN_PASSWORD_LENGTH` in `netlify/functions/_password.js`, is
10**, plus the 72-byte ceiling above. `passwordProblem()` returns the refusal
sentence or null; anything not a string is refused. Organisers and managers
both reach children's data, so both get the same floor.

`_password.js` is **separate from `_auth.js` and dependency-free**: `_auth.js`
pulls in `bcryptjs`, which a fresh clone does not have, and keeping the policy
apart lets `test-accounts.js` require it directly. `_auth.js` re-exports it.

⚠️ **The floor and ceiling apply when a password is SET, never at login.** A
length check in `login.js` would lock out every account whose password
predates the rule. `test-accounts.js` and `test-unified-login.js` each assert
`login.js` has none.

`Organizer.dc.html` and `Manager.dc.html` each carry a copy of the number so
the form can complain before sending; a test asserts they match the server's.
A client floor lower than the server's lets a form submit and bounce off a 400.

### Every UI call must exist in the data layer

The `.dc.html` pages call into a data layer through a plain object, so a
missing function is not a build error and not a visible crash — a dialog's
own `.catch()` swallows the `TypeError` and the screen looks like success.
**`test-accounts.js` checks every `api.X` a page calls against what
`organizer-data.js` exports**, and every action the data layer posts against
what `accounts-admin.js` handles. Add a UI call and its data-layer function in
the same commit. (`app.html` is outside that sweep. Its sign-in handler is
run against `organizer-data.js`'s real exports by `test-app-signin.js`,
added after the `orgApi.login` call above.)

---

## Sensitive data — read this section, always

Player registrations hold children's names, dates of birth, medical notes and
parent contact details. They live in the Netlify Blobs store `registrations`
(write-once records, `_regstore.js`), with emailed snapshots as the backup.

- **`get-registrations.js` is organiser-only**: `resolveSession`, then 403
  unless the resolved role is `organizer`. Never widen it, or `/organizer`.
- **`get-my-registrations.js`** gives an age-group manager their OWN group's
  registrations in full (deliberate, for player welfare). The group comes from
  the resolved session — the account — never the request. An organiser, or a
  manager whose `ageGroupId` is `'*'`, sees every group; a manager with no
  valid group gets 403. Ruling:
  `claude/decisions/2026-07-31-manager-registrations-read-only-scoped.md`.
- Both readers return `rehearsal: true|false` per row.
- **Anyone who can create or re-role an account controls access to this
  data.** That is every organiser: `create`, `approve` with a role, and
  `password` on any account.
- Never log registration field values or paste their contents into a commit,
  issue or public file.
- If `ORGANIZER_INVITE_CODE` is ever set, the first organiser to sign up is
  auto-approved. Audit the account list; flag anything unexpected rather than
  fixing it silently.

---

## Results storage — one blob per MATCH

Match results live in the `results` Blobs store, **one JSON object per match**,
key `m:<matchId>`. Everything goes through `_results.js` — `readMatch` /
`writeMatch` / `clearMatch` / `readGroup` / `readAll`, plus
`fileResultHistory` / `readResultHistory` (key prefix `hist:`, outside `m:`
and `ag:`, so `readAll` never lists it). Nothing else touches the store.

⚠️ **Netlify Blobs has no conditional write (no compare-and-set).** Every
write is a whole-object overwrite, so any design that reads a shared blob,
changes it and writes it back can silently lose a concurrent write. That is
why results are one blob per match, sign-in stamps one key per person, and the
`/organizer` Fixtures & tables tab is read-only.

**Three layouts are READ**, in increasing authority: `all` (`LEGACY_KEY`,
everything in one object), `ag:<ageGroupId>` (one per group), `m:<matchId>`
(one per match, current). A per-match blob wins whenever it exists.

- **A save writes exactly one key: its own.** There is no read-modify-write on
  the write path, so no other save can be lost inside it. Two people saving
  the SAME match is last-write-wins, which is correct: the second is
  correcting the first.
- ⚠️ **There is no migration and there must never be one.** The legacy `all`
  blob is never written and never deleted; nor are `ag:` blobs. Old results
  are served from wherever they live until someone edits that match, when its
  own `m:` blob appears and takes over for that match alone. There is no
  window where a result is in neither place.
- ⚠️ **Clearing writes a TOMBSTONE (`{cleared:true, clearedAt}`), never a
  delete.** Deleting `m:<matchId>` would let the next read fall through to an
  older layout and resurrect the cleared result. `isTombstone()` recognises it.
- ⚠️ **The trailing colon in the list prefix is load-bearing.** Match ids start
  with the age-group id, so `m:u12` would also list `m:u12g:…`. `matchPrefix()`
  includes the colon.
- ⚠️ **The write path and the read path have OPPOSITE failure rules.**
  `readMatch` and the per-match list THROW on a read or list failure: "I could
  not ask" must never be treated as "there is nothing there". `readAll`, the
  public Standings reader, degrades to whatever it could read, because a stale
  score is recoverable and a blank table on a tournament afternoon is not.
- ⚠️ **`readGroup` and `readAll` must agree about which layout wins.** A group
  blob REPLACES the legacy slice for its group; it does not merge over it.
  Both readers do the same, and a fault holds it.
- **The write-and-verify is kept.** `submit-result.js` writes, reads the match
  back and looks for its own `submittedAt`; three attempts, then **409 and an
  error the person can see**. Never return `ok:true` without it. The reply
  carries `stored:{homeScore, awayScore, walkover}`, and the score screens
  display those figures, not the form's.
- **Every figure is sanitised**, card counts included:
  `Math.min(15, Math.max(0, Math.floor(...)))`.
- Each save stores `enteredBy: {kind, name, pitch?, username?}` beside
  `submittedBy`.
- **U6 and U7 refuse scores at the API** (`FESTIVAL_AGE_IDS` in
  `_scoring.js`). Clearing stays allowed.
- `tests/test-results-storage.js` drives the real layer against a fake store
  with dials for read and list failure.

⚠️ **Knockout match ids are stable (`u16b:CUP`)**, so a score stored against a
slot stays attached if the slot's teams change. The `clearResultsFor()` helper
this section used to describe no longer exists anywhere in the code; nothing
verified here clears a knockout result when its matchup is replaced.

---

## Clearing the rehearsal data — the panel is DELETED

**Tombstone.** A "Clear the rehearsal data" card on `Scores & Standings.dc.html`
bulk-removed invented rehearsal results and publications. It was deleted with
that page's Manager area (`/scores` is public only). It must not come back
there.

For bulk clearing, use **"Reset the simulation"** on `/organizer` →
Tournament: it unpublishes every group, removes every result one
write-and-verify call at a time, and clears generated brackets. It
deliberately does NOT touch saved pools or team assignments, or registrations.
The old panel's design (nothing deletes in one shot, the match-day guard,
typed confirmation) is in git history
(`git log -- 'Scores & Standings.dc.html'`).

---

## The age-group picker

**Two DAY blocks of wrapped chips, ONE OPEN AT A TIME, on THREE surfaces.**
Ruling: `claude/decisions/2026-08-06-age-group-picker-derives-the-day.md`.

| Surface | Implementation |
|---|---|
| `/app` | `pills()` in `app.html` (template strings), shared by Fixtures, Results and Tables |
| `/scores` | `ageDayBlocks` in `Scores & Standings.dc.html` (nested `<sc-for>`) |
| homepage Fixtures | `fixtureAgeDayBlocks` in `Quins JRT.dc.html` |

They share no code (no build step), so `tests/test-age-group-picker.js` reads
all three and asserts what must agree. ⚠️ **The count is asserted**: a fourth
picker fails the test.

- ⚠️ **The day split is derived from the venue layout, never typed.**
  `api.isDayOne()` and `api.dayLabelOfAgeGroup()` answer from where a group
  holds pitches; moving a group in the back office moves its block with no
  deploy. A typed `SATURDAY` list once put groups on the wrong day on the public
  site. The test sweeps for such a list AND drives the answer.
- ⚠️ **The label splits on the first space** — band big, format small (`U12G`
  + `QR`). A name with no space shows whole with no format line. Asserted
  against all fifteen names read from `_agegroups.js`.
- ⚠️ **The homepage keeps all fifteen groups and `/scores` does not, on
  purpose.** `/scores` filters on `hasStandings` (U6/U7 keep none); U6 and U7
  do have fixtures, and the homepage picker is a fixtures picker. Asserted from
  both ends.
- ⚠️ **One day open at a time, and the open day follows the selection.** A
  fixed open day would show half the readers a list without their group.
  Tapping a heading pins a day; the pin is stored with the selection it was
  made under, so a new pick releases it.
- ⚠️ **A closed day that holds the pick names it** (a coloured badge); one that
  does not shows a count.
- ⚠️ **`onSelect` reports upward through `props.onAgeChange`** — the homepage
  embed contract. Asserted.
- ⚠️ **Selected chips keep the DAY's colour** — red day one, green day two.
  Both asserted.
- `centreActivePill()` is deleted with a tombstone; nothing scrolls sideways.
- ⚠️ **`dayTag()` is deleted, and the rule is "say the day ONCE", not "never
  say it".** The block heading carries the day; a second line repeating it
  under the picker reads as a mistake. Asserted from both ends: a fault that
  brings the duplicate back, and one that empties the heading.

## Which reader sees which draw — `viewModeOf()`

Ruling: `claude/decisions/2026-08-08-staff-see-unpublished-draw.md`.

**One derivation, in `scores-data.js`.** `getFixtures()` and `getStandings()`
both call `viewModeOf(state)`:

| Mode | When | What is served |
|---|---|---|
| `published` | a published copy exists | the published draw |
| `draft` | the caller is allowed the draft AND a draft exists | the draft, behind a worded marker |
| `sample` | the caller is allowed the draft and NO draft exists | the auto-generated draw — **placeholder clubs** — behind a worded marker |
| `none` | nobody is allowed the draft and nothing is published | nothing; the reader shows "coming soon" |

⚠️ **The discriminator is the server's `isDraft`, not "a session exists" —
that is an authorisation decision.** `get-schedule-override.js` sets `isDraft:
true` only after `optionalSession()` resolves the token *and*
`hasAgeGroupAccess()` passes; anything short of that gets the published answer
with `isDraft:false`. A manager asking for another group's draw lands on
`published`/`none` with no client-side check. Deriving the mode from
`!!session` would put every manager into a SAMPLE view for every group — and
an organiser hand-checking it would never see the broken case.

**Who passes a session, and who must not:**

| Caller | Session? |
|---|---|
| `/manager` `load()` — Fixtures, Results, Tables, the score sheet, the Spirit award | ✅ |
| `/app` — `load()`, `loadFollowData()`, and both fetches in `refresh()` | ✅ |
| `/organizer` — `loadFixturesView()` | ✅ |
| **`/scores`** (`Scores & Standings.dc.html`) | ❌ **never** — purely public |
| **The homepage** (`getSchedule()`) | ❌ **never** — takes no session parameter |

⚠️ **The score sheet is built from the same fetch.** `/manager`'s `playable`
list comes from `getFixtures()`, which is what lets a score be entered for an
unpublished age group. Managers cannot publish at all (`publishDenialReason()`
in `_publish.js` refuses every manager and points them at "send for review"),
so match-day scoring must never depend on a publish. Ruling:
`claude/decisions/2026-09-08-draw-rights.md`.

⚠️ **The marker is worded, not coloured, and the wording is asserted.** The
titles *"Draft — not published"* and *"Sample draw — not real fixtures"* are
carried in `Manager.dc.html`, `app.html` and `Organizer.dc.html`;
`tests/test-draft-visibility.js` reads all three. Reword one, reword all three.

⚠️ **`app.html`'s `viewNote()` returns `''` for everything except `draft` and
`sample`.** It is the only marker on a page the public reaches; without that
early return every parent on `/app` is told real fixtures are a draft.

**The `/organizer` "Fixtures & tables" tab is READ-ONLY on purpose.** Editing a
draw and entering a score stay on `/manager`, which an organiser reaches
through the age-group switcher only they get. A second write path against the
same draft blob would race it (no conditional write — see Results storage). A
test asserts the panel's markup names no write function.

⚠️ **`regeneratePoolSlots()` mints match ids from `Date.now()`**, so a
regenerated draft carries new ids and results stored against the old ones
drop out of the tables. Harmless before results exist; on match day, editing
pools makes tables read empty. Known and not fixed.

⚠️ **`/organizer` reads through `organizer-data.js`, not `scores-data.js`.**
`getFixtures`, `getStandings` and `teamShort` are re-exported there, and
`test-accounts.js`'s sweep asserts every `api.*` the page calls exists.

The local backend (`local-backend.js`) has no publish concept and reports
`isDraft:false, published: !!schedule`; offline development behaves as
published and must not be "tidied".

## Draw rights — who may change a draw, and when

Ruling: claude/decisions/2026-09-08-draw-rights.md

The rules live in `netlify/functions/_drawRights.js`, and nowhere else.

- **By default a manager can enter results only.** An organiser turns on two switches on a manager's account card (Accounts tab, viewing another person): **Edit pools and teams** (`drawPools`) and **Edit kickoff times and pitches** (`drawTimes`). A missing switch counts as off. Organisers have both rights and see no switch. The `*` admin-manager gets both if either switch is on. `accounts-admin.js` action `drawRights` refuses an organiser as the target and stamps `drawRightsChangedAt/By`.
- `resolveSession()` copies both flags from the STORED account onto the session on every request. An organiser's change therefore applies from the manager's next request, and any right a token claims for itself is ignored.
- `save-schedule-override.js` checks a manager's save against the **stored draft**, never against what the client says the old value was. With pools only, a manager may change pools, team lists and pairings (`home`/`away`/`poolId`), but may not change any `startMins`/`pitch`, add or remove a slot, or reset. Times only is the reverse. **If no draft has been saved yet, a partial-rights manager is told to ask an organiser to save once.**
- **The freeze.** From 00:00 Gulf time on the group's OWN day until the tournament ends, every manager save is refused with *"The draw is locked on match day…"*. The group's day comes from the saved layout's `groups`; the date comes from `DEFAULT_VENUE`. Organisers are never frozen. A day-2 manager can still save on day 1.
- **Only organisers publish, on any day** (`publishDenialReason`). `get-schedule-override` always returns `managerCanPublishNow: false`. Its DRAFT answer also returns `rights: { pools, times, frozen, frozenNote }` for the caller.
- The Draw tab (`Manager.dc.html`) displays whatever `draw._rights` says and never works out a right for itself. `drawRights()` / `mayEdit(kind)` guard every editing handler and write the explanation into `drawMsg`. A note at the top tells the person what they may change. Save/Discard are hidden when the person has no right; Regenerate is hidden without the times right. Until the draft arrives, an organiser is unrestricted and a manager is read-only, which matches what the server will say.
- ⚠️ `loadVenue` must be passed the store FACTORY (`blobStore`). Called with no argument it throws, falls back to the layout in the code, and freezes a group an organiser has moved to the other day on the wrong day. Both callers pass `blobStore`.
- **Send for review** (`draw-review.js`). A manager who has an edit right and a SAVED draft presses the button on the Draw tab. The server writes `review:<id>` in the `schedules` store and emails every approved organiser account that has an email address. The limit is one request per group per ten minutes. The draft check runs BEFORE the limit, so a refused request does not use it up. The email is best-effort: if mail is down, the record is still written and the answer says `emailed: false`, which the Draw tab turns into "tell the desk as well". The organiser's Fixtures tab shows an **Awaiting review** strip (Open goes to `/manager?ag=<id>`, plus Dismiss). Publishing or Dismiss deletes the record. The strip names no function that writes drafts.
- **Draft history** (`_drawHistory.js`, `draw-history.js`). Before each save overwrites the draft, the old draft is filed under `hist:<id>:<ISO>`, ten deep (`KEEP`). A reset files a `cleared` entry that still holds the wiped draw, so it is how you undo a wipe. GET (metadata, newest first) and POST restore are organiser-only. A restore files the current draft first, so a restore can itself be undone, and it never touches the published copy. The Draw tab's **Draft history** card sits inside an `isOrganiser` gate; `test-manager-dc.js` counts the gates on the page.
- Blobs has no compare-and-set. If two organisers save the same group in the same second, one save can be lost. The draft history makes it recoverable.
- `/manager?ag=<id>` opens that group for an organiser; the review strip links there.
- `tests/test-draw-rights.js` exercises all of the above.

## Pitch marshals — volunteers score at the pitch

Ruling: claude/decisions/2026-09-08-pitch-marshal-links.md

The rules are in `netlify/functions/_marshal.js`. The phone side is pitch mode in `app.html`. The manager side is the **Pitch marshals** tab on `/manager`.

- **A marshal link belongs to a PITCH on a DAY, never to a person.** It is issued from the tab by an organiser or by a manager of that group. `marshal-links.js` refuses a manager asking about any other group (`hasAgeGroupAccess`). It signs a token `{ kind:'marshal', ageGroupId, day, pitch, jti }` and stores `{ jti, issuedAt, issuedBy, revokedAt }` in the `marshals` store under `<ag>:<day>:<pitch>`. **The token is returned once. It is never stored, never listed and never sent back again.** Issue new creates a fresh `jti`, which kills the old link. Revoke stamps the record.
- **The server works out the day.** `marshal-links.js` reads the group's day from the saved venue layout (`dayIdOf`). `dayWindow(day)` sets the live window to 00:00–24:00 Gulf time on that day's date in `DEFAULT_VENUE`. The client never supplies the day. Festival groups (U6/U7) are refused because they keep no scores. The pitch must be one the group holds on its day in the saved layout.
- **A marshal token cannot call `marshal-links`.** That endpoint only accepts a manager or organiser session through `resolveSession`, and a marshal token is not a session.
- `verifyMarshal()` accepts a token only if its `kind` is `marshal`, all four fields are present, today is its live day, and the stored record's `jti` matches and is not revoked. Otherwise it returns a reason: `not-marshal`, `malformed`, `not-today`, `store`, `reissued` or `revoked`.
- **Pitch mode** (`/app#marshal=<token>`). The page reads the fragment once, keeps it under `adhjrt_marshal_v1` and removes it from the address bar. `marshal-info.js` returns the group, pitch and day, that pitch's slots from the PUBLISHED draw in kickoff order, `teamNames`, and `scoredBy`. `scoredBy` gives first names only, or "the table", for that pitch only — the only way a marshal ever sees a name. The score sheet is the manager's inputs plus a required **Your name** box (1–40 characters), pre-filled from the last save on that phone. Other groups' matches on the same pitch are greyed out. A dead link shows one sentence and a Leave pitch mode button. The local start/pause/reset timer stores and sends nothing, and uses ONE interval that is never cleared (the `test-app-polling` rule). `viewNote()` renders nothing for the public when no token is stored.
- **`submit-result.js` tries the marshal token FIRST**, then the session. A marshal save is refused unless all of the following hold:
  - the match's age group equals the token's;
  - the match's pitch in the published draw equals the token's (a match that has moved pitch is refused);
  - it carries a name;
  - it does not clear a result;
  - it overwrites only a score a MARSHAL entered — a score the table entered is refused with "ask the table".

  The limit is thirty saves per ten minutes per link (bucket `marshal:<jti>`). Every entry carries `enteredBy: { kind, name, pitch? | username }`, and `submittedBy` is still written too.
- **Result history.** Before any overwrite or clear, by any writer, `_results.js` appends the previous entry to `hist:<matchId>` (twenty deep, newest first). `get-result-history.js` serves it to the group's manager or an organiser and refuses a marshal token. The `hist:` prefix sits outside `m:`/`ag:`, so `readAll()` never lists a history entry as a match.
- ⚠️ **`get-results.js` gives the PUBLIC only a fixed allow-list of scoring fields.** A manager or organiser session (`optionalSession`) gets the full record, which the Spirit award tab needs; `readStore(session)` in `scores-data.js` passes the token along. A marshal token gets the public version. Ruling: claude/decisions/2026-09-08-public-results-carry-no-names.md
- **The Marshals tab** shows one card per pitch with Issue / Issue new / Revoke. After issuing, it shows the QR code (from the vendored `qr.js`, loaded on demand), Copy link and **Print pitch sheet** (an A4 page with the QR code, pitch, group, day and four instructions). Once the page reloads, the token is gone from it. That is deliberate.
- `qr.js` at the repo root is qrcode-generator 1.4.4 (MIT), copied in unchanged with a header saying where it came from. It is on CLAUDE.md's do-not-read list.
- `tests/test-pitch-marshals.js` exercises all of the above.

## Publishing fixtures

Fixtures are draft-first. The `schedules` blob store keeps two copies for each age group:

- `<ageGroupId>` is the DRAFT, which the fixture editor reads and writes.
- `pub:<ageGroupId>` is the PUBLISHED copy, and the only thing the public sees.

The same store also holds `review:<id>` and `hist:<id>:<ISO>` (see Draw rights).

- `save-schedule-override.js` writes the draft only. It never makes anything public.
- ⚠️ **No save may strand a recorded score** (JRT-6 and JRT-26, 11 Sep 2026).
  Results are stored under the match id and carry no team codes. So
  `save-schedule-override.js` refuses (409) any save, organisers' included,
  that would remove a slot with a recorded result or change a team that slot
  named.
  - A scored slot's time and pitch may still change, and a blank side (a
    knockout placeholder) may be filled in.
  - It refuses (503) when it cannot read the results.
  - It only checks against a stored draft.
  - The Draw tab's rebuild keeps each existing pairing's slot id and sides
    (`regeneratePoolSlots`). It refuses before offering if a scored match
    would still be dropped.
  - To drop a played match on purpose, clear its score first.

  **Until 11 Sep 2026 every rebuild minted new ids, and a pool's scores
  dropped out of the standings.** Ruling:
  `claude/decisions/2026-09-11-draw-edits-keep-results.md`.
- `publish-schedule.js` copies the draft to the published copy, or deletes the published copy.
- `get-schedule-override.js` serves the published copy to the public. It serves the draft only to a caller who asks with `?draft=1`, has a valid session, and has access to that age group. A bad or missing token quietly gets the published view rather than an error.
- **Only organisers publish** (`publishDenialReason` in `_publish.js`). Every manager is refused with *"Only tournament organisers can publish fixtures. Send your draft for review instead."* `_publish.js` still exports `isTournamentWindow()` because `_drawRights.js` uses it.
- **A draw nobody has published is never shown to the public**, before, during or after the tournament. The answer carries `awaitingPublication: true` and the public pages say "coming soon", because a parent cannot tell sample pools from real fixtures. Staff see drafts and sample draws through `viewModeOf()`. Ruling: claude/decisions/2026-08-08-staff-see-unpublished-draw.md
- If the Publish button is not offered, text explaining why appears in its place. The button is never shown disabled without a reason.
- The draft draw also carries a `pitches` array, set in the editor, stored in the same blob.
- It also carries a **`teamNames`** map (`{ ADH1: 'AD Harlequins' }`), stored in the same blob. `publish-schedule` copies it to the public copy. This lets the public site show club names while the draw stores short codes, and a parent never touches `get-registrations`, which is organiser-only. Ruling: claude/decisions/2026-07-25-draw-teams-are-codes-with-published-names.md
- **`teamNames` is rebuilt from the registrations on every save**, by `withTeamNames()` in `Manager.dc.html`. Every `api.saveDraw` call goes through it. Names worked out from the registrations replace whatever is stored; nothing else writes the map (`onRenameTeam` rewrites the CODE, not the display name). If the worked-out map comes back empty, nothing changes, so a failed registrations fetch can never wipe the names. `teamNamesFromRegistrations()` is the only place the naming rule lives, and the import review table uses it too.

⚠️ **`loadDraw(agId)` on `/manager` starts with an entry guard, and the guard is essential.** It looks like a duplicate of the stale-response guard after the fetch, but the two guard opposite ends of the same call. Only an organiser gets the age-group switcher. It is a plain `<select>` that is never disabled, so it stays usable while the Draw tab is busy. `saveDraw()`, `doPublish()` and `doUnpublish()` each record `ageId`, wait for a network call, then reload **that** id to take the server's copy as the new clean starting point. If the organiser switches group while that call is running, the reload targets a group they have already left. Without the entry guard, the opening `setState({ draw: null, drawDirty: false })` blanks the NEW group's draw and clears its dirty flag. That throws away unsaved edits with no warning, and stops the next switch from warning either. `tests/test-manager-dc-draw.js` exercises it, including a fault that **inverts** the guard: "always return early" would pass every other check by never reloading at all, so the test asserts the normal path too. If a group has an unsaved draft, switching asks for confirmation and discards the draft.

⚠️ **Publishing the group the button was pressed on is CORRECT.** The confirm box names that group. The danger is the reload afterwards, not the write.

Other draw-editor behaviour:

- An unparseable kickoff time is rejected, never stored as NaN.
- Moving a team always empties the box it came from, so a team can never sit in two match boxes.
- A selected team is dropped when its pool is removed.
- Regenerating one pool's slots leaves every other pool alone. A new slot goes one slot length after that pool's last match.
- `regeneratePoolSlots()` creates match ids from `Date.now()`. Regenerating or reshuffling a pool after results exist therefore cuts those results off from the tables. This is a known problem and is not fixed.
- The local backend (`local-backend.js`) has no concept of publishing and reports `isDraft: false`, `published: !!schedule`. Offline development behaves as if everything is published. Do not "tidy" this.

## Registration store

Ruling: claude/decisions/2026-09-10-registrations-live-in-a-write-once-store.md

Every accepted registration is ONE record in the Netlify Blobs store `registrations` (`STORE_NAME` in `_regstore.js`).

- **Key:** `<form>/<ISO stamp, filesystem-safe>-<6 random chars>`.
- **Record fields:** `v`, `form`, `receivedAt`, `row` (in the sheet's column order), `rehearsal`, and an optional `supersedes`.
- **Write-once.** `writeOnce()` refuses a key that already exists, and `_regstore.js` has no update. A correction is a new record whose `supersedes` names the old key.
- `listRecords(store, form)` hides every record that another record names in `supersedes`. `listAll()` keeps everything; only the snapshot uses it.
- **Rehearsal records.** A record is a rehearsal (`isRehearsal`) if its club name STARTS with the word "Rehearsal". The flag is stored on the record.
- **Team numbering** counts live team records only (`teamRowsForNumbering`), so a superseded team does not keep its old code in use.
- **The readers.** `get-registrations.js` (organiser) and `get-my-registrations.js` (manager) return the same shapes the old sheet readers did, through `shapeForReaders()`, plus `rehearsal: true|false` on each row. A manager is filtered by the age group in the signed token, never by the request. No page displays the rehearsal flag yet.

**The snapshot.** `snapshot-registrations.js` runs every hour (`netlify.toml`). `shouldSend()` in `_snapshot.js` sends on every run while the registration window is open, and otherwise only on the 22:00 UTC run (02:00 in Abu Dhabi). The email goes to `MAIL_FROM` and to nobody else; nothing in any request can change the recipient. It carries CSVs for people to read, plus one `.json` machine file. **The machine file is the only thing a restore reads**, because a spreadsheet can mangle a leading `+`. The subject gives the date and the count for each form, and adds `REHEARSAL` when any rehearsal record exists.

**Restore and delete.** `tools/registrations-admin.js` offers `check`, `restore` (adds ONLY the missing records, and needs `--confirm <N>` where N is the missing count `check` printed), `delete --rehearsal`, and `delete --all --confirm ALL`. Both deletes require a snapshot. The tool refuses if any record in the store cannot be read, and it reads every write back. Deleting at the end of the season is a manual step. Procedure: `claude/runbooks/runbook-registrations-restore-and-delete.md`.

**Tombstone: Google Sheets.** The sheets were the registration store until the Blobs store replaced them. `_sheets.js` (the service-account sign-in, the private-key repair and the first-tab lookup) and the A1 ranges and `sheetEnv` names in `_intake.js` were deleted once the live rehearsal passed (JRT-1, JRT-2). Nothing may bring them back: `test-intake.js` fails if a function requires `./_sheets` or reads a `GOOGLE_` variable. The `googleapis` and `google-auth-library` packages are still in `package.json`; removing them is its own change.

## The sheet columns — one copy, at last

`netlify/functions/_intake.js` holds the column order for all three registration forms (`TEAM_COLUMNS`, `PLAYER_COLUMNS`, `CLUB_COLUMNS`), the functions that build a row, and the mappers that turn a row back into what `/organizer` shows. Each store record keeps its `row` in this order, so the readers' mappers are the same ones the sheets used.

- **The round-trip test is what matters.** Write a registration with the writer, read it back with the reader, and you must get the same thing back. A one-column shift would put a parent's phone number in the emergency-contact box.
- The A1 ranges (`A:N`, `A:P`, `A:U`) are **calculated** from the column counts, never typed in.
- `submittedAt` and `team-code` are added **after** the submitted data, so a submission cannot set its own timestamp or claim another club's team code.
- Every mapped field comes back as `''`, never `undefined`: a short row (trailing blank cells) must not show the word "undefined" in a column.
- `preferred-pool` is the LAST team column, not next to `age-group`. It was added after rows existed. Leave it there.
- ⚠️ Every value is stored as text, and no write path may use `USER_ENTERED`. `USER_ENTERED` would turn a typed `=` into a live formula and strip the `+` from phone numbers. `test-intake.js` checks it has not come back. `_sheets.js` keeps only auth and client helpers; it has no append.

### The allow-list

`cleanSubmission(form, data)` in `_intake.js` decides what a submission may contain. The request body is public input to an unauthenticated endpoint that stores children's data and sends mail from the tournament domain to an address taken from that same body.

- Unknown keys are **dropped, not refused**: a browser extension or proxy adding a field must not cost a coach their registration. Each dropped field is **logged by NAME**. ⚠️ Never log a field VALUE.
- `submittedAt`, `team-code` and `team-name` are in neither field list. The server generates all three. The team code is what the draw and the printed pitch flags are keyed on.
- The form name must match **exactly**. An unknown form returns `null`, not an empty result, because "we do not know what this is" and "a valid form with nothing filled in" are different answers.
- The result is built with `Object.create(null)`, so a submitted `__proto__` cannot reach the prototype chain.
- `bot-field` (the honeypot) is allowed **through** the filter so validation can see it. It is not a column, so it can never be stored.
- **The field lists and the columns are checked against each other in both directions.** A field with no column would be silently thrown away; a column with no field would always be empty.

## Club-level registration, behind a keyed link

Ruling: claude/decisions/2026-08-02-club-registration-removed-then-restored.md

A club declaration says how many teams a club expects to bring to each age group. It creates no teams and no team codes. **The page is `Club.dc.html`, served at `/register-club`.** There is no club form on the public homepage, and a test checks that it has not come back.

**What the form requires:** club, contact name and contact email. Phone is optional. At least one age group must have a count of 1 or more, and each count must be a whole number from 0 to 10 (`MAX_TEAMS_PER_GROUP`). The confirmation email says each team must still register separately. There is no way to edit a declaration: sending it again creates a new record, and the organiser reads the latest one.

### The `/organizer` Clubs tab — declared vs registered

One row per club: the declared total, the registered total, a **Short / Over / On track** badge, and the contact. Expanding a row shows the breakdown by age group, with mismatched rows tinted. A "Show only clubs to chase" filter is available, and the number of flagged clubs shows on the tab button itself.

⚠️ **The two sides are matched on free text typed by two different people.** The club contact types the club name on the declaration; a coach types it again on each team registration. There is no club id anywhere. `normaliseClubName()` in `Organizer.dc.html`:

- lowercases and removes accents;
- **removes** apostrophes rather than turning them into spaces (`St George's` must match `St Georges`);
- turns other punctuation into a **space** (`St.Georges` must match `St Georges`);
- collapses whitespace;
- strips ONE club-type suffix, only at the **end**. Stripping everywhere would turn `RC Sharks` into `Sharks` and merge two real clubs. ⚠️ **An over-eager matcher is worse than a cautious one**: a wrong match produces a believable number nobody questions, whereas a missed match shows up in the "registered but never declared" panel.

⚠️ **The "registered but never declared" panel is essential.** It lists clubs that registered without declaring, and it is also where a failed name match lands, so a bad match shows up as an odd row.

- Over-registration is flagged too. More teams than planned still changes pools, pitches and the draw.
- A blank, `0` or unreadable declaration box all mean "none declared".
- Under each club, only age groups with a number on at least one side are listed.
- Age groups are matched through `MANAGER_AGE_GROUPS` (team records store the display NAME, declarations store the ID), never through a second mapping. A team with an unrecognised group name still counts towards its club's total.
- ⚠️ **`get-registrations.js` reads club declarations FAIL-SOFT**, the only one of the three it treats that way. Teams and players are the tournament; declarations help with planning. An unreadable club list must not cost an organiser the Teams table. `clubsUnavailable: true` tells that case apart from "nobody has declared yet".
- `tests/test-organizer-clubs.js` drives the real component, checks the name pairs in both directions, and covers all fifteen age groups.

### ⚠️ THE CLUB FORM IS EXEMPT FROM THE REGISTRATION WINDOW

A declaration is not an entry. It is planning information, collected weeks before registration opens so pools, the draw and pitches can be planned. In `handleSubmission` the window check (step 4) is skipped when `form === 'club-registration'`. Declarations are not stopped when the window closes either. The key is the on/off switch.

⚠️ **This is not a hole, because the club form has a stronger gate and has already passed it before the window check is skipped:** `CLUB_FORM_KEY`, checked at step 2b. Deleting the variable shuts the form, but ⚠️ **NOT instantly**: running functions only see an environment-variable change after a new deploy. Allow for a deploy when switching it off, and check that a submission is actually refused before believing it is. **The team and player forms are public and stay behind the window.** The prover has faults for widening the exemption to them, for inverting it, and for folding the key check into it. `test-intake.js` checks the exemption against **every** way the window can say no (closed, unreadable, `registrationState` throwing), and checks that the window is **not read at all** for a declaration.

### ⚠️ UNLISTED IS NOT PROTECTED — this is the whole design

Four things keep the page out of sight, and each is tested separately:

- nothing on adhjrt.com links to it;
- it is not in `sitemap.xml`;
- the page carries `noindex, nofollow` in its literal `<head>`;
- **`robots.txt` does NOT name it**. A `Disallow` line would advertise the path in a public file.

**None of that is protection.** The repo is public, so the rewrite in `netlify.toml` and the filename are visible to anyone. The only guard is a secret that is not in the repo: **`CLUB_FORM_KEY`, an environment variable, checked SERVER-SIDE** in `_intake.js`'s `clubKeyOk()`. The page reads the key from the query string (`/register-club?k=…`) and sends it back with the submission.

- **Checked at step 2b of `handleSubmission`**: after the allow-list has identified the form, and BEFORE validation, the window, numbering, storage and email. A caller without the key cannot make the server do any of that work. The prover has faults for removing the check and for moving it below the write.
- ⚠️ **FAILS CLOSED.** If the variable is missing, every club submission is refused. The rate limiter, by contrast, fails OPEN. Making the two consistent would be a mistake, and there is a fault for it.
- ⚠️ **ONLY the club form is gated.** Gating every form would shut registration for the whole tournament. This is tested with the variable UNSET.
- ⚠️ **The key travels BESIDE `data`, never inside it**, as a top-level property of the body next to `form`. So it can never be stored. A key placed inside `data` unlocks nothing.
- **Never logged.** A wrong key and an unset variable get the identical 403 reply.
- Guessing is limited by the step-1 rate limit: twenty attempts per address per hour against a random key.
- The organiser page keeps the full link and reports whether its key still works. Ruling: claude/decisions/2026-08-11-club-invite-link-is-organiser-only.md

**The page's fifteen age groups are a second copy** of the list in `_agegroups.js`, because the page imports nothing. `test-intake.js` compares the two lists in both directions and checks their order.

## Netlify Forms is GONE — the registration gateway

Ruling: claude/decisions/2026-07-27-registration-gateway-refuses-before-it-writes.md

Registrations never touch Netlify Forms. The page sends a `POST` straight to `/.netlify/functions/submit-registration`, which validates the submission, stores the record and sends the confirmation itself. `netlify-forms.html` and `submission-created.js` no longer exist. The Forms feature is still switched on in the Netlify UI; with no form registered it does nothing and costs nothing.

⚠️ Going back to Netlify Forms would give up the age checks, the squad cap, the registration window and the rate limit. All of them exist only because this code is the front door.

### Every function is loaded and called by a test

`tests/test-functions-load.js` loads **and calls** every file in `netlify/functions/`. A missing `require` fails only when the code runs (a ReferenceError), not when the file is parsed. The handler's own catch then turns it into a 500, which a user reads as "there is no data". `node --check` cannot see this.

- The three packages a fresh clone lacks (`googleapis`, `bcryptjs`, `google-auth-library`) are **stubbed**, and the stubs return believable answers rather than throwing. A throwing stub would turn every signed-in call into a 500 and hide exactly the faults this file exists to catch.
- It calls every handler **signed out** (expecting 401/403/405, never 500), and calls the readers **signed in** with a real token made by `sign()`.
- ⚠️ **The signed-in half is essential.** Signed out, a 401 comes back before the handler reaches the code behind the auth check, so a broken call there goes unnoticed.
- The rule: a check that a file does NOT contain something is not a test on its own. Pair it with one that runs the file.

### The page posts to the gateway

`postRegistration(form, data)` in `Quins JRT.dc.html` sends JSON to `/.netlify/functions/submit-registration`. The registration modals exist only while the registration window is open.

⚠️ **A REFUSAL AND A NETWORK FAILURE ARE DIFFERENT AND MUST STAY DIFFERENT.**

| | means | so the page |
|---|---|---|
| refusal | we received it and it is wrong | shows **the server's own sentence** and keeps the form |
| network failure | we do not know whether we received it | says try again, and keeps the form |

`SubmitError` carries `isNetwork` so the two can never be merged.

- A reply that is not valid JSON counts as a **network failure**: something else answered, such as a proxy, a captive portal or a platform page.
- `ok: false` inside a **200** response is still a refusal.
- The browser runs its own checks first, for instant feedback. The server has the final say.
- The success screen shows the **team code**.
- The page sends no `'form-name'` field and has no `encodeFormData()`. Any check that relies on those strings is looking at code that no longer exists.

### The gateway function

`netlify/functions/submit-registration.js` is the front door. It builds the real store, mailer and window reader, passes them to `handleSubmission()`, and turns the answer into an HTTP response. **It makes no decisions itself.** Keep it thin: a rule added here is a rule no test can check. `test-intake.js` checks that the split holds (no `validateSubmission`, no `teamRow`, no column list in the adapter).

- **POST only.** The body is capped at 64 KB, measured with `Buffer.byteLength(` **before** `JSON.parse`. ⚠️ The test looks for the measurement, not the `MAX_BODY_BYTES` constant: the constant's declaration alone would pass while the real check was missing.
- The rate-limit bucket comes from `x-nf-client-connection-ip`, Netlify's own header. **Never `x-forwarded-for`**: the caller supplies that one, so anyone could choose their own bucket.
- No CORS header; same origin only. Every reply is `no-store`.
- Team numbering reads live team records from the store.
- A failed store write puts the submission in the `config` store at `failed-submissions/<stamp>-<rand>`, NOT in `registrations`. A parked submission is a failure to record, and must never appear on an organiser's screen or in a snapshot. ⚠️ **That blob holds children's personal data.** Do not widen access to the `config` store or expose it through any endpoint, and clear each entry once it has been replayed.

### The submission flow

`handleSubmission(body, deps)` in `_intake.js`. Every dependency is passed in, so a fresh clone with no `node_modules` can test it. **The order is the design.** Most of the injected faults leave each rule working and break the order.

1. **Rate limit.** First, because it is the only thing between a public endpoint and unlimited writes and emails. Fails OPEN. Refusal: 429.
2. **Allow-list.** An unknown form is refused (400). Dropped field names are logged.
2b. **Club key**, for the club form only (above). 403.
3. **Validation**, which also handles the honeypot. A filled honeypot gets a reply **byte-identical to a real success** and processing stops here, so a bot cannot make the server do any I/O and learns nothing.
4. **The registration window**, skipped for the club form. ⚠️ **Fails CLOSED**: an unreadable window refuses (403). Allowing an entry after the squads were meant to be fixed is the expensive mistake here. Ruling: claude/decisions/2026-07-27-registration-window-server-decides.md
5. **Team code**, teams only. ⚠️ **If the numbering read fails, or returns something that is not an array, the submission is REFUSED (503).** Numbering from an empty list would reissue a code that already exists, and a team code is the team's identity in the draw, standings and match ids. A declaration creates no code.
6. **The record.** If the store write fails, the submission is parked for replay, the answer is 500, and **no email** is sent. A confirmation for something that was not stored is worse than none, because the coach stops chasing it.
7. **The confirmation**, after the record, with any error swallowed. A mail failure must never cost a registration or push anyone into submitting twice.

`handleSubmission` **never rejects**. This is tested with every dependency throwing.

⚠️ **No field VALUE may reach a log.** This is tested with a marker string in every free-text field, down every path including the failures. Only dropped field NAMES are logged. ⚠️ The marker goes in free-text fields only, and the test checks that the marked submission still returns 200 before relying on it. Marking every field would fail validation and never reach the paths the test exists to check.

### Rate limiting

`netlify/functions/_ratelimit.js`. **Twenty submissions per address per hour**, counted in the `config` store under `ratelimit/<address>`. The biggest squad is 18, so a club secretary entering a whole age group by hand still fits.

- ⚠️ **IT FAILS OPEN.** If the counter cannot be read or written, the submission is **allowed**. Losing a real registration to a storage hiccup is worse than the abuse the limit prevents. This is deliberate and tested.
- **Fixed window, not sliding**: the hour starts at the FIRST hit. With a sliding window, continuous tries would keep an address blocked for ever. ⚠️ To test this, spread the hits out in time: twenty hits at the same instant cannot tell a fixed window from a sliding one.
- A request with no address shares **one bucket**; it is never skipped. Otherwise sending no address header would get round the limit.
- The address comes from a header, so the key is **sanitised**. A slash in the header must not be able to write to a key of its choosing in a store that also holds the venue layout and the registration window.
- A window stamped in the **future** is treated as stale, so clock differences between servers cannot extend a lockout.
- ⚠️ `readWindow()` takes the caller's `windowMs`. Every limit with its own window (login, signup, marshal) depends on this. With the module's one-hour constant, a 15-minute limit would silently last an hour while telling people fifteen minutes.

### Signing in is rate limited per ACCOUNT, and only failures count

`ACCOUNT_RATE_OPTS` / `CONNECTION_RATE_OPTS` in `login.js`, built on `peekRate()` / `recordFailure()` / `forget()` in `_ratelimit.js`. **A correct password costs nothing against either bucket.**

| Bucket | Budget | Job |
|---|---|---|
| `${ip}:${username}:login` | 10 / 15 min | protects ONE account's password from a script |
| `${ip}:login` | 50 / 15 min | backstop against trying a LIST of usernames |

Every manager at the venue shares one connection address, so counting correct sign-ins would lock out the whole venue on tournament morning.

- **Peek first, record later.** Reading a counter changes nothing. Only the failure branch calls `recordFailure`.
- **A correct password CLEARS the per-account bucket** (`forget`), so a few typos followed by a success leave a clean slate.
- ⚠️ **It must NOT clear the connection bucket.** Otherwise someone sweeping through usernames could reset it by signing in correctly every 49 guesses. There is a fault for this.
- ⚠️ **`bcrypt` runs even when the username does not exist**, against `DUMMY_HASH`. Otherwise a real username would answer measurably slower than an unknown one, which would let an attacker sort a wordlist into real accounts.
- `hub-auth.js` records failures against the same `${ip}:login` connection bucket.
- `tests/test-login-ratelimit.js` drives the real handler through fifteen managers against a SHARED store. ⚠️ "All fifteen get in" guards the *failures-only* half. The *per-account* half is guarded by "mgr2 on the same wifi is unaffected".

### Signup attempts are rate limited too

`SIGNUP_RATE_OPTS` / `checkSignupRate()` / `tooManyResponse()` in `_ratelimit.js`. **Ten attempts per address per 15 minutes, in ONE `${ip}:signup` bucket shared by `organizer-signup.js` and `manager-signup.js`.** Both check an invite code with a plain string comparison, so without a limit the codes could be guessed endlessly.

- One bucket for both endpoints: two budgets for guessing the same secrets would just double the guesses. It is kept separate from `:login` and from the registration bucket.
- Fails **OPEN**, like every use of this module. Anyone who gets through still lands PENDING. `organizer-signup.js` approves an account automatically only when no organiser exists yet (`isFirstOrganizer`), and `login.js` refuses a pending account with a 403.
- `tooManyResponse()` holds the only copy of the 429 message; `login.js` uses it too.
- `tests/test-signup-ratelimit.js` drives both handlers.

### Validation

`validateSubmission(form, clean)` in `_intake.js` applies on the server the same rules the browser already applies, so editing the page cannot get round them. It also checks the dates of birth on a squad list (see "Age validation on the roster").

**The error messages are copied character for character** from `submitTeam()` and `_playerFormError()`. `test-intake.js` reads both out of the page and fails if either changes.

- ⚠️ **`age-group` is required on the TEAM form and NOT on the player form.** `_playerFormError()` does not ask for it and `emptyPlayerForm()` starts it blank. The server matches the browser: a rule the parent was never shown would look like a bug. Whether the player form should require it is an open question about the form, not this code.
- Consent must be exactly the string `'Yes'`. Values such as `'true'`, `'on'` or `'yes'` come from a client this project did not write and do not count as consent.
- **The honeypot is accepted, not refused, and checked FIRST.** A bot told "no" tries again; a bot told "thank you" goes away. Checking it first also stops a bot reading the rules back out of the error messages.
- A squad list that is not a JSON array means the page itself is broken, not that the coach made a mistake, and the error message says so.
- The squad cap comes from the group (`squadCap`), and every group's own cap is tested across all fifteen. ⚠️ Do not add a flat maximum: an unrecognised group is refused first, so a flat cap could never apply. A rule that can never fire is worse than no rule.
- ⚠️ A fault only counts if it changes something. The range fault must add a column AND leave the range unchanged; hardcoding today's correct range changes nothing and proves nothing.

## Age groups, server side

`netlify/functions/_agegroups.js` holds the fifteen age groups: id, name, `ages` at the UAERF cut-off date, format and `squad` cap. It is a **second copy** of `AGE_GROUP_INFO` in `Quins JRT.dc.html`, for the same no-build-step reason `DEFAULT_VENUE` is duplicated. `test-agegroups.js` checks the two copies are identical. The gateway enforces the squad cap on the server.

- `squadCap(name)` matches the group name **exactly**. For an unrecognised name it falls back to `MAX_SQUAD_ANY_GROUP` (the largest cap, 18), the same as the browser, so a squad list typed before a group is chosen is never refused. The fallback can only ever be *more* lenient than a real cap.
- ⚠️ **Do not "tidy" the caps.** All four girls' groups play 7s with a squad of 12, U16G and U18G included. That is why they differ from the boys' groups of the same age. No rule produces them.
- The ids must match the keys of `DEFAULT_VENUE`'s `groups` object; `test-agegroups.js` checks this. If they drift, a registration silently loses the day it plays on.
- ⚠️ A test must be able to tell its two answers apart. The case-sensitivity check uses U16G (cap 12), not a group whose cap equals the fallback (18), because otherwise it would pass against the fault.

### Age validation on the roster

Ruling: claude/decisions/2026-07-28-team-form-age-check-flags-play-up.md

Every row of a team's squad list runs the player form's own age check. `_agegroups.js` holds a server copy of `PREV_GROUP_ID`, `AGE_GRADE_CUTOFF_DATE`, `calcAge()` and `fmtAges()`, copied character for character. `ageGroupCheck(dob, groupName)` returns `{status: 'ok'|'playUp'|'blocked'}`. `test-agegroups.js` compares `PREV_GROUP_ID` with the browser's copy and tests one year either side of every group's age band, for all fifteen groups.

⚠️ **`calcAge()` stays a literal copy of the browser's `Date`-based code.** Do not rewrite it as "safer" string arithmetic: a different algorithm that agrees today can drift from the browser with no test able to notice. It is safe in any timezone, because `new Date(dob + 'T00:00:00')` never converts through UTC.

- **A play-up is allowed and flagged, not blocked.** For most groups that means exactly one group young. On the player form a play-up needs a parent's consent box. On a squad list the row is flagged in amber under the row, with nothing depending on it, and the squad still submits. The flag is not stored: it can be worked out from the stored `dob` and `age-group`. `/organizer` does not show it yet.
- **Anything further out, or too old, is refused**, in both the browser and the server.
- **A named row with no date of birth blocks the whole squad**, in both the browser and the server. A row with both names blank is never checked.
- Dates of birth on the squad list are entered as three dropdowns through the same `composeDob()` the player form uses, never a native date input (which rolls `31 February` over to `3 March`).

### The wide (two-year) girls' play-up allowance

All four girls' groups — `u12g` (U12G QR), `u14g` (U14G QR), `u16g` (U16G Contact), `u18g` (U18G Contact), listed in `TWO_YEAR_PLAYUP_GROUP_IDS` in both copies — allow a play-up of **up to two age groups young**, measured by plain arithmetic on the group's lowest age rather than the `PREV_GROUP_ID` chain. Every other group uses the one-step chain. The reason: there is no girls' group at age 12, so a 12-year-old girl would fall into the gap between U12G QR (11) and U14G QR (13).

⚠️ **U16G and U18G are Contact (tackle), not Quick Rip.** Including them is a deliberate safety decision covering all four groups, not just the two QR ones. Do not narrow it without asking.

- The mechanism is unchanged: the same flag, the same consent box and the same check at submit time. The consent box's wording is neutral ("as described above"), because the message above it says one or two groups as appropriate.
- `playerEmail()` in `_email.js` reads `play-up-consent`. When it is `'Yes'`, the email adds `(playing up)` to the Age group row and a sentence crediting the parent's or guardian's consent. Team emails do not, because a coach's squad flag cannot be credited to any one parent's consent. `tests/test-email.js` renders the templates for real.

## The Teams/Players tables are grouped by club and age group

`_filteredTeams()` and `_filteredPlayers()` in `Organizer.dc.html` sort every row with `byClubThenAgeGroup()`: club name (ignoring case), then the group's real youngest-to-oldest position, then `submittedAt` to keep ties stable. Filtering to one age group makes the age key the same for every row, so the rows fall into clubs. Filtering to one club makes the club key the same, so that club's rows fall into age groups, youngest first. The same sort handles both.

⚠️ **The age-group order is NOT alphabetical.** `AGE_GROUP_ORDER` maps each group's name (as stored, e.g. `"U12G QR"`) to its position in `MANAGER_AGE_GROUPS`, which is already in age order. An unrecognised name sorts last rather than throwing.

`groupRowsByClub()` turns the sorted list into `[{ club, count, rows }, ...]`. `renderVals()` passes these on as `teamGroups`/`playerGroups`, and the template shows a highlighted `CLUB NAME (n)` sub-header row across all 12 columns before each club, using a nested `<sc-for>`. ⚠️ **It spots a new group when the club differs from the previous row**, so it relies on the list already being sorted by `byClubThenAgeGroup()`. On unsorted rows, a club that appears twice would get two header blocks.

**CSV export.** `exportCsv()` reads the same two filtered methods, so the export is ordered exactly like the screen. It uses the flat `teamRows`/`playerRows`, so it contains no header rows. `Component.csvSafe()` puts a leading apostrophe before any cell starting with `=`, `+`, `-` or `@`, on every column. Excel and Sheets would otherwise treat such a cell as a formula, which turns every stored phone number into an equation.

**The squad list in the Teams table.** A team record's `players` column holds the squad as a raw JSON string. Clicking a team's "# Players" count expands a detail row listing `Name (dob)`. There is no backend involved.

- `Component.parseRoster(playersJson)` returns `[{ name, dob }]`. It is wrapped in try/catch and checks `Array.isArray()`, so one bad `players` cell shows an empty squad instead of breaking the table. A row with no name shows `(no name)`; a missing date of birth shows `—`.
- `state.expandedTeam` holds the **team code** (`r.teamName`, a generated code, safe as a key) of the one expanded team, or `''`. `toggleTeamExpand()` toggles it.
- Each row also computes `roster`, `rosterCount`, `hasRoster`, `isExpanded`, `toggleLabel` (▼/▲) and `onToggleRoster`. The count is only a clickable button when the squad is not empty.

⚠️ **The squad list in `/organizer` is for display only.** It does not show the play-up flag. Showing it would mean reusing the age-check logic here, and that is a separate decision.

## Documents shared with managers

An organiser uploads a file on `/organizer` → Documents; each age-group manager
sees the files tagged for their group on `/manager` → Documents. It solves
distribution, not storage: success is a manager opening `/manager` on match
morning and finding the current documents for their group without asking.

Ruling: claude/decisions/2026-08-07-documents-shelf.md

| | |
|---|---|
| `netlify/functions/_documents.js` | every decision — dependency-free so tests can drive it |
| `netlify/functions/documents.js` | the HTTP door — auth, blob stores, no decisions |
| `documents` blob store, key `list` | the index, one blob rewritten whole |
| `docfiles` blob store, key `<id>` | the bytes, one key per document |
| `/organizer` → Documents | upload, tag, edit, stop sharing (hide), restore, delete for good |
| `/manager` → Documents | list and download only; `tests/test-documents.js` asserts the absent verbs by name |

### Size

- The platform refuses a request body above roughly 6 MiB minus about 9 KB of
  envelope (6,279,168 B passes, 6,285,312 B is refused), with a **413 and an
  empty body** — the function never runs. Detail in `_documents.js`.
- Base64 costs 4/3, so `MAX_FILE_BYTES` in `_documents.js` is 4 MiB, and
  `MAX_DOC_BYTES` in `Organizer.dc.html` is the same number;
  `tests/test-documents.js` asserts they match.
- ⚠️ **The picker checks the size client-side and refuses in its own words.** A
  413 with no body parses as neither a refusal nor a network failure, so there is
  nothing else to show.

### The rules

- ⚠️ **The tag filter runs server-side, on the list and on every download.** The
  age group comes from the verified token; there is no code path that reads one
  off the request (`tagsAllow()`, `canRead()`).
- ⚠️ **A hidden (withdrawn) document is refused by the download path**, not only
  left out of the list. A manager who kept the URL gets nothing. Organisers see
  hidden rows in their own shelf (`?deleted=1`); managers are never told a row is
  hidden.
- ⚠️ **An empty tag selection is refused, never read as "everyone".** `*` means
  every signed-in manager plus organisers — never the public; a signed-out request
  gets 401. `['*', 'u12']` collapses to `['*']`; an unknown group id is dropped.
- ⚠️ **The type check is on the bytes.** Types allowed: PDF, PNG, JPG, XLSX, DOCX.
  XLSX and DOCX are both ZIP and cannot be told apart by magic bytes, so the check
  is "the bytes are a ZIP and the declared type is allowed" — a renamed
  executable still fails. Do not trust the filename.
- PDF, PNG and JPG can be viewed in the browser; the view button is absent (not
  disabled) for Office files, because the only in-browser Office viewers need a
  public URL.
- **Fail soft on read** (the list returns `unavailable: true` with no rows, so a
  documents outage never takes out fixtures or scoring) and **fail closed on
  write**. Not to be made consistent.
- **Stop sharing is soft and has no confirmation; Delete for good has a typed
  one**, and the word to type is the document's own title, not a fixed word.
- ⚠️ **The index is one blob rewritten whole**, so two organisers uploading in the
  same second lose one upload with no error. Accepted because uploads are rare;
  the file bytes are per key. If documents ever become something people add
  during a tournament, split the metadata per key.
- ⚠️ **Uploads go to Blobs and never the repo.** The repo root is the deployed
  site; a committed document naming a child cannot be un-published.
- `/organizer`'s tab list and `/manager`'s `MANAGER_TABS` are each asserted as an
  exact list, so adding a tab fails a test until the list is updated.

---

## Venue — pitches and days

Ruling: claude/decisions/2026-07-26-venue-layout-is-configuration.md

**Which day an age group plays is derived from where it has pitches.** It is not
a separate list and must never become one. If you find yourself typing a list of
age groups next to a day, stop.

The layout is `DEFAULT_VENUE` in `netlify/functions/_venue.js`: for each of
`day1` and `day2`, a `date`, `label`, `short`, a `splits` object saying how each
main pitch is cut up that day, the derived list of surfaces in `pitches`, and
`groups` mapping each age group to the surfaces it may use.

**The tournament dates live in `DEFAULT_VENUE` and nowhere else.** `mergeVenue()`
and `validateVenue()` always take `date`, `label` and `short` from the code and
ignore them in a saved blob or a payload, so a saved venue cannot override them
and there is no back-office control for them. Moving the dates is a code change
and a deploy. (The homepage JSON-LD, the format-section day tags and page prose
do not derive — see `CLAUDE.md`.)

The default layout:

| | Surfaces | Groups |
|---|---|---|
| **day1 (Saturday)** | 18 — D5a/b, D4a/b, D3a/b, D2, D1, C4, C5, B1a–d, A1a–d | u6, u7, u8, u9, u10, u11, u12, u18b, u18g |
| **day2 (Sunday)** | 10 — D3, D2, D1, C4a/b, C5, B1a/b, A1a/b | u12g, u13, u14b, u14g, u16b, u16g |

- **D4 and D5 are time-shared on Saturday** — U6 in the morning, U7 in the
  afternoon — so `u6` and `u7` hold the same four surfaces. No special case: it
  is two pools on one pitch at different times.
- Sub-pitch letters are **ours**. The venue map draws the boxes inside one
  outline without naming them, so these names must match the printed pitch flags.
  The suffix is lowercase (`D3a`, `B1c`).

### Main pitches and splits

`MAIN_PITCHES` is the fifteen main pitches, in layout order (the order the
schematic draws them and the order `derivePitches()` emits surfaces):

```
D5 D4 D3 D2 D1  C4 C5 C3 C2 C1  B1  A1 A2 A3 A4
```

There is no B2 — the B2 on the venue's map is the softball diamond.

Each main pitch is run whole, in halves or in quarters on a given day:
`SPLITS = [1, 2, 4]`. Nothing else — a third suffix letter would break every name
downstream parses.

| stored | surfaces |
|---|---|
| `{ D2: 1 }` | `D2` — a whole pitch keeps the bare name, so every saved fixture on `D2` still means D2 |
| `{ D3: 2 }` | `D3a`, `D3b` |
| `{ B1: 4 }` | `B1a`, `B1b`, `B1c`, `B1d` |

- **A main pitch absent from a day's `splits` is not in use that day.** Absence,
  not `0`.
- **The split is per pitch AND per day.** D3 is halves on Saturday and whole on
  Sunday; C4 the reverse.
- **`splits` is the input; `pitches` is output**, always rebuilt from `splits`.

#### The functions

In `netlify/functions/_venue.js`; `derivePitches` and `remapGroupPitches` are
also in `scores-data.js` (the front end needs an answer before any fetch lands),
and `organizer-data.js` re-exports from `scores-data.js` — there is no third copy.

- `derivePitches(splits)` → surface names in `MAIN_PITCHES` order; skips an
  illegal split rather than guessing.
- `splitsFromPitches(pitches)` → the other direction, for a layout saved before
  splits existed. An odd count **rounds up** (three surfaces becomes quarters):
  inventing a fourth is recoverable, deleting a third is not.
- `remapGroupPitches(list, oldSplits, newSplits)` → renaming caused by a split
  change.
- `resolveSplits(src)` → the one place splits are resolved, used by both the read
  path (`mergeVenue`) and the write path (`validateVenue`). Empty is not absent:
  a `splits` object whose keys are all unrecognised falls through to
  `splitsFromPitches`, and if neither yields anything the reader uses the default
  day and the writer reports "has no pitches".

**The invariant: a group keeps the same ground; only the names change.** Split a
pitch a group had whole and it gets every part; merge the parts and a group on
any one of them gets the whole pitch. `tests/test-venue-splits.js` asserts this
as a property across every legal transition. A main pitch taken **out** of the
day is the one case where a group loses the allocation, and the panel confirms
first, naming the groups affected and how many saved matches are on it.

#### On the server

- `validateVenue()` treats `splits` as the source of truth and rebuilds `pitches`
  from it, never trusting the payload's list. A payload with only `pitches` (an
  older client, a hand-edited blob) still validates with splits inferred —
  nothing to migrate by hand.
- Refused **by name**, never silently dropped: an unknown main pitch, a split
  other than 1/2/4, an unknown age group, a group on a surface not on its day, a
  group on **both** days (a silent day1 coin-flip in `dayIdOf()`), a group on
  **neither** day (no date, broken countdown).
- It trims, drops blanks, de-duplicates, and canonicalises a group's pitch names
  to the day's spelling (case-insensitive match).
- **Deliberately allowed, as warnings (`venueWarnings()`), not refusals:**
  - an age group with an **empty** pitch list — "which day" and "which pitches"
    are separate decisions and the day has to be settable first;
  - **two groups on the same pitch** — that is a time-share, told apart by time
    in the clash check;
  - a day with no pitches at all is warned about as well.
- `derivePitches(DEFAULT_VENUE.dayN.splits)` reproduces both shipped `pitches`
  arrays exactly, and `validateVenue(DEFAULT_VENUE)` round-trips unchanged — both
  asserted in `tests/test-venue-splits.js`.
- `mergeVenue()` **replaces a day wholesale**, never field by field: merging
  pitch lists would make removing a pitch impossible, merging `groups` would make
  moving a group off a day impossible.
- `loadVenue()` caches per function instance; a read failure falls back to
  `DEFAULT_VENUE` so fixtures never go down with the config store.
- `GET /venue-layout` is public. `POST /venue-layout` is organiser-only (a
  manager gets a 403 that explains why) and saves `{ venue }` to the `config`
  store at key `venue`. `{ reset: true }` **deletes** the key rather than writing
  defaults back, so a later change to `DEFAULT_VENUE` reaches a reset site; no page
  calls it — it is kept as an escape hatch. `{ resetPositions: true }` resets the
  map positions separately. An organiser's GET also returns `usage` from
  `countPitchUsage()` (draft first, published as fallback; not public).

### Where it lives — the copies you must keep in step

| Copy | Why |
|---|---|
| `netlify/functions/_venue.js` | the server's answer; served by `venue-layout.js` |
| `scores-data.js` (`export const DEFAULT_VENUE`) | the front end's offline fallback and its answer before any fetch resolves |
| `Quins JRT.dc.html` (`AGE_GROUP_CARDS[].day`) | the public "Find your age group" cards — no build step, no import of the data layer |

Three copies are the cost of having no build step. Change one, change all.
`tests/test-homepage-dates.js` checks `AGE_GROUP_CARDS` days and the countdown
fallback against `_venue.js`'s `DEFAULT_VENUE`. ⚠️ **Nothing in the repo suite
compares the `scores-data.js` copy with `_venue.js`** — source comments cite a
`test-venue.js` that is not in `tests/`. The two copies are identical as of this
rewrite; check by hand after editing either.

### Reading it

From `scores-data.js`: `loadVenue()` once at start-up, then the synchronous
`venue()`, `dayIdOfAgeGroup()`, `dayOfAgeGroup()` (yyyy-mm-dd), `isDayOne()`,
`dayLabelOfAgeGroup(id, short)`, `pitchesForAgeGroup()` and `pitchesOnDayOf()`.
All answer from the built-in default until the fetch lands, so nothing waits on a
config fetch and nothing is undefined. A group missing from the layout gets
`null` from `dayIdOfAgeGroup()` but day 1 from `dayOfAgeGroup()` — the countdown
does date arithmetic on it and a null would render "NaN".

### Editing it — the Venue & days tab

`/organizer` → Venue & days, under TOURNAMENT CONFIGURATION. **Organisers only**:
which day a group plays and which pitches it owns affect every other group.

- **The same rules run client-side** in `venueVals()` / `venueProblems()` so Save
  is disabled with the reason shown rather than bouncing off a 400. The server is
  the authority. ⚠️ Nothing in the repo suite asserts the two agree (comments
  cite a `test-venue-panel.js` that is not in `tests/`); if they diverge, Save
  goes green on something the server refuses, or bounces with no explanation.
- **All fifteen main pitches are listed on every day card, in use or not**, each
  with Not used / Whole / Halves / Quarters. A pitch you cannot see is one you
  cannot change.
- **There is no box to type a pitch name.** Names are derived and cannot be
  typed; free text is how `C4`, `c4` and `Pitch C4` became three pitches the clash
  check could not reconcile. `tests/test-venue-splits.js` asserts the box has not
  come back.
- `setPitchSplit(dayId, main, n)` calls the server's own `derivePitches()` and
  `remapGroupPitches()` through `api.*`, so the panel cannot disagree with what
  will be stored.
- **Taking a pitch out** of the day confirms first, naming the groups that lose it
  and how many saved matches are on it. **Changing a split** that would strand
  saved fixtures also confirms, and says that allocations move across on their own
  but **fixtures do not**.
- Moving a group to the other day **clears its pitch assignment**, after a confirm
  naming what is cleared — the two days' pitch lists differ, and keeping names
  that exist on both (`B1a`, `D2`, `D1`) would put a group on a pitch nobody chose.
- Age-group rows show surfaces **grouped by main pitch**, with one click to take
  or drop a whole pitch. Only pitches in use that day are offered.
- **Reset clears every group's pitch assignment in the working copy** — days,
  splits and map positions are kept, and nothing is saved until Save.
  `doResetVenue()` asks; `reallyResetVenue()` does it.
- Every confirm in the panel is `confirmModal(message, onConfirm, opts)` with a
  button that says what it does (`Clear assignments`, `Move to Sun`, …), and
  nothing reaches the server until the dialog is answered. Never `window.confirm()`
  — it is blocked inside the component engine.

### A pool is a pitch's day

A pool's pitch and start time are **derived from its slots, never stored on the
pool**. This is the thing to preserve:

- the public fixtures page, the standings and the app read `slot.pitch` and
  `slot.startMins` — no reader needs to know about pools;
- `saveDraw()`'s allow-list needs no new field;
- an old saved draw needs no migration;
- a pool header can never disagree with the fixtures under it.

`poolPitchOf()` (in `Manager.dc.html`) returns the pitch all a pool's matches
share, `'TBD'` if none, or `''` when they disagree. `slotLengthMins()`,
`dayStartMins()` and `poolEndMins()` are exported from `scores-data.js` so the
editor's arithmetic cannot drift from the generator's.

In the fixture editor on `/manager`:

- Each match's pitch is a dropdown: `TBD` plus `pitchesForAgeGroup()` for that
  group (plus the current value, so a legacy pitch does not vanish). Knockout
  matches have the same dropdown.
- `+ Add match slot` inherits the pool's pitch and starts one slot length after
  the pool's last match (at the day start for an empty pool).
- `Regenerate from pool` keeps the pool's pitch (the generator builds every slot
  on `'TBD'`), after a confirm that it replaces the pool's slots and any scores on
  them. It does not keep the start time.
- An unparseable kick-off time is refused; the last good time stands.

### The whole-weekend clash check

Ruling: claude/decisions/2026-07-31-manager-draw-tab-pitches-and-clashes.md

`weekendClashes(drawsByAge, ageNames)` in `scores-data.js` is **pure and
synchronous** — no fetching, no session, no clock — so it can be tested
exhaustively. `loadAllDraws(session)` fetches; `describeClash(c)` writes the
sentence. The Draw tab on `/manager` runs it.

It turns draws into **bookings**: a pool is one booking covering its run, per
pitch; each knockout match is a booking of its own. Two bookings clash when they
are on the same **day**, the same **pitch**, and their `[start, end)` ranges
**overlap**.

Deliberately NOT clashes:

| | Why |
|---|---|
| anything on `TBD` or blank | unscheduled is not conflicting; reported as `unplaced` |
| the same pitch at **different times** | a **time-share** — how D4/D5 run U6 then U7. A check that cries wolf here gets ignored |
| the same pitch name on **different days** | `D1`, `D2`, `B1a`, `A1a` exist on both days and are unrelated |
| **touching exactly** — one ends 10:00, the next starts 10:00 | half-open ranges |

Bookings that cannot escape:

- **A per-match override** — a pool with one match moved by hand to another pitch
  is booked once per pitch, each from its own earliest match.
- **Knockout matches** — own pitch and time, not in a pool.
- **Case and spacing** — `' c4 '` and `'C4'` are the same pitch.

Soft warnings: `unplaced` (no pitch yet) and `offAllocation` (on a pitch the age
group is not allocated in the layout).

**What the check can see depends on who asks, and the panel says so.** An
organiser's token reads every group's draft; a manager's reads their own draft
plus everyone else's **published** draw (`get-schedule-override` falls through to
published). Two managers' unsaved drafts cannot see each other, and the UI states
it. A group that fails to read is named, not dropped.

**Publishing warns, never blocks.** The publish handler runs the check and lists
any clash involving that age group in the confirm, whose button reads **Publish
anyway**. If the check itself fails, publishing is still offered — a validator
that cannot run must not become a validator that says no.

`isOrganizerSession()` is exported from `scores-data.js`; use it rather than
repeating the session-shape test (a missed shape once hid the Publish button).

### The homepage PITCHES stat comes from the layout

`Quins JRT.dc.html` keeps `pitchCount: 18` in state as a written-down fallback
(day one, the busier day); `loadFixtureData()` awaits `api.loadVenue()` and
replaces it with `venue.day1.pitches.length`. `loadVenue()` falls back to the
built-in layout, so the stat is never blank. Changing pitches in Venue & days
changes the homepage number with no deploy. ⚠️ No test in `tests/` holds the
fallback to the layout's day-one count; if `DEFAULT_VENUE.day1` changes, change
`pitchCount` with it.

**"Pitches A, B, C & D"** on the homepage and in `app.html` is deliberately left
literal. A, B, C and D are the real block letters at Zayed Sports City, so that
line is directions, not a count.

### Where each group plays — two views

At the top of the Venue & days tab, with a toggle. Both are built from the
**working copy**, so they redraw as boxes are ticked, before anything is saved.
Organiser-only: they show draft state and unallocated groups.

**SCHEMATIC** — every sub-pitch as its own labelled cell, blocks placed roughly
by `BLOCK_GRID`. The view that reads on a phone.

**MAP** — `assets/venue-map.png` with one chip per block dragged onto it.

- **The map is block-level.** The image draws one outline per block with no
  internal divisions, and the sub-pitch names are ours, so a chip names the BLOCK
  and the groups on it; individual pitches are read in the schematic. Do not put a
  box labelled "B1c" on the image.
- **Block positions are stored, not guessed.** `DEFAULT_POSITIONS` in `_venue.js`
  is an eyeballed start; an organiser unlocks the map and drags each block.
  Percentages of the image, measured to the block's **centre**. **One position per
  block for the whole weekend.**
- **Positions are stored under their own key, `config`/`venue-positions`**, not on
  the layout: `validateVenue()` rebuilds each day from a known field list, so an
  extra field on the layout is silently dropped on save. `tests/test-venue-map.js`
  asserts that dropping directly.
- Layout and positions save together (one Save button, `venueDirty()` watches
  both) but reset separately.
- **Dragging is locked by default.**
- `touch-action:none` on an unlocked chip, or a drag on a phone scrolls the page.
- Chips capture the pointer on `pointerdown`; the map image is
  `pointer-events:none`.
- `mapRect()` reads the rectangle from the DOM **at drag time**, never cached. If
  it cannot be measured, `pointerPct()` returns **null** and the drag does
  nothing — never a fallback value (a constant fallback once passed a full
  end-to-end drag test because the grab offset cancelled it).
- A block with no position goes in a **tray** beside the map with a button to drop
  it on, never at 0,0.
- `blockOfPitch()` maps a pitch to its block (`D5a`→`D5`, `D2`→`D2`): everything
  up to the last digit; one optional trailing letter is the sub-pitch. A name with
  no digit becomes its own block rather than throwing.
- `BLOCK_GRID` is the only stored geometry (rough row and column). An unknown
  block is still drawn, below; `tests/test-venue-map.js` asserts every block in
  the shipped layout is known.
- **Two groups on one pitch is drawn as a TIME-SHARE, not a problem** — split
  colours, both names, neutral tone, never amber or red; the tooltip says
  "time-share, not a clash".
- The drawing shows a pitch **no group is on** (grey — may be deliberate) and a
  group on the day with **no pitches yet** (amber — something to fix).
- `venueMaps()` is pure (layout in, objects out) and tolerates a half-built layout
  without throwing, because the tab is reachable mid-edit.

#### Chip legibility

- **The ink is chosen, not fixed.** `chipInk()` uses WCAG relative luminance and
  contrast and picks near-black or near-white by **maximising the worst case**
  across every tint on the chip — a time-shared chip is two tints under one label.
- **The fill is topped up only when needed.** `chipFill()` nudges the chip's own
  fill away from the ink in 5% steps until it clears 4.5:1, **capped at 40%** so a
  colour cannot become a different colour; most tints are returned unchanged.
- `tests/test-venue-map.js` asserts the ratio across every chip the layout can
  produce (each group alone and every pair).
- ⚠️ **The gamma step in `relLuminance()` is load-bearing and nothing downstream
  notices it missing** — the top-up compensates, so every ratio still clears.
  Only the direct assertion that mid-grey reads 21.6% (not 50%), and the count of
  tints needing adjustment, catch it.
- The split shows as `×2` / `×4` on the chip; `splitLabel()` keeps the words for
  the tooltip, which also lists every surface on the block.

### The registration window

Ruling: claude/decisions/2026-07-27-registration-window-server-decides.md

**When the entry forms are open is a setting, not a deploy**, set on `/organizer`
→ Registration. The old hardcoded `registrationOpen` editor prop is retired; on
the homepage `registrationOpen` is now only a render value computed from
`registrationState()`. Do not reintroduce a prop.

Stored in the `config` store at key `registration`:

```
{ opensAt: '<ISO with +04:00>' | null,
  closesAt: '<ISO with +04:00>' | null,
  mode: 'auto' | 'open' | 'closed' }
```

- **Three states, not a date plus a toggle.** `auto` follows the dates; `open` and
  `closed` are deliberate exceptions.
- **Null dates mean closed.** No opening date → `auto` is closed; a closing date
  alone is closed. Every ambiguous input fails closed. `closesAt` equal to
  `opensAt` is refused. Reset deletes the key.
- **Times are Abu Dhabi time.** Every stamp carries `+04:00`, and dates are
  formatted from the string's own characters, never through a `Date` object
  (which answers in the reader's timezone). `tests/test-registration.js` runs the
  display in five timezones from +14 to −11 and requires agreement.
- `Date.parse` accepts 31 February, so `isRealDate()` is called at both entry
  points.
- **The server enforces it.** `handleSubmission()` refuses a submission outside
  the window and fails closed if the setting cannot be read (see "The submission
  flow"). The homepage and the server read the same `registrationState()`.

#### The shared block

`registrationState()`, `validateSettings()`, `registrationWarnings()`,
`registrationCopy()` and their helpers sit between
`/* ===== REGISTRATION WINDOW — SHARED BLOCK (start) ===== */` and the matching
`(end)` marker, **byte-for-byte identical** in `netlify/functions/_registration.js`
and `scores-data.js`; `tests/test-registration.js` compares them. Plain `function`
declarations with no `export` inside the block let one text serve CommonJS and an
ES module; each file exports the names outside it. Change one, change both.

The back office calls the server's own `validateSettings` (re-exported through
`organizer-data.js` from `scores-data.js`), so Save cannot go green on something
the server refuses; `/organizer` loads `scores-data.js` for this, deliberately.
`registrationCopy()` decides the public wording once; the homepage and the
back-office preview both print it. **If you find yourself writing a date rule in a
`.dc.html`, stop.**

#### `phase` and `open` are different questions

`registrationState(settings, now)` returns
`{ open, phase, opensAt, closesAt, forced, mode }`.

- `phase` is pure date arithmetic — `'unset' | 'before' | 'open' | 'after'`; the
  mode never touches it.
- `open` is whether the form works — mode first, dates second.

Pure and synchronous with `now` passed in. The homepage feeds it `Date.now()`
from the one-second countdown timer, so the page opens and closes itself on a tab
nobody reloaded. The registration modals exist only while the window is open.

#### What the public sees

| Phase | The page says |
|---|---|
| `unset` | "Registration opens soon" — no date promised |
| `before` | "Registration opens <date>", with a one-unit countdown |
| `open` | "Registration closes <date>" — a deadline is more use than an open date |
| `after` | "Registration closed" |

Force-closed inside the dates says "Registration is closed". A **TEST MODE** strip
shows whenever the form is open because `mode` is `'open'` rather than because of
the dates, so a test can never be mistaken for the real thing.

---

## Team codes and names

Ruling: claude/decisions/2026-07-25-draw-teams-are-codes-with-published-names.md

**Codes are the identity, names are the display.** `pools[].teams` holds a code
(`ADH1`); `draw.teamNames` turns it into a club name.

- `teamLabel(code, agId)` in `scores-data.js` resolves: the draw's `teamNames`
  for that age group, then an unambiguous match across loaded draws, then the
  hardcoded `TEAM_NAMES`, then the raw string. Always shortens "Abu Dhabi" to
  "AD". **Idempotent** — safe on a value that is already a name.
- `teamShort(code)` is the code, with "Abu Dhabi" shortened in case a hand-built
  draw holds a full name.
- **Full names** go wherever there is row width: homepage fixtures, app match rows
  and match sheet, `/scores` pool fixtures and results, editor chips.
- **Codes** go where a name does not fit: the app's pinned standings column and
  the knockout bracket cells. The team key card is their legend.
- **`DRAW_NAMES` is keyed per age group and must stay that way.** Codes are
  numbered within an age group, so `ADH1` in U16B and `ADH1` in U14B are
  different teams. Where two loaded draws disagree about a code, `teamLabel`
  declines to name it rather than guessing.
- Every `saveDraw` goes through `withTeamNames()`, so parents never see raw codes.

### How codes are made

`netlify/functions/_teams.js` builds `<prefix><n>`, n counting that club's live
team records within the age group — two Quins U16B sides are ADH1/ADH2, their
U14B side is also ADH1. Known prefixes (`CLUB_PREFIXES`): ADH, DE, DT, DS, DW, DH,
BAR. Unknown clubs fall back to initials (multi-word) or the first three letters
(single word), after stripping words like RFC / Rugby / Club / FC.

### Preferred pool

The team form requires a preferred pool: **A, B or C** (`POOL_OPTIONS` in
`netlify/functions/_intake.js`, matched exactly server-side; the dropdown copy in
`Quins JRT.dc.html` is compared by `tests/test-intake.js`). It is stored with the
registration record and shown in the Preferred Pool column on `/organizer` →
Teams. It is a request only; organisers set the final draw.

- If requiring a pool proves wrong, make it **optional** — do not restore "No
  preference".
- **A draw may still have a pool D.** The 4-pool Cup/Bowl/Plate/Shield bracket
  needs it. Do not narrow the draw editor, or `prefOf()`, to match the form.

---

## Email

Confirmation emails go from `registrations@adhjrt.com` via Microsoft Graph (an
Entra app with Mail.Send; config in `MS_TENANT_ID` / `MS_CLIENT_ID` /
`MS_CLIENT_SECRET` / `MAIL_FROM`, read by `netlify/functions/_email.js`).

- Player registration emails the parent; team registration emails the head coach
  and manager.
- **Sending happens after the registration record is written, in its own
  try/catch.** A mail failure is logged and swallowed — it must never lose a
  registration or cause a resubmission that duplicates it. If the write fails, no
  email is sent: a confirmation for an unsaved entry makes the coach stop chasing.
- Medical notes are deliberately not echoed in the email.
- ⚠️ **The client secret expires (around July 2028).** When it does, email stops
  silently. Diagnose from the AADSTS code in the function log.
- A change to a Netlify environment variable takes effect only after a new deploy.

---

## Netlify — deploys, previews and credits

Every production deploy costs 15 Netlify credits (the rule and the money
sentence are in `CLAUDE.md`); everything below is the evidence behind it.

⚠️ **THE TWO COPIES OF THE 15 ARE DELIBERATE AND ARE ASSERTED TO AGREE.**
`tests/test-doc-claims.js` reads the number out of the credit table below AND
out of the money section of `CLAUDE.md`, and requires them to be the same —
**derived, not pinned**, so they cannot drift apart. Do not "tidy" either copy
away. ⚠️ **This anchor has rotted before**, when a docs restructure moved one
copy and four checks went red. **If you move either copy, repoint the test in
the same commit.**

### Three kinds of preview URL, and only one of them is stable (2 Aug 2026)

A preview link that changes on every edit is avoidable: one branch URL stays
the same. Netlify hands out three different URLs and they are easy to confuse:

| URL | Changes when | Use it for |
|---|---|---|
| `<deploy-id>--adhquins-jrt.netlify.app` | **every single build** | nothing, day to day — it is an archive link to one frozen build |
| `deploy-preview-<N>--adhquins-jrt.netlify.app` | every new PR | reviewing one specific PR |
| **`dev--adhquins-jrt.netlify.app`** | **never** | **everything. Bookmark it.** It always serves the latest `dev` build. |

⚠️ **THE HOST NAME IN THIS TABLE WAS WRONG UNTIL 5 AUG 2026, AND EVERY URL IT
GAVE WAS DEAD.** It said `serene-gingersnap-1d0eb6.netlify.app` in seven
places; the project's Netlify subdomain is **`adhquins-jrt`**. Measured, not
guessed: `dev--serene-gingersnap-1d0eb6.netlify.app` answers **404** and so
does `main--…`, while `dev--adhquins-jrt.netlify.app` answers **200**. Anyone
following this file to preview a branch got a 404 and would reasonably have
concluded branch deploys were broken. The old name presumably worked once and
the site was renamed; nothing recorded it.

⚠️ **AND THE 401 TEST IS DEAD TOO.** This section used to say an existing
deploy answers **401** (the site-wide password prompt) and a missing one
**404**, so 401 meant it was there. The password is OFF — **an existing deploy
now answers 200.** Both live checks, 5 Aug 2026:
`dev--adhquins-jrt.netlify.app` → 200, `nosuchbranch--adhquins-jrt.netlify.app`
→ 404. **200 means it is there, 404 means it is not.** For anything that
matters, read the deploy id from the Netlify MCP rather than inferring
existence from a status code.

Branch deploys are enabled **for `dev` only**, so a push to `dev` triggers a
build. That is what makes the stable URL work, and it is free. Read the
setting back with `netlify api getSite`: `build_settings.allowed_branches` is
`["main","dev"]` (Netlify always counts the production branch).

⚠️ **THIS PARAGRAPH USED TO SAY "for `dev` only as of 6 Aug 2026". THAT WAS
FALSE until 11 Sep 2026.** On 11 Sep the Netlify setting turned out to be
"Deploy all branches pushed to the repository". `Compare` had built 48 deploys
from 6 Aug onwards, and six feature branches each had their own live site
(JRT-34, JRT-35). The sentence described a setting nobody had read back. It
was set to `dev` only that day, and `getSite` confirmed it.

⚠️ **THIS PARAGRAPH USED TO END: "If Netlify credits ever look higher than
expected, that is the first place to look — `main` is not the only branch
building." THAT IS FALSE and was corrected on 6 Aug 2026.** A branch build
cannot move the credit number, because it does not cost any. Netlify's
credit-based plans do not meter build minutes at all:

| | credits |
|---|---|
| **Production deploy** | **15 each** |
| **Branch deploy / Deploy Preview** | **0 — free** |
| Failed deploy | 0 |
| Rolling back production | 0 |

(Compute is 10 credits per GB-hour, bandwidth 20 per GB, web requests 2 per
10,000 — so a heavily-crawled branch deploy is not literally zero, but it is
nowhere near a build.) The point of the correction is that the old sentence
sent the next person hunting in the one place that could never be the cause.
**Only a successful production deploy spends credits.**
https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/

⚠️ **AND A BRANCH DEPLOY OUTLIVES ITS BRANCH.** Deleting the git branch does
NOT take the `<branch>--adhquins-jrt.netlify.app` site down — confirmed against
Netlify's own support, and measured here: `club-manager-page` was deleted from
`origin` on 6 Aug and its site was still answering 200, with its functions
running, minutes later. **This matters more than it sounds:** functions on a
branch deploy read the SAME environment variables and the SAME Blobs stores as
production, so a stale branch site serves old code against live data. The
`club-manager-page` deploy was 68 commits behind and therefore had no
`c5df5fa`, i.e. **no rate limiting on `manager-signup`**, while production had
it — the throttle was bypassable by changing the hostname. Restricting branch
deploys to `dev` stops the NEXT one; it does not retract one already published.

⚠️ **AND EVERY DEPLOY KEEPS ITS OWN ADDRESS.** This is not just about branches.
Every deploy Netlify has ever built stays reachable at
`<deploy-id>--adhquins-jrt.netlify.app`, and runs its own old code against the
same live variables and stores. Measured on 11 Sep 2026 (JRT-35): there were
602 deploys and 551 of them answered. 335 were from before `c5df5fa` and had a
reachable `manager-signup`, while `MANAGER_INVITE_CODES` was set. All but six
were deleted with
`tools/delete-old-deploys.ps1` (it keeps the live deploy, four production
rollback targets and the newest `dev` build), and every deleted address went
from 200 to 404. **New previews and `dev` builds age into the same problem**,
so old deploys are pruned at every landing (`runbook-merge-dev-to-main.md`,
step 8). Ruling: `claude/decisions/2026-09-11-old-deploys-are-pruned.md`.

⚠️ **AND DO NOT REPEAT THE MISTAKE THAT FOUND THIS.** A `404` on a branch
subdomain was read as "my delete worked" when a branch name that never existed
returns 404 too. **A 404 with no before-reading proves nothing.** Take the
baseline BEFORE the change, and probe more than once — a single `000` from a
transient connection failure reads exactly like "the site is gone".

## Shipped, don't rebuild

- Homepage stat strip: 20+ clubs / 3000+ players / 15 age groups / pitches from
  the venue layout, with a scroll count-up — not a bug.
- Footer email is `admin@adhjrt.com`, plain text in a `mailto:` link.
- Sponsors: HSBC is the principal partner (see "HSBC — the principal partner");
  only confirmed supporters appear, as data in `SPONSORS`.
- Pool fixtures, results and standings show full team names; knockout and the
  bracket show codes, via `teamLabel()` / `teamShort()`.
- Homepage Fixtures shows each match's score (pool rows and the knockout/finals
  bracket) from `getSchedule` — walkover-aware, blank until a result exists.
- The fixture editor is on `/manager` (`/scores` is public only). It has "Generate
  knockout from standings" (needs all pool scores), "Generate finals from
  knockout" (fills Cup/Bowl/Plate/Shield/Final from the winners so far) and
  "Clear knockout". Organisers have "Publish all" / "Unpublish all" on
  `/organizer` → Tournament.
- `/scores` has "Back to menu" and a footer "Manager sign-in →" link to
  `/manager`.
- Pitches are picked, not typed — each match's pitch is a dropdown of the venue
  layout's pitches for that age group.
- The whole-weekend clash check, the venue schematic and map, the documents
  shelf, and the registration window are all built — see their sections above.

