# In the About carousel, every value that exists in several copies changes in all of them at once

**Ruling.** The `sizes` string appears three times, on both `<source>` tags in the markup and in `makecard()`, and all three track `--cw`: `(min-width:1461px) 380px, 26vw`, because 26vw reaches the 380px cap at a 1461px viewport. The dark ground `#0C0C0E` is set on three surfaces, `.about-photo`, `.jrtb-scene` and `.jrtb-p`, and the three change together.

**Why.** `sizes` is the browser's only advance notice of how wide a card will be. If it overstates the width, every visitor downloads a larger file than needed and nothing reports it. The card's own background is what shows before its photo decodes, and five cards start with no image at all; a lighter card flashes as a pale rectangle that reads as a broken image.

**Against, and why it lost.** One shared variable would remove the duplication, but `sizes` is an HTML attribute and cannot read a CSS variable. A test that the copies agree is the substitute.

**Where in the code.** `Quins JRT.dc.html` (`--cw`, `makecard()`, the About `<picture>`), `tests/test-about-board.js`.
