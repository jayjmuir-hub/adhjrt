# Spec: re-point the back office at the club brand system (22 Aug 2026)

**Status: BUILT, same day — on `dev`, not merged to `main`.** Jay's answers to
the three open questions: **(1) dark chrome yes**, (2) `/signin` takes the new
look yes, (3) teal maps to the info blue yes. See "How it was actually built"
at the end — four deviations from the plan below are recorded there.

Jay asked whether the JRT back office should
line up with the new main club website and the restyled Club Hub desktop app,
so all three properties read as one family. This spec says how. **No code
changes until Jay says build.**

## The finding that shrinks this job

**The back office is already light.** `/signin`, `/manager` and `/organizer`
all sit on a warm-grey page (`#F3F2EF`), white cards, near-black ink
(`#1A1C1F`) — measured in the files, not assumed. So this is NOT a
dark-to-light inversion. It is a **re-point**: the back office wears the
club's *previous* brand values, and the club site has moved.

The proof is the red. The back office's buttons are `#E11B22` — the exact red
Club Hub's theme config records as the value the club site *abandoned* in its
redesign. Club Hub re-pointed at the new values on 6 Aug 2026
(`Quins Club Hub/tailwind.config.js` + `src/index.css`), reading them off the
live site's computed CSS, with every text/surface pairing contrast-measured.
**This spec lifts those answers rather than re-deriving them.**

## Scope

| File | Route | In? |
|---|---|---|
| `Signin.dc.html` | `/signin` | ✅ |
| `Manager.dc.html` | `/manager` | ✅ |
| `Organizer.dc.html` | `/organizer` | ✅ |
| `Quins JRT.dc.html` | `/` | ❌ public homepage — untouched, per Jay |
| `Scores & Standings.dc.html` | `/scores` | ❌ public |
| `app.html` | `/app` | ❌ match-day phone surface; do not disturb before the tournament |
| `Club.dc.html` | `/register-club` | ❌ public-facing form, dark like the homepage; it belongs to the public look |

**Also out of scope, explicitly:** any restructuring of the `.dc.html` files —
`claude/decisions/2026-08-22-dc-html-stays.md` closed that. Same files, new
values. And **no typography change**: both sides already use Anton + Barlow,
which is most of the reason the family resemblance is achievable cheaply.

## The token mapping

Old value (in the three files today) → new value (from Club Hub's light
palette, itself read off the club site):

| Role | Today | Becomes | Note |
|---|---|---|---|
| Page background | `#F3F2EF` (warm) | `#F3F3F3` (neutral) | the tint moving off warm is most of the visual match |
| Card | `#FFFFFF` | `#FFFFFF` | unchanged |
| Sunk / inset fills | `#F3F2EF` reused | `#EBEBEB` | inputs, zebra rows |
| Primary ink | `#1A1C1F` | `#101116` | |
| Muted ink | `#5A626E` | `#565C67` | measured AA on the new greys |
| Hairlines | `rgba(0,0,0,.1)` etc. | `#E5E5E5` (strong: `#D4D4D4`) | the club site separates cards with this line |
| Brand red | `#E11B22` | `#C8102E` | 5.88:1 with white text — better than the old red's 4.79:1 |
| Deep red (hover/pressed) | — | `#A30D25` | |
| Club green as text | varies | `#157F3C` | raw green `#2A9D55` is NOT AA as small text on white — fills only |
| Danger | `#B00020` | `#C2352C` (bg `#FDECEB`, ink `#A30D25`) | |
| Warn | `#F0C36D`/`#7A5C00` | `#C98A12` (bg `#FDF3E0`, ink `#8A5A12`) | |
| Info/teal buttons | `#0B7285` | `#2F5FA8` (bg `#EEF5FD`) | or keep teal — open question 3 |

⚠️ **The bright red `#FF2D4A` never appears in the back office.** It is the
club site's *dark-mode* red; white text on it fails AA (3.67:1). Club Hub
learned this the measured way. It is correct only against near-black.

## How to apply it — tokens once, then mechanical

The three files carry ~900 inline `style="…"` attributes with raw hexes
(Organizer 557, Manager 342). Replacing hex-with-hex would work but leaves the
NEXT re-point as expensive as this one. Instead:

1. **Add one `:root` token block** to each file's `<style>` (the palette above
   as CSS custom properties). The block is byte-identical in all three files.
2. **A new test asserts the three copies agree** — derived, not pinned, the
   same pattern as the two copies of the 15-credit figure in `CLAUDE.md`.
3. **Swap raw hexes to `var(--…)` mechanically** (`#E11B22` →
   `var(--brand)`, etc.). Inline styles take `var()` fine. Same edit cost as
   hex-for-hex, and the day the club site moves again, the re-point is one
   block per file.
4. ⚠️ The transformer must **skip comments** — this repo has walked into
   "prose containing a tag read as the tag" nine recorded times, and several
   comments in these files quote old hex values deliberately (tombstones).
   Strip comments from the match, never from the file.

## Test impact — plan for it, don't discover it

Suites that anchor on current back-office styling and will need re-anchoring:
`test-design-polish.js`, `test-light-mode.js`, `test-accessibility.js`,
`test-signin-page.js`, `test-manager-dc*.js`, `test-organizer-*.js`, possibly
`test-doc-claims.js`. Expect a batch of **COULD NOT INJECT** from the prover —
that is a failed run, not a pass: repoint each anchor in the same commit, per
rule 6. Budget as much time for the anchors as for the edit itself.

## Verification

- **Contrast:** Club Hub ships `scripts/contrast-check.mjs` with its own copy
  of the palette. Port the pairings this repo actually uses into a repo test,
  with the measured ratios inline.
- **Render audit at every tab**, desktop and 390px — the 8 Aug lesson: the
  audit that measured only the default tab reported success on 13 of 72 rows.
  All nine organizer tabs, all manager tabs, signed-in states included (a
  screen that only renders in one state is not tested by looking at the page).
- **Live on the free `dev` branch deploy** before any merge; production is one
  batched 15-credit deploy when Jay says go.

## Timing

Do it early or after — not close. The back office gets its heaviest use in the
run-up to 14–15 Nov. Target: **built and settled by end of September 2026**;
if it slips past mid-October, park it until after the tournament.

## Arguments AGAINST (rule 9 — somebody will make them again)

- **Nobody but ~dozens of volunteers ever sees these pages.** The payoff is
  brand coherence for insiders, not a single new registration.
- **The pages work.** The phone layouts were hard-won on 8 Aug; the
  accessibility pass on 9 Aug. A restyle re-opens verified surfaces.
- **The club site's redesign may move again** — Club Hub has already had to
  re-point once (6 Aug). Chasing a moving target. *Mitigation: the token
  block makes the next re-point one edit per file, which is exactly why step 1
  is tokens rather than hex-for-hex.*
- **The anchor-rot bill is real:** every previous styling sweep broke fault
  anchors, and each repointing is careful work.

These lost because the cost is bounded and mostly mechanical, the hard design
decisions are already made and measured in Club Hub, and Jay wants the three
properties to read as one family — which is a strategic call, not a cosmetic
one.

## Open questions for Jay before build

1. **Dark brand chrome?** Club Hub's look is a light content well under a
   near-black brand bar (`#0A0A0A`). Should the back-office headers go dark to
   match, or stay light with only the palette re-pointed? (Dark chrome is the
   more recognisable family resemblance; also more churn.)
2. **`/signin` is the shared front door** — managers *and* organizers pass
   through it, and it is linked from public pages. Confirm it takes the new
   look rather than the public look.
3. **The teal "View" buttons** (`#0B7285`) have no counterpart in the club
   palette. Map to the info blue, or keep teal as a back-office-only accent?

## How it was actually built (22 Aug 2026) — deviations from the plan above

Done as specced — token block identical in the three files, mechanical var()
swap outside comments, dark chrome, `test-backoffice-retheme.js` with prover
faults — except for four things learned by doing it:

1. **The warm yellow family stays.** The plan's table mapped the warn colours
   to Club Hub's; in the files there turned out to be a coordinated five-value
   family (`#FFF8E6`/`#E8C46A`/`#C98A05`/`#7A5300`/`#5A4A22` and friends)
   used for the username-preview boxes and warn banners. It already
   harmonises with the new neutrals, and re-pointing five interlocking values
   is risk with no brand payoff. Left literal, deliberately.
2. **The age-group chart tints stay literal hexes, and now a fault enforces
   it.** `AGE_TINT` values are alpha-suffixed in JS (`${t}30`), so a var()
   there produces `var(--x)30` — invalid CSS, a transparent chip, no error
   anywhere. The first transform did exactly this (8-digit hexes were
   invisible to the 6-digit inventory grep) and the venue-map suite caught
   it. `u6`/`u10` carry the NEW brand values as literals; the retheme test
   pins them and scans all three files for the mangle pattern.
3. **The chrome is a rounded band inside the content column, not a
   full-bleed bar.** Full-bleed needed restructuring the header out of the
   `.bo` container, which risks the hard-won phone layout for a purely
   structural difference. The band reads as chrome; the DOM did not move.
4. **`--ink` kept a four-step grey ladder** (`ink`/`ink-muted`/`ink-faint`/
   `ink-dim`) where Club Hub has three, because the files genuinely use four
   distinct slates and collapsing them changes hierarchy the plan never
   promised to change.

**Verified:** whole suite green; prover 930/930 with the clean baseline up
exactly one (the proof the new file runs undamaged); 19 pre-existing faults
quoting old colours reported COULD NOT INJECT and were repointed, never
deleted. Contrast is computed inside the test from the token block itself.
**Not yet verified: a rendered signed-in dashboard.** The render audit needs
playwright, which the build machine did not have; the dev branch deploy is
where the signed-in pages get eyes on them before any merge.
