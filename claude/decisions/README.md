# claude/decisions/ — one card per ruling

Each file records one thing that was decided: **Ruling.** what it is,
**Why.**, **Against, and why it lost.** (the argument somebody will make again),
optionally **Replaces.**, and **Where in the code.** Cards are 80–200 words and
carry no names, quotes or "currently". The date in the filename is when the
ruling was made.

**When to add one:** before code that settles a question somebody could argue
the other way. If you are about to overturn a card, read its "Against" first,
then write a new card that says **Replaces.** and names the old one. Do not
edit an old ruling into its opposite.

**Not here:** how the code behaves (`/RESTORE.md`), rules for working in the
repo (`/CLAUDE.md`), procedures (`claude/runbooks/`), open work (Linear, team
"ADH JRT Team").

`MAPPING.txt` maps every removed spec, plan and status file to the cards that
carry its rulings, so a source comment citing a removed path can still be
followed.
