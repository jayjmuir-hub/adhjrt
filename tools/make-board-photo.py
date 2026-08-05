#!/usr/bin/env python3
"""
make-board-photo.py - turn any photo into a set of About-section ring panels.

    python tools/make-board-photo.py path/to/photo.jpg
    python tools/make-board-photo.py path/to/photo.jpg --at 12
    python tools/make-board-photo.py path/to/photo.jpg --centre 0.35
    python tools/make-board-photo.py --geometry 360

WHY THIS EXISTS
The rotating ring in the About section needs FOUR files per photo: two formats
(AVIF and WebP) at two widths (800 and 440). Doing that by hand is four chances
to get a crop or a quality setting wrong, and the panel shape is NOT the shape
of the box it sits in, so "just crop it to the box" produces a photo that gets
squashed. One command removes all of that.

WHAT IT PRODUCES, for --at 12:

    assets/board/board-12.avif       800 x 920   retina desktop
    assets/board/board-12.webp       800 x 920   fallback for the same
    assets/board/board-12-sm.avif    440 x 506   phones and 1x screens
    assets/board/board-12-sm.webp    440 x 506   fallback for the same

The browser picks ONE of the four on its own - that is what the <picture> and
`sizes` attributes in `Quins JRT.dc.html` are for. You never choose.

AFTER RUNNING IT, do one more thing: open `Quins JRT.dc.html`, find
`var PHOTOS = 11;` in the ring script, and make the number match how many
photos now exist. Nothing else needs touching - not the panel count, not the
radius, not the markup.

FIRST TIME ONLY, install the two libraries this needs:

    python -m pip install pillow pillow-avif-plugin

Nothing is added to package.json. This is a local tool, deliberately kept out
of the Netlify build - the site itself still has no build step.
"""

import argparse
import math
import os
import sys

# --- panel geometry -------------------------------------------------------
# These MUST agree with the CSS in Quins JRT.dc.html (.jrtb --pw / --ph / --r).
# If you change them, run --geometry to get the new radius to paste back.
PANEL_W_CSS = 400          # --pw : panel width in CSS pixels
PANEL_H_CSS = 460          # --ph : panel height, i.e. the full box height
PANELS      = 8            # how many panels are on the ring

# 2x of the panel for retina, and a ~1x file for phones.
SIZES = [
    (800, 920, ""),        # 800 / 400 = 2x
    (440, 506, "-sm"),     # a shade over 1x, and what a 260px phone panel takes
]

# Quality. Chosen by measuring, not by feel: at the size these are displayed,
# below ~72 WebP / ~50 AVIF it starts showing on grass and on the shirt reds.
WEBP_Q = 72
AVIF_Q = 50

OUT_DIR = os.path.join("assets", "board")


def ring_radius(panel_w=PANEL_W_CSS, panels=PANELS):
    """
    radius = (W / 2) / tan(180 / N)

    The distance each panel is pushed outwards so that N of them sit evenly
    around a cylinder without overlapping or leaving gaps. It is fixed by the
    panel width and the panel count - there is no freedom in it.
    """
    return (panel_w / 2) / math.tan(math.pi / panels)


def next_free_index():
    """Lowest board-NN not already used, so repeated runs never clash."""
    if not os.path.isdir(OUT_DIR):
        return 1
    used = set()
    for name in os.listdir(OUT_DIR):
        if name.startswith("board-") and "-sm" not in name:
            stem = name.split(".")[0].replace("board-", "")
            if stem.isdigit():
                used.add(int(stem))
    n = 1
    while n in used:
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo", nargs="?", help="source image (any size, any format)")
    ap.add_argument("--at", type=int, default=None,
                    help="board number to write (default: next free one)")
    ap.add_argument("--centre", type=float, default=0.5, metavar="0..1",
                    help="horizontal crop centre. The panel is PORTRAIT and your "
                         "photo is probably landscape, so this decides which part "
                         "of the width survives. 0 keeps the left, 1 keeps the "
                         "right. Default 0.5. Try this first if the ball carrier "
                         "gets cut off.")
    ap.add_argument("--top", type=float, default=0.42, metavar="0..1",
                    help="vertical crop centre. Default 0.42, slightly above "
                         "middle, which keeps heads in and cuts grass.")
    ap.add_argument("--geometry", type=int, metavar="PANEL_WIDTH", default=None,
                    help="just print the ring radius for a panel width and exit")
    args = ap.parse_args()

    if args.geometry:
        r = ring_radius(args.geometry)
        print(f"panel width {args.geometry}px, {PANELS} panels  ->  --r:{r:.0f}px")
        print("Paste that into the .jrtb block in Quins JRT.dc.html.")
        return 0

    if not args.photo:
        ap.print_help()
        print(f"\ncurrent geometry: {PANEL_W_CSS}x{PANEL_H_CSS} CSS px, "
              f"{PANELS} panels, radius {ring_radius():.0f}px")
        return 1

    try:
        import pillow_avif  # noqa: F401  (importing registers AVIF with Pillow)
        from PIL import Image, ImageOps
    except ImportError:
        print("Missing libraries. Run this once:\n")
        print("    python -m pip install pillow pillow-avif-plugin\n")
        return 1

    if not os.path.isfile(args.photo):
        print(f"No such file: {args.photo}")
        return 1

    if not os.path.isdir(OUT_DIR):
        print(f"Run this from the repo root - I cannot see {OUT_DIR}/")
        return 1

    n = args.at if args.at is not None else next_free_index()

    im = ImageOps.exif_transpose(Image.open(args.photo)).convert("RGB")
    print(f"{args.photo}  {im.width}x{im.height}  ->  board-{n:02d}")

    written = []
    for w, h, suffix in SIZES:
        # ImageOps.fit crops to the target aspect ratio AND resizes in one go,
        # honouring the centering. That is what stops the photo being squashed.
        panel = ImageOps.fit(im, (w, h), Image.LANCZOS,
                             centering=(args.centre, args.top))
        stem = os.path.join(OUT_DIR, f"board-{n:02d}{suffix}")
        panel.save(stem + ".avif", "AVIF", quality=AVIF_Q, speed=4)
        panel.save(stem + ".webp", "WEBP", quality=WEBP_Q, method=6)
        for ext in ("avif", "webp"):
            p = stem + "." + ext
            written.append((p, os.path.getsize(p)))

    print()
    for p, size in written:
        print(f"  {p:42} {size/1024:5.0f} KB")
    print(f"  {'':42} {sum(s for _, s in written)/1024:5.0f} KB total on disk")
    print("\n  A visitor downloads ONE of these four, not all of them.")

    print("\nNow open 'Quins JRT.dc.html', find  var PHOTOS = ...  in the ring")
    print("script and set it to the number of photos you now have.")
    print(f"If the crop cut someone off, re-run with --at {n} --centre 0.35 (or 0.65).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
