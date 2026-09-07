import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ThreeDImportBatches, MAX_BATCH_BYTES } from '../src/modules/three-d/import-batches';

const integration = process.env.THREE_D_TEST_DATABASE_URL ? test : test.skip;
let db: PrismaClient;
const tenants: string[] = [];
before(() => {
  if (!process.env.THREE_D_TEST_DATABASE_URL) return;
  const url = new URL(process.env.THREE_D_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/maple3d_test');
  db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
});
after(async () => {
  if (!db) return;
  await db.threeDImportBatch.deleteMany({ where: { tenantId: { in: tenants } } });
  await db.$disconnect();
});
function fixture() {
  const tenantId = `batch-test-${randomUUID()}`; tenants.push(tenantId);
  let fail = false, revision = 'r1', listCalls = 0;
  let onImport: ((source: any) => void) | undefined;
  const imported: string[] = [];
  const connector = {
    config: { tenantId },
    async list() { listCalls++; return { products: ['a', 'b'].map(modelId => ({ modelId, name: modelId, code: modelId, sourceRevision: 'r1' })), nextCursor: 'page-two' }; },
    async detail(modelId: string) { return { modelId, sourceRevision: revision }; },
  };
  const service = { connector, async importSource(source: any, _tenant: string, _model: string, context: any) {
    onImport?.(source);
    context.signal.throwIfAborted();
    await context.beforeReference(100);
    if (fail && source.modelId === 'b') throw new Error('Secret URL https://private.example/?token=hidden');
    await db.$transaction(async tx => { await context.beforeCommit(tx); await context.afterImport(tx, { product: { id: `product-${source.modelId}` }, unchanged: false }); imported.push(source.modelId); });
    return { product: { id: `product-${source.modelId}` }, unchanged: false };
  } };
  return { queue: new ThreeDImportBatches(db, service as any), tenantId, imported, setFail(value: boolean) { fail = value; }, setRevision(value: string) { revision = value; }, setOnImport(hook?: (source: any) => void) { onImport = hook; }, listCalls: () => listCalls };
}
integration('enqueue is durable and idempotent, worker imports one pinned page and exposes safe progress', async () => {
  const f = fixture();
  const batch = await f.queue.enqueue({ idempotencyKey: 'one' }, 'admin');
  assert.equal(batch.status, 'queued'); assert.equal(f.listCalls(), 0);
  assert.equal((await f.queue.enqueue({ idempotencyKey: 'one' }, 'admin')).id, batch.id);
  await assert.rejects(f.queue.enqueue({ idempotencyKey: 'one', cursor: 'different' }, 'admin'), { statusCode: 409 });
  assert.equal(await f.queue.runNext(), true);
  const result = await f.queue.get(batch.id);
  assert.equal(result.status, 'completed'); assert.equal(result.counts.imported, 2);
  assert.equal(result.bytesReserved, 200); assert.equal(result.nextCursor, 'page-two');
  assert.equal('leaseToken' in result, false); assert.equal('requestedBy' in result, false);
  assert.equal(await f.queue.runNext(), false);
});
integration('retry resumes only failed items and rejects a changed approved source instead of silently replacing it', async () => {
  const f = fixture(); f.setFail(true);
  const batch = await f.queue.enqueue({ idempotencyKey: 'retry' }, 'admin');
  await f.queue.runNext();
  let result = await f.queue.get(batch.id);
  assert.equal(result.status, 'failed'); assert.equal(result.counts.imported, 1); assert.equal(result.counts.failed, 1);
  assert.equal(JSON.stringify(result).includes('hidden'), false);
  f.setFail(false); f.setRevision('r2');
  await f.queue.retry(batch.id); await f.queue.runNext();
  result = await f.queue.get(batch.id);
  assert.equal(result.items.find(item => item.modelId === 'b')?.errorCode, 'SOURCE_CHANGED');
  assert.equal(result.canRetry, false); assert.equal(f.listCalls(), 1);
  assert.deepEqual(f.imported, ['a']);
  await assert.rejects(f.queue.retry(batch.id), { statusCode: 409 });
});
integration('concurrent workers serialize tenant claims and dead worker claims are fenced from committing', async () => {
  const f = fixture(); const batch = await f.queue.enqueue({ idempotencyKey: 'claim' }, 'admin');
  await f.queue.enqueue({ idempotencyKey: 'next' }, 'admin');
  const claims = await Promise.all([f.queue.claim(), f.queue.claim()]);
  assert.equal(claims.filter(Boolean).length, 1);
  const original = claims.find(Boolean)!;
  await db.threeDImportBatch.update({ where: { id: batch.id }, data: { leaseExpiresAt: new Date(0) } });
  const replacement = await f.queue.claim(); assert.equal(replacement?.id, batch.id);
  await assert.rejects(db.$transaction(tx => f.queue.beforeCommit(tx, original)), { statusCode: 409 });
  await db.$transaction(tx => f.queue.beforeCommit(tx, replacement!));
  await f.queue.cancel(batch.id);
  await assert.rejects(db.$transaction(tx => f.queue.beforeCommit(tx, replacement!)), { statusCode: 409 });
  assert.equal((await f.queue.get(batch.id)).status, 'cancelled');
  assert.ok(await f.queue.claim());
});
integration('batch download reservations remain bounded and cannot be bypassed by retries', async () => {
  const f = fixture(); const batch = await f.queue.enqueue({ idempotencyKey: 'budget' }, 'admin');
  const claim = (await f.queue.claim())!;
  await f.queue.reserveBytes(claim, MAX_BATCH_BYTES);
  await assert.rejects(f.queue.reserveBytes(claim, 1), { statusCode: 413 });
  assert.equal((await f.queue.get(batch.id)).bytesReserved, MAX_BATCH_BYTES);
  await f.queue.cancel(batch.id);
  await assert.rejects(f.queue.reserveBytes(claim, 1), { statusCode: 409 });
});

integration('a graceful worker restart keeps successful items and requeues only unfinished work', async () => {
  const f = fixture(); const batch = await f.queue.enqueue({ idempotencyKey: 'restart' }, 'admin');
  const stop = new AbortController();
  f.setOnImport(source => { if (source.modelId === 'b') stop.abort(); });
  await f.queue.runNext(stop.signal);
  let result = await f.queue.get(batch.id);
  assert.equal(result.status, 'queued'); assert.equal(result.counts.imported, 1); assert.equal(result.counts.pending, 1);
  f.setOnImport(); await f.queue.runNext(); result = await f.queue.get(batch.id);
  assert.equal(result.status, 'completed'); assert.deepEqual(f.imported, ['a', 'b']); assert.equal(f.listCalls(), 1);
});
integration('scan access and actions stay scoped to the currently configured Keeri tenant', async () => {
  const first = fixture(), other = fixture();
  const batch = await first.queue.enqueue({ idempotencyKey: 'tenant' }, 'admin');
  assert.equal((await other.queue.list()).length, 0);
  await assert.rejects(other.queue.get(batch.id), { statusCode: 404 });
  await assert.rejects(other.queue.retry(batch.id), { statusCode: 404 });
  await assert.rejects(other.queue.cancel(batch.id), { statusCode: 404 });
});

integration('the worker imports verified Keeri originals through the real source service and stores only private copies', async () => {
  const { mkdtemp, rm, readdir } = await import('node:fs/promises');
  const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const { KeeriConnector } = await import('../src/modules/three-d/connector');
  const { ThreeDService } = await import('../src/modules/three-d/service');
  const { LocalArtifactStorage } = await import('../src/modules/three-d/storage');
  const { makeSource, referencePng } = await import('./fixtures/three-d-source');
  const tenantId = `batch-test-${randomUUID()}`; tenants.push(tenantId);
  const source = makeSource({ tenantId, modelId: `batch-chair-${randomUUID()}` });
  const directory = await mkdtemp(join(tmpdir(), 'maple-batch-integration-'));
  let requests = 0;
  const connector = new KeeriConnector({ tenantId, baseUrl: 'https://keeri.example', token: 'private-fixture', referenceOrigins: ['https://images.example'] }, async input => {
    requests++;
    const url = new URL(String(input));
    if (url.hostname === 'images.example') return new Response(referencePng);
    return Response.json(url.pathname.endsWith(source.modelId) ? source : { schemaVersion: 2, tenantId, products: [{ modelId: source.modelId, name: source.name, code: source.code, sourceRevision: source.sourceRevision }], nextCursor: null });
  });
  const service = new ThreeDService(db, new LocalArtifactStorage(directory), connector);
  const queue = new ThreeDImportBatches(db, service);
  try {
    const batch = await queue.enqueue({ idempotencyKey: 'real-service' }, 'admin');
    assert.equal(requests, 0);
    await queue.runNext();
    const result = await queue.get(batch.id);
    assert.equal(result.status, 'completed'); assert.equal(result.counts.imported, 1); assert.equal(result.bytesReserved, referencePng.length * 4);
    const product = await service.product(result.items[0].productId!);
    assert.equal(product.publishedVersionId, null);
    assert.equal(product.assets.length, 4); assert.equal((await readdir(directory)).length, 4);
    assert.equal(JSON.stringify(product.imports[0].snapshot).includes('https://'), false);
    // Cancel exactly after the source transaction returns, before worker continuation.
    let cancelId = '';
    const cancellingService = { connector, async importSource(...args: Parameters<ThreeDService['importSource']>) {
      const result = await service.importSource(...args);
      await cancellingQueue.cancel(cancelId);
      return result;
    } };
    const cancellingQueue = new ThreeDImportBatches(db, cancellingService);
    cancelId = (await cancellingQueue.enqueue({ idempotencyKey: 'cancel-after-commit' }, 'admin')).id;
    await cancellingQueue.runNext();
    const cancelled = await cancellingQueue.get(cancelId);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.counts.unchanged, 1, 'cancellation must retain an already committed import outcome');
    assert.equal(cancelled.counts.cancelled, 0);

  } finally {
    const products = await db.threeDProduct.findMany({ where: { sourceTenantId: tenantId }, select: { id: true } });
    const ids = products.map(product => product.id);
    await db.threeDImport.deleteMany({ where: { productId: { in: ids } } });
    await db.threeDAsset.deleteMany({ where: { productId: { in: ids } } });
    await db.threeDProduct.deleteMany({ where: { id: { in: ids } } });
    await rm(directory, { recursive: true, force: true });
  }
});

integration('admin HTTP actions persist queued scans without contacting Keeri and require an admin session', async () => {
  const tenantId = `batch-http-${randomUUID()}`; tenants.push(tenantId);
  process.env.DOTENV_CONFIG_PATH = '/dev/null'; process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.THREE_D_TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'maple-batch-http-fixture-secret-over32';
  process.env.ADMIN_EMAIL = 'batch-fixture@example.com'; process.env.ADMIN_PASSWORD_HASH = '$2b$10$unused-fixture-placeholder';
  process.env.KEERI_3D_API_URL = 'https://keeri-not-connected.example';
  process.env.KEERI_3D_TOKEN = 'fixture-only-never-requested'; process.env.KEERI_3D_TENANT_ID = tenantId;
  const { createApp } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  const jwt = (await import('jsonwebtoken')).default;
  const token = jwt.sign({ sub: process.env.ADMIN_EMAIL }, process.env.JWT_SECRET);
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}/api/admin/3d`;
  async function request(path: string, body?: unknown, auth = true) {
    const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() as any };
  }
  try {
    assert.equal((await request('/keeri/import-batches', { idempotencyKey: 'unauthenticated' }, false)).status, 401);
    const queued = await request('/keeri/import-batches', { idempotencyKey: 'http' });
    assert.equal(queued.status, 202); assert.equal(queued.data.batch.status, 'queued');
    assert.equal(queued.data.batch.listLoadedAt, null); assert.equal(queued.data.batch.attempts, 0);
    assert.equal((await request('/keeri/import-batches')).data.batches.length, 1);
    assert.equal((await request(`/keeri/import-batches/${queued.data.batch.id}`)).data.batch.id, queued.data.batch.id);
    assert.equal((await request(`/keeri/import-batches/${queued.data.batch.id}/cancel`, {})).data.batch.status, 'cancelled');
    assert.equal((await request(`/keeri/import-batches/${queued.data.batch.id}/retry`, {})).status, 409);
    const compatible = await request('/keeri/sync', {});
    assert.equal(compatible.status, 202); assert.equal(compatible.data.batch.status, 'queued');
    const config = (await request('/config')).data;
    assert.equal(config.inputSchemaVersion, 2); assert.equal(config.importLimits.bytesPerBatch, MAX_BATCH_BYTES);
    assert.equal(JSON.stringify(config).includes('fixture-only'), false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
