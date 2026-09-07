import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

// This file never reads app credentials. A database is only used when explicitly supplied.
process.env.DOTENV_CONFIG_PATH = '/dev/null';
process.env.NODE_ENV = 'test';
for (const key of ['KEERI_3D_API_URL', 'KEERI_3D_TOKEN', 'KEERI_3D_TENANT_ID']) delete process.env[key];
process.env.DATABASE_URL = process.env.THREE_D_TEST_DATABASE_URL || 'postgresql://unused:unused@127.0.0.1:1/maple_3d_test';
process.env.JWT_SECRET = 'maple-three-d-test-secret-32-characters';
process.env.ADMIN_EMAIL = 'three-d-test@example.com';
process.env.ADMIN_PASSWORD_HASH = '$2b$10$unused-test-hash-placeholder';
let server: Server;
let origin: string;
let db: any;
let storageDirectory: string;
const token = jwt.sign({ sub: 'three-d-test@example.com' }, process.env.JWT_SECRET);
async function request(path: string, body?: unknown, authenticated = true) {
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
before(async () => {
  if (process.env.THREE_D_TEST_DATABASE_URL) {
    const url = new URL(process.env.THREE_D_TEST_DATABASE_URL);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/maple3d_test', 'Tests require an explicitly supplied local disposable maple3d_test database');
  }
  storageDirectory = await mkdtemp(join(tmpdir(), 'maple-three-d-test-'));
  process.env.THREE_D_STORAGE_DIR = storageDirectory;
  const { createApp } = await import('../src/app');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
  db = (await import('../src/lib/prisma')).prisma;
});
after(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (db) await db.$disconnect(); if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true }); });

test('3D admin endpoints require authentication before reading data', async () => {
  assert.equal((await request('/api/admin/3d/products', undefined, false)).status, 401);
});
test('an unconfigured connector reports setup honestly', async () => {
  const result = await request('/api/admin/3d/config');
  assert.equal(result.status, 200);
  assert.equal(result.body.keeriConfigured, false);
  assert.equal(result.body.recipes[0].id, 'manual-blender');
  assert.equal((await request('/api/admin/3d/keeri/sync', {})).status, 503);
});
test('preview tokens cannot authenticate as an administrator', async () => {
  const scopedToken = jwt.sign({ productId: 'a', versionId: 'b', purpose: 'three-d-preview' }, process.env.JWT_SECRET!, { audience: 'maple-three-d-preview', expiresIn: '15m' });
  const result = await fetch(origin + '/api/admin/3d/products', { headers: { Authorization: `Bearer ${scopedToken}` } });
  assert.equal(result.status, 401);
});

const integration = process.env.THREE_D_TEST_DATABASE_URL ? test : test.skip;
integration('durable workflow enforces artifact ownership, review, preview scope, immutable completion and publication rollback', async () => {
  assert.match(process.env.THREE_D_TEST_DATABASE_URL!, /\/maple3d_test(?:[?]|$)/, 'only a disposable maple3d_test database is allowed');
  const suffix = Date.now();
  const first = await request('/api/admin/3d/products', { slug: `test-chair-${suffix}`, name: 'Test Chair' });
  assert.equal(first.status, 201);
  const product = first.body.product;
  const other = (await request('/api/admin/3d/products', { slug: `other-chair-${suffix}`, name: 'Other Chair' })).body.product;
  assert.equal((await request(`/api/3d/products/${product.slug}`, undefined, false)).status, 404);
  assert.equal((await request(`/api/admin/3d/products/${product.id}/jobs`, { recipeId: 'unknown', idempotencyKey: 'unknown' })).status, 400);
  const jobResponse = await request(`/api/admin/3d/products/${product.id}/jobs`, { recipeId: 'manual-blender', idempotencyKey: 'delivery-1' });
  assert.equal(jobResponse.status, 201);
  assert.equal(jobResponse.body.job.status, 'awaiting_delivery');
  assert.equal((await request(`/api/admin/3d/products/${product.id}/jobs`, { recipeId: 'manual-blender', idempotencyKey: 'delivery-1' })).body.job.id, jobResponse.body.job.id);
  const gltfJson = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], materials: [{ name: 'Wood' }, { name: 'Fabric' }] });
  const gltf = Buffer.from(gltfJson.padEnd(Math.ceil(gltfJson.length / 4) * 4, ' '));
  const glb = Buffer.alloc(20 + gltf.length);
  glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(gltf.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); gltf.copy(glb, 20);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=', 'base64');
  async function upload(id: string, kind: string, filename: string, bytes: Buffer) {
    const response = await fetch(`${origin}/api/admin/3d/products/${id}/assets?kind=${kind}&filename=${encodeURIComponent(filename)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: bytes });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await upload(product.id, 'web_model', 'bad.glb', Buffer.from('not a model'))).status, 400);
  const model = (await upload(product.id, 'web_model', '../../model.glb', glb)).body.asset;
  const angle = (await upload(product.id, 'preview', 'angle.png', png)).body.asset;
  const foreign = (await upload(other.id, 'preview', 'foreign.png', png)).body.asset;
  const master = (await upload(product.id, 'blender_master', 'source.blend', Buffer.from('BLENDER-v401test-file'))).body.asset;
  const reference = (await upload(product.id, 'reference', 'source.png', png)).body.asset;
  const foreignMaster = (await upload(other.id, 'blender_master', 'foreign.blend', Buffer.from('BLENDER-v401test-file'))).body.asset;
  assert.ok(model.id); assert.ok(master.id);
  assert.equal('storageKey' in model, false);
  const manifest = { schemaVersion: 1, modelAssetId: model.id, angles: ['perspective', 'side', 'front', 'back'].map(label => ({ assetId: angle.id, label })), dimensionsMm: { width: 700, depth: 700, height: 800 }, viewerProfile: 'studio-v1', materialSlots: { finish: ['Wood'], fabric: ['Fabric'] }, finishes: [{ name: 'Oak', hex: '#aabbcc' }], fabrics: [{ name: 'Cream', hex: '#eeeeee' }], defaults: { finish: 'Oak', fabric: 'Cream' }, variantBindings: [], disclaimer: 'Digital preview.' };
  assert.equal((await request(`/api/admin/3d/products/${product.id}/versions`, { manifest: { ...manifest, modelAssetId: master.id } })).status, 400);
  assert.equal((await request(`/api/admin/3d/products/${product.id}/versions`, { manifest: { ...manifest, angles: manifest.angles.map((a, i) => i === 0 ? { ...a, assetId: foreign.id } : a) } })).status, 400);
  assert.equal((await request(`/api/admin/3d/products/${product.id}/versions`, { manifest: { ...manifest, materialSlots: { finish: ['MissingWood'], fabric: ['Fabric'] } } })).status, 400);
  assert.equal((await request(`/api/admin/3d/products/${product.id}/versions`, { masterAssetId: angle.id, manifest })).status, 400);
  assert.equal((await request(`/api/admin/3d/products/${product.id}/versions`, { masterAssetId: foreignMaster.id, manifest })).status, 400);
  const versionResponse = await request(`/api/admin/3d/products/${product.id}/versions`, { jobId: jobResponse.body.job.id, masterAssetId: master.id, manifest });
  assert.equal(versionResponse.status, 201);
  const version = versionResponse.body.version;
  assert.equal(version.masterAssetId, master.id);
  assert.equal(version.status, 'draft');
  assert.equal((await request(`/api/admin/3d/products/${product.id}/versions`, { jobId: jobResponse.body.job.id, manifest })).status, 409);
  assert.equal((await request(`/api/admin/3d/versions/${version.id}/publish`, {})).status, 409);
  assert.equal((await request(`/api/3d/assets/${model.id}`, undefined, false)).status, 404);
  const preview = (await request(`/api/admin/3d/versions/${version.id}/preview`, {})).body;
  const previewToken = new URL(preview.path, 'http://local').searchParams.get('preview');
  const previewManifest = await request(`/api/3d/products/${product.slug}?preview=${previewToken}`, undefined, false);
  assert.equal(previewManifest.status, 200);
  assert.equal(previewManifest.headers.get('cache-control'), 'no-store');
  assert.equal((await request(`/api/3d/products/${other.slug}?preview=${previewToken}`, undefined, false)).status, 404);
  assert.equal((await request(`/api/3d/assets/${master.id}?preview=${previewToken}`, undefined, false)).status, 404);
  assert.equal((await request(`/api/3d/assets/${reference.id}?preview=${previewToken}`, undefined, false)).status, 404);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 16 * 60 * 1000;
    assert.equal((await request(`/api/3d/products/${product.slug}?preview=${previewToken}`, undefined, false)).status, 404, 'the actual issued token expires after fifteen minutes');
  } finally { Date.now = realNow; }
  const previewAsset = await fetch(origin + previewManifest.body.manifest.modelUrl);
  assert.equal(previewAsset.status, 200);
  assert.equal(previewAsset.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(origin + '/api/products/all', { headers: { Authorization: `Bearer ${previewToken}` } })).status, 401);
  assert.equal((await request(`/api/admin/3d/versions/${version.id}/review`, { decision: 'approved' })).status, 200);
  assert.equal((await request(`/api/admin/3d/versions/${version.id}/review`, { decision: 'rejected' })).status, 409);
  assert.equal((await request(`/api/admin/3d/versions/${version.id}/publish`, {})).status, 200);
  const published = await request(`/api/3d/products/${product.slug}`, undefined, false);
  assert.equal(published.body.manifest.versionId, version.id);
  assert.equal(published.body.manifest.modelAssetId, undefined);
  assert.equal(published.body.manifest.masterAssetId, undefined);
  assert.equal(published.body.manifest.sourceRevision, undefined);
  assert.equal((await fetch(origin + published.body.manifest.modelUrl)).status, 200);
  assert.equal((await request(`/api/3d/assets/${master.id}`, undefined, false)).status, 404);
  const nextModel = (await upload(product.id, 'web_model', 'model-v2.glb', glb)).body.asset;
  const unusedModel = (await upload(product.id, 'web_model', 'unpublished.glb', glb)).body.asset;
  const next = (await request(`/api/admin/3d/products/${product.id}/versions`, { manifest: { ...manifest, modelAssetId: nextModel.id }, notes: 'Second model' })).body.version;
  await request(`/api/admin/3d/versions/${next.id}/review`, { decision: 'approved' });
  await request(`/api/admin/3d/versions/${next.id}/publish`, {});
  assert.equal((await request(`/api/3d/products/${product.slug}`, undefined, false)).body.manifest.versionId, next.id);
  assert.equal((await fetch(`${origin}/api/3d/assets/${model.id}`)).status, 200, 'previously published artifacts remain available to existing viewers');
  assert.equal((await request(`/api/3d/assets/${unusedModel.id}`, undefined, false)).status, 404);
  await request(`/api/admin/3d/versions/${version.id}/publish`, {});
  assert.equal((await request(`/api/3d/products/${product.slug}`, undefined, false)).body.manifest.versionId, version.id);
  const detail = (await request(`/api/admin/3d/products/${product.id}`)).body.product;
  assert.equal(detail.jobs[0].status, 'completed');
  assert.equal(detail.versions.length, 2);
  assert.equal(await db.product.count({ where: { slug: product.slug } }), 0, 'commerce Product is untouched');
});

integration('Keeri imports are idempotent, snapshot jobs, reject foreign variants and preserve published identity across source updates', async () => {
  const { threeDService } = await import('../src/modules/three-d/routes');
  const modelId = `source-${Date.now()}`;
  const source = { schemaVersion: 1, tenantId: 'tenant-a', modelId, name: 'Original source name', code: 'CHAIR', readyFor3D: true, sourceRevision: 'revision-1', variants: [{ variantId: 'v1', sku: 'CHAIR-1', attributes: { material: 'Oak' } }], references: [] };
  await assert.rejects(threeDService.importSource({ ...source, readyFor3D: false }, 'tenant-a'), { statusCode: 400 });
  await assert.rejects(threeDService.importSource(source, 'wrong-tenant'), { statusCode: 400 });
  const imports = await Promise.all([threeDService.importSource(source, 'tenant-a'), threeDService.importSource(source, 'tenant-a')]);
  assert.equal(imports[0].product.id, imports[1].product.id);
  const id = imports[0].product.id;
  assert.equal(await db.threeDImport.count({ where: { productId: id } }), 1);
  const jobResults = await Promise.all([threeDService.createJob(id, { recipeId: 'manual-blender', idempotencyKey: 'r1' }), threeDService.createJob(id, { recipeId: 'manual-blender', idempotencyKey: 'r1' })]);
  assert.equal(jobResults[0].id, jobResults[1].id);
  const job = jobResults[0];
  assert.equal((job.inputSnapshot as any).sourceRevision, 'revision-1');
  const gltf = Buffer.from('{"asset":{"version":"2.0"}} '.padEnd(28, ' '));
  const glb = Buffer.alloc(48); glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(48, 8); glb.writeUInt32LE(28, 12); glb.writeUInt32LE(0x4e4f534a, 16); gltf.copy(glb, 20);
  const model = await threeDService.uploadAsset(id, 'web_model', 'model.glb', glb);
  const image = await threeDService.uploadAsset(id, 'preview', 'angle.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=', 'base64'));
  const manifest = { schemaVersion: 1 as const, modelAssetId: model.id, angles: ['perspective', 'side', 'front', 'back'].map(label => ({ assetId: image.id, label })) as any, dimensionsMm: { width: 700, depth: 700, height: 800 }, viewerProfile: 'studio-v1' as const, materialSlots: { finish: [], fabric: [] }, finishes: [], fabrics: [], defaults: { finish: '', fabric: '' }, variantBindings: [{ variantId: 'v1', finish: '', fabric: '' }], disclaimer: 'Preview.' };
  await assert.rejects(threeDService.registerVersion(id, { jobId: job.id, manifest: { ...manifest, variantBindings: [{ variantId: 'some-other-design-variant', finish: '', fabric: '' }] } }), { statusCode: 400 });
  await assert.rejects(threeDService.registerVersion(id, { jobId: job.id, manifest: { ...manifest, variantBindings: [] } }), { statusCode: 400 });
  const completions = await Promise.allSettled([threeDService.registerVersion(id, { jobId: job.id, manifest }), threeDService.registerVersion(id, { jobId: job.id, manifest })]);
  assert.equal(completions.filter(r => r.status === 'fulfilled').length, 1);
  const version = (completions.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
  await threeDService.reviewVersion(version.id, 'approved', 'Reviewed', 'test@example.com');
  await threeDService.publishVersion(version.id, 'test@example.com');
  await threeDService.importSource({ ...source, name: 'Changed source name', sourceRevision: 'revision-2', variants: [{ variantId: 'v2', sku: 'CHAIR-2', attributes: {} }] }, 'tenant-a');
  assert.equal(await db.threeDImport.count({ where: { productId: id } }), 2);
  const fresh = await threeDService.product(id);
  assert.equal(fresh.sourceRevision, 'revision-2');
  assert.equal(fresh.publishedVersionId, version.id);
  assert.equal((fresh.jobs[0].inputSnapshot as any).sourceRevision, 'revision-1');
  const published = await request(`/api/3d/products/${fresh.slug}`, undefined, false);
  assert.equal(published.body.manifest.versionId, version.id);
  assert.equal(published.body.manifest.name, 'Original source name');
  assert.equal(version.sourceRevision, 'revision-1');
  await threeDService.importSource(source, 'tenant-a');
  const restored = await threeDService.product(id);
  assert.equal(restored.sourceRevision, 'revision-1');
  assert.equal(restored.name, 'Original source name');
  assert.equal(restored.publishedVersionId, version.id);
  assert.equal(restored.imports.length, 2, 'returning to a prior revision reuses its immutable snapshot');
  const restoredJob = await threeDService.createJob(id, { recipeId: 'manual-blender', idempotencyKey: 'restored-input' });
  assert.equal((restoredJob.inputSnapshot as any).sourceRevision, 'revision-1');
});

integration('reference import keeps verified private copies, preserves provenance and rolls back incomplete downloads', async () => {
  const { ThreeDService } = await import('../src/modules/three-d/service');
  const { LocalArtifactStorage } = await import('../src/modules/three-d/storage');
  const { KeeriConnector } = await import('../src/modules/three-d/connector');
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=', 'base64');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const connector = new KeeriConnector({ baseUrl: 'https://keeri.example', tenantId: 'tenant-ref', token: 'test-only-token', referenceOrigins: ['https://images.example'] }, async input => new URL(String(input)).pathname.includes('broken') ? new Response('unavailable', { status: 503 }) : new Response(bytes));
  const service = new ThreeDService(db, new LocalArtifactStorage(storageDirectory), connector);
  const source = { schemaVersion: 1, tenantId: 'tenant-ref', modelId: `ref-${Date.now()}`, name: 'Reference Chair', code: 'REF', sourceRevision: 'r1', readyFor3D: true, variants: [], references: [{ id: 'front', role: 'front', url: 'https://images.example/front.png', checksum, provenance: 'photograph' }, { id: 'generated', role: 'back', url: 'https://images.example/generated.png', checksum, provenance: 'generated' }] };
  const result = await service.importSource(source, 'tenant-ref');
  const product = await service.product(result.product.id);
  assert.equal(product.assets.length, 2);
  assert.ok(product.assets.every(asset => asset.kind === 'reference' && asset.sha256 === checksum));
  const snapshot = product.imports[0].snapshot as any;
  assert.equal(snapshot.references[1].provenance, 'generated');
  assert.equal(snapshot.storedReferences.length, 2);
  for (const asset of product.assets) assert.equal((await request(`/api/3d/assets/${asset.id}`, undefined, false)).status, 404);
  const filesBeforeFailure = (await readdir(storageDirectory)).length;
  await assert.rejects(service.importSource({ ...source, sourceRevision: 'r2', references: [source.references[0], { ...source.references[1], url: 'https://images.example/broken.png' }] }, 'tenant-ref'), { statusCode: 502 });
  assert.equal((await service.product(product.id)).sourceRevision, 'r1');
  assert.equal(await db.threeDImport.count({ where: { productId: product.id } }), 1);
  assert.equal((await readdir(storageDirectory)).length, filesBeforeFailure, 'failed downloads leave no partial files');
  await assert.rejects(service.importSource({ ...source, sourceRevision: 'r3', references: [{ ...source.references[0], checksum: '0'.repeat(64) }] }, 'tenant-ref'), { statusCode: 400 });
  assert.equal((await service.product(product.id)).sourceRevision, 'r1');
});

integration('bounded page sync records per-design failures and missing pages do not withdraw imported products', async () => {
  const { ThreeDService } = await import('../src/modules/three-d/service');
  const { LocalArtifactStorage } = await import('../src/modules/three-d/storage');
  const { KeeriConnector } = await import('../src/modules/three-d/connector');
  const modelId = `sync-${Date.now()}`;
  const source = { schemaVersion: 1, tenantId: 'tenant-sync', modelId, name: 'Synced chair', code: 'SYNC', sourceRevision: 'r1', readyFor3D: true, variants: [], references: [] };
  const connector = new KeeriConnector({ baseUrl: 'https://keeri.example', tenantId: 'tenant-sync', token: 'test-only-token', referenceOrigins: [] }, async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith(`/${modelId}`)) return Response.json(source);
    if (url.pathname.endsWith('/ineligible')) return Response.json({ ...source, modelId: 'ineligible', readyFor3D: false });
    return Response.json({ schemaVersion: 1, tenantId: 'tenant-sync', products: url.searchParams.has('cursor') ? [] : [source, { ...source, modelId: 'ineligible' }], nextCursor: url.searchParams.has('cursor') ? null : 'next-page' });
  });
  const service = new ThreeDService(db, new LocalArtifactStorage(storageDirectory), connector);
  const first = await service.sync();
  assert.equal(first.imported, 1);
  assert.equal(first.failed.length, 1);
  assert.equal(first.failed[0].modelId, 'ineligible');
  assert.equal(first.nextCursor, 'next-page');
  assert.equal((await service.sync()).unchanged, 1);
  assert.deepEqual(await service.sync('next-page'), { imported: 0, unchanged: 0, failed: [], nextCursor: null });
  const product = await db.threeDProduct.findUnique({ where: { sourceTenantId_sourceModelId: { sourceTenantId: 'tenant-sync', sourceModelId: modelId } } });
  assert.equal(product.sourceRevision, 'r1');
  assert.equal(await db.threeDImport.count({ where: { productId: product.id } }), 1);
});
