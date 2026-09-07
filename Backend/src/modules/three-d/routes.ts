import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import express, { Router, type Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireAdmin } from '../../middleware/auth';
import { availableRecipes } from './recipes';
import { KeeriConnector } from './connector';
import { ThreeDService } from './service';
import { LocalArtifactStorage, MAX_ASSET_BYTES } from './storage';
import { AssetKind, JobInput, ManifestSchema, ProductInput, ReviewInput, SyncInput, VersionInput, manifestAssetIds, parse } from './validation';

const configured = !!(env.KEERI_3D_API_URL && env.KEERI_3D_TOKEN && env.KEERI_3D_TENANT_ID);
const connector = configured ? new KeeriConnector({ baseUrl: env.KEERI_3D_API_URL!, token: env.KEERI_3D_TOKEN!, tenantId: env.KEERI_3D_TENANT_ID!, referenceOrigins: env.KEERI_3D_REFERENCE_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) }) : undefined;
export const threeDService = new ThreeDService(prisma, new LocalArtifactStorage(env.THREE_D_STORAGE_DIR || resolve(process.cwd(), 'var/three-d')), connector);
// A preview is never a valid Maple admin session, including on older commerce endpoints.
const previewKey = createHmac('sha256', env.JWT_SECRET).update('maple-three-d-preview-v1').digest('hex');
const previewOptions = { audience: 'maple-three-d-preview', issuer: 'maple', algorithms: ['HS256'] as jwt.Algorithm[] };
function previewClaims(token: unknown): (JwtPayload & { productId: string; versionId: string }) | undefined {
  if (token === undefined) return undefined;
  if (typeof token !== 'string' || token.length > 3000) throw new AppError(404, '3D preview not found or expired');
  try {
    const decoded = jwt.verify(token, previewKey, { ...previewOptions, maxAge: '15m' });
    if (typeof decoded === 'string' || decoded.purpose !== 'three-d-preview' || typeof decoded.productId !== 'string' || typeof decoded.versionId !== 'string' || !decoded.exp || !decoded.iat || decoded.exp - decoded.iat > 900) throw new Error('Invalid scope');
    return decoded as JwtPayload & { productId: string; versionId: string };
  } catch { throw new AppError(404, '3D preview not found or expired'); }
}
export const adminThreeDRouter = Router();
adminThreeDRouter.use(requireAdmin);
adminThreeDRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
adminThreeDRouter.get('/config', (_req, res) => res.json({ keeriConfigured: configured, recipes: availableRecipes() }));
adminThreeDRouter.get('/products', async (_req, res) => res.json({ products: await threeDService.listProducts() }));
adminThreeDRouter.post('/products', async (req, res) => res.status(201).json({ product: await threeDService.createProduct(parse(ProductInput, req.body)) }));
adminThreeDRouter.get('/products/:id', async (req, res) => res.json({ product: await threeDService.product(String(req.params.id)) }));
adminThreeDRouter.post('/keeri/sync', async (req, res) => res.json(await threeDService.sync(parse(SyncInput, req.body).cursor)));
adminThreeDRouter.post('/products/:id/jobs', async (req, res) => res.status(201).json({ job: await threeDService.createJob(String(req.params.id), parse(JobInput, req.body)) }));
adminThreeDRouter.post('/products/:id/assets', express.raw({ type: 'application/octet-stream', limit: MAX_ASSET_BYTES }), async (req, res) => {
  if (!req.is('application/octet-stream')) throw new AppError(415, 'Use application/octet-stream for artifact uploads');
  const kind = parse(AssetKind, req.query.kind);
  if (typeof req.query.filename !== 'string' || !req.query.filename || req.query.filename.length > 500) throw new AppError(400, 'A filename is required (up to 500 characters)');
  res.status(201).json({ asset: await threeDService.uploadAsset(String(req.params.id), kind, req.query.filename, req.body) });
});
adminThreeDRouter.post('/products/:id/versions', async (req, res) => res.status(201).json({ version: await threeDService.registerVersion(String(req.params.id), parse(VersionInput, req.body)) }));
adminThreeDRouter.post('/versions/:id/review', async (req, res) => {
  const data = parse(ReviewInput, req.body);
  res.json({ version: await threeDService.reviewVersion(String(req.params.id), data.decision, data.notes, env.ADMIN_EMAIL) });
});
adminThreeDRouter.post('/versions/:id/publish', async (req, res) => res.json({ product: await threeDService.publishVersion(String(req.params.id), env.ADMIN_EMAIL) }));
adminThreeDRouter.post('/versions/:id/preview', async (req, res) => {
  const version = await prisma.threeDVersion.findUnique({ where: { id: String(req.params.id) }, include: { product: true } });
  if (!version) throw new AppError(404, '3D version not found');
  const token = jwt.sign({ purpose: 'three-d-preview', productId: version.productId, versionId: version.id }, previewKey, { audience: previewOptions.audience, issuer: previewOptions.issuer, algorithm: 'HS256', expiresIn: '15m' });
  const decoded = jwt.decode(token) as JwtPayload;
  res.json({ path: `/customize/${version.product.slug}?preview=${encodeURIComponent(token)}`, expiresAt: new Date(decoded.exp! * 1000).toISOString() });
});
adminThreeDRouter.get('/assets/:id', async (req, res) => {
  const asset = await prisma.threeDAsset.findUnique({ where: { id: String(req.params.id) } });
  if (!asset) throw new AppError(404, 'Artifact not found');
  res.setHeader('Content-Disposition', `attachment; filename="${asset.filename}"`);
  await sendArtifact(res, asset, true);
});

async function sendArtifact(res: Response, asset: NonNullable<Awaited<ReturnType<typeof prisma.threeDAsset.findUnique>>>, preview: boolean) {
  const bytes = await threeDService.checkedBytes(asset);
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Content-Length', bytes.length);
  res.setHeader('Cache-Control', preview ? 'no-store' : 'public, max-age=3600');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(bytes);
}
export const publicThreeDRouter = Router();
publicThreeDRouter.get('/products/:slug', async (req, res) => {
  const claims = previewClaims(req.query.preview);
  const product = await prisma.threeDProduct.findUnique({ where: { slug: String(req.params.slug) } });
  if (!product || (claims && claims.productId !== product.id)) throw new AppError(404, '3D product not found');
  const versionId = claims?.versionId || product.publishedVersionId;
  if (!versionId) throw new AppError(404, '3D product not found');
  const version = await prisma.threeDVersion.findUnique({ where: { id: versionId } });
  if (!version || version.productId !== product.id || (!claims && version.status !== 'approved')) throw new AppError(404, '3D product not found');
  const { modelAssetId, angles, ...manifest } = parse(ManifestSchema, version.manifest);
  const query = claims ? `?preview=${encodeURIComponent(String(req.query.preview))}` : '';
  const assetUrl = (id: string) => `/api/3d/assets/${encodeURIComponent(id)}${query}`;
  res.setHeader('Cache-Control', claims ? 'no-store' : 'public, max-age=60');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.json({ manifest: { ...manifest, productId: product.id, versionId: version.id, slug: product.slug, name: version.productName, modelUrl: assetUrl(modelAssetId), angles: angles.map(angle => ({ src: assetUrl(angle.assetId), label: angle.label })) } });
});
publicThreeDRouter.get('/assets/:id', async (req, res) => {
  const claims = previewClaims(req.query.preview);
  const asset = await prisma.threeDAsset.findUnique({ where: { id: String(req.params.id) }, include: { product: true } });
  if (!asset || !['web_model', 'preview', 'texture'].includes(asset.kind) || (claims && claims.productId !== asset.productId)) throw new AppError(404, 'Artifact not found');
  const version = claims
    ? await prisma.threeDVersion.findUnique({ where: { id: claims.versionId } })
    : await prisma.threeDVersion.findFirst({ where: {
      productId: asset.productId, status: 'approved', publications: { some: {} },
      OR: [['modelAssetId'], ...[0, 1, 2, 3].map(index => ['angles', String(index), 'assetId'])].map(path => ({ manifest: { path, equals: asset.id } })),
    } });
  // Published immutable URLs keep working in an open viewer after a later publication.
  if (!version || version.productId !== asset.productId || !manifestAssetIds(parse(ManifestSchema, version.manifest)).includes(asset.id)) throw new AppError(404, 'Artifact not found');
  await sendArtifact(res, asset, !!claims);
});
