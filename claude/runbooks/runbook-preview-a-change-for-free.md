# Preview a change for free

Shows a change on a live URL before it goes anywhere near production,
without spending any Netlify credit. Netlify hands out three different kinds
of URL for the same site and it is easy to grab the wrong one.

## When to use

- Before asking the maintainer to approve a merge to `main`.
- Any time you want to see a change rendered rather than just reading the
  diff.

## Before you start

- Know that only `dev` is in this project's branch-deploy allow-list. Any
  other branch needs a pull request to get a preview URL at all. (`Compare`
  was on the list too, until it was retired on 11 Sep 2026: see
  `claude/decisions/2026-07-27-work-batches-on-a-branch-and-lands-once.md`.)
- Know the site's Netlify subdomain is **`adhquins-jrt`** — not any other
  name a stale doc might have used.

## Steps

1. **In PowerShell:** push your change to `dev`. A branch push is a build,
   and branch builds are free.

   ```
   git push origin dev
   ```

2. **In a browser:** open the stable branch URL. It never changes, so it is
   the one worth bookmarking:

   - `https://dev--adhquins-jrt.netlify.app`

3. **To review one specific pull request instead** (rarely needed day to
   day — prefer the stable branch URL above): open a PR from `dev`,

   ```
   gh pr create --base main --head dev
   ```

   which builds a deploy-preview URL shaped
   `deploy-preview-<N>--adhquins-jrt.netlify.app`. This URL is tied to that
   one PR and changes with every new PR number — it is for reviewing that
   specific PR, not for everyday bookmarking.

4. **To confirm a specific build exists, rather than guessing from the
   browser:** read the deploy id and status from the Netlify MCP (or the
   Deploys page) for site `8bb8cade-864f-416d-a4b8-eadda5f1997e`, instead of
   inferring existence from an HTTP status code — see "If it fails" below
   for why a status code alone is not reliable here.

## How to verify

- The branch URL loads and shows the change you just pushed, not an older
  one — check the actual content, not just that something 200'd.
- The Netlify MCP shows a deploy for this branch in state `ready` with the
  commit SHA you expect.

## If it fails

- **The branch URL 404s:** either the deploy hasn't finished yet (wait and
  reload), or that branch isn't in the branch-deploy allow-list. Only `dev`
  is. Anything else needs a pull request (step 3) to get any preview URL at
  all.
- **You're not sure whether "404" means the deploy doesn't exist, or "200"
  really proves it does:** don't rely on either one alone. Whether a missing
  deploy 401s or 404s, and whether an existing one 200s or 401s, depends
  entirely on the site's password setting at that moment — which has
  changed more than once on this project. Read the deploy id from the
  Netlify MCP instead; that answer doesn't flip with the password setting.
- **You bookmarked a `<deploy-id>--adhquins-jrt.netlify.app` link and it now
  shows something stale:** that link format is a permalink to one frozen
  build, not the live branch — it will never update. Use the stable
  `dev--` URL instead for anything you plan to revisit.
- **You deleted a branch and the old preview URL still loads:** a branch
  deploy outlives the git branch it was built from. Deleting the branch does
  not take the site down, and it keeps running against the same live
  environment variables and data stores as production. If a branch is
  retired, that deploy needs to be explicitly stopped or password-gated in
  Netlify, not just have its branch deleted.
