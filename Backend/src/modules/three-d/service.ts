import { createHash } from 'node:crypto';
import { Prisma, PrismaClient, type ThreeDAsset, type ThreeDProduct } from '@prisma/client';
import { AppError } from '../../lib/errors';
import { requireRecipe } from './recipes';
import { type ArtifactStorage, validateArtifact, modelMaterialNames } from './storage';
import { type AssetKind, type ManifestInput, manifestAssetIds, ManifestSchema, parse, parseSource } from './validation';
import { KeeriConnector } from './connector';
import { parseStoredSource, type SourceInput } from './source-contract';

export const assetSelect = { id: true, productId: true, kind: true, filename: true, contentType: true, sizeBytes: true, sha256: true, createdAt: true } as const;
type Transaction = Prisma.TransactionClient;
export type ImportContext = {
  signal?: AbortSignal;
  beforeReference?: (sizeBytes: number) => Promise<void>;
  beforeCommit?: (tx: Transaction) => Promise<void>;
  afterImport?: (tx: Transaction, result: { product: ThreeDProduct; unchanged: boolean }) => Promise<void>;
};
export const IMPORT_LIMITS = { referencesPerDesign: 24, bytesPerDesign: 200 * 1024 * 1024 } as const;
function oneGeometry(source: Pick<SourceInput, 'geometryGroups'>) {
  if (source.geometryGroups.length !== 1) throw new AppError(400, 'This Maple pilot requires one geometry group per design. Separate different sizes or constructions before importing.');
  return source.geometryGroups[0];
}
function approvedSnapshot(input: unknown, tenantId: string, modelId: string) {
  if (!input || typeof input !== 'object' || !('schemaVersion' in input) || input.schemaVersion !== 2) throw new AppError(409, 'Legacy Keeri input: reimport approved inputs before starting production or saving another version');
  return parseStoredSource(input, tenantId, modelId);
}
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const missing = () => new AppError(404, '3D product or version not found');
export class ThreeDService {
  constructor(readonly db: PrismaClient, readonly storage: ArtifactStorage, readonly connector?: KeeriConnector) {}
  private async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 3) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'This record already exists');
        throw error;
      }
    }
  }
  async product(id: string) {
    const product = await this.db.threeDProduct.findUnique({ where: { id }, include: {
      versions: { orderBy: { sequence: 'desc' } }, jobs: { orderBy: { createdAt: 'desc' } },
      assets: { select: assetSelect, orderBy: { createdAt: 'desc' } }, imports: { orderBy: { createdAt: 'desc' } },
      publications: { orderBy: { createdAt: 'desc' }, take: 50 },
    } });
    if (!product) throw missing();
    return product;
  }
  listProducts() { return this.db.threeDProduct.findMany({ orderBy: { updatedAt: 'desc' }, include: { _count: { select: { versions: true, jobs: true, assets: true } } } }); }
  async createProduct(data: { slug: string; name: string }) {
    return this.transaction(tx => tx.threeDProduct.create({ data }));
  }
  private async activateSource(tx: Transaction, product: ThreeDProduct, source: { sourceRevision: string; name: string }) {
    if (product.sourceRevision === source.sourceRevision) return { product, unchanged: true };
    const updated = await tx.threeDProduct.update({ where: { id: product.id }, data: { name: source.name, sourceRevision: source.sourceRevision } });
    return { product: updated, unchanged: false };
  }
  async importSource(input: unknown, tenantId: string, modelId?: string, context: ImportContext = {}) {
    context.signal?.throwIfAborted();
    const source = parseSource(input, tenantId, modelId);
    oneGeometry(source);
    if (source.references.length > IMPORT_LIMITS.referencesPerDesign) throw new AppError(400, 'The current import profile accepts at most 24 references per design');
    if (source.references.reduce((sum, ref) => sum + ref.sizeBytes, 0) > IMPORT_LIMITS.bytesPerDesign) throw new AppError(400, 'The current import profile accepts at most 200 MiB of originals per design');
    const finish = async <T extends { product: ThreeDProduct; unchanged: boolean }>(tx: Transaction, result: T): Promise<T> => {
      await context.afterImport?.(tx, result);
      return result;
    };
    const existing = await this.db.threeDProduct.findUnique({ where: { sourceTenantId_sourceModelId: { sourceTenantId: tenantId, sourceModelId: source.modelId } }, include: { imports: { where: { sourceRevision: source.sourceRevision }, take: 1 } } });
    if (existing?.imports.length) return this.transaction(async tx => {
      context.signal?.throwIfAborted();
      await context.beforeCommit?.(tx);
      const current = await tx.threeDProduct.findUniqueOrThrow({ where: { id: existing.id } });
      return finish(tx, await this.activateSource(tx, current, source));
    });
    const downloads: { referenceId: string; filename: string; storageKey: string; contentType: string; sizeBytes: number; sha256: string }[] = [];
    try {
      for (const reference of source.references) {
        context.signal?.throwIfAborted();
        if (!this.connector) throw new AppError(503, 'Keeri reference download is not configured');
        await context.beforeReference?.(reference.sizeBytes);
        const bytes = await this.connector.reference(reference, context.signal);
        const metadata = validateArtifact('reference', bytes);
        if (metadata.sha256 !== reference.checksum.replace(/^sha256:/, '').toLowerCase()) throw new AppError(400, 'Keeri reference checksum does not match its bytes');
        const storageKey = await this.storage.put(bytes);
        downloads.push({ referenceId: reference.id, filename: `keeri-${reference.id}`.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180), storageKey, ...metadata });
      }
      const result = await this.transaction(async tx => {
        context.signal?.throwIfAborted();
        await context.beforeCommit?.(tx);
        let product = await tx.threeDProduct.findUnique({ where: { sourceTenantId_sourceModelId: { sourceTenantId: tenantId, sourceModelId: source.modelId } } });
        if (product) {
          const found = await tx.threeDImport.findUnique({ where: { productId_sourceRevision: { productId: product.id, sourceRevision: source.sourceRevision } } });
          if (found) return finish(tx, { ...await this.activateSource(tx, product, source), reused: true });
        } else {
          const base = (source.code || source.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'design';
          const suffix = createHash('sha256').update(`${tenantId}\0${source.modelId}`).digest('hex').slice(0, 12);
          product = await tx.threeDProduct.create({ data: { slug: `${base}-${suffix}`, name: source.name, sourceType: 'keeri', sourceTenantId: tenantId, sourceModelId: source.modelId } });
        }
        const storedReferences = [];
        for (const { referenceId, ...data } of downloads) {
          const asset = await tx.threeDAsset.create({ data: { productId: product.id, kind: 'reference', ...data } });
          storedReferences.push({ referenceId, assetId: asset.id, sha256: asset.sha256 });
        }
        const references = source.references.map(({ url: _url, ...evidence }) => evidence);
        await tx.threeDImport.create({ data: { productId: product.id, sourceRevision: source.sourceRevision, snapshot: asJson({ ...source, references, storedReferences }) } });
        product = await tx.threeDProduct.update({ where: { id: product.id }, data: { name: source.name, sourceRevision: source.sourceRevision } });
        return finish(tx, { product, unchanged: false, reused: false });
      });
      if (result.reused) await Promise.all(downloads.map(d => this.storage.remove(d.storageKey)));
      return result;
    } catch (error) { await Promise.all(downloads.map(d => this.storage.remove(d.storageKey))); throw error; }
  }
  async createJob(productId: string, data: { recipeId: string; idempotencyKey: string }) {
    const recipe = requireRecipe(data.recipeId);
    return this.transaction(async tx => {
      const product = await tx.threeDProduct.findUnique({ where: { id: productId } });
      if (!product) throw missing();
      const existing = await tx.threeDJob.findUnique({ where: { productId_idempotencyKey: { productId, idempotencyKey: data.idempotencyKey } } });
      if (existing) {
        if (existing.recipeId !== recipe.id) throw new AppError(409, 'Idempotency key already belongs to a different recipe');
        if (product.sourceType === 'keeri') oneGeometry(approvedSnapshot(existing.inputSnapshot, product.sourceTenantId!, product.sourceModelId!));
        return existing;
      }
      const sourceImport = product.sourceRevision ? await tx.threeDImport.findUnique({ where: { productId_sourceRevision: { productId, sourceRevision: product.sourceRevision } } }) : null;
      if (product.sourceType === 'keeri' && !sourceImport) throw new AppError(409, 'Import the design inputs before creating a job');
      const geometryGroupId = product.sourceType === 'keeri' ? oneGeometry(approvedSnapshot(sourceImport?.snapshot, product.sourceTenantId!, product.sourceModelId!)).id : null;
      const references = sourceImport ? [] : await tx.threeDAsset.findMany({ where: { productId, kind: 'reference' }, select: assetSelect });
      return tx.threeDJob.create({ data: { productId, ...data, recipeVersion: recipe.version, geometryGroupId, importId: sourceImport?.id, inputSnapshot: sourceImport?.snapshot ?? asJson({ schemaVersion: 1, sourceType: 'manual', productId, name: product.name, slug: product.slug, references }) } });
    });
  }
  async uploadAsset(productId: string, kind: AssetKind, filename: string, bytes: Buffer) {
    if (!await this.db.threeDProduct.findUnique({ where: { id: productId }, select: { id: true } })) throw missing();
    const metadata = validateArtifact(kind, bytes);
    const storageKey = await this.storage.put(bytes);
    try { return await this.db.threeDAsset.create({ data: { productId, kind, filename: filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'artifact', storageKey, ...metadata }, select: assetSelect }); }
    catch (error) { await this.storage.remove(storageKey); throw error; }
  }
  private async checkAssets(tx: Transaction, productId: string, manifest: ManifestInput, masterAssetId?: string | null) {
    const ids = [...new Set([...manifestAssetIds(manifest), ...(masterAssetId ? [masterAssetId] : [])])];
    const assets = await tx.threeDAsset.findMany({ where: { id: { in: ids }, productId } });
    if (assets.length !== ids.length) throw new AppError(400, 'Every version artifact must belong to this product');
    if (masterAssetId && assets.find(asset => asset.id === masterAssetId)?.kind !== 'blender_master') throw new AppError(400, 'The source master must be a blender_master artifact');
    if (assets.find(a => a.id === manifest.modelAssetId)?.kind !== 'web_model') throw new AppError(400, 'The model must be a GLB web_model artifact');
    if (manifest.angles.some(angle => assets.find(a => a.id === angle.assetId)?.kind !== 'preview')) throw new AppError(400, 'Every angle must use a preview image artifact');
    const slots = [...manifest.materialSlots.finish, ...manifest.materialSlots.fabric];
    if (slots.length) {
      const names = modelMaterialNames(await this.checkedBytes(assets.find(a => a.id === manifest.modelAssetId)!));
      if (slots.some(slot => !names.includes(slot))) throw new AppError(400, 'A named material slot is missing from the uploaded GLB');
    }
    return assets;
  }
  async registerVersion(productId: string, input: { jobId?: string; masterAssetId?: string; manifest: ManifestInput; notes?: string }) {
    const manifest = parse(ManifestSchema, input.manifest);
    return this.transaction(async tx => {
      const product = await tx.threeDProduct.findUnique({ where: { id: productId } });
      if (!product) throw missing();
      let source: unknown;
      let geometryGroupId: string | null = null;
      if (input.jobId) {
        const job = await tx.threeDJob.findUnique({ where: { id: input.jobId } });
        if (!job || job.productId !== productId) throw new AppError(400, 'Job must belong to this product');
        if (job.status !== 'awaiting_delivery') throw new AppError(409, 'This job already has an immutable output version');
        source = job.inputSnapshot;
      } else if (product.sourceRevision) {
        source = (await tx.threeDImport.findUnique({ where: { productId_sourceRevision: { productId, sourceRevision: product.sourceRevision } } }))?.snapshot;
      }
      if (product.sourceType === 'keeri') {
        const snapshot = approvedSnapshot(source, product.sourceTenantId!, product.sourceModelId!);
        const geometry = oneGeometry(snapshot);
        geometryGroupId = geometry.id;
        if (['width', 'depth', 'height'].some(axis => manifest.dimensionsMm[axis as keyof typeof manifest.dimensionsMm] !== geometry.dimensionsMm[axis as keyof typeof manifest.dimensionsMm])) throw new AppError(400, 'Version dimensions must match the approved geometry measurements');
        const variantIds = new Set(snapshot.variants.map(v => v.variantId));
        if (variantIds.size && !manifest.variantBindings.length) throw new AppError(400, 'Keeri versions must bind at least one source variant');
        if (manifest.variantBindings.some(b => !variantIds.has(b.variantId))) throw new AppError(400, 'Variant binding does not belong to the job source snapshot');
      }
      await this.checkAssets(tx, productId, manifest, input.masterAssetId);
      const last = await tx.threeDVersion.aggregate({ where: { productId }, _max: { sequence: true } });
      const sourceRevision = source && typeof source === 'object' && 'sourceRevision' in source && typeof source.sourceRevision === 'string' ? source.sourceRevision : null;
      const productName = source && typeof source === 'object' && 'name' in source && typeof source.name === 'string' ? source.name : product.name;
      const version = await tx.threeDVersion.create({ data: { productId, productName, sourceRevision, geometryGroupId, masterAssetId: input.masterAssetId, sequence: (last._max.sequence || 0) + 1, jobId: input.jobId, manifest: asJson(manifest), notes: input.notes || '' } });
      if (input.jobId) await tx.threeDJob.update({ where: { id: input.jobId }, data: { status: 'completed', completedAt: new Date() } });
      return version;
    });
  }
  async reviewVersion(id: string, decision: 'approved' | 'rejected', notes: string | undefined, actor: string) {
    return this.transaction(async tx => {
      const version = await tx.threeDVersion.findUnique({ where: { id } });
      if (!version) throw missing();
      if (version.status !== 'draft') throw new AppError(409, 'This version has already been reviewed; create a new version for changes');
      if (decision === 'approved') await this.checkAssets(tx, version.productId, parse(ManifestSchema, version.manifest), version.masterAssetId);
      return tx.threeDVersion.update({ where: { id }, data: { status: decision, reviewNotes: notes || '', reviewedAt: new Date(), reviewedBy: actor } });
    });
  }
  async publishVersion(id: string, actor: string) {
    return this.transaction(async tx => {
      const version = await tx.threeDVersion.findUnique({ where: { id } });
      if (!version) throw missing();
      if (version.status !== 'approved') throw new AppError(409, 'Only an approved version can be published');
      const assets = await this.checkAssets(tx, version.productId, parse(ManifestSchema, version.manifest), version.masterAssetId);
      for (const asset of assets) await this.checkedBytes(asset);
      const product = await tx.threeDProduct.findUniqueOrThrow({ where: { id: version.productId } });
      if (product.publishedVersionId === id) return product;
      await tx.threeDPublication.create({ data: { productId: product.id, versionId: id, previousVersionId: product.publishedVersionId, publishedBy: actor } });
      return tx.threeDProduct.update({ where: { id: product.id }, data: { publishedVersionId: id } });
    });
  }
  async checkedBytes(asset: ThreeDAsset) {
    const bytes = await this.storage.read(asset.storageKey);
    if (bytes.length !== asset.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new AppError(409, 'Artifact integrity check failed');
    return bytes;
  }
}
