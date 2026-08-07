# ⚠️ TOMBSTONE — THIS DOC'S CONTENT MOVED TO `CLAUDE.md`, 7 Aug 2026

> **If a plan or spec sent you here: the rules are now in `CLAUDE.md`
> § "1b. Getting BYTES into the repo" and § "5b. PowerShell and bridge traps".
> Read those, not this.** Eleven documents still point at this path, which is
> why the tombstone sits here rather than in `claude/archive/` — **a tombstone
> filed somewhere else is a dead pointer wearing a hat.**

**What was here.** A standalone doc titled *"Writing to GitHub from Claude —
the working method"*, settled 27 July 2026 after four wrong routes, with the
bundle method added 2 Aug. It carried the tree-hash proof, the bundle method,
the four routes that corrupt bytes, the base64 fallback, and a set of
PowerShell traps.

**Why it went.** It was the **third copy** of the same rules. `CLAUDE.md` had a
git-route section, `claude/state-of-play.md` had a "How to write to the repo"
section, and this file had its own. All three were partial, none was identical,
and the counts proved it: `git bundle` appeared 6 times in state-of-play, twice
here, and **not at all** in `CLAUDE.md`; `[skip ci]` 12 / 0 / 5.

**Two copies of one rule drift invisibly, and the cheapest copy to maintain is
the one that no longer exists.** These were rules about money and about pushing
to a deploy branch, which is the worst possible place for three disagreeing
versions.

**Where it went.** The write methods, the tree-hash proof and the
do-not-use table into **`CLAUDE.md` § "1b. Getting BYTES into the repo"**; the
PowerShell and bridge traps and the base64 fallback into **§ "5b. PowerShell
and bridge traps"**.

⚠️ **The first attempt DID drop the traps and the base64 fallback**, and the
tombstone briefly claimed otherwise. The line-level loss check caught it; the
bold-span version had already reported all-clear on the same deletion. **A
verification tool needs a control as much as the thing it verifies.**

## ⚠️ The argument AGAINST removing it, recorded because it will be made again

This doc described itself as *"Generic: drop into any project."* It was the only
project-NEUTRAL copy, and deleting it means the next project cannot lift it
wholesale — the `CLAUDE.md` version names `adhjrt` paths, `jay-pc`, and this
repo's scratch folder.

**That was judged the smaller cost.** A reusable doc that disagrees with the
authoritative one is not reusable, it is a trap with a second audience. If a
future project needs the generic version, **derive it from `CLAUDE.md` at that
moment** rather than keeping a parallel copy warm here.

**Full text is in git history:**
`git log --diff-filter=D -- claude/writing-to-github-from-claude.md`
