# One login for organisers and managers — DESIGN

> **Status: SHIPPED — merged to `main` 2 Aug 2026 (`fc6ae59`), live and
> verified on production, including Jay's real session migrating to the new
> key without a sign-out.** Built exactly as designed below; the one
> deliberately deferred piece remains the retirement of
> `organizer-login.js`/`manager-login.js` (kept byte-identical and uncalled,
> pinned by parity checks). Full record: `claude/changelog.md`.

## What Jay decided

One login endpoint, one session key, one sign-in page that routes to
`/organizer` or `/manager` by role. The two existing endpoints are
near-identical; the token already carries the role and every backend
permission check reads it, so permissions are already one system. The point
of the job is deleting the hack where `/organizer`'s login falls back to
`manager-login` and hand-writes a token into the scores page's localStorage
key before redirecting.

## Today's shape (verified in code, 2 Aug)

- **Two endpoints**, `organizer-login.js` and `manager-login.js`, identical
  except: the role filter on the account lookup, the session object shape,
  the token payload, and one word of error copy ("Incorrect" vs "Wrong").
- **Two session keys**: `adhjrt_session_v1` (scores/manager pages, via
  `scores-data.js`) and `adhjrt_organizer_session` (`organizer-data.js`).
- **Three cross-wirings** that exist only because of the split:
  - `organizer-data.login()`: on failure retries `manager-login` and writes
    the manager session into the OTHER data layer's key, then redirects.
    **This is the hack being deleted.**
  - `scores-data.login()`: on failure retries `organizer-login` and writes to
    the organizer key.
  - `app.html` `resolveSession()`: reads both keys and prefers the broader
    role, because someone can hold both.
- **`google-auth.js` is already unified** — one endpoint, both roles, a
  `sessionFor(account)` switch. The password login below is its exact twin.
- Sessions are long-lived (~6 months) and the shapes are load-bearing:
  `isOrganiserSession()` accepts `isOrganizer` / `_role:'organizer'` /
  `role:'organizer'`, and manager code reads `s.ageGroupId`.

## The design

### 1. One endpoint: `netlify/functions/login.js`

The password twin of `google-auth.js`'s existing pattern:

- POST only. Same rate limit as both old endpoints — 10 tries / 15 min,
  **same `${ip}:login` bucket**, so the attempt budget stays one pool and
  nobody gets 20 guesses by alternating endpoints.
- Look the account up **by username alone, no role filter** (usernames are
  already unique across roles — every signup path checks the whole list).
- Same `passwordHash` guard (a Google-created account has none — clean 401,
  not a 500), same approved check, same messages. Error copy standardises on
  "Incorrect username or password."
- Session + token minted **character-for-character to the old shapes**, per
  the account's stored role:
  - organizer → session `{username, name, role: title||'Organizer',
    _role:'organizer'}`, token `sign({username, role:'organizer'})`
  - manager → session `{username, name, ageGroupId}`, token
    `sign({username, role:'manager', ageGroupId})`
- **No password-length check** — the floor applies when a password is SET,
  never at login (the existing rule; a login check locks out the committee).

**The old endpoints stay, untouched, for now.** `test-accounts.js` and
`test-google-auth.js` read both files by name and assert their exact session
literals — Jay's gate is that those tests pass byte-unchanged, so the files
must exist with their content intact. They become uncalled by any page.
Drift risk is pinned by a parity test (below) asserting `login.js` matches
them character for character, the same trick `test-google-auth.js` already
uses. **Retiring them is a small later commit of its own** that updates the
two test files at the same time, every re-anchored assertion re-proven
against an injected fault.

### 2. One session key: `adhjrt_session_v2`

Stored value: `{...session, token}` exactly as today — organizer-shaped or
manager-shaped by role. `currentSession()` in `scores-data.js` keeps its
existing habit of presenting an organizer session to manager-side callers as
`{token, username, name, ageGroupId:'*', isOrganizer:true}`, so every
downstream reader (`canScoreAgeGroup`, `/app`, `/manager`) behaves
identically with zero call-site changes.

**Migration — nobody gets signed out.** One function, `migrateSession()`, in
`scores-data.js` (the single copy; `organizer-data.js` already imports from
it), run before any read of the new key:

1. If `adhjrt_session_v2` already holds a session → done.
2. Else read `adhjrt_organizer_session` FIRST, then `adhjrt_session_v1` —
   broader role wins, the same preference `app.html`'s `resolveSession()`
   already encodes for the person who holds both.
3. Copy the first hit to `adhjrt_session_v2`, then remove BOTH old keys.
4. Malformed JSON in an old key = absent (never throw), and still gets
   cleaned up.

Tokens are untouched — same `sign()`, same payloads, same ~6-month expiry —
so a migrated session keeps working against every backend check.

`logout()` clears all three keys. Cheap, and a stale pre-migration copy can
never resurrect a signed-in state after sign-out.

### 3. One sign-in page: `/signin`

A new `Signin.dc.html` (same DC component engine as the other pages), plus a
`netlify.toml` rewrite `/signin` → `/Signin.dc.html`. It carries everything
sign-in-shaped, so it can be deleted everywhere else:

- **Password sign-in** → `login.js`.
- **Google sign-in** → `google-auth.js` unchanged. An existing Google-linked
  account needs no role sent — the account's stored role answers. Same
  origin, so no Google Cloud origin-whitelist change; the working production
  Google sign-in is not touched server-side.
- **Create an account** (the signup flows job 1 evicts, re-homed):
  a role choice — Manager (per-age-group invite code) or Organiser (admin
  invite code) — then the existing password and Google signup flows, calling
  the existing endpoints. No signup logic changes.

**Routing after sign-in, by role:** organizer → `/organizer`, manager →
`/manager`. A `?next=` parameter is honoured only from an allow-list of
exactly `/organizer` and `/manager` (never an arbitrary URL) and only when
the role permits it — a manager with `next=/organizer` goes to `/manager`.

**The back-office pages stop carrying sign-in UI:**

- `Organizer.dc.html`: signed out → `location.replace('/signin?next=/organizer')`.
  Its whole sign-in/signup/Google view is deleted — including **the hack**
  (the manager-login fallback + cross-key write), which is the headline
  deletion of this job. If a session exists but is manager-role, boot sends
  them to `/manager` — the storage-level replacement for what the hack was
  trying to do.
- `Manager.dc.html`: signed out → `location.replace('/signin?next=/manager')`.
  Its password-only login card is deleted; Google-account managers gain a
  sign-in route on the page they actually use, which today they don't have.
- `/scores`: nothing — after job 1 it is public with a footer link (the link
  can point at `/signin` or `/manager`; `/manager` is fine since it bounces).
- **`/app` keeps its inline sign-in sheet** (it's the match-day PWA; bouncing
  a phone out to `/signin` mid-tournament is worse). It simply calls the
  unified endpoint via `scores-data.login()` — which loses its two-step
  fallback and becomes one POST. `app.html`'s `resolveSession()` dual-key
  read becomes dead once the keys unify; simplified in the same commit.
- The homepage footer's two links ("Quins Organizer", "Quins Age Group
  Manager") stay as they are — they point at the destination pages, which
  now bounce through `/signin` when signed out. No copy decision needed.

## What this deletes, in total

- The `/organizer` → `manager-login` fallback + cross-key localStorage write
  (the hack).
- The `scores-data.login()` → `organizer-login` fallback.
- Two sign-in/signup UI copies (Organizer's, Manager's) in favour of one.
- The two-key session split and `app.html`'s both-keys workaround.

## Blast radius and the four tests

Auth is the highest-blast-radius system in the app. The gate at every step:
`test-accounts.js`, `test-session-permissions.js`, `test-google-auth.js`,
`test-functions-load.js` pass **byte-unchanged** — they are what prove
existing accounts (password AND Google, both roles) still work.

Why they survive this design: the old endpoint files keep their exact
content; token payloads and session shapes are unchanged everywhere;
`isOrganiserSession`/`canScoreAgeGroup` are untouched; `google-auth.js` is
untouched. `test-functions-load.js` sweeps the functions directory, so it
picks up `login.js` automatically and free — signed out it must answer
401/405, never 500.

New coverage, each assertion proven against an injected fault in
`tests/_prove-registration.js` (and any new file a test reads added to that
script's NEEDED list — the club work needed five):

- **Parity**: `login.js` session + token literals match `organizer-login.js`
  and `manager-login.js` character for character (the `test-google-auth.js`
  technique). This is also what pins the kept-but-uncalled old endpoints
  against drift.
- `login.js` has **no password-length check** (same assertion the old files
  get) and **no role filter** in the lookup — plus a fault that adds one and
  proves a cross-role login then fails.
- **Rate limiter present** with the same opts and the same `:login` bucket
  suffix — fault: change the suffix, prove the shared-budget check catches it.
- The `passwordHash` guard — fault: remove it, prove a Google-account
  username + any password path is caught.
- **Migration behaviour, driven not read**: v2 empty + organizer key →
  migrates; both old keys → organizer wins; v2 present → old keys ignored
  but still cleaned; malformed old JSON → treated as absent, no throw.
- **`/signin` driven** (build() pattern): password sign-in posts to
  `login.js` only; organizer routes to `/organizer`, manager to `/manager`;
  `next` allow-list refuses an arbitrary URL (fault: widen it, prove caught).
- Signed-out `/organizer` and `/manager` redirect to `/signin`.
- New test file added to `runall.ps1` **by hand, in the same commit**.

## Commit shape (continuing the branch, after job 1's commits)

1. `login.js` + parity/behaviour tests (nothing calls it yet — inert on the
   branch, fully tested).
2. Session unification: `adhjrt_session_v2`, `migrateSession()`, both data
   layers on the new key, `logout()` clears all three, `/app` simplification.
3. `/signin` page + `netlify.toml` rewrite; `/organizer` and `/manager` lose
   their sign-in views and gain the signed-out redirect; **the hack dies
   here**; footer link on `/scores` confirmed pointing somewhere real.
4. `CLAUDE.md`: sign-in section rewritten (one endpoint, one key, one page,
   old endpoints kept-uncalled pending retirement); state-of-play updated.

Then: full suite + fault run green on the PC, diff to Jay, and the whole
branch (both jobs) merges `dev` → review → `main` as ONE deploy — 15 credits
total.

## Open questions

None. Every decision above is either Jay's (2 Aug) or forced by the
byte-unchanged test gate. The one deliberately deferred item: **retiring
`organizer-login.js` / `manager-login.js`** — its own later commit, with the
test re-anchoring done properly, once the unified login has lived on
production for a while.
