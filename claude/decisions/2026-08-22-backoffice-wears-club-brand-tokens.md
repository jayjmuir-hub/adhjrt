# The back office wears the club brand through one shared token block; the public pages keep their own look

**Ruling.** `/signin`, `/manager` and `/organizer` share a byte-identical `:root` token block, and a test asserts the copies agree. Colours go through `var(--…)`, not raw hexes. Wide screens get a dark sidebar at 1100px and up; below that the chrome band and pill tabs are unchanged. The sidebar and band are two copies of the same controls, and faults remove both. The public homepage, scores, register-club form and match-day app are out of scope. The bright dark-mode red never appears on a light surface. Two sets stay literal: the warm warning family, and the age-group tints, because JavaScript appends an alpha suffix and would turn `var()` into invalid CSS.

**Why.** The three club properties should read as one family, and palette alone did not achieve that: the shell does. Tokens make the next re-point one edit per file.

**Against, and why it lost.** Only volunteers see these pages, they already worked, the club palette may move again, and every styling sweep rots fault anchors. The cost is bounded and mechanical, and brand coherence is a strategic call.

**Where in the code.** `Signin.dc.html`, `Manager.dc.html`, `Organizer.dc.html`, `tests/test-backoffice-retheme.js`.
