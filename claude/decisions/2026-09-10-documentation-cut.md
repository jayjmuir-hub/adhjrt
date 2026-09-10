# The documentation cut — rules travel, stories are findable

**Status: APPROVED 10 Sep 2026, not yet executed.** Jay: *"looks good"*, to
the plan below, after the Quins Club Hub repo went through the same cut the
same week. A second person is about to start helping on both projects, and
the docs are being prepared for someone who was not in any of the
conversations.

## Ruling

A RULE and the STORY of how it was learned are different documents. The rule
must travel with every session, in `CLAUDE.md`, under a line budget. The
story only needs to be findable, as a short decision card. Everything that is
neither — plans superseded by code, session diaries, hand-written
changelogs, status files that rot by design — is deleted, with a tombstone
README where source comments still cite the path. The curated tree is then
pushed as one commit to a fresh repository, because deleting a file does not
delete its history and history holds whatever the personal-data scan finds.

## Why

Measured 10 Sep 2026: 276,000 words of markdown against 474 commits. More
than half the words in the repo are documentation. `CLAUDE.md` is 814 lines
with 66 warning glyphs; `RESTORE.md` is 35,000 words with 182. Every session
reads `CLAUDE.md` in full, and most of it is the history of past mistakes
rather than rules. It also contradicts itself: it says a global rules file
never existed (one does, and is loaded on this PC); it says no `gh` tool is
installed (the latest `dev` commit records it working); it names three
plumbing files that are no longer in the repo. A rules file that is mostly
stories is a rules file nobody reads to the end.

## Against, and why it lost

- *"The stories are the value — they stop the same mistake happening
  twice."* They do, and they are kept: as decision cards, 80–200 words each,
  in a fixed shape. What goes is the fourth retelling of each one inside the
  rules file.
- *"Rewriting `RESTORE.md` risks losing a ruling that cost real effort."*
  It is rewritten in place, present tense, and every ruling that cannot be
  found in code gets a decision card first. Nothing is deleted before its
  card exists.
- *"`state-of-play.md` is second in the precedence order; sessions depend
  on it."* It is replaced by tracker tickets, which do not rot silently, and
  the precedence rule is rewritten to say so. A file that "rots weekly by
  design" was never a good source of truth.
- *"A fresh repo loses the history."* The old repo is renamed with an
  archive suffix and made private, never deleted. It IS the tombstone.
- *"Six hundred source comments cite paths that will be deleted."* They are
  not rewritten — too much churn for no behaviour change. Each deleted
  folder gets a README saying where the originals live.

## Replaces

`CLAUDE.md` (rules and stories mixed), `RESTORE.md` (behaviour and history
mixed), `claude/state-of-play.md`, `claude/parked-requests.md`,
`claude/changelog*.md`, `claude/handoff-*.md`, `claude/plans/`,
`claude/archive/`, `claude/writing-to-github-from-claude.md`, and the
narrative form of `claude/specs/`.

## The order it runs — scan first, deletions last

1. **Personal-data scan, its own commit, merged first.** Probes with a
   control each: email addresses by domain (clean at 10 Sep — every address
   is `@adhjrt.com` or an example domain); phone-shaped strings (six files
   hold numbers that are not obviously synthetic by pattern, every one beside
   an `example.com` address or inside a format explanation — believed
   invented, not proven); and names. The name source is the registration
   sheets, which a session must not read. **Jay runs `tools/scan-personal-
   data.js` locally** against a CSV he downloads; it prints file paths and
   counts only, never matched text. Anything found is replaced with an
   invented value checked against the same CSV first (an invented name can
   collide with a real one), silently, with no tombstone naming what was
   there. `CLAUDE.md` rule 11 stands: real data in the repo is a stop, not a
   quiet fix by a session.
2. **The split.** `CLAUDE.md` → rules only: no dates, no incidents, no
   quotes, no "currently"; budget 160 lines, enforced by
   `tests/test-doc-claims.js`. `RESTORE.md` → present-tense behaviour, same
   name (hundreds of comments cite it). `claude/specs/*` and the three
   existing decision files → decision cards: Ruling / Why / Against and why
   it lost / Replaces / Where in the code; clusters merged into one card.
   `claude/runbooks/*` → steps only: purpose, when, before you start,
   platform-labelled numbered steps, verify, if it fails.
3. **Human-facing `README.md` and `CONTRIBUTING.md`**: clone, run the
   suite, branch off `dev`, PR, where things are, the two non-negotiable
   rules — `main` is live and costs 15 credits, and no real names ever. The
   suite is the gate; there is no CI.
4. **Open items to Linear**, one ticket each, same workspace as Club Hub,
   new project for ADH JRT. One tracker, not two. `state-of-play.md` and
   `parked-requests.md` are emptied into it before deletion.
5. **Deletions**, each folder with a one-paragraph README tombstone.
6. **Fresh-repo cutover — Jay's clicks, written step by step, never run
   unattended.** Push the curated tree as ONE commit to a new repository.
   Fold in the publish-directory move (site files under one folder, functions
   outside it, most `netlify.toml` 404 rules removed). Repoint Netlify;
   recreate the `dev` and `Compare` branch-deploy allow-list; env vars live
   on the Netlify site and are untouched. Repoint both clones. Preserve the
   local-only `club-manager-page` branch as a bundle first — thirteen
   unmerged commits exist nowhere else. Rename the old repo `*-archive`,
   make it private, never delete it.

## Not done, deliberately

- No denylist of real names in any checker — it would put the names in the
  repo. Domain checks stay.
- `RESTORE.md` not renamed.
- Source comments citing deleted paths not rewritten.
- The old repo not deleted.
- The repo not made private before the fresh one exists.

## Where in the code

`tests/test-doc-claims.js` (line budget and the derived 15-credit check),
`tools/scan-personal-data.js` (the scan), `netlify.toml` (the 404 rules the
publish directory retires). The two specs written this week —
`spec-hub-auto-approve-sep-2026.md` and `spec-registration-store-sep-2026.md`
— are kept and become decision cards with the rest.
