# Work accumulates on `dev` and reaches production in one fast-forward

**Ruling.** Changes are committed to `dev` (feature branches come off it and merge back into it) and fast-forwarded into `main` only on an explicit yes from the maintainer. Netlify builds a branch deploy for `dev` only: Branch deploys is set to "Let me add individual branches" with `dev`, and reads back as `allowed_branches ["main","dev"]`. Pull requests into `main` or `dev` get deploy previews. The skip-ci marker never goes on a branch commit, because it survives the fast-forward and suppresses the production build.

**Why.** Every production deploy costs the same whatever its size, and branch deploys cost nothing, so batching is the cheap way to ship. A branch deploy is not a copy of the site: its functions read production's environment variables and data stores. A lagging branch therefore serves old code against live data. One did, with no rate limit on manager sign-up.

**Changed 11 Sep 2026: `Compare` retired (JRT-34).** Until then this card also named a standing preview branch, `Compare`, which was fast-forwarded to `main` after every land. It was retired because `dev--` and PR deploy previews already give the same free preview. That left the reason for keeping it (below) with nothing to stand on, and a second branch to keep level was a second chance to lag. Its 48 deploys were deleted with `netlify api deleteSiteDeploy`, oldest first. Afterwards all 48 permalinks and `compare--` answered 404 where they had answered 200, with production, `dev--` and a made-up deploy id as controls.

The same day it came out that the setting this card said enforced "those named branches only" was really **"Deploy all branches pushed to the repository"**. Every pushed branch had its own live site against production data. The card described a setting nobody had read back. It is now set to `dev` only, and it is read back with `netlify api getSite`, never taken from this card.

**Against, and why it lost.**
- *Keep `Compare`* (the argument that won on 27 Jul): deleting it "removes the free preview". That argument lost on 11 Sep, because `dev--` and PR previews are that free preview, and `Compare` only duplicated them.
- *Turn branch deploys off entirely:* this removes the exposure, but it also removes the free `dev` site that every land is checked on. Still rejected.
- *Password on all non-production deploys:* this is the one measured way to close every old permalink at once. But it gates `dev--` and the previews too, and a password-gated preview cannot be checked by Claude. It is not settled here; it is open on JRT-35.

**Where in the code.** Not in code. It is enforced by `CLAUDE.md` (the deploy rules) and by the Netlify branch-deploy setting, which is read back with `netlify api getSite`.
