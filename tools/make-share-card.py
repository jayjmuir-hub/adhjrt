#!/usr/bin/env python3
"""
make-share-card.py - render assets/share-card.png, the og:image social card.

    python tools/make-share-card.py --fonts <dir-with-Anton-and-Barlow-ttf>

WHY THIS EXISTS
---------------
The card is a PICTURE of the tournament dates. When the tournament moved from
7-8 to 14-15 November on 11 Aug 2026, every text copy of the date was found and
fixed - including by a check that sweeps every shipped page for day numbers -
and this file was missed by all of it, because a sweep that reads text cannot
read pixels. Every link to adhjrt.com shared on WhatsApp, Facebook, LinkedIn or
Slack went on previewing SAT 7 & SUN 8 NOV, on a site that spreads mainly by
parents forwarding links.

state-of-play.md had even predicted it: "If the tournament dates ever change,
assets/share-card.png carries them and must be re-rendered." A note telling a
human to remember something is not a mechanism.

*** THE DATES ARE READ FROM netlify/functions/_venue.js AND ARE NEVER TYPED
    HERE. *** That is the whole point of this script existing rather than the
    card being a one-off export from a design tool that nobody can reproduce.
    Move the tournament in DEFAULT_VENUE, re-run this, commit the PNG. The
    weekday and month names are computed from the dates too, so a move to a
    different weekend cannot leave "SAT"/"SUN" lying.

*** IT REFUSES RATHER THAN GUESSES. *** If the dates cannot be parsed out of
    _venue.js it raises. A card that renders with a made-up date is worse than
    one that fails to render, because nobody looks at a picture that appeared.

FONTS. Anton (display) and Barlow (body), the site's two faces. They are NOT in
this repo and are not downloaded by this script - pass --fonts pointing at a
directory holding Anton-Regular.ttf, Barlow-Bold.ttf and Barlow-ExtraBold.ttf
(they are on Google Fonts, OFL). Rendering with a substitute face produces a
card that is subtly not the brand, so this refuses to fall back to a default.

NOT SERVED: tools/* carries a force-404 in netlify.toml. Never move this to the
repo root, which IS the deployed site.
"""

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
VENUE = REPO / "netlify" / "functions" / "_venue.js"
CREST = REPO / "assets" / "crest.png"
OUT = REPO / "assets" / "share-card.png"

W, H = 1200, 630

BLACK = (12, 12, 14)
WHITE = (255, 255, 255)
RED = (225, 27, 34)
GREEN = (23, 163, 74)
PILL_BG = (13, 38, 24)


def tournament_dates():
    """day1 and day2 out of DEFAULT_VENUE. Raises rather than guessing."""
    src = VENUE.read_text(encoding="utf8")
    found = {}
    for day in ("day1", "day2"):
        # The key sits inside the day's object literal; take the first date
        # string after the day's name.
        at = src.find(day + ":")
        if at < 0:
            raise SystemExit(f"could not find {day} in {VENUE}")
        m = re.search(r"date:\s*'(\d{4})-(\d{2})-(\d{2})'", src[at:])
        if not m:
            raise SystemExit(f"could not read a date for {day} in {VENUE}")
        found[day] = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if found["day2"] <= found["day1"]:
        raise SystemExit(f"day2 ({found['day2']}) is not after day1 ({found['day1']})")
    return found["day1"], found["day2"]


def date_line(d1, d2):
    """'SAT 14 & SUN 15 NOV' - weekday and month COMPUTED, never typed."""
    a = d1.strftime("%a").upper()
    b = d2.strftime("%a").upper()
    mon = d2.strftime("%b").upper()
    if d1.month != d2.month:                      # a weekend spanning a month
        return f"{a} {d1.day} {d1.strftime('%b').upper()} & {b} {d2.day} {mon}"
    return f"{a} {d1.day} & {b} {d2.day} {mon}"


def tracked(draw, xy, text, font, fill, spacing):
    """Draw with letter-spacing, which PIL has no notion of."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + spacing
    return x - spacing


def tracked_width(draw, text, font, spacing):
    return sum(draw.textlength(c, font=font) for c in text) + spacing * (len(text) - 1)


def build(fonts_dir):
    fdir = Path(fonts_dir)
    need = ["Anton-Regular.ttf", "Barlow-Bold.ttf", "Barlow-ExtraBold.ttf"]
    missing = [n for n in need if not (fdir / n).exists()]
    if missing:
        raise SystemExit(
            "missing font file(s): " + ", ".join(missing) +
            f"\nlooked in {fdir}\nAnton and Barlow are the site's faces; rendering with a "
            "substitute produces a card that is subtly not the brand, so this refuses to."
        )

    anton = ImageFont.truetype(str(fdir / "Anton-Regular.ttf"), 88)
    eyebrow_f = ImageFont.truetype(str(fdir / "Barlow-ExtraBold.ttf"), 27)
    pill_f = ImageFont.truetype(str(fdir / "Barlow-Bold.ttf"), 23)

    d1, d2 = tournament_dates()

    img = Image.new("RGB", (W, H), BLACK)
    dr = ImageDraw.Draw(img)

    # Two soft brand-coloured shapes, kept well under the text so nothing has to
    # fight them for contrast.
    dr.ellipse([1010, -300, 1660, 350], fill=(34, 14, 16))
    dr.ellipse([990, 400, 1640, 1050], fill=(12, 34, 22))
    dr.rectangle([0, 0, W, H], fill=None)

    # Top and bottom rules: red on the left running to green on the right.
    for x in range(W):
        t = x / (W - 1)
        c = (int(RED[0] + (GREEN[0] - RED[0]) * t),
             int(RED[1] + (GREEN[1] - RED[1]) * t),
             int(RED[2] + (GREEN[2] - RED[2]) * t))
        dr.line([(x, 0), (x, 9)], fill=c)
        dr.line([(x, H - 10), (x, H - 1)], fill=c)

    # The crest, on the left, vertically centred in the body.
    crest = Image.open(CREST).convert("RGBA")
    ch = 300
    cw = round(crest.width * ch / crest.height)
    crest = crest.resize((cw, ch), Image.LANCZOS)
    img.paste(crest, (105, (H - ch) // 2), crest)

    x0 = 105 + cw + 58          # text column starts clear of the crest
    tracked(dr, (x0, 168), "ABU DHABI HARLEQUINS", eyebrow_f, GREEN, 6.5)

    dr.text((x0 - 4, 205), "JUNIOR RUGBY", font=anton, fill=WHITE)
    dr.text((x0 - 4, 293), "TOURNAMENT 2026", font=anton, fill=WHITE)

    # The date pill.
    line = f"{date_line(d1, d2)}  ·  ZAYED SPORTS CITY, ABU DHABI"
    tw = tracked_width(dr, line, pill_f, 0.9)
    px0, py0 = x0 - 4, 408
    px1, py1 = px0 + tw + 56, py0 + 54
    dr.rounded_rectangle([px0, py0, px1, py1], radius=27, fill=PILL_BG, outline=GREEN, width=2)
    tracked(dr, (px0 + 28, py0 + 15), line, pill_f, WHITE, 0.9)

    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(REPO)}  {OUT.stat().st_size:,} bytes")
    print(f"dates read from _venue.js: {d1} .. {d2}  ->  {date_line(d1, d2)}")
    if px1 > W - 60:
        print(f"WARNING: the pill ends at {px1:.0f} of {W} - check it is not crowding the edge",
              file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True, help="directory holding the Anton and Barlow .ttf files")
    build(ap.parse_args().fonts)
