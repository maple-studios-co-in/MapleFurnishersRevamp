// Prepare sample.glb for the Maple customizer:
//  - detect facing (backrest = top-30% vertex centroid; front = opposite)
//    and bake a Y-rotation so the chair faces +Z per the site's contract
//  - compute smooth area-weighted vertex normals (file ships none; without
//    them three falls back to flat derivative shading)
//  - metallicFactor 0, sensible roughness, doubleSided (AI meshes carry
//    the odd flipped patch)
import { readFileSync, writeFileSync } from "node:fs";

const SRC = process.argv[2] || "C:/Users/asus/Downloads/sample.glb";
const OUT = process.argv[3] || "axtra-chair-prepped.glb";

const buf = readFileSync(SRC);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
const binOff = 20 + jsonLen;
const binLen = buf.readUInt32LE(binOff);
const bin = Buffer.from(buf.subarray(binOff + 8, binOff + 8 + binLen)); // copy — we mutate

const prim = json.meshes[0].primitives[0];
const posAcc = json.accessors[prim.attributes.POSITION];
const posBV = json.bufferViews[posAcc.bufferView];
const posOff = (posBV.byteOffset ?? 0) + (posAcc.byteOffset ?? 0);
const stride = posBV.byteStride ?? 12;
const vCount = posAcc.count;

const idxAcc = json.accessors[prim.indices];
const idxBV = json.bufferViews[idxAcc.bufferView];
const idxOff = (idxBV.byteOffset ?? 0) + (idxAcc.byteOffset ?? 0);
const idxRead =
  idxAcc.componentType === 5125
    ? (k) => bin.readUInt32LE(idxOff + k * 4)
    : idxAcc.componentType === 5123
      ? (k) => bin.readUInt16LE(idxOff + k * 2)
      : (k) => bin.readUInt8(idxOff + k);

const px = (i) => bin.readFloatLE(posOff + i * stride);
const py = (i) => bin.readFloatLE(posOff + i * stride + 4);
const pz = (i) => bin.readFloatLE(posOff + i * stride + 8);

/* ---- facing detection ---- */
let minY = Infinity, maxY = -Infinity, cx = 0, cz = 0;
for (let i = 0; i < vCount; i++) {
  const y = py(i);
  if (y < minY) minY = y;
  if (y > maxY) maxY = y;
  cx += px(i);
  cz += pz(i);
}
cx /= vCount;
cz /= vCount;
const yCut = minY + 0.7 * (maxY - minY);
let bx = 0, bz = 0, bn = 0;
for (let i = 0; i < vCount; i++) {
  if (py(i) >= yCut) { bx += px(i) - cx; bz += pz(i) - cz; bn++; }
}
bx /= bn;
bz /= bn;
// facing = opposite of the backrest direction
const facingAngle = Math.atan2(-bx, -bz); // 0 = +Z
const theta = -facingAngle;
console.log(
  `backrest centroid offset: x=${bx.toFixed(3)} z=${bz.toFixed(3)} (${bn} verts) → facing ${(facingAngle * 180 / Math.PI).toFixed(1)}°, rotating ${(theta * 180 / Math.PI).toFixed(1)}°`,
);

/* ---- bake rotation into positions ---- */
const c = Math.cos(theta), s = Math.sin(theta);
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vCount; i++) {
  const x = px(i), y = py(i), z = pz(i);
  const nx = c * x + s * z;
  const nz = -s * x + c * z;
  bin.writeFloatLE(nx, posOff + i * stride);
  bin.writeFloatLE(nz, posOff + i * stride + 8);
  const v = [nx, y, nz];
  for (let k = 0; k < 3; k++) {
    if (v[k] < mn[k]) mn[k] = v[k];
    if (v[k] > mx[k]) mx[k] = v[k];
  }
}
posAcc.min = mn.map((v) => +v);
posAcc.max = mx.map((v) => +v);

/* ---- smooth vertex normals (area-weighted) ---- */
const nrm = new Float32Array(vCount * 3);
const triCount = Math.floor(idxAcc.count / 3);
for (let t = 0; t < triCount; t++) {
  const a = idxRead(t * 3), b = idxRead(t * 3 + 1), d = idxRead(t * 3 + 2);
  const ax = px(a), ay = py(a), az = pz(a);
  const bx2 = px(b), by = py(b), bz2 = pz(b);
  const dx = px(d), dy = py(d), dz = pz(d);
  const ux = bx2 - ax, uy = by - ay, uz = bz2 - az;
  const vx = dx - ax, vy = dy - ay, vz = dz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  for (const vi of [a, b, d]) {
    nrm[vi * 3] += nx;
    nrm[vi * 3 + 1] += ny;
    nrm[vi * 3 + 2] += nz;
  }
}
for (let i = 0; i < vCount; i++) {
  const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
  const l = Math.hypot(nx, ny, nz) || 1;
  nrm[i * 3] = nx / l;
  nrm[i * 3 + 1] = ny / l;
  nrm[i * 3 + 2] = nz / l;
}

/* ---- material hygiene ---- */
const mat = json.materials[0];
mat.name = "baked_atlas";
mat.pbrMetallicRoughness = mat.pbrMetallicRoughness ?? {};
mat.pbrMetallicRoughness.metallicFactor = 0;
mat.pbrMetallicRoughness.roughnessFactor = 0.92;
mat.doubleSided = true;

/* ---- append NORMAL accessor ---- */
const pad = (4 - (bin.length % 4)) % 4;
const nrmBytes = Buffer.from(nrm.buffer);
const newBin = Buffer.concat([bin, Buffer.alloc(pad), nrmBytes]);
json.bufferViews.push({
  buffer: 0,
  byteOffset: bin.length + pad,
  byteLength: nrmBytes.length,
  target: 34962,
});
json.accessors.push({
  bufferView: json.bufferViews.length - 1,
  componentType: 5126,
  count: vCount,
  type: "VEC3",
});
prim.attributes.NORMAL = json.accessors.length - 1;
json.buffers[0].byteLength = newBin.length;
json.asset.generator = (json.asset.generator ?? "") + " + maple-prep";

/* ---- write GLB ---- */
let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jPad = (4 - (jsonBuf.length % 4)) % 4;
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jPad, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const jChunk = Buffer.alloc(8);
jChunk.writeUInt32LE(jsonBuf.length, 0);
jChunk.writeUInt32LE(0x4e4f534a, 4);
const bChunk = Buffer.alloc(8);
bChunk.writeUInt32LE(newBin.length, 0);
bChunk.writeUInt32LE(0x004e4942, 4);
writeFileSync(OUT, Buffer.concat([header, jChunk, jsonBuf, bChunk, newBin]));
console.log(`wrote ${OUT} (${((12 + 8 + jsonBuf.length + 8 + newBin.length) / 1048576).toFixed(2)} MB)`);
console.log(`new bounds: min=${mn.map((v) => v.toFixed(3))} max=${mx.map((v) => v.toFixed(3))}`);
