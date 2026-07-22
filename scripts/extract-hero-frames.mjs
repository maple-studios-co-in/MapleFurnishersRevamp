/**
 * Extract a scroll-scrub frame sequence straight from the hero video.
 *
 * The sequence must START at exactly the timestamp the video freezes on, so
 * frame-001 is pixel-identical to the frozen <video> and the hand-off from
 * "video playing" to "scroll scrubbing" is invisible.
 *
 * Usage:
 *   node scripts/extract-hero-frames.mjs <video> <outDir> --start=7.4 --end=17.8 [--fps=10] [--width=1600] [--quality=78]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const [videoArg, outArg, ...flags] = process.argv.slice(2);
if (!videoArg || !outArg) {
  console.error(
    "Usage: node scripts/extract-hero-frames.mjs <video> <outDir> --start=N --end=N [--fps=10] [--width=1600] [--quality=78]",
  );
  process.exit(1);
}

const flag = (name, fallback) => {
  const hit = flags.find((f) => f.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};

// ffmpeg ships with the imageio-ffmpeg wheel; override with FFMPEG_PATH if needed.
const FFMPEG =
  process.env.FFMPEG_PATH ||
  "C:\\Users\\asus\\Anaconda3\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe";

const START = flag("start", 7.4);
const END = flag("end", 17.8);
const FPS = flag("fps", 10);
const WIDTH = flag("width", 1600);
const QUALITY = flag("quality", 78);

const video = path.resolve(videoArg);
const outDir = path.resolve(outArg);
const duration = +(END - START).toFixed(3);
const expected = Math.round(duration * FPS);

const stage = path.join(tmpdir(), `hero-frames-${Date.now()}`);
mkdirSync(stage, { recursive: true });

console.log(
  `Extracting ${START}s → ${END}s @ ${FPS}fps (~${expected} frames) from ${path.basename(video)}`,
);

// Single decode pass — far faster than seeking per frame.
execFileSync(
  FFMPEG,
  [
    "-y",
    "-ss", String(START),
    "-i", video,
    "-t", String(duration),
    "-vf", `fps=${FPS}`,
    "-fps_mode", "passthrough",
    path.join(stage, "%04d.png"),
  ],
  { stdio: "ignore" },
);

const staged = readdirSync(stage).filter((f) => f.endsWith(".png")).sort();
if (!staged.length) {
  rmSync(stage, { recursive: true, force: true });
  console.error("ffmpeg produced no frames — check the video path and time range.");
  process.exit(1);
}

// Clear stale frames so a shorter run can't leave orphans behind.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let srcBytes = 0;
let outBytes = 0;

for (let i = 0; i < staged.length; i++) {
  const src = path.join(stage, staged[i]);
  srcBytes += statSync(src).size;
  const buf = await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();
  writeFileSync(path.join(outDir, `frame-${String(i + 1).padStart(3, "0")}.webp`), buf);
  outBytes += buf.length;
  if ((i + 1) % 20 === 0 || i === staged.length - 1) {
    process.stdout.write(`  ${i + 1}/${staged.length}\r`);
  }
}

rmSync(stage, { recursive: true, force: true });

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(
  `\n${staged.length} frames → ${outDir}\n` +
    `${mb(srcBytes)} MB PNG → ${mb(outBytes)} MB WebP ` +
    `(avg ${(outBytes / staged.length / 1024).toFixed(0)} KB/frame)`,
);
console.log(`\n➜  Set TOTAL_FRAMES = ${staged.length}`);
