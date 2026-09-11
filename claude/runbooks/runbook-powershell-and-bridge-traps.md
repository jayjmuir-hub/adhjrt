# PowerShell and bridge traps — running commands on a PC from a session

A checklist for running PowerShell and git on a PC through the desktop bridge
(Desktop Commander). Each trap here has broken a real run. The four most
common are in `CLAUDE.md` → Working here → Shell and are not repeated here:
use `git commit -F`; git reports success on stderr; the bridge strips `$`, so
ship a `.ps1`; and stop after two failed bridge retries.

## When to use

- Before sending a PowerShell script or a sequence of git commands through the
  bridge.
- When a bridged command did something other than what it reported.

## Before you start

- Know which PC you are bridged to, and where its clone is
  (`C:\Users\<you>\GitHub\adhjrt`).
- Commit or stash before switching branches.

## Steps

1. **Write the script as a pure-ASCII `.ps1`.** PowerShell 5.1 reads a file
   that has no byte-order mark as ANSI, and a single em dash breaks parsing.
   Check before sending: `grep -n "[^ -~]" script.ps1` must print nothing.
2. **Run it with** `powershell -ExecutionPolicy Bypass -File <path>`.
3. **Set `$ErrorActionPreference = 'Continue'`** in scripts that call git, and
   check `$LASTEXITCODE` instead. With `'Stop'`, the first line git writes to
   stderr (which is how it reports success) stops the script.
4. **Inside a function, print with `Write-Host`, never `Write-Output`.**
   `Write-Output` becomes part of the function's return value, and can end up
   written into a file.
5. **Give `[IO.File]::` absolute paths.** It ignores `Set-Location` and uses
   the process folder, so relative paths land in `C:\Windows\System32`.
6. **Capture git output with a `cmd` redirect**, for example
   `cmd /c "git diff > C:\Users\<you>\GitHub\_scratch\d.txt"`. Piping it
   through `Out-String` garbles non-English characters such as em dashes.
7. **For anything longer than about a minute** (the full test suite, for
   example): a bridge call returns after about 60 seconds while the process
   keeps running. Start it with `Start-Process … -RedirectStandardOutput <log>`
   and read the log.
8. **Quote `^{tree}`:** `git rev-parse 'dev^{tree}'`. Unquoted, PowerShell
   misreads it and git fails on a base64 string.
9. **PowerShell 5.1 has no `&&`** (use `;`), no heredoc, and
   `-Encoding utf8NoBOM` throws an error. In `-like`, `?` is a wildcard for any
   one character, not a literal question mark.
10. **`git checkout -- <file>` goes back to the last commit**, not to before
    your last edit. Never follow a checkout of uncommitted work with a
    reflexive `git reset --hard`.
11. **In `cmd /c "… && …"`:** parentheses break it, and so does the space in
    `Quins JRT.dc.html`. Use a `.ps1` instead. A `grep -c` that counts 0 also
    ends an `&&` chain.
12. **If the bridge stops answering:**
    `RefreshMcpTools({"server":"remote-devices"})` re-registers its tools. A
    Cloudflare 502 is worth one retry.
13. **Moving files between machines:** use a git bundle
    (`runbook-git-bundle-between-pcs.md`). Base64 through the conversation is a
    last resort:
    - Check a SHA-256 before applying anything.
    - Give each chunk its own hash, so one run names the bad chunk.
    - For several files, use `tar | gzip | base64`, so one hash covers them
      all.
    - A **dropped** character makes every later chunk report bad. Splice the
      correct 100-character window back in; resending from that point does
      not work.

## How to verify

- After a push, `git rev-list --left-right --count origin/<branch>...HEAD`
  prints `0	0`. Read that output, not the colour it is shown in.
- A file written by a script starts with the line you expected, and the diff
  summary shows the number of changed lines you expected.

## If it fails

- **"An empty pipe element is not allowed":** the bridge stripped a `$`. Move
  the command into a `.ps1` (step 1).
- **A red `NativeCommandError` after a git command:** read the text. A line
  like `abc123..def456  dev -> dev` means it worked.
- **Two bridge retries have failed:** stop and tell the maintainer.
