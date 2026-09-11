# The About carousel marks a host as built only after building it, and never marks a hidden one

**Ruling.** `build()` sets `host.__built` as its last step, after the track exists and the cards are made. Every early return leaves the flag unset, so the next scan tries again. A host with no client rects, which is what a `display:none` section below 760px has, is skipped without being flagged.

**Why.** The flag used to be set on entry. If the component engine was midway through re-rendering, the track was not there yet, the function returned, and the host stayed flagged as built for good: the section showed one static photo with no error. Flagging a hidden host fails the same way by a different route: a window dragged wider than 760px would never get a carousel.

**Against, and why it lost.** Setting the flag first guards against building twice, which is the usual reason to set it early. The re-scan loop already skips flagged hosts, so a second build cannot happen once one has succeeded, and a failed build must stay retryable.

**Where in the code.** `Quins JRT.dc.html` (`build()` and the re-scan loop that calls it).
