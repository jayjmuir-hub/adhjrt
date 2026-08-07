# Design refresh — DONE, superseded

**This doc is out of date and kept only as a pointer.** It used to say the
homepage refresh was preview-only on `design/meet-organisers`. It isn't: that
branch was merged to `main` on 24 Jul 2026 and the refresh has been live on
adhjrt.com since.

Current, authoritative description: **`CLAUDE.md` §"Design refresh"** in the
repo root. Read that, not this.

## Since then (25 Jul 2026)

The match-day app at `/app` was fixed and brought into line with the site —
merged as `cd75573`, live. Six functional defects (team following, the Today
tab, a U6/U7 manager lockout, knockout matches missing from Today, a
once-a-second re-render, and a match-day poll that blanked the screen), a new
Results view, and the site's remaining design language (Barlow Semi Condensed,
green section rules, red/green day coding, venue map, fade-up).

`/app` and `/scores` also moved to the transparent `crest.png`, so nothing in
the repo references `crest.jpeg` any more.

The traps worth carrying forward are in `CLAUDE.md` §"Gotchas found the hard
way" — in particular that `getFixtures()` returns pool teams as **names** while
standings and knockout slots are **codes**, which is what silently broke
"follow my team".

## Outstanding
Down to three, all in `CLAUDE.md` §"Outstanding": the real draw (everything
else waits on it), the Results nav link (blocked by the draw), and sponsors
(blocked on artwork).
