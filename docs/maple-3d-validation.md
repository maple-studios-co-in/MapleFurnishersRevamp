# Maple 3D — local validation, 7 September 2026

## Approved-input update: current verification

The approved-input update builds on foundation commit `3ca03f4` in `/Users/adityaagrawal/dev/maple-3d-pipeline`, branch `codex/maple-3d-pipeline`. The current results below supersede the earlier test counts. Keeri and production were not modified.

| Check | Result |
| --- | --- |
| Backend source/connector/service/API/batch tests | **44 passed; zero failures or skips**, using only disposable PostgreSQL `127.0.0.1:5447/maple3d_test` |
| Admin evidence tests | **7 passed**, including optional seat/arm measurements and variant attributes |
| Viewer manifest/selection regression tests | **8 passed** |
| Backend production build | Passed: Prisma generation and TypeScript |
| Admin production build | Passed from final source; 3D Assets route included |
| Frontend production build | Passed; original customize, Taro and dynamic product routes included |
| Prisma migration status and schema diff | Up to date; no difference detected; new batch/geometry migration applied only locally |
| Worker entry point | Actual compiled `worker:3d-imports -- --once` imported an approved source and four original files from a disposable authenticated HTTPS server |
| Independent review | Contract/service/batch/admin interfaces reviewed; identified cancellation and evidence-display gaps corrected and verified |

Total: **59 automated tests passed**. The frontend build retains two pre-existing `OutroScene` hook dependency warnings; no new build failures were observed.

Meaningful regression tests were observed failing before their fixes: download size mismatch, cancellation before fetch, legacy input acceptance, mixed geometry import, aggregate design limits, URL persistence, output dimension mismatch, transactionally acknowledged item outcomes, numeric-key canonicalization and optional admin evidence. Source fixtures and canonical byte vectors are in `docs/contracts/` and are explicitly synthetic.

### Browser and worker checks

- Import from Keeri queued without starting downloads in the HTTP request.
- Reload recovered the same persisted queued batch; cancellation persisted; a new scan could be queued separately.
- The actual separate worker imported one test product; admin displayed completion and refreshed the product list automatically.
- Next-page continuation appeared separately from a new scan.
- Source history displayed approval revision/person/time, verified dimensions/method/person/time, capture set, original roles, provenance, checksums and variant attribution.
- Approved variant attributes were visible; private reference download actions used Maple asset IDs.
- Starting a Blender job retained the approved source snapshot and `geometry-standard` lineage.
- Legacy source inputs displayed an explicit reimport message and disabled new job/version controls.
- The mock Keeri connection was removed after QA. Local admin returns to the honest disconnected state; no real Keeri credentials were added.

### Current delivery boundary

Local backend is on 4027, admin on 3028 and the final frontend preview on 3027. Automatic test products were removed from the disposable database after verification; Taro, the existing admin QA chair and the clearly named synthetic approved-input sample remain for local review.

The existing VPS backend/admin deployment is separate. This update was not pushed, merged into main or deployed, and no production migrations, storage changes, photography or model generation were performed. The new migration is `20260907160000_three_d_import_batches`; it follows the three foundation migrations. See [implementation report](maple-3d-approved-inputs-report.md) and [Keeri handoff](keeri-3d-input-implementation-plan.md).

## Earlier foundation checks (historical)

The sections below record the earlier foundation verification and its original scope; use the current results above for this update.

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
