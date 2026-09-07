import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseManifest, resolveSelection, selectionFromQuery } from '../src/lib/three-d/manifest';

const fixture = () => ({
  schemaVersion: 1, productId: 'chair', versionId: 'v1', slug: 'chair', name: 'Chair',
  modelUrl: '/api/3d/assets/model',
  angles: ['perspective', 'side', 'front', 'back'].map(label => ({ src: '/api/3d/assets/image', label })),
  dimensionsMm: { width: 660, depth: 760, height: 763 }, viewerProfile: 'studio-v1',
  materialSlots: { finish: ['Wood'], fabric: ['Fabric'] },
  finishes: [{ name: 'Walnut', hex: '#654321' }, { name: 'Oak', hex: '#ddbb99' }],
  fabrics: [{ name: 'Ivory', hex: '#eeeecc' }, { name: 'Charcoal', hex: '#222222' }],
  defaults: { finish: 'Walnut', fabric: 'Ivory' },
  variantBindings: [{ variantId: 'a', finish: 'Walnut', fabric: 'Ivory' }, { variantId: 'b', finish: 'Oak', fabric: 'Charcoal' }],
  disclaimer: 'Materials await reference validation.',
});

test('reads published manifests and preserves scoped preview asset URLs', () => {
  const value = fixture();
  value.modelUrl += '?preview=opaque-token';
  assert.equal(parseManifest(value)?.modelUrl, value.modelUrl);
});

test('rejects unsafe asset URLs, unsupported schemas/profiles and malformed measurements', () => {
  for (const patch of [
    { modelUrl: 'javascript:alert(1)' }, { modelUrl: '//external.example/model.glb' },
    { schemaVersion: 2 }, { viewerProfile: 'unknown' },
    { dimensionsMm: { width: 1, depth: -1, height: 2 } },
    { defaults: { finish: 'Missing', fabric: 'Ivory' } },
    { angles: [] }, { materialSlots: { finish: [1], fabric: [] } },
    { angles: fixture().angles.toReversed() },
  ]) assert.equal(parseManifest({ ...fixture(), ...patch }), null);
});

test('wood-only furniture does not require a fabricated fabric option', () => {
  const value = fixture();
  value.fabrics = [];
  value.materialSlots.fabric = [];
  value.defaults.fabric = '';
  value.variantBindings = [];
  assert.ok(parseManifest(value));
});

test('rejects variant bindings for undefined material choices', () => {
  const value = fixture();
  value.variantBindings[0].fabric = 'Missing';
  assert.equal(parseManifest(value), null);
});

test('changing finish selects an existing variant combination', () => {
  const manifest = parseManifest(fixture())!;
  assert.deepEqual(resolveSelection(manifest, { finish: 'Oak', fabric: 'Ivory', angle: 2 }, 'finish'),
    { finish: 'Oak', fabric: 'Charcoal', angle: 2 });
});

test('changing fabric retains the selected fabric and chooses its valid finish', () => {
  const manifest = parseManifest(fixture())!;
  assert.deepEqual(resolveSelection(manifest, { finish: 'Walnut', fabric: 'Charcoal', angle: 1 }, 'fabric'),
    { finish: 'Oak', fabric: 'Charcoal', angle: 1 });
});

test('a real product fabric named moss survives a saved URL unchanged', () => {
  const manifest = parseManifest(fixture())!;
  manifest.fabrics.push({ name: 'moss', hex: '#223322' });
  manifest.variantBindings = [];
  assert.equal(selectionFromQuery(manifest, new URLSearchParams('fabric=moss')).fabric, 'moss');
});

test('Taro legacy links still resolve while an exact fabric name wins', () => {
  const manifest = parseManifest(fixture())!;
  manifest.slug = 'taro'; manifest.variantBindings = [];
  assert.equal(selectionFromQuery(manifest, new URLSearchParams('fabric=ink')).fabric, 'Charcoal');
  manifest.fabrics.push({ name: 'ink', hex: '#111111' });
  assert.equal(selectionFromQuery(manifest, new URLSearchParams('fabric=ink')).fabric, 'ink');
});
