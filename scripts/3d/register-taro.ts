/** Register the shipped Taro pilot through Maple's authenticated asset APIs. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { TARO_FALLBACK } from '../../Frontend/src/lib/three-d/taro-fallback';

async function main() {
  const origin = process.env.MAPLE_API_ORIGIN;
  const email = process.env.MAPLE_ADMIN_EMAIL;
  const password = process.env.MAPLE_ADMIN_PASSWORD;
  if (!origin || !email || !password) throw new Error('Set MAPLE_API_ORIGIN, MAPLE_ADMIN_EMAIL and MAPLE_ADMIN_PASSWORD. No environment files are read.');
  const api = new URL(origin);
  if (!['https:', 'http:'].includes(api.protocol) || (api.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))) throw new Error('Use HTTPS, or HTTP on localhost only.');
  let token = '';
  async function request(path: string, data?: unknown) {
    const response = await fetch(new URL(path, api), {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(60000),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(value)}`);
    return value;
  }
  token = (await request('/api/auth/login', { email, password })).token;
  let product = (await request('/api/admin/3d/products')).products.find((p: { slug: string }) => p.slug === 'taro');
  if (!product) product = (await request('/api/admin/3d/products', { slug: 'taro', name: TARO_FALLBACK.name })).product;
  product = (await request(`/api/admin/3d/products/${product.id}`)).product;
  const assets: { id: string; kind: string; sha256: string }[] = product.assets;
  async function upload(path: string, kind: string) {
    const bytes = await readFile(path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const existing = assets.find(asset => asset.kind === kind && asset.sha256 === hash);
    if (existing) return existing.id;
    const response = await fetch(new URL(`/api/admin/3d/products/${product.id}/assets?kind=${kind}&filename=${encodeURIComponent(basename(path))}`, api), {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(bytes), signal: AbortSignal.timeout(60000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Upload ${basename(path)}: ${response.status} ${JSON.stringify(body)}`);
    assets.push(body.asset);
    return body.asset.id as string;
  }
  const media = resolve('Frontend/public/media/models/taro');
  const modelAssetId = await upload(resolve(media, 'taro-v4.glb'), 'web_model');
  const labels = ['perspective', 'side', 'front', 'back'];
  const angles = [];
  for (const label of labels) angles.push({ assetId: await upload(resolve(media, `taro-v4-${label}.webp`), 'preview'), label });
  await upload(resolve(media, 'reference-front.webp'), 'reference');
  const masterAssetId = process.env.MAPLE_TARO_MASTER ? await upload(resolve(process.env.MAPLE_TARO_MASTER), 'blender_master') : undefined;
  const { dimensionsMm, viewerProfile, materialSlots, finishes, fabrics, defaults, variantBindings, disclaimer } = TARO_FALLBACK;
  const manifest = { schemaVersion: 1, modelAssetId, angles, dimensionsMm, viewerProfile, materialSlots, finishes, fabrics, defaults, variantBindings, disclaimer };
  // Prisma JSON key order is unspecified; compare a stable digest instead.
  const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object'
    ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}` : JSON.stringify(value);
  const matching = product.versions.filter((v: { manifest: unknown; masterAssetId?: string | null }) => canonical(v.manifest) === canonical(manifest) && (v.masterAssetId ?? undefined) === masterAssetId);
  let version = matching.find((v: { status: string }) => v.status !== 'rejected');
  if (!version) {
    const key = createHash('sha256').update(canonical({ manifest, masterAssetId: masterAssetId ?? null })).digest('hex');
    const job = (await request(`/api/admin/3d/products/${product.id}/jobs`, { recipeId: 'manual-blender', idempotencyKey: `taro-pilot-${key}-${matching.length}` })).job;
    version = (await request(`/api/admin/3d/products/${product.id}/versions`, { jobId: job.id, ...(masterAssetId ? { masterAssetId } : {}), manifest, notes: 'Existing Taro V4 visual pilot. Geometry, physical dimensions and material fidelity remain unverified.' })).version;
  }
  if (process.argv.includes('--publish')) {
    if (version.status === 'draft') version = (await request(`/api/admin/3d/versions/${version.id}/review`, { decision: 'approved', notes: 'Approved only as the existing visual prototype; not a certification of physical product accuracy.' })).version;
    product = (await request(`/api/admin/3d/versions/${version.id}/publish`, {})).product;
  }
  console.log(JSON.stringify({ productId: product.id, versionId: version.id, status: version.status, published: product.publishedVersionId === version.id, customizerPath: '/customize/taro' }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Taro registration failed'); process.exitCode = 1; });
