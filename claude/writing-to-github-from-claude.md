# Writing to GitHub from Claude — the working method

_Settled 27 July 2026 after four wrong routes; bundle method added 2 Aug 2026.
Generic: drop into any project._

## The method

**Files move through the device bridge. Git runs on the PC. A hash proves it.**

1. Build and test in Claude's sandbox — iteration there is free. Commit there too.
2. `SendUserFile` → `device_commit_files` writes the file to the PC's disk.
   **The content never passes through the model, so nothing can corrupt it.** Any size,
   binary included.
3. Run `git add <paths>` / `commit -F <file>` / `push` **on the PC** through Desktop
   Commander. That is where the credentials are. Never `git add -A` — a stray file gets
   committed, and if the host serves the repo root, published.
4. Prove it: `git write-tree` on the PC must equal the sandbox's
   `git rev-parse HEAD^{tree}`. A tree hash covers every byte of every file. Same parent
   plus same tree means identical content, with no sampling and no trust.

Writing LF into a repo with `core.autocrlf=true` warns `LF will be replaced by CRLF`.
**Ignore it** — git normalises to LF in the index, so the commit is identical either way.

## The bundle method — for whole branches and multi-commit transfers (2 Aug 2026)

For anything bigger than a file or two, skip the per-file transfer and the
tree-hash dance entirely — **ship the commits themselves**:

1. In the sandbox: `git bundle create x.bundle origin/dev..mybranch`
   (one file, any number of commits, binaries included).
2. `SendUserFile` → `device_commit_files` the bundle to a scratch folder
   inside the connected folder (e.g. `claude\_scratch\`).
3. On the PC: `git bundle verify claude\_scratch\x.bundle` then
   `git fetch claude\_scratch\x.bundle mybranch:mybranch` and push.

The commits arrive with **identical SHAs** — content identity is
cryptographic, nothing to compare by hand, and the whole history transfers
in one file. Proven on an 11-commit branch, a 3-commit branch and a
single docs commit. Delete the bundle from the scratch folder afterwards.

## Working across two PCs

Folder access is granted **per session**, and the paths differ per machine. A new session
on either PC must ask again. Confirm which machine you are on before assuming a path.

**Fetch before you touch anything.** The clone on the PC you are sitting at may be behind
the other one. A session that commits onto a stale base either gets rejected on push or,
worse, quietly rebuilds work that already exists.

```
git fetch origin --prune
git rev-parse HEAD origin/main       # equal? then you are current
git status --porcelain               # empty? then nothing half-done is waiting
```

**Anything outside the repo does not travel.** Test folders, scratch scripts, notes — if
it is not committed, the other PC does not have it, and the two copies drift silently.
Either keep such a folder in the repo (in a subdirectory, never the root if the root is
served), or accept that it lives on one machine and say which in the project docs.

⚠️ **Commit or stash BEFORE switching branches in the sandbox.** A checkout
with dirty files carries them to the new branch, and a reflexive
`git reset --hard origin/x` there erases them — hit for real on 2 Aug 2026.

## Do not use

| Route | Why not |
|---|---|
| Account-level GitHub connector | OAuth, **403s on every write** to a public repo. Reading only. Fails after all the work is done. |
| Local GitHub MCP with a token | Works, but parks a **live write token in a plain-text config file**. Removed deliberately. Never print that file. |
| `raw.githubusercontent.com` | **Serves stale commits** with no signal. You reason confidently about code that is gone. Use `git clone`. |
| Base64-chunked patch transfer | **Corrupted on four attempts out of four** — about one character per 10 KB. Fallback only. |

`git` in the sandbox is read-only but is the *reliable* reader. If a branch tip looks
wrong: `git fetch origin '+refs/heads/*:refs/remotes/origin/*' --force`, or check the
truth with `git ls-remote origin`.

## If you must use base64 (no folder granted)

Verify a SHA-256 **before** applying. Bake per-chunk hashes into the decode script so one
run names the bad chunk. For multiple files, `tar | gzip | base64` — bytes are preserved
and one hash covers the lot.

A *dropped* character makes every later chunk report bad. Splice the correct 100-character
window back in; the damaged one will be 99, so replacing it restores alignment. Resending
from that point does not work.

## PowerShell traps — all hit for real

- **`Write-Output` inside a function becomes part of its return value.** This wrote
  progress messages into line 1 of an HTML file, ahead of `<!DOCTYPE html>`. Caught only
  because the diffstat was 14/3 instead of 13/2. Use `Write-Host`.
- **`git commit -m` with a multi-line quoted message silently does not commit** — the
  message is shredded into pathspecs — and the push then creates an *empty branch*. Use
  `commit -F <file>`.
- **`$var`, `$_` and escaped quotes in a `-Command` string are mangled** over the
  bridge. Write a `.ps1`, run `-File` with `-ExecutionPolicy Bypass`.
- **`[IO.File]::` ignores `Set-Location`** — relative paths land in `C:\Windows\System32`.
  Pass absolute paths.
- **`git diff | Out-String` mangles UTF-8** — em-dashes become mojibake and byte
  comparisons fail for no reason. Redirect via `cmd /c "... > file"`.
- **`git push` writes to stderr on success.** PowerShell shows a red `NativeCommandError`.
  Read the output: `abc123..def456  main -> main` means it worked.

## Why the other routes failed

All four failed the same way: **something transcribed the content.** The connector
re-encoded it, base64 flipped characters in it, find-and-replace re-derived it from
anchors that did not quite match.

The routes that work — file transfer and bundle transfer — are the ones where nothing
reads the bytes and writes them again.

**When a transfer keeps corrupting, stop improving the error correction and find a path
that needs none.**
