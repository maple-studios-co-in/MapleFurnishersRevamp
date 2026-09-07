# Maple 3D Foundation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement each owned task, then review the complete change.

**Goal:** Build Maple's extensible 3D asset workflow and provide a separate Keeri implementation plan.

**Architecture:** Keeri exposes eligible product inputs. Maple stores import snapshots, recipe-versioned jobs and immutable artifacts/versions, with explicit review and publishing. The customizer reads a stable manifest independent of the generation provider.

**Tech Stack:** Express 5, Prisma 6/PostgreSQL, Next.js 15, React 19, React Three Fiber, node:test/tsx.

**Spec:** `docs/superpowers/specs/2026-09-07-maple-3d-pipeline-design.md`

## Global Constraints

- Keeri source is read-only in this task; only its implementation plan is delivered.
- All 3D jobs, assets, approvals and publication are Maple-owned.
- Preserve the original `/customize` UI and Taro's existing visual profile.
- Use existing authentication; never expose credentials or private reference/master files publicly.
- Production databases, runtime processes, live publishing and paid generation services are outside this implementation step.

## Task 1: Backend production foundation

**Files:** `Backend/prisma/schema.prisma`, a new additive migration, `Backend/src/modules/three-d/*`, `Backend/src/app.ts`, `Backend/src/config/env.ts`, `Backend/test/*`, `Backend/package.json`.

**Interfaces:** Implement the input/admin/public contracts in the spec exactly. Extract validation, storage and recipe logic from routing. Preserve existing Product data.

- [x] Add behavioural tests first: unflagged/wrong-tenant imports fail, repeated source revision stays one import, only approved versions publish, foreign asset IDs fail and private masters cannot be public.
- [x] Observe failures, implement schema, validators, durable jobs, connector and local storage.
- [x] Implement routes and a manual Blender recipe; reject unknown recipes rather than simulating generation.
- [x] Add integration tests using a disposable PostgreSQL database, including source updates and publication rollback.
- [x] Run `npm run build --workspace Backend` and the focused test suite; record results.

## Task 2: Maple admin workflow

**Files:** `AdminDashboard/src/lib/three-d-api.ts`, `AdminDashboard/src/app/dashboard/3d-assets/page.tsx`, focused components under `AdminDashboard/src/components/three-d/`, navigation constants/sidebar.

**Interfaces:** Consume Task 1 routes. Show setup state honestly when Keeri is unconfigured. Never expose integration credentials in a form.

- [x] Build the product list, source status, Fetch from Keeri and manual-product creation.
- [x] Build product detail: queue a manual job, upload artifacts, register a version with clear metadata fields, review, open preview and publish approved version.
- [x] Handle loading, failures, empty states, duplicate submissions and selected product refresh.
- [x] Run admin build and browser checks with disposable backend data.

## Task 3: Viewer integration

**Files:** `Frontend/src/lib/three-d/*`, `Frontend/src/app/customize/[slug]/page.tsx`, Taro page/components, `CustomizerHero.tsx`, new studio scene/dialog, relevant tests.

**Interfaces:** Consume public manifest v1. Use a server-only backend origin and bounded fetch timeout; preview fetches are never cached. Taro fallback applies only to its existing bundled pilot when the backend is unavailable or has no published entry.

- [x] Add tests for manifest parsing, unknown profiles/unsafe URLs, material defaults and unavailable variant combinations.
- [x] Wire Taro to the manifest without changing its appearance; make model URL injectable.
- [x] Add a generic studio profile and dynamic product route using the original customizer shell.
- [x] Validate public/draft behaviour, four views, swatches, expanded viewer and fallback. Run frontend build.

## Task 4: Keeri handoff and operating instructions

**Files:** `docs/keeri-3d-input-implementation-plan.md`, `docs/maple-3d-pipeline.md`, reproducible local Taro registration script/fixture.

- [x] Specify readyFor3D flag, scoped read-only endpoints, selected source provenance, dimensions, pagination, revision coverage and test examples against real Keeri source paths.
- [x] Explain the current manual recipe and the next provider/storage adapter milestones.
- [x] Import the current Taro into the disposable database and verify the complete upload/version/review/publish flow.
- [x] Review the diff, fix important findings, and report implemented vs configured vs deployed separately.

## Execution decisions

- The user approved the architecture in the prior discussion and explicitly requested Maple implementation. Continue without another approval gate.
- Use `/Users/adityaagrawal/dev/maple-3d-pipeline` on `codex/maple-3d-pipeline` to preserve the existing checkout and previews.

## Validation record

All four foundation tasks completed locally. See `docs/maple-3d-validation.md` for build/test/API/browser evidence and the next generation/storage milestones. The private master, source-revision reuse and historical-artifact fixes were added during review. Existing Taro compressed master was not imported; master lineage was tested with an uncompressed fixture.
