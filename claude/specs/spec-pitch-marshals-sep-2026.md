# Spec — pitch marshals: handing match scoring to volunteers at the pitch

**Status: specced 8 Sep 2026, not built.** Read this before touching
`submit-result.js`, `get-results.js`, `_results.js` or the score sheet in
`app.html`. Companion to `spec-draw-rights-sep-2026.md`; the two are
separate features and separate deploy decisions.

Jay, 8 Sep 2026: *"we also need a way for managers to handoff the match
scoring to volunteer pitch marshalls … some way for that pitch marshall to be
keyed into the specific matches they are running so they can score right at
the pitch."* And: *"pitch marshalls can be rotated in or out, some parents
will volunteer to do one match, some might do the entire tournament, some
might swap out … each match could potentially have a different pitch
marshall."* And: *"marshalls can correct their own score, but managers and
organizers should see that edit history."*

---

## The three roles, in Jay's words

| Person | Where they are | How they get in | What they do |
|---|---|---|---|
| **Organiser** | the club desk | their own account | everything, any group. Jay is an organiser AND the U16B manager; the age-group switcher on `/manager` is how one login does both. No second account |
| **Age group manager** | the age-group table | their own account | run their group: score, correct, oversee; hand pitches to marshals |
| **Pitch marshal** | standing at the pitch | a link the manager gives them, plus their first name | score, tries, cards, walkover, spirit nominee, for matches on that pitch that day; help the referee keep time |

A marshal is **not an account**. Volunteers are decided on at 09:15, do one
match or the whole weekend, and swap without telling anyone. Anything issued
per person fails on the first swap. Everything below is issued **per pitch,
per day**, and the person is identified by a name typed at the moment of
saving.

---

## What exists today, and what this builds on

- Scoring happens in `app.html`. A manager signs in and `canScoreAgeGroup()`
  in `scores-data.js` unlocks the score sheet for their group.
- `submit-result.js` recomputes the score server-side from tries and kicks
  under the group's rules, refuses festival groups, and writes **one blob per
  match** (`_results.js`). Last write wins, by design: one match has one
  score and the second writer is correcting the first.
- Every fixture slot in a published draw carries `pitch` and `startMins`, and
  the venue layout assigns each pitch on each day to one age group
  (`pitchesForAgeGroup()`). So "the matches a marshal is running" is already
  in the data as **one age group's pitch on that group's day**. Nobody has to
  type a list of match ids.
- Tokens are an HMAC over a JSON payload, `sign()` / `verify()` in
  `_auth.js`, with a maximum age. A marshal link is the same mechanism with
  a different payload and a much shorter life.
- The club registration link (`club-link.js`) is the precedent for "a link
  is the credential": stored server-side, status reported, never echoed.

⚠️ **`get-results.js` is public and serves every result record whole**,
including `submittedBy`, which today is a manager's username. That is a
pre-existing exposure of production account usernames, and once marshals
exist it would also serve a volunteer parent's name to every visitor of the
Standings page. § Privacy below fixes both in the same change; it is not
optional.

---

## The decision

1. A **manager** (own group) or organiser issues one **pitch link** per pitch
   their group holds, per day. It is shown as a QR code and a copyable URL.
2. Anyone who opens the link on their phone gets **pitch mode** in `/app`:
   that pitch's matches for that day, in kickoff order, and the ordinary
   score sheet. Nothing else unlocks.
3. **The name is asked for on every save**, pre-filled from the last save on
   that phone, editable in one tap. That is the whole of rotation handling.
4. A marshal **can correct a score they or another marshal entered**. A
   marshal **cannot overwrite a score entered from the table** (manager or
   organiser); they are told to ask the table.
5. **Every overwrite keeps the previous version.** Managers and organisers
   see the history per match; the public never does.
6. Links **expire at the end of their day** and can be **revoked** and
   reissued in one click, which kills every phone holding the old one.

---

## 1 · The pitch link

### Payload

    { kind: 'marshal', ageGroupId, day: 'day1'|'day2', pitch, jti }

Signed with `sign()` from `_auth.js`, which adds `iat`. The `jti` is a random
id minted at issue; it is what revocation keys on. `verify()`'s maximum age
is six months, which is far too long here, so a marshal token is additionally
refused after **23:59 Gulf Standard Time on its `day`**, computed from
`DEFAULT_VENUE` in `_venue.js`, never from the token.

The URL is `/app#marshal=<token>`. **Fragment, not query string**: a fragment
never leaves the browser, so the token does not land in Netlify's request
logs or a referrer header. `app.html` reads it once on load, stores it in
`localStorage`, and clears the fragment from the address bar.

### Issue, revoke, list — `marshal-links.js`

    POST { action: 'issue',  ageGroupId, pitch }   -> { ok, url, issuedAt }
    POST { action: 'revoke', ageGroupId, pitch }   -> { ok }
    GET  ?ageGroupId=                               -> { ok, links: [{ pitch, day, issuedAt, issuedBy, revokedAt }] }

- `resolveSession`; manager for their own group (`hasAgeGroupAccess`) or
  organiser. No marshal token can call this.
- `pitch` must be one of `pitchesForAgeGroup(ageGroupId)` for that group's
  day, otherwise 400. `day` is derived, never supplied.
- Festival groups (`FESTIVAL_AGE_IDS`) are refused with *"U6 and U7 keep no
  scores, so there is nothing for a marshal to enter."*
- The current link per `(ageGroupId, day, pitch)` is stored in a `marshals`
  blob store as `{ jti, issuedAt, issuedBy, revokedAt }`. **Issuing again
  replaces the `jti`**, so the old link dies without a separate revoke.
  Revoke stamps `revokedAt` and keeps the record, so the listing can say
  "revoked at 10:12 by u16b-manager".
- The token itself is returned **once**, in the issue response, and is not
  stored. What is stored is enough to recognise it, not to reproduce it.
  Same rule as `club-link.js`: never echoed in a listing or an error.

### The manager's side — a **Marshals** tab on `/manager`

One card per pitch the group holds on its day:

- Pitch name, status (*not issued* / *live since 08:40* / *revoked*), and
  the buttons **Show QR**, **Copy link**, **Revoke**, **Issue new**.
- **Print pitch sheets**: one A4 page per pitch with the QR code large, the
  pitch and group name, the day, and four lines of instructions for the
  marshal (scan, type your name, tap the match, enter the score, save). This
  is what actually sits at the pitch; the QR on a phone screen is the backup.
- Organisers see the same tab through the age-group switcher, for every group.

**QR rendering: vendor a small QR encoder** (about 20 KB, MIT) into the repo
as `qr.js`. Decided by Jay, 8 Sep 2026. The site has no build step and no
dependencies, so the file is committed as-is with the library name, version
and licence in its header, and it goes on the "do not read" list in
`CLAUDE.md`'s reading map. The alternative, copied links sent by WhatsApp,
was rejected because a printed QR at the pitch is what makes rotation
zero-admin; a WhatsApp link makes the manager a bottleneck on every swap.
⚠️ The encoder is served from the repo root like everything else, so it must
be a single self-contained file with no `require`, no fetch, and no telemetry.

---

## 2 · Pitch mode in `/app`

On load, if `localStorage` holds a marshal token, `app.html` calls

    GET marshal-info.js   (Authorization: Bearer <marshal token>)
    -> { ok, ageGroupId, ageGroupName, pitch, dayLabel, expiresAt }
    -> 401 { ok:false, error } when revoked, expired, or not today

and renders pitch mode instead of the ordinary tabs:

- Header: **Pitch B · U16 Boys · Saturday 7 Nov**, and the name line
  *"Scoring as Sam — change"*.
- The match list: every slot in the **published** draw for that group whose
  `pitch` equals the token's pitch, in `startMins` order, with the usual
  Full-time chip on scored ones and *"Scored by Sam"* beneath it, from the
  `scoredBy` map in § 4. Published only, because marshals need what
  parents see and nothing more; `get-schedule-override.js` already serves
  that without a session.
- If another group's matches ever share the pitch, they are listed greyed
  and unscoreable, so a gap in the day is explained. Not expected to happen
  under the current venue model, but cheap to render and it prevents a
  "where is the 11:20 match" question.
- Tapping a match opens the **same score sheet** the manager uses, with one
  addition: a required **Your name** box, 1–40 characters, pre-filled from
  the last save on this phone. Same fields otherwise: tries, kicks per the
  group's rules, cards, walkover, spirit nominees.
- A **timer** on the open match: start / pause / reset, local to the phone,
  stores nothing, sends nothing. Jay said marshals help the referee keep
  time; this is the cheapest help the app can give.
- No Today tab, no Follow, no other age group, no sign-in link. A **Leave
  pitch mode** row at the bottom clears the stored token and returns to the
  public app.
- A revoked or expired token gets one screen: *"This pitch link is no longer
  live. Ask the U16 Boys table for a new one."* and the Leave row.

⚠️ **Feature-detect the token before rendering anything else.** `/app`'s
`viewNote()` returns `''` for the public on purpose (`RESTORE.md` § Draft
visibility); pitch mode must not leak any marker into the public view when
no token is stored.

---

## 3 · Saving a score as a marshal — `submit-result.js`

The handler gains a second way in. Before `resolveSession`:

    const marshal = verifyMarshal(event)   // in a new _marshal.js

`verifyMarshal()` returns `null` unless the bearer token verifies, has
`kind: 'marshal'`, its `jti` matches the stored record for
`(ageGroupId, day, pitch)`, the record is not revoked, and now is on its
`day` in Gulf time. Otherwise the existing session path runs unchanged.

For a marshal save, the extra checks, each a 403 with its own sentence:

- `matchId`'s age group equals the token's `ageGroupId`.
- The match exists in the **published** draw for that group and its `pitch`
  equals the token's pitch. Read `pub:<id>` from the `schedules` store; a
  match that has moved pitch since the link was issued is refused, which is
  correct: the marshal is at the old pitch.
- `data.marshalName` is present, trimmed to 1–40 characters, clipped like
  every other free-text field (`MAX_FIELD_CHARS`).
- `data.clear` is refused for marshals. Clearing a result is a table decision.
- **Precedence**: if a result already exists and its `enteredBy.kind` is
  `manager` or `organizer`, the save is refused: *"This score was set by the
  age-group table. Ask them to change it."* If it was entered by a marshal,
  any marshal on that pitch may overwrite it.
- Rate limit through `_ratelimit.js`, keyed on the `jti`: thirty saves per
  ten minutes, which is far beyond a real pitch and stops a looping phone.

The stored entry gains one field, for **every** writer, not only marshals:

    enteredBy: { kind: 'marshal' | 'manager' | 'organizer', name, pitch?, username? }

`submittedBy` (username) stays for one release so every existing reader
keeps working, then goes. For a marshal, `name` is the typed first name and
`pitch` the token's pitch; `username` is absent. For a manager or organiser,
`name` is their account display name and `username` their username.

---

## 4 · Edit history — `_results.js`

Before `writeMatch()` overwrites an existing result, `submit-result.js`
appends the **previous** entry to `hist:<matchId>` in the `results` store,
an array capped at **twenty**. Clears append too, with `{ cleared: true }`,
so "who wiped the 10:20 score" is answerable. This applies to every writer,
because managers correct scores as well.

- `get-result-history.js`: GET `?matchId=`, `resolveSession`, manager for
  that group or organiser. Returns the current entry plus the history array,
  newest first, each with `enteredBy`, `submittedAt`, and the score line.
  Marshal tokens are refused here: the history is for the table.
- **A marshal does see who last scored a match**, by first name only, so
  they can tell "Sam already did this one" (decided by Jay, 8 Sep 2026).
  `marshal-info.js` returns, alongside the pitch and day, a `scoredBy` map
  of `matchId -> first name` for that pitch's matches, read from
  `enteredBy.name`; a table-entered score reads *"the table"*. That is the
  only path a marshal has to any name, it is scoped to their own pitch, and
  it never reaches the public endpoint.
- On `/manager` Results tab, each result row shows *"Sam · Pitch B · 10:42"*
  (or *"table · 10:55"* for a manager save) and a **History** disclosure
  listing the earlier versions. Organisers see the same through the switcher.
- `_results.js`'s `readAll()` and `eachMatchBlob()` must **skip `hist:`
  keys**, or every history entry becomes a phantom match in the public
  results. `matchPrefix()` is the seam; a test injects a `hist:` key and
  asserts it is not served.

---

## 5 · Privacy — what the public must never receive

`get-results.js` today returns the record verbatim. From this change it
returns, per match, **only the scoring fields**: scores, tries, kicks, cards,
walkover, `submittedAt`. It strips `submittedBy`, `enteredBy`, and both
`spiritNominee*` fields.

- `submittedBy` is a production account username, which rule 11 in
  `CLAUDE.md` already says must not be public. It has been served since the
  endpoint was written. This is the fix.
- `enteredBy.name` for a marshal is a volunteer parent's first name. Not
  public.
- `spiritNominee*` are children's names typed by a manager. They are needed
  by the Spirit award tab on `/manager`, which is signed in, not by the
  public Standings page. **Check `getSpiritAward()` in `scores-data.js`
  reads them through a signed path before removing them from the public
  one**; if it reads `get-results`, it needs a session-carrying fetch first,
  the same shape as the draft-visibility fix of 8 Aug.
- `hist:` entries are never public, per § 4.

A test fetches `get-results` with no session against a fixture holding all
of those fields and asserts each is absent, with a control asserting
`homeScore` is present.

---

## What is NOT changing

- Manager and organiser scoring: same sheet, same permissions, same
  last-write-wins between the two of them.
- The draw, publishing, and the draft-rights model in the companion spec.
- The score computation and the scoring rules per group.
- `/scores` and the homepage: they read scores only and see no difference.

---

## Tests, and the faults each must catch

New file `tests/test-pitch-marshals.js`, in `runall.ps1` and in
`_prove-registration.js`, so the prover's clean-suite count goes **up by
one**. Every row is a fault the check must catch; a fault that cannot be
injected is a failed run.

| Assertion | Injected fault |
|---|---|
| A marshal token for Pitch B cannot save a Pitch A match | drop the pitch comparison |
| … cannot save another group's match | drop the age-group comparison |
| … is refused the day before and the day after its `day` | remove the day check; shift it by one day |
| … is refused after `revoke` and after a fresh `issue` | ignore `revokedAt`; ignore `jti` mismatch |
| … cannot clear a result | drop the clear refusal |
| … cannot overwrite a table-entered result, but can overwrite a marshal one | invert the precedence; remove it |
| A save without a name is 400; a 41-character name is clipped | drop each |
| A manager's ordinary save still works with no marshal token present | make `verifyMarshal` throw on a session token |
| `issue` refuses a pitch the group does not hold, and a festival group | drop each guard |
| `issue` from a manager for another group is 403 | drop `hasAgeGroupAccess` |
| The issue response carries the token; the listing does not | echo it in the listing |
| Overwriting appends the previous entry to `hist:`; the 21st keeps 20 | skip the append; skip the cap |
| `readAll()` never serves a `hist:` key | drop the prefix filter |
| `get-results` strips `submittedBy`, `enteredBy`, `spiritNominee*` and serves `homeScore` | return the record whole |
| `get-result-history` refuses a marshal token and a manager of another group | drop each |
| `marshal-info`'s `scoredBy` names only that pitch's matches, first name only, and says "the table" for a manager save | include another pitch; return the username |
| `app.html` renders no pitch-mode marker with no token stored | render it unconditionally |
| `app.html`'s score sheet in pitch mode names the `marshalName` field | drop it |
| Marshal token expiry is computed from `DEFAULT_VENUE`, not the token | read `exp` from the payload |

The day-window tests take `now` as a parameter and pin it to
`DEFAULT_VENUE`, as `publishDenialReason()` and `test-homepage-dates.js` do,
so moving the tournament cannot make them lie.

---

## Rollout on the day

1. The week before: the manager issues links, prints the pitch sheets, and
   scans one themselves to see pitch mode work. Links issued early are fine;
   they only become live on their day.
2. Saturday 08:30: sheets go to the pitches with the flags. The manager keeps
   a phone on the Marshals tab.
3. A swap mid-morning needs nothing from anyone: the new parent scans the
   sheet and types their name on their first save.
4. If a sheet goes missing or a link is forwarded somewhere it should not be,
   the manager presses **Issue new** and hands out a fresh sheet. Every phone
   on the old link gets the "no longer live" screen on its next save.
5. Sunday: the day-2 groups' links become live on their own; Saturday's are
   dead.

---

## Decisions taken by Jay, 8 Sep 2026

1. **Vendor a QR encoder.** § 1.
2. **A marshal sees who last scored a match**, first name only, via
   `marshal-info.js`. § 4.
3. **History cap stays at twenty per match.** Ten was floated and rejected
   the same minute; twenty costs nothing and a busy pitch with a disputed
   score can rack up corrections.

No open decisions remain. Ready to build once the draw-rights spec's own
decisions are taken, or on its own; the two do not depend on each other.

---

## Arguments against this spec, for whoever makes them next year

- *"Just give the marshals the manager login."* Then every result says the
  manager entered it, a forwarded password unlocks the whole group including
  registrations, and the only revocation is a password reset that also signs
  the manager out. The pitch link is scoped, named, and revocable on its own.
- *"A forwarded link lets a stranger enter scores."* For one pitch, for one
  day, under a typed name, on scores the table can overwrite, with history.
  The club registration link relies on less. If it happens, **Issue new**
  is one tap.
- *"Marshal accounts would be more proper."* Ninety accounts, some decided
  on at 09:15, with passwords forgotten at 08:50, is the case where proper
  fails. The name-at-save stamp gives the same audit trail after the fact.
- *"History is more storage."* Twenty small JSON objects per match at most,
  written only on correction. Nothing next to the photos.
- *"Stripping `submittedBy` from `get-results` might break a reader."* Grep
  every reader first; the only known one is the manager Results tab, which
  moves to `get-result-history` for that field. A public page has no
  business showing who typed a score.
