# The `/rules` page is DATED, not pending — deferred to mid-September 2026

_Settled 7 August 2026 by Jay. Lifted out of `CLAUDE.md`'s "Outstanding" list,
because it is a ruling, not a status line._

## The decision

Jay's words: *"mark rules to be uploaded in mid September … so you stop
reminding me about it until then."*

⚠️ **DO NOT RAISE THIS BEFORE MID-SEPTEMBER 2026.** It is not blocked, not
forgotten, and does not need chasing. **A job with a date is an answer, not an
open question**, and listing it as outstanding every session is nagging Jay
about something he has already decided. A scheduled task fires on 15 Sep 2026.

## ⚠️ Nothing on the public site needs changing, and no deploy is owed

`rules.html` promises the rules *"before registration opens in October"*.
Mid-September is before October, so **that sentence is still true.**

**The argument FOR rewriting it to name September, which was made and lost.**
It was offered on 7 Aug 2026 and **declined**, for three reasons:

1. It costs a **15-credit production deploy** for a cosmetic copy change.
2. It needs a test edit and a fault repoint (see below) — so it is not a
   one-line change even though it looks like one.
3. **It converts a promise that cannot go stale into a dated one that goes
   publicly wrong if the rules slip a fortnight.** The vaguer sentence is the
   more robust sentence.

Recorded because somebody will propose it again.

## When the rules do arrive, the whole job is already scoped

- **Replace the ONE marked block in `rules.html`** — its comment reads
  `⚠️ REPLACE THIS BLOCK when the real rules arrive`. **Nothing else on that
  page moves.** The topbar, hero, footer and styling are the finished article.
- **Add the "Last updated" line** under the `h1` in the hero, in the same
  change. The markup is already in place, commented, in `rules.html`, and the
  `.updated` CSS rule can be copied from `legal.html`.
  ⚠️ **A rules page with no date is one nobody can trust mid-tournament.**
- ⚠️ **Repoint, never delete, the checks that pin the placeholder.**
  `test-about-board.js` asserts the `Coming soon` badge and the string
  `before registration opens in October`, and `_prove-registration.js` carries
  **two faults anchored on that same text**. **A fault that cannot be injected
  is a failed run, not a pass.**
- It is a docs-shaped change to one marked block, so **it should ride with
  another commit** rather than buying its own 15-credit deploy.

## ⚠️ The settled items are stated in more than one place

The four items under **"What is already settled"** on `/rules` are **also
stated elsewhere on the site**. If the real rules contradict any of them, the
contradiction is live in more than one place. **Grep before assuming the
`/rules` copy is the only one.**

## See also

`claude/parked-requests.md` item 8 — the full entry, including why this was
recorded in the docs rather than on the site.
