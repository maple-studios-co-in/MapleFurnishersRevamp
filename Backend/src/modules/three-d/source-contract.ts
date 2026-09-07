import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../lib/errors';

const Id = z.string().min(1).max(200).refine(value => value.trim() === value, 'IDs must not have surrounding whitespace');
const Name = z.string().min(1).max(120).refine(value => value.trim().length > 0, 'A name is required');
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, 'Use a lowercase SHA-256 digest');
const Millimetres = z.number().positive().max(100000);
export const SourceDimensions = z.object({ width: Millimetres, depth: Millimetres, height: Millimetres, seatHeight: Millimetres.optional(), armHeight: Millimetres.optional() }).strict();
const GeometryGroup = z.object({
  id: Id, dimensionsMm: SourceDimensions, captureSetId: Id,
  measurement: z.object({ method: z.string().min(1).max(1000).refine(value => value.trim().length > 0, 'Describe how the dimensions were verified'), verifiedAt: z.iso.datetime({ offset: true }), verifiedBy: Id }).strict(),
}).strict();
const Variant = z.object({
  variantId: Id, sku: z.string().min(1).max(200), geometryGroupId: Id,
  attributes: z.record(z.string().min(1).max(120), z.string().min(1).max(200)).refine(value => Object.keys(value).length <= 100, 'At most 100 attributes are allowed'),
  dimensionsMm: SourceDimensions.optional(),
}).strict();
const Reference = z.object({
  id: Id, role: z.enum(['front', 'side', 'back', 'angle', 'detail', 'dimension']), geometryGroupId: Id, captureSetId: Id, variantId: Id.nullable(),
  url: z.url().refine(value => new URL(value).protocol === 'https:', 'Reference downloads must use HTTPS'),
  checksum: Sha256, sizeBytes: z.number().int().positive().max(50 * 1024 * 1024), provenance: z.enum(['photograph', 'generated', 'unknown']),
}).strict();
const SourceBody = z.object({
  schemaVersion: z.literal(2), tenantId: Id, modelId: Id, name: Name, code: z.string().max(120), readyFor3D: z.literal(true), sourceRevision: Sha256,
  approval: z.object({ revision: Sha256, approvedAt: z.iso.datetime({ offset: true }), approvedBy: Id }).strict(),
  geometryGroups: z.array(GeometryGroup).min(1).max(100), variants: z.array(Variant).max(5000), references: z.array(Reference).min(4).max(100),
}).strict();
type SourceBodyValue = z.infer<typeof SourceBody>;
export type SourceRevisionInput = Omit<SourceBodyValue, 'approval' | 'readyFor3D' | 'sourceRevision' | 'references'> & {
  references: Array<Omit<SourceBodyValue['references'][number], 'url'> & { url?: string }>;
};
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => compare(a, b)).map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
export function computeSourceRevision(source: SourceRevisionInput): string {
  const content = {
    schemaVersion: source.schemaVersion, tenantId: source.tenantId, modelId: source.modelId, name: source.name, code: source.code,
    geometryGroups: [...source.geometryGroups].sort((a, b) => compare(a.id, b.id)),
    variants: [...source.variants].sort((a, b) => compare(a.variantId, b.variantId)),
    references: source.references.map(({ url: _url, ...reference }) => reference).sort((a, b) => compare(a.id, b.id)),
  };
  return createHash('sha256').update(canonicalJson(content), 'utf8').digest('hex');
}
function validateSource(source: SourceRevisionInput & Pick<SourceBodyValue, 'sourceRevision' | 'approval'>, ctx: z.RefinementCtx): void {
  const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  for (const [field, ids] of [
    ['geometryGroups', source.geometryGroups.map(group => group.id)],
    ['variants', source.variants.map(variant => variant.variantId)],
    ['references', source.references.map(reference => reference.id)],
  ] as const) if (new Set(ids).size !== ids.length) fail([field], `Duplicate IDs in ${field}`);
  const groups = new Map(source.geometryGroups.map(group => [group.id, group]));
  const variants = new Map(source.variants.map(variant => [variant.variantId, variant]));
  source.variants.forEach((variant, index) => {
    const group = groups.get(variant.geometryGroupId);
    if (!group) fail(['variants', index, 'geometryGroupId'], 'Variant geometry group does not belong to this design');
    else if (variant.dimensionsMm && canonicalJson(variant.dimensionsMm) !== canonicalJson(group.dimensionsMm)) {
      fail(['variants', index, 'dimensionsMm'], 'Different variant dimensions require a separate geometry group');
    }
  });
  source.references.forEach((reference, index) => {
    const group = groups.get(reference.geometryGroupId);
    if (!group) fail(['references', index, 'geometryGroupId'], 'Reference geometry group does not belong to this design');
    else if (reference.captureSetId !== group.captureSetId) fail(['references', index, 'captureSetId'], 'Reference capture set does not match its geometry group');
    if (reference.variantId !== null) {
      const variant = variants.get(reference.variantId);
      if (!variant || variant.geometryGroupId !== reference.geometryGroupId) fail(['references', index, 'variantId'], 'Reference variant must belong to its geometry group');
    }
  });
  source.geometryGroups.forEach((group, index) => {
    const photographed = new Set(source.references.filter(reference => reference.geometryGroupId === group.id && reference.captureSetId === group.captureSetId && reference.provenance === 'photograph').map(reference => reference.role));
    for (const role of ['front', 'side', 'back', 'angle'] as const) {
      if (!photographed.has(role)) fail(['geometryGroups', index, 'captureSetId'], `Geometry group ${group.id} needs an original ${role} photograph in capture set ${group.captureSetId}`);
    }
  });
  if (source.approval.revision !== source.sourceRevision) fail(['approval', 'revision'], 'Approval must match the exported source revision');
  if (computeSourceRevision(source) !== source.sourceRevision) fail(['sourceRevision'], 'Source content differs from its approved SHA-256 revision');
}
export const SourceInput = SourceBody.superRefine(validateSource);
export const StoredSourceInput = SourceBody.omit({ references: true }).extend({
  references: z.array(Reference.omit({ url: true })).min(4).max(100),
  storedReferences: z.array(z.object({ referenceId: Id, assetId: Id, sha256: Sha256 }).strict()).min(4).max(100),
}).strict().superRefine((source, ctx) => {
  validateSource(source, ctx);
  const references = new Map(source.references.map(reference => [reference.id, reference]));
  const mappings = source.storedReferences;
  if (mappings.length !== source.references.length || new Set(mappings.map(mapping => mapping.referenceId)).size !== mappings.length || new Set(mappings.map(mapping => mapping.assetId)).size !== mappings.length) {
    ctx.addIssue({ code: 'custom', path: ['storedReferences'], message: 'Each source reference must map to one distinct Maple asset' });
  }
  mappings.forEach((mapping, index) => {
    const reference = references.get(mapping.referenceId);
    if (!reference || reference.checksum !== mapping.sha256) ctx.addIssue({ code: 'custom', path: ['storedReferences', index], message: 'Stored asset checksum must match its source reference' });
  });
});
export type StoredSourceInput = z.infer<typeof StoredSourceInput>;
export type SourceInput = z.infer<typeof SourceInput>;
export const SourceList = z.object({
  schemaVersion: z.literal(2), tenantId: Id,
  products: z.array(z.object({ modelId: Id, name: Name, code: z.string().max(120), sourceRevision: Sha256 }).strict()).max(20),
  nextCursor: z.string().min(1).max(2000).nullable(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.products.map(product => product.modelId)).size !== value.products.length) ctx.addIssue({ code: 'custom', path: ['products'], message: 'Design IDs must be unique within a page' });
});
export function parseSource(input: unknown, tenantId: string, modelId?: string): SourceInput {
  const result = SourceInput.safeParse(input);
  if (!result.success) throw new AppError(400, 'Validation failed', result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
  if (result.data.tenantId !== tenantId || (modelId !== undefined && result.data.modelId !== modelId)) throw new AppError(400, 'Keeri source does not match the configured tenant and requested design');
  return result.data;
}

export function parseStoredSource(input: unknown, tenantId: string, modelId?: string): StoredSourceInput {
  const result = StoredSourceInput.safeParse(input);
  if (!result.success) throw new AppError(400, 'Validation failed', result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
  if (result.data.tenantId !== tenantId || (modelId !== undefined && result.data.modelId !== modelId)) throw new AppError(400, 'Keeri source does not match the configured tenant and requested design');
  return result.data;
}
