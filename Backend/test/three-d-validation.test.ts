import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, parseSource, ManifestSchema } from '../src/modules/three-d/validation';
import { validateArtifact } from '../src/modules/three-d/storage';

const source = { schemaVersion: 1, tenantId: 'tenant-a', modelId: 'chair', name: 'Chair', code: 'CHAIR', readyFor3D: true, sourceRevision: 'r1', variants: [], references: [] };
test('Keeri import refuses unflagged, wrong-tenant and mismatched design inputs', () => {
  assert.throws(() => parseSource({ ...source, readyFor3D: false }, 'tenant-a'));
  assert.throws(() => parseSource(source, 'tenant-b'));
  assert.throws(() => parseSource(source, 'tenant-a', 'other-model'));
  assert.equal(parseSource(source, 'tenant-a').modelId, 'chair');
});
const base = { schemaVersion: 1, modelAssetId: 'model', angles: ['perspective', 'side', 'front', 'back'].map(label => ({ assetId: label, label })), dimensionsMm: { width: 700, depth: 700, height: 800 }, viewerProfile: 'studio-v1', materialSlots: { finish: [], fabric: [] }, finishes: [], fabrics: [], defaults: { finish: '', fabric: '' }, variantBindings: [], disclaimer: 'Preview.' };
test('authored models support no material choices and invalid view or material combinations are rejected', () => {
  assert.equal(parse(ManifestSchema, base).fabrics.length, 0);
  assert.throws(() => parse(ManifestSchema, { ...base, defaults: { fabric: 'Ghost', finish: '' } }));
  assert.throws(() => parse(ManifestSchema, { ...base, angles: base.angles.map(a => ({ ...a, label: 'front' })) }));
  assert.throws(() => parse(ManifestSchema, { ...base, dimensionsMm: { ...base.dimensionsMm, width: -1 } }));
  assert.throws(() => parse(ManifestSchema, { ...base, finishes: [{ name: 'Oak', hex: '#777777' }], defaults: { finish: 'Oak', fabric: '' } }));
});
function glb(json: unknown) {
  const raw = JSON.stringify(json); const data = Buffer.from(raw.padEnd(Math.ceil(raw.length / 4) * 4));
  const bytes = Buffer.alloc(data.length + 20); bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(data.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); data.copy(bytes, 20); return bytes;
}
test('GLB validation rejects external resources and malformed arrays as a client error', () => {
  assert.throws(() => validateArtifact('web_model', glb({ asset: { version: '2.0' }, images: [{ uri: 'https://untrusted.invalid/texture.jpg' }] })), { statusCode: 400 });
  assert.throws(() => validateArtifact('web_model', glb({ asset: { version: '2.0' }, buffers: {} })), { statusCode: 400 });
  assert.throws(() => validateArtifact('web_model', glb({ asset: { version: '2.0' }, images: [null] })), { statusCode: 400 });
});
test('image headers with zero dimensions and truncated PNG data are rejected', () => {
  const headerOnly = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(headerOnly); headerOnly.write('IHDR', 12);
  assert.throws(() => validateArtifact('preview', headerOnly), { statusCode: 400 });
});
test('calibrated Taro colors above one remain valid and shuffled views normalize to the viewer order', () => {
  const parsed = parse(ManifestSchema, { ...base, angles: [...base.angles].reverse(), finishes: [{ name: 'Ash', hex: '#eeeeee', linearColor: [2, 1.65, 1.2] }], materialSlots: { finish: ['Wood'], fabric: [] }, defaults: { finish: 'Ash', fabric: '' } });
  assert.deepEqual(parsed.angles.map(a => a.label), ['perspective', 'side', 'front', 'back']);
  assert.deepEqual(parsed.finishes[0].linearColor, [2, 1.65, 1.2]);
});
