# Pitches and clash detection — design

_Written 26 July 2026, after reading `Pitch maps_Final.pdf` (25–26 Oct 2025) and
the current code on `fix/team-names-persist` @ `bf1f88b`._

Jay's decisions, taken 26 July:

- Start times **auto-suggest but stay editable**.
- A manager can only pick from the **pitches assigned to their age group**.
- The whole venue layout — pitch names per day, which day each group plays, which
  pitches each group gets — is **editable in the back office**, not hardcoded.
- **Organisers only.** Managers see it read-only.

Everything below assumes all four.

---

## 1. Where things stand today

Not as bad as it looks. Most of the plumbing is already in place.

**Already built and working**

- Every match slot already has a `pitch` field: `{ id, poolId, home, away, startMins, pitch }`.
- There is already a pitch dropdown on every match in the Fixture Editor, and a
  second quicker one on the score-entry tab for moving a game on match day.
- Each age group already has its own editable list of pitch names —
  `draw.pitches` — with "+ Add pitch" and removable chips.
- `pitches` is already in `saveDraw()`'s allow-list in `scores-data.js`, so it
  saves and publishes correctly. So does `pools`.
- The public pages and the phone app already read and display `pitch`.

**What is actually missing**

1. **Nothing is filled in.** Every age group's `pitches` list is empty, so the
   dropdowns offer only "TBD", and all ~430 slots say TBD.
2. **Every pool starts at 08:00.** The generator does
   `DAY_START_MINS (08:00) + index × SLOT_MINS (20)` **per pool**
   (`scores-data.js:375`). A group with three pools therefore has three matches
   kicking off at 08:00. That is *correct* if each pool is on its own pitch, and
   nonsense if they are not — and nothing currently says which.
3. **No age group knows what any other is doing.** Draws are stored one blob per
   age group and edited independently, so two groups can be handed the same
   pitch at the same time with nothing to complain about it.
4. **The Saturday/Sunday split is one hardcoded line inside `app.html`**
   (line 387) and it is wrong — see section 5.
5. **Three pitch vocabularies.** The homepage says "16 PITCHES", the app says
   "Pitches A, B, C & D", the real map says D1–D5, C4–C5, B1, A1.

---

## 2. The core idea: a pool is a pitch's day

A pool is already a run of matches 20 minutes apart. That *is* what a pitch does
all day. So rather than setting a pitch on 430 matches, set two things on each
**pool** — a pitch and a start time — and push them down onto that pool's
matches. Roughly 40 pools across the weekend instead of 430 slots.

It also falls out of this that the clash check becomes arithmetic: two pools
clash if they are on the same pitch, on the same day, and their time ranges
overlap.

And it handles the time-shared areas on the 2025 map for free. D4 and D5 running
U5/6 in the morning and U7 in the afternoon is just two pools on the same pitch
with different start times — no special case needed.

### The pool controls are a bulk editor, not a new layer of data

This matters, so it is stated plainly. Setting a pool's pitch and start time
**immediately rewrites that pool's `slots[].pitch` and `slots[].startMins`**.
It does not introduce inheritance that readers have to resolve.

Consequences, all of them good:

- **Zero change** to the public Fixtures page, the standings, the phone app, or
  the shape of the published JSON. They keep reading `slot.pitch` and
  `slot.startMins` exactly as now.
- Per-match overrides keep working. Moving one game off the pool's pitch on the
  morning still does what it does today.
- Changing a pool's pitch overwrites any per-match override in that pool. So the
  UI warns first: *"3 matches in this pool are on a different pitch. Change them
  all to C4?"*
- `pools` is already in the `saveDraw()` allow-list and pool objects are stored
  whole, so adding `pitch` and `startMins` to a pool needs **no server change and
  no allow-list change**. (`teamNames` was the cautionary tale here — a field
  missing from that allow-list is silently dropped before the request is sent.)

---

## 3. The venue: a built-in default you can override

Jay needs to be able to move an age group to the other day, or rename a pitch,
without waiting for a code change. So the layout is configuration, not source.

This is exactly the pattern `_scoring.js` + `scoring-rules.js` already uses for
the scoring laws, and it should be copied rather than reinvented:

- **`netlify/functions/_venue.js`** holds `DEFAULT_VENUE` (the 2025 map, below)
  and `loadVenue(blobStore)`, which merges any saved override over it.
- **`netlify/functions/venue-layout.js`** — `GET` is public (the app and the
  fixtures pages need to know which day a group plays; it is configuration, not
  personal data), `POST` is **organisers only**, stored at key `venue` in the
  existing `config` blob store.
- Nothing saved, or the fetch fails → the built-in default. A bad save can never
  leave an age group with no day at all.
- **Reset to default** button in the panel.

### The default layout, read off the 2025 map

```js
const DEFAULT_VENUE = {
  day1: {                     // Saturday 14 November 2026
    label: 'Saturday 14 November',
    pitches: ['D5A','D5B','D4A','D4B','D3A','D3B','D2','D1',
              'C4','C5','B1A','B1B','B1C','B1D','A1A','A1B','A1C','A1D'],
    groups: {
      u6:   ['D4A','D4B','D5A','D5B'],   // morning
      u7:   ['D4A','D4B','D5A','D5B'],   // afternoon, same four
      u8:   ['B1A','B1B','B1C','B1D'],
      u9:   ['A1A','A1B','A1C','A1D'],
      u10:  ['C5'],
      u11:  ['C4'],
      u12:  ['D3A','D3B'],
      u18b: ['D2'],
      u18g: ['D1'],
    },
  },
  day2: {                     // Sunday 15 November 2026
    label: 'Sunday 15 November',
    pitches: ['D3','D2','D1','C4A','C4B','C5','B1A','B1B','A1A','A1B'],
    groups: {
      u13:  ['C4A','C4B'],
      u14b: ['D3'],
      u14g: ['A1A','A1B'],
      u12g: ['B1A','B1B'],
      u16b: ['D2','D1'],
      u16g: ['C5'],
    },
  },
};
```

18 playing surfaces on Saturday, 10 on Sunday, straight off the map. Sub-pitch
letters (`B1A`–`B1D`) are mine — the map draws four boxes inside the red B1
outline and does not name them. Worth agreeing with whoever prints the pitch
flags so the app and the signage match.

### The day split stops being its own list

`dayOf(agId)` becomes "which day's `groups` contains this id". One source of
truth, and the day can never drift out of step with the pitch assignment.

### The one hazard, and the guard against it

The default has to exist in **two** places — `_venue.js` for the server and
`scores-data.js` for the front end, which has an offline/local fallback path.
This repo has been bitten by exactly that before (`FESTIVAL_AGE_IDS` in
`_scoring.js` mirroring `hasStandings` in `scores-data.js`; `SATURDAY` in
`app.html` drifting from reality). So:

- both copies carry a "keep these in step" comment pointing at each other, and
- **a test asserts the two tables are identical**, so a change to one and not the
  other fails loudly instead of silently.

### Guardrails in the editor

- Moving a group to the other day **clears its pitch assignment**, because its
  old pitches may not exist on the new day. It says so before doing it.
- A group with **no pitches**, or **fewer pitches than it has pools**, is flagged
  in the panel — not blocked.
- Renaming or removing a pitch that saved fixtures are already on is flagged with
  the count: *"C4 is used by 12 matches in U11. Rename there too?"*
- Moving a group whose fixtures are **already published** is flagged hardest:
  parents are holding the old day. It lists which groups are affected and still
  lets you do it.

## 4. What gets built, in order

Five steps. Each stands on its own, goes on the branch, and can be looked at
before the next one starts. **Steps 1–4 are done and pushed; only Step 5 remains.**

**Step 1 — the venue data and the corrected day split. ✅ DONE (`77cd0c1`, 26 Jul 2026).** No new UI.
`DEFAULT_VENUE` in `_venue.js` and `scores-data.js`, `loadVenue()`, the public
`GET /venue-layout`, and `app.html`'s `SATURDAY` / `dayOf` / `isSat` replaced by
readers derived from it. Plus the test that keeps the two default tables in step.
Nothing visible changes except the day each group appears under, which becomes
correct. Everything else depends on this.

**Step 2 — the Venue & days panel. ✅ DONE (`c7989df`, 26 Jul 2026).**
`POST /venue-layout` (organisers only) and a fourth tab in the Organizer back
office: each day's pitch list with add and remove, and one row per age group with a
Saturday/Sunday selector and tick boxes for its pitches. Every guardrail in section
3 is in, plus per-pitch fixture counts on the removal confirm
(`GET ?usage=1`). The same validation runs on both sides and `test-venue-panel.js`
asserts the two agree.

**Step 3 — pitch and start time on each pool, in the Fixture Editor. ✅ DONE
(`9cc0d31`, 26 Jul 2026)**, with one change from the plan below: both values are
**derived from the pool's slots** rather than stored on the pool. Behaviourally the
same, and it means no reader changed, no allow-list field, no migration, and the
pool header cannot disagree with the fixtures under it. Also delivered: the
free-text pitch list is gone (read-only panel driven by the layout), an **in-group**
clash check per pitch, and `+ Add match slot` / `Regenerate from pool` now keep the
pool's placement instead of silently unplacing it.
Above each pool's match list, two boxes:

```
POOL A     Pitch [ C4 ▾ ]   Start [ 08:00 ]     6 matches · 08:00–10:00
```

- The dropdown lists only that age group's assigned pitches, plus whatever the
  pool is already on, plus TBD.
- The start box auto-fills when a pitch is picked: 08:00 if that pitch has
  nothing else on it in this age group, otherwise straight after the last pool
  already there. Typed over freely.
- Changing either rewrites that pool's slots.
- End time is shown, not stored — `start + matches × 20`.

**Step 4 — the clash check. ✅ DONE (`077e68c`, 26 Jul 2026).** Delivered as
described, plus: knockout matches are booked individually (they are not in a pool and
would otherwise have escaped), a pool split across pitches by hand is booked once per
pitch for the same reason, the same pitch NAME on different days is correctly treated
as unrelated fields, and pitch names are compared case- and space-insensitively.

A **Check the whole weekend** button. Reads every
age group's draw, expands each to (pitch, day, start, end, group, pool) rows, and
lists every overlap in plain English:

> **Pitch C4 · Sunday** — U13 Pool A (08:00–10:00) overlaps U16B Pool B (09:20–11:00)

Plus two softer warnings in the same list, because both are silent failures today:

- a pool still on TBD;
- a pool on a pitch not assigned to its age group.

On **Publish**, the check runs for that age group and any clash shows as a
**warning with a Publish anyway button** — never a block. On the morning of the
tournament the person who needs to move a game must not be locked out.

**Where the button lives:** the organiser back office, and the age group
manager's editor. One honest limitation — an organiser's token can read every
group's *draft*, but a manager's can only read their own. So a manager's check
compares their draft against everyone else's **published** fixtures. That is the
right comparison anyway (published is what people are turning up for), but two
managers editing unsaved drafts at the same time can't see each other. The
organiser check does see everything.

**Step 5 — one set of pitch names.** ← the only code left

Replace "16 PITCHES" on the homepage and
"Pitches A, B, C & D" in the app with figures derived from the live layout, so
they follow the back office instead of needing an edit.

## 5. The day split shipping today is wrong

`app.html:387` today:

```js
const SATURDAY = ['u6','u7','u8','u9','u10','u11','u12','u12g'];
```

The 2025 map, read off the two page headers:

- **Saturday 25 Oct** — U5/6, U7, U8, U9, U10, U11, U12, **U18 & U18g**
- **Sunday 26 Oct** — U13, U14, **U12G QR**, U14G QR, U16 & U16G

So against the 2026 age groups:

| | Should be |
|---|---|
| Saturday | u6, u7, u8, u9, u10, u11, u12, **u18b**, **u18g** |
| Sunday | u13, u14b, u14g, **u12g**, u16b, u16g |

Two errors in the current line: **u12g is on Saturday and belongs on Sunday**,
and **u18b / u18g are missing from Saturday**, so they currently fall through to
Sunday. Nine groups Saturday, six Sunday — which matches the 2025 split exactly.

Jay confirmed on 26 July that the 2026 running order is the same as 2025, so the
table above is the **default**. From Step 2 on it is also a thing he can change
in the back office without a deploy, which is why it is configuration and not a
line of code.

---

## 6. Things this deliberately does not do

- **No automatic scheduling.** Nothing picks pitches or times for an age group on
  its own. It suggests a start time and it tells you when something overlaps.
  Anything cleverer needs referee counts, pitch sizes and travel between areas,
  none of which are in the system.
- **No hard block anywhere.** Every check is a warning.
- **No per-match start times on the pool control.** Individual matches keep their
  own times and can still be edited one at a time; the pool control just sets the
  whole run in one go.
- **Nothing about pitch sizes.** The map shows big pitches (D1, D2) and small
  ones (the B1/A1 grids), and the format table already says who plays 7s, 10s and
  12s, so the two could be cross-checked. Not in this pass; noted as an obvious
  next thing.
