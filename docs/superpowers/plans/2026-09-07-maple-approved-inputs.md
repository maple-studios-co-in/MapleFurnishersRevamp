# Maple Approved Inputs Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Import only approved, attributable Keeri source packs into Maple through durable bounded work, while retaining Maple ownership of assets and publication.

**Architecture:** A strict version 2 input contract binds approval to canonical source content. PostgreSQL import batches are processed by a separate worker; immutable snapshots feed the existing recipe/version/publication services. The pilot accepts one geometry group and material variants sharing that group.

**Tech Stack:** Existing TypeScript, Zod, Express, Prisma/PostgreSQL and Next.js; no new infrastructure dependency.

**Spec:** The user-provided Keeri to Maple 3D Input Plan Review, evaluated in the preceding review; decisions and exact wire contract are recorded in `docs/keeri-3d-input-implementation-plan.md` during delivery.

## Global Constraints

- Work only in `codex/maple-3d-pipeline`; no Keeri edits or production mutations.
- Preserve original customer customizer and manual Taro workflow.
- Keeri supplies approved input; Maple owns copies, jobs, masters, output versions and publication.
- Reject legacy Keeri exports and mixed geometry groups explicitly; never infer evidence or dimensions.
- Approval and selected source content must match; signed download URLs never enter persisted snapshots.
- Use only the disposable local database `maple3d_test` on port 5447 for integration verification.

### Task 1: Versioned source contract

Files: `Backend/src/modules/three-d/source-contract.ts`, `validation.ts`, `Backend/test/fixtures/three-d-source.ts`, pure source tests.

- [x] Write failing cases for evidence loss, stale approvals, canonical tampering, unknown association, generated-only required views and changed dimensions.
- [x] Implement `computeSourceRevision`, strict `parseSource`, `parseStoredSource`, approved metadata and stable geometry/reference identity.
- [x] Verify URL renewal and array/key ordering preserve revision; selected content edits invalidate it.

### Task 2: Import and output enforcement

Files: `service.ts`, `connector.ts`, service and connector tests, production-compatible origin settings.

- [x] Test rejection of mixed geometry, oversized packs and mismatched byte lengths; cancellation must leave no imported source.
- [x] Add `ImportContext` with abort signal, pre-download budget reservation and transactional lease fencing.
- [x] Strip download URLs; persist full evidence; derive and pin one geometry ID on jobs/versions; validate output dimensions and variant memberships against that group.
- [x] Preserve the VPS `BACKEND_ORIGIN` setting and loopback host binding.

```ts
export type ImportContext = {
  signal?: AbortSignal;
  beforeReference?: (sizeBytes: number) => Promise<void>;
  beforeCommit?: (tx: Prisma.TransactionClient) => Promise<void>;
  afterImport?: (tx: Prisma.TransactionClient, result: { product: ThreeDProduct; unchanged: boolean }) => Promise<void>;
};
```

### Task 3: Durable import batches

Files: `import-batches.ts`, `import-worker.ts`, runtime wiring, Prisma schema/additive migration, worker script and batch tests.

- [x] Exercise enqueue/deduplication, persisted item progress, partial errors, retry, cancellation, lease recovery/fencing and byte-budget exhaustion on PostgreSQL.
- [x] Implement one-page batches with at most 20 designs and a cumulative 500 MiB reservation budget; process outside HTTP requests.
- [x] Expose authenticated list/detail/enqueue/retry/cancel routes; preserve cursor continuation and explicit fresh scan.
- [x] Demonstrate actual worker processing and recovery, with queued status honest when no worker is running.

### Task 4: Employee workflow

Files: Admin 3D page, API client, import batch panel, import history and source indicators.

- [x] Display verification, approval, capture and variant evidence with private Maple download actions.
- [x] Restore persisted batches on page load; poll progress; support retry/cancel/next page/new scan.
- [x] Verify local browser workflow, empty/error/legacy states, and original manual Taro functionality.

### Task 5: Delivery report and Keeri handoff

Files: `docs/keeri-3d-input-implementation-plan.md`, `docs/maple-3d-pipeline.md`, `docs/maple-3d-validation.md`, `docs/maple-3d-approved-inputs-report.md` and example JSON.

- [x] Publish exact V2 fields, canonical hash example, authenticated download rules and acceptance requirements for Keeri.
- [x] Run backend integration/pure tests, frontend regression tests and all affected production builds.
- [x] Review the final patch independently; fix verified findings; distinguish local implementation from deployment and physical realism.

## Execution decisions

- One geometry group per imported design is an explicit pilot limit. The contract carries multiple-group identity for a future viewer/recipe extension; such packs currently fail before downloads.
- Approval envelope and access URLs are excluded from content hashes, avoiding circular approvals and expiring-link revisions.
- Download budgets reserve declared bytes before each attempt and require exact downloaded length; retries cannot bypass the batch budget.
- VPS capacity/object storage remains an operational rollout decision. No automatic deletion or provider migration is authorized by this implementation request.

## Completion evidence

All five tasks completed locally. Verification: 44 backend tests, 7 admin tests and 8 viewer tests passed; all three production builds passed. Prisma migration status is current and the disposable database matches the schema. Browser and actual separate-worker checks are recorded in `docs/maple-3d-validation.md`. Independent review fixes included atomic batch/source completion, retained optional measurements/material attributes, and disabled-connection polling. No production or Keeri changes were made.
