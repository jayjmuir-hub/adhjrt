#!/usr/bin/env python3
"""
make-sponsor-logos.py - turn the sponsors' own artwork into the grid's assets.

    python tools/make-sponsor-logos.py --src "C:/Users/Jay/Desktop/Sponsor Logos"
    python tools/make-sponsor-logos.py --src ... --dry-run

WHY THIS EXISTS
---------------
The eighteen supporter logos were, until 11 Aug 2026, one file each, hand-made
from whatever a sponsor had sent - often a mark on a white ground that had to
have the white keyed out. Which tile a logo sat on was then decided by MEASURING
its contrast against #151517, and three of them (Oak View Group, V&P, Yas) had
no dark-ink version at all, so a white tile would have erased them outright.

Jay then supplied a proper pack: a DARK MODE and a LIGHT MODE version of all
eighteen. This script takes the dark-mode set, which is the one the grid needs
now that every tile is dark.

*** IT NEVER UPSCALES. *** A logo smaller than the house 160px height is stored
at native size rather than stretched, so a better file can replace it later with
no blur baked in. That rule predates this script and is kept.

*** IT RECOMPUTES `h`, WHICH MUST NOT BE COPIED FROM THE OLD ROW. *** Each grid
row carries its own MAX height, because equal height is not equal presence: a
5:1 wordmark and a 1.1:1 near-square set to the same height make the square one
look like a postage stamp beside it, which is a sponsor-relations problem rather
than a cosmetic one. A new crop changes the ratio, so h changes with it:

    h = round(83.5 / sqrt(width / height)), clamped 26..68

68 is what fits the 104px tile with 16px of padding; 26 is the legibility floor
on a phone. The script PRINTS the new rows - paste them into SPONSORS in
Quins JRT.dc.html, which stays the single source of that list.

*** IT REFUSES RATHER THAN SKIPS. *** A source file that cannot be found is an
error, not a warning. A silently skipped sponsor keeps its old artwork while the
commit message says they were all replaced, and nobody looks at eighteen logos
one by one afterwards.

NOT SERVED: tools/* carries a force-404 in netlify.toml.
"""

import argparse
import math
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
MAX_H = 160
FLOOR = 78          # see key_out_dark(): a ground darker than this is not ink

# Source file (dark-mode) -> the asset name already referenced by SPONSORS.
# Written out in full rather than derived from the names: the supplied files use
# the sponsors' own spellings ("Andersen", "Biottle", "V&P White Mode") and a
# clever matcher would quietly pair the wrong two the first time one changed.
MAP = {
    "1 Oak_View_Group Dark Mode.png":        "sponsor-oak-view-group.webp",
    "2 Ashurst Perkins Coie Dark Mode.png":  "sponsor-ashurst-perkins-coie.webp",
    "2 Brighton College Dark Mode.png":      "sponsor-brighton-college.webp",
    "2 McCaffertys Dark Mode.png":           "sponsor-mccaffertys.webp",
    "3 Crompton Partners Dark Mode.png":     "sponsor-crompton-partners.webp",
    "3 Sedbergh Dark Mode.png":              "sponsor-sedbergh.webp",
    "3 Sportsmans Arms Dark Mode.png":       "sponsor-sportsmans-arms.webp",
    "3 V&P Dark Mode.png":                   "sponsor-value-performance.webp",
    "4 Andersen Dark Mode.png":              "sponsor-anderson-education.webp",
    "4 Bili Boys Biltong Dark Mode.png":     "sponsor-bili-boys.webp",
    "4 Westminster Dark Mode.png":           "sponsor-westminster-construction.webp",
    "5 Align Dark Mode.png":                 "sponsor-align-health.webp",
    "5 Beond Dark Mode.png":                 "sponsor-beond.webp",
    "5 Broadway Malyan Dark Mode.png":       "sponsor-broadway-malyan.webp",
    "5 Recover Dark Mode.png":               "sponsor-recover.webp",
    "5 The Bottle Store Dark Mode.png":      "sponsor-bottle-store.webp",
    "5 Yas Dark Mode.png":                   "sponsor-yas-cycles.webp",
}


# ⚠️ ARABIAN SWIM ACADEMY IS DELIBERATELY ABSENT FROM THE MAP ABOVE.
# Their "Dark Mode" and "Light Mode" files are BYTE-IDENTICAL (same MD5) and
# both are the logo on a WHITE ground. Dropping that onto a dark tile puts a
# glaring white rectangle in the grid. The asset already on the site reads
# correctly on dark, so it is left alone. Listing them here and letting the
# ground-keying below "handle" it would erase their black type instead.


def ground_kind(im):
    """transparent / dark / light, from the four corners.

    ⚠️ "Dark Mode" in the supplied pack means DESIGNED FOR DARK, not
    transparent: six of the eighteen carry an opaque near-black rectangle. On
    the #151517 tile those render as visible off-black boxes, which reads as a
    bug rather than as a logo. Caught by LOOKING at a contact sheet - the
    ratios and file sizes were all perfectly plausible."""
    w, h = im.size
    corners = [im.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    if not all(c[3] > 200 for c in corners):
        return "transparent"
    avg = sum(sum(c[:3]) / 3 for c in corners) / 4
    return "dark" if avg < 60 else "light"


def key_out_dark(im):
    """Turn a light-ink-on-black lockup into ink on transparency.

    The inverse of the white-keying recipe already used for logos that arrive
    on a white ground: there alpha = 255 - min(r,g,b); here the ink IS the
    bright part, so alpha = max(r,g,b), and the colour is un-multiplied so
    coloured ink keeps its own hue rather than being washed toward white."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = max(r, g, b)
            if m == 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            k = 255 / m
            # ⚠️ A FLOOR, BECAUSE NOT EVERY "BLACK" GROUND IS BLACK. BEOND's
            # lockup sits on a MID-GREY panel, so a plain alpha = max(r,g,b)
            # left it semi-transparent and it rendered as a visible grey box on
            # the tile - the exact failure this keying exists to remove, just
            # fainter. Anything below the floor becomes fully transparent and
            # the rest is rescaled, so antialiasing on thin strokes survives.
            a2 = 0 if m <= FLOOR else round((m - FLOOR) * 255 / (255 - FLOOR))
            px[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a2)
    return im


def height_for(w, h):
    return max(26, min(68, round(83.5 / math.sqrt(w / h))))


def process(src_dir, dry):
    src_dir = Path(src_dir)
    missing = [s for s in MAP if not (src_dir / s).exists()]
    if missing:
        raise SystemExit("source file(s) not found:\n  " + "\n  ".join(missing) +
                         f"\nlooked in {src_dir}")

    rows = []
    for source, out_name in sorted(MAP.items()):
        im = Image.open(src_dir / source).convert("RGBA")

        kind = ground_kind(im)
        if kind == "dark":
            im = key_out_dark(im)
        elif kind == "light":
            raise SystemExit(
                f"{source} sits on a LIGHT ground and cannot go on a dark tile. "
                "Remove it from MAP and keep the existing asset, or get a real dark version.")

        # Trim to the ink. getbbox() on the alpha channel; if the file has no
        # transparency at all it returns the whole frame, which is correct for
        # a logo that genuinely has an opaque ground (Bili Boys is one).
        box = im.getchannel("A").getbbox() or im.getbbox()
        im = im.crop(box)

        if im.height > MAX_H:                     # scale DOWN only, never up
            im = im.resize((round(im.width * MAX_H / im.height), MAX_H), Image.LANCZOS)

        h = height_for(im.width, im.height)
        rows.append((out_name, im.width, im.height, h, kind))

        if not dry:
            im.save(ASSETS / out_name, "WEBP", quality=92, method=6)

    print(f"{'file':<44}{'stored':>12}{'ratio':>8}{'h':>5}  source")
    for name, w, hh, h, kind in rows:
        note = "keyed off a black ground" if kind == "dark" else ""
        print(f"{name:<44}{f'{w}x{hh}':>12}{w / hh:>7.1f}:1{h:>5}  {note}")
    if dry:
        print("\n--dry-run: nothing written")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="folder holding the sponsors' Dark Mode PNGs")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    process(a.src, a.dry_run)
