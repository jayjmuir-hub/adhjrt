# Spec — Import registered teams into the fixture editor

> **STATUS: BUILT AND MERGED.** Shipped as **PR #8** (merge commit `5cb7c71`,
> 25 Jul 2026, "import registered teams, plus four bugs found by driving the
> preview"). Live on `main`. The `teamNames` map and the import panel are in
> `Scores & Standings.dc.html` and `scores-data.js`. This doc is kept as the
> design record of *why* it works the way it does — the authoritative
> description of current behaviour is `CLAUDE.md` in the repo root.
>
> Decision taken during build: **option B** (codes are the identity, a name map
> is published with the draw). All open questions below were resolved before
> build — see "Decisions taken" at the bottom.

## Why this exists

Today the fixture editor is free text. You type club names into a box and they
become the teams. Meanwhile registration issues every team a code — `ADH1` —
writes it to the Team Registrations sheet and emails it to the club. Nothing
connects the two. Whatever is typed in the editor is what parents see, and the
issued code appears nowhere.

The registration form also asks every club for a **preferred pool** (mandatory,
column N). Nobody uses it beyond displaying it on the organiser dashboard.

This feature closes both gaps: the draw is built from the registrations, using
the codes that were actually issued, honouring the pool preferences that were
actually asked for.

## The concept this rests on

There is no team record in this system. A team is a **string** in
`draw.pools[].teams`. Fixtures, standings rows, knockout slots and results all
find each other by comparing those strings. So the string is simultaneously the
team's identity and its display.

Option B separates the two: the string stays a short code (identity), and a map
published alongside the draw turns it into a readable name (display).

## Key finding — no backend change is needed

`save-schedule-override.js` takes the `schedule` object and stores it whole.
`publish-schedule.js` copies that blob to the published key whole. So a new
`teamNames` key inside the draw rides along with no function change, exactly the
way the `pitches` array already does (see `CLAUDE.md`, "Publishing fixtures").

That matters for privacy too: the published copy carries the names, so a parent
never touches `get-registrations`, which is organiser-only and sits next to
children's data. **Club names are not sensitive; the endpoint they arrive
through is.**

## Data shape

The draw object gains one optional key:

```
{
  pools:  [{ id, name, teams: ['ADH1','ADH2','DE1', ...] }],
  slots:  [...],
  pitches:[...],
  teamNames: {            // NEW - optional, per age group
    ADH1: 'AD Harlequins',
    ADH2: 'AD Harlequins 2',
    DE1:  'Dubai Exiles'
  }
}
```

**The map must be per age group, and it already is** because the draw blob is.
This is not optional: `_teams.js` numbers teams *within* an age group, so two
Quins U16B sides are ADH1 and ADH2 while their U14B side is **also** ADH1. A
global code lookup would silently collide.

Absent `teamNames` (every existing draw), behaviour is exactly as today.

## Display rule

`scores-data.js` grows two functions:

- `teamLabel(code, draw)` - full name. Order: `draw.teamNames[code]`, then the
  hardcoded `TEAM_NAMES` map, then the raw string. Always applies the existing
  "Abu Dhabi" -> "AD" shortening.
- `teamShort(code)` - the code itself, or the raw string if it is already a name.

Full name is used wherever there is row width:

- homepage fixtures section
- app match rows (Fixtures, Results, Today), match sheet header, score-entry
  side labels, walk-over options
- `/scores` pool fixtures and results
- editor team chips

Short code is used in the two places a name does not fit:

- the app's pinned standings column (96px - "Al Ain Amblers 1" overflows)
- the knockout bracket cells

The **team key card** becomes the legend for those two, listing only the codes
present in the current age group. It was hidden on 25 Jul because nothing used
codes; this brings it back with a purpose.

**Naming nicety:** number a club's teams only when they have more than one in
that age group. One Quins U16B side displays as "AD Harlequins"; two display as
"AD Harlequins 1" and "AD Harlequins 2". The code keeps its number regardless.

## The import panel

Lives in the fixture editor on `/scores`, above the pool cards, for the selected
age group. Mockup delivered in chat 25 Jul 2026.

**Header** - "9 registered for U16B · 7 with a pool preference · 2 already in
the draw".

**Two modes:**
- *Replace the pools* - clear and rebuild from the registrations. Kick-off
  times, pitches and knockout slots are kept. **Blocked once any fixture in the
  age group has a result** (see Decisions, 1).
- *Add the missing ones* - leave current pools alone, add only teams not already
  present. This is the mode for late entries, and it stays available after
  results exist.

**Review table** - one row per registered team: code chip, club, its stated
preference, and a dropdown for the pool it will land in. Every row is editable
before committing. Rows are flagged `New`, `In draw`, or `Moved`.

**Footer** - "Import N teams" and "Cancel", plus the standing reminder: this
only fills the editor. Nothing changes for anyone until **Save draw**, and
nothing is public until **Publish**.

## Assignment algorithm

1. Read registrations for the age group. A manager gets their own group via
   `get-my-registrations`; an organiser gets any. Permissions already match the
   editor's scope, so nothing new is needed.
2. Seat every team that stated a preference into that pool.
3. Distribute "No preference" teams into the smallest pools, breaking ties by
   registration order so the result is stable across re-runs.
4. If a pool is now oversubscribed relative to the others by more than one team,
   move the **latest-registered** of the preferred teams to the smallest pool,
   mark the row `Moved`, and say so in a banner above the table.
5. Never move silently. Every move is visible and reversible before commit.
6. After commit, regenerate the pool fixtures using the editor's existing
   "Regenerate" behaviour. Knockout slots are untouched.

Pool **names** are never touched — "Pool A" / "Pool B" stay as they are
(Decisions, 2).

## Edge cases

| Case | Behaviour |
|---|---|
| Any fixture in the group already has a result | *Replace* is disabled, with a line saying why. *Add* still works |
| Team registers after the draw is built | *Add the missing ones* mode places it; existing pools and times are untouched |
| Team withdraws | Not handled by import. Remove it by hand in the editor - the import never deletes |
| Re-running import over hand edits | *Replace* warns that manual pool changes will be lost and names how many teams move; *Add* is always safe |
| Two teams from one club | Distinct codes (ADH1/ADH2) and distinct display names. Import should not put them in the same pool if it can avoid it - flag if it must |
| Club not in `CLUB_PREFIXES` | `_teams.js` already falls back to initials or first three letters. Import uses whatever code was issued; no special case |
| Guest / invited team with no registration | Added by hand as free text, as today. `teamLabel` falls through to the raw string, so it displays as typed |
| Import run after publish | Only the draft changes. The public copy is unaffected until Publish is pressed again |
| Registration sheet unreachable | Panel shows the error and disables Import. The editor stays fully usable by hand |

## Sensitive data

- The import reads **only** `club`, `teamName`, `ageGroup`, `preferredPool` from
  the team rows. Coach and manager contact details are in the same rows and must
  not be copied into the draw.
- Player rows are never touched. Nothing from the player sheet goes near a draw.
- `teamNames` contains club names only - these become public when the draw is
  published, which is correct and intended.
- No registration values in any commit, issue or log (standing rule).

## Files touched, in build order

1. `scores-data.js` - `teamLabel(code, draw)` reads `draw.teamNames`; add
   `teamShort`; thread the draw through `getSchedule` / `getFixtures` /
   `getStandings` so both display surfaces can resolve names.
2. `Scores & Standings.dc.html` - the import panel, and include `teamNames` when
   saving the draw. Mind the `.dc.html` traps in `CLAUDE.md`: every value used
   as `{{ X }}` must be returned from `renderVals()`, and `style-hover` needs
   `!important` to beat an inline `style`.
3. `app.html` - short code in the standings column, full name everywhere else,
   restore the team key card as the legend.
4. `CLAUDE.md` - document `teamNames`, the display rule, and the
   codes-are-unique-per-age-group trap.

**No Netlify function changes.**

## Testing checklist

- An age group with no `teamNames` (existing draw) behaves exactly as before
- Import into an empty draw, and over a hand-built one, in both modes
- *Replace* is disabled once a result exists; *Add* still works
- A club with two teams in one age group
- The same club code in two different age groups resolves to the right name in each
- Published copy carries the names; a signed-out visitor sees names on `/scores`
  and the homepage, and the app shows names in fixtures and codes in the table
- Standings table still fits a phone without sideways scrolling
- Manager can only import their own age group; organiser can import any

## Decisions taken (25 Jul 2026)

1. **Replace is blocked once results exist.** Swapping teams under recorded
   scores would orphan them - the results are keyed to match ids, and the match
   would end up describing a game between teams that never played it. *Add the
   missing ones* stays available, since it only appends.
2. **Pool names are left alone.** "Pool A" / "Pool B" are set in the editor and
   the import does not touch them.
3. **No export back to the registrations sheet.** The draw is not written back;
   the published fixtures are the record of who is in which pool.
