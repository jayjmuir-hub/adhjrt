# Spec — who may change a draw, and when (draw rights)

**Status: specced 8 Sep 2026, not built.** Read this before touching
`save-schedule-override.js`, `publish-schedule.js`, `_publish.js` or the
Draw tab on `/manager`.

Jay, 8 Sep 2026: *"I think we need to rethink giving age group managers
automatically the ability to create and/or change their fixtures schedule, it
might be too complicated for some of them and things might get hectic."* Then:
*"go with 1, 2 and 3, 4 … we should probably include 5 … these would be rights
I could assign by click? … also need 7."*

The numbers refer to the option list in that conversation. They are restated
here so this file stands on its own.

---

## What is built today, and what is wrong with it

Fixtures are draft-first. The `schedules` blob store holds two copies per age
group: `<id>` is the DRAFT the editor reads and writes, `pub:<id>` is the
PUBLISHED copy and the only thing the public sees (`RESTORE.md` § Publishing
fixtures).

| Who | Save a draft | Publish / unpublish |
|---|---|---|
| Organiser | any group, any time | any group, any time |
| Manager | own group, any time, **every field** — pools, team assignment, kickoff times, pitches, knockout | own group, **tournament days only** (`publishDenialReason` in `_publish.js`) |

Three things are wrong with that, in order of how much they matter:

1. **Every manager has the full editor by default.** Fifteen groups means
   fifteen people who can rearrange pools and times, whether or not they
   understand the editor. The confident ones are a help; the rest are a risk,
   and there is no way to tell them apart in the software.
2. **The tournament-day carve-out is backwards.** Managers are blocked from
   publishing during the weeks when a mistake is cheap and allowed to publish
   on the two days when a mistake is most expensive. It was added so that
   scoring would not sit behind an unpublished draw (`RESTORE.md` § Draft
   visibility). That problem was solved on 8 Aug 2026 by letting managers see
   and score an unpublished draw, so the carve-out no longer earns its keep.
3. **A match-day pool edit orphans results.** `regeneratePoolSlots()` mints
   match ids from `Date.now()`, so a manager reshuffling a pool at 10am makes
   every result already entered vanish from that group's tables. Known,
   pre-existing, and the exact thing "hectic" means in practice.

A fourth: managers cannot see the other fourteen groups' draws, so a manager
changing a kickoff time or a pitch cannot judge whether it collides with
anyone. The clash checker runs at publish, which under this spec they never
do. Times and pitches are the cross-group fields; pools and teams are not.

---

## The decision

Managers default to **results only**. Every draw right is a switch an
organiser turns on per manager, on the Accounts tab, by click. Publishing is
**always** an organiser act. The schedule **freezes** for managers when a
group's tournament day starts. A manager with an edit right can **send a draft
for review**, which emails the organisers. Every draft save keeps a **history**
an organiser can roll back to.

Option 6 from the conversation, organisers build every draw and managers only
verify, is **not** chosen: it is what the defaults produce anyway when no
switch is turned on, so it needs no code of its own.

---

## 1 · Per-manager draw rights (the switches)

Two booleans on the manager's account record, both absent-means-false:

| Field | Label on the Accounts tab | What it unlocks |
|---|---|---|
| `drawPools` | **Edit pools and teams** | which teams are in which pool, adding and removing teams, the knockout bracket's team placement |
| `drawTimes` | **Edit kickoff times and pitches** | `startMins` and `pitch` on every slot, and "Regenerate times & bracket" |

Rules:

- Both off, which is every existing manager the moment this ships, means the
  Draw tab is **read-only**: the draw renders, no chip is pickable, and the
  Save / Discard / Regenerate row is replaced by one sentence: *"Your
  organisers manage this group's draw. Ask them if something is wrong."*
- `drawTimes` without `drawPools` is allowed and is the odd one. It is here
  for a manager who runs their own pitch on the day and needs to slide a
  kickoff. It is not expected to be common.
- The `*` admin-manager gets both rights when either is set, because that
  account already sees every group. Do not special-case it further.
- Organisers have both rights implicitly and **no switch is shown** for an
  organiser account. Requiring one would be theatre, the same argument
  `accounts-admin.js` makes for age groups.

### Where the rights travel

The signed token does **not** carry them. `resolveSession()` in `_auth.js`
re-reads the account on every call and already overlays `role` and
`ageGroupId` from the stored record onto the payload; it adds `drawPools` and
`drawTimes` the same way. Flipping a switch therefore takes effect on the
manager's **next request**, with no sign-out, which is what an organiser
expects from a click. The client-side `session` object (from `sessionFor()`
in `login.js` and `google-auth.js`, and from `my-account.js`) carries the
same two booleans for the Draw tab to render against, but **the server never
trusts them** — it is the same shape as `isDraft` in `RESTORE.md` § Draft
visibility: an authorisation decision made server-side and reflected
client-side.

### How `accounts-admin.js` sets them

One new POST action:

    { action: 'drawRights', username, drawPools: bool, drawTimes: bool }

Organiser-only, like everything in that file. Refuses with 400 if the target
account is an organiser. Stamps `drawRightsChangedAt` / `drawRightsChangedBy`
next to the existing `passwordChangedBy` pattern, so the Accounts listing can
show who granted what. The GET listing already spreads `...rest`, so the two
fields appear in it with no change.

⚠️ **The Accounts tab calls a data-layer function that must exist in
`organizer-data.js` in the same commit.** `test-accounts.js` sweeps every
`api.*` the page calls; the file's own header explains why (two dialogs that
did nothing for a month).

### How `save-schedule-override.js` enforces them

After the existing `hasAgeGroupAccess` check, for a **manager** session only:

- If neither right: 403, *"Your organisers manage this group's draw."*
- If `drawPools` but not `drawTimes`: the incoming schedule's `startMins` and
  `pitch` on every slot must equal the stored draft's values for the same
  slot id, and `reset` is refused. Any difference: 403, *"You can change pools
  and teams, but kickoff times and pitches are set by the organisers."*
- If `drawTimes` but not `drawPools`: the incoming `pools` array (ids, names,
  team lists) and every slot's `home`/`away`/`poolId` must equal the stored
  draft's. Any difference: 403 with the mirror-image message.
- Both: as today.

The comparison is done server-side against the **stored draft**, not against
anything the client says the old value was, because a client that wants to
cheat would simply say the old value was whatever it is sending. If there is
no stored draft yet, the comparison is against the auto-generated draw the
server can produce for that group — **open question below**; the cheap
alternative is to refuse a partial-rights manager from saving a first draft
at all, with a message asking an organiser to save once.

The Draw tab greys out the fields the manager cannot change, so an honest
manager never sees the 403. The 403 exists for the dishonest one.

---

## 2 · Publishing is organiser-only

`publishDenialReason()` in `_publish.js` drops the manager branch. A manager,
any day, gets *"Only tournament organisers can publish fixtures. Send your
draft for review instead."* `isTournamentWindow()` stays, because § 3 uses it.

On `/manager` the Publish / Unpublish buttons and the amber "publish blocked"
note are replaced, for managers, by the **Send for review** button from § 5.
The `publishPillLabel` (Published / Draft) stays for everyone: a manager should
still see whether what parents see matches what they are editing.

**Tombstone.** The manager-may-publish-on-the-day rule lived in
`publishDenialReason` from the manager-dashboard expansion
(`spec-manager-dashboard-expansion.md` § Draw tab, item 4) until this spec.
It went because publishing is the one act that changes what a parent sees,
and the person doing it should be someone who can see all fifteen groups and
has run the clash check. Match-day scoring no longer depends on it.

---

## 3 · Freeze at the start of the group's day

For a **manager** session, `save-schedule-override.js` refuses every save and
reset from **00:00 Gulf Standard Time on the group's own tournament day**
until the end of the tournament, with:

*"The draw is locked on match day. Ask the organiser desk to make changes."*

- The group's day comes from `dayIdOfAgeGroup()` in `scores-data.js`, mirrored
  in `_venue.js` like the rest of `DEFAULT_VENUE`. A group on day 2 can still
  be edited by its manager on day 1, which is deliberate: a day-2 manager
  watching day 1 may spot something.
- Organisers are unaffected.
- The check goes in the **function**, not only the page, for the same reason
  as every other rule here.
- Midnight rather than first kickoff, because first kickoff means reading the
  draft inside the permission check and a draft with no slots would have no
  kickoff. Midnight is one comparison against `DEFAULT_VENUE`, and it uses the
  same date source as the countdown, so it cannot disagree with the day
  headings. Argument against: a manager arriving at 07:00 with a genuine
  late withdrawal must go to the desk. That is the intended behaviour; the
  desk has the clash view and the manager does not.

---

## 4 · Split "who plays whom" from "when and where"

This is the two-switch shape of § 1 and is not a separate mechanism. Written
out here so a later reader knows it was a deliberate split and not two
switches for the sake of it:

- **Pools and teams** are local to one age group. A wrong change embarrasses
  that group and nobody else.
- **Times and pitches** are shared across all groups on a day. A wrong change
  puts two matches on one pitch, and the only place that can be seen is the
  organiser's clash check across fifteen draws.

So the default for a trusted manager is expected to be `drawPools` on,
`drawTimes` off.

---

## 5 · Send for review

A manager with either edit right gets a **Send for review** button on the
Draw tab, enabled only when the draft is saved (not dirty) and not frozen.

New function `request-draw-review.js`:

    POST { ageGroupId, note? }

- `resolveSession`, manager with an edit right for that group, or organiser.
- Writes `review:<id>` in the `schedules` store:
  `{ requestedBy, requestedAt, note, draftSavedAt }`.
- Sends one email through `sendMail()` in `_email.js` to the organiser
  notification address, subject *"Draw ready for review — U14 Boys"*, body
  naming the manager, the group, the note, and a link to `/manager` with the
  organiser's age-group switcher pre-set (`/manager?ag=u14b` — check whether
  the switcher reads a query string today; if not, that is a two-line
  addition to `load()`).
- Rate-limited through `_ratelimit.js`, one request per group per ten
  minutes, so a stuck button cannot mail the committee thirty times.

On `/organizer`, the read-only **Fixtures & tables** tab gains a
**"Awaiting review"** strip at the top listing every group with a `review:`
record, newest first, each with a *Open in /manager* link. Publishing a group
from `/manager` **deletes** its `review:` record, as does an organiser
pressing *Dismiss* on the strip. The strip is read-only in the sense
`RESTORE.md` insists on: it still names no write function against the draft
blob; `publish-schedule.js` does the delete.

⚠️ **Who receives the email is an open decision.** Accounts carry a username
and a display name, not an email address, and organiser logins may be
Google-linked or password-only. The options are a single
`ORGANISER_NOTIFY_EMAIL` environment variable in Netlify (simplest, one
address, one place to change), or an `email` field per organiser account
(more plumbing, and a personal email in a blob that the public repo's tests
must never fixture). **Recommendation: the environment variable.** Jay
decides.

---

## 7 · Draft history and rollback

Every successful save in `save-schedule-override.js`, **before** overwriting,
copies the current draft to `hist:<id>:<ISO timestamp>` with
`{ schedule, savedBy, savedAt }`. Keeps the newest **ten** per group; older
entries are deleted in the same call. A reset also files a history entry, so
"who wiped the draw" is answerable.

- `get-draw-history.js`: GET `?ageGroupId=`, organiser-only, returns the ten
  entries' metadata (not the schedules) plus a `current` marker.
- `restore-draw.js`: POST `{ ageGroupId, savedAt }`, organiser-only, copies
  that entry back to the draft key, which itself files a history entry first,
  so a restore is undoable.
- On `/manager`, organisers only, a **History** disclosure under the draw
  listing the ten entries with *Restore* on each and a confirm naming the
  timestamp. Managers do not get it; the organiser is the person who will be
  asked "what happened to my draw".

Argument against: Blobs has no compare-and-set, so two organisers saving the
same group within the same second can still lose one save. History makes that
recoverable rather than impossible, which is the most this store can offer.
Ten, not unlimited, because the store is listed on every organiser Fixtures
load and a group edited three hundred times should not slow the tab.

---

## What is NOT changing

- `get-schedule-override.js` and the `isDraft` decision: untouched. Read
  rights are unchanged; only write rights move.
- `publish-schedule.js`'s draft-to-published copy: untouched apart from
  deleting the `review:` record.
- The `/organizer` Fixtures & tables tab stays read-only against the draft.
- Score entry: untouched. Results-only is the new default and it is exactly
  what every manager has today on the Fixtures & scoring tab.
- The tournament dates still live in `DEFAULT_VENUE` only.

---

## Tests, and the faults each one must catch

New file `tests/test-draw-rights.js`, run by `runall.ps1`, listed in
`_prove-registration.js` so the prover's clean-suite count goes **up by one**.

| Assertion | Injected fault it must catch |
|---|---|
| A manager with no rights is 403'd by `save-schedule-override` | delete the rights check |
| A `drawPools`-only manager who changes one `startMins` is 403'd | invert the comparison so it passes on difference |
| A `drawPools`-only manager who changes only team lists is 200 | compare pools too, so nothing ever saves |
| `drawTimes`-only mirror of the two above | as above |
| A manager on their group's day is refused; the same manager the day before is not | move the freeze to the wrong day; remove it |
| An organiser on match day saves fine | apply the freeze to organisers |
| `publishDenialReason` refuses a manager on a tournament day | restore the old manager branch |
| `accounts-admin` `drawRights` refuses an organiser target and a manager caller | drop each guard |
| `resolveSession` overlays the stored `drawPools`, ignoring a forged one in the token payload | read it from the payload instead |
| Every save files a history entry and the eleventh save leaves ten | skip the copy; skip the prune |
| `restore-draw` files history before restoring | reorder |
| `request-draw-review` writes the record, sends one mail, and is rate-limited | drop each |
| Publishing deletes the `review:` record | drop the delete |
| Manager Draw tab renders read-only with the sentence when both rights are absent | markup check, same style as `test-draft-visibility.js` |
| `organizer-data.js` exposes every `api.*` the Accounts tab and the review strip call | already covered by `test-accounts.js`'s sweep; extend it |

The freeze tests take `now` as a parameter, like `publishDenialReason` does,
and pin it to `DEFAULT_VENUE`, so moving the tournament cannot make them lie.
`test-homepage-dates.js` is the model.

---

## Migration

Nothing to migrate. Absent fields read as false, so on deploy every manager
becomes results-only and every organiser is unaffected. Jay then turns on
`drawPools` for the managers who ask, one click each. **Tell the managers
before the deploy**, because a manager who had built a draft last week will
find it read-only and should hear why from a person, not from the sentence.

Drafts already saved stay saved. The first history entry for a group is
written on its first save after deploy.

---

## Open decisions for Jay

1. ~~**Notification address**: environment variable or per-account email.~~
   **Resolved 8 Sep 2026 by `spec-club-hub-sign-in-sep-2026.md`**, which
   goes first: every account then carries the email it signed in with, so
   the review email goes to **every approved organiser account with an
   email**, and no environment variable is needed. The `sendMail()` call in
   § 5 takes that list. If the hub sign-in spec is ever dropped, this
   decision reopens and the environment variable is the answer.
2. **First draft for a partial-rights manager** — **decided 8 Sep 2026: an
   organiser saves once first.** A pools-only or times-only manager whose
   group has no stored draft is refused with *"Ask a tournament organiser to
   save this group's draw once, then you can edit it."* No comparison
   against the auto-generated draw is built. § 1.
3. **Freeze moment** — **decided 8 Sep 2026: midnight at the start of the
   group's day**, as specced in § 3. First kickoff was rejected because it
   means reading the draft inside the permission check and a draft with no
   slots has no kickoff.

No open decisions remain. Build order: `spec-club-hub-sign-in-sep-2026.md`
first, then this, then `spec-pitch-marshals-sep-2026.md`.

---

## Arguments against this spec, for whoever makes them next year

- *"Managers know their group best; the desk becomes a bottleneck."* True,
  and the two switches are the answer: grant `drawPools` to the ones who do.
  The bottleneck argument is about times and pitches, which is exactly the
  pair a single-group manager cannot judge.
- *"Two switches is already complicated; make it one."* One switch means
  granting times to anyone who is trusted with pools, and times are the
  cross-group field. The split is the whole point of § 4.
- *"Why not let managers publish once an organiser has approved?"* Because
  then "approved" is a third state that has to be stored, shown, and
  invalidated when the draft changes again. Send-for-review plus organiser
  publish gets the same outcome with one state instead of two.
- *"History is over-engineering for a two-day event."* It is thirty lines in
  one function and it is the only undo the blob store will ever have. The
  first time a draw is wiped at 09:40 it pays for itself.
