import { z } from 'zod';
import { AppError } from '../../lib/errors';

const Id = z.string().min(1).max(200);
const Name = z.string().trim().min(1).max(120);
export const Dimensions = z.object({ width: z.number().positive().max(100000), depth: z.number().positive().max(100000), height: z.number().positive().max(100000) });
const Swatch = z.object({ name: Name, hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), linearColor: z.tuple([z.number().min(0).max(4), z.number().min(0).max(4), z.number().min(0).max(4)]).optional() });
export const ManifestSchema = z.object({
  schemaVersion: z.literal(1), modelAssetId: Id,
  angles: z.array(z.object({ assetId: Id, label: z.enum(['perspective', 'side', 'front', 'back']) })).length(4),
  dimensionsMm: Dimensions,
  viewerProfile: z.enum(['taro-photo-room-v1', 'studio-v1']),
  materialSlots: z.object({ finish: z.array(Name).max(100), fabric: z.array(Name).max(100) }),
  finishes: z.array(Swatch).max(100), fabrics: z.array(Swatch).max(100),
  defaults: z.object({ finish: z.string().max(120), fabric: z.string().max(120) }),
  variantBindings: z.array(z.object({ variantId: Id, finish: z.string().max(120), fabric: z.string().max(120) })).max(5000),
  disclaimer: z.string().trim().min(1).max(2000),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (new Set(value.angles.map(a => a.label)).size !== 4) fail('Provide perspective, side, front and back exactly once');
  for (const type of ['finish', 'fabric'] as const) {
    const options = type === 'finish' ? value.finishes : value.fabrics;
    const names = options.map(o => o.name);
    if (new Set(names).size !== names.length) fail(`${type} names must be unique`);
    if (options.length ? !names.includes(value.defaults[type]) : value.defaults[type] !== '') fail(`Choose a valid default ${type}`);
    if (!options.length && value.materialSlots[type].length) fail(`Empty ${type} choices require empty material slots`);
    if (options.length && !value.materialSlots[type].length) fail(`${type} choices require named material slots`);
    if (new Set(value.materialSlots[type]).size !== value.materialSlots[type].length) fail(`${type} material slots must be unique`);
    for (const binding of value.variantBindings) {
      if (options.length ? !names.includes(binding[type]) : binding[type] !== '') fail(`Variant binding has an unknown ${type}`);
    }
  }
  if (value.materialSlots.finish.some(slot => value.materialSlots.fabric.includes(slot))) fail('A material slot cannot be both finish and fabric');
  if (new Set(value.variantBindings.map(b => b.variantId)).size !== value.variantBindings.length) fail('Variant bindings must have unique variant IDs');
  if (value.variantBindings.length && !value.variantBindings.some(b => b.finish === value.defaults.finish && b.fabric === value.defaults.fabric)) fail('Defaults must match an available variant');
}).transform(value => ({ ...value, angles: [...value.angles].sort((a, b) => ['perspective', 'side', 'front', 'back'].indexOf(a.label) - ['perspective', 'side', 'front', 'back'].indexOf(b.label)) }));
export type ManifestInput = z.infer<typeof ManifestSchema>;
export const ProductInput = z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: Name }).strict();
export const JobInput = z.object({ recipeId: Id, idempotencyKey: z.string().min(1).max(120) }).strict();
export const VersionInput = z.object({ jobId: Id.optional(), masterAssetId: Id.optional(), manifest: ManifestSchema, notes: z.string().max(4000).optional() }).strict();
export const ReviewInput = z.object({ decision: z.enum(['approved', 'rejected']), notes: z.string().max(4000).optional() }).strict();
export const SyncInput = z.object({ cursor: z.string().min(1).max(2000).optional() }).strict();
export const AssetKind = z.enum(['web_model', 'blender_master', 'preview', 'texture', 'reference']);
export type AssetKind = z.infer<typeof AssetKind>;

export { SourceInput, SourceList, parseSource, computeSourceRevision, StoredSourceInput, parseStoredSource } from './source-contract';
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, 'Validation failed', result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
  return result.data;
}
export function manifestAssetIds(manifest: ManifestInput): string[] {
  return [...new Set([manifest.modelAssetId, ...manifest.angles.map(a => a.assetId)])];
}
