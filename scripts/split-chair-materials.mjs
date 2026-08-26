// Split the prepped chair GLB into TWO primitives (Wood_Walnut /
// Fabric_Olive) by classifying every FACE from the ORIGINAL atlas and
// smoothing on the true mesh-adjacency graph — the brief's two-material
// contract, synthesised from the AI export.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "axtra-chair-prepped.glb"; // rotation + normals already baked
const OUT = "axtra-chair-split.glb";

const glb = readFileSync(SRC);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const binOff = 20 + jsonLen;
const bin = glb.subarray(binOff + 8, binOff + 8 + glb.readUInt32LE(binOff));

const prim = json.meshes[0].primitives[0];
const acc = (i) => json.accessors[i];
const view = (a) => json.bufferViews[a.bufferView];
const offOf = (a) => (view(a).byteOffset ?? 0) + (a.byteOffset ?? 0);

const idxA = acc(prim.indices);
const idxOff = offOf(idxA);
const readIdx =
  idxA.componentType === 5125
    ? (k) => bin.readUInt32LE(idxOff + k * 4)
    : (k) => bin.readUInt16LE(idxOff + k * 2);
const triCount = idxA.count / 3;

const uvA = acc(prim.attributes.TEXCOORD_0);
const uvOff = offOf(uvA);
const uvStride = view(uvA).byteStride ?? 8;
const readUV = (v) => [bin.readFloatLE(uvOff + v * uvStride), bin.readFloatLE(uvOff + v * uvStride + 4)];
const posA = acc(prim.attributes.POSITION);
const posOff = offOf(posA);
const posStride = view(posA).byteStride ?? 12;
const px = (i) => bin.readFloatLE(posOff + i * posStride);
const py = (i) => bin.readFloatLE(posOff + i * posStride + 4);
const pz = (i) => bin.readFloatLE(posOff + i * posStride + 8);

// original BASE COLOUR atlas — resolved through the material's
// baseColorTexture rather than images[0]: AI exports order their images
// arbitrarily (the 2026-08 Meshy export ships its emissive map first).
const baseTex =
  json.materials[prim.material ?? 0].pbrMetallicRoughness.baseColorTexture;
const img = json.images[json.textures[baseTex.index].source];
const iv = json.bufferViews[img.bufferView];
const pngBytes = bin.subarray(iv.byteOffset ?? 0, (iv.byteOffset ?? 0) + iv.byteLength);
const { data: tex, info } = await sharp(Buffer.from(pngBytes)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const TW = info.width, TH = info.height;

/** Mean colour over a (2r+1)^2 texel block — the bake is noisy per texel,
 *  so classification must run on area averages, not single texels. */
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
const classifyColor = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  // too grey or too dark to carry material identity
  if (d < 6 || mx < 14) return -1;
  // bluish → neither walnut nor olive
  if (b > g * 1.1 && b > r) return -1;
  // Brightness-invariant split: walnut g/r ≈ 0.49, olive g/r ≈ 0.89
  // (measured on the atlas class means). Hue cutoffs misread dark olive
  // shading as brown; this ratio survives shadows.
  return g / Math.max(1, r) > 0.65 ? 1 : 0; // 0 wood, 1 fabric
};

/* ---- initial face classes (area-averaged samples) ---- */
const face = new Int8Array(triCount).fill(-1);
for (let t = 0; t < triCount; t++) {
  const a = readIdx(t * 3), b = readIdx(t * 3 + 1), c = readIdx(t * 3 + 2);
  const [ua, va] = readUV(a), [ub, vb] = readUV(b), [uc, vc] = readUV(c);
  const cu = (ua + ub + uc) / 3, cv = (va + vb + vc) / 3;
  let R = 0, G = 0, B = 0;
  for (const [u, v] of [
    [cu, cv],
    [(ua + cu) / 2, (va + cv) / 2],
    [(ub + cu) / 2, (vb + cv) / 2],
    [(uc + cu) / 2, (vc + cv) / 2],
  ]) {
    const [r, g, b2] = blockMean(u, v);
    R += r; G += g; B += b2;
  }
  face[t] = classifyColor(R / 4, G / 4, B / 4);
}

/* ---- charts: components of the shared-INDEX graph (UV seams duplicate
        vertices, so this graph is exactly per-chart connectivity) ---- */
const idxNbr = Array.from({ length: triCount }, () => []);
{
  const edgeMap = new Map();
  for (let t = 0; t < triCount; t++) {
    const v = [readIdx(t * 3), readIdx(t * 3 + 1), readIdx(t * 3 + 2)];
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      const other = edgeMap.get(key);
      if (other === undefined) edgeMap.set(key, t);
      else { idxNbr[t].push(other); idxNbr[other].push(t); }
    }
  }
}
const chart = new Int32Array(triCount).fill(-1);
let nCharts = 0;
{
  const stack = [];
  for (let seed = 0; seed < triCount; seed++) {
    if (chart[seed] >= 0) continue;
    stack.push(seed);
    chart[seed] = nCharts;
    while (stack.length) {
      const t = stack.pop();
      for (const n of idxNbr[t]) if (chart[n] < 0) { chart[n] = nCharts; stack.push(n); }
    }
    nCharts++;
  }
}

/* ---- chart-level vote: the stain is a minority inside its own chart ---- */
const votes = Array.from({ length: nCharts }, () => [0, 0, 0]); // wood, fabric, unknown
for (let t = 0; t < triCount; t++) votes[chart[t]][face[t] < 0 ? 2 : face[t]]++;
const chartClass = new Int8Array(nCharts).fill(-1);
const chartConf = new Float32Array(nCharts);
const chartSize = new Int32Array(nCharts);
for (let c = 0; c < nCharts; c++) {
  const [w, f, u] = votes[c];
  chartSize[c] = w + f + u;
  if (w + f > 0) {
    chartClass[c] = f > w ? 1 : 0;
    chartConf[c] = Math.abs(w - f) / (w + f + u);
  }
}

/* ---- chart adjacency via POSITION re-weld (surface neighbours) ---- */
const posKey = (i) =>
  `${Math.round(px(i) * 5e4)},${Math.round(py(i) * 5e4)},${Math.round(pz(i) * 5e4)}`;
const canon = new Map();
const canonOf = new Int32Array(posA.count);
for (let i = 0; i < canonOf.length; i++) {
  const k = posKey(i);
  const c = canon.get(k);
  if (c === undefined) { canon.set(k, i); canonOf[i] = i; } else canonOf[i] = c;
}
const chartNbr = new Map(); // "a,b" -> weight
{
  const edgeOwner = new Map();
  for (let t = 0; t < triCount; t++) {
    const v = [readIdx(t * 3), readIdx(t * 3 + 1), readIdx(t * 3 + 2)].map((i) => canonOf[i]);
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      const other = edgeOwner.get(key);
      if (other === undefined) edgeOwner.set(key, t);
      else if (chart[other] !== chart[t]) {
        const ca = Math.min(chart[other], chart[t]), cb = Math.max(chart[other], chart[t]);
        const k2 = ca + ":" + cb;
        chartNbr.set(k2, (chartNbr.get(k2) ?? 0) + 1);
      }
    }
  }
}
const chartAdj = Array.from({ length: nCharts }, () => []);
for (const [k, w] of chartNbr) {
  const [a, b] = k.split(":").map(Number);
  chartAdj[a].push([b, w]);
  chartAdj[b].push([a, w]);
}

/* ---- resolve weak/unknown charts from surface neighbours ---- */
for (let pass = 0; pass < 10; pass++) {
  let changed = 0;
  for (let c = 0; c < nCharts; c++) {
    if (chartClass[c] >= 0 && chartConf[c] >= 0.25 && chartSize[c] >= 30) continue;
    const w = [0, 0];
    for (const [n, wt] of chartAdj[c]) {
      if (chartClass[n] >= 0) w[chartClass[n]] += wt * Math.max(0.2, chartConf[n]);
    }
    if (w[0] + w[1] > 0) {
      const cl = w[1] > w[0] ? 1 : 0;
      if (cl !== chartClass[c]) { chartClass[c] = cl; changed++; }
      chartConf[c] = Math.max(chartConf[c], 0.25);
    }
  }
  if (!changed) break;
}
for (let c = 0; c < nCharts; c++) if (chartClass[c] < 0) chartClass[c] = 0;
for (let t = 0; t < triCount; t++) face[t] = chartClass[chart[t]];
console.log(`faces: ${triCount}, charts: ${nCharts}`);
const finalCount = [0, 0];
for (let t = 0; t < triCount; t++) finalCount[face[t]]++;
console.log(`wood faces: ${finalCount[0]}, fabric faces: ${finalCount[1]}`);

/* ---- build two index lists ---- */
const woodIdx = [], fabIdx = [];
for (let t = 0; t < triCount; t++) {
  const dst = face[t] === 0 ? woodIdx : fabIdx;
  dst.push(readIdx(t * 3), readIdx(t * 3 + 1), readIdx(t * 3 + 2));
}
const woodBuf = Buffer.from(new Uint32Array(woodIdx).buffer);
const fabBuf = Buffer.from(new Uint32Array(fabIdx).buffer);

/* ---- append views/accessors, rewrite mesh + materials ---- */
const pad = (n) => (4 - (n % 4)) % 4;
const p1 = pad(bin.length);
const woodOff = bin.length + p1;
const p2 = pad(woodOff + woodBuf.length);
const fabOff = woodOff + woodBuf.length + p2;
const newBin = Buffer.concat([bin, Buffer.alloc(p1), woodBuf, Buffer.alloc(p2), fabBuf]);

json.bufferViews.push(
  { buffer: 0, byteOffset: woodOff, byteLength: woodBuf.length, target: 34963 },
  { buffer: 0, byteOffset: fabOff, byteLength: fabBuf.length, target: 34963 },
);
json.accessors.push(
  { bufferView: json.bufferViews.length - 2, componentType: 5125, count: woodIdx.length, type: "SCALAR" },
  { bufferView: json.bufferViews.length - 1, componentType: 5125, count: fabIdx.length, type: "SCALAR" },
);
const texRef = json.materials[0].pbrMetallicRoughness.baseColorTexture;
json.materials = [
  {
    name: "Wood_Walnut",
    doubleSided: true,
    pbrMetallicRoughness: { baseColorTexture: texRef, metallicFactor: 0, roughnessFactor: 0.5 },
  },
  {
    name: "Fabric_Olive",
    doubleSided: true,
    pbrMetallicRoughness: { baseColorTexture: texRef, metallicFactor: 0, roughnessFactor: 0.95 },
  },
];
json.meshes[0].primitives = [
  { attributes: prim.attributes, indices: json.accessors.length - 2, material: 0, mode: 4 },
  { attributes: prim.attributes, indices: json.accessors.length - 1, material: 1, mode: 4 },
];
json.buffers[0].byteLength = newBin.length;

let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad(jsonBuf.length), 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const jc = Buffer.alloc(8);
jc.writeUInt32LE(jsonBuf.length, 0);
jc.writeUInt32LE(0x4e4f534a, 4);
const bc = Buffer.alloc(8);
bc.writeUInt32LE(newBin.length, 0);
bc.writeUInt32LE(0x004e4942, 4);
writeFileSync(OUT, Buffer.concat([header, jc, jsonBuf, bc, newBin]));
console.log(`wrote ${OUT}`);
