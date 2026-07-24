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
assets/                    crest.jpeg, action shots, venue map, sponsor logos
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
  `_scoring.js` / `_publish.js` / `_teams.js` only if that area is involved).
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
| `accounts-admin.js` | organiser-only: list / approve / reject / revoke; can also create an already-approved manager login directly (`action:'create'`) |
| `get-results.js` | public read of all match results |
| `submit-result.js` | write one result; re-verifies role + age group from the token |
| `get-schedule-override.js` / `save-schedule-override.js` | custom draw + kickoff times + pitches (draft/published, see Publishing below) |
| `publish-schedule.js` | makes an age group's fixtures public, or withdraws them |
| `_publish.js` | draft/published keys, publish permission rule |
| `_teams.js` | club prefixes and team code generation |
| `_email.js` | confirmation emails via Microsoft Graph |
| `get-registrations.js` | organiser-only; reads both Google Sheets |
| `get-my-registrations.js` | manager: own age group only (teams + players, medical notes included); organiser/`*` admin: all groups — group always comes from the signed token, never the request |
| `submission-created.js` | fires on every Netlify Forms submission; appends a row to the matching Sheet |

Storage: **Netlify Blobs** (`results`, `accounts`, schedule overrides) plus two
**Google Sheets** for registrations.

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

- Saturday: U6–U12 plus U12G. Sunday: U13–U18.
- `u6`/`u7` are festival only — `hasStandings: false`, no table, hidden from
  public standings tabs (but available in the Manager area).
- `u16b`/`u16g` use a special double-bracket knockout.
- Spirit of Rugby award applies to U14 and up.
- Match id format: `<ageGroupId>:<poolId>:<i>-<j>` e.g. `u14b:A:0-1`.

Scoring: 4 win/walkover, 2 draw, 0 loss. Walkover recorded 20–0 with 4 tries.
Tie-breaks in order: points difference → most points → head-to-head → least
conceded → mini-league for 3+ → coin toss.

---

## Brand

Black base, red `#E11B22`, green `#17A34A`, white. From the Akuma kit — **not**
London Harlequins magenta/blue. Fonts: Anton (display), Barlow (body). Crest at
`assets/crest.jpeg` (there is no `crest.png` — a broken reference once broke
every social share preview).

---

## Gotchas found the hard way

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

---

## The match-day app (`/app`)

Club Hub-style phone app: bottom tab bar (Today / Fixtures / Tables / More),
top nav on desktop above 820px, bottom sheets for match detail and score entry.
JRT palette, Anton + Barlow.

- Reads through `scores-data.js` — publishing, permissions and "coming soon"
  behave exactly as on the website.
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

## Design refresh (branch `design/meet-organisers`, not yet on `main`)

A visual pass lives on this branch. Every push to a branch auto-publishes to a
free, password-protected Netlify **branch-preview URL** that updates on each
commit (only `main` spends the 15 credits) — use it to show Jay before merging.

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
---

## Outstanding

1. **The real draw.** All 15 groups still start from nine placeholder clubs
   (Harlequins, Exiles, Sharks, Hurricanes, Barrelhouse, Amblers, Dragons,
   Tigers, Small Blacks) auto-split Pool A/B, kickoffs from 08:00, pitches
   default "TBD" until an organiser sets them via the pitch picker. Everything
   else waits on this.
2. **Results nav link.** Line ~66 of `Quins JRT.dc.html` is still
   `href="#results"`. Change to `/scores` and swap the coming-soon standings
   preview for "View live scores" — only once the draw is real, or placeholder
   pools go public.
3. **Sponsors** placeholder — when artwork arrives, a comment directly above
   the section gives the exact `<img>` tag to swap in.
4. **Deploy cost** — every production deploy costs 15 Netlify credits
   (3,000/month Pro), whatever its size. Batch changes into one commit; iterate
   on a branch/preview (free), merge to `main` once. (Full deploy-credit and
   working-agreement rules live in the project instructions.)

---

## How Claude writes to GitHub (verified 23 Jul 2026)

There is ONE thing that can write to this repo: a **local GitHub MCP server**
running on Jay's PC through the desktop app. It is NOT the account-level
"GitHub Integration" connector — that one is OAuth/read-only and 403s on every
write, because Anthropic's GitHub app can't write to a PUBLIC repo by design.
Ignore that connector for writes; it's only good for reading.

**How the write path is built (do this once per PC Jay uses):**
1. Node.js installed on the PC (provides `npx`). Check with `node --version`;
   if missing, install the LTS from nodejs.org. The desktop config points at
   the full Windows path `C:\Program Files\nodejs\npx.cmd` (a bare `npx` throws
   `spawn npx ENOENT`).
2. A classic **`repo`-scoped** personal access token (currently the token named
   **"Claude Access2"** on Jay's GitHub — regenerate it on
   github.com/settings/tokens when it expires; the value is only shown once).
3. The desktop app's config file (Settings → Developer → Edit Config — the JSON
   with `coworkUserFilesPath`/`preferences`) gets an `mcpServers` block:
   ```json
   "mcpServers": {
     "github": {
       "command": "C:\\Program Files\\nodejs\\npx.cmd",
       "args": ["-y", "@modelcontextprotocol/server-github"],
       "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<the token>" }
     }
   }
   ```
4. **Fully quit the app from the system tray and reopen** — config only reloads
   on a real restart.

**Reachability — the correction to the old notes:** once set up, the write
tools appear as `mcp__remote-devices__github__*` (`create_branch`,
`create_or_update_file`, `push_files`, `create_pull_request`, …) and are
reachable from **any** session, cloud or on-computer, as long as the desktop
app is running on a configured PC and the device bridge is connected. Cloud
sessions are NOT inherently read-only — the write goes through the bridge to
the local server. (Verified: created a branch and committed a file to `adhjrt`
from a cloud session on 23 Jul 2026.) If those tools aren't in the tool list,
the app isn't running / isn't configured on the bridged PC — fall back to
handing files to Jay, don't conclude writing is impossible.

**What's safe to push:** it's about authorship, not size. Content Claude wrote
this session is safe to push at any size the tool accepts (Claude is the source
of those bytes). Reproducing an existing large file from memory risks a drifted
character — for those, fetch exact bytes first with
`github__get_file_contents` (or plain `git`) rather than retyping, or hand the
file to Jay to upload.

**Deploy steps:**
1. Edit in the sandbox; validate (`node --check` the DC script, tag balance for
   `sc-if`/`sc-for`).
2. Push with `create_or_update_file` (one file) or `push_files` (several in one
   commit) to `owner: jayjmuir-hub, repo: adhjrt`.
3. **Pushing to `main` deploys to production and spends 15 Netlify credits** —
   show the diff and get a yes first (see project instructions). Docs-only or
   non-live-site commits: put `[skip ci]` in the message so no deploy/credits.
   Branches are free — use them freely.
4. Verify: read the pushed file back (`github__get_file_contents` or `git`),
   and for a live deploy confirm Netlify reached `ready` (site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).

**Merge-conflict trap:** earlier features were squash-merged into `main`. A
branch still carrying pre-squash commits will conflict on re-merge. Don't
reopen old feature branches — branch fresh off current `main`.

**`raw.githubusercontent.com` serves stale cached copies for minutes** and
ignores cache-buster params — verify with plain `git`/`git hash-object` or
`github__get_file_contents`, never raw.githubusercontent.

**Per-PC reminder:** this setup lives on each machine, so a new PC needs the
Node + token + config steps above once before writing works from it.
