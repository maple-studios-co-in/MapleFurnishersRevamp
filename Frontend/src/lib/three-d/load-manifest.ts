import 'server-only';
import { parseManifest, type PublicManifest } from './manifest';

export type ManifestResult = { status: 'ready'; manifest: PublicManifest } | { status: 'missing' } | { status: 'unavailable' };

export async function loadManifest(slug: string, preview?: string): Promise<ManifestResult> {
  if (!/^[a-z0-9-]+$/.test(slug) || (preview && preview.length > 4096)) return { status: 'missing' };
  const origin = process.env.MAPLE_BACKEND_ORIGIN ?? (process.env.NODE_ENV === 'development'
    ? 'http://localhost:4000' : 'https://maple-furnishers-backend.vercel.app');
  const url = new URL(`/api/3d/products/${encodeURIComponent(slug)}`, origin);
  if (preview) url.searchParams.set('preview', preview);
  try {
    // No cache for drafts or the publication pointer. The actual file is immutable.
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (response.status === 404 || response.status === 401 || response.status === 403) return { status: 'missing' };
    if (!response.ok) return { status: 'unavailable' };
    const body = await response.json();
    const manifest = parseManifest(body.manifest);
    return manifest && manifest.slug === slug ? { status: 'ready', manifest } : { status: 'unavailable' };
  } catch { return { status: 'unavailable' }; }
}
