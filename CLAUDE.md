# ADH JRT — the rules for working on this repo

Abu Dhabi Harlequins Junior Rugby Tournament. A public marketing site plus a
live scores app plus an organiser back office, for a two-day youth rugby
festival on **7–8 November 2026** at Zayed Sports City, Abu Dhabi.

Run by volunteers. The maintainer (Jay) is not a developer — explain changes in
plain language and say which system each step applies to (GitHub / Netlify /
Google). Avoid unexplained jargon.

---

## ⚠️ Precedence

**Precedence: the code wins, then `RESTORE.md`, then `claude/state-of-play.md`,
then this file.** Anything else in `claude/` is history, not instruction.

⚠️ If you are about to write a date, a count, a deploy id or a "currently" into
a durable file — it belongs in `claude/state-of-play.md` instead.

**Why this exists.** Before 7 Aug 2026 there was no tie-breaker. Two files
would disagree and a session would arbitrate by whichever it happened to read
last. The password state has now been recorded wrongly **four separate times**
in four different files, each correction landing in one of them.

---

## What is in which file

| File | Role |
|---|---|
| **`CLAUDE.md`** (this file) | **The rules.** Git route, branch rules, secret handling, verification standards, reading order, precedence. The repo travels to every session, so this is the only copy always present |
| **`RESTORE.md`** | **Durable.** How the code actually behaves, and rulings that cost real effort to discover. No dates, no counts, no "currently" |
| **`claude/state-of-play.md`** | **Volatile.** What is shipped, what is blocked, on whom, which clone is behind. Rots weekly by design |
| `claude/specs/`, `claude/plans/` | Designs and build plans — history, not instruction |
| `claude/runbooks/` | Procedures. ⚠️ Check the tombstone header before following one |
| `claude/archive/` | Superseded material |

⚠️ **A session that has this repo has everything.** As of 7 Aug 2026 the
`claude/` docs are committed here rather than living only in a Claude project.
Before that, `CLAUDE.md` pointed at fourteen `claude/*.md` paths that a clone
could not see.

---

## ⚠️ The rules that must reach you wherever you are running

**These eleven rules are duplicated on purpose.** This repo travels everywhere,
so the rules that are expensive to break are repeated here. Keep the block short
and identical wherever it appears, so drift shows up in a diff.

⚠️ **They are also the whole set.** There is no fuller version elsewhere. A
`~/GitHub/claude-rules/rules.md` was referenced here for weeks and **has never
existed on either PC**; so has a `~/.claude/CLAUDE.md`. Both pointers were dead
and are removed. Jay's account-level preferences carry how to talk to him; the
rules for the codebase are these.

1. **Never `git add -A`.** This repo's root IS the deployed website. Stage
   explicit paths; delete scratch harnesses before committing; check
   `git status --porcelain --untracked-files=all` for files you created. Never
   commit `package.json` changes you did not intend.
2. **Never put a secret in a tool call, a URL, a commit or a message.** Use a
   dummy value to test plumbing and a SHA-256 fingerprint to compare a real one.
   If one is disclosed — including by Jay pasting it — say so and tell him to
   rotate it. Never print `claude_desktop_config.json`.
3. **Never push to `main` without an explicit yes.** It costs 15 credits, and a
   stop hook asking is not Jay asking. **Never push to silence a hook** — fetch,
   compare against `origin/`, and say plainly if it was a false alarm.
4. **Never answer from memory about current state.** `git fetch origin` first,
   and compare with `git rev-list --left-right --count origin/<branch>...HEAD`.
   Jay works from two PCs and work lands between sessions.
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

---

## What is specific to THIS project

**A production deploy costs 15 credits**, whatever its size. `[skip ci]` on a
docs-only commit costs nothing — verify by the deploy id not moving.
⚠️ **Branch deploys and deploy previews are FREE — 0 credits.** Netlify's
credit plans do not meter build minutes. This file claimed the opposite for
months and sent a session looking at branch builds for a credit overspend,
which is the one place it could never be.

**The repo root IS the deployed site.** There is no build step — `netlify.toml`
rewrites URLs straight onto the `.dc.html` source files. Anything committed to
the root is published, including scratch scripts. This is why rule 1 is rule 1.
`_commitmsg.txt` was committed by a `git add -A` on 27 Jul 2026 and served at
`adhjrt.com/_commitmsg.txt`.

**Folders that must never be served** are excluded by a `force = true` 404
rewrite in `netlify.toml`, not by a publish directory (there isn't one):
`/tests/*`, `/tools/*` and `/claude/*`. ⚠️ **A redirect pointing at itself is
silently DROPPED by Netlify** — the target must be `/404.html`. The `tests/`
rule pointed at itself for months while the comment above it claimed otherwise.
**Reading the toml proves nothing. Fetch the URL on a deploy.**

**Standing instructions, so they are not buried:**

- ⚠️ **The dead GitHub MCP token is the INTENDED state — do not "fix" it.** It
  was removed deliberately on 25 Jul 2026 because it parked a live write token
  in a plain-text config file. `Bad credentials` is correct. Ignore those tools.
- Do not raise the `club-manager-page` branch — parked at Jay's request.
- Do not raise the registration-window decision.
- Do not raise the DOCUMENTS feature — specced 5 Aug 2026, parked the same day.

---

## ⚠️ Facts this file is NOT allowed to answer

Each of these has been written down wrongly at least once, and each has a live
source that takes one call to read. **Read the source, not this file.**

| Question | Where the answer actually is |
|---|---|
| Is the site password on? For production or previews? | Netlify MCP → `get-project` → `projectAccessControls`. ⚠️ **This has flipped FOUR times.** On 7 Aug it was recorded here as ON for non-production and was measured OFF the same day |
| Does a branch URL 401 or 404 when the deploy exists? | Depends entirely on the answer above. Read the deploy id from the Netlify MCP instead of inferring existence from a status code |
| What is merged / deployed / done? | `git fetch origin` then `claude/state-of-play.md` — in that order |
| How many test files, how many faults? | `powershell tests/runall.ps1` and read its own output. Three documents have carried three different numbers |
| Which clone is current? | `git rev-list --left-right --count origin/main...HEAD`. It must print `0	0`. Comparing a docs folder does NOT answer this |

---

## What to read for which task (context scoping)

A session has a limited reading budget. Read only what the task needs — do NOT
read files "just to understand the code." Map:

- Homepage / marketing → `Quins JRT.dc.html` only.
- Live scores, standings, brackets, fixture editor → `Scores & Standings.dc.html`
  and `scores-data.js`.
- Organiser back office → `Organizer.dc.html` and `organizer-data.js`.
- Match-day app → `app.html` (add `scores-data.js` only if the change touches
  data or permissions).
- A backend change → the one file in `netlify/functions/` plus `_auth.js` (and
  `_scoring.js` / `_publish.js` / `_teams.js` / `_results.js` only if that area
  is involved).
- A scores/fixtures change → also check **"Shipped, don't rebuild"** below
  first, so you don't redo something that already exists.

**Do NOT read these unless something is provably broken inside them** — they are
framework/runtime plumbing, never edited, and together larger than the rest of
the repo combined: `deck-stage.js`, `support.js`, `image-slot.js`,
`doc-page.js`, `local-backend.js`.

---

## How Claude writes to GitHub (rewritten 25 Jul 2026)

**How to write to GitHub from a cloud session:**
`claude/writing-to-github-from-claude.md` — the bundle method, the
tree-hash proof, and the four routes that corrupt bytes. The sandbox can
read `origin` but never write to it (a push returns 403).

**The only write path: real `git` on Jay's PC, driven through the desktop
bridge.** There is no MCP-server fallback — see the tombstone in §2 below. Never
use the account-level "GitHub Integration" connector either — that one is
OAuth/read-only and 403s on every write, because Anthropic's GitHub app can't
write to a PUBLIC repo by design. It is only good for reading.

### 1. Local git via Desktop Commander (this is how writes happen)

Jay's PC (`jay-pc`) has a clone at `C:\Users\jayjm\GitHub\adhjrt`, remote
`origin` over HTTPS, credential helper = Git Credential Manager with the
credential already cached.

**A second machine, `cafnet`, was set up the same way on 27 Jul 2026** — clone
at `C:\Users\Jay\GitHub\adhjrt` (note the different username: `Jay`, not
`jayjm`). Check which device a session is bridged to before assuming a path.
`cafnet` does **not** have the `adhjrt-sim` test suite — see the Tests note
below. A **cloud** session can drive it: the Desktop
Commander MCP extension exposes a real shell on his machine as
`mcp__remote-devices__Desktop_Commander__start_process`. This does NOT require a
Cowork task started "On your computer" (verified from a cloud session,
25 Jul 2026 — pushed and deleted a test branch).

Why git: it moves bytes on disk and over the git protocol, so file content never
passes through the model's context window. That means **any file size, and
binary files (images) included** — the two things a text-through-context
transfer could never do.

Typical run:

```
cmd /c "cd /d C:\Users\jayjm\GitHub\adhjrt && set GIT_TERMINAL_PROMPT=0 && git checkout dev && git pull"

# then, staging EXPLICIT PATHS — never -A, never `.`:
git add CLAUDE.md RESTORE.md netlify/functions/_intake.js
git status --porcelain --untracked-files=all   # must show nothing untracked
git commit -F _commitmsg.txt                   # -F, not -m: see the traps below
git push origin dev
```

- Always `set GIT_TERMINAL_PROMPT=0` — a missing credential then fails fast
  instead of hanging the session on an invisible prompt.
- Edit files on his machine with Desktop Commander `edit_block` (surgical, cheap)
  or `write_file`, or the `mcp__remote-devices__Filesystem__*` tools. Prefer
  `edit_block` over retyping a whole file.
- Verify with `git log`/`git ls-remote`, not `raw.githubusercontent.com`.

### 2. The removed GitHub MCP server — do not re-add or use it

A local GitHub MCP server (tools `mcp__remote-devices__github__*`) once sat here
as a write fallback. It was **removed on 25 Jul 2026**: git covers every case,
and the server meant a live `repo`-scoped write token sitting in
`claude_desktop_config.json`, which is exactly what we didn't want. Its tools may
still surface in a session's deferred-tool list — **ignore them. They will fail
(the token is gone and the server entry is deleted) and must not be reinstated.**
Standing rule regardless: never print `claude_desktop_config.json`, never ask Jay
for a raw token, never accept one pasted into chat.

### 3. Setting up a new PC

Everything here is per-machine. On a new personal PC, in order:

1. Install **Git for Windows** (git-scm.com, defaults — includes Git Credential
   Manager).
2. Install the **Claude desktop app**, sign in.
3. In the app: **Settings → Extensions** → install **Desktop Commander** (and
   **Filesystem** if direct file editing is wanted; grant it the `GitHub`
   folder). These are app extensions, not hand-written config.
4. In the app: **Settings** → give the device a distinct name (this one is
   `jay-pc`) so a session can tell which machine it is bridged to.
5. **Quit the app from the system tray and reopen** — extensions and config only
   load on a real restart.
6. Clone to the same path shape so commands don't change:
   `mkdir %USERPROFILE%\GitHub` then
   `git clone https://github.com/jayjmuir-hub/adhjrt.git` inside it.
7. **Jay primes the push credential once, by hand** — Git Credential Manager
   opens a browser sign-in window that a session cannot drive. Push any throwaway
   branch, approve the window; every later push is silent.

### 4. Deploy rules — and `dev` is where work goes now

**Since 27 Jul 2026 there is a long-lived `dev` branch. Commit there, not to
`main`.** `main` is what is deployed; `dev` is where changes accumulate until
Jay says merge. The point is money: a production deploy costs **15 credits
whatever its size**, so ten changes batched into one merge cost 15 and ten
merges cost 150.

Working shape:

1. Work on `dev`. Push freely — a branch costs nothing and does not deploy.
2. **Do NOT put `[skip ci]` on `dev` commits.** It is pointless there (a branch
   does not deploy) and actively harmful: it suppresses the deploy-preview build
   too, and it survives a fast-forward, so a `[skip ci]` tip merged into `main`
   lands the code and quietly does not deploy.
3. To show Jay a change before it goes live, **open a PR from `dev`** — that
   builds a free password-protected preview at
   `deploy-preview-<N>--adhquins-jrt.netlify.app`. Note an agent
   **cannot** create the PR: there is no `gh` CLI on either machine and the
   GitHub connector is read-only. Jay has to click the green **Create pull
   request** button. `.../pull/new/<branch>` is the FORM, not a PR — never hand
   over a preview link as though one already exists.
4. When Jay says merge: `git checkout main && git merge --ff-only dev &&
   git push origin main`. Check the tip commit for `[skip ci]` first. Keep it a
   fast-forward — `main` has no merge commits and the history is linear.
5. Verify the deploy reached `ready` (Netlify site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).
6. After merging, bring `dev` back up: `git checkout dev && git merge --ff-only
   main`. Do not delete `dev`.

### 4b. Deploy rules (unchanged, and they matter)

1. Edit, then validate (`node --check` the DC script; tag balance for `sc-if` /
   `sc-for`), and run `powershell tests/runall.ps1`.
2. **Pushing to `main` deploys to production and spends 15 Netlify credits** —
   show the diff and get a yes first. A docs-only commit that has to go straight
   to `main` takes `[skip ci]` so no deploy runs; on `dev` it is never needed.
3. Branches are free. To preview one, **open a PR** — that gives a
   password-protected deploy-preview at
   `deploy-preview-<N>--adhquins-jrt.netlify.app` — but prefer the
   permanent branch URL, `https://dev--adhquins-jrt.netlify.app`.

### Three kinds of preview URL, and only one of them is stable (2 Aug 2026)

Jay: *"why do we get a different branch deploy preview link every time we do an
edit, can't we just use one branch for all edits?"* — yes, and one already
exists. Netlify hands out three different URLs and they are easy to confuse:

| URL | Changes when | Use it for |
|---|---|---|
| `<deploy-id>--adhquins-jrt.netlify.app` | **every single build** | nothing, day to day — it is an archive link to one frozen build |
| `deploy-preview-<N>--adhquins-jrt.netlify.app` | every new PR | reviewing one specific PR |
| **`dev--adhquins-jrt.netlify.app`** | **never** | **everything. Bookmark it.** It always serves the latest `dev` build. |

⚠️ **THE HOST NAME IN THIS TABLE WAS WRONG UNTIL 5 AUG 2026, AND EVERY URL IT
GAVE WAS DEAD.** It said `serene-gingersnap-1d0eb6.netlify.app` in seven
places; the project's Netlify subdomain is **`adhquins-jrt`**. Measured, not
guessed: `dev--serene-gingersnap-1d0eb6.netlify.app` answers **404** and so
does `main--…`, while `dev--adhquins-jrt.netlify.app` answers **200**. Anyone
following this file to preview a branch got a 404 and would reasonably have
concluded branch deploys were broken. The old name presumably worked once and
the site was renamed; nothing recorded it.

⚠️ **AND THE 401 TEST IS DEAD TOO.** This section used to say an existing
deploy answers **401** (the site-wide password prompt) and a missing one
**404**, so 401 meant it was there. The password is OFF — **an existing deploy
now answers 200.** Both live checks, 5 Aug 2026:
`dev--adhquins-jrt.netlify.app` → 200, `nosuchbranch--adhquins-jrt.netlify.app`
→ 404. **200 means it is there, 404 means it is not.** For anything that
matters, read the deploy id from the Netlify MCP rather than inferring
existence from a status code.

Consequence worth knowing: branch deploys are enabled **for `dev` only** as of
6 Aug 2026, so a push to `dev` triggers a build. That is what makes the stable
URL work, and it is free.

⚠️ **THIS PARAGRAPH USED TO END: "If Netlify credits ever look higher than
expected, that is the first place to look — `main` is not the only branch
building." THAT IS FALSE and was corrected on 6 Aug 2026.** A branch build
cannot move the credit number, because it does not cost any. Netlify's
credit-based plans do not meter build minutes at all:

| | credits |
|---|---|
| **Production deploy** | **15 each** |
| **Branch deploy / Deploy Preview** | **0 — free** |
| Failed deploy | 0 |
| Rolling back production | 0 |

(Compute is 10 credits per GB-hour, bandwidth 20 per GB, web requests 2 per
10,000 — so a heavily-crawled branch deploy is not literally zero, but it is
nowhere near a build.) The point of the correction is that the old sentence
sent the next person hunting in the one place that could never be the cause.
**Only a successful production deploy spends credits.**
https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/

⚠️ **AND A BRANCH DEPLOY OUTLIVES ITS BRANCH.** Deleting the git branch does
NOT take the `<branch>--adhquins-jrt.netlify.app` site down — confirmed against
Netlify's own support, and measured here: `club-manager-page` was deleted from
`origin` on 6 Aug and its site was still answering 200, with its functions
running, minutes later. **This matters more than it sounds:** functions on a
branch deploy read the SAME environment variables and the SAME Blobs stores as
production, so a stale branch site serves old code against live data. The
`club-manager-page` deploy was 68 commits behind and therefore had no
`c5df5fa`, i.e. **no rate limiting on `manager-signup`**, while production had
it — the throttle was bypassable by changing the hostname. Restricting branch
deploys to `dev` stops the NEXT one; it does not retract one already published.

⚠️ **AND DO NOT REPEAT THE MISTAKE THAT FOUND THIS.** A `404` on a branch
subdomain was read as "my delete worked" when a branch name that never existed
returns 404 too. **A 404 with no before-reading proves nothing.** Take the
baseline BEFORE the change, and probe more than once — a single `000` from a
transient connection failure reads exactly like "the site is gone".
4. Verify a live deploy reached `ready` (Netlify site id
   `8bb8cade-864f-416d-a4b8-eadda5f1997e`).

### 5. The tests — the repo suite is the suite now (counts updated 2 Aug 2026)

**`tests/` in this repo is the suite.** Plain Node, no dependencies, no
build step. `powershell tests/runall.ps1`, or `node tests/<file>` for one. Each
file finds the clone itself, so any checkout on any machine can run them.

It covers the registration path, venue and pitches, the draw editor and
score sheet (component-driven), auth and the unified login, the public
pages, sponsors, light mode, the design-audit fixes and the About-section
photo ring, the doc-claim suite, the age-group picker and the documents
shelf — **38 files** — plus `_prove-registration.js`, the fault-injection
script (**719 faults**, measured on jay-pc 7 Aug 2026, all of which must be caught by the
check that claims to guard them, and none of which may be "caught" by the suite
throwing). The counts drift upward with every feature; trust `runall.ps1`'s own
output over this sentence — it has been written down here as 17, 171, 333 and
370 while being something else, because nothing asserts a number in prose.

⚠️ **The prover's second number is the one to read.** It ends
`N/N faults caught by the named check; M suite(s) clean on an undamaged copy`.
**When you add a test file, M must go UP.** A suite that fails undamaged fails
for every fault too, so all of its faults report "caught" while proving
nothing. M was 29 before `test-about-board.js`, 30 with it, 32 by 6 Aug and
**33, measured 7 Aug 2026** with `test-documents.js`.

⚠️ **`runall.ps1` prints 39 `--- <file>` headers.** That is 38 test files
plus the prover's own header. Counted from a real run on 7 Aug 2026; this
sentence has previously said 37 and 38 and been wrong both times.
This file said 37 while there were 36 files and nobody noticed, which is the
same class of stale-number-in-prose the paragraph above warns about — trust
`runall.ps1`'s own output, never this sentence.

**A test file must not fall over on a fault.** Reaching blind into a lookup that
a fault makes `undefined` throws, kills the process, and every check after that
point silently never runs — so the fault looks caught while proving nothing about
the check that was supposed to catch it. Hence the `|| {}` fallbacks dotted
through `test-venue-splits.js` and `test-venue-map.js`: the *guarding* check
reports, and the file carries on.

**The old `C:\Users\jayjm\adhjrt-sim` folder on jay-pc (13 files, plus
`validate-bindings.js`) is now mostly historical** — triaged on 2 Aug 2026:
seven of its files are stale or test deliberately-deleted subjects (their
live coverage moved into the repo suite), and the rest overlap it. It is in
no version control. Worth pruning to the files that still mean something;
until then, treat the REPO suite as the authority and the sim folder as
optional extra signal only.

Moving them in needs a session bridged to jay-pc, and **step one is a data
check**: this repo is public, the registration sheets hold children's names,
dates of birth and medical notes, and it has not been verified file by file that
no fixture was built from a real sheet row. The rehearsal used invented players
(the giveaway is the phone number `971500000000`). **If a real row turns up in a
fixture it does not come in here — say so and stop, do not sanitise it quietly.**
Full procedure in `tests/README.md`.

`netlify.toml` has a `/tests/*` 404 rule, because no publish directory is set and
the repo root IS the deployed site. Tidiness, not security — see above.

**The habit that matters more than the count:** every new assertion is proven
against a deliberately injected fault before it is trusted. It has caught two
tests that passed with the real code deleted, a regex matching a comment instead
of the code, a section check that scanned too wide a block, and three assertions
that were simply wrong about what the code should do.

### 6. Traps

- **Merge conflicts from squash-merges.** Earlier features were squash-merged
  into `main`; a branch still carrying pre-squash commits will conflict on
  re-merge. Branch fresh off current `main` — don't reopen old feature branches
  (`design/meet-organisers` PR #4, `fix/single-pool-width` PR #5 are both done).
- **`raw.githubusercontent.com` serves stale copies for minutes** and ignores
  cache-busting params. Verify with plain `git`.
- ⚠️⚠️ **DO NOT READ THE SITE-PASSWORD STATE OUT OF THIS FILE. IT HAS NOW BEEN
  RECORDED WRONGLY FOUR TIMES.** Three earlier bullets lived here, each
  correcting the last, each stale within days. They are gone; keeping a fourth
  wrong sentence in a durable file is the bug, not the wording of it.

  **Read `projectAccessControls` from the Netlify MCP (`get-project`) at the
  moment you need the answer.** It is one call and it is never stale.

  | Recorded | Claim | Outcome |
  |---|---|---|
  | ~3 Aug 2026 | site-wide password ON, previews prompt | wrong |
  | 5 Aug 2026 | password OFF everywhere; a branch deploy answers 200 | true that day |
  | 6–7 Aug 2026 | `requiresPassword: true`, `whichProjectsRequirePassword: "non_production"` — branch URLs 401 | true that day |
  | **7 Aug 2026, measured** | **`requiresPassword: false`, `whichProjectsRequirePassword: null`** — **off everywhere, production and previews** | **the reading that retired this bullet** |

  ⚠️ **Everything downstream of it flips too.** Whether a branch URL's 401
  means "the deploy exists" or its 404 means "it does not" depends entirely on
  the current setting — the trick has been alive, dead and alive again.
  **Use the deploy id from the Netlify MCP to tell a real deploy from a
  missing one.** That answer does not flip.

  ⚠️ **Do not plan a verification that assumes previews are reachable by a
  script, or that assumes they are gated, without checking first.**
