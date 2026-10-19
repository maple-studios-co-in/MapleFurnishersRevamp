/**
 * Build the Nimbus room plates for /spaces/nimbus from the supplied scroll
 * sequences.
 *
 * Each sequence (168 frames per room) is a staged cross-dissolve: every
 * frame is an eased mix of the two stage images either side of it (checked
 * pixel-for-pixel; the residual is compression noise). So the site ships
 * only the six stage images per room and the renderer dissolves between
 * them on the GPU, smoothly at any scroll position: about 4 MB in place of
 * roughly 100 MB of frames.
 *
 * Input: one folder per room, each holding the sequence's manifest.json,
 * keyframes/ and (as a fallback for a missing or broken keyframe) the
 * frames at each stage's `fully_visible_from_frame`.
 *
 * Usage:
 *   node scripts/build-nimbus-plates.mjs <srcRoot> <outDir> [--quality=86]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [srcArg, outArg, ...flags] = process.argv.slice(2);
if (!srcArg || !outArg) {
  console.error("Usage: node scripts/build-nimbus-plates.mjs <srcRoot> <outDir> [--quality=86]");
  process.exit(1);
}
const flag = (n, d) => {
  const h = flags.find((f) => f.startsWith(`--${n}=`));
  return h ? Number(h.split("=")[1]) : d;
};

const srcRoot = path.resolve(srcArg);
const outDir = path.resolve(outArg);
const QUALITY = flag("quality", 86);

const rooms = readdirSync(srcRoot).filter((d) => existsSync(path.join(srcRoot, d, "manifest.json")));
if (!rooms.length) {
  console.error(`No room folders with a manifest.json under ${srcRoot}`);
  process.exit(1);
}

/** printf-style "%04d" in the manifest's frame pattern. */
const framePath = (pattern, index) =>
  pattern.replace(/%0(\d)d/, (_, width) => String(index).padStart(Number(width), "0"));

/** A usable image: present, non-empty and decodable at the sequence's size. */
async function usable(file, width, height) {
  if (!existsSync(file) || statSync(file).size === 0) return false;
  try {
    const meta = await sharp(file).metadata();
    return meta.width === width && meta.height === height;
  } catch {
    return false;
  }
}

let total = 0;
for (const room of rooms) {
  const dir = path.join(srcRoot, room);
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const { width, height, pattern, stages } = manifest;
  const roomOut = path.join(outDir, room);
  rmSync(roomOut, { recursive: true, force: true });
  mkdirSync(roomOut, { recursive: true });

  for (const stage of stages) {
    const keyframe = path.join(dir, stage.keyframe);
    const frame = path.join(dir, framePath(pattern, stage.fully_visible_from_frame));
    let source = keyframe;
    if (!(await usable(keyframe, width, height))) {
      if (!(await usable(frame, width, height))) {
        console.error(`${room}/${stage.name}: neither ${keyframe} nor ${frame} is usable`);
        process.exit(1);
      }
      source = frame;
    }
    const out = path.join(roomOut, `${stage.name}.webp`);
    const info = await sharp(source).webp({ quality: QUALITY, effort: 6, smartSubsample: true }).toFile(out);
    total += info.size;
    const from = source === keyframe ? "keyframe" : `frame ${stage.fully_visible_from_frame}`;
    console.log(`${room}/${stage.name}.webp  ${(info.size / 1024).toFixed(0)} KB  (from ${from})`);
  }
}
console.log(`\n${rooms.length} rooms → ${outDir}  (${(total / 1024 / 1024).toFixed(2)} MB)`);
