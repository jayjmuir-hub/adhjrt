# Any hover effect that moves or animates sits inside a pointer gate, on every page

**Ruling.** A `:hover` rule carrying `transform`, `animation` or `box-shadow` sits inside `@media (hover:hover)`. Colour-only hover rules may stay ungated. `:focus-visible` rules always sit outside the gate. A site-wide sweep enforces this on every served page, counts braces to find the gate, and asserts a floor of real rules so it cannot pass an empty set. Interaction feedback follows one pattern per component: darken on hover, slight scale on press, a shared `:focus-visible` ring, `tabular-nums` on score columns, and disabled buttons that look disabled.

**Why.** A touch device applies `:hover` on tap and never removes it, so a lifted or animated element stays stuck. It shipped once unnoticed; a desktop cannot show it. A keyboard user has no pointer, so a gated focus ring would vanish for them.

**Against, and why it lost.** The sweep fixed no live bug when added; every moving hover rule was already gated. It was kept because the first occurrence also looked satisfied everywhere until it wasn't.

**Replaces.** A homepage-only sweep, which stays because faults anchor on it.

**Where in the code.** `tests/test-design-polish.js`, `tests/test-about-board.js`, `tests/_prove-registration.js`, `app.html`, `Quins JRT.dc.html`.
