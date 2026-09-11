# The large .dc.html pages keep their script inline; they are not split into separate .js files

**Ruling.** `Quins JRT.dc.html`, `Organizer.dc.html` and the other page files keep each page's markup, style and script in one file. The shared data layers stay separate files, as they are. Any future split happens only after the tournament, as its own specced piece of work.

**Why.** The repo root is the site and there is no build step; one page, one file is what the reading map rests on. A split touches thousands of lines in the most important files for no visible benefit, and the suite's fault anchors point at exact text in those files, so every past restructure has broken batches of them.

**Against, and why it lost.** graft indexes JavaScript only, so it cannot see inside `.dc.html` pages, and smaller files are cheaper for any tool to read. That gap is real but limited: graft still covers the functions, data layers, tests and tools. Proven and large beats tidy and unverified before a live event.

**Where in the code.** `Quins JRT.dc.html`, `Organizer.dc.html`, `scores-data.js`, `organizer-data.js`, `.claude/skills/graft/SKILL.md`.
