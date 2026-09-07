import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, type ThreeDImportBatch, type ThreeDImportItem } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { parse } from './validation';
import type { ThreeDService } from './service';

export const MAX_BATCH_BYTES = 500 * 1024 * 1024;
export const MAX_BATCH_RUNTIME_MS = 5 * 60 * 1000;
const LEASE_MS = 30_000;
export const ImportBatchInput = z.object({ idempotencyKey: z.string().trim().min(1).max(120), cursor: z.string().min(1).max(2000).optional() }).strict();
type BatchWithItems = ThreeDImportBatch & { items: ThreeDImportItem[] };
export type ImportClaim = { id: string; leaseToken: string; tenantId: string };
const includeItems = { items: { orderBy: { position: 'asc' as const } } };
const unrepeatable = new Set(['SOURCE_CHANGED', 'SOURCE_REJECTED', 'BATCH_BUDGET']);
class BatchFailure extends AppError {
  constructor(readonly code: string, message: string, status = 409) { super(status, message); }
}
function safeFailure(error: unknown) {
  if (error instanceof BatchFailure) return { errorCode: error.code, errorMessage: error.message };
  if (error instanceof AppError && [400, 409, 413].includes(error.statusCode)) return { errorCode: 'SOURCE_REJECTED', errorMessage: 'Keeri inputs failed approval, ownership, size or integrity validation. Correct the source and start a new scan.' };
  return { errorCode: 'IMPORT_FAILED', errorMessage: 'The import could not finish. Check the Keeri connection and worker, then retry failed items.' };
}
function dto(batch: BatchWithItems) {
  const counts = { total: batch.items.length, pending: 0, running: 0, imported: 0, unchanged: 0, failed: 0, cancelled: 0 };
  for (const item of batch.items) counts[item.status]++;
  const { id, tenantId, status, cursor, nextCursor, listLoadedAt, bytesReserved, attempts, errorCode, errorMessage, startedAt, completedAt, createdAt, updatedAt } = batch;
  return {
    id, tenantId, status, cursor, nextCursor, listLoadedAt, bytesReserved, maxBytes: MAX_BATCH_BYTES, attempts, errorCode, errorMessage, startedAt, completedAt, createdAt, updatedAt, counts,
    canCancel: status === 'queued' || status === 'running',
    canRetry: status === 'failed' && bytesReserved < MAX_BATCH_BYTES && (!listLoadedAt ? !unrepeatable.has(errorCode || '') : batch.items.some(item => item.status === 'failed' && !unrepeatable.has(item.errorCode || ''))),
    items: batch.items.map(({ id, modelId, name, code, sourceRevision, status, attempts, productId, errorCode, errorMessage, completedAt }) => ({ id, modelId, name, code, sourceRevision, status, attempts, productId, errorCode, errorMessage, completedAt })),
  };
}
export type ImportBatchDto = ReturnType<typeof dto>;

/** Durable one-page scans; only the separately supervised worker performs downloads. */
export class ThreeDImportBatches {
  constructor(readonly db: PrismaClient, private readonly service: Pick<ThreeDService, 'connector' | 'importSource'>) {}
  private connector() {
    if (!this.service.connector) throw new AppError(503, 'Keeri integration is not configured');
    return this.service.connector;
  }
  private async row(id: string) {
    const row = await this.db.threeDImportBatch.findFirst({ where: { id, tenantId: this.connector().config.tenantId }, include: includeItems });
    if (!row) throw new AppError(404, 'Import batch not found');
    return row;
  }
  async get(id: string) { return dto(await this.row(id)); }
  async list() { return (await this.db.threeDImportBatch.findMany({ where: { tenantId: this.connector().config.tenantId }, orderBy: { createdAt: 'desc' }, take: 20, include: includeItems })).map(dto); }
  async enqueue(input: unknown, requestedBy: string) {
    const tenantId = this.connector().config.tenantId;
    const data = parse(ImportBatchInput, input);
    const batch = await this.db.threeDImportBatch.upsert({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: data.idempotencyKey } }, create: { ...data, tenantId, requestedBy }, update: {}, include: includeItems });
    if (batch.cursor !== (data.cursor ?? null)) throw new AppError(409, 'Idempotency key already belongs to a different scan');
    return dto(batch);
  }
  private async locked(tx: Prisma.TransactionClient, id: string) {
    const tenantId = this.connector().config.tenantId;
    const rows = await tx.$queryRaw<ThreeDImportBatch[]>`SELECT * FROM "ThreeDImportBatch" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
    if (!rows[0]) throw new AppError(404, 'Import batch not found');
    return rows[0];
  }
  async cancel(id: string) {
    await this.db.$transaction(async tx => {
      const batch = await this.locked(tx, id);
      if (batch.status === 'cancelled') return;
      if (!['queued', 'running'].includes(batch.status)) throw new AppError(409, 'Only waiting or running scans can be cancelled');
      await tx.threeDImportItem.updateMany({ where: { batchId: id, status: { in: ['pending', 'running'] } }, data: { status: 'cancelled', completedAt: new Date() } });
      await tx.threeDImportBatch.update({ where: { id }, data: { status: 'cancelled', completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, attemptDeadline: null } });
    });
    return this.get(id);
  }
  async retry(id: string) {
    await this.db.$transaction(async tx => {
      await this.locked(tx, id);
      const batch = await tx.threeDImportBatch.findUniqueOrThrow({ where: { id }, include: includeItems });
      if (!dto(batch).canRetry) throw new AppError(409, 'This scan cannot be retried. Start a new scan with the current approved source.');
      await tx.threeDImportItem.updateMany({ where: { batchId: id, status: 'failed', OR: [{ errorCode: null }, { errorCode: { notIn: [...unrepeatable] } }] }, data: { status: 'pending', errorCode: null, errorMessage: null, completedAt: null } });
      await tx.threeDImportBatch.update({ where: { id }, data: { status: 'queued', errorCode: null, errorMessage: null, completedAt: null, leaseToken: null, leaseExpiresAt: null, attemptDeadline: null } });
    });
    return this.get(id);
  }
  async claim(): Promise<ImportClaim | null> {
    const tenantId = this.connector().config.tenantId;
    return this.db.$transaction(async tx => {
      // Serializes claims across worker processes, including recovery of an expired worker.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('maple-3d-import'), hashtext(${tenantId}))`;
      const now = new Date();
      const running = await tx.threeDImportBatch.findFirst({ where: { tenantId, status: 'running' }, orderBy: { createdAt: 'asc' } });
      if (running?.leaseExpiresAt && running.leaseExpiresAt > now && running.attemptDeadline && running.attemptDeadline > now) return null;
      const batch = running || await tx.threeDImportBatch.findFirst({ where: { tenantId, status: 'queued' }, orderBy: { createdAt: 'asc' } });
      if (!batch) return null;
      // Lock against concurrent cancellation/retry before installing a fresh fencing token.
      const current = await this.locked(tx, batch.id);
      if (!['queued', 'running'].includes(current.status)) return null;
      if (current.status === 'running' && current.leaseExpiresAt && current.leaseExpiresAt > new Date() && current.attemptDeadline && current.attemptDeadline > new Date()) return null;
      const leaseToken = randomUUID();
      await tx.threeDImportItem.updateMany({ where: { batchId: batch.id, status: 'running' }, data: { status: 'pending' } });
      await tx.threeDImportBatch.update({ where: { id: batch.id }, data: { status: 'running', leaseToken, leaseExpiresAt: new Date(Date.now() + LEASE_MS), attemptDeadline: new Date(Date.now() + MAX_BATCH_RUNTIME_MS), attempts: { increment: 1 }, startedAt: batch.startedAt || now, completedAt: null } });
      return { id: batch.id, tenantId, leaseToken };
    });
  }
  async beforeCommit(tx: Prisma.TransactionClient, claim: ImportClaim) {
    const row = await this.locked(tx, claim.id);
    if (row.tenantId !== claim.tenantId || row.status !== 'running' || row.leaseToken !== claim.leaseToken || !row.leaseExpiresAt || row.leaseExpiresAt <= new Date()) throw new BatchFailure('LEASE_LOST', 'This import worker no longer owns the scan');
    if (!row.attemptDeadline || row.attemptDeadline <= new Date()) throw new BatchFailure('TIME_LIMIT', 'The scan reached its five-minute attempt limit. Retry remaining items.');
    return row;
  }
  async reserveBytes(claim: ImportClaim, bytes: number) {
    await this.db.$transaction(async tx => {
      const batch = await this.beforeCommit(tx, claim);
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_BATCH_BYTES - batch.bytesReserved) throw new BatchFailure('BATCH_BUDGET', 'The scan reached its 500 MiB download budget. Start a new scan for remaining designs.', 413);
      await tx.threeDImportBatch.update({ where: { id: claim.id }, data: { bytesReserved: { increment: bytes } } });
    });
  }
  private async heartbeat(claim: ImportClaim) {
    const now = new Date();
    const result = await this.db.threeDImportBatch.updateMany({ where: { id: claim.id, tenantId: claim.tenantId, status: 'running', leaseToken: claim.leaseToken, leaseExpiresAt: { gt: now }, attemptDeadline: { gt: now } }, data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) } });
    return result.count === 1;
  }
  private async failAttempt(claim: ImportClaim, error: unknown) {
    await this.db.$transaction(async tx => {
      const row = await this.locked(tx, claim.id);
      if (row.status !== 'running' || row.leaseToken !== claim.leaseToken) return;
      if (error instanceof BatchFailure && error.code === 'WORKER_STOPPED') {
        await tx.threeDImportItem.updateMany({ where: { batchId: claim.id, status: 'running' }, data: { status: 'pending' } });
        await tx.threeDImportBatch.update({ where: { id: claim.id }, data: { status: 'queued', leaseToken: null, leaseExpiresAt: null, attemptDeadline: null } });
        return;
      }
      const failure = safeFailure(error);
      await tx.threeDImportItem.updateMany({ where: { batchId: claim.id, status: { in: ['pending', 'running'] } }, data: { status: 'failed', ...failure, completedAt: new Date() } });
      await tx.threeDImportBatch.update({ where: { id: claim.id }, data: { status: 'failed', ...failure, completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, attemptDeadline: null } });
    });
  }
  async runNext(stop?: AbortSignal) {
    if (stop?.aborted) return false;
    const connector = this.connector();
    const claim = await this.claim();
    if (!claim) return false;
    const abort = new AbortController();
    const onStop = () => abort.abort(new BatchFailure('WORKER_STOPPED', 'The worker is restarting; unfinished items remain queued'));
    stop?.addEventListener('abort', onStop, { once: true });
    if (stop?.aborted) onStop();
    const timeout = setTimeout(() => abort.abort(new BatchFailure('TIME_LIMIT', 'The scan reached its five-minute attempt limit. Retry remaining items.')), MAX_BATCH_RUNTIME_MS);
    let heartbeatRunning = false;
    const heartbeat = setInterval(async () => {
      if (heartbeatRunning) return;
      heartbeatRunning = true;
      try { if (!await this.heartbeat(claim)) abort.abort(new BatchFailure('LEASE_LOST', 'The import lease was lost or the scan was cancelled')); }
      catch { abort.abort(new BatchFailure('LEASE_LOST', 'The import worker could not renew its lease')); }
      finally { heartbeatRunning = false; }
    }, 5000);
    try {
      let batch = await this.row(claim.id);
      if (!batch.listLoadedAt) {
        const page = await connector.list(batch.cursor || undefined, abort.signal);
        if (page.products.length > 20) throw new BatchFailure('SOURCE_REJECTED', 'Keeri returned more than 20 designs in one page');
        await this.db.$transaction(async tx => {
          await this.beforeCommit(tx, claim);
          await tx.threeDImportItem.createMany({ data: page.products.map((item, position) => ({ batchId: batch.id, position, modelId: item.modelId, name: item.name, code: item.code, sourceRevision: item.sourceRevision })) });
          await tx.threeDImportBatch.update({ where: { id: batch.id }, data: { listLoadedAt: new Date(), nextCursor: page.nextCursor } });
        });
        batch = await this.row(claim.id);
      }
      for (const item of batch.items.filter(item => item.status === 'pending')) {
        abort.signal.throwIfAborted();
        await this.db.$transaction(async tx => {
          await this.beforeCommit(tx, claim);
          await tx.threeDImportItem.update({ where: { id: item.id }, data: { status: 'running', attempts: { increment: 1 }, errorCode: null, errorMessage: null } });
        });
        try {
          const source = await connector.detail(item.modelId, abort.signal);
          if (source.sourceRevision !== item.sourceRevision) throw new BatchFailure('SOURCE_CHANGED', 'The approved source changed after this scan was queued. Start a new scan.');
          await this.service.importSource(source, claim.tenantId, item.modelId, {
            signal: abort.signal,
            beforeReference: bytes => this.reserveBytes(claim, bytes),
            beforeCommit: async tx => { await this.beforeCommit(tx, claim); },
            afterImport: async (tx, result) => {
              // Keep progress atomic with the source records, including concurrent cancellation.
              await tx.threeDImportItem.update({ where: { id: item.id }, data: { status: result.unchanged ? 'unchanged' : 'imported', productId: result.product.id, completedAt: new Date() } });
            },
          });
        } catch (error) {
          if (abort.signal.aborted) throw abort.signal.reason;
          if (error instanceof BatchFailure && ['LEASE_LOST', 'TIME_LIMIT', 'BATCH_BUDGET'].includes(error.code)) throw error;
          await this.db.$transaction(async tx => {
            await this.beforeCommit(tx, claim);
            await tx.threeDImportItem.update({ where: { id: item.id }, data: { status: 'failed', ...safeFailure(error), completedAt: new Date() } });
          });
        }
      }
      await this.db.$transaction(async tx => {
        await this.beforeCommit(tx, claim);
        const failed = await tx.threeDImportItem.count({ where: { batchId: claim.id, status: 'failed' } });
        await tx.threeDImportBatch.update({ where: { id: claim.id }, data: { status: failed ? 'failed' : 'completed', errorCode: failed ? 'ITEMS_FAILED' : null, errorMessage: failed ? 'Some designs could not be imported. Review their results before retrying.' : null, completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, attemptDeadline: null } });
      });
    } catch (error) { await this.failAttempt(claim, error); }
    finally { clearInterval(heartbeat); clearTimeout(timeout); stop?.removeEventListener('abort', onStop); abort.abort(); }
    return true;
  }
}
