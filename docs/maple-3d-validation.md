# Maple 3D foundation — local validation, 7 September 2026

## Source and scope

- Worktree: `/Users/adityaagrawal/dev/maple-3d-pipeline`.
- Branch: `codex/maple-3d-pipeline`, based on `main` at `ea243a1`.
- Keeri source was inspected only; its implementation plan is [here](keeri-3d-input-implementation-plan.md).
- Three additive Prisma migrations were applied to a new disposable PostgreSQL cluster on `127.0.0.1:5447`, database `maple3d_test`. Existing application databases were not used.
- Production was not deployed or configured during this implementation.

## Automated verification

| Check | Result |
|---|---|
| Backend production build | Passed, including Prisma generation and TypeScript |
| Admin production build | Passed; `/dashboard/3d-assets` included |
| Frontend production build | Passed; original, Taro and dynamic product routes included |
| Backend focused API/service/storage/connector tests | 15 passed, no skipped cases with the disposable DB |
| Frontend manifest/selection regression tests | 8 passed |
| Applied migrations compared with schema | No differences |
| Diff whitespace checks | Passed |

The frontend build reports two pre-existing hook-dependency warnings in `OutroScene.tsx`; no new build errors were left open.

Backend coverage includes authenticated admin access, preview-token rejection/expiry/scope, unconfigured connector state, unknown recipes, concurrent idempotency, immutable job completion, source changes including A→B→A reuse, source/variant tenant checks, reference-origin/credential isolation, checksum/size/format checks, partial import cleanup, cross-product assets, material-slot names, private master lineage, approval/publication/rollback, and continuing access to previously published artifacts.

Frontend coverage includes unsafe/malformed manifests, canonical view order, measurements/defaults, wood-only configurations, undefined variant choices, resolving only existing finish/fabric combinations and exact-name-first legacy URL handling.

## Real local API and browser checks

- Registered the shipped Taro GLB, four previews and a private front reference through the authenticated Maple API. Created a manual job, registered a version, reviewed it as the existing visual prototype and published it only in the disposable database.
- Repeated Taro registration reused the same version and files. The helper reports the actual publication state.
- Served GLB SHA-256 matches the original shipped file: `c55ad26d58036ea9a5ef334d9d21ed7d8c3e3a75bbf86d8f173c2d9cce05e970`; MIME is `model/gltf-binary`.
- An unauthenticated request for the private front reference returned 404. The authenticated download returned bytes matching its recorded SHA-256. Missing public products and invalid preview tokens returned 404 from the backend. The public manifest contained no source snapshots, storage keys or private master IDs.
- Browser verified the API-backed Taro in the original room/customizer, Natural Ash/Charcoal and Walnut Brown/Ivory selections, Back and Three-quarter views, and expanded viewer. Exactly one canvas remained active during the expanded view; keyboard zoom changed 1.000→1.100.
- Browser verified the original Axtra `/customize` page still exposes its existing material/view controls and navigation to Taro.
- Through the actual admin UI, created `admin-qa-chair-september`, started a manual job, uploaded the real Taro GLB and all four images, saved a studio-profile draft, opened its private customizer preview, approved it and published it.
- Through the admin UI, saved a second version with two finish options and a variant binding, verified its preview offered only the mapped combination, then rejected it. The earlier version remained published.
- Browser verified the generic studio view renders the uploaded model and now shares the expanded zoom controls. Keyboard zoom reached 1.100 with one canvas. Existing deliberate WebGL disposal emitted a context-lost log during canvas handover; no application error was observed.

## Deliberate remaining work

- Implement/configure the real Keeri ready flag and scoped export APIs; no real catalogue import has been claimed.
- Add actual generation adapters/workers. Current jobs await manual Blender delivery; no AI or Blender process is launched automatically.
- Add object storage/large-file support before using an ephemeral/serverless backend for assets. Current uploads are limited to 50 MiB and uncompressed `.blend` masters. The existing compressed Taro master remains untouched and was not uploaded. Private master ownership and version association were tested with an uncompressed fixture.
- Manifest v1 serves one geometry per published product version. Concurrent size/construction choices that need different meshes require a later geometry-variant manifest/viewer extension; do not map them as tint-only choices.
- Physical dimensions/material fidelity remain unverified. Publication in this local test approves workflow behaviour, not product accuracy.
- Touchscreen pinch was not physically tested. The browser automation download event timed out, so operating-system download receipt is not claimed; authenticated byte delivery was independently verified through the API.

## Local review surfaces

- Admin: `http://127.0.0.1:3028/dashboard/3d-assets`.
- Taro: `http://127.0.0.1:3027/customize/taro`.
- Generic studio QA product: `http://127.0.0.1:3027/customize/admin-qa-chair-september`.

These use the disposable local backend on port 4027 and are separate from the live website and the earlier local Taro preview on 3017. Keep the worktree for review; no merge or push is included in this step.
