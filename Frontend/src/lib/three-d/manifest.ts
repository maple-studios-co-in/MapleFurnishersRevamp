/** Viewer contract v1. Generation providers never enter the customer bundle. */
export type MaterialSwatch = { name: string; hex: string; linearColor?: [number, number, number] };
export type ModelSelection = { finish: string | null; fabric: string | null; angle: number };
export type PublicManifest = {
  schemaVersion: 1;
  productId: string;
  versionId: string;
  slug: string;
  name: string;
  modelUrl: string;
  angles: { src: string; label: string }[];
  dimensionsMm: { width: number; depth: number; height: number };
  viewerProfile: 'taro-photo-room-v1' | 'studio-v1';
  materialSlots: { finish: string[]; fabric: string[] };
  finishes: MaterialSwatch[];
  fabrics: MaterialSwatch[];
  defaults: { finish: string; fabric: string };
  variantBindings: { variantId: string; finish: string; fabric: string }[];
  disclaimer: string;
};

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 2000;
const names = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 100 && value.every(text);
const assetUrl = (value: unknown) => typeof value === 'string' && /^\/api\/3d\/assets\/[a-zA-Z0-9_-]+(?:\?preview=[a-zA-Z0-9_.%~-]+)?$/.test(value);

function swatches(value: unknown): value is MaterialSwatch[] {
  return Array.isArray(value) && value.length <= 100 && value.every(item => object(item) && text(item.name)
    && typeof item.hex === 'string' && /^#[a-fA-F0-9]{6}$/.test(item.hex)
    && (item.linearColor === undefined || (Array.isArray(item.linearColor) && item.linearColor.length === 3
      && item.linearColor.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 4))))
    && new Set(value.map(item => item.name)).size === value.length;
}

/** Reject malformed/future manifests rather than half-rendering the wrong model. */
export function parseManifest(value: unknown): PublicManifest | null {
  if (!object(value) || value.schemaVersion !== 1 || !text(value.productId) || !text(value.versionId)
    || typeof value.slug !== 'string' || !/^[a-z0-9-]+$/.test(value.slug) || !text(value.name)
    || !assetUrl(value.modelUrl) || !Array.isArray(value.angles) || value.angles.length !== 4
    || !value.angles.every((angle, index) => object(angle) && assetUrl(angle.src) && angle.label === ['perspective', 'side', 'front', 'back'][index])
    || !object(value.dimensionsMm) || !['width', 'depth', 'height'].every(key => {
      const n = (value.dimensionsMm as ObjectValue)[key];
      return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100000;
    }) || !['taro-photo-room-v1', 'studio-v1'].includes(String(value.viewerProfile))
    || !object(value.materialSlots) || !names(value.materialSlots.finish) || !names(value.materialSlots.fabric)
    || !swatches(value.finishes) || !swatches(value.fabrics) || !object(value.defaults)
    || typeof value.disclaimer !== 'string' || value.disclaimer.length > 2000) return null;
  const allowed = (options: MaterialSwatch[], name: unknown) => options.length ? options.some(o => o.name === name) : name === '';
  if (!allowed(value.finishes, value.defaults.finish) || !allowed(value.fabrics, value.defaults.fabric)
    || !Array.isArray(value.variantBindings) || value.variantBindings.length > 10000
    || !value.variantBindings.every(binding => object(binding) && text(binding.variantId)
      && allowed(value.finishes as MaterialSwatch[], binding.finish) && allowed(value.fabrics as MaterialSwatch[], binding.fabric))) return null;
  if (value.variantBindings.length && !value.variantBindings.some(binding => binding.finish === (value.defaults as ObjectValue).finish && binding.fabric === (value.defaults as ObjectValue).fabric)) return null;
  return value as PublicManifest;
}

/** Keep a selected axis while resolving the other to a real variant. */
export function resolveSelection(manifest: PublicManifest, selection: ModelSelection, preferred: 'finish' | 'fabric' = 'finish'): ModelSelection {
  let finish = manifest.finishes.some(s => s.name === selection.finish) ? selection.finish! : manifest.defaults.finish;
  let fabric = manifest.fabrics.some(s => s.name === selection.fabric) ? selection.fabric! : manifest.defaults.fabric;
  const bindings = manifest.variantBindings;
  if (bindings.length && !bindings.some(b => b.finish === finish && b.fabric === fabric)) {
    const match = bindings.find(b => b[preferred] === (preferred === 'finish' ? finish : fabric))
      ?? bindings.find(b => b.finish === manifest.defaults.finish && b.fabric === manifest.defaults.fabric) ?? bindings[0];
    finish = match.finish; fabric = match.fabric;
  }
  return { finish, fabric, angle: Number.isInteger(selection.angle) && selection.angle >= 0 && selection.angle < 4 ? selection.angle : 0 };
}

export function selectionFromQuery(manifest: PublicManifest, params: URLSearchParams): ModelSelection {
  const legacyWoods: Record<string, string> = { natural: 'Natural Ash', walnut: 'Walnut Brown', ebonised: 'Ebony' };
  const legacyFabrics: Record<string, string> = { oat: 'Ivory', moss: 'Sand', clay: 'Mauve', ink: 'Charcoal' };
  const requestedFabric = params.get('fabric');
  const exactFabric = manifest.fabrics.some(s => s.name === requestedFabric);
  const fabric = !exactFabric && manifest.slug === 'taro' ? legacyFabrics[requestedFabric ?? ''] ?? requestedFabric : requestedFabric;
  const finish = params.get('finish') ?? (manifest.slug === 'taro' ? legacyWoods[params.get('wood') ?? ''] : undefined);
  return resolveSelection(manifest, { finish: finish ?? manifest.defaults.finish, fabric: fabric ?? manifest.defaults.fabric,
    angle: ['perspective', 'side', 'front', 'back'].indexOf(params.get('view') ?? 'perspective') });
}
