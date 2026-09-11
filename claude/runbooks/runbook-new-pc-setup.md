# Set up a new PC for this repo

Gets a new personal machine to the point where a Claude session on it can
read the repo and — once one push credential is primed by hand — write to it
through real git. Every step here is per-machine; none of it is stored in
the repo itself.

## When to use

- A new PC is being added as a place to work on this project (a second
  machine for the current maintainer, or a machine for a person newly
  joining the project).

## Before you start

- Administrator rights on the machine, to install software.
- A GitHub account with access to this repository.
- About 20 minutes, most of it waiting on installers.

## Steps

1. **On the PC:** install Git for Windows from git-scm.com, accepting the
   defaults. This includes Git Credential Manager, which is what makes step
   7 below work without ever typing a token anywhere.
2. **On the PC:** install the Claude desktop app and sign in.
3. **In the Claude desktop app:** go to **Settings → Extensions** and install
   **Desktop Commander** (it gives a session a real shell on this machine).
   Also install **Filesystem** if direct file editing from a session is
   wanted, and grant it the `GitHub` folder when it asks.
4. **In the Claude desktop app:** under **Settings**, give this device a
   distinct name from any other machine already used for this project — a
   session needs to be able to tell which machine it is bridged to.
5. **On the PC:** quit the Claude app from the system tray (not just closing
   the window) and reopen it. Extensions and settings changes only take
   effect after a real restart.
6. **In PowerShell, on the PC:** clone the repo to the same path shape used
   on other machines, so commands don't need to change between machines.

   ```
   mkdir %USERPROFILE%\GitHub
   cd %USERPROFILE%\GitHub
   git clone https://github.com/jayjmuir-hub/adhjrt.git
   ```

7. **On the PC, by hand — this step cannot be done by a session:** push a
   throwaway branch once, to prime the push credential.

   ```
   git checkout -b setup-test
   git commit --allow-empty -m "setup test"
   git push origin setup-test
   ```

   Git Credential Manager opens a browser sign-in window the first time it
   needs to authenticate a push. Approve it there. Every later push from
   this machine is then silent — no further sign-in prompts.
8. **In PowerShell, on the PC:** delete the throwaway branch, locally and on
   the remote.

   ```
   git checkout main
   git branch -D setup-test
   git push origin --delete setup-test
   ```

## How to verify

- `git status` in the clone reports it is a normal working copy on `main`
  with nothing pending.
- A second push from this machine — a real one, when there is a real change
  to make — completes with no browser prompt at all.
- A Claude session started from this machine can read the repo through
  Desktop Commander (e.g. list the clone's folder) without any extra
  permission step.

## If it fails

- **The browser sign-in window in step 7 doesn't appear, or the push hangs:**
  check Git Credential Manager is actually installed (it ships with the Git
  for Windows defaults in step 1 — a custom/minimal install can skip it).
  Re-run `git push` after confirming.
- **Extensions don't show up as installed after step 5:** the app was closed
  from the window's X button rather than the system tray, which is not a
  full restart. Quit fully from the tray icon and reopen.
- **A session reports it doesn't know which machine it's bridged to:** the
  device name from step 4 wasn't set, or wasn't distinct from another
  machine's name. Set a distinct name and restart the app again.
- **`git clone` fails with a permission or authentication error:** the
  GitHub account being used to clone doesn't have access to this
  (currently private-during-setup or otherwise restricted) repository — get
  access added on GitHub first.
