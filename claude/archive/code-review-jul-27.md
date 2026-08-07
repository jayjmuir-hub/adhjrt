# Code review — the three commits of 26 July (`6a16a8e..f5f1221`)

> **Status 27 July:** the test fixes and issue #3 are **DONE** — see "What was fixed"
> at the foot of this file. Issues #4 and the minors are still open and want a batched
> push with a preview.

_Reviewed 27 July 2026 by an independent reviewer subagent, given the diff and the
requirements but not this session's history. It ran the suite itself and injected its
own faults rather than trusting reported results._

**Verdict: no revert. Follow up in the next batched push.** All three commits do what
they claim, the DC binding contract is intact, and the mobile fix is provably not
regressed — measured at 390px, the hero box is identical before and after.

## What it confirmed

- `statPitches` is properly reachable from `renderVals()`; `validate-bindings.js` and
  `validate-html.js` both clean.
- **`loadVenue()` genuinely cannot reject** — `tryFetchJson` swallows both the network
  error and the parse error, so the "never blank" claim holds.
- **The `setGroupDay` no-pitch fast path is safe** — both paths call the same `move`
  closure and `editVenue` re-reads state inside `setState`, so the result is identical.
- **Removing `max-width` cannot regress the phone** — measured at 390/1440/2560/3840,
  the `<h1>` box is identical before and after, and horizontal overflow is 0 at 390px.
- All 14 top-level children of the wrapper are capped or full-bleed by design.
- `window.confirm` as a throwing trap in the panel tests was called a good decision.

## Important — five things to fix

**1. `test-layout.js` — the footer check is vacuous.** `home.slice(home.indexOf('<footer'))`
runs to end of file, then greps for any `max-width`. The reviewer deleted the footer's
real cap and the test still passed — it matched a `max-width:340px` three levels down.
Bound at `</footer>` and reuse the tag walk.

**2. `test-layout.js` — `#organisers` is vacuous for the same reason.** It is the last
section, so `indexOf('<section id="', …)` returns −1 and the block runs to end of file.
Its cap was deleted and the test passed, rescued by the footer's cap. The other nine
sections all failed correctly under the same injection, so the walk itself works — the
bug is the boundary. Slice to `</section>`.

**3. `loadVenue()` now gates the fixtures panel.** `loadFixtureData()` used to be
import → `getAgeGroups()` → render. It is now import → **await loadVenue()** →
`getAgeGroups()`. `tryFetchJson` has no timeout and no AbortSignal, so a `/venue-layout`
request that *hangs* rather than fails leaves the whole Schedule section on its
placeholder for as long as the browser's own fetch timeout. It gates nothing here —
the fallback 18 is already correct. Move it off the critical path and fire it after the
fixtures render.

**4. The hero shard cluster is stranded on wide monitors.** The shards live in a
`position:absolute;inset:0` layer anchored with `right:60px…340px`. That layer used to
be bounded by the 1200px wrapper; it now spans the viewport while the headline stays in
its centred column. Measured left edge at 3840px: **2090 before, 3410 after**, with the
headline ending at 2374 — about 1000px of empty photo between them. Cosmetic, and the
scrim contrast actually improved, but it is a visible regression on the public hero
caused by the width commit, and nothing tests it. Put the shard layer in its own
`max-width:1200px;margin:0 auto;position:relative` box.

**5. The pitch-count behaviour is untested.** All four new assertions in `test-venue.js`
are source-greps. Two injections that would completely defeat the requirement both pass
all 92 checks: deleting `pitchCount` from the `setState` (stat frozen at 18 forever, a
back-office change never reaches the homepage — the whole point of the commit), and
changing `day1` to `day2` (homepage advertises Sunday's 10). `test-venue-panel.js`
already shows the pattern for driving the real component; use it.

## Minor — fold into the same push

6. No `if (api.loadVenue)` guard on the homepage; the Scores page has one. An offline
   visitor on a stale cached module gets a `TypeError` and a dead fixtures panel.
7. `|| this.state.pitchCount` swallows a legitimate zero — a day with no pitches is a
   warning, not an error, so an organiser can save one and the homepage would say 18.
8. `submitModal()` fires `onConfirm()` unawaited and uncaught. Unreachable today
   (`tryFetchJson` never rejects) but `Promise.resolve(...).catch(() => {})` is free.
   **Also: the comment claims closing before calling matters, and the reviewer swapped
   the two lines and all 93 checks still passed** — the harness's `setState` is
   synchronous, so that assertion does not test the ordering it claims to.
9. `doLogout()` doesn't clear `modal`; a leftover dialog would render over the login form.
10. **The port is partial** — `doResetPassword` still uses `window.prompt` + two
    `window.alert`s on the same page, and native dialogs are silently blocked in the
    sandboxed preview iframe. The test stubs `prompt`/`alert` as no-ops rather than
    traps, so nothing flags it.
11. The hero's content-column `<div>` is never closed (305 opens / 304 closes).
    Pre-existing, harmless, but it is the element carrying the cap the new architecture
    depends on.
12. No Escape or backdrop dismiss on the modal — but nothing was dropped in the port;
    the Scores page's confirm dialogs have no Escape path either. Both lack
    `role="dialog"`, `aria-modal` and a focus trap. Shared gap, not a regression.

## The lesson, for the third time

Two of the twelve layout assertions passed with the real code deleted, and the
pitch-count behaviour has four assertions and zero coverage. Both are the same failure
as the two already recorded on this branch: a test written by the same author as the
fix, checking the shape of the code rather than its result.

The habit that keeps catching it is injected faults — but only where they are actually
run. The section walk was fault-tested and works; the footer check and the tail section
were not, and both are hollow. **Fault-inject every assertion, not the ones that feel
risky.**


---

## What was fixed — 27 July, no deploy spent

**Issues 1, 2, 5 and 3 are closed. Nothing was deployed** — `main` is still `f5f1221`.
The test work is in `adhjrt-sim`; the one code change is on the branch
`fix/venue-off-critical-path` (`8137108`), pushed but not merged.

**The two hollow layout assertions (#1, #2).** `capsOwnContent()` now bounds every
block at its real closing tag — `</section>`, `</footer>`, `</header>` — instead of
running to end of file, and the header is walked the same way rather than grepped. The
tag regex also handles self-closing tags so the depth counter cannot drift.

Proven properly this time: a script removes the real cap from **each of the twelve
capped elements in turn** — all ten sections, the footer and the header — and reruns.
Every one is now caught, and each fails exactly its own assertion. The three original
wrapper faults (max-width back, min-width back, `overflow:hidden` dropped) are still
caught. That is **fifteen** distinct injected faults, all caught.

**The untested pitch-count behaviour (#5).** `test-venue.js` gains a section that lifts
the homepage component, stubs `DCLogic` and the data layer, and drives `loadFixtureData()`
for real. The only rewrite to the lifted source is the dynamic `import()`, and the test
**asserts that expression matches exactly once** — if it is ever reshaped, the test fails
loudly rather than quietly testing nothing. The stub venue has **7** day-one pitches and
**3** on day two, so "still on the fallback 18" and "read the wrong day" are both visible.

The four faults the reviewer used to defeat the old greps are now all caught: the
`setState` dropped, `day1` → `day2`, the fallback changed to 16, and the venue fetch
throwing into the method.

**The venue fetch on the critical path (#3) — and the test found it.** The new
assertion *"a dead venue endpoint must not take the fixtures panel down with it"*
**failed against the shipped code**, which is the point. `loadFixtureData()` now renders
the fixtures first and fetches the layout afterwards, in a `try/catch`, behind an
`api.loadVenue ?` guard (#6), with `typeof n === 'number'` instead of truthiness so a
legitimate zero is not swallowed (#7).

**The lying ordering assertion (#8, half).** `test-venue-panel.js` checked
`state.modal === null` *after* the action ran, which both orders satisfy. It now records
the modal state **from inside** the action, and swapping the two lines in `submitModal()`
fails it.

Suite: **555 checks**, `runall.ps1` exits 0, tree hash on Jay's PC matched the sandbox.

### Still open

- **#4, the stranded hero shards at ≥2560px** — a judgement call about the hero, wants
  a preview.
- Minors **#8 (the unawaited `onConfirm`), #9, #10, #11, #12** — all small, none worth
  15 credits alone.
