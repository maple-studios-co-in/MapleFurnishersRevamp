/**
 * Build a web-ready WebP scroll sequence from a folder of source frames,
 * with optional range + stride sampling.
 *
 * Usage:
 *   node scripts/build-frame-scene.mjs <srcDir> <outDir> [--from=1] [--to=N] [--step=1] [--width=1600] [--quality=78]
 */

import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [srcArg, outArg, ...flags] = process.argv.slice(2);
if (!srcArg || !outArg) {
  console.error(
    "Usage: node scripts/build-frame-scene.mjs <srcDir> <outDir> [--from=N] [--to=N] [--step=N] [--width=N] [--quality=N]",
  );
  process.exit(1);
}
const flag = (n, d) => {
  const h = flags.find((f) => f.startsWith(`--${n}=`));
  return h ? Number(h.split("=")[1]) : d;
};

const srcDir = path.resolve(srcArg);
const outDir = path.resolve(outArg);
const WIDTH = flag("width", 1600);
const QUALITY = flag("quality", 78);
const STEP = Math.max(1, flag("step", 1));

const all = readdirSync(srcDir)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const FROM = flag("from", 1);
const TO = flag("to", all.length);

const picked = all.slice(FROM - 1, TO).filter((_, i) => i % STEP === 0);
if (!picked.length) {
  console.error("No frames selected — check --from/--to/--step.");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

console.log(
  `Building ${picked.length} frames (source ${FROM}–${TO}, step ${STEP}) → ${outDir}`,
);

let srcBytes = 0;
let outBytes = 0;
for (let i = 0; i < picked.length; i++) {
  const src = path.join(srcDir, picked[i]);
  srcBytes += statSync(src).size;
  const buf = await sharp(src)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();
  writeFileSync(
    path.join(outDir, `frame-${String(i + 1).padStart(3, "0")}.webp`),
    buf,
  );
  outBytes += buf.length;
  if ((i + 1) % 25 === 0 || i === picked.length - 1) {
    process.stdout.write(`  ${i + 1}/${picked.length}\r`);
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(
  `\n${mb(srcBytes)} MB → ${mb(outBytes)} MB WebP (avg ${(outBytes / picked.length / 1024).toFixed(0)} KB/frame)`,
);
console.log(`\n➜  TOTAL_FRAMES = ${picked.length}`);
