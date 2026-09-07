# Maple 3D production workspace

## What this release implements

Maple owns a separate 3D workspace, private artifact storage, reference imports, recipe-versioned jobs, immutable output versions, review and publication. Existing commerce `Product` rows and their publication remain separate.

The admin entry is `/dashboard/3d-assets`. A user can import eligible designs from Keeri or create a local design, start a manual Blender job, upload outputs, save a version, open a private preview on the customer customizer, review it, then publish it. Approved prior versions can be republished for rollback. Publication history records the action.

The initial recipe is **Manual Blender delivery**, ID `manual-blender`, version `1`. A job reports `awaiting_delivery` while an artist works and `completed` once a draft output version is registered. Completed does not mean approved or published. This release does not call Trellis/Meshy or execute Blender automatically.

## Separation that supports future tools

| Boundary | Current implementation | Later extension |
|---|---|---|
| Input contract | Approved Keeri export v2, canonical revision checks, capture/variant attribution, verified measurements and private originals | Additional capture profiles and pre-generation readiness refresh |
| Catalogue imports | Durable PostgreSQL batches with a separate worker, progress, retry, cancellation and lease recovery | Scheduled scans and change feeds |
| Recipe registry | Immutable recipe ID/version with declared stages | Image reconstruction, geometry cleanup, UV/material baking and optimization recipes |
| Job persistence | Exact source snapshot, recipe version, idempotent job creation and output lineage | Worker leases, retries, progress, cancellation and provider execution adapters |
| Artifact storage | `ArtifactStorage` interface, private filesystem implementation | Maple-owned object storage and large-file/multipart uploads |
| Version review | Immutable manifest, review decision and publication history | Automated quality reports alongside human review |
| Viewer | Public manifest v1 with model, views, dimensions and explicit material slots | Additional render profiles and versioned material/texture configurations |

An improved generator should consume a job's **stored input snapshot**, produce owned artifacts, and call the version registration service. It must not mutate current published files or expose provider-specific output directly to the browser. Persist a new recipe version when its behaviour changes; older jobs keep their original recipe identity and inputs. Generation workers are a separate process/service from web requests.

Before enabling automated generation, add authenticated worker claims/completion, leases, retry/idempotency rules, cost limits and source-readiness revalidation. Those are deliberate next milestones, not inactive or simulated workers in this release.

## Environment and storage

The backend still needs its existing PostgreSQL, JWT and admin-login configuration. New settings:

| Setting | Purpose |
|---|---|
| `THREE_D_STORAGE_DIR` | Absolute private directory on persistent Maple-owned storage; never a Next `public` directory. Defaults to `var/three-d` under backend process working directory for local use. |
| `KEERI_3D_API_URL` | Keeri origin/base URL used by the input connector. |
| `KEERI_3D_TOKEN` | Read-only server-side integration credential. |
| `KEERI_3D_TENANT_ID` | Expected Keeri company ID; responses must match it. |
| `KEERI_3D_REFERENCE_ORIGINS` | Optional comma-separated additional HTTPS origins allowed for signed original-image downloads. No integration credential is forwarded to those other origins. |
| `MAPLE_BACKEND_ORIGIN` | Frontend and admin server-side API/proxy target. Existing VPS `BACKEND_ORIGIN` is accepted as a fallback. |
| `NEXT_PUBLIC_API_URL` | Existing admin direct API target for local development. |
| `NEXT_PUBLIC_STOREFRONT_URL` | Admin's Maple customizer origin for preview/live links. |

Without the three Keeri settings, admin shows that Keeri is not connected and manual/local products still work. No live Keeri credentials have been configured by this implementation.

Uploads are limited to **50 MiB per file**. Supported files are self-contained GLB 2.0, uncompressed `.blend`, PNG, JPEG and WebP. Embedded resources must stay within the GLB. Versioned asset IDs identify immutable bytes; SHA-256 verifies file integrity before publication/serving. Blender masters and references are private even after publication.

The existing Taro room master is Zstandard-compressed, so it was not uploaded in the local pilot import. Compressed-master validation and large-file storage are the next storage milestone; that original file remains untouched. Master ownership/privacy/lineage were covered with an uncompressed test fixture.

The local adapter requires a persistent VPS volume, filesystem permissions and backups. A serverless ephemeral filesystem is not a production asset store: implement the object-storage adapter before running uploads there. Large Blender masters will need the large-file milestone or a smaller uncompressed delivery file; no automatic conversion or lossy reduction occurs on upload.

## Schema and API

New tables are additive: `ThreeDProduct`, `ThreeDImport`, `ThreeDJob`, `ThreeDAsset`, `ThreeDVersion`, `ThreeDPublication`, `ThreeDImportBatch` and `ThreeDImportItem`. They store references to Keeri IDs without adding 3D outputs to Keeri. Apply all four new migrations when releasing: `20260907093000_three_d_foundation`, `20260907095000_three_d_version_identity`, `20260907102000_three_d_version_master`, and `20260907160000_three_d_import_batches`. Versions pin their private Blender master, approved source revision and geometry group independently from public files.

### Approved input imports

The authoritative Keeri wire contract is [source v2](contracts/keeri-3d-source-v2.md). It supersedes the original proposal's source v1. The public viewer manifest remains v1. Legacy Keeri input snapshots require reimport before new production; manual Maple products and existing published versions are retained.

The current import profile accepts one geometry group, up to 24 references and 200 MiB of originals per design. Each original has a 50 MiB ceiling. Required front, side, back and angle views must be marked as photographs from the group's capture set. Generated views are supplements. Approval must match the recomputed content hash. Downloaded originals must match both declared size and SHA-256; expiring access URLs are removed before snapshot persistence.

The admin creates one-page import batches (up to 20 designs) using `POST /api/admin/3d/keeri/import-batches` with `{idempotencyKey,cursor?}`. It returns `202 {batch}` without downloading images. `GET` on the same route lists recent batches; `GET /:id` reads one; `POST /:id/retry` and `POST /:id/cancel` act on it. The older `/keeri/sync` endpoint now also enqueues and returns `{batch}`, so external clients using its old synchronous response must migrate.

Start a separately supervised process with the same backend environment and private storage directory:

```sh
npm run worker:3d-imports --workspace Backend
```

The worker command uses compiled backend code; build first. `-- --once` processes at most one available batch for an operational check. Queued records remain waiting if no worker is running; the web process does not execute them. Worker process health alone does not establish successful importing: inspect the batch outcome.

Each persisted batch has a cumulative 500 MiB download reservation budget across retries and worker restarts, with a five-minute time limit per attempt. Reservations happen before downloads and remain charged after failure, so retries cannot bypass the limit. A 30-second renewable lease permits recovery after a crash; transaction fencing prevents stale workers from committing. Imported source records and successful item outcomes commit together. Graceful worker stops requeue unfinished work; cancellation preserves already committed products and files.

Retry reattempts eligible failures while retaining successful items. Source revisions are pinned when the page is fetched: changed/invalid sources require a new scan. A fresh scan starts from the first page so newly eligible IDs behind an earlier cursor can be discovered. Polling/scheduled scans are not enabled automatically. Missing entries in a partial or failed page never withdraw Maple products or publication.

Changing the source or import limits for a future capture/generation workflow requires a tested profile/contract change. Additional geometry groups are represented in source v2 but rejected by this pilot before downloading; group-specific model selection must be added before enabling them. AI workers must separately revalidate current Keeri readiness before unattended generation.

Admin APIs start at `/api/admin/3d` and use existing Maple JWT authentication. The full route/payload contract is in [the design](superpowers/specs/2026-09-07-maple-3d-pipeline-design.md). `GET /api/3d/products/:slug` returns only a published manifest; `/api/3d/assets/:id` authorizes only artifacts referenced by published versions. Private 15-minute preview tokens are scoped to one product/version and cannot authenticate as admin.

Existing Taro keeps the bundled pilot if there is no published backend entry or the backend is unavailable. An invalid or expired private preview never falls back to that pilot. New `/customize/:slug` routes use published manifests and return not-found for unpublished products. Backend unavailability is shown clearly for other products.

## Preparing Blender output

1. Start from the job's stored original photos and verified measurements. Generated listing images remain supplementary and cannot prove unseen construction.
2. Model in metres. Export glTF Y-up with the product front along +Z. The generic studio centers the model and places its lowest point on the floor.
3. Name materials deliberately; list the exact names in the version's finish/fabric slots. Registration rejects unknown slot names and cross-product assets.
4. Embed textures and buffers inside the GLB. Upload four corresponding view images in perspective, side, front, back order.
5. Enter dimensions in millimetres. Optional swatches map to named slots; a plain hex is an illustrative tint. `linearColor` contains bounded linear RGB factors for calibrated materials, such as the existing Taro recipe. The next material milestone should use measured PBR samples and validated texture scale.
6. Keep source references and the Blender master as separate private artifacts. Review silhouette, construction, material response and dimensions before publication.

For Keeri-backed products, variant bindings use actual imported variant IDs and material choices. Changing one swatch resolves to an available mapped combination. Empty material groups retain authored GLB materials and hide that selector. Shape/size differences must not be disguised as material-only bindings.

## Registering the existing Taro pilot

From the repository root, provide `MAPLE_API_ORIGIN`, `MAPLE_ADMIN_EMAIL`, `MAPLE_ADMIN_PASSWORD` through your normal local/secret environment. The script does not load environment files or print the token.

```sh
node --import tsx scripts/3d/register-taro.ts
```

This uploads/reuses the current shipped GLB, four views and a private front reference, creates/reuses a manual job and registers a draft. Set `MAPLE_TARO_MASTER` to an existing uncompressed master path to include it privately. No `.blend` master is bundled into this source change.

The optional `--publish` flag explicitly reviews it as the **existing illustrative pilot** and publishes it. This is intended for the disposable integration test or a separately authorized pilot rollout; it does not certify physical dimensions or finish accuracy. Ordinary artist review should use the admin. Repeating the script reuses the same files/version.

## Validation and rollout

Use Node 22 for the validation commands. The backend build deliberately generates Prisma from the repository root to accommodate the workspace's nested CLI and hoisted client.

```sh
npm run build --workspace Backend
npm run build --workspace AdminDashboard
npm run build --workspace Frontend
node --import tsx --test Frontend/test/three-d-manifest.test.ts
```

Backend integration tests use `THREE_D_TEST_DATABASE_URL`, pointing only to a local disposable database named `maple3d_test`. Without it, database-dependent cases are explicitly skipped; pure/authentication cases still run. Run `npm run test:3d --workspace Backend` after applying migrations to that disposable database, and verify the report contains no skipped cases before claiming full coverage.

Release order: provision persistent private storage; back up the intended database; apply additive migrations; deploy backend/admin; configure matching API/storefront origins; register and review Taro; verify public/private routes; then deploy the manifest-consuming frontend. Keep the current shipped Taro fallback during adoption. Configure Keeri only after its [input plan](keeri-3d-input-implementation-plan.md) is implemented and contract-tested.

## This implementation's delivery state

Source changes and local verification are in the `codex/maple-3d-pipeline` branch/worktree. No production deployment, real Keeri import, paid AI generation or physical-product certification is implied. See `docs/maple-3d-validation.md` for the recorded checks and remaining integration work.
