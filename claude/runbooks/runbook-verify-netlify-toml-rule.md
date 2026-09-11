# Verify a `netlify.toml` rule on a deploy

Proves that a redirect rule in `netlify.toml` — most often one of the `404`
rules that keep a folder like `tests/`, `tools/`, or `claude/` from being
served as part of the public site — actually took effect on a real deploy,
rather than trusting that the config file says what you think it says.

## When to use

- After adding or changing any rule in `netlify.toml`, before treating it as
  working.
- Whenever a claim about what a rule does needs checking — reading the file
  is not enough; a redirect that points at itself is silently dropped by
  Netlify rather than applied, with no warning anywhere.

## Before you start

- Do this on a **branch deploy** (`dev` or `Compare`), never by pushing
  straight to `main` to test a redirect — a branch deploy is free, a
  production deploy costs 15 credits.
- Pick an **unruled sibling path** before you start — a file that is not
  covered by any redirect rule and that you already know returns 200 (for
  example `/robots.txt`, or the site root `/`). You need this as a control;
  without it, a 404 proves nothing at all.

## Steps

1. **In a browser or via a URL fetch, on the CURRENT production site,
   before your change ships:** request the path the rule is meant to block,
   for example `/tests/runall.ps1`, and record what it returns right now.
   This is your **before** reading — take it before the change goes anywhere,
   not after.
2. **In PowerShell:** push the branch carrying the `netlify.toml` change to
   `dev` or `Compare`.
3. **Wait for the branch deploy to finish** — check its status in the
   Netlify MCP or the Deploys page for site
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`.
4. **In a browser or via a URL fetch, against the branch deploy URL**
   (`https://dev--adhquins-jrt.netlify.app` or
   `https://compare--adhquins-jrt.netlify.app`): request the same path from
   step 1.
5. **On the same branch deploy, in the same moment:** request the unruled
   sibling path you picked in "Before you start".
6. **On the same branch deploy:** request one more control, a path that
   simply doesn't exist at all (e.g. `/no-such-xyz`), to know what "genuinely
   absent" looks like on this deploy.

## How to verify

The rule is proven working only when **all three** of these hold at once,
on the same deploy:

| Request | Expected |
|---|---|
| The ruled path (step 4) | `404` |
| The unruled sibling (step 5) | `200` |
| The nonexistent control path (step 6) | `404` |

A `404` on the ruled path alone proves nothing — a file that was never
served in the first place also 404s. It is the `200` on the sibling, in the
same deploy, that shows the difference is the rule and not something else
(a missing file, a bad path, the wrong deploy).

## If it fails

- **The ruled path returns `200` instead of `404`:** the rule did not apply.
  Check the `to =` target is a *different* path than the `from =` — a
  redirect pointing at itself (`from = "/tests/*"`, `to = "/tests/:splat"`)
  is silently dropped by Netlify. The working pattern in this repo is always
  `to = "/404.html"` with `force = true`.
- **The unruled sibling also returns `404`:** something else is wrong with
  this deploy or path (a genuinely missing file, or a typo in the path you
  requested) — this is not a rule problem, but it means your control is bad
  and the earlier 404 on the ruled path is not proven by anything. Pick a
  different, definitely-present sibling and redo steps 4–6.
- **Everything on the branch deploy answers `401` instead of `200`/`404`:**
  the site-wide password may be on for non-production deploys at the
  moment. This flips independently of anything in `netlify.toml` — read the
  current setting from the Netlify MCP (`get-project` →
  `projectAccessControls`) rather than assuming, and re-test once you know
  whether `401` here means "gated" or something else.
- **You only have the "before" reading from `main`, not from this branch,
  and can't tell whether the branch ever served the file un-ruled:** that's
  fine — the three-way comparison in step 4–6, all on the same deploy, is
  what proves it either way; the production "before" reading is just extra
  confidence, not required for the proof.
