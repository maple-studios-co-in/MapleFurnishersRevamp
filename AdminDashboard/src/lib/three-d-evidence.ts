import type { ThreeDProductDetail } from "./three-d-api";

export interface ApprovedKeeriInput {
  schemaVersion: 2;
  sourceRevision: string;
  approval: { revision: string; approvedAt: string; approvedBy: string };
  geometryGroups: { id: string; captureSetId: string; dimensionsMm: { width: number; depth: number; height: number; seatHeight?: number; armHeight?: number }; measurement: { method: string; verifiedAt: string; verifiedBy: string } }[];
  variants: { variantId: string; geometryGroupId: string; sku?: string; name?: string; attributes: Record<string, string> }[];
  references: { id: string; role: string; geometryGroupId: string; captureSetId: string; variantId: string | null; provenance: string; checksum: string; sizeBytes: number }[];
  storedReferences: { referenceId: string; assetId: string; sha256: string }[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** Historical inputs must never acquire an approval label through a UI fallback. */
export function approvedKeeriInput(value: unknown): ApprovedKeeriInput | null {
  const source = record(value);
  if (!source || source.schemaVersion !== 2 || !text(source.sourceRevision)) return null;
  const approval = record(source.approval);
  if (!approval || approval.revision !== source.sourceRevision || !text(approval.approvedAt) || !Number.isFinite(Date.parse(approval.approvedAt)) || !text(approval.approvedBy)) return null;
  if (!Array.isArray(source.geometryGroups) || !source.geometryGroups.length || !Array.isArray(source.variants) || !Array.isArray(source.references)) return null;
  for (const candidate of source.geometryGroups) {
    const group = record(candidate);
    const dimensions = record(group?.dimensionsMm);
    const measurement = record(group?.measurement);
    if (!group || !text(group.id) || !text(group.captureSetId) || !dimensions || !measurement ||
      ![dimensions.width, dimensions.depth, dimensions.height].every(size => typeof size === "number" && Number.isFinite(size) && size > 0) ||
      !text(measurement.method) || !text(measurement.verifiedAt) || !Number.isFinite(Date.parse(measurement.verifiedAt)) || !text(measurement.verifiedBy)) return null;
  }
  if (source.variants.some(candidate => { const variant = record(candidate); return !variant || !text(variant.variantId) || !text(variant.geometryGroupId); })) return null;
  if (source.references.some(candidate => { const reference = record(candidate); return !reference || !text(reference.id) || !text(reference.role) || !text(reference.geometryGroupId) || !text(reference.captureSetId) || !text(reference.provenance) || !text(reference.checksum) || typeof reference.sizeBytes !== "number" || reference.sizeBytes <= 0; })) return null;
  const storedReferences = Array.isArray(source.storedReferences)
    ? source.storedReferences.filter(candidate => { const ref = record(candidate); return ref && text(ref.referenceId) && text(ref.assetId) && text(ref.sha256); }) : [];
  const input = { ...source, storedReferences } as unknown as ApprovedKeeriInput;
  const groupIds = new Set(input.geometryGroups.map(group => group.id));
  if (groupIds.size !== input.geometryGroups.length || input.variants.some(variant => !groupIds.has(variant.geometryGroupId)) || input.references.some(reference => !groupIds.has(reference.geometryGroupId))) return null;
  return {
    schemaVersion: 2,
    sourceRevision: input.sourceRevision,
    approval: { revision: input.approval.revision, approvedAt: input.approval.approvedAt, approvedBy: input.approval.approvedBy },
    geometryGroups: input.geometryGroups.map(group => ({ id: group.id, captureSetId: group.captureSetId, dimensionsMm: { width: group.dimensionsMm.width, depth: group.dimensionsMm.depth, height: group.dimensionsMm.height, ...(typeof group.dimensionsMm.seatHeight === "number" ? { seatHeight: group.dimensionsMm.seatHeight } : {}), ...(typeof group.dimensionsMm.armHeight === "number" ? { armHeight: group.dimensionsMm.armHeight } : {}) }, measurement: { method: group.measurement.method, verifiedAt: group.measurement.verifiedAt, verifiedBy: group.measurement.verifiedBy } })),
    variants: input.variants.map(variant => ({ variantId: variant.variantId, geometryGroupId: variant.geometryGroupId, attributes: Object.fromEntries(Object.entries(record(variant.attributes) ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string")), ...(typeof variant.sku === "string" ? { sku: variant.sku } : {}), ...(typeof variant.name === "string" ? { name: variant.name } : {}) })),
    references: input.references.map(reference => ({ id: reference.id, role: reference.role, geometryGroupId: reference.geometryGroupId, captureSetId: reference.captureSetId, variantId: typeof reference.variantId === "string" ? reference.variantId : null, provenance: reference.provenance, checksum: reference.checksum, sizeBytes: reference.sizeBytes })),
    storedReferences: input.storedReferences.map(reference => ({ referenceId: reference.referenceId, assetId: reference.assetId, sha256: reference.sha256 })),
  };
}

export function productionInput(product: ThreeDProductDetail, jobId?: string) {
  const job = jobId ? product.jobs.find(candidate => candidate.id === jobId) : undefined;
  const snapshot = jobId ? job?.inputSnapshot : product.imports.find(entry => entry.sourceRevision === product.sourceRevision)?.snapshot;
  return approvedKeeriInput(snapshot);
}

export function inputBlockReason(product: ThreeDProductDetail, jobId?: string): string | null {
  if (product.sourceType !== "keeri") return null;
  const input = productionInput(product, jobId);
  if (!input) return "Legacy input — reimport approved inputs before starting production or creating a new version.";
  if (input.geometryGroups.length !== 1) return "These inputs contain different shapes or sizes. Import one verified geometry group before creating a model version.";
  return null;
}
