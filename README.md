# ADH JRT

The website for the Abu Dhabi Harlequins Junior Rugby Tournament: a public
marketing site, a live scores app, and an organiser back office, for a
two-day youth rugby festival on **7–8 November 2026** at Zayed Sports City,
Abu Dhabi.

## What is here

There is no build step. The repo root IS the deployed website —
`netlify.toml` rewrites clean URLs straight onto the source files below, and
anything committed at the root is published. A handful of folders
(`tests/`, `tools/`, `claude/`) are blocked from being served by 404 rules in
`netlify.toml`, not by a publish directory — there isn't one.

| Path | What |
|---|---|
| `Quins JRT.dc.html` | The homepage, served at `/` |
| `Scores & Standings.dc.html` | Live scores and standings, at `/scores` |
| `app.html` | The match-day app, at `/app` |
| `Manager.dc.html` | The club manager back office, at `/manager` |
| `Organizer.dc.html` | The organiser back office, at `/organizer` |
| `Signin.dc.html` | The unified sign-in page, at `/signin` |
| `rules.html` | The tournament rules, at `/rules` |
| `legal.html` | The legal page, at `/legal` |
| `Club.dc.html` | The club registration form, at `/register-club` (deliberately unlisted — see `netlify.toml`) |
| `netlify/functions/` | The backend: Netlify Functions, storage in Netlify Blobs, mail through Microsoft Graph, staff sign-in through the Quins Club Hub |
| `tests/` | The test suite — plain Node, no dependencies, no CI. See below |

## Build and deploy

No build, no npm scripts. `git push` to a branch triggers a free Netlify
branch deploy; a push to `main` deploys to production and costs Netlify
credits, so it only happens with the maintainer's yes. Full detail —
branches, credits, previews — is in `CONTRIBUTING.md`.

## Tests

Plain Node, no dependencies, no CI. The local suite is the gate:

```
powershell tests/runall.ps1
```

or one file at a time:

```
node tests/<file>.js
```

## Where to go next

- **`CONTRIBUTING.md`** — set-up, workflow, branches, pull requests, and the
  two rules that are never negotiable.
- **`CLAUDE.md`** — the rules a session (human or AI) follows in this repo.
- **`RESTORE.md`** — how the code actually behaves, present tense.
- **`claude/decisions/`** — why settled questions were settled, one card
  each, including the arguments against.
- **Linear**, team "ADH JRT Team" — open work and tickets. Not markdown
  files.
