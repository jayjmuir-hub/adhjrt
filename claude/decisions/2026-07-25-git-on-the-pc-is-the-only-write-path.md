# Every write to GitHub goes through real git on the maintainer's PC, and bytes are never retyped through the model

**Ruling.** The only write path is `git` on a PC clone, driven through the desktop bridge. Anything built elsewhere travels as a `git bundle` or a direct file transfer, lands with `git merge --ff-only`, and is proven by matching the tree hash on both sides. The local GitHub MCP server stays removed.

**Why.** Every route that passed file content through the model's context transcribed it and corrupted it, base64 chunks included. Git moves bytes, so size and binary stop mattering. The MCP server also kept a live write token in a plain-text config file.

**Against, and why it lost.** The MCP server worked for small edits and needed no PC, but its token exposure and size limits made it the worse trade. A project-neutral copy of this method was also dropped: a reusable doc that disagrees with the authoritative one is a trap, so a future project derives it from `CLAUDE.md` instead.

**Replaces.** The GitHub MCP write fallback and base64 transfer.

**Where in the code.** Not in code; enforced by `CLAUDE.md` (how Claude writes to GitHub).
