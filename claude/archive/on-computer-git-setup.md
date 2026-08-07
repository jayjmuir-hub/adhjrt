# Local git push path — DONE, and now documented in the repo

**Superseded by `CLAUDE.md` §"How Claude writes to GitHub" (repo root).** Read
that, not this. Kept only as a pointer so an old link doesn't dead-end.

The short version:

- The push path is **real `git` on jay-pc** (`C:\Users\jayjm\GitHub\adhjrt`),
  driven from **any** session — cloud included — through the Desktop Commander
  MCP extension's shell. It does not need a task started "On your computer".
  Verified 25 Jul 2026 by pushing and deleting a test branch.
- Any file size, binary included, because content never crosses the model's
  context window.
- The GitHub MCP server + PAT that used to be the write **fallback** was
  **removed on 25 Jul 2026** — git is the sole write path now, and a live write
  token in a config file was exactly what we didn't want. Do not re-add it.
  Background on why that server was always a poor write channel:
  `claude/archive/github-bridge-limits-and-fix.md`.
- New-PC checklist, deploy rules and traps: `CLAUDE.md` §3–§5 of that section.

## Token hygiene — closed
The `repo`-scoped PAT was exposed on 25 Jul 2026 when the desktop config file
was dumped into a chat, and Jay dealt with it the same day. The server and its
token were then removed from the config entirely on 25 Jul 2026, so nothing is
outstanding. Standing rule (also in `CLAUDE.md`): never print
`claude_desktop_config.json`, never ask for the raw token, never accept one
pasted into chat.
