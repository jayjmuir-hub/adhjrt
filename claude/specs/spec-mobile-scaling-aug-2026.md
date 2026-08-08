# Spec — phone scaling on the home page (8 August 2026)

**Scope:** `Quins JRT.dc.html` only. The home page is what a club committee
member opened on a phone, and it is the only page in this change.

**Why now.** Jay, 8 Aug 2026: *"still going to work on scaling when someone
looks at the main site on a mobile phone, i realize that isn't optimal but
people will do it and one of the club committee members already did it"* —
followed by three specific complaints and, separately, a fourth requirement:

1. *"the register team and player buttons should be beside each other not
   vertically stacked"*
2. *"the counting stats bar should remain one horizontal bar not stack
   vertically"*
3. *"i don't like the way the sponsors don't scale smaller and all stack
   vertically"*
4. *"we need a way to keep the HSBC on the screen when scrolling, it should
   always be visible somehow"*

⚠️ **The page was NOT broken in the way this kind of report usually means.**
Measured before any change, at 360 / 390 / 430px: `document.scrollWidth` equals
the viewport width at all three and **no element's box crosses the right edge**.
There is no horizontal overflow and no pinch-to-zoom fault. Every one of the
four items is a layout choice that reads badly on a phone, not a bug. Writing
that down because the obvious first diagnosis — "the page overflows" — was
checked, was wrong, and would have sent the whole change in the wrong
direction.

---

## How this was measured

No phone was involved and none was needed. The clone was served statically and
driven headless at three viewport widths — 360 (small Android), 390 (iPhone
12/13/14), 430 (Pro Max) — with `isMobile`, touch, and a phone user-agent.

⚠️ **Two harness faults produced confident, wrong readings before any real
measurement happened, and both are worth knowing about.**

- **The page did not boot at all** on the first pass and every section measured
  empty. It loads React, ReactDOM and Babel from `unpkg.com`, and the sandbox
  could not reach them. Everything downstream — "no overflow", "the sections
  are blank" — was measuring an unrendered document. The fix was to vendor the
  three scripts and the Google Fonts CSS locally and serve them by request
  interception, so the page boots with no network at all.
- **The fonts silently failed after that**, and the headline rendered in a
  serif fallback — which changes every text metric on the page. The cause was
  ordering: the rewritten `@font-face` URLs are path-relative to the
  stylesheet, so they resolve under `fonts.googleapis.com` and were being
  answered with the stylesheet itself. `document.fonts` reported `error`; the
  screenshot just looked slightly off. **The instrument to trust here is
  `document.fonts.ready` plus the per-face status, not the picture.**

⚠️ **And one measurement that was simply believed and should not have been.**
A candidate stylesheet injected with `addStyleTag` reported the CTA buttons at
92px wide; the same CSS in the file gives 143px. The injected run scrolled the
page afterwards, and this page re-renders on a timer (the countdown), so a
class added from the console does not necessarily survive. **Prototype numbers
from injection were discarded. Every number below is measured against the
committed file.**

---

## 1. The two Register buttons — side by side

**What was wrong.** Nothing stacked them on purpose. The hero CTA row is
`display:flex; flex-wrap:wrap`, and the two buttons measure **221px and 224px
with a 16px gap = 461px** against **296px** of row at 360px. They wrapped at
every phone width including 430px. The wrap rule was added deliberately in
August when the HSBC lockup joined the row as a third item — it was doing its
job.

**What changed.** In `@media(max-width:800px)`:

- `.hero-cta > div{flex:1 1 0; min-width:0}` — the wrappers are `inline-block`
  in the markup and so sized by content until told otherwise;
- `.hero-cta .reg-btn{width:100%}` — what actually consumes the width;
- `font-size:18px → 14px`, `padding:16px 34px → 16px 4px`;
- gap `16px → 10px`;
- the "Coming Soon" plate `122px → 94px` and the pill down with it.

⚠️ **All of it or none of it.** `flex:1 1 0` alone leaves a 221px button hanging
out of a 143px wrapper. The font and padding alone give two narrow buttons that
still stack.

**Result:** 143 / 158 / 178px per button at 360 / 390 / 430, **51px tall** — over
the 44px touch-target floor at every width.

**Argument against, recorded.** 14px is small for a primary call to action, and
"REGISTER A TEAM" at 14px in a 143px box has almost no air. The alternative was
keeping them stacked and full-width, which is what most sites do and what the
page already did. Jay asked for side by side explicitly, having seen the
stacked version. If it reads as cramped in the wild, the honest fix is shorter
labels ("Register team" / "Register player"), not more width — there is none.

**Breakpoint note.** These rules live in the **800px** block, not the 760px one,
on purpose: `.hero-cta > div` also matches `.hero-partner`, and that is safe
only because `.hero-partner` is `display:none` from 800px down. The rule and
the condition that makes it safe share one media query so they cannot drift.

## 2. The stats bar — one row of four

**What was wrong.** `.m-stack-2` collapsed the four counters to 2×2 below 760px.
That was a deliberate earlier choice ("two abreast so the four still read as a
set rather than a long list") and Jay disagrees with it.

**What changed.** `grid-template-columns:repeat(4,1fr)`, section padding
`20px → 10px`, cell padding `34px 20px → 22px 3px`, the value
`clamp(30px,4.6vw,54px) → clamp(22px,7.2vw,34px)`, the label `13px/1px
letter-spacing → 10px/0.3px`. The two `nth-child` border rules that drew the
2×2 dividers are deleted — in one row of four, `odd` leaves the divider off
cells 2 and 4, and `-n+2` draws a horizontal line under a bar with no second
row.

**The arithmetic, because it is tight.** At 360px: 360 − 20 = 340, ÷ 4 = **85px
per cell**, less 6px of padding = **79px of content**. `3000+` in Anton at the
old 30px floor measures ~78px and `AGE GROUPS` at 13px/1px measures ~90px — the
label alone would have wrapped or spilled. At 7.2vw / 10px, every label fits on
one line at 360, verified in a screenshot.

⚠️ **Nothing asserts that it still fits if a value gets longer.** A five-digit
player count, or `1000s`, needs re-measuring. There is no test for this because
the values come from live data and a test would have to guess them.

**Argument against, recorded.** The original 2×2 comment was right that four
85px columns is a lot of information in a narrow band, and the label type is
now 10px, which is small. The counters are decorative — the page does not
depend on anyone reading them — and Jay wants the bar to read as a bar.

**⚠️ The class is now misnamed.** `.m-stack-2` no longer stacks into 2. Kept
because the name is written into the markup and renaming it is a bigger diff
than this change earns.

## 3. The supporters grid — two across, three on larger phones

**What was wrong, and the old comment was the giveaway.** A
`@media(max-width:640px){.spon-tile{max-width:none}}` rule existed with the
reasoning *"on a phone there is only ever one tile per row, so that cap would
leave a narrow card floating in the middle of a 390px screen"*. That was true
and it was the bug: lifting the 260px cap made each of the 18 tiles a
full-width **296px** card, so the block ran **18 rows** and every supporter's
mark rendered **larger on a phone than on a desktop**.

⚠️ **The cap was never what put one tile per row.** The inline `flex:1 1 190px`
was: two tiles at a 190px basis want 394px against 296px of row, so the second
wrapped. Overriding `max-width` could not have changed that, which is why the
old rule read as though it had fixed something.

**What changed.** The basis now comes down with the screen:

- `≤760px`: `flex:1 1 calc(33.333% - 10px)`, `min-height:104px → 74px`,
  tile padding `16px 22px → 10px`, section padding `32px → 16px`
- `≤399px`: `flex:1 1 calc(50% - 7px)`

⚠️ The gap **must** be subtracted from the 33.333% or three tiles want 100% plus
two gaps and the third wraps — the exact fault this rule fixes.

**Result:** 18 rows → **9 rows** at 360/390 (157 / 172px tiles), **6 rows** at
430 (123px tiles). The whole page is **1,545px shorter** at 360px.

**Two across below 400px rather than three everywhere — Jay's call.** Three
across at 360 gives 91px tiles, and the wider wordmarks (Broadway Malyan is
11.5:1) come out around 6px tall: present, not readable.

**The per-logo `max-height` is untouched, deliberately.** Each mark carries its
own `s.h` in the data, tuned to normalise optical *area* — a flat CSS
`max-height` on all of them would undo that, which is the exact fault
`spec-sponsors-grid.md` documents. In a narrower tile the wide marks become
width-limited by `max-width:100%` and the near-square ones stay height-limited,
which preserves the intent without touching the data.

## 4. HSBC on screen at all times — a fixed bottom strip

**Requirement.** The mark must be visible however far down the page you are.

**Why not the sticky header, which is where it lives on a desktop.** Measured at
360px: the crest + wordmark block is **249px**, the hamburger **46px**, the
row's padding **32px** — leaving about **17px**. `.hdr-partner` is hidden below
900px for exactly that reason, and it was hidden *because it did not fit*, not
because nobody wanted it. Putting it back means shrinking the wordmark, the
strap and the crest to buy ~50px and then rendering a principal partner's mark
at 14px tall.

**Options put to Jay, 8 Aug 2026, and his choice.**

| | |
|---|---|
| **Fixed bottom strip** | **Chosen.** 34px bar, mark at 18px (~67px wide), always on screen. |
| Squeeze into the header | Fits, but the header is cramped and the mark is 14px. |
| Floating corner pill | Least intrusive; hovers over the reading content and reads as an ad. |

**What was built.** `.partner-strip` — `position:fixed; bottom:0; z-index:40`,
34px tall, `rgba(12,12,14,0.96)` with a blur, a 2px red→green signature line,
the eyebrow, and the reverse HSBC lockup at 18px. `display:none` by default.

⚠️ **Three things that are easy to get wrong and are each asserted in the
suite.**

1. **The 900px breakpoint is the same number in two places** — one hides
   `.hdr-partner`, one shows `.partner-strip`. Move one and not the other and
   there is a band of widths with two HSBC marks on screen, or none. A count of
   the images passes either way; only the paired assertion catches it.
2. **The strip is fixed, so the page pays for it.** `body{padding-bottom:38px}`
   in the same media query. Without it the last band of the footer sits behind
   the strip permanently — and it is **invisible to anyone reviewing on a
   desktop**, where the strip does not exist at all.
3. **It is not a link**, for the same reason the header mark is not: a fixed
   element follows a visitor down the whole page, so a tap target on it can
   take a parent out of the registration form from any scroll position. The one
   clickable HSBC mark is the 96px one in `#sponsors`, which is not sticky.

Below 380px the eyebrow is dropped and the mark stands alone — at that width
the two together want more than the bar has, and the mark is the point.

**Verified:** strip present at the top of the page and at the very bottom;
`footer.bottom` 806, `strip.top` 810 — **0px of the footer covered** at 360, 390
and 430.

**Argument against, recorded.** It costs 34px of a short screen permanently, it
is one more fixed element on a page that already has a sticky header, and a
persistent sponsor bar is a pattern people associate with advertising. The
counter is that HSBC are the principal partner and the alternative on the table
was rendering their mark at 14px in a crowded header.

---

---

## 5. The match-day app — added 8 Aug 2026, after the above

**Jay asked for "the same sort of sticky bottom HSBC in the app too". The
premise was wrong and the fix is much smaller than that.**

⚠️ **`/app` already keeps HSBC on screen at all times from 360px up.**
`header.top` is `position:sticky; top:0` and carries the mark at 15px, so it is
there on every tab at every scroll position. Measured at 390px scrolled to
y=90: header at `top:0`, mark visible, 56×15. Nothing needed building for the
widths almost everyone uses.

⚠️ **And this page's bottom edge was already taken.** `.tabbar` is
`position:fixed; bottom:0`, five tabs, 63px. A website-style strip laid over it
would have covered the primary navigation of the app people use for two days at
the side of a pitch.

**The one real gap: ≤359px.** The header mark is hidden there by a measured,
documented decision — the bar holds one line down to ~342px with the mark, and
below that it wraps, on the phones with the least screen. Confirmed at 320px:
`display:none`, zero box. So a 320px handset had no persistent HSBC.

**What was built.** `.app-partner-strip` — shown **only** at `max-width:359px`,
the same number as the header hide, so exactly one placement is on screen at
any width. 26px tall, `--ink` background with the reverse lockup, sitting on
the bottom edge; **`.tabbar` moves up to `bottom:26px`** rather than being
covered, and `.app`'s padding-bottom goes 84 → 110px to reserve the room.

⚠️ **The safe-area inset moves with the bottom edge.** This page is
`viewport-fit=cover`, so `env(safe-area-inset-bottom)` is real space over the
home indicator. It belonged to `.tabbar`; it now belongs to the strip, and the
tab bar's padding drops to a plain 6px. On both, the tabs float. On neither,
the HSBC mark sits under the home indicator. **Neither is visible in a desktop
browser** — which is why it is asserted rather than eyeballed.

**Verified at 320 / 359 / 360 / 390 / 430:** exactly one HSBC placement visible
at each — strip at 320 and 359 (flush to the bottom, tabs lifted to 755,
padding 110px), header at 360 and up (strip `display:none`, tabs back at
bottom:0, padding 84px).

⚠️ **Two mistakes on the way in, both of which looked correct.**

1. **The block was first written next to the `.hdr-partner` hide it pairs with
   — which is ABOVE `.tabbar` in the file.** It overrides `.tabbar{bottom:0}`
   at the same specificity, so source order decided it and the tab bar simply
   did not move. The CSS read as if it had been applied. Caught by measuring
   `.tabbar`'s box, not by reading the rule. It now lives below `.tabbar`, with
   a comment saying why moving it back breaks it silently.
2. **Moving it broke the comment**, closing it early so half the block was
   parsed as CSS. The stylesheet was corrupt from that point down and
   `display:none` never applied — the strip rendered at 360px+ as a 281px
   block. Also caught only by measurement.

**Both are the same failure as the four in the 8 Aug handoff: a change that
reported success while the thing it claimed to do had not happened.** Reading
the diff would have passed both.

## What this change does NOT do

- **Nothing outside `Quins JRT.dc.html`.** `/rules`, `/legal`, `/signin` and the
  public `/scores` page were not looked at. Jay scoped it to the home page.
- **The hero headline still breaks as `TWO BIG DAYS / OF / JUNIOR RUGBY`**, with
  `OF` alone on a line. It is a `<br>` in the markup plus a `max-width:14ch`,
  and it was not reported. Left alone deliberately rather than swept in.
- **No phone was used.** Everything here is a headless emulation at three
  widths. It catches layout and it does not catch iOS Safari's dynamic toolbar,
  which is the one thing a fixed bottom strip could plausibly still be wrong
  about. **Worth one real look on an iPhone before this goes to production.**

## Verification

- Repo suite: **38 files clean**, before and after.
- `_prove-registration.js`: **731/731 faults caught by the named check; 33
  suites clean on an undamaged copy** — up from 724, i.e. all **7 new faults**
  discriminate. Three existing assertions failed on the first run and were
  updated by hand, not widened: the HSBC image count 4 → 5, the "In partnership
  with" count 2 → 3, and the hero-row anchor repointed after the row gained
  `class="hero-cta"` (**repointed, not deleted** — an anchor that no longer
  matches is a failed run).
- No horizontal overflow at 360 / 390 / 430 after the change, same check as
  before it.
