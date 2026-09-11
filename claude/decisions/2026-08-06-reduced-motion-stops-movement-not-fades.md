# A request for reduced motion stops movement and keeps fades, pictures and changing content

**Ruling.** Under `prefers-reduced-motion: reduce`, translation, scaling and flight paths stop, but opacity cross-fades still run, and any animated element that forms part of a picture stays visible at its resting position. Nothing is hidden or snapped to its end state just because the viewer asked for less motion. Content that changes on its own keeps changing, by a cut instead of a slide: the About photo ring still advances, with its glide dropped to 1ms.

**Why.** The preference is about movement, because a slide can make someone motion-sick and a fade or a cut does not. Killing the fades as well made menus open with no visible change, which looks broken. Hiding the bat that sits in the crest's cut-out left a bat-shaped hole in the crest for exactly the viewers who had asked for less motion.

**Against, and why it lost.** Using `animation: none` everywhere is the simplest rule and the most conservative reading of the preference. It lost because it turns an accessibility setting into a degraded page, and here it produced two visible defects. The test fault injects the old hide-it rule, so reverting to it fails the suite.

**Where in the code.** `Quins JRT.dc.html`, `app.html`.
