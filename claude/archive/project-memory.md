> **ARCHIVED 30 July 2026.** The memory half of the 27 July 2026
> instructions/memory draft, restated on its own with a diff against the
> previous memory content. Superseded — no live effect. Kept as a historical
> record of what was corrected and why.

# Replacement text for the project memory field

_Verified against `main` @ `4e7c323` on 27 July 2026. Paste the block below, replacing
what is there. Everything in it was checked against the repo, not recalled._

## What was wrong in the old memory

| Claim | Reality |
|---|---|
| "`github:` local MCP connector → **verified write channel**" | **REMOVED 25 July.** The token is gone; it will fail. It also parked a live write token in a plain-text config file. **Most dangerous item — it sends a session down a dead, insecure path.** |
| "Six large files always require Jay's manual upload" | Obsolete. The device bridge moves any size byte-perfectly — two `.dc.html` files over 100 KB went across untouched. |
| "Split large base64 patches across `javascript_tool` calls, `window.__src`…" | Obsolete, and it is the *corrupting* route. Four transfers, four corruptions. |
| "`design/meet-organisers` ready to merge" | **No such branch on the remote.** |
| "TEMP-TESTING-TOOLS panel needs removal before go-live" | Already gone — 0 matches in the file. |
| "Scores page shows as 'Bundled Page', metadata pending" | Done: `<title>Live Scores & Standings \| ADH JRT 2026</title>`. |
| "Auth: custom login modal via **Netlify Identity REST API**" | No Netlify Identity anywhere. It is bcrypt + accounts in Netlify Blobs (`netlify/functions/_auth.js`). |
| "`[skip netlify]` suppresses deploys" | Unverified. **`[skip ci]` is the one this project has actually used** (`b6025ea`). |

Confirmed still true: Microsoft Graph email via `registrations@adhjrt.com`
(`graph.microsoft.com/v1.0/users/…/sendMail`), the stale-read warnings, the second
Netlify project doubling credits, and the deferred Results-nav change — line 213 is still
`href="#results"`.

---

```markdown
## Purpose & context

Jay (Jason Muir, GitHub `jayjmuir-hub`) is the volunteer organiser of the Abu Dhabi
Harlequins Junior Rugby Tournament — 7–8 November 2026, Zayed Sports City. Non-technical;
Claude is the technical builder across sessions. Public marketing site, live
scores/standings, organiser back office, match-day app. One repo, four URLs.

**Jay works from two separate PCs.** Confirm which one before assuming any path. Folder
access is granted per session and must be asked for again each time.

The Junior Manager (name and personal email redacted) has editor access to
the registration sheets.

Brand: black `#0C0C0E`, red `#E11B22`, green `#17A34A`, white. Anton (display), Barlow
(body), from the Akuma kit.

Plain language, and label every step with its platform — "In GitHub: …", "In Netlify: …",
"In Google Sheets: …".

## Before answering anything about current state

**Read `claude/state-of-play.md` and run `git log`.** Do not answer from memory — this
memory has been wrong about shipped features more than once, because work lands from the
other PC between sessions. `CLAUDE.md` in a fresh clone is the canonical technical
reference.

## Writing to the repo

`SendUserFile` → `device_commit_files` → git on the PC via Desktop Commander. Verify by
comparing `git write-tree` on the PC to the sandbox's `git rev-parse HEAD^{tree}`. Full
method in `claude/writing-to-github-from-claude.md` — read it before the first write.

**Do not use:** the local `github:` MCP (removed, token gone, and it stored a live token
in plain text), the account-level GitHub connector for writes (403s), or
`raw.githubusercontent.com` for reads (stale commits). Base64 chunking is the fallback
only — it corrupted on four attempts out of four.

## Deploys cost money

Pushing to `main` deploys and spends **15 Netlify credits** (3,000/month) regardless of
size. Branches are free; a **PR** gives a free password-protected preview. Show the diff
and get a yes before merging to `main`. `[skip ci]` on docs-only commits makes them free.

Watch for a second Netlify project silently connected to the same repo — one was, and it
doubled credit consumption.

## Architecture

Netlify Pro from `jayjmuir-hub/adhjrt` (public) → `adhjrt.com`. **No build step** —
`netlify.toml` rewrites URLs straight to `.dc.html` files. Anything in the repo **root**
is served publicly, so `git add -u`, never `git add -A`.

Netlify Blobs for tournament data and accounts; Netlify Functions; Microsoft Graph for
email via shared mailbox `registrations@adhjrt.com` (Entra app "ADH JRT Website", client
secret expires ~July 2028); Google Sheets for registrations.

Auth is bcrypt with accounts in Netlify Blobs (`netlify/functions/_auth.js`) — not Netlify
Identity.

The whole site is **password-protected at the Netlify level** until Jay removes it.

## Tests

In the repo under `tests/`, so they travel with a clone and both PCs get the same suite.

**Every new assertion must be proven against a deliberately injected fault before it is
trusted.** This has caught several tests that passed with the code deleted.

## Sensitive data

The registration sheets hold children's names, dates of birth, medical notes and parent
contact details. Never widen access to `/organizer`. Never log registration values or
paste sheet contents into a commit, an issue, or any public file.

## Known traps

- The Chrome MCP can go fully unresponsive, every call timing out at ~4 minutes. Two
  consecutive timeouts with no output = stop retrying and hand the file to Jay.
- A single timeout on a write is not proof it failed. Verify with `git ls-remote` or
  `git fetch` before concluding anything — a lost response is not a failed write.
- `admin.microsoft.com` is blocked; use `entra.microsoft.com` and
  `admin.cloud.microsoft/exchange`.

## Open, verified 27 July

- The **team registration form does not validate player ages at all** — no client check,
  no server check. An over-age player can be entered into a contact age grade. Design and
  build order in `claude/specs/spec-registration-window.md`.
- Homepage Results nav (`Quins JRT.dc.html` line 213) is still `href="#results"`. Change
  it to `/scores` once a real draw replaces the placeholder teams.
```
