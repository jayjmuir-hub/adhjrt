# Merge `dev` to `main` and verify the deploy

Puts everything accumulated on `dev` live on the production site in one
deploy, and confirms the deploy actually took effect rather than trusting the
dashboard's tip label. A push to `main` triggers a production build every
time, whatever its size.

## When to use

- Whenever there is a batch of finished, tested work on `dev` that is ready
  to go live, and the person who owns the site has said yes to deploying it.
- Not for a single docs-only change that needs no build — that can go
  straight to `main` with a skip-build marker instead (see "If it fails"
  below for the trap in doing that on `dev`).

## Before you start

- **A push to `main` deploys to production and costs 15 Netlify credits,
  whatever the size of the change.** Get an explicit yes from the maintainer
  before pushing — showing the diff first, not just naming the change.
- The suite must be green on `dev` first: **In PowerShell**, from the repo
  folder, `powershell tests/runall.ps1`.
- Know the Netlify site id for this project: `8bb8cade-864f-416d-a4b8-eadda5f1997e`.
- The merge must be a fast-forward. If `main` has moved in a way that makes
  it not fast-forward, stop and re-sync `dev` first rather than forcing a
  merge commit — this repo's history on `main` is meant to stay linear.

## Steps

1. **In PowerShell:** fetch and confirm both branches are what you think they
   are.

   ```
   git fetch origin
   git rev-list --left-right --count origin/dev...origin/main
   ```

2. **In PowerShell:** check the tip commit of `dev` does not carry a
   skip-build marker — a marker there would silently suppress the production
   build once it lands on `main`.

   ```
   git log -1 --format=%B origin/dev
   ```

   If the message contains `[skip ci]`, stop. That commit must not become
   `main`'s tip — see "If it fails" below.

3. **In PowerShell, on the PC holding the real clone (not the sandbox — a
   push from there returns 403):**

   ```
   git checkout main
   git pull
   git merge --ff-only dev
   ```

   `--ff-only` is deliberate: if this refuses, `main` has commits `dev`
   doesn't, and merging normally would create a merge commit — stop and ask
   rather than forcing one.

4. **In PowerShell:** push, now that the maintainer has said yes.

   ```
   git push origin main
   ```

   `git push` writes its success line to stderr — a red-looking
   `NativeCommandError` in some bridges is not a failure. Read the payload
   (`abc123..def456  main -> main`), not the colour.

5. **In Netlify (MCP `get-project` / `list-deploys`, or the Deploys page in
   the dashboard):** watch the deploy for site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e` reach state `ready`, and note its
   deploy id and the git commit SHA it recorded.

6. **In PowerShell:** compare that SHA against what was actually pushed.

   ```
   git rev-parse main
   ```

   The two must match exactly.

7. **In PowerShell:** bring `dev` back level with `main`, in the same
   sitting.

   ```
   git checkout dev
   git merge --ff-only main
   git push origin dev
   ```

   (Until 11 Sep 2026 this step also fast-forwarded `Compare`. That branch
   was retired: see `claude/decisions/2026-07-27-work-batches-on-a-branch-and-lands-once.md`.)

## How to verify

- The Netlify deploy for site `8bb8cade-864f-416d-a4b8-eadda5f1997e` shows
  state `ready` and its commit SHA equals `git rev-parse main` from step 6.
- `git rev-list --count origin/dev..origin/main` prints `0`.
- The live site (`adhjrt.com`) reflects the change that was merged — check
  the actual page, not just the deploy dashboard.

## If it fails

- **The deploy never reaches `ready`, or reaches `error`:** read the deploy
  log in Netlify for the actual build error before touching git again — do
  not re-push to "try again". The MCP cannot redeploy an existing commit;
  fixing a failed build needs a new commit or **Deploys → Trigger deploy** in
  the Netlify UI.
- **The deploy is `ready` but Netlify shows an older commit as the tip:**
  check the commit that became `main`'s tip for `[skip ci]` — if it carries
  one, Netlify skipped the build entirely and `main` is now merged but
  undeployed. Fix with **Deploys → Trigger deploy** in the Netlify UI on the
  correct commit; do not push an empty commit to work around it.
- **`git merge --ff-only` refuses on `dev`, `main`, or the final
  sync step:** the target branch has commits the source doesn't. Do not
  force a merge commit — fetch again, look at what diverged, and resolve it
  deliberately (usually re-running this same runbook once more from a clean
  fetch) rather than guessing.
- **The pushed SHA and the deployed SHA in step 6 don't match:** the deploy
  you're looking at in Netlify is not the one you just pushed — re-check you
  read the right site id and the right (most recent) deploy, not a cached or
  branch deploy.
