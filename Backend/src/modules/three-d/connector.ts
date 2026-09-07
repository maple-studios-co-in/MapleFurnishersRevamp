import { AppError } from '../../lib/errors';
import { parse, parseSource, SourceList } from './validation';
import type { SourceInput } from './validation';

export type KeeriConfig = { baseUrl: string; token: string; tenantId: string; referenceOrigins: string[] };
async function boundedBody(response: Response, maxBytes: number) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new AppError(502, 'Keeri response exceeds the import limit');
  if (!response.body) throw new AppError(502, 'Keeri returned an empty response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new AppError(502, 'Keeri response exceeds the import limit');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks);
}
export class KeeriConnector {
  constructor(readonly config: KeeriConfig, private readonly fetcher: typeof fetch = fetch) {
    const url = new URL(config.baseUrl);
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new AppError(503, 'Keeri API must use HTTPS');
    if (url.username || url.password || url.search || url.hash) throw new AppError(503, 'Keeri API origin is invalid');
  }
  private async json(path: string) {
    let response: Response;
    try { response = await this.fetcher(new URL(path, this.config.baseUrl), { headers: { Authorization: `Bearer ${this.config.token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw new AppError(502, 'Keeri could not be reached'); }
    if (response.status === 409) throw new AppError(409, 'Keeri design is no longer ready for 3D');
    if (!response.ok) throw new AppError(502, `Keeri returned HTTP ${response.status}`);
    try { return JSON.parse((await boundedBody(response, 2 * 1024 * 1024)).toString('utf8')); }
    catch (error) { if (error instanceof AppError) throw error; throw new AppError(502, 'Keeri returned invalid JSON'); }
  }
  async list(cursor?: string) {
    const query = new URLSearchParams({ limit: '20' });
    if (cursor) query.set('cursor', cursor);
    const list = parse(SourceList, await this.json(`/api/integrations/maple/3d/products?${query}`));
    if (list.tenantId !== this.config.tenantId) throw new AppError(400, 'Keeri list does not match the configured tenant');
    if (new Set(list.products.map(p => p.modelId)).size !== list.products.length) throw new AppError(400, 'Keeri returned duplicate designs in one page');
    return list;
  }
  async detail(modelId: string) {
    return parseSource(await this.json(`/api/integrations/maple/3d/products/${encodeURIComponent(modelId)}`), this.config.tenantId, modelId);
  }
  async reference(reference: SourceInput['references'][number]) {
    const url = new URL(reference.url);
    const origin = new URL(this.config.baseUrl).origin;
    if (url.protocol !== 'https:' || url.username || url.password || ![origin, ...this.config.referenceOrigins].includes(url.origin)) throw new AppError(400, 'Reference URL is outside configured download origins');
    let response: Response;
    try { response = await this.fetcher(url, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: url.origin === origin ? { Authorization: `Bearer ${this.config.token}` } : {} }); }
    catch { throw new AppError(502, 'A Keeri reference could not be downloaded'); }
    if (!response.ok) throw new AppError(502, `Keeri reference returned HTTP ${response.status}`);
    return boundedBody(response, 50 * 1024 * 1024);
  }
}
