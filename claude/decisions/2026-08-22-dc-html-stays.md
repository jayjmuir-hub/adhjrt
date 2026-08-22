# The big `.dc.html` page files stay as they are (22 Aug 2026)

Jay asked why the pages are single big HTML files with their code inside, and
whether to change that. Decision, Jay's words: **"ok leave it as is then."**

## What was considered and rejected

Pulling the page JavaScript out of `Quins JRT.dc.html` and `Organizer.dc.html`
(~4,900 lines each) into separate `.js` files, the way `scores-data.js` and
`organizer-data.js` already are.

**The argument FOR (so nobody re-derives it):** graft (installed 22 Aug 2026,
skill in `.claude/skills/graft/`) indexes JavaScript and Python only, so it
cannot see inside the `.dc.html` pages; separate files would also be smaller
and cheaper for any tool to read.

**Why it lost:**

- The realistic change touches thousands of lines in the most important files
  on the site, for zero user-visible benefit.
- The suite's fault-injection anchors point at exact lines in those files;
  every past restructure broke batches of anchors and each repointing cost
  real effort (see `claude/state-of-play.md`, passim).
- The no-build-step model — the repo root IS the site — is a deliberate
  strength for a volunteer-run project, and one page = one file is what
  `CLAUDE.md`'s reading map is built on.
- The tournament is 14–15 Nov 2026; "big but proven" beats "tidy but
  re-verified from scratch".

## If it is ever revisited

After the tournament only, as its own specced piece of work per rule 9. The
graft gap is the only standing cost, and graft fully covers
`netlify/functions/`, the data layers, `tests/` and `tools/` regardless.
