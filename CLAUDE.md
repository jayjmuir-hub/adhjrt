# ADH JRT — rules for Claude

Website for the Abu Dhabi Harlequins Junior Rugby Tournament: marketing site, live
scores app (`/app`), organiser and club-manager back offices. HTML and `.dc.html`
served from the repo root by Netlify; Functions in `netlify/functions/`, storage in
Blobs, staff sign-in via the Quins Club Hub. No build, no dependencies, no CI.

This file is rules only; `tests/test-doc-claims.js` fails if it passes 160 lines.
Backstory is a card in `claude/decisions/`, procedures are in `claude/runbooks/`,
behaviour is in `RESTORE.md`. The maintainer is a volunteer, not a developer:
plain language, and every step labelled with its platform.

**The tournament dates live in one place:** `DEFAULT_VENUE` in
`netlify/functions/_venue.js`, mirrored in `scores-data.js` (`test-venue-splits.js`
compares them); countdown, day headings and manager publish window derive from it.
Edited by hand: the homepage JSON-LD dates (pinned by `test-homepage-dates.js`), the
format-section day tags, page-description prose. No saved setting overrides them.

## Reading order

1. **This file.**
2. **Confirm the clone is current.** `hostname`, then `git fetch origin`, then
   `git rev-list --left-right --count origin/<branch>...HEAD` must print `0 0`.
   If not, stop and say so. A clone that is behind looks exactly like one that is fine.
3. **`RESTORE.md`**: behaviour, present tense ("Shipped, don't rebuild" first).
4. **`claude/decisions/`**: the relevant card, before re-opening a settled question.

Precedence when they disagree: the code, then `RESTORE.md`, then this file.

| Open when the task is theirs | For |
|---|---|
| `claude/runbooks/` | Merge `dev` to `main`, free previews, git bundles, new-PC set-up, verify a `netlify.toml` rule, registrations restore/delete, clearing rehearsal data |
| `claude/decisions/` | One card per settled question, arguments against included |
| `README.md`, `CONTRIBUTING.md`, `tests/README.md` | What is where; clone, test, branch, PR; the suite and its fault prover |

| Task | Read only |
|---|---|
| Homepage / marketing | `Quins JRT.dc.html` |
| Scores, standings, brackets, fixture editor | `Scores & Standings.dc.html`, `scores-data.js` |
| Organiser back office | `Organizer.dc.html`, `organizer-data.js` |
| Club-manager dashboard (`/manager`) | `Manager.dc.html`, `scores-data.js` |
| Match-day app | `app.html` (+ `scores-data.js` if data or permissions change) |
| Backend | the one file in `netlify/functions/`, `_auth.js`, and `_scoring.js` / `_publish.js` / `_teams.js` / `_results.js` if involved |
| Never, unless provably broken inside them | `support.js`, `local-backend.js`, vendored `qr.js` (plumbing, never edited) |

## The tracker

**Linear**, team **ADH JRT Team**, tickets `JRT-<n>`. It holds what is open; this
repo holds only what is true. A finding, follow-up or plan goes in a ticket, never
in a new markdown file. When the maintainer gives a job a date, that is an answer.

## The rules

1. **Never `git add -A`.** This repo's root IS the deployed website. Stage
   explicit paths; delete scratch harnesses before committing; check
   `git status --porcelain --untracked-files=all` for files you created. Never
   commit `package.json` changes you did not intend.
2. **Never put a secret in a tool call, a URL, a commit or a message.** Use a
   dummy value to test plumbing and a SHA-256 fingerprint to compare a real one.
   If one is disclosed — including by the maintainer pasting it — say so and ask
   them to rotate it. Never print `claude_desktop_config.json`.
3. **Never push to `main` without an explicit yes.** It costs 15 credits, and a
   stop hook asking is not the maintainer asking. **Never push to silence a
   hook** — fetch, compare against `origin/`, and say plainly if it was a false alarm.
4. **Never answer from memory about current state.** `git fetch origin` first,
   and compare with `git rev-list --left-right --count origin/<branch>...HEAD`.
   The maintainer works from two PCs and work lands between sessions.
5. **Read the RESPONSE, not the screenshot.** Every refusal renders in the same
   red box; "same error" can be visually true and factually wrong.
6. **Prove every new assertion against an injected fault**, and verify live
   after deploying. A green suite is not a working site. ⚠️ **If a fault can no
   longer be injected, its anchor has rotted — repoint it, never delete it.** A
   fault that cannot be injected is a failed run, not a pass.
7. **Fixtures must DISCRIMINATE.** A test that would pass against the very bug
   it exists to catch is worse than no test, because it reports confidence.
8. **Pair every negative search with a control.** An empty result is not proof
   of absence. Before trusting a "not found", search the same way for something
   you KNOW is present. Search with `-F`, one term at a time — alternation
   silently under-matches through the bridge.
9. **Anything bigger than a tweak gets a spec before it gets code.** Record the
   reasoning, **including the arguments AGAINST what was built**, because
   somebody will make them again.
10. **When something is removed, leave a tombstone** saying what was there and
    why it went. A deletion with no trace is an invitation to re-add it.
11. **This repo is PUBLIC.** Nothing personal goes in it — no child's name, no
    date of birth, no medical note, no parent contact, no third party's name or
    email, no production account username. If real data turns up in a fixture or
    a doc, **say so and stop. Do not sanitise it quietly.**

## Testing habits (each one has cost a false pass)

- A new test file joins `tests/runall.ps1` and the prover's `NEEDED` list in the same
  commit, as does any file a test reads; the prover's clean-suite count must go UP.
- When code under test gains a call or parameter, every stub gains it in the same
  commit. A test file that throws kills every later check; its faults read as caught.
- A fault proof sees the NAMED check fail, not the file throw. Commit before injecting:
  `git checkout -- <file>` reverts to the last commit, not to before your edit.
- Pair "it calls X" with a check that moves the input and watches the output move
  (`filter(() => sat)` passes every source-reading check). Stubs refuse like the server.
- Anchor checks on text only the live code has; strip comments first (tombstones
  quote old code). A sweep's scope is as load-bearing as its predicate: enumerate
  the targets and write the count in. Never widen a shared page list for one page.
- A large deletion needs tests driving what REMAINS (an unterminated comment once
  disabled four methods while `node --check` passed). Trust the runner's own summary
  and exit code, not an invented grep. Date-window checks take `now` as a parameter.
- Before trusting a render, prove the page booted and force the state (signed in,
  modal open): an empty shell screenshots like a result. A 404 needs a baseline from
  BEFORE the change, a 200 control and three probes; write the verb beside the status.
- Measure a cost, limit or severity before arguing from it; retiring a claim, grep the repo.

## Code rules

- Never log a registration field value; field names only. Never commit an env var's
  value. Sheet/CSV text is written as data (`RAW`): a leading `=` is injection.
- Every permission filter runs server-side, on the save and download path too. A
  hidden button, a client-side check or unrendered code closes no door.
- An endpoint acts on the account in the verified token, never one in the body; an
  outside identity matches on its subject id (`hubSub`), never on email or name.
- Every `resolveSession` refusal goes through `sessionRefusal()`; the client signs
  out only on `sessionEnded`, never on a status code, a 503 or a network failure.
- The password floor applies where a password is set, never where one is checked.
  Never make a secret-bearing endpoint "consistent" with a public one.
- A rule in browser and server is one shared block or a copy with a drift test. A
  page's new `api.*` is re-exported from `organizer-data.js` in the same commit.
  Derive age-group lists from the venue layout; never type one beside a day.
- Nothing from registration goes into a draw; uploads go to Blobs, never the repo.
  Functions require only `netlify/functions/` and Node built-ins. `.dc.html` stays
  text-only, with no camelCase local before `=` in script (`encodeCase()` breaks it).

## Working here

- **Clones:** jay-pc `C:\Users\jayjm\GitHub\adhjrt`, cafnet `C:\Users\Jay\GitHub\adhjrt`.
  Measure a machine fact on that machine; never copy one across. (On cafnet a global
  `~/.claude/CLAUDE.md` loads `~/GitHub/claude-rules/rules.md`; the rules above still bind.)
- **The root is the served site.** `force = true` 404 rules in `netlify.toml` keep
  folders private and must target `/404.html` (a self-pointing rule is silently
  dropped). The toml proves nothing: `runbook-verify-netlify-toml-rule.md`.
- **Writes are real git on a PC;** a cloud sandbox cannot push. Move commits as a bundle
  (`runbook-git-bundle-between-pcs.md`), never re-emitted through the model. Bundle
  sandbox-only work before tidying; name a sandbox branch after its remote branch.
- **Branches:** work on `dev`; feature branches come off `dev`. `main` holds PR merge
  commits; a land from `dev` is `--ff-only` (`runbook-merge-dev-to-main.md`); fast-forward
  `dev` after every land. `Compare` was retired on 11 Sep 2026 (its decision card). Do
  not raise the parked, local-only `club-manager-page` branch.
- **GitHub:** the dead GitHub MCP token is intended; ignore those tools. The account
  connector is read-only; `gh auth status` before relying on `gh`. `raw.githubusercontent.com`
  serves stale copies. Site-password state: the Netlify MCP, never a file.
- **Shell:** `git commit -F <file>`, never multi-line `-m`; git reports success on stderr.
  Bridged PowerShell loses `$`: ship a pure-ASCII `.ps1`. Two failed bridge retries: stop.
- An approval is not a landing: record it, the commands and the suite result first.
  Cosmetic work gets an approved mockup before any deploy. Never create accounts.

## Money

Every production deploy costs 15 Netlify credits, whatever its size: batch on `dev`
and land once. Branch deploys and deploy previews are genuinely free — 0 credits, not "cheap".
Warn before a cosmetic change's third deploy.
`[skip ci]` goes only on a docs-only commit pushed straight to `main` alone, never on
`dev` (it survives a fast-forward and silences the production build);
Netlify reads the whole message. Verify by the deploy id moving, or not moving.
