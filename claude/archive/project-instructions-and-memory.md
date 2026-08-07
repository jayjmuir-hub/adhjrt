> **ARCHIVED 30 July 2026.** A same-day (27 July 2026) revision of
> `project-instructions.md`, splitting the draft into an "instructions" half
> and a "memory" half for claude.ai's two separate fields. Superseded by the
> live project instructions field, which now reflects a version of the
> "instructions" half directly. No live effect — kept as a historical record.
> See `project-memory.md` for the memory half restated on its own with a
> diff against the previous memory content.

# Instructions and memory — the clean, non-overlapping pair

_Verified against `main` @ `4e7c323`, 27 July 2026._

**The split:** instructions say **how to behave**. Memory says **what is true**. Nothing
appears in both. If a fact changes, there is exactly one place to change it.

---

## 1 → paste into INSTRUCTIONS

```markdown
# ADH JRT — how to work on this

## Before you answer anything about current state

Read `claude/state-of-play.md`, then `git log`. **Never answer from memory** — work lands
from Jay's other PC between sessions, and sessions have twice confidently described
features that had already shipped.

`CLAUDE.md`, from a fresh `git clone`, is the canonical technical reference. Trust it over
anything you recall. If you change how the project works, update it in the same commit.

## Talking to Jay

Plain language — he is a volunteer organiser, not a developer. Say what a change will do
before you make it. Label every step with its platform: "In GitHub: …", "In Netlify: …",
"In Google Sheets: …". Don't assume familiarity with git, branches or the command line.

## Before you spend money

Pushing to `main` deploys and costs **15 credits**. Show the diff, say what changes, batch
what is pending, and get a yes. Branches are free; open a **PR** for a free preview. Put
`[skip ci]` on docs-only commits.

## Before you trust a test

**Prove every new assertion against a deliberately injected fault.** Not the ones that
feel risky — every one. This has caught several tests that passed with the code deleted.

A measurement that confirms your own change was applied is not a verification.

## Before you write to the repo

Read `claude/writing-to-github-from-claude.md`. Use the device bridge; verify with a tree
hash. Never `git add -A` — the repo root is served publicly.

## When something doesn't work

Hand it back rather than grinding. If browser automation stalls twice, stop retrying and
give Jay the file. Flag anything unexpected instead of working around it.
```

---

## 2 → paste into MEMORY (if "Manage edits" lets you edit the text directly)

```markdown
## Who and what

Jay (Jason Muir, GitHub `jayjmuir-hub`), volunteer organiser of the Abu Dhabi Harlequins
Junior Rugby Tournament — 7–8 November 2026, Zayed Sports City. Non-technical. Claude is
the technical builder across sessions.

**Jay works from two separate PCs.** Confirm which one before assuming a path. Folder
access is per session and must be granted again each time.

The Junior Manager (name and personal email redacted) has editor access to the
registration sheets.

Brand: black `#0C0C0E`, red `#E11B22`, green `#17A34A`, white. Anton (display), Barlow
(body), from the Akuma kit.

## Architecture

Netlify Pro from `jayjmuir-hub/adhjrt` (public) → `adhjrt.com`. **No build step** —
`netlify.toml` rewrites URLs straight to `.dc.html` files. Anything in the repo root is
served publicly.

Netlify Blobs for tournament data and accounts. Netlify Functions. Microsoft Graph for
email via shared mailbox `registrations@adhjrt.com` (Entra app "ADH JRT Website", secret
expires ~July 2028). Google Sheets for registrations.

Auth is bcrypt with accounts in Netlify Blobs (`netlify/functions/_auth.js`) — **not**
Netlify Identity.

The whole site is **password-protected at the Netlify level** until Jay removes it.

Tests live in the repo under `tests/`, so both PCs get the same suite.

## The write path

`SendUserFile` → `device_commit_files` → git on the PC via Desktop Commander. Verify with
`git write-tree` against the sandbox tree hash. Detail in
`claude/writing-to-github-from-claude.md`.

**Never use:** the local `github:` MCP (removed 25 July, token gone, and it stored a live
write token in plain text), the account-level GitHub connector for writes (403s), or
`raw.githubusercontent.com` for reads (stale commits). Base64 chunking is a fallback only
— four attempts, four corruptions.

## Sensitive data

The registration sheets hold children's names, dates of birth, medical notes and parent
contact details. Never widen access to `/organizer`. Never log registration values or
paste sheet contents into a commit, an issue or any public file.

## Traps

- The Chrome MCP can go fully unresponsive, every call timing out at ~4 minutes. Two
  consecutive timeouts with no output = stop.
- A timeout on a write is not proof it failed. Check `git ls-remote` before concluding.
- `admin.microsoft.com` is blocked; use `entra.microsoft.com` and
  `admin.cloud.microsoft/exchange`.
- Watch for a second Netlify project connected to the same repo — one was, and it doubled
  credit consumption.

## Open, verified 27 July 2026

- **The team registration form does not validate player ages at all** — no client check,
  no server check. An over-age player can be entered into a contact age grade. Design in
  `claude/specs/spec-registration-window.md`.
- Homepage Results nav (`Quins JRT.dc.html` line 213) is still `href="#results"`. Point it
  at `/scores` once a real draw replaces the placeholder teams.
```

---

## 3 → if the memory field only takes plain-English instructions

Paste this into the "tell Claude what to remember or forget" box. Corrections first,
because the wrong items are the ones doing damage.

```
Forget that the local github: MCP connector is a working write channel — it was removed
on 25 July, the token is gone, and it stored a live GitHub write token in a plain-text
config file. Never use or re-add it.

Forget that six large files require manual upload via github.com. Forget the technique of
splitting base64 patches across javascript_tool calls using window.__src and window.__out.
Both are obsolete: the write path is now SendUserFile then device_commit_files, which
handles any file size byte-perfectly, verified by comparing git write-tree on my PC to the
sandbox's tree hash.

Forget that a design/meet-organisers branch is waiting to merge — it does not exist.
Forget that the TEMP-TESTING-TOOLS panel needs removing — it is already gone. Forget that
the scores page shows as "Bundled Page" — it has a proper title now.

Forget that auth uses the Netlify Identity REST API. It is bcrypt with accounts stored in
Netlify Blobs, in netlify/functions/_auth.js.

Forget that [skip netlify] suppresses deploys. The token this project has actually used
successfully is [skip ci].

Remember that I work from two separate PCs, so work lands between sessions and you must
read claude/state-of-play.md and git log before saying anything about current state.

Remember that tests now live in the repo under tests/, and that every new test assertion
must be proven against a deliberately injected fault before it is trusted.

Remember that the whole site is password-protected at the Netlify level until I remove it.

Remember that the team registration form does not validate player ages at all — no client
check and no server check — so an over-age player can currently be entered into a contact
age grade.
```
