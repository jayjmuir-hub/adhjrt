# Spec — auto-approve a Club Hub sign-in from the person's squads

**Status: BUILT 9 Sep 2026, on `dev` — see `state-of-play.md` for whether
it is live.** Jay: *"all as recommended, build it"*. Every § 8 fault was
injected and turned the suite red (counts in state-of-play). Originally:
Jay: *"go on the spec for the auto-approve"*, after *"the first time they click it … it sends them back
to the login page which doesn't look any different, the second time they do
it, it seems to work"*. Extends `spec-club-hub-sign-in-sep-2026.md`, whose
§ 2 "The suggestion from the club hub (optional, phase 2)" this is — with one
change of ambition: not a *suggestion* for the organiser to confirm, but an
*approval*, for the cases where the club hub's answer is unambiguous.

## 1 · The problem, in one paragraph

Today a first Sign in with Quins Club Hub creates a pending tournament
account with no role, an organiser picks the role on the Accounts tab, and
the second sign-in works (`hub-auth.js`, `accounts-admin.js` `approve`).
That is two visits and a wait for every one of fifteen-odd managers, at the
start of a season when the organiser has better things to do — and the wait
is for information the club hub already holds: it knows exactly which squad
each coach and team manager runs. This spec makes the first sign-in the
only one, whenever that knowledge is enough to decide.

## 2 · What the club hub can tell us, and how — MEASURED 9 Sep 2026

The access token that crosses today carries `sub`, `email` and a name, and
nothing about squads. Two ways to learn the squads were considered:

- **Read the club hub's data API with the person's own token.** Its
  row-level security, read from `pg_policies` on the live project today:
  `memberships` has a SELECT policy `memb read` with
  `profile_id = auth.uid() OR private.is_admin(club_id)`, and `teams` has
  `team read` with `auth.uid() IS NOT NULL`. So a request carrying the
  person's token — the same token we have just verified — can read **that
  person's own membership rows and every team's name**, and nothing else.
  No change on the club hub side. ✅ **This is the route.**
  ⚠️ **CORRECTED AT BUILD TIME, 9 Sep 2026 — "and nothing else" was wrong
  for one kind of person.** The policy's other arm, `private.is_admin`,
  means a CLUB ADMIN's token reads the WHOLE club: Jay's returned 459 rows,
  every squad's staff included, and an admin who also coaches one squad
  would have looked like the coach of every squad. Found by running the
  exact request in Jay's own browser before merging (§ 9.2), not by reading
  the policy. The request is therefore filtered with
  `&profile_id=eq.<verified sub>` — the two cases are then identical (5
  rows for Jay), the policy still stops anyone reading somebody else's rows,
  and a request with no bearer at all is refused 401 (the control).
- **Put the squads into the token** via a Supabase custom access-token hook.
  Rejected: a change to the club hub's auth for the tournament's benefit,
  a claim that goes stale the moment a squad changes until the token is
  reissued, and a second place the mapping would have to live.

The call, from `hub-auth.js` after `verifyHubToken` has said yes:

```
GET https://lusmshimxdcxpnrktlgz.supabase.co/rest/v1/memberships
      ?select=role,status,title,is_head_coach,team_id,teams(name,is_senior)
      &status=eq.active
apikey:        <the club hub's publishable key>
Authorization: Bearer <the hub token the person arrived with>
```

The publishable key is public by design — it is in every request the club
hub's own front end makes and in its bundle — so it is a **constant in
`_hubAuth.js`** next to `HUB_PROJECT_REF`, with a comment saying so, and
NOT a Netlify environment variable (same ruling as the issuer). ⚠️ Copy it
from the club hub's Supabase dashboard at build time, and prove it by a
request that returns rows, never from a document.

**What the rows look like today.** Roles in use on the club hub:
`admin`, `coach`, `manager`, `medic`, `parent`, `player`. Staff titles in
use: Head Coach, Assistant Coach, Assistant Coach/Medic, Team Manager, Team
Manager/Club Hub Admin, Medic, Club Captain. Team names:
`U6 Tag` … `U8 Tag`, `U9 Mixed` … `U13 Mixed`, `U12G QR`, `U14B`,
`U14G QR`, `U16B`, `U16G`, `U18B`, `U18G`, `Senior Men`, `Senior Women`.

## 3 · The mapping — club squad → tournament age group

Tournament ids (`_agegroups.js`): `u6 u7 u8 u9 u10 u11 u12 u12g u13 u14b
u14g u16b u16g u18b u18g`. Every junior club team name starts with the same
token as its tournament id, so the rule is one regular expression, not a
table:

```
lower(first word of the team name)  must match  /^u\d{1,2}[bg]?$/
and be an id in AGE_GROUPS (the festival groups u6/u7 included — see § 4)
```

`U12G QR` → `u12g`, `U9 Mixed` → `u9`, `U14B` → `u14b`. `Senior Men` and
`Senior Women` map to nothing and are ignored. **A name that does not
match maps to nothing** — never to a guess. ⚠️ **This is a rule, not a
table, on purpose:** the phase-2 note worried about "a mapping table to keep
in step with `AGE_GROUPS`"; a rule keyed on the id itself has nothing to
keep in step. The test pins every current club team name to its id, so a
renamed squad on the club hub goes red here before it goes wrong live.

## 4 · The rulings

1. **Who counts as a tournament manager.** A membership row that is
   `active`, whose `role` is `coach` or `manager`, on a team that maps.
   Title and `is_head_coach` are ignored — an assistant coach runs the
   tournament day as often as the head coach does. `admin`, `medic`,
   `parent`, `player` never count, whatever the title says
   (`Team Manager/Club Hub Admin` counts by its *role*, which is what the
   club hub gates on, not by its title).
2. **Exactly one mapped squad → approved as `manager` for it, on the
   spot.** The account is created (or, if a pending hub account already
   exists, updated) with `role: 'manager'`, `ageGroupId`, `approved: true`,
   `autoApproved: { at, from: [team names] }`, and the answer is a session
   — the same 200 the second sign-in gives today. The organiser sees it on
   the Accounts tab like any other, marked **"approved from the Club Hub"**.
3. **More than one mapped squad → pending, with the choice pre-filled.**
   A tournament manager account holds one `ageGroupId`
   (`hasAgeGroupAccess`), and picking one squad for a coach of two is the
   organiser's call, not a coin toss. The pending account carries
   `suggestedAgeGroupIds: [...]`; the Accounts tab's pending row shows them
   as the picker's first options and says why. The `'*'` all-groups manager
   was considered for this case and **rejected**: it is an admin power
   (every age group's draw and scores), granted today only by hand.
4. **No mapped squad → pending, exactly as today.** Parents, players, medics,
   senior-only staff and anyone the club hub does not know as squad staff.
   The reworded "Nearly there" panel already says what happens next.
5. **Organisers are never automatic.** A club hub `admin` is not a
   tournament organiser. Organisers publish draws and manage accounts, and
   the list of them stays a thing a person decides.
6. **Re-check on every hub sign-in, for auto-approved accounts only.** If
   the club hub no longer lists the person as staff on a mapped squad, the
   account drops back to pending (`role` kept, `approved: false`,
   `autoRevoked: { at }`) and the answer is pending. An account the
   organiser approved by hand is never touched by this — `autoApproved` is
   the marker, and its absence is the organiser's decision standing.
   ⚠️ The argument against: "a coach dropped from the club hub on tournament
   morning loses the desk". The answer is that a coach dropped from the club
   hub on tournament morning has been dropped for a reason, and the
   organiser can approve by hand in ten seconds, which clears the marker.
7. **If the club hub's data API cannot be reached, fall back to today's
   flow.** A timeout or a non-200 from the REST call means pending, never a
   refusal and never a 500 — the sign-in itself was verified; only the
   convenience failed. Log it. Three seconds is the budget; the function
   already spends one round trip on JWKS.
8. **Match on `hubSub`, never on email.** Unchanged from the parent spec,
   and the reason auto-approval is safe at all: the membership rows were
   read with a token whose signature we verified, for the `sub` in that
   token. Nobody can present a row for somebody else.

## 5 · What the organiser sees

- **Accounts tab, approved list:** a small "from the Club Hub · U14B" line
  under an auto-approved account, so a hand-approved and an auto-approved
  manager are told apart at a glance.
- **Accounts tab, pending list:** a multi-squad person's row says
  "Coaches U14B and U16B on the Club Hub — pick one", with the picker
  defaulting to the first. Everyone else's pending row is unchanged.
- **Nothing new to click for the common case.** That is the point.

## 6 · What the person sees

- Squad staff on one junior squad: the button, the hop, the dashboard.
- Everyone else: the "Nearly there" panel, as today.

## 7 · Files

| File | Change |
|---|---|
| `netlify/functions/_hubAuth.js` | `HUB_PUBLISHABLE_KEY` constant; `readHubSquads(token, { fetchImpl, timeoutMs })` → `{ ok, squads: [{ name, role, ageGroupId|null }] }`; `ageGroupIdFor(teamName)` (the § 3 rule). Both take `fetchImpl` like `verifyHubToken`, so the test drives them with no network |
| `netlify/functions/hub-auth.js` | after verification: read squads; apply § 4 rules 2–4 and 6; write `autoApproved` / `suggestedAgeGroupIds` / `autoRevoked` |
| `netlify/functions/accounts-admin.js` | listing passes `autoApproved`, `suggestedAgeGroupIds` through (`hubSub` still stripped); `approve` by hand clears `autoApproved` |
| `Organizer.dc.html` | the two lines in § 5 |
| `tests/test-hub-auth.js` | § 8 |
| `tests/test-organizer-accounts.js` (or wherever the pending picker is asserted) | the pre-filled picker and the "from the Club Hub" line |
| `claude/specs/spec-club-hub-sign-in-sep-2026.md` | § 2's phase-2 paragraph gets a pointer here |

No club hub change. No new environment variable. No new dependency (the
REST call is `fetch`, already used for JWKS).

## 8 · Tests — each proven red by an injected fault, per the house rule

1. `ageGroupIdFor` pins **every** current club team name (the list in § 2)
   to its id, seniors to `null`, and refuses `U14`, `U14 B`, `u14b-old`,
   `''`. Fault: change the regex to allow a trailing word.
2. One mapped squad as `coach` → 200 with a manager session for that group,
   account saved with `autoApproved.from`. Fault: drop the `approved: true`.
3. One mapped squad as `manager` → same. As `medic`/`parent`/`admin` →
   pending, no role. Fault: add `medic` to the counting roles.
4. Two mapped squads → 403 pending, `suggestedAgeGroupIds` holds both in
   team order, no `'*'` anywhere in the saved account. Fault: approve the
   first.
5. A pending hub account from before this change signs in again with one
   mapped squad → approved in place, same username, no second account.
   Fault: skip the "existing" branch.
6. Auto-approved account whose squads have gone → pending with
   `autoRevoked`; a hand-approved account with the same rows → still a
   session. Fault: apply the re-check to every account.
7. REST call throws / times out / returns 500 → pending, never 500 from us,
   and the account is still created. Fault: let the error propagate.
8. The membership read sends the **person's** token as the bearer and the
   publishable key as `apikey`, to the memberships path with `status=eq.active`.
   Asserted on the stubbed `fetchImpl`'s recorded request. Fault: send the
   session secret's signature instead.
9. `accounts-admin` listing never leaks `hubSub` (already asserted) and now
   does carry `autoApproved` / `suggestedAgeGroupIds`.

## 9 · Rollout

1. Build behind nothing — there is no flag. A wrong mapping only ever
   yields *pending*, which is today's behaviour, so the failure mode of the
   whole feature is "no worse than now".
2. Prove the REST read on the live club hub with Jay's own token before
   merging, from the deploy preview's function (the preview cannot run the
   whole loop — the club hub will not send a token to a preview origin — but
   the function can be POSTed a token copied from a real Club Hub session in
   the browser, and that is enough).
3. Merge; then watch the next new manager's first sign-in: one visit, no
   Accounts tab.

## 10 · Decisions for Jay before code

Each has a recommendation; say "as recommended" or pick.

| # | Question | Recommended |
|---|---|---|
| A | Which club hub roles become a tournament manager? | `coach` and `manager`, any title |
| B | A coach of two junior squads? | pending, both pre-filled for you to pick (never `'*'`) |
| C | Club hub admins as organisers? | no, organisers stay by hand |
| D | Re-check on every sign-in and drop a lapsed coach back to pending? | yes, auto-approved accounts only |
| E | U6/U7 festival groups (no scores) — approve their coaches too? | yes; the manager page is still theirs (registrations, documents) |

## Not in this spec

- Senior teams, which have no tournament group.
- Organiser roles from any source.
- Pre-filling names/emails on the pending row from the club hub (already
  carried by the token).
- Jacques's iPad — separate open item in `state-of-play.md`.
