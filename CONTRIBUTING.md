# Contributing

How to get this repo running, make a change, and get it onto the live site.
Written for a person; the rules the maintainer's AI sessions follow are in
`CLAUDE.md` and most of them apply to people too.

## Before anything else — two rules that are never negotiable

- **`main` is the live site.** Every push to `main` deploys to production and
  costs the maintainer real Netlify credits. Nobody pushes to `main` without
  the maintainer's explicit yes, ever — not to fix something small, not to
  silence a warning.
- **No real personal data, ever.** This repo is public. No child's name, date
  of birth, medical note, parent contact, or any third party's name or email
  — in code, tests, fixtures or docs. If you find real data already in the
  repo, say so and stop. Do not quietly remove or replace it yourself.

## Set up

1. In GitHub: clone the repository.
   ```bash
   git clone https://github.com/jayjmuir-hub/adhjrt.git
   ```
2. There is nothing to install and nothing to build. The repo root IS the
   deployed site — `.dc.html` and `.html` files are served directly, with
   `netlify.toml` doing the URL rewriting. Open any file in a browser or run
   a local static server if you want to look at it; there is no dev server
   command.

## Run the tests

Plain Node, no dependencies. In PowerShell, from the repo root:

```
powershell tests/runall.ps1
```

or run one file at a time:

```
node tests/test-registration.js
```

**There is no CI.** This local suite is the gate — nothing runs automatically
on a push or a pull request, so run it yourself before you ask for a merge.

## Branches and deploys

- Work on **`dev`**. Push freely — a branch deploy is free (0 Netlify
  credits) and always previews at `https://dev--adhquins-jrt.netlify.app`.
- **`main` is production.** A push there deploys and costs credits — see the
  rule above. Only the maintainer merges `dev` into `main`, and only after
  saying yes to the change.
- To show the maintainer a change before it goes live, open a pull request
  from `dev`:
  ```bash
  gh pr create --base main --head dev
  ```
  That builds a free, separate deploy preview for review. It does not touch
  production, and it does not merge anything by itself.
- Batch changes into one `dev` push where you can. Ten small changes merged
  one at a time cost ten production deploys; batched, they cost one.

## Making a change

1. Check what to work on in **Linear**, team "ADH JRT Team", tickets
   `JRT-<n>`. Open work lives there, not in a markdown file in this repo.
2. In PowerShell, before you start: fetch and confirm your clone is current.
   ```bash
   git fetch origin
   git rev-list --left-right --count origin/dev...HEAD
   ```
   Both numbers should be `0`. If not, pull or rebase before you branch —
   work lands here from more than one machine.
3. Make your change.
4. **Stage explicit paths — never `git add -A` and never `git add .`.** The
   repo root is the deployed site, so a stray scratch file staged by accident
   gets published. Check `git status --porcelain --untracked-files=all`
   before you commit and make sure nothing surprises you.
5. Every new behaviour needs a test that would fail without it, proven
   against a fault you inject on purpose: break the code, watch the test go
   red, then fix it and watch the test go green. A test that would pass
   against the very bug it is meant to catch is worse than no test — it
   reports confidence that isn't there. `tests/_prove-registration.js` is
   the model for this: it damages the code on purpose, file by file, and
   checks that the right test — and only the right test — catches it.
6. Run the suite (above) before you push.
7. Commit with a message that says what changed and why, and push to `dev`.

## Where things are

| Path | What |
|---|---|
| `netlify/functions/` | The backend: Netlify Functions, storage in Netlify Blobs, mail through Microsoft Graph, staff sign-in through the Quins Club Hub |
| `tests/` | The suite. `tests/README.md` has more detail; `_prove-registration.js` is the fault-injection script |
| `RESTORE.md` | How the code behaves, present tense. Read it before touching anything in `netlify/functions/` |
| `claude/decisions/` | Why settled questions were settled — one short card each, including the arguments against. Read the relevant one before re-opening an old argument |
| `claude/runbooks/` | Step-by-step procedures for things done occasionally rather than every change |
| `CLAUDE.md` | The full rule set, including the git and deploy mechanics in more depth than this file covers |

## Asking for help

Open a pull request early and say what you are unsure about — a
half-finished branch with a question attached is easier to help with than a
finished one built on a wrong assumption.
