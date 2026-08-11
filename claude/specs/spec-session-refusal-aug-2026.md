# Spec — being signed out, and what "revoked" means

_11 August 2026. Two defects found by Jay running the revoke test on
production, which `claude/state-of-play.md` had called the single most valuable
remaining check. It was._

## What was actually wrong

**The lock was never the problem.** Driven against the real `my-account.js` and
the real `_auth.js`, with a passing control in the same run:

| Account state | Status | Sentence |
|---|---|---|
| approved (CONTROL) | 200 | — success |
| revoked (`approved:false`) | 403 | This login has been revoked. Ask a tournament organizer. |
| session cutoff stamped | 401 | You have been signed out. Please sign in again. |
| record deleted | 401 | This login no longer exists. Ask a tournament organizer. |

Every state refuses. The control is what makes that a measurement rather than
an assumption — without it, "everything 401s" would also be the reading from a
harness that was broken.

### Defect 1 — nothing turns a refusal into being signed out

`logout()` is called from **the Sign out button and nowhere else**.
`currentSession()` returns a session whenever a token *string* is in
`localStorage`; it never asks the server whether that token is still any good.

So the dashboard renders from browser storage while every request behind it is
turned away. Jay refreshed roughly fifteen times against an account that **did
not exist at all** and kept getting the page. The only thing that told him the
truth was My account — because it is a panel that makes a server call.

⚠️ **Nothing leaked.** Every endpoint holding children's data or write access
goes through `resolveSession`. `get-schedule-override.js` is optional-session
and correctly degrades a refused token to the ordinary public answer. This is a
defect of honesty, not of access — but a dashboard that looks live to whoever
is handed the phone next is the same shape as the 8 Aug `/app` sign-out bug.

### Defect 2 — "revoked" and "never approved" are one boolean

`revoke` sets `approved = false`. The pending queue is
`accounts.filter(a => !a.approved)`. **A revoked person therefore reappears
under "Waiting for access", beside genuine new signups**, offering exactly two
buttons:

- **Approve** — silently reinstates the person just revoked.
- **Reject** — `accounts.splice(idx, 1)`, deleting the record outright:
  password hash, age group, sign-in history, gone.

⚠️ **Jay pressed Reject without knowing what it was**, describing it as
dismissing a stray row — which is exactly how it reads on a queue of requests.
**A destructive, unrecoverable action sits one natural click after a routine
one.** That is the more serious of the two defects.

Credit where due: `revoke` also stamps `sessionsValidFrom`, and the comment
there says why — a later re-approval cannot resurrect the old tokens. That part
is right and is not being changed.

## Decisions

**Jay, 11 Aug, both as recommended:**

1. A finished session goes **straight to `/signin`** with a line saying why.
2. A revoked account gets **its own Revoked section**, with Restore and Delete
   permanently, reachable only deliberately.

## ⚠️ The trap that shapes the whole of part 1

**The client must not infer "signed out" from a status code.**

| Signal | Means | Sign out? |
|---|---|---|
| 401 from `resolveSession` | token bad, account gone, or cut off | **yes** |
| 403 from `resolveSession` | the account is revoked | **yes** |
| 403 from an endpoint's own role check | a manager touched an organiser-only feature — **legitimately signed in** | **no** |
| 503 from `resolveSession` | the account store hiccupped | **never** |
| network failure / unparseable reply | we do not know anything | **never** |

Signing someone out for pressing the wrong button would be a new bug. Signing a
manager out at a pitch because a blob read blipped would be a worse one — and
the 503 exists precisely so those are distinguishable. **This is the repo's
"a refusal and a network failure must stay different" rule, one layer up.**

So the refusal carries an explicit machine-readable marker, `sessionEnded:
true`, set **only** by `resolveSession`. The client acts on the marker and on
nothing else. Guessing from the sentence would be worse than guessing from the
status: the wording is meant to be improvable, and `test-unified-login.js`
already had to be rewritten once because it pinned an exact sentence.

### One builder, not nine copies

The nine endpoints that refuse a session each hand-roll the response, in nine
different idioms — `fail(...)`, `json(...)`, a bare `{statusCode, body}`.
Adding the marker to each by hand is nine chances to miss one, and a missed one
fails **silently**: that endpoint simply never signs anybody out.

`sessionRefusal(auth)` in `_auth.js` builds the whole response. Every call site
becomes one line. Same argument as `_intake.js`'s column list, `_venue.js`'s
pitch model and `_registration.js`'s shared block — all three of which were
duplicated, all three of which drifted.

## What is deliberately NOT changed

- **`optionalSession` keeps failing soft.** A refused token there means "answer
  as the public", which is correct and must not start signing people out — the
  public has no session to end.
- **The revoke stamp stays.** It is belt-and-braces on top of `approved:false`
  and it is what stops a re-approval resurrecting old tokens.
- **Reject is not removed**, only moved out of reach of a routine tidy-up.
  Deleting an account is a real thing an organiser needs to do.
- **`sessionsValidFrom` is not reused to mean "revoked".** It is also stamped
  by a password reset, so an account that was reset and later unapproved would
  read as revoked. Two facts, two fields: `revokedAt` is explicit.

## Arguments AGAINST, recorded because someone will make them again

1. **"Just treat any 403 as signed out — simpler."** It signs out every manager
   who touches an organiser-only feature. The whole reason 403 exists there is
   the 9 Aug change that stopped telling a signed-in person "Not signed in".
2. **"Retry on 503 and sign out if it fails twice."** Turns a store blip on
   tournament morning into fifteen managers signed out at once. Fail open.
3. **"Nine small edits are less risky than one shared helper."** They are not:
   nine copies is how the sheet columns, the pitch model and the registration
   rules each went wrong, and a missed copy here is an endpoint that silently
   never signs anyone out.
4. **"A revoked account can be spotted by `sessionsValidFrom` — no new
   field."** A password reset stamps the same field. See above.
5. **"The dashboard rendering while refused is only cosmetic."** It is, in
   access terms. It is not, in trust terms: an organiser who revokes somebody
   sees nothing happen on that person's device, and the person is not told.
   Revocation you cannot observe is revocation nobody believes in.

## Verification

- Drive `resolveSession` through all five states and assert the marker is
  present on exactly the two that mean the session is finished, absent on the
  503, and absent on an endpoint's own role refusal.
- Drive the client rule: marker present → session cleared and redirected;
  503, network failure and role-403 → session untouched. ⚠️ The last three are
  the checks that discriminate; "it signs out on a refusal" passes just as well
  against code that signs out on everything.
- Assert every `resolveSession` call site goes through `sessionRefusal`, the
  same way `test-accounts.js` mechanically checks the UI's `api.*` calls
  against the data layer's exports.
- Assert a revoked account is absent from the pending queue and present in the
  revoked list — **both ends**, or "it is not in pending" passes against an
  account that vanished entirely.
