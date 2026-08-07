> **ARCHIVED 30 July 2026.** Findings from the 25 July 2026 rehearsal (415
> results submitted across 13 competitive age groups). All fixes described
> here shipped in PR #11, long since merged. See `claude/changelog.md` for
> current status.

# Simulated tournament — findings and fixes

_25 July 2026. 415 results submitted across 13 competitive age groups, zero
submission errors. U6/U7 left unscored (festival groups)._

## What the simulation proved works

- **Scoring maths.** 4 a win, 2 a draw, 0 a loss, totals consistent throughout.
- **Walkover.** 20–0 with 4 tries and the flag set, exactly as specified. The
  server computes the score from tries and ignores any total the client sends.
- **Tie-break chain, all the way down.** U8 Pool A was engineered so every match
  drew: four teams identical on points, points difference, points for and tries.
  The system ran the chain out and badged them **COIN TOSS** rather than
  inventing an order.
- **Volume.** 28–29 matches per group across 4 pools, no performance problem.

## Fixed — PR #11 (`fix/team-names-persist`), three commits

### 1. Imported team names never persisted — was live on the public site

`saveDraw()` builds an explicit allow-list payload and `teamNames` was not in
it, so the map written by "Import registered teams" never left the browser. The
server stores whatever it is handed, so nothing errored — the names simply
vanished on save. Confirmed by reading the draft and published blobs back: both
held only `pools`, `slots`, `knockout`, `pitches`.

Effect: any code missing from the hardcoded nine-name fallback rendered as a raw
code. U8 Pool A read "AD Harlequins 1, **DS2**, Dubai Hurricanes 1, **DW1**".
With real registrations that is roughly half of every pool showing parents a
code instead of a club name.

### 2. Results stored per age group — the big match-day risk

Every result lived in one blob. `submit-result` read the whole object, set one
key, wrote it all back. No lock, and **no compare-and-set is available** —
`@netlify/blobs` v8 has no conditional write at all (`SetOptions` carries only
`metadata`, checked against the installed typings). Two managers saving at the
same moment both read the same snapshot and the second silently discarded the
first result, with no error and a success message to the manager who lost it.

Now one blob per age group (`ag:<ageGroupId>`), via a shared `_results.js` that
both endpoints use so read and write shapes cannot drift. Managers are scoped to
one age group, so they no longer share a key at all.

Migration is deliberately conservative: the legacy `all` blob is **never written
and never deleted**. It is the fallback for any group not yet written since the
change, and an untouched backup of everything recorded before it. A group's own
blob existing is the migration marker; the first write seeds it from the legacy
slice. On a failed group read the legacy slice is kept rather than blanking a
table mid-tournament.

Verified: 16 unit tests against a fake store, plus the deploy preview returning
**exactly** what production returns — 415 results, identical per-group counts,
walkover record intact.

### 3. Stale knockout scores reattaching

Knockout slot ids are stable (`u16b:CUP`, `u16b:TSF1`); pool ids carry a
timestamp. A score recorded against the Cup Final stayed keyed to `u16b:CUP`
after the bracket was rebuilt with different teams, so the new final showed as
already played with someone else's score. Seen live: U16B's freshly built
bracket already had eight completed matches from 22 July.

Regenerating now clears the score only for slots whose teams actually changed;
clearing the knockout clears their scores too. Both behind the existing
confirmations, wording updated.

### 4. Festival groups accept scores through the API

U6/U7 keep no scores and the UI hides entry entirely, but `submit-result`
accepted a U6 result with 200 OK. Now refused server-side. Clearing is still
allowed so a stray result stays removable.

## Still open

- **Within-group score race.** Two people scoring the *same* age group can still
  collide. Down from fifteen-way to one pair at one pitch; would need a
  conditional write, which the Blobs client does not offer.
- **Orphaned results accumulate.** Rebuilding pools leaves old timestamped ids
  in the store forever (U16B held 76 against 37 live slots). Harmless — nothing
  reads them — but it grows.
- **Coin-toss badge** appears on positions 2–4 but not 1.
- **Same-club pool clash** — Jay's call: preference is advisory, organisers set
  final pools. Working as intended.

## State left behind

- All 15 age groups **published**; fake fixtures live on adhjrt.com, no site
  password. Unpublish when done.
- 415 simulated results in the production results store.
