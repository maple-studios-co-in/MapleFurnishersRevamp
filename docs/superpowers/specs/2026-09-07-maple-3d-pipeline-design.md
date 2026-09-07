# Maple-owned 3D production foundation

> Historical foundation design. The Keeri **input v1** proposal below was superseded before real integration by [source contract v2](../../contracts/keeri-3d-source-v2.md) and the [current Keeri handoff](../../keeri-3d-input-implementation-plan.md). Use [the current pipeline runbook](../../maple-3d-pipeline.md) for the background import APIs and worker limits. The public viewer manifest remains **v1**.

## Approved intent

Keeri owns catalogue inputs and a design-level `readyFor3D` flag. Maple owns imported reference snapshots, generation jobs, files, model versions, material assignments, review and publication. The customer experience stays on Maple `/customize`. This implementation is the first working foundation; it must accept improved generation tools without changing catalogue integration or the viewer contract.

## First release

- Add a separate 3D product workspace to the existing Maple admin/backend. Do not change commerce Product publication or prices when importing.
- Import only eligible Keeri designs through a server-to-server, tenant-scoped connector. Store source revisions and snapshots. Repeated imports must be idempotent. Never infer withdrawal from one missing paginated result.
- Support local Maple-owned immutable artifact storage behind an interface. GLB and image artifacts can become public only through a published version. Blender masters and references remain private.
- Support durable jobs with recipe ID/version and input snapshots. Manual Blender delivery is the first usable recipe. Future AI reconstruction, material baking and optimization are worker adapters; no paid generation calls in this implementation.
- Register immutable output versions, review explicitly, then publish a selected approved version. Rejection or source updates cannot silently change a published version. A prior approved version can be republished for rollback.
- Serve a versioned public manifest. Preserve the existing Taro appearance and original customizer controls. Existing Taro remains a fallback while the backend is not configured.
- Provide an authenticated, expiring preview link for reviewing a draft in `/customize`.

## Stable contracts

All following routes are new. Admin routes use Maple's existing JWT authentication.

### Keeri input contract v1 (plan only; no Keeri edits)

`GET /api/integrations/maple/3d/products?cursor=...&limit=20` returns `{ schemaVersion: 1, tenantId, products: [{ modelId, name, code, sourceRevision }], nextCursor: string | null }`. This is the eligible list, always server-filtered by readyFor3D and non-deleted state. A stable revision covers design, included variants, measurements and selected reference metadata, not just ProductModel.updatedAt.

`GET /api/integrations/maple/3d/products/:modelId` returns `{ schemaVersion: 1, tenantId, modelId, name, code, readyFor3D: true, sourceRevision, dimensionsMm?: { width, depth, height }, variants: [{ variantId, sku, attributes: object, dimensionsMm?: object }], references: [{ id, role, url, checksum, provenance: 'photograph' | 'generated' | 'unknown' }] }`. Reference URLs are scoped, short-lived downloads; AI-generated views are not independent physical evidence. A flagged-off design returns 409 with code NOT_READY_FOR_3D; deleted or inaccessible IDs return 404. Keeri authenticates a read-only integration credential tied to one company. No Maple secrets appear in browser code.

### Maple admin contract

- `GET /api/admin/3d/products` -> `{ products: [...] }`.
- `POST /api/admin/3d/products` body `{ slug, name }` creates a manual/local 3D product without a commerce Product.
- `GET /api/admin/3d/products/:id` -> `{ product }`, including versions, jobs and assets.
- `GET /api/admin/3d/config` -> `{ keeriConfigured, recipes: [{ id, version, name }] }`.
- `POST /api/admin/3d/keeri/sync` body `{ cursor?: string }` imports one bounded page -> `{ imported, unchanged, failed: [{ modelId, message }], nextCursor }`.
- `POST /api/admin/3d/products/:id/jobs` body `{ recipeId, idempotencyKey }` -> `{ job }`. Jobs retain recipe version and exact source snapshot. Unknown/unavailable recipe is rejected.
- `POST /api/admin/3d/products/:id/assets?kind=web_model|blender_master|preview|texture|reference&filename=...` raw `application/octet-stream` body -> `{ asset }`. Limit 50 MiB, validate GLB/image/master signatures, hash bytes, generate storage keys rather than trusting filenames. Master files may be added separately. Asset ownership is checked on all use.
- `POST /api/admin/3d/products/:id/versions` body `{ jobId?: string, masterAssetId?: string, manifest: ManifestInput, notes?: string }` -> `{ version }`. The optional master is an owned private Blender artifact pinned to that version, never included in the public manifest.
- `POST /api/admin/3d/versions/:id/review` body `{ decision: 'approved' | 'rejected', notes?: string }` -> `{ version }`.
- `POST /api/admin/3d/versions/:id/publish` -> `{ product }`. Only approved versions with valid owned artifacts can publish. Public serving continues for the selected immutable version after a later source update.
- `POST /api/admin/3d/versions/:id/preview` -> `{ path, expiresAt }`, path `/customize/<slug>?preview=<scoped token>`; valid for at most 15 minutes.

`ManifestInput`:

```ts
type Swatch = { name: string; hex: string; linearColor?: [number, number, number] };
type ManifestInput = {
  schemaVersion: 1;
  modelAssetId: string;
  angles: { assetId: string; label: 'perspective' | 'side' | 'front' | 'back' }[]; // normalized into this order
  dimensionsMm: { width: number; depth: number; height: number };
  viewerProfile: 'taro-photo-room-v1' | 'studio-v1';
  materialSlots: { finish: string[]; fabric: string[] };
  finishes: Swatch[];
  fabrics: Swatch[];
  defaults: { finish: string; fabric: string };
  variantBindings: { variantId: string; finish: string; fabric: string }[];
  disclaimer: string;
};
```

Public `GET /api/3d/products/:slug` -> `{ manifest: { ...ManifestInput without asset IDs, productId, versionId, slug, name, modelUrl, angles: [{ src, label }] } }`. Drafts return 404. Optional `?preview=` authorizes that exact product/version and uses no-store. Public output contains no source photos, input snapshots, provider data or private file paths. Resolved artifact URLs use `/api/3d/assets/:id`; previews carry the same scoped token. Private admin download uses `/api/admin/3d/assets/:id`.

Empty finishes/fabrics are supported with empty defaults and material slots; the corresponding selector is hidden. Linear colour factors use 0..4 to support the existing Taro calibration. Referenced artifacts of any previously published approved version remain available to open tabs and cached manifests when a newer version is published. A previously imported source revision can become current again without duplicating its archived originals.

## Extensibility and limits

Persist recipe identity/version independently from provider identity. A recipe registry specifies supported inputs and stages. A manual job can receive results through the same version-registration service used by a future worker; capture job-to-version lineage and prevent duplicate completion. AI/GPU execution and unattended retries are a later adapter milestone, not simulated completion. Storage starts with a private filesystem adapter suitable for a persistent VPS; deployers must provide a persistent directory, and serverless deployment requires an object-storage adapter. Do not put uploads under Next public/.

The renderer contract is stable across generation providers. `studio-v1` supports arbitrary GLB furniture with explicit material slots and dimensions; Taro retains its existing calibrated photographic room profile. Changes in geometry require a new model version; material variants can share it. Exact realism still requires reference and material validation.

## Verification

Test input validation, duplicate imports/jobs, source revision updates, recipe selection, cross-product asset rejection, immutable version/publication transitions, draft secrecy and private master denial. Apply Prisma migrations only to a disposable local test database. Run backend/admin/frontend production builds, focused API integration tests, and browser checks for the original and Taro customizers plus the new admin workspace. No production deployment or real Keeri import is part of this step.
