# Maple 3D inputs: implementation report

Date: 7 September 2026. Scope: Maple implementation and Keeri handoff. No Keeri source/data changes or production release are included.

## Result

Maple now accepts approved, attributable source packs through a durable import workflow. Imported originals, jobs, Blender masters, output versions and customer publication remain owned by Maple. The customer customizer retains its existing appearance and public manifest.

This strengthens the production foundation. It does not generate additional realistic models, certify physical dimensions or connect a paid reconstruction provider.

## Changes delivered

| Area | Implemented behavior |
| --- | --- |
| Source contract | Strict source v2 explicitly retains capture sets, reference-to-variant association, geometry groups, verification method/person/time and approval revision/person/time. Unknown fields fail rather than silently disappearing. |
| Approved content | Maple recomputes canonical SHA-256 and requires it to equal the source and approval revisions. Photo access URL renewal and collection/key reordering do not create a new input revision. Measurement/material/reference changes do. |
| Private originals | Downloaded byte count and SHA-256 must match the approved original. Maple stores private copies and local reference mappings. Temporary Keeri access URLs are removed from stored source/job snapshots. |
| Geometry | The pilot requires exactly one geometry group per imported design. Mixed construction or size groups fail before downloads. Jobs and output versions pin the group; output dimensions must match approved measurements and bindings must use that group's variants. |
| Import workload | Admin requests enqueue a persisted batch and return immediately. A separate worker fetches inputs, with per-design and cumulative batch budgets. Generation jobs remain separate from import jobs. |
| Recovery | Persisted item outcomes survive page reloads and worker restarts. Retry preserves successful items and the originally listed revision. Changed sources require a fresh scan. Leases fence stale workers; cancellation and source/item commits are transactional. |
| Admin | Saved import history, actual queue/processing states, progress, per-product outcomes, retry/cancel/new-scan/next-page actions, approval/measurement/reference evidence and private downloads. Legacy inputs cannot start new production without reimport. |
| Compatibility | Manual Maple/Taro jobs remain supported. Existing publication is not replaced by source changes, failed pages or export withdrawal. Existing VPS `BACKEND_ORIGIN` configuration and backend loopback binding are supported. |

The old synchronous `/api/admin/3d/keeri/sync` now also returns `202 {batch}`. Any external client relying on the previous `{imported,unchanged,failed,nextCursor}` response must switch to batch status APIs. The updated Maple admin already uses them.

## Operating limits

| Boundary | Current limit |
| --- | --- |
| Geometry groups imported per design | 1 |
| References per design | 24 |
| Total reference bytes per design | 200 MiB |
| Single original/artifact | 50 MiB |
| Designs in a page/batch | 20 |
| Download allowance per persisted batch | 500 MiB, cumulative across retries and restarts |
| HTTP request / JSON response | 15 seconds / 2 MiB |
| Worker attempt / renewable lease | 5 minutes / 30 seconds |

Reservations count attempted downloads, including failed attempts. Completing part of a batch is never represented as a fully imported source pack. A fresh scan begins at the first page so newly eligible records behind a previous cursor can be found. Automatic scheduling is not enabled.

## Required from Keeri

1. **Model source evidence:** design input, geometry groups, selected variants/overrides, original references and immutable approval records, with tenant/design ownership constraints.
2. **Employee workflow:** prepare measurements and original-photo selection; verify capture/variant attribution; approve or withdraw the current source revision. Define preparation, verification, approval and credential-management permissions.
3. **Readiness lifecycle:** make readiness depend on the current approved revision. Relevant edits invalidate it; stale editor submissions fail. Deletion/restore/media reassignment paths must enforce the same rule.
4. **Protect originals:** extend existing guarded media deletion. Keep approval history when readiness is withdrawn; never serve replacement bytes under an old checksum.
5. **Integration authentication:** a separate hashed, revocable, read-only tenant credential and narrowly scoped cookie-proxy exceptions. Authenticate every export/download request independently.
6. **Three GET APIs:** approved products list, one design's complete v2 pack, and revision/checksum-bound original downloads. Current eligibility and revocation must be checked on every request.
7. **Contract tests:** match Maple's full example and hash vectors; verify tenant isolation, concurrent approval, source edits, deletion, revocation, pagination and byte integrity.
8. **Physical pilot:** identify one actual design with one geometry group, take its real views, verify measurements/materials and approve those inputs before connecting it to Maple.

Exact fields, route behavior, database proposals and acceptance tests: [Keeri implementation handoff](keeri-3d-input-implementation-plan.md). Machine-readable example and canonical hash rules: [source v2 contract](contracts/keeri-3d-source-v2.md).

## Extending model generation

Keep provider execution behind Maple's existing recipe identity/version and artifact storage interfaces. A future Blender, Trellis or other reconstruction worker should consume the job's immutable source snapshot and deliver private artifacts plus a draft output version into the same review/publication workflow.

Before unattended generation, add authenticated worker claims/completion, source-readiness refresh, execution/cost limits, retries/cancellation and provider-specific adapters. Add group-aware viewer/model selection before importing multiple geometry groups. Higher-volume capture profiles, larger or compressed Blender masters and multipart/object-storage delivery are separate extensions; the current limits must not be silently bypassed.

## Verification and release state

The detailed verification record is in [Maple validation](maple-3d-validation.md). Test source packs and the HTTPS Keeri server used for browser/worker checks are synthetic local fixtures, not live ERP data or physical-product verification.

Code and migration are local. The existing VPS backend/admin are already deployed, but this new feature is not released there. The preceding VPS inspection found the filesystem at 95% utilization (about 5.7 GB available); resolve persistent storage capacity and backups before expanding the asset library.

Release sequence: integrate this branch with current main, provision persistent private storage, back up the intended database, apply all four additive 3D migrations, deploy backend/admin/frontend with the existing VPS origin settings, and supervise the import worker when Keeri is configured. Then verify authenticated admin actions and public/private asset access on the deployed origins. No Keeri credential or automatic generation is enabled by deployment alone.
