> **ARCHIVED 30 July 2026.** This was a draft written 27 July 2026 to replace the
> claude.ai project's Custom Instructions field. It served its purpose — the
> live instructions field now reflects a version of this content directly, so
> this file has no live effect and nothing should read it as current. Kept
> only as a historical record of what changed and when. See two later drafts
> (`project-instructions-and-memory.md`, `project-memory.md`) for how this
> evolved further the same day, and the live project instructions (visible in
> any session's system context) for what's actually in effect now.

# Replacement text for the claude.ai project instructions

_Paste the block below into the ADH JRT project's custom-instructions field, replacing
what is there. Shorter than the current version and two-PC aware._

_Why shorter: instructions are re-read on **every request**, so length there is the most
expensive text in the whole project. Anything that is reference rather than
always-needed belongs in a doc the session reads once, on purpose._

---

```markdown
# ADH JRT — project instructions

## Read first, every session

1. `claude/state-of-play.md` — current status. Start here.
2. `CLAUDE.md` in the repo root (`jayjmuir-hub/adhjrt`) — the authoritative technical
   description: architecture, functions, age groups, scoring, deploys, gotchas. Trust it
   over anything you remember.

Read the repo with plain `git clone https://github.com/jayjmuir-hub/adhjrt.git` in the
sandbox. Never a GitHub connector or `raw.githubusercontent.com` — both serve stale
commits.

If you change how the project works, update `CLAUDE.md` in the same commit. Don't
duplicate `CLAUDE.md` here.

## What it is

Abu Dhabi Harlequins Junior Rugby Tournament, 7–8 Nov 2026, Zayed Sports City. Marketing
page, live scores, organiser back office, match-day phone app — four URLs, one repo,
Netlify Pro at adhjrt.com.

## Who you're working with

Jay is a volunteer organiser and **not a developer**.

- Plain language. Say what a change will do before making it.
- Label every instruction with its system: "In GitHub: …", "In Netlify: …", "In Google
  Sheets: …".
- Don't assume familiarity with git, branches or the command line.

**Jay works from two separate PCs.** Confirm which one you are on before assuming a path.
Folder access is per session and must be granted again each time. Fetch before touching
anything — the clone in front of you may be behind the other machine.

## Writing to the repo

The write path is `SendUserFile` → `device_commit_files` → git on the PC via Desktop
Commander, verified by comparing `git write-tree` to the sandbox's tree hash.

Full method, the four routes that don't work, and the PowerShell traps:
`claude/writing-to-github-from-claude.md`. **Read it before your first write.**

## Deploys cost money — get a yes

Pushing to `main` deploys and spends **15 Netlify credits** (3,000/month) regardless of
size. Branches are free. A **PR** gives a free password-protected deploy preview; a branch
alone does not. Before pushing or merging to `main`: show the diff, say what changes,
batch what's pending, get a yes. Add `[skip ci]` to commits that don't affect the live
site — docs, comments — and they cost nothing.

## Tests

In the repo under `tests/` (moved there in `b6025ea`). They travel with a clone, so both
PCs get the same suite.

**Every new assertion must be proven against a deliberately injected fault before it is
trusted.** This has caught four tests that passed with the code deleted. Fault-inject
every assertion, not the ones that feel risky.

## Sensitive data

The registration sheets hold children's names, dates of birth, medical notes and parent
contact details.

- Never widen access to `/organizer`.
- Never log registration values or paste sheet contents into a commit, an issue, or any
  public file.
- Anything in the repo **root** is served publicly. Use `git add -u`, never `git add -A`.

## When something doesn't work

Hand it back rather than grinding. If browser automation stalls, stop retrying — stage
the file and let Jay do it. Flag anything unexpected instead of working around it.
```

---

## Note

An earlier version of this file said the tests were not in git and should be moved. They
already had been (`b6025ea`), by a session on the other PC, before that was written —
which is itself the argument for the "fetch and read the project before you write
anything" rule above.
