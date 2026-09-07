import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ThreeDService } from '../src/modules/three-d/service';
import { LocalArtifactStorage } from '../src/modules/three-d/storage';
import { KeeriConnector } from '../src/modules/three-d/connector';
import { AppError } from '../src/lib/errors';
import { makeSource, reapproveSource, referencePng } from './fixtures/three-d-source';

const integration = process.env.THREE_D_TEST_DATABASE_URL ? test : test.skip;
let db: PrismaClient;
let directory: string;
let downloads = 0;
let service: ThreeDService;
before(async () => {
  if (!process.env.THREE_D_TEST_DATABASE_URL) return;
  const url = new URL(process.env.THREE_D_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/maple3d_test');
  db = new PrismaClient({ datasources: { db: { url: url.href } } });
  directory = await mkdtemp(join(tmpdir(), 'maple-approved-inputs-'));
  const connector = new KeeriConnector({ baseUrl: 'https://keeri.example', tenantId: 'tenant-a', token: 'fixture-only', referenceOrigins: ['https://images.example'] }, async () => { downloads++; return new Response(referencePng); });
  service = new ThreeDService(db, new LocalArtifactStorage(directory), connector);
});
after(async () => { await db?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });
const source = () => makeSource({ modelId: `approved-${crypto.randomUUID()}` });

integration('imports retain approved evidence and private identities but never persist expiring access URLs', async () => {
  const input = source();
  const result = await service.importSource(input, 'tenant-a');
  const detail = await service.product(result.product.id);
  const snapshot = detail.imports[0].snapshot as any;
  assert.deepEqual(snapshot.approval, input.approval);
  assert.deepEqual(snapshot.geometryGroups, input.geometryGroups);
  assert.equal(snapshot.references[0].variantId, 'variant-oak');
  assert.equal(snapshot.storedReferences.length, 4);
  assert.ok(snapshot.references.every((ref: any) => !('url' in ref)));
  const job = await service.createJob(result.product.id, { recipeId: 'manual-blender', idempotencyKey: 'approved-job' });
  assert.equal(job.geometryGroupId, 'geometry-standard');
  assert.deepEqual(job.inputSnapshot, snapshot);
  const before = downloads;
  await service.importSource({ ...input, references: input.references.map(r => ({ ...r, url: `${r.url}?renewed=yes` })) }, 'tenant-a');
  assert.equal(downloads, before, 'renewed access must not copy the same immutable originals again');
});

integration('mixed construction groups fail before any reference download', async () => {
  const input = source();
  input.geometryGroups.push({ ...input.geometryGroups[0], id: 'wide', captureSetId: 'wide-capture', dimensionsMm: { width: 900, depth: 700, height: 800 } });
  input.references.push(...input.references.map(ref => ({ ...ref, id: `${ref.id}-wide`, geometryGroupId: 'wide', captureSetId: 'wide-capture', variantId: null })));
  const before = downloads;
  await assert.rejects(service.importSource(reapproveSource(input), 'tenant-a'), /one geometry group/i);
  assert.equal(downloads, before);
});

integration('aggregate reference budgets reject oversized designs before network or storage work', async () => {
  const input = source();
  input.references = Array.from({ length: 5 }, (_, i) => ({ ...input.references[i % 4], id: `large-${i}`, sizeBytes: 50 * 1024 * 1024 }));
  const before = downloads;
  await assert.rejects(service.importSource(reapproveSource(input), 'tenant-a'), /200 MiB/);
  assert.equal(downloads, before);
});

integration('cancellation or lost lease at commit rolls back source records and staged files', async () => {
  const input = source();
  const filesBefore = (await readdir(directory)).length;
  const reservations: number[] = [];
  await assert.rejects(service.importSource(input, 'tenant-a', input.modelId, {
    beforeReference: async bytes => { reservations.push(bytes); },
    beforeCommit: async () => { throw new AppError(409, 'Import lease lost'); },
  }), /Import lease lost/);
  assert.deepEqual(reservations, [68, 68, 68, 68]);
  assert.equal(await db.threeDProduct.count({ where: { sourceModelId: input.modelId } }), 0);
  assert.equal((await readdir(directory)).length, filesBefore);
});

integration('output versions cannot change approved dimensions and retain their geometry lineage', async () => {
  const input = source();
  const { product } = await service.importSource(input, 'tenant-a');
  const job = await service.createJob(product.id, { recipeId: 'manual-blender', idempotencyKey: 'dimensions' });
  const json = Buffer.from('{"asset":{"version":"2.0"}} '.padEnd(28, ' '));
  const glb = Buffer.alloc(48); glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(48, 8); glb.writeUInt32LE(28, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  const model = await service.uploadAsset(product.id, 'web_model', 'model.glb', glb);
  const preview = await service.uploadAsset(product.id, 'preview', 'view.png', referencePng);
  const manifest = { schemaVersion: 1 as const, modelAssetId: model.id, angles: ['perspective', 'side', 'front', 'back'].map(label => ({ assetId: preview.id, label })) as any, dimensionsMm: { width: 700, depth: 700, height: 800 }, viewerProfile: 'studio-v1' as const, materialSlots: { finish: [], fabric: [] }, finishes: [], fabrics: [], defaults: { finish: '', fabric: '' }, variantBindings: [{ variantId: 'variant-oak', finish: '', fabric: '' }], disclaimer: 'Test fixture.' };
  await assert.rejects(service.registerVersion(product.id, { jobId: job.id, manifest: { ...manifest, dimensionsMm: { width: 900, depth: 700, height: 800 } } }), /approved geometry/i);
  const version = await service.registerVersion(product.id, { jobId: job.id, manifest });
  assert.equal(version.geometryGroupId, 'geometry-standard');
  assert.equal(version.sourceRevision, input.sourceRevision);
});

integration('legacy Keeri snapshots cannot start new production jobs', async () => {
  const id = `legacy-${crypto.randomUUID()}`;
  const product = await db.threeDProduct.create({ data: { name: 'Legacy fixture', slug: id, sourceType: 'keeri', sourceTenantId: 'tenant-a', sourceModelId: id, sourceRevision: 'legacy-r1', imports: { create: { sourceRevision: 'legacy-r1', snapshot: { schemaVersion: 1, sourceRevision: 'legacy-r1' } } } } });
  await assert.rejects(service.createJob(product.id, { recipeId: 'manual-blender', idempotencyKey: 'legacy' }), /reimport approved/i);
});

integration('batch item acknowledgement and source activation commit atomically', async () => {
  const input = source();
  const filesBefore = (await readdir(directory)).length;
  await assert.rejects(service.importSource(input, 'tenant-a', input.modelId, {
    afterImport: async (tx, result) => {
      assert.equal(await tx.threeDImport.count({ where: { productId: result.product.id } }), 1);
      throw new AppError(409, 'Batch item update failed');
    },
  }), /Batch item update failed/);
  assert.equal(await db.threeDProduct.count({ where: { sourceModelId: input.modelId } }), 0);
  assert.equal((await readdir(directory)).length, filesBefore);
});
