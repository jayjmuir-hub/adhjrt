# The About photos and flying bat are plain CSS 3D and offset-path, with no animation library and no manual controls

**Ruling.** The About photos and the crest bat use CSS transforms, `offset-path` and a small script; no animation library loads. The bat's wings are clipped halves of one flat PNG under a non-rotating body band. The 3D scene never carries `box-shadow`, `overflow`, `opacity` or `filter`. Below 760px the block is not downloaded, falling back to one static photo if the script fails. The carousel has no manual controls — drag and arrow keys were removed. Its timer pauses only off screen or in a hidden tab. Under reduced motion it keeps running, glide dropped to 1ms so photos cut instead of slide. If drag returns, `touch-action: pan-y` must return with it.

**Why.** CDN scripts have repeatedly failed to load, leaving a broken-looking page. With no controls, stopping the timer would strand a reduced-motion visitor on the first photo. Without `pan-y`, a drag handler swallows a tablet's vertical scroll, which no desktop shows.

**Against, and why it lost.** A library gives spring physics and a path that adapts to width; neither is needed yet. Stopping the carousel under reduced motion is the cautious reading, but a cut is not movement.

**Where in the code.** `Quins JRT.dc.html`, `assets/crest-bat.png`, `tests/test-about-board.js`.
