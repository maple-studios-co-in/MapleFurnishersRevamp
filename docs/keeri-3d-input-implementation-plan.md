# Keeri → Maple: implementation handoff

**Outcome:** Keeri supplies approved product evidence. Maple stores and owns imported originals, Blender masters, 3D jobs, versions, review and customer publication. Keeri does not receive or store generated 3D files.

**Status:** Maple's receiving contract is implemented locally. This document specifies the remaining Keeri work; no Keeri code, database or product data was changed. It replaces the earlier v1 handoff before any real Keeri integration. Use [source contract v2](contracts/keeri-3d-source-v2.md) and its [complete validated example](contracts/keeri-3d-source-v2.example.json), not the old shortened v1 examples. The viewer's public manifest remains v1.

## What Maple now expects

- A design-level **Ready for 3D** decision tied to an immutable approved content revision.
- Explicit geometry groups, selected variants, verified dimensions and attributed original photographs.
- A read-only, revocable credential scoped to one tenant and `maple:3d-inputs:read`.
- Authenticated list/detail/original-download APIs. Each original is pinned to its approved SHA-256 and byte count.
- Version 2 source packs matching the canonical hash specification. Unsupported/unknown fields fail explicitly instead of being discarded.

The current pilot accepts **one geometry group, at most 24 references and 200 MiB per design**. Each original is at most 50 MiB. A page contains at most 20 designs; Maple's import-worker byte budget is 500 MiB per persisted batch (one page), cumulative across retries and worker restarts. Each worker attempt has a five-minute deadline. JSON responses are limited to 2 MiB and individual requests to 15 seconds. These bounds protect intake; they are not estimates of model-generation cost or quality.

## 1. Relational inputs and ownership

Use `packages/db/prisma/schema.prisma` as the authority. The following records are a proposed Keeri implementation, not existing tables:

| Record | Responsibility and constraints |
| --- | --- |
| `Product3DInput` | Exactly one record per `(tenantId, modelId)` using a non-null compound unique key. Stores preparation version, current content revision, readiness, active approval reference and withdrawal metadata. Readiness defaults to false. |
| `Product3DGeometryGroup` | Belongs to that design input. Stable group ID, verified width/depth/height, optional seat/arm dimensions, measurement method/verifier/time, physical capture-set ID. |
| `Product3DSelectedVariant` | Links an actual design variant to one geometry group. Unique `(tenantId, inputId, variantId)`; no variant may silently belong to two groups in one export. |
| Optional `Product3DVariantOverride` | Exactly one override per selected-variant relation, enforced by a non-null unique selection ID. Resolve effective materials before export. A dimension/construction change requires a different geometry group, not a mismatched override. |
| `Product3DReference` | Links a selected original `MediaAsset` to input, group, capture set, role, explicit nullable variant association, provenance, original SHA-256 and byte count. |
| `Product3DApproval` | Append-only approval evidence: approved revision, approver, time and immutable source snapshot. Withdrawal must preserve this history. |
| Dedicated integration credential | Hash, nonsecret ID/prefix, tenant, read scope, expiry/revocation and rotation history. Never reuse another integration's credential. |

Add composite foreign keys wherever possible to enforce tenant, design and group membership. Existing relations may require supporting composite unique keys before adding those foreign keys. A nullable `variantId` with a unique constraint does **not** enforce one design-default row in PostgreSQL; the design default belongs on the single `Product3DInput`/group record instead.

Cross-row rules that cannot be expressed as foreign keys belong in a shared transaction service used by every mutation path. Do not expose generic mass assignment over readiness, approver IDs or revision fields.

Do not reuse `ProductModel.status`/`published`: catalogue and commerce approval are independent. Do not use names/SKUs as foreign identity. Do not parse free-text dimensions and silently mark them verified.

## 2. Preparation, verification and approval

Extend the current design detail/editor with **Prepare for 3D**, a checklist, measurement entry, selected variants, capture grouping and original-photo selection. At minimum, the checklist must show:

1. Positive, physically verified width/depth/height in millimetres and the method/verifier/time.
2. Front, side, back and three-quarter original photographs for each group, from the declared capture set.
3. Every photo's design, geometry, capture-set and optional variant attribution.
4. Explicit material-only variants sharing geometry; distinct construction/size placed in separate groups.
5. SHA-256 and byte count available for every selected original. Compute missing values during preparation, not on list requests.

Generated or unknown-provenance views may supplement the record but never satisfy the required original views. Human approval establishes the factual attribution; Maple can validate the declarations and bytes, not whether the declared photograph depicts the correct construction.

Use existing permission helpers and define capabilities explicitly:

- **Prepare:** edit reference selection and draft measurements.
- **Verify:** confirm physical measurements and attribution.
- **Approve/withdraw:** make a completed input revision available, or stop future export.
- **Manage integration:** create, rotate and revoke credentials.

Map these to Keeri's existing roles before implementation; do not assume every catalogue editor may approve exports or rotate keys. Store actor IDs server-side from the authenticated session.

## 3. Readiness lifecycle and concurrent edits

A flag is only the visible state. Eligibility means all of the following are true: design not deleted; readiness enabled; required evidence complete; current canonical revision equals the unwithdrawn approved revision.

Suggested dedicated employee mutation: `PATCH /api/products/:modelId/3d-input`, with a preparation version or expected source revision. Use a shared service; preserve ordinary catalogue saves.

When approving, in **one database transaction**:

1. Lock the input and relevant ownership/original metadata, or use equivalent optimistic concurrency conditions.
2. Reject a stale editor version with `409`; never silently approve newer content the employee did not inspect.
3. Assemble/validate a consistent source snapshot and calculate its revision.
4. Write the immutable approval record and update readiness/current approval together.

Selected original bytes/checksum, attribution, selected variants, relevant material attributes, grouping, dimensions, verification metadata and exported name/code changes require reapproval. Price/stock or unrelated catalogue changes do not, because they are not inputs to this contract. Child records must invalidate approval even if `ProductModel.updatedAt` does not change.

Withdrawal is always allowed for an authorized user, including when inputs are incomplete. It disables future list/detail/download access and records the event without deleting approvals or Maple assets. Deleting a design withdraws export in the same transaction; restoring it does not restore readiness automatically. Media reassignment/variant changes must run through the same invalidation and ownership checks.

The current general activity audit helper is best-effort. It can accompany these actions, but the durable approval/withdrawal evidence must be committed with the state transition itself.

## 4. Original protection and exact bytes

Extend the existing guarded deletion service in `apps/admin/src/products/media-delete.ts`, including design, variant and media deletion paths. Refuse deletion/reassignment of an actively approved original until readiness is withdrawn. Acquire the same relevant locks as approval so the two actions cannot race.

Do not cascade away approval evidence. Retain the immutable approved snapshot with IDs/checksums/attribution even after later permitted deletion. If the history needs a relation to a deleted row, use retained evidence rather than deleting the history through a cascading foreign key.

An original download is identified by design, selected reference, approved revision and checksum. Keep original object keys immutable or bind an object-store version. If the exact bytes have disappeared or changed, fail explicitly; never return a newly uploaded file under the old checksum. A revision-pinned source snapshot and its downloads must agree even during concurrent editing.

## 5. Integration authentication and cookie proxy

Create a separate read-only credential bound to one tenant and scope `maple:3d-inputs:read`. Store its hash, support expiry/revocation/rotation, compare safely, rate-limit requests and redact authorization headers and signed URLs from logs. Derive tenant identity from this credential on every handler.

`apps/admin/proxy.ts` currently gates API access using cookie/session authentication. Add a narrow exception **only for the GET route shapes implemented below**. Do not exempt all `/api`, all integrations, ordinary media or a broad path prefix. This bypasses the cookie requirement, not authentication: each exempt handler must require the integration credential before reading data or bytes. Keep existing cookie/session behavior everywhere else.

Prefer authenticated Keeri-origin URLs with no bearer secret in the query string. Maple already forwards its integration bearer only to the configured Keeri origin and rejects redirects. Every download request rechecks credential validity, scope, tenant, readiness and requested revision. Revoking a credential then blocks future requests immediately, including previously returned URL paths.

External object-store signed URLs are optional future delivery. A bare signature that works until expiry cannot meet immediate revocation. If used, route through a Keeri gate or implement an online revocation check tied to the integration credential before byte access. Merely shortening expiry is not equivalent to revocation. Do not make existing ordinary media routes public.

Revocation cannot recall copies already imported into Maple; Maple owns those files. Withdrawing export does not silently unpublish a customer model.

## 6. Implement three export endpoints

| Endpoint | Behavior |
| --- | --- |
| `GET /api/integrations/maple/3d/products?limit=20&cursor=<opaque>` | Approved, current, nondeleted designs for the authenticated tenant only. Return strict v2 list shape, at most 20 unique design IDs, ordered by immutable ID. No client filter can broaden eligibility. |
| `GET /api/integrations/maple/3d/products/:modelId` | Return the complete strict v2 source pack for the currently approved revision. Recheck eligibility even when the caller knows the ID. |
| `GET /api/integrations/maple/3d/products/:modelId/references/:referenceId?revision=<sha256>` | Serve exact selected original bytes for that currently approved revision, after independent integration authentication. No redirect to a generally accessible media route. |

Return `404` for wrong-tenant/deleted/unknown identities without revealing their existence. For a same-tenant known design that is no longer approved/current, use `409` with a stable code such as `NOT_READY_FOR_3D` or `SOURCE_REVISION_CHANGED`. Credential failures use `401`/`403`; malformed payloads/cursors use `400`; missing/corrupt approved original bytes fail clearly. Use `Cache-Control: private, no-store` on detail/download responses.

Build the payload from the immutable approved snapshot after verifying it remains the active revision. Renewable URL delivery details are attached after hashing. Return byte count/content type and serve only the checksum-pinned original. Parent or child edits must not produce a hybrid of old approval and new media.

The list source revision and fetched detail must agree. If a design changes between them, Maple should fail/retry that item against a newly fetched page rather than mislabel its imported snapshot.

Follow the exact [v2 canonical algorithm and test vectors](contracts/keeri-3d-source-v2.md). It includes all geometry, variants and reference metadata; excludes all download URLs, approval fields, readiness and the revision field itself. Approval times are excluded; measurement verification times are included. Do not hash the whole response or only `ProductModel.updatedAt`.

## 7. Pagination, retries and ownership after import

Use stable, validated, tenant-bound opaque cursors. Within one traversal, pages must not overlap or loop. Restart pagination from the beginning after reaching the end, or on an explicit refresh, so newly approved IDs behind an earlier cursor are found. Maple deduplicates by design identity plus source revision.

Maple performs the downloads in a durable background import flow with bounded work and visible per-design progress/failures. A retry re-fetches eligibility and verifies the intended revision before downloading; partial failure does not publish a partial source snapshot. The Keeri endpoints must tolerate repeat reads of the same approved revision without mutation.

An absent item on a page is not a deletion/withdrawal signal. Turning readiness off blocks future fetches, but never deletes Maple models or replaces its live version. A later explicit change feed may report withdrawals; it does not transfer asset ownership back to Keeri.

Keeri needs no 3D generation provider configuration, GLB upload feature, 3D output API or generation callback endpoint. Future Blender/Trellis/Meshy workers remain behind Maple's recipe and artifact contracts. Any future unattended generation must refresh source readiness before starting; the current manual-delivery workflow does not imply that this automation exists.

## 8. Required Keeri acceptance tests

Use the repository's disposable-database harness and real services/handlers. Read `apps/admin/AGENTS.md` and local framework guidance before implementing routes.

- Fresh migration leaves every design unready; ordinary catalogue updates cannot accidentally approve it.
- Missing original views, unverifiable dimensions, wrong capture set, generated substitutes and foreign variant/media associations block approval.
- Tenant A cannot list, fetch or download tenant B's evidence, including crafted cursor/reference IDs.
- An unflagged or stale-approved design is absent from list and rejected by known-ID detail/download.
- Concurrent edits invalidate a stale approval submission; approval evidence and readiness cannot commit separately.
- A child image replacement, attribution/material/dimension change alters the revision and requires reapproval; price/stock edits do not.
- The approved canonical example and numeric-key vector hash exactly as Maple expects; reordering collections or renewing URLs leaves the revision unchanged.
- Approved original deletion/reassignment races are guarded. Withdrawal allows the intended subsequent operation, preserves evidence, and restore does not reactivate approval.
- Missing/replaced original bytes fail instead of returning replacement content; downloads match exported checksum and size.
- Revocation/expiry immediately blocks new API and original download requests, including a URL obtained before revocation.
- Proxy exceptions are exact: new authenticated routes are reachable without cookies, unauthorized requests fail, and existing private routes stay private.
- Partial/final/empty pages, malformed cursors, traversal restart and payload/file budgets behave predictably.
- One material-only variant group succeeds; a different-size variant is assigned another group and rejected by Maple's current single-group pilot until that viewer milestone is implemented.

## 9. Delivery order

1. Implement the relational model, preparation/readiness service, permissions, concurrent-edit controls and deletion guard invariants.
2. Add the employee evidence/approval workflow and dedicated credential administration.
3. Add narrowly exempted authenticated export endpoints; verify them against Maple's v2 parser and hash vectors.
4. Select one real design with one geometry group. Photograph its actual views, verify measurements/materials, and approve that revision in Keeri.
5. Configure Maple with the Keeri origin, tenant and credential; import and inspect its private source evidence, then model/review/publish through Maple.
6. Expand to a small batch after import and generation quality checks. Implement multiple-geometry viewer/recipe support before onboarding mixed-size designs.

Source locations to consult in Keeri: `packages/db/prisma/schema.prisma`, `apps/admin/proxy.ts`, `apps/admin/app/products/[id]/page.tsx`, `apps/admin/src/products/model-form.ts`, `apps/admin/src/products/detail.ts`, `apps/admin/src/products/variant-detail.ts`, `apps/admin/src/products/media-delete.ts`, `apps/admin/src/products/photo-upload.ts`, and `apps/admin/src/audit/log.ts`.
