# Retire a branch deploy — close an old `<branch>--adhquins-jrt.netlify.app`

A branch deploy runs its own old code against production's environment
variables and Blobs stores. Deleting the git branch does not take it down.
Taking the branch off Netlify's list of branches to build does not either.
This runbook closes one and proves it is closed. Behaviour: the Netlify facts
in `RESTORE.md`.

## When to use

- A branch deploy other than `dev` or `Compare` is still answering.
- Before deleting a branch that has ever been deployed.

## Before you start

- **Keep the work.** If the branch has unmerged commits, bundle its full
  history first (`runbook-git-bundle-between-pcs.md`) and keep the bundle
  outside the repo.
- Pick your probes now: the branch root and one function on it (for example
  `/.netlify/functions/manager-signup`). You also need three controls:
  production (`https://adhjrt.com`), a branch name that has never existed
  (`https://nosuchbranch--adhquins-jrt.netlify.app`), and `dev--`.

## Steps

1. **In PowerShell, before changing anything:** probe the branch root and its
   function **three times each**, and record the answers. This is the
   baseline. Without it a later 404 proves nothing, because a branch that
   never existed also answers 404.
2. **In Netlify** (the maintainer): make sure branch deploys are limited to
   the branches that should build (`dev`, `Compare`). This stops **future**
   builds only. It does not take down anything already published.
3. **In Netlify** (the maintainer): close the published deploy. The method
   that has been measured to work is password protection scoped to
   **non-production** deploys, set in the UI. The password never goes into a
   chat or a tool call.
   ⚠️ This gates `dev--` and `compare--` too.
   ⚠️ Not yet worked out: deleting the branch's individual deploys instead has
   never been done on this project, and its UI path and effect are not
   recorded.
4. **In Netlify → Deploys, filtered to the branch:** list every deploy id for
   it. The Netlify MCP has had no operation that lists deploys, so the ids
   come from this page. Reading them out of the page with JavaScript in a
   driven browser works.
5. **In PowerShell:** probe **every** deploy permalink
   (`https://<deploy-id>--adhquins-jrt.netlify.app` and its function), not
   only the newest. As controls, probe the production deploy's permalink and a
   made-up deploy id.
6. **In PowerShell:** probe production's pages and functions, to be sure the
   change did not reach production.
7. **In GitHub:** only now, delete the branch if it still exists.

## How to verify

The same kind of URL must give three different answers:

| Probe | Expected |
|---|---|
| every branch permalink, and the branch root | refused (401 if password-gated) |
| the production permalink, and `https://adhjrt.com` | 200 |
| a made-up deploy id or branch name | 404 |

If everything gives the same answer, the check proves nothing.

## If it fails

- **A probe returns `000`:** the connection failed, which is not a reading.
  Probe again.
- **Production now asks for a password:** the scope in step 3 is wrong, and
  the public site is down. Fix it at once.
- **An old permalink still answers 200:** step 5 found a deploy the password
  does not cover. Record which one, and decide with the maintainer before
  deleting anything.
