# ADH JRT — project notes for Claude

Abu Dhabi Harlequins Junior Rugby Tournament. A public marketing site plus a live
scores app plus an organiser back office, for a two-day youth rugby festival on
**7–8 November 2026** at Zayed Sports City, Abu Dhabi.

Run by volunteers. The maintainer (Jay) is not a developer — explain changes in
plain language and say which system each step applies to (GitHub / Netlify /
Google). Avoid unexplained jargon.

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

Edit the `.dc.html` file, push, done. If you find yourself looking for a build
output or a bundling step, stop — there isn't one. (Earlier versions of this
project used an inliner that produced `index.html`. That is gone. Ignore any
instruction that refers to it.)

Anything in the repo root is **served publicly**. Do not leave stray copies of
backend files there — `adhjrt.com/<filename>` will serve them.

---

## Layout

```
app.html                   match-day app  →  /app. Plain vanilla HTML/CSS/JS,
                           NOT a DC component. Imports scores-data.js and
                           organizer-data.js as ES modules, so it shares the
                           website's data layer, auth and permissions — there
                           is no second source of truth.
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
- Match-day app → `app.html` (it reads `scores-data.js`, so add that only if the
  change touches data or permissions).
- A backend change → the one file in `netlify/functions/` plus `_auth.js` (and
  `_scoring.js` / `_publish.js` / `_teams.js` only if that area is involved).

**Do NOT read these unless something is provably broken inside them** — they are
framework/runtime plumbing, never edited, and together they are larger than the
rest of the repo combined: `deck-stage.js`, `support.js`, `image-slot.js`,
`doc-page.js`, `local-backend.js`.

---

## Functions (`netlify/functions/`)

| File | Purpose |
|---|---|
| `_auth.js` | shared helpers — Blobs store, bcrypt hashing, HMAC session tokens, `hasAgeGroupAccess` |
| `manager-signup.js` | per-age-group invite code decides the age group; account starts pending |
| `manager-login.js` | returns a signed session token |
| `organizer-signup.js` | shared invite code; **first organiser account is auto-approved** |
| `organizer-login.js` | as above |
| `accounts-admin.js` | organiser-only: list / approve / reject / revoke accounts, and **create** an already-approved manager login directly (`action:'create'`) |
| `get-results.js` | public read of all match results |
| `submit-result.js` | write one result; re-verifies role and age group from the token |
| `get-schedule-override.js` / `save-schedule-override.js` | custom draw + kickoff times + pitches (draft/published — see below) |
| `publish-schedule.js` | makes an age group's fixtures public, or withdraws them |
| `_publish.js` | draft/published keys and the publish permission rule |
| `_teams.js` | club prefixes and team code generation |
| `_email.js` | confirmation emails via Microsoft Graph |
| `get-registrations.js` | organiser-only; reads both Google Sheets |
| `get-my-registrations.js` | manager: own age group only (teams + players, medical notes included); organiser / `*` admin-manager: all groups. The group is taken from the signed token, never the request |
| `submission-created.js` | fires on every Netlify Forms submission; appends a row to the matching Sheet |

Storage is **Netlify Blobs** (`results`, `accounts`, schedule overrides) plus two
**Google Sheets** for registrations.

Permissions are always re-checked server-side from the signed token. Never trust
an age group or role sent by the browser — `submit-result.js` derives the age
group from the match id itself. Preserve that pattern.

---

## Environment variables (set in Netlify, never in the repo)

`SESSION_SECRET`, `MANAGER_INVITE_CODES`, `ORGANIZER_INVITE_CODE`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_SHEET_ID_TEAMS`, `GOOGLE_SHEET_ID_PLAYERS`,
`BLOBS_SITE_ID`, `BLOBS_TOKEN`

**Never commit a value for any of these.** If a fix seems to need a secret in
code, it doesn't — fix the variable in Netlify instead.

All of them should read *"All scopes · Same value in all deploy contexts"*. If
one shows several values across contexts, that's almost certainly a mistake.

---

## Age groups

15 groups. Ids are used as manager roles and as the prefix of every match id:

`u6 u7 u8 u9 u10 u11 u12 u12g u13 u14b u14g u16b u16g u18b u18g`

- Saturday: U6–U12 plus U12G. Sunday: U13–U18.
- `u6`/`u7` are festival only — `hasStandings: false`, no table.
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
`assets/crest.jpeg` (there is no `crest.png` — a broken reference to one caused
every social share preview to fail).

---

## Gotchas found the hard way

- **Netlify form detection is off by default.** Forms must be enabled *and* a
  fresh deploy run afterwards — the crawler only scans at deploy time.
- **The Google Sheets tab is not called `Sheet1`.** Both functions look up the
  first tab's real name at runtime. Don't hardcode a tab name again.
- **The service account private key** must be the `private_key` value from the
  JSON with no wrapping quotes; literal `\n` sequences are expected and are
  converted in code. A malformed key throws `ERR_OSSL_UNSUPPORTED` at
  `Sign.sign` — that error always means the key, never the sheet permissions.
- **Netlify Forms and the Sheets are separate stores.** Deleting a submission in
  Netlify does not remove the row already written to the Sheet. To remove a
  registration properly, delete the sheet row.
- Netlify Identity is *not* used. Auth is the custom bcrypt + HMAC system above.

---

## The match-day app (`/app`)

A Club Hub-style phone app: bottom tab bar (Today / Fixtures / Tables / More),
top nav on desktop above 820px, bottom sheets for match detail and score entry.
JRT palette, Anton + Barlow.

- Reads through `scores-data.js`, so publishing, permissions and the
  "coming soon" state behave exactly as on the website.
- Sign-in tries `manager-login` first, then `organizer-login` — the two use
  different endpoints and different localStorage keys, and an organiser session
  is marked `isOrganizer` rather than carrying a `role` field. Check all three
  shapes when testing a role (see `isOrganizerSession` in scores-data.js —
  missing one silently hid the Publish button once).
- Managers get score entry on their own age group; organisers on all.
- The fixture editor and publishing controls are deliberately NOT in the app —
  they are drag-and-drop work better suited to `/scores`, which the More tab
  links to.
- A follower's chosen age group is remembered in localStorage, per device.

The PWA install works but was judged not worth promoting — the install is
buried in browser menus and the one feature that would justify it (push
notifications for pitch changes) needs a backend that does not exist. Treat
`/app` as a fast mobile web page; the manifest and icons are harmless extras.

## Sensitive data

The player registration sheet holds children's names, dates of birth, medical
notes and parent contact details. Treat it accordingly:

- Never widen access to `/organizer` or to `get-registrations.js`.
- Age-group managers can see their OWN group's registrations in full (teams +
  players, including medical notes) via `get-my-registrations.js` — deliberate,
  for player welfare. The group is derived from the signed token, never from
  the request, so a manager can only ever see their own group. Keep it that way.
- Never log registration field values.
- Never paste sheet contents into a commit, an issue, or a public file.
- The organiser bootstrap rule (first account auto-approved) means the account
  list is worth auditing — flag anything unexpected rather than fixing silently.

---

## Publishing fixtures (added later)

Fixtures are draft-first. The `schedules` blob store holds two copies per age
group: `<ageGroupId>` is the DRAFT that the fixture editor reads and writes,
`pub:<ageGroupId>` is the PUBLISHED copy and the only thing the public sees.

- `save-schedule-override.js` writes the draft ONLY — it never makes anything public.
- `publish-schedule.js` copies draft → published, or deletes the published copy.
- `get-schedule-override.js` serves the published copy to the public, and the
  draft to a signed-in editor that asks with `?draft=1` + Bearer token.
- Organisers can publish any time; managers only on the tournament days and
  only their own age group (see `_publish.js`).
- **An auto-generated draw is never shown publicly.** No published copy means
  the page shows "coming soon" — before, during and after the tournament. The
  auto-generated pools are sample data and a parent cannot tell them apart
  from real fixtures.
- The draft draw object also carries a `pitches` array (the age group's pitch
  list, set in the editor). It rides in the same blob — `save-schedule-override`
  stores the whole object and `resolveDraw` returns it whole, so no endpoint or
  schema change was needed.

## Team codes and pool preference

Team names are generated, not typed. `_teams.js` builds `<prefix><n>` where n
counts that club's teams within the age group — so two Quins U16B sides are
ADH1 and ADH2, and their U14B side is also ADH1.

Known prefixes: ADH, DE, DT, DS, DW, DH, BAR. Unknown clubs fall back to
initials for a multi-word name or the first three letters of a single-word
one, which is how the known ones were derived.

The team form asks for a preferred pool (A/B/C/D/No preference, mandatory).
It is stored in column N of the Team Registrations sheet and shown in the
Organizer dashboard. It is a request only — organisers set the final draw.

## Email

Confirmation emails go out from `registrations@adhjrt.com` (a shared mailbox)
via Microsoft Graph, using an Entra app registration with the Mail.Send
application permission. Config lives in `MS_TENANT_ID`, `MS_CLIENT_ID`,
`MS_CLIENT_SECRET` and `MAIL_FROM`.

- Player registration emails the parent; team registration emails the head
  coach and the manager.
- Sending happens after the sheet write and inside its own try/catch — the row
  is the record, and a mail failure must never lose a registration or cause
  Netlify to retry and duplicate the row.
- Medical notes are deliberately NOT echoed back in the email.
- **The client secret expires around July 2028.** When it does these emails
  stop silently. Diagnose from the AADSTS code in the function log.

## Recently settled — do NOT re-do these

- Stat strip is 20+ clubs / 3000+ players / 15 age groups / 16 pitches. Correct
  and deliberate; they are static numbers with a scroll count-up animation.
- Footer email is `admin@adhjrt.com`. It was previously mangled Cloudflare
  email-obfuscation markup that rendered as "[email protected]".
- U6 and U7 are hidden from the PUBLIC standings tabs (non-competitive
  festivals) but remain available in the Manager area.
- Sponsors section is a deliberate placeholder, not a bug.

**Scores + fixtures — shipped Jul 2026, don't rebuild:**
- Pool fixtures, results and standings show full team NAMES; knockout and the
  bracket stay CODES (with a team key). `teamLabel()` in scores-data.js maps
  code→name and auto-shortens any "Abu Dhabi …" to "AD …" — a general rule, so
  clubs registered later abbreviate too.
- The homepage Fixtures section shows each match's SCORE (pool rows and the
  knockout/finals bracket). Scores come from `getSchedule` — walkover-aware,
  blank until a result exists.
- The fixture editor has two gated knockout buttons: "Generate knockout from
  standings" (needs all pool scores first) and "Generate finals from knockout"
  (fills only the finals — Cup/Bowl/Plate/Shield/Final — from the winners so
  far, leaving the earlier rounds; enabled once the knockout matches are
  played). Plus "Clear knockout". Organisers also have "Publish all" /
  "Unpublish all" for every age group at once.
- `/scores` has a "Jump to current match" button (scrolls to the first unscored
  match) and a "Back to menu" button at the bottom of the section.
- Pitches are picked, not typed. The editor has a "Pitches for this age group"
  panel (type-to-add chips); the list is stored on the draw as `pitches` and
  each match's pitch is a DROPDOWN of those pitches (editor rows + score-entry
  tab), not free text.

## Outstanding

1. **The real draw.** All 15 groups still start from nine placeholder clubs
   (Harlequins, Exiles, Sharks, Hurricanes, Barrelhouse, Amblers, Dragons,
   Tigers, Small Blacks) auto-split into Pool A/B, kickoffs from 08:00, pitches
   default to "TBD" until an organiser sets them (the editor now has a
   per-age-group pitch picker + dropdowns). Everything else waits on this.
2. **Results nav link.** Line ~66 of `Quins JRT.dc.html` is still
   `href="#results"`. Change to `/scores` and swap the coming-soon standings
   preview for a "View live scores" button — but only once the draw is real,
   or the placeholder pools go public.
3. **Sponsors** is a "coming soon" placeholder. When the artwork arrives, a
   comment directly above the section gives the exact `<img>` tag to swap in.
4. **Deploy cost.** Every production deploy costs 15 Netlify credits on a
   3,000/month Pro plan, whatever its size. Batch changes into one commit, and
   use a branch + preview (free) while iterating, merging to `main` once.

---

## Working agreement

- Read before editing. This repo deploys to production on every push to `main`.
- Show the diff and say what will change before committing.
- Don't rename or restructure files without asking — the `netlify.toml` rewrites
  and the `netlify-forms.html` field names both depend on exact names.
- After a change that touches functions, check the function log in Netlify
  rather than assuming success.
## Tooling — how Claude reads and writes this repo (learned the hard way, Jul 2026)

Three separate channels. Only one can write, and it has a real size limit. Reach for them in this order.

**Reading — plain `git` over HTTPS in the sandbox. Reliable; use this first, always.**
The repo is public, so `git ls-remote --heads https://github.com/jayjmuir-hub/adhjrt.git`
and `git clone` need no auth. Use them to find branch HEADs and to verify file contents
byte-for-byte with `git hash-object <file>`. It is read-only (no token to push).
- Do NOT trust `raw.githubusercontent.com` for verification — it serves a STALE cached
  copy for minutes and ignores `?cache-buster` params. Use `git` (or the API) instead.
- The unauthenticated GitHub REST API from bash is heavily rate-limited — prefer `git`.

**Writing — the local `github:` MCP server (`@modelcontextprotocol/server-github`).**
Authenticates as Jay with a `repo`-scoped personal access token, so it CAN create
branches, open/merge PRs, and push small files. Config lives on each of Jay's machines
(Settings → Developer → Edit Config); on Windows the command must be the full path
`C:\Program Files\nodejs\npx.cmd` (bare `npx` → `spawn npx ENOENT`). Any config edit or
new token needs a FULL quit-from-the-system-tray-and-reopen to take effect.
- SIZE LIMIT (the important bit): pushing a file means supplying its whole contents
  through the chat, so files above ~10-15 KB can't be pushed reliably, and the big
  `.dc.html` files (100 KB+) are hopeless. Don't fight it — see the deploy workflow.
- There is also a SECOND, read-only GitHub connector ("Git Hub", the Copilot one at
  `api.githubcopilot.com`). It 403s on every write ("resource not accessible by
  integration"). Never attempt a write through it.

**Acting in the browser — Claude in Chrome, driving Jay's logged-in GitHub session.**
For anything the connector can't do (deleting branches, clicking Merge on a blocked PR)
I can operate the branch/PR pages directly. Note: `file_upload` is currently broken
(rejects sandbox paths, "update the desktop app"), so I cannot upload files via the
browser — Jay works the native file picker himself.

**Deploy workflow that actually works:**
1. Edit the `.dc.html` / data files in the sandbox; validate (`node --check` the DC
   script, confirm `sc-if`/`sc-for` tag balance); stage to `/mnt/user-data/outputs`.
2. SMALL files → push via the `github:` connector. BIG files → hand to Jay with
   `present_files` and have him upload via GitHub's web uploader.
3. Commit STRAIGHT TO `main` (Upload files → "Commit directly to the main branch";
   `main` has no branch protection). This deploys immediately and avoids the conflict
   trap below.
4. Verify byte-exact with `git hash-object` vs the staged versions, then confirm the
   Netlify deploy is `ready` (Netlify connector → get-project, site
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).

**Merge-conflict trap.** Earlier features were SQUASH-merged into `main`. A branch that
still carries the pre-squash commits will CONFLICT when re-merged (main holds the same
changes as one squashed commit). So don't reopen old feature branches — commit directly
to `main`, or branch fresh off current `main`.

**Upload gotcha.** GitHub's web uploader commits to whatever branch is selected in the
UI — it silently sent an upload to the wrong branch once. Always point Jay at
`https://github.com/jayjmuir-hub/adhjrt/upload/main`, and keep the exact filename
`Scores & Standings.dc.html` (spaces and `&` included).

**When automation stalls, hand off — don't grind (learned Jul 2026).**
- Embedding a very large patch or base64 blob in ONE `javascript_tool` call can hang
  the Chrome MCP (a 4-minute timeout) and is easy to corrupt when pasted by hand. If
  you ever drive the browser to patch a big file in place, split the payload into small
  chunks and verify a `git hash-object` match before committing.
- The Chrome MCP can also go FULLY unresponsive — every call then times out at 4 min.
  When that happens, STOP retrying; each retry is another 4-minute wait. Fall back to
  `present_files` and let Jay drag the files onto `/upload/main` himself. That is how the
  Jul 2026 scores batch actually shipped (the two "Add files via upload" commits), after
  the browser route timed out on the third file. Files handed off this way still land
  byte-exact — verify with `git hash-object` afterwards, same as any deploy.
