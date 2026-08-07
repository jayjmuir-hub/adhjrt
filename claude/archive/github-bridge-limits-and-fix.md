# GitHub "bridge limit" — root cause and fix

> **STATUS (25 Jul 2026): resolved and closed.** Real `git` on jay-pc is now the
> **sole** write path (`CLAUDE.md` §"How Claude writes to GitHub"). The GitHub
> MCP server this doc diagnoses — the `mcp__remote-devices__github__*` tools and
> its PAT — was **removed from the desktop config** on 25 Jul 2026 and must not
> be re-added. This doc is kept only as the historical record of *why* that
> server was never a good write channel, which is the justification for git being
> the only path. Nothing here is a live instruction.

_Written 24 Jul 2026, from evidence gathered while landing the single-pool fix + photo extraction._

## TL;DR
The "bridge is too small" problem was really **three separate limits**, and the
root cause is that the GitHub MCP write/read tools move a file by serialising its
whole content as **text through the model's context window**. That path is
token-limited and text-only. The bridge, the PAT, and permissions are all fine.
**Fix: use real `git` on Jay's machine so file content never passes through the
model at all.** (That fix is now the permanent, only path — see the status note
above.)

## What actually happened (evidence)
1. **~25,000-token cap on any tool result coming *into* context (~100 KB text).**
   `get_file_contents` on the 300 KB homepage → "result (305,283 characters)
   exceeds maximum allowed tokens" (spilled to a file). `Read` → "maximum allowed
   size (256 KB)" whole-file, and "29,533 tokens exceeds maximum allowed (25,000)"
   per chunk. So a 300 KB file can't be read back.
2. **To write a file you must first hold it in context.** `create_or_update_file`
   takes the whole file text as a parameter; typing it accurately needs it loaded
   first — which hits limit #1. Circular: too big to read → too big to re-send.
3. **Write tools are text-only; binary can't pass at any size.** Probe: sent
   `content:"SGk="` (base64 of "Hi"); GitHub stored the literal text `SGk=`, not
   decoded bytes. `@modelcontextprotocol/server-github` saves the string verbatim
   as UTF-8. A JPEG can't go through — raw bytes aren't valid in a text param, and
   base64 would store the base64 text, not the image.

## Root cause
The tools transfer files as text through the context window + JSON params. That
has a hard token budget and carries only text. They are built for **small text
edits**, not file transfer. Proof it's the *path*, not the bridge: a helper
**sub-agent** (its own fresh context) pushed the 132 KB homepage **byte-perfect
in one call** — same bridge, same tool, same token.

## The fix that was taken
**Real `git` push path on Jay's PC.** Git moves bytes on disk / over the git
protocol — content never touches the model's context. Handles any size and
binary. A local clone of `adhjrt` sits at `C:\Users\jayjm\GitHub\adhjrt` with the
push credential cached in Git Credential Manager; drive it with the Desktop
Commander shell (`mcp__remote-devices__Desktop_Commander__start_process`). Then
`git add/commit/push` works for everything, from any session.

Standing rule that came out of this and still holds: **keep source files small &
text-only** — no inline base64 images/fonts in `.dc.html`; keep them as
`assets/` files. It keeps pages light (the reason now is page weight, not a write
limit — git has no size cap).

The old sub-agent-push and browser-upload workarounds are obsolete now that git
handles any size and binary; they are not needed and not documented as live paths.

## Note
The account-level "GitHub Integration" connector is OAuth/read-only and 403s on
writes — never use it for writing. The local `mcp__remote-devices__github__*`
server that this doc is about has been **removed**; do not reinstate it. All
writes go through real `git` on jay-pc — see `CLAUDE.md` "How Claude writes to
GitHub".
