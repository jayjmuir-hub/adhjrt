# Work accumulates on a free preview branch and reaches production in one fast-forward

**Ruling.** Changes are committed to `dev` or the standing preview branch `Compare`, and fast-forwarded into `main` only on an explicit yes from the maintainer. Branch deploys are allowed for those named branches only. `Compare` is fast-forwarded to `main` after every land and is never left behind it. The skip-ci marker never goes on a branch commit, because it survives the fast-forward and suppresses the production build.

**Why.** Every production deploy costs the same whatever its size, and branch deploys cost nothing, so batching is the cheap way to ship. A branch deploy is not a copy of the site: its functions read production's environment variables and data stores. A lagging branch therefore serves old code against live data. One did, with no rate limit on manager sign-up.

**Against, and why it lost.** Deleting `Compare` as clutter, or turning branch deploys off entirely, removes the exposure. It also removes the free preview. Keeping the branch level with `main` closes the risk without that cost.

**Where in the code.** Not in code; enforced by `CLAUDE.md` (deploy rules) and the Netlify branch-deploy allow-list.
