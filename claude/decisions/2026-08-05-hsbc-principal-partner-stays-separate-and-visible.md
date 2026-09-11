# HSBC is the principal partner: shown apart from the supporters, always on screen, never distorted

**Ruling.** The HSBC card sits above the supporters grid and is never folded into it or repeated inside it. On the homepage below 900px a fixed bottom strip carries the mark; the same breakpoint hides the header mark, so exactly one placement shows at any width. On the match-day app the header carries it, and a bottom strip replaces it only where the header hides it. Neither sticky placement is a link. Every placement keeps the lockup's aspect ratio with `height:auto` plus `max-height`, never a pinned height beside `max-width`.

**Why.** HSBC is the tournament's only principal partner; one wall of logos quietly demotes it. A pinned height inside a narrower box squashes the mark with no error. A sticky link can pull a parent out of the registration form from any scroll position.

**Against, and why it lost.** A permanent bar costs screen height on a phone and reads as advertising, and a separate mobile lockup is one more copy to drift. The alternative was a mark too small to read in a crowded header. If another placement is proposed, revisit this rather than adding one.

**Where in the code.** `Quins JRT.dc.html`, `app.html`, `tests/test-sponsors.js`, `tests/_prove-registration.js`.
