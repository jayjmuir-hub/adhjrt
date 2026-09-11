# Supporter logos keep their own artwork on a dark tile and are sized by aspect ratio, not one height

**Ruling.** Every supporter file is the sponsor's own artwork in its own colours: transparent, trimmed to the ink, never upscaled, `.webp`. Nothing is recoloured. Every tile is dark, each logo using a dark-ground file. There is no per-logo `light` flag and no white tile; do not reintroduce either. Each entry in `SPONSORS` carries `h = round(83.5 / sqrt(width/height))`, clamped 26 to 68. The markup binds `max-height` with `object-fit:contain`, never a fixed height. On phones the grid goes three across, two below 400px, with `h` unchanged. The Bottle Store and Sportsman's Arms were removed by decision and are not to be re-added.

**Why.** Equal height is not equal presence: a square mark beside a wide wordmark reads as a postage stamp. A fixed height distorts wide marks silently.

**Against, and why it lost.** Alternating dark and white tiles was built first. It needed a measured flag per logo and broke when a sponsor was added; dark versions of every file retired it. Recolouring marks white alters a sponsor's brand.

**Where in the code.** `Quins JRT.dc.html` (`SPONSORS`), `assets/`, `tools/make-sponsor-logos.py`, `tests/test-sponsors.js`.
