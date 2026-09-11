# The crest bat rests exactly where it sits on the static crest, and every crest or bat change is compared with it before its first deploy

**Ruling.** Before the first deploy of any change to the crest or the bat, render the resting crest and compare it side by side with `assets/crest.png`, the crest used in the header and footer. The wing keyframes `flapL` and `flapR` are `rotate(0deg)` at both 0% and 100%; only the middle of a flap tilts. `assets/crest-bat-real.png` is not flat and must not run under the flap.

**Why.** The animation fills both ways, so its 0% frame shows during the delay before the flight and its 100% frame after it. When the two ends carried a tilt, the resting bat sat askew in the crest's cut-out, and only a render of the resting state showed it.

**Against, and why it lost.** A manual visual check is a step people skip, and a screenshot comparison in the suite would enforce it. None exists in this repo, and building one for a single image costs more than the risk; the check takes a minute in a browser. The keyframe values themselves are simple enough to review in the diff.

**Where in the code.** `Quins JRT.dc.html` (`@keyframes flapL`, `flapR`), `assets/crest.png`, `assets/crest-bat.png`, `assets/crest-bat-real.png`.
