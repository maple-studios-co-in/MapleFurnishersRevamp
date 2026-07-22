"""
Cut the studio background out of a product frame sequence and emit alpha WebP,
so the subject can be composited over real page content.

Uses rembg (U2Net). A hand-rolled luma/flood-fill matte was tried first and
rejected: the source background is a radial gradient whose darker vignette
overlaps the chair's own mid-tones, so any threshold either left background
blobs or ate into the timber. U2Net separates them cleanly, including the
thin curved arms and the negative space inside the frame.

Usage:
  python scripts/cutout-frames.py <srcDir> <outDir>
      [--width 1280] [--quality 72] [--step 1] [--limit N]
"""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import time
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--quality", type=int, default=72)
    ap.add_argument("--step", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--model", default="u2net")
    args = ap.parse_args()

    src_dir = Path(args.src).resolve()
    out_dir = Path(args.out).resolve()

    files = sorted(
        (p for p in src_dir.iterdir() if p.suffix.lower() in EXTS),
        key=lambda p: p.name,
    )[:: max(1, args.step)]
    if args.limit:
        files = files[: args.limit]

    if not files:
        print(f"No images found in {src_dir}", file=sys.stderr)
        return 1

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # One session for the whole batch — re-creating it per frame reloads the
    # 176 MB model each time.
    session = new_session(args.model)

    print(
        f"Cutting out {len(files)} frames -> {out_dir}\n"
        f"  alpha WebP {args.width}px q{args.quality} · model {args.model}"
    )

    src_bytes = 0
    out_bytes = 0
    t0 = time.time()

    for i, path in enumerate(files, start=1):
        src_bytes += path.stat().st_size

        # Matte at full resolution: downscaling first destroys the thin arms.
        cut = remove(Image.open(path), session=session)
        if cut.mode != "RGBA":
            cut = cut.convert("RGBA")

        if cut.width > args.width:
            h = round(cut.height * args.width / cut.width)
            cut = cut.resize((args.width, h), Image.LANCZOS)

        buf = io.BytesIO()
        cut.save(buf, format="WEBP", quality=args.quality, method=5)
        data = buf.getvalue()

        (out_dir / f"frame-{i:03d}.webp").write_bytes(data)
        out_bytes += len(data)

        print(f"  {i}/{len(files)}", end="\r", flush=True)

    mb = lambda b: f"{b / 1024 / 1024:.1f}"
    print(
        f"\n{mb(src_bytes)} MB -> {mb(out_bytes)} MB alpha WebP "
        f"(avg {out_bytes / len(files) / 1024:.0f} KB/frame) "
        f"in {time.time() - t0:.0f}s"
    )
    print(f"\n->  TOTAL_FRAMES = {len(files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
