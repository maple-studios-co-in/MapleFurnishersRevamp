import { createHash } from 'node:crypto';
import type { SourceInput } from '../../src/modules/three-d/source-contract';

export const referencePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=', 'base64');
export const referenceChecksum = '79d67cab43bcc2c581ee0623800b3e8997fa4bf75516bafa94d32f1a49f141d6';
export const fixtureSourceRevision = '0b024c0418bb890d9123efcb5085c4f2a6d4d8ac2ef62417ed320a7ea0a0d263';

export type FixtureSource = SourceInput;
const baseSource: FixtureSource = {
  schemaVersion: 2 as const, tenantId: 'tenant-a', modelId: 'chair', name: 'Chair', code: 'CHAIR', readyFor3D: true as const,
  sourceRevision: fixtureSourceRevision,
  approval: { revision: fixtureSourceRevision, approvedAt: '2026-09-07T10:00:00.000Z', approvedBy: 'approver-a' },
  geometryGroups: [{ id: 'geometry-standard', dimensionsMm: { width: 700, depth: 700, height: 800 }, measurement: { method: 'Measured physical sample', verifiedAt: '2026-09-07T09:00:00.000Z', verifiedBy: 'measurer-a' }, captureSetId: 'capture-standard' }],
  variants: [{ variantId: 'variant-oak', sku: 'CHAIR-OAK', geometryGroupId: 'geometry-standard', attributes: { finish: 'Oak', fabric: 'Ivory' } as Record<string, string> }],
  references: ['angle', 'back', 'front', 'side'].map(role => ({ id: role, role: role as 'angle' | 'back' | 'front' | 'side' | 'detail' | 'dimension', geometryGroupId: 'geometry-standard', captureSetId: 'capture-standard', variantId: 'variant-oak' as string | null, url: `https://images.example/${role}.png`, checksum: referenceChecksum, sizeBytes: referencePng.length, provenance: 'photograph' as 'photograph' | 'generated' | 'unknown' })),
};

// Independent fixture signer follows the documented wire contract. Golden revision
// above was calculated separately, so production canonicalization is not its oracle.
function sorted(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sorted).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${sorted(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function reapproveSource<T extends FixtureSource>(input: T): T {
  const source = structuredClone(input);
  const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const { approval: _approval, readyFor3D: _ready, sourceRevision: _revision, ...content } = source;
  content.geometryGroups.sort(byId);
  content.variants.sort((a, b) => a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0);
  const references = content.references.map(({ url: _url, ...reference }) => reference).sort(byId);
  const revision = createHash('sha256').update(sorted({ ...content, references })).digest('hex');
  return { ...source, sourceRevision: revision, approval: { ...source.approval, revision } };
}
export function makeSource(overrides: Partial<FixtureSource> = {}): FixtureSource {
  return reapproveSource({ ...structuredClone(baseSource), ...overrides });
}
