// Measure the per-class surface constants AxtraChair.tsx needs whenever the
// model is replaced (its comments demand a re-measure):
//   WOOD_REF_LUM / FABRIC_REF_LUM — mean LINEAR luminance of each class
//   BAKE_WOOD / BAKE_FABRIC       — mean sRGB colour of each class
// Runs on a SPLIT glb (two primitives, materials Wood_Walnut/Fabric_Olive
// sharing one atlas): each primitive's faces are sampled at their UV
// centroids, same area-averaged sampling as split-chair-materials.mjs.
//
//   node scripts/measure-atlas-classes.mjs <split.glb>
import { readFileSync } from "node:fs";
import sharp from "sharp";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: node measure-atlas-classes.mjs <split.glb>");
  process.exit(1);
}

const glb = readFileSync(SRC);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const binOff = 20 + jsonLen;
const bin = glb.subarray(binOff + 8, binOff + 8 + glb.readUInt32LE(binOff));

const acc = (i) => json.accessors[i];
const view = (a) => json.bufferViews[a.bufferView];
const offOf = (a) => (view(a).byteOffset ?? 0) + (a.byteOffset ?? 0);

// Resolve the base-colour atlas through the material reference — image
// order is arbitrary in AI exports (emissive/normal maps can come first).
const baseTex = json.materials.find((m) => m.pbrMetallicRoughness?.baseColorTexture)
  .pbrMetallicRoughness.baseColorTexture;
const img = json.images[json.textures[baseTex.index].source];
const iv = json.bufferViews[img.bufferView];
const pngBytes = bin.subarray(iv.byteOffset ?? 0, (iv.byteOffset ?? 0) + iv.byteLength);
const { data: tex, info } = await sharp(Buffer.from(pngBytes))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const TW = info.width, TH = info.height;

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const blockMean = (u, v, r = 2) => {
  const cx = Math.max(0, Math.min(TW - 1, Math.round(u * TW - 0.5)));
  const cy = Math.max(0, Math.min(TH - 1, Math.round(v * TH - 0.5)));
  let R = 0, G = 0, B = 0, n = 0;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
      const i = (y * TW + x) * 3;
      R += tex[i]; G += tex[i + 1]; B += tex[i + 2]; n++;
    }
  return [R / n, G / n, B / n];
};

for (const prim of json.meshes[0].primitives) {
  const matName = json.materials[prim.material]?.name ?? `material ${prim.material}`;
  const idxA = acc(prim.indices);
  const idxOff = offOf(idxA);
  const readIdx =
    idxA.componentType === 5125
      ? (k) => bin.readUInt32LE(idxOff + k * 4)
      : (k) => bin.readUInt16LE(idxOff + k * 2);
  const uvA = acc(prim.attributes.TEXCOORD_0);
  const uvOff = offOf(uvA);
  const uvStride = view(uvA).byteStride ?? 8;
  const readUV = (v) => [
    bin.readFloatLE(uvOff + v * uvStride),
    bin.readFloatLE(uvOff + v * uvStride + 4),
  ];

  let sr = 0, sg = 0, sb = 0, sLum = 0;
  const triCount = idxA.count / 3;
  for (let t = 0; t < triCount; t++) {
    const a = readIdx(t * 3), b = readIdx(t * 3 + 1), c = readIdx(t * 3 + 2);
    const [ua, va] = readUV(a), [ub, vb] = readUV(b), [uc, vc] = readUV(c);
    const [r, g, b2] = blockMean((ua + ub + uc) / 3, (va + vb + vc) / 3);
    sr += r; sg += g; sb += b2;
    sLum +=
      0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b2);
  }
  const hex = (v) =>
    Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  console.log(
    `${matName}: faces=${triCount} meanColor=#${hex(sr / triCount)}${hex(sg / triCount)}${hex(sb / triCount)} meanLinearLum=${(sLum / triCount).toFixed(4)}`,
  );
}
