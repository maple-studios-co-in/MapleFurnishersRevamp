import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, parseSource, parseStoredSource, SourceList, computeSourceRevision } from '../src/modules/three-d/validation';
import { makeSource, reapproveSource, fixtureSourceRevision } from './fixtures/three-d-source';

test('approved Keeri inputs retain measurement, capture and variant attribution without silently dropping fields', () => {
  const source = makeSource();
  assert.equal(source.sourceRevision, fixtureSourceRevision);
  const parsed = parseSource(source, 'tenant-a', 'chair');
  assert.deepEqual(parsed, source);
  assert.equal(parsed.geometryGroups[0].measurement.verifiedBy, 'measurer-a');
  assert.equal(parsed.references[0].variantId, 'variant-oak');
  assert.equal(parsed.approval.approvedBy, 'approver-a');
});

test('changed approved inputs and mismatched approval revisions are refused', () => {
  const source = makeSource();
  parseSource(source, 'tenant-a');
  assert.throws(() => parseSource({ ...source, name: 'A different chair' }, 'tenant-a'), { statusCode: 400 });
  assert.throws(() => parseSource({ ...source, approval: { ...source.approval, revision: '0'.repeat(64) } }, 'tenant-a'), { statusCode: 400 });
  const unapprovedDimensions = structuredClone(source);
  unapprovedDimensions.geometryGroups[0].dimensionsMm.width = 900;
  assert.throws(() => parseSource(unapprovedDimensions, 'tenant-a'), { statusCode: 400 });
  const unapprovedAssociation = structuredClone(source);
  unapprovedAssociation.references[0].variantId = null;
  assert.throws(() => parseSource(unapprovedAssociation, 'tenant-a'), { statusCode: 400 });
  const unapprovedBytes = structuredClone(source);
  unapprovedBytes.references[0].checksum = '0'.repeat(64);
  assert.throws(() => parseSource(unapprovedBytes, 'tenant-a'), { statusCode: 400 });
});

test('renewed download URLs and array ordering do not invalidate approved content', () => {
  const source = makeSource();
  source.references.reverse();
  source.references.forEach(reference => { reference.url += '?signature=new-expiring-signature'; });
  source.variants[0].attributes = { fabric: 'Ivory', finish: 'Oak' };
  source.approval.approvedAt = '2026-09-08T10:00:00.000Z';
  assert.equal(parseSource(source, 'tenant-a').sourceRevision, fixtureSourceRevision);
});

test('duplicate geometry, variant and reference IDs cannot masquerade as valid associations', () => {
  const source = makeSource();
  for (const duplicate of [
    { ...source, geometryGroups: [...source.geometryGroups, source.geometryGroups[0]] },
    { ...source, variants: [...source.variants, source.variants[0]] },
    { ...source, references: [...source.references, source.references[0]] },
  ]) assert.throws(() => parseSource(reapproveSource(duplicate), 'tenant-a'), { statusCode: 400 });
});

test('references and variants must belong to their declared geometry and capture set', () => {
  const source = makeSource();
  const cases = [
    { ...source, variants: source.variants.map(variant => ({ ...variant, geometryGroupId: 'foreign-group' })) },
    { ...source, references: source.references.map(reference => ({ ...reference, geometryGroupId: 'foreign-group' })) },
    { ...source, references: source.references.map(reference => ({ ...reference, captureSetId: 'foreign-capture' })) },
    { ...source, references: source.references.map(reference => ({ ...reference, variantId: 'foreign-variant' })) },
  ];
  for (const invalid of cases) assert.throws(() => parseSource(reapproveSource(invalid), 'tenant-a'), { statusCode: 400 });
});

test('each geometry requires front, side, back and angle original photographs; generated supplements cannot replace them', () => {
  const source = makeSource();
  for (const role of ['front', 'side', 'back', 'angle']) {
    for (const provenance of ['generated', 'unknown'] as const) {
      const incomplete = { ...source, references: source.references.map(reference => reference.role === role ? { ...reference, provenance } : reference) };
      assert.throws(() => parseSource(reapproveSource(incomplete), 'tenant-a'), { statusCode: 400 });
    }
  }
  const supplement = { ...source.references[0], id: 'generated-supplement', role: 'detail' as const, variantId: null, provenance: 'generated' as const };
  assert.equal(parseSource(reapproveSource({ ...source, references: [...source.references, supplement] }), 'tenant-a').references.length, 5);
});

test('mixed sizes require a separate geometry group instead of an unchecked variant dimension override', () => {
  const source = makeSource();
  const variants = source.variants.map(variant => ({ ...variant, dimensionsMm: { width: 700, depth: 700, height: 800 } }));
  assert.equal(parseSource(reapproveSource({ ...source, variants }), 'tenant-a').variants[0].dimensionsMm?.width, 700);
  variants[0].dimensionsMm.width = 950;
  assert.throws(() => parseSource(reapproveSource({ ...source, variants }), 'tenant-a'), { statusCode: 400 });
});

test('complete independent geometry groups are representable but a photograph cannot cite a variant in another group', () => {
  const source = makeSource();
  const geometry = { ...source.geometryGroups[0], id: 'geometry-wide', captureSetId: 'capture-wide', dimensionsMm: { width: 900, depth: 700, height: 800 } };
  const variant = { ...source.variants[0], variantId: 'variant-wide', geometryGroupId: geometry.id };
  const references = source.references.map(reference => ({ ...reference, id: `${reference.id}-wide`, geometryGroupId: geometry.id, captureSetId: geometry.captureSetId, variantId: variant.variantId }));
  const multiple = reapproveSource({ ...source, geometryGroups: [...source.geometryGroups, geometry], variants: [...source.variants, variant], references: [...source.references, ...references] });
  assert.equal(parseSource(multiple, 'tenant-a').geometryGroups.length, 2);
  multiple.references[0].variantId = 'variant-wide';
  assert.throws(() => parseSource(reapproveSource(multiple), 'tenant-a'), { statusCode: 400 });
});

test('legacy packs and undeclared or unverified inputs fail without dropping evidence', () => {
  const source = makeSource();
  const cases = [
    { ...source, schemaVersion: 1 }, { ...source, readyFor3D: false }, { ...source, tenantId: 'different-tenant' },
    { ...source, unexplained: 'discard me' },
    { ...source, approval: { ...source.approval, unexplained: true } },
    { ...source, geometryGroups: source.geometryGroups.map(group => ({ ...group, measurement: { ...group.measurement, verifiedBy: '' } })) },
    { ...source, variants: source.variants.map(variant => ({ ...variant, attributes: { construction: { nested: true } } })) },
    { ...source, references: source.references.map(reference => ({ ...reference, url: 'http://images.example/image.png' })) },
    { ...source, references: source.references.map(reference => ({ ...reference, checksum: 'not-a-digest' })) },
    { ...source, references: source.references.map(reference => ({ ...reference, sizeBytes: 50 * 1024 * 1024 + 1 })) },
  ];
  for (const invalid of cases) assert.throws(() => parseSource(invalid, 'tenant-a'), { statusCode: 400 });
});

function storedSource() {
  const source = makeSource();
  return { ...source, references: source.references.map(({ url: _url, ...reference }) => reference), storedReferences: source.references.map(reference => ({ referenceId: reference.id, assetId: `asset-${reference.id}`, sha256: reference.checksum })) };
}

test('stored snapshots verify the approved revision without retaining expiring download URLs', () => {
  const source = storedSource();
  const parsed = parseStoredSource(source, 'tenant-a', 'chair');
  assert.equal(computeSourceRevision(parsed), fixtureSourceRevision);
  assert.deepEqual(parsed, source);
  assert.equal(Object.hasOwn(parsed.references[0], 'url'), false);
  assert.throws(() => parseStoredSource({ ...source, name: 'Unapproved change' }, 'tenant-a'), { statusCode: 400 });
  assert.throws(() => parseStoredSource(source, 'another-tenant'), { statusCode: 400 });
  assert.throws(() => parseStoredSource({ ...source, references: makeSource().references }, 'tenant-a'), { statusCode: 400 });
});

test('stored references require a complete one-to-one verified mapping of originals to Maple assets', () => {
  const source = storedSource();
  const mappings = source.storedReferences;
  const cases = [
    mappings.slice(1),
    [...mappings, mappings[0]],
    mappings.map((mapping, index) => index === 0 ? { ...mapping, referenceId: 'foreign-reference' } : mapping),
    mappings.map(mapping => ({ ...mapping, assetId: 'reused-asset' })),
    mappings.map((mapping, index) => index === 0 ? { ...mapping, sha256: '0'.repeat(64) } : mapping),
  ];
  for (const storedReferences of cases) assert.throws(() => parseStoredSource({ ...source, storedReferences }, 'tenant-a'), { statusCode: 400 });
});

test('bounded Keeri pages use approved SHA-256 revisions and contain each design only once', () => {
  const source = makeSource();
  const entry = { modelId: source.modelId, name: source.name, code: source.code, sourceRevision: source.sourceRevision };
  const page = { schemaVersion: 2, tenantId: 'tenant-a', products: [entry], nextCursor: null };
  assert.equal(parse(SourceList, page).products.length, 1);
  assert.throws(() => parse(SourceList, { ...page, products: [entry, entry] }), { statusCode: 400 });
  assert.throws(() => parse(SourceList, { ...page, products: [entry], schemaVersion: 1 }), { statusCode: 400 });
  assert.throws(() => parse(SourceList, { ...page, products: [{ ...entry, sourceRevision: 'r1' }] }), { statusCode: 400 });
  assert.throws(() => parse(SourceList, { ...page, products: Array.from({ length: 21 }, (_, index) => ({ ...entry, modelId: `chair-${index}` })) }), { statusCode: 400 });
});

test('canonical source hashing sorts numeric-looking attribute keys lexically across languages', () => {
  const source = makeSource();
  source.variants[0].attributes = { '2': 'two', '10': 'ten' };
  assert.equal(computeSourceRevision(source), 'a6f796e53d4d847357f2ad329c51e6ed2016481a34d6983de48aa2469874c925');
});
