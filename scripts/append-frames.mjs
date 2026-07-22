/**
 * Append an image sequence to an existing WebP frame sequence, continuing
 * its numbering. Used to chain additional scenes (e.g. the chair turntable)
 * onto the hero scroll-scrub without re-extracting the video segment.
 *
 * Usage:
 *   node scripts/append-frames.mjs <srcDir> <seqDir> [--width=1600] [--quality=78]
 */

import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [srcArg, seqArg, ...flags] = process.argv.slice(2);
if (!srcArg || !seqArg) {
  console.error("Usage: node scripts/append-frames.mjs <srcDir> <seqDir> [--width=N] [--quality=N]");
  process.exit(1);
}

const flag = (n, d) => {
  const h = flags.find((f) => f.startsWith(`--${n}=`));
  return h ? Number(h.split("=")[1]) : d;
};
const WIDTH = flag("width", 1600);
const QUALITY = flag("quality", 78);

const srcDir = path.resolve(srcArg);
const seqDir = path.resolve(seqArg);

const existing = readdirSync(seqDir)
  .filter((f) => /^frame-\d+\.webp$/.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const offset = existing.length;

const incoming = readdirSync(srcDir)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!incoming.length) {
  console.error(`No images found in ${srcDir}`);
  process.exit(1);
}

console.log(`Appending ${incoming.length} frames after existing ${offset}`);

let srcBytes = 0;
let outBytes = 0;

for (let i = 0; i < incoming.length; i++) {
  const src = path.join(srcDir, incoming[i]);
  srcBytes += statSync(src).size;
  const buf = await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();
  writeFileSync(
    path.join(seqDir, `frame-${String(offset + i + 1).padStart(3, "0")}.webp`),
    buf,
  );
  outBytes += buf.length;
  if ((i + 1) % 20 === 0 || i === incoming.length - 1) {
    process.stdout.write(`  ${i + 1}/${incoming.length}\r`);
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(
  `\n${mb(srcBytes)} MB → ${mb(outBytes)} MB WebP (avg ${(outBytes / incoming.length / 1024).toFixed(0)} KB/frame)`,
);
console.log(`\n➜  Set TOTAL_FRAMES = ${offset + incoming.length}`);
