"""
One-off: cut the background out of the customizer hero render (the moody
Axtra chair PNG) and emit a bbox-trimmed alpha PNG for /customize.

Same U2Net approach as cutout-frames.py — the moody gradient backdrop
overlaps the timber mid-tones, so threshold matting doesn't work here
either.

Usage:
  py -3.11 scripts/cutout-customizer.py <src.png> <out.png>
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    session = new_session("u2net")
    img = Image.open(src).convert("RGBA")
    cut = remove(img, session=session)

    # Trim to content with a small pad — the customizer canvas contains-fits
    # the bbox, so baked empty margins would only shrink the chair.
    bbox = cut.getbbox()
    if bbox:
        pad = 12
        left, top, right, bottom = bbox
        cut = cut.crop((
            max(0, left - pad),
            max(0, top - pad),
            min(cut.width, right + pad),
            min(cut.height, bottom + pad),
        ))

    out.parent.mkdir(parents=True, exist_ok=True)
    cut.save(out, "PNG")
    print(f"saved {out} {cut.size}")


if __name__ == "__main__":
    main()
