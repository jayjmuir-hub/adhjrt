# Spec — the age-group selector, grouped by day with split labels

**Status:** proposed, 6 Aug 2026. Jay asked for the age-group selection in
Fixtures and Results to be "cleaner", chose **both surfaces, one design** and
the **group-by-day + split-label** direction. Mockup sent the same day.
**No code written yet — waiting on Jay looking at the mockup.**

## What is there now, measured

| | `/app` | `/scores` |
|---|---|---|
| Groups shown | **15** | **13** — `publicAgeGroups` filters on `hasStandings`, so U6 and U7 are out |
| Layout | one `.pill-row`, `display:flex; overflow-x:auto` | `flex-wrap:wrap`, gap 10px |
| Scrollbar | **hidden on purpose** (`scrollbar-width:none`) | n/a |
| Label | full name, 6–16 characters | same |
| Day shown | only as the colour of the **selected** pill (`.pill.on.sun`) | not at all |
| Where | shared by Fixtures, Results **and Tables** via `pills()` | the public tab row |

## The four problems, named

1. **The label carries two facts glued together.** `U9 Mixed Contact` is 16
   characters, `U6 Tag` is 6. You scan for the age band; at selection time the
   format is noise — and it is what makes the chips long and wildly uneven.
2. **Nothing says more groups exist.** The scrollbar is deliberately hidden, so
   on `/app` eleven of fifteen are off-screen with no affordance.
3. **Day is effectively invisible.** `.sun` only renders once a pill is
   selected, so an unselected row is fifteen identical chips — and U12 and U12G
   sit adjacent while playing on **different days**.
4. **No structure at all** — one flat list, three or four wrapped lines on
   `/scores`.

## The design

**Two labelled blocks — SATURDAY / SUNDAY — each a wrapped set of chips, and a
chip whose label is split into age (big) and format (small).**

- ⚠️ **THE DAY SPLIT IS DERIVED, NEVER TYPED.** It comes from the venue layout
  (`dayIdOfAgeGroup()` / `DEFAULT_VENUE`), where an age group is on Saturday
  *because that is where it holds pitches*. `CLAUDE.md` is explicit: *"If you
  find yourself typing a list of age groups next to a day, stop."* Move a group
  in the back office and it moves block here, with no deploy. A hardcoded list
  is exactly the bug that once put U12G on the wrong day on the public site.
- **The label split is the FIRST SPACE.** Everything before it is the age band,
  the rest is the format. All fifteen names follow that shape
  (`U12G` + `QR`, `U9` + `Mixed Contact`). ⚠️ A name with **no** space keeps the
  whole string as the age and renders no format line, so a future group named
  `U20` degrades rather than disappearing.
- **Colour keeps its current meaning** — red for day one, green for day two, the
  same coding the homepage format cards use. It is now on the block rule as
  well as the selected chip, so it means something *before* you choose.
- One visual language on both surfaces; only the palette differs (`/app` light
  on `--paper`, `/scores` dark on `--ink`).

## What this deliberately does NOT do

- ⚠️ **No colour per age group.** The 15-tint palette exists and is
  contrast-measured for the venue map, but fifteen colours in a row is confetti,
  not navigation.
- ⚠️ **Nothing is hidden or dimmed for "not published yet".** Today *nothing* is
  published, so every chip would grey out. Revisit after the real draw exists.
- **The girls' groups stay interleaved by age.** Clustering them is an editorial
  decision, not a UI one, and was flagged to Jay rather than taken.
- **U6/U7 stay out of `/scores`.** That filter is deliberate and documented —
  offering a tab that can only ever say "no standings are kept" is worse.

## Where the code goes

Two implementations, one design — the surfaces share no code and there is no
build step.

| | |
|---|---|
| `/app` | `pills()` in `app.html` (vanilla template string). ⚠️ **Shared by Fixtures, Results AND Tables** — one change, three places, so it must read well in all three. |
| `/scores` | `ageTabs` in `Scores & Standings.dc.html` + its `<sc-for>` block. Needs a nested loop (blocks → chips), the same shape the pools list already uses. |

⚠️ **`ageTabs`' `onSelect` also calls `this.props.onAgeChange`** — that is what
keeps the homepage's embedded Fixtures section in step. Regrouping must not drop
it.

## Testing

- Both surfaces: **every group appears exactly once**, and the block it lands in
  agrees with the venue layout — asserted by **reading the layout**, not against
  a written-out list, so the two cannot drift.
- The split is asserted on **all fifteen real names**, both halves, plus a
  no-space name to prove the fallback.
- The selected chip carries the **day's** colour, not always red.
- `/scores`: still 13, still excludes U6/U7, and `onAgeChange` still fires.
- ⚠️ A fault that hardcodes the day list must be caught — that is the whole
  point of deriving it.

## Cost

Cosmetic, so **the mockup exists to stop this iterating one deploy at a time**,
which is the most expensive way to change how something looks. Build on
`Compare` (0 credits), look at it on the branch preview, and land it with the
`Manager.dc.html` fix already sitting there — **one 15-credit production deploy
for both.**
