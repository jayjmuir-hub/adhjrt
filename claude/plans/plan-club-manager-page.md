# Club youth manager page — Build Plan (sub-project 1 of 2)

> ## ⛔ PARKED — 2 August 2026
>
> **Jay decided against club sign-in and does not want it.** All twelve tasks
> below were completed on branch `club-manager-page`, which is green and was
> never merged. Kept only so the work is not redone from scratch if it is ever
> revived. Do not list as outstanding.

> **For agentic workers:** use `superpowers:subagent-driven-development` or
> `superpowers:executing-plans`. Steps are checkboxes.
>
> **Spec:** `claude/specs/spec-club-manager-page.md`. Read it first. Where this
> plan and the spec disagree, the spec wins.

**Goal:** one Google-only login per club at `/club`, where the youth manager
declares how many teams in which age groups — and can change it later.

**Approach:** a third role, `club`, created by an organiser with no password and
claimed once by its owner's Google account. A dependency-free `_clubs.js` becomes
the only place the club list, the name normaliser (moved out of `_teams.js`) and
the row-matching rule live. A new signed-in endpoint appends a row per save,
taking the club from the account and never from the request body.

## Global constraints

- **No build step.** A constant shared between a function and a page is
  duplicated and pinned by a test, never imported.
- **`_clubs.js` must require nothing.** A fresh clone has no `node_modules`, so a
  module requiring `googleapis`/`bcryptjs`/`@netlify/blobs` cannot be loaded by a
  test at all.
- **`valueInputOption: 'RAW'`**, never `USER_ENTERED`.
- **Never `git add -A`** — the repo root is public. Named paths only.
- **Every new assertion gets an injected fault in the same task**, added to
  `tests/_prove-registration.js` (`FAULTS`), and the prover run. A fault that
  changes nothing is not a fault. New files go in its `NEEDED` array too, or the
  fault cannot be injected.
- **New test files go in `tests/runall.ps1` by hand** — one not named there never
  runs again and nothing tells you.
- **Invented fixtures only.** Never a real account, Google identity or sheet row.
- **Existing behaviour does not change.** Organizer/manager accounts, password
  sign-in, team and player registration all behave exactly as before.
- **Push to `main` costs 15 credits.** Branch, PR, show Jay the diff.

## Jay's prerequisites — needed before Task 7

1. **Create the club registrations Google Sheet, set `GOOGLE_SHEET_ID_CLUBS`** —
   `claude/specs/spec-club-registration.md`, "What Jay has to do in Google and Netlify".
2. **Sign in once with a real Google account** on `/scores` or `/organizer`.
   It is live and tested but has never been used; Tasks 5+ put twenty clubs on it.

Tasks 1–6 need neither.

## Files

**New:** `netlify/functions/_clubs.js`, `get-club-declaration.js`,
`save-club-declaration.js`, `club-data.js`, `Club.dc.html`,
`tests/test-club-accounts.js`.

**Changed:** `_teams.js`, `_googleAuth.js`, `google-auth.js`, `accounts-admin.js`,
`get-my-registrations.js`, `netlify.toml`, `Quins JRT.dc.html`,
`Organizer.dc.html`, `organizer-data.js`, `tests/_prove-registration.js`,
`tests/runall.ps1`, `tests/test-back-office-links.js`, `tests/test-sponsors.js`,
`CLAUDE.md`.

**⚠️ Branch off `dev`, not `main`.** As of 2 Aug 2026 `dev` is five commits ahead
of `main` (the HSBC placements and the back-office links work). `main` is what
costs 15 credits to push; `dev` is where work lands. The PR targets `dev`.

```bash
git checkout dev && git pull && git checkout -b club-manager-page
```

**Landing work on Jay's PC:** the sandbox has no push credentials. Per
`claude/writing-to-github-from-claude.md` — build and commit in the sandbox,
`SendUserFile` → `device_commit_files` onto the PC, `git add <named paths>` /
`commit -F <file>` / `push` on the PC, then prove it: the PC's `git write-tree`
must equal the sandbox's `git rev-parse HEAD^{tree}`. **`git commit -m` over the
bridge shreds any message containing quotes or apostrophes** — send a message file
and use `-F`, then delete it.

Each task ends: run its suite → run `node tests/_prove-registration.js` → commit
→ land on the PC → verify the tree hash.

---

## Task 1 — `_clubs.js`: the canonical list and the normaliser

Files: create `netlify/functions/_clubs.js`, `tests/test-club-accounts.js`;
modify `_teams.js`, `tests/runall.ps1`, `tests/_prove-registration.js`.

Exports: `CLUBS: string[]`, `normaliseClub(s) => string`, `clubKeys() => string[]`.

- [ ] **Test first.** New `tests/test-club-accounts.js` — `require()`s `_clubs.js`
  for real (it is dependency-free, so these execute the function rather than
  reading its source):
  - **The collision sweep.** Normalise every name in `CLUBS`, assert no two
    produce the same key, and report the offending pair. **This is the most
    important assertion in the sub-project** — the normaliser deletes
    rugby/club/fc/rfc/football, so "Dubai Rugby Club" and "Dubai FC" would become
    one key, and the key decides whose children a club manager can read. Swept
    across the whole list, not sampled.
  - Every club normalises to something non-empty (a name of only stripped words
    would match every blank cell).
  - `normaliseClub` behaviour, pinned exactly as `_teams.js` has relied on it
    since it was written: `'Dubai Exiles RFC'` → `'dubai exiles'`,
    `"Al-Ain Amblers'"` → `'al ain amblers'`, `null` → `''`.
  - Source check: `_teams.js` requires it from `_clubs.js` and **no longer
    defines its own** — the point of the move is that a second copy cannot appear.

- [ ] **Run it, watch it fail** (`Cannot find module _clubs.js`).

- [ ] **Write `_clubs.js`.** `CLUBS` = the nine already in `CLUB_NAMES`, same
  order. `normaliseClub` = the `norm` currently at `_teams.js:26–33`, moved
  verbatim. Header comment must record why the file exists (three club lists
  already disagreed) and carry the collision warning above `normaliseClub`.

- [ ] **Point `_teams.js` at it.** Delete its `norm` block; add
  `const { normaliseClub: norm } = require('./_clubs');`. Every call site keeps
  working — the local name is unchanged.

- [ ] **Run** `test-club-accounts.js`, `test-intake.js`, `test-functions-load.js`.
  `test-intake.js` exercises `nextTeamCode`, which is the real proof the move
  changed nothing.

- [ ] **Register:** add the suite to `runall.ps1`; add `_clubs.js` to `NEEDED`.

- [ ] **Faults:** (a) add `'Dubai Exiles Rugby Club'` to `CLUBS` → the collision
  sweep fails; (b) change the strip-words regex to a nonsense word → the
  normaliser checks fail; (c) give `_teams.js` back its own `norm` → both source
  checks fail. Run the prover. **"Could not be injected" is a failure of this
  step, not a pass** — the anchor text is wrong.

- [ ] **Commit:** "Canonical club list in _clubs.js; move the name normaliser out of _teams.js"

---

## Task 2 — Pin the three club lists to each other

Files: `tests/test-club-accounts.js`, `_teams.js`, `tests/_prove-registration.js`.

Today `CLUB_NAMES` (nine), `CLUB_PREFIXES` (seven) and the homepage stat strip
("20+ clubs") all disagree and nothing compares them.

- [ ] **Test:** every `CLUB_PREFIXES` key is a canonical club; the homepage's
  `CLUB_NAMES` is exactly `CLUBS`, same order. Parse `CLUB_NAMES` out of the page
  text and assert the parse itself found something — a regex that stops matching
  otherwise passes on nothing.

- [ ] **Run it.** Expected real failure: `["dubai warriors"]` — a prefix for a
  club the forms do not offer.

- [ ] **Resolve, two different ways.** Delete the `'dubai warriors': 'DW'` line
  from `CLUB_PREFIXES`. Leave Al Ain Amblers, Dubai Dragons and Abu Dhabi Small
  Blacks absent from the map — the fallback gives `AAA`/`DD`/`ADSB` and that is
  the intended design (`_teams.js`: "the map exists to guarantee stability, not to
  express exceptions"). So the test must **not** require every club to have a
  prefix.

- [ ] **Prove the fallback covers the deletion:** `clubPrefix('Dubai Warriors')`
  is still `'DW'`; `'Abu Dhabi Harlequins RFC'` → `'ADH'`; `'Al Ain Amblers'` →
  `'AAA'`; `'Barrelhouse'` → `'BAR'`.

- [ ] **Faults:** add a prefix for a club the forms don't offer; add a club to the
  homepage dropdown only. Run the prover.

- [ ] **Commit:** "Pin the club lists to each other; drop the orphan Dubai Warriors prefix"

---

## Task 3 — `clubMatches` and alias validation

Files: `_clubs.js`, `tests/test-club-accounts.js`, `tests/_prove-registration.js`.

- [ ] **Test:** exact match, normalised variant, different club, alias hit, alias
  miss — and the fail-closed cases: a blank/missing row club matches nobody, an
  account with no club matches nobody, a blank alias is **not** a wildcard,
  `aliases` may be `undefined`. Then `aliasProblem`: a safe alias returns `null`;
  an alias equal to another canonical club is refused; one already used by another
  account is refused; your own club's name is refused; blank is refused; an alias
  of only stripped words is refused; re-saving your own existing alias is fine.

- [ ] **Implement in `_clubs.js`:**

```js
/* Does this sheet row belong to this club account? THE ONLY PLACE THIS IS
   DECIDED — every reader calls it, none re-implements it.
   ⚠️ FAILS CLOSED ON BLANKS BOTH WAYS. A row with no club cell — typed by hand,
   or written before the column existed — must match NOBODY, or it lands in
   whichever account asks first. */
function clubMatches(accountClub, aliases, rowClub) {
  const row = normaliseClub(rowClub);
  if (!row) return false;
  const own = normaliseClub(accountClub);
  if (!own) return false;
  if (row === own) return true;
  return (aliases || []).map(normaliseClub)
    .filter(Boolean)          // a blank alias must not become a wildcard
    .includes(row);
}
```

  `aliasProblem(alias, ownClub, allAccounts, ownUsername)` returns a sentence for
  the organiser or `null`. Refuse, by name: blank; a key of only stripped words
  ("it would match every blank row"); your own club; **any other canonical club**;
  an alias already held by another account. Header comment: *adding an alias is
  the only realistic route to cross-club exposure in this design — everything else
  is set once from a fixed list, aliases are free text typed in a hurry.*

- [ ] **Faults:** drop the blank-row guard; drop the `.filter(Boolean)`; stub the
  canonical-clash lookup to `null`; stub the other-accounts lookup to `false`.
  Run the prover.

- [ ] **Commit:** "clubMatches and alias validation — the two rules that scope a club account"

---

## Task 4 — The `club` role and password-less accounts

Files: `accounts-admin.js`, `tests/test-club-accounts.js`, `tests/_prove-registration.js`.

Account shape every later task depends on:

```js
{ username, passwordHash: null, name, role: 'club', club: 'Dubai Exiles',
  aliases: [], claimEmail: 'sam@example.com', googleSub: undefined,
  approved: true, createdAt, createdBy }
```

- [ ] **Test (source assertions on `accounts-admin.js`):** `club` is a third role;
  a club account is created with `passwordHash: null`; the club must come from
  `CLUBS`; `claimEmail` is stored; `approved: true`; aliases go through
  `aliasProblem`; the `password` and `changeMine` actions **refuse** a club account.

- [ ] **Implement:**
  - `require('./_clubs')` for `CLUBS` and `aliasProblem`.
  - Widen the role guard to include `'club'`.
  - Skip the password requirement and `passwordProblem` when the role is club;
    `const passwordHash = isClub ? null : await hashPassword(password);`.
    Comment it: *a club account has no password ever — that is the whole
    mechanism behind one youth manager per club. There is no secret to pass on,
    so sharing access means handing over your own Google account.*
  - Validate `club` against `CLUBS` and `claimEmail` against a simple address
    shape. Comment: *⚠️ the address typed here is who gets this club — the first
    matching Google sign-in claims it permanently, so a typo hands the club to
    whoever owns that address.*
  - New `action === 'club'`: edit `aliases` (each through `aliasProblem` against
    **every other account**) and correct `claimEmail` — but **only while
    `googleSub` is absent**. Once claimed, the binding is the Google account and
    nothing else; handing the login to someone else means deleting it.
  - GET response: `signInMethod` becomes `'Google (awaiting first sign-in)'` for
    an unclaimed club account, plus a `claimed: !!googleSub` flag. `googleSub`
    itself is still stripped.

- [ ] **Run** `test-club-accounts.js`, `test-accounts.js`, `test-functions-load.js`.
  `test-accounts.js` passing is the proof organizer/manager creation is untouched.

- [ ] **Faults:** give a club account a password hash; take the club as free text;
  stub `aliasProblem` to `null`; delete the club guard from the password reset.
  Run the prover.

- [ ] **Commit:** "Club role: password-less accounts, canonical club, validated aliases"

---

## Task 5 — The one-time claim

Files: `_googleAuth.js`, `google-auth.js`, `tests/test-club-accounts.js`,
`tests/_prove-registration.js`.

Session and token:

```js
session: { username, name, club, _role: 'club' }
token:   sign({ username, role: 'club' })      // NO club — see below
```

**⚠️ The club is deliberately not in the token.** Tokens last six months. If it
carried the club, a rename or a revocation would not take effect until it expired,
and the most security-relevant field in the system would have two sources of
truth. Every endpoint loads the account and reads `account.club` at request time.

- [ ] **Test:** `_googleAuth.js` reports `emailVerified: payload.email_verified === true`
  (true, not merely "not false"); the claim requires it; the claim only applies
  while there is no `googleSub`; **`claimEmail` is deleted once bound**; the
  `googleSub` lookup still comes first in the file; there is still no plain email
  lookup into existing accounts; a club account gets a club session; the club is
  **not** in `sign(...)`; an unapproved account is still refused.

- [ ] **`_googleAuth.js`:** keep `if (payload.email_verified === false) return null;`
  and add `emailVerified: payload.email_verified === true` to the returned object.
  Comment why the claim needs the stricter test: binding an account to an address
  is a stronger act than signing into one already bound.

- [ ] **`google-auth.js`:** extend `sessionFor()` with a club branch (club in the
  session for display, not in the token), then insert the claim after the existing
  `googleSub` lookup:

```js
    let existing = accounts.find((a) => a.googleSub === identity.sub);

    /* THE ONE-TIME CLAIM. A club login is created BEFORE its owner has ever
       signed in, so there is no googleSub yet — it holds claimEmail instead. The
       first Google-VERIFIED matching address binds this Google account
       permanently and CONSUMES the claim.
       ⚠️ Three properties make this a claim and not email matching, each with an
       injected fault in test-club-accounts.js:
         - emailVerified must be true, not merely "not false"
         - it only applies while there is no googleSub
         - claimEmail is DELETED once bound, so it cannot be claimed twice
       Remove any one and this becomes the email-matching rule this file has
       always refused. */
    if (!existing && identity.emailVerified) {
      const claimant = identity.email.trim().toLowerCase();
      const i = accounts.findIndex((a) =>
        !a.googleSub && a.claimEmail && String(a.claimEmail).trim().toLowerCase() === claimant);
      if (i !== -1) {
        accounts[i].googleSub = identity.sub;
        accounts[i].email = identity.email;
        accounts[i].claimedAt = new Date().toISOString();
        delete accounts[i].claimEmail;
        await saveAccounts(accounts);
        existing = accounts[i];
      }
    }
```

  The invite-code path below is untouched — a `club` account is never created there.

- [ ] **Run** `test-club-accounts.js`, `test-google-auth.js`, `test-accounts.js`,
  `test-functions-load.js`. `test-google-auth.js` passing proves the existing flow
  is untouched.

- [ ] **Faults:** drop the `emailVerified` condition; drop the `delete`; drop the
  `!a.googleSub` guard; weaken `=== true` to `!== false`; put the club in the
  token. Run the prover.

- [ ] **Commit:** "One-time claim: bind a club login to its owner's Google account, once"

---

## Task 6 — A club token gets into nothing else

Files: `get-my-registrations.js`, `tests/test-club-accounts.js`, `tests/_prove-registration.js`.

- [ ] **Test:** `get-registrations.js`, `accounts-admin.js`, `publish-schedule.js`
  and `scoring-rules.js` all still admit organizers only;
  `get-my-registrations.js` refuses `session.role === 'club'` **by name**;
  `hasAgeGroupAccess` still denies unknown roles.

- [ ] **Implement:** add the refusal to `get-my-registrations.js` right after the
  `if (!session)` guard. Comment: *without this a club token still fails —
  `AGE_GROUP_NAME_BY_ID[undefined]` is undefined and the next guard 403s — but
  that is failing closed by **accident**, and it survives exactly until somebody
  adds a default. This endpoint is scoped by age group; a club account is scoped
  by club. Sub-project 2 gives club accounts their own reader.*

- [ ] **Run** `test-club-accounts.js`, `test-session-permissions.js`.

- [ ] **Fault:** change the role string to one that does not exist. Run the prover.

- [ ] **Commit:** "A club token is refused by every endpoint that is not the club page"

---

## Task 7 — The declaration endpoints

**Needs Jay's Google Sheet prerequisite to be exercised live.** The tests below
do not need it.

Files: create `get-club-declaration.js`, `save-club-declaration.js`; modify
`tests/test-club-accounts.js`, `tests/_prove-registration.js`.

- `GET get-club-declaration` → `{ ok, club, aliases, declaration|null, history }`
- `POST save-club-declaration` `{ contactName, contactEmail, contactPhone, counts, notes }`
  → `{ ok, submittedAt }`

Both share this guard — **token → username → account**, never the token's payload:

```js
async function clubAccount(event) {
  const session = verify(getBearerToken(event));
  if (!session || session.role !== 'club') return null;
  const account = (await loadAccounts()).find((a) => a.username === session.username);
  if (!account || account.role !== 'club' || !account.approved) return null;
  return account;
}
```

- [ ] **Test (source assertions on both files):**
  - **The club comes from `account.club` and the body is never consulted for it** —
    assert `account.club` is present *and* `body.club`/`payload.club` is absent.
  - Both call `loadAccounts()`, refuse non-club roles, and refuse an account
    unapproved since the token was issued.
  - Save **appends** (`values.append`, no `values.update`), writes `'RAW'` and
    never `USER_ENTERED`, reuses `clubRow`/`CLUB_COLUMNS` from `_intake.js`.
  - Get sorts by `submittedAt` — **not** row order.
  - Get filters with `clubMatches`, not its own comparison.
  - Save does **not** consult the registration window.
  - Counts are bounded by `MAX_TEAMS_PER_GROUP`.

- [ ] **Write `get-club-declaration.js`:** read `GOOGLE_SHEET_ID_CLUBS` with
  `getReadAuth()`, drop the header, `map(mapClubRow)`, filter with
  `clubMatches(account.club, account.aliases, r.club)`, then:

```js
    /* ⚠️ LATEST BY TIMESTAMP, NOT ROW ORDER. Every save appends, so row order is
       right today — and stays right only while nobody sorts, filters or
       hand-edits the sheet, which is not a promise anybody can make about a
       spreadsheet a human can open. */
    mine.sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
```

  Return `mine[0]` as `declaration` and the rest as `history`.

- [ ] **Write `save-club-declaration.js`:** 16 KB body cap, `getAuth()`, append to
  `CLUB_RANGE` with `valueInputOption: 'RAW'`. Validate contact name and email;
  each count must be a whole number `0…MAX_TEAMS_PER_GROUP` (an unbounded integer
  in a request body is not a number, it is an invitation). Build the row with
  `clubRow(data, submittedAt)` after `data.club = account.club;`. Log
  `err.message` only — the submission never goes near a log.

  Header comment, verbatim in substance: *this is not a branch inside
  `submit-registration.js` because that function is the anonymous front door —
  rate limit, allow-list, honeypot, window, no assumptions about the caller.
  Adding an authenticated branch would give one function two security models and
  two ideas of where the club name comes from. The property that protects one club
  from writing as another is that the club comes from the account and never from
  the body, and that is only legible in a function with no other path.* Plus: *the
  registration window does not gate this — a club correcting its numbers after
  entries close is exactly what an organiser wants.*

- [ ] **Check `_agegroups.js` first:**
  `node -e "const {AGE_GROUPS}=require('./netlify/functions/_agegroups.js'); console.log(AGE_GROUPS.map(g=>g.id).join(','))"`
  Expected fifteen ids. If the export differs, match it — **do not invent a second
  age-group list.**

- [ ] **Run** `test-club-accounts.js`, `test-functions-load.js`, `test-intake.js`.

- [ ] **Faults:** take the club from the body; switch to `USER_ENTERED`; replace
  the sort with `reverse()`; drop the `approved` check; drop the count upper
  bound. Add both files to `NEEDED`. Run the prover.

- [ ] **Commit:** "Club declaration endpoints: read the latest, append a correction"

---

## Task 8 — `club-data.js`

Files: create `club-data.js`.

Its own module, not an addition to `scores-data.js` — that file is 1,900 lines of
tournament data and shares nothing with this page but the shape of a session.

Exports: `currentSession`, `logout`, `googleClientId`, `googleAuth({idToken})`,
`getDeclaration`, `saveDeclaration(payload)`.

- [ ] **Write it.** Key points:
  - **`SESSION_KEY = 'adhjrt_club_session'` — its own key.** Sharing the manager
    key would let a club session be picked up by `/manager`'s `currentSession()`
    and vice versa: two different scopes over the same children's data,
    distinguished only by whichever page read the key first.
  - `googleAuth` sends `{ idToken }` only — no invite code, no username step. A
    `needsSignup` response becomes *"That Google account is not set up as a club
    login yet. Ask the tournament organisers to add it."*
  - **`saveDeclaration` never sends a club name.** A client that sends one invites
    a server that reads one.
  - `fetch` failures return `{ ok: false, error }`, never throw.

- [ ] **Commit:** "club-data.js: session, Google sign-in and the two declaration calls"
  (its tests run with Task 9).

---

## Task 9 — `Club.dc.html` and the `/club` route

Files: create `Club.dc.html`; modify `netlify.toml`, `tests/test-club-accounts.js`,
`tests/_prove-registration.js`.

- [ ] **Test:** `/club` rewrites to the page; `noindex`; **the signed-out view
  names none of `CLUBS`** (a signed-out page is readable by anyone who finds the
  URL — no club list, no hint about which clubs have logins); **no
  `type="password"` anywhere on the page** (a club login has no password; a
  password box would be a lie); the Google mount point exists; a sign-out control
  exists; an empty state exists; a save confirmation exists. Plus: the page's
  age-group list matches `_agegroups.js` exactly, in order — no build step, so it
  is duplicated and pinned like `AGE_GROUP_INFO`.

- [ ] **`netlify.toml`:** add the `/club` → `/Club.dc.html` rewrite after `/manager`.

- [ ] **Build the page.** `cp Manager.dc.html Club.dc.html` for the correct
  `<helmet>`, service worker, fonts and base styles, then replace the body and the
  whole `<script type="text/x-dc">` block. **Strip every Manager tab** — the tests
  catch a stray password field, not a stray fixtures tab.

  - *Signed out:* logo, "Club sign in", two sentences of purpose, the Google
    button, an error line, and a fallback message when `GOOGLE_CLIENT_ID` is
    unset. Google is the **only** way in here, so unlike `/scores` a failure is
    not "an enhancement did not load" — say so plainly.
  - *Signed in:* club name and who you are, sign-out, an empty-state card when
    there is no declaration, a "Saved <when>" line after a save, then three cards
    — contact details, a grid of fifteen count boxes with a running total, and
    notes — and a Save button.
  - *Component:* `componentDidMount` imports `club-data.js`; `boot()` loads the
    declaration if there is a session, otherwise sets up Google (reuse the
    `loadGoogleScript()` pattern from `Scores & Standings.dc.html:1225–1247`).
    `load()` **pre-fills every field** from the latest declaration — editing one
    count must not mean retyping a phone number. A failed load means the token is
    dead: log out and show the sign-in again rather than an empty form that never
    saves. Count inputs strip to digits, max two.

- [ ] **Run** `test-club-accounts.js`, `test-back-office-links.js`, `test-sponsors.js`.

- [ ] **Look at it.** Push the branch and open `<preview>/club` (permanent branch
  preview URL is in `CLAUDE.md`).

- [ ] **Faults:** name a club in the signed-out view; break the `/club` rewrite;
  add a password input. Add `Club.dc.html` and `club-data.js` to `NEEDED`. Run the
  prover.

- [ ] **Commit:** "The /club page: Google sign-in and the declaration form"

---

## Task 10 — The Accounts tab

Files: `Organizer.dc.html`, `organizer-data.js`, `tests/test-club-accounts.js`,
`tests/_prove-registration.js`.

- [ ] **Test:** scan every `api.X(` in `Organizer.dc.html` and assert
  `organizer-data.js` exports each one. *This is the lesson `test-accounts.js`
  exists for: the page once called three `api.*` functions that did not exist —
  the dialogs opened, took input, closed and did nothing, with the TypeError going
  only to the browser console.* Then: the create form offers the club role; the
  club picker is a list, not free text; an unclaimed login reads **"awaiting first
  sign-in"**; the aliases editor calls `saveClubAccount`.

- [ ] **`organizer-data.js`:** add `saveClubAccount(session, { username, aliases,
  claimEmail })` posting `action: 'club'` to `accounts-admin`. **Add the page's
  call and this function in the same commit.**

- [ ] **`Organizer.dc.html`:** add `Club` to the role selector; when club is
  chosen, hide password and age group and show a club `<select>` plus a "Youth
  manager's Google address" field; show `signInMethod` as sent; add an aliases
  editor on club rows. Comment above the claim-email field: *⚠️ the address typed
  here is who gets this club — a typo hands it to whoever owns that address, which
  is why an unclaimed login is labelled "awaiting first sign-in". Correctable in
  place until claimed; after that, delete and recreate.*

- [ ] **Run** `test-club-accounts.js`, `test-accounts.js`,
  `test-organizer-grouping.js`, `test-organizer-manager-link.js`.

- [ ] **Fault:** un-export `saveClubAccount`. Run the prover.

- [ ] **Commit:** "Accounts tab: create a club login, see unclaimed ones, edit aliases"

---

## Task 11 — Retire the public club form

Last on purpose: until now nothing has been taken away, so every step above was
safe to stop at.

Files: `Quins JRT.dc.html`, `tests/test-back-office-links.js`,
`tests/test-sponsors.js`, `tests/test-club-accounts.js`, `tests/_prove-registration.js`.

- [ ] **Test:** the first register button reads "Club sign-in" and links to
  `/club`; `clubModalOpen` is gone; **"Register a team" and "Register player" are
  both still there**, and the team and player form state still exists. *Asserting
  the absence of things is not a test — removing one button out of three is one
  bad selection away from removing two.*

- [ ] **Implement:** swap the club `<button>` (line ~779) for an `<a href="/club">`
  with the same classes and inline styles, label "Club sign-in". **Drop the
  "Coming Soon" badge from this button only** — a club login is not gated by the
  registration window; the other two keep theirs. Then delete the
  `{{ clubModalOpen }}` block (~936–1050) and everything only it used:
  `clubForm`, `clubModalOpen`, `clubSubmitted`, `clubError`, `clubSubmitting`,
  `emptyClubForm`, `openClubModal`, `closeClubModal`, `setClubField`,
  `onClickRegisterClub`, the `club-registration` branch of `postRegistration`, and
  the `clubXxx` entries in `render()` (~2467–2500).
  **Leave `CLUB_NAMES` alone** — the team and player forms use it and Task 2 pins it.

- [ ] **Update `test-back-office-links.js` and `test-sponsors.js`.** Both read this
  markup. **Do not delete a failing assertion — change what it expects**, then
  confirm it still fails when the markup is wrong by breaking it temporarily.

- [ ] **Run** `test-club-accounts.js`, `test-back-office-links.js`,
  `test-sponsors.js`, `test-registration.js`, `test-registration-panel.js`,
  `test-intake.js`, `test-functions-load.js`.

- [ ] **Fault:** rename "Register a team". Run the prover.

- [ ] **Commit:** "Public page: Club sign-in replaces the one-shot club form"

---

## Task 12 — Docs, whole suite, PR

- [ ] **`powershell tests/runall.ps1`** — **read the output, not the exit code.**
  It had a bug on 2 Aug where a third of the run silently did not happen.

- [ ] **`CLAUDE.md`:** the `club` role and account shape; the one-time claim and
  its three properties; `_clubs.js` as the single source of truth plus the
  collision warning; the two endpoints and why the save is separate from
  `submit-registration.js`; append-not-overwrite and "latest by `submittedAt`,
  never row order". Commit with `[skip ci]`.

- [ ] **`claude/changelog.md`** — dated entry. **`claude/state-of-play.md`** — club
  page built, sub-project 2 specced but not started, whether Jay's two
  prerequisites are done.

- [ ] **Open the PR. Do not merge.** Show Jay the diff and the preview.

- [ ] **Live walkthrough with Jay, in order:**
  1. *In /organizer → Accounts:* create a club login — role Club, a club from the
     list, Jay's own Google address. Confirm "awaiting first sign-in".
  2. *In a browser signed into that account:* open `/club`, sign in, check the club name.
  3. *Back in /organizer:* it now reads "Google", not "awaiting first sign-in".
  4. *In /club:* fill in counts, Save, see the "Saved …" line.
  5. *In Google Sheets:* one new row, right club, right numbers.
  6. *In /club:* change one number, Save, reload — new number shows and the sheet
     has **two** rows, not one edited row.
  7. **Sign out, sign in with a different Google account — it must be refused.**
     That is the claim being consumed, and it is the one thing worth seeing with
     your own eyes.

---

## Spec coverage

Account and password-less creation → 4. One-time claim, all three properties → 5.
Canonical list, three-list drift, collision sweep → 1–2. Aliases and the
cross-club refusal → 3, 10. "Other" stays on the entry forms → untouched, asserted
in 11. Page, empty state, pre-fill, save confirmation, sign-out → 9. Club token
refused elsewhere → 6. New authenticated endpoint, append not overwrite, latest by
`submittedAt`, window does not gate an edit → 7. Public page and the two affected
test files → 11.

**Gap left deliberately:** the spec's end-to-end "a club token reads its own
club's rows and no others, with two clubs' fixtures present" is only half here.
Task 3 asserts `clubMatches` both ways with two clubs — the rule itself — and Task
7 asserts the endpoint uses it rather than its own comparison. The full assertion
over real registration rows belongs to sub-project 2, where that reader is built.
