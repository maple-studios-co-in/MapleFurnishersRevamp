// Downsample every embedded image in a GLB to fit maxSize (default 1024),
// re-encoding JPEG→JPEG / PNG→PNG. Written because gltf-transform's `resize`
// trips a libvips colourspace error on Meshy's JPEG atlases.
//
//   node scripts/resize-atlas.mjs <in.glb> <out.glb> [maxSize] [jpegQuality]
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [SRC, OUT, MAX = "1024", QUALITY = "88"] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error("usage: node resize-atlas.mjs <in.glb> <out.glb> [maxSize] [jpegQuality]");
  process.exit(1);
}
const maxSize = Number(MAX);

const glb = readFileSync(SRC);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const binOff = 20 + jsonLen;
const bin = glb.subarray(binOff + 8, binOff + 8 + glb.readUInt32LE(binOff));

// Pull each bufferView's bytes out so the buffer can be reassembled after
// image bufferViews change size.
const chunks = json.bufferViews.map((bv) =>
  bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength),
);

for (const img of json.images ?? []) {
  const bv = img.bufferView;
  if (bv === undefined) continue;
  const isPng = img.mimeType === "image/png";
  const s = sharp(Buffer.from(chunks[bv]));
  const meta = await s.metadata();
  if (Math.max(meta.width, meta.height) <= maxSize) {
    console.log(`${img.name ?? "image"}: ${meta.width}x${meta.height}, already <= ${maxSize}`);
    continue;
  }
  const resized = s.resize(maxSize, maxSize, { fit: "inside" });
  const out = isPng
    ? await resized.png().toBuffer()
    : await resized.jpeg({ quality: Number(QUALITY) }).toBuffer();
  console.log(
    `${img.name ?? "image"}: ${meta.width}x${meta.height} → ${maxSize} (${(chunks[bv].length / 1048576).toFixed(2)} MB → ${(out.length / 1048576).toFixed(2)} MB)`,
  );
  chunks[bv] = out;
}

// Reassemble the binary chunk with 4-byte alignment.
let offset = 0;
const parts = [];
json.bufferViews.forEach((bv, i) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    parts.push(Buffer.alloc(pad));
    offset += pad;
  }
  bv.byteOffset = offset;
  bv.byteLength = chunks[i].length;
  parts.push(chunks[i]);
  offset += chunks[i].length;
});
const newBin = Buffer.concat(parts);
json.buffers[0].byteLength = newBin.length;

let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const binPadded = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPadded.length, 8);
const jc = Buffer.alloc(8);
jc.writeUInt32LE(jsonBuf.length, 0);
jc.writeUInt32LE(0x4e4f534a, 4);
const bc = Buffer.alloc(8);
bc.writeUInt32LE(binPadded.length, 0);
bc.writeUInt32LE(0x004e4942, 4);
writeFileSync(OUT, Buffer.concat([header, jc, jsonBuf, bc, binPadded]));
console.log(`wrote ${OUT} (${((12 + 16 + jsonBuf.length + binPadded.length) / 1048576).toFixed(2)} MB)`);
