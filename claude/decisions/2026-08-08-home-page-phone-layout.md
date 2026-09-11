# On a phone the homepage keeps its groups in one row, and every form control is at least 16px

**Ruling.** Below 800px the two Register buttons sit side by side and the stats bar stays one row of four. The Register button rules share the 800px query that hides `.hero-partner`, because they also match it. Below 640px the registration modals go to one column with reduced padding, and every input, select and textarea has a computed font size of at least 16px.

**Why.** The page did not overflow; stacked rows simply read badly on a phone and pushed content down. iOS Safari zooms into any focused control under 16px and does not zoom back out, which no desktop emulator reproduces. The modals render only while registration is open, so they have to be checked with the window forced open.

**Against, and why it lost.** Side-by-side buttons need 14px labels with little air, and four counters in a narrow band need small label type. Stacking is the common pattern. The maintainer chose the row layout after seeing both; if the buttons read as cramped, shorten the labels rather than reclaim width.

**Where in the code.** `Quins JRT.dc.html`, `tests/test-sponsors.js`, `tests/_prove-registration.js`.
