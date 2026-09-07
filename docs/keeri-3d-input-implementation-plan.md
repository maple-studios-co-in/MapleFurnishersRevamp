# Keeri → Maple: 3D input implementation plan

**Goal:** Let a Keeri employee mark a furniture design **Ready for 3D**. Maple can fetch only those designs, their eligible variants, measurements and selected source photographs. All 3D production and publishing stays in Maple.

**Status:** Keeri implementation handoff. No Keeri code or database changes were made while preparing this plan. Maple's receiving contract is specified in [the design](superpowers/specs/2026-09-07-maple-3d-pipeline-design.md).

## 1. Add independent readiness and reference selection

Authoritative schema: `/Users/adityaagrawal/dev/keeri/packages/db/prisma/schema.prisma`.

Add to `ProductModel`:

```prisma
readyFor3D       Boolean   @default(false)
readyFor3DAt     DateTime?
readyFor3DBy     String?

@@index([tenantId, readyFor3D, deletedAt, id])
```

Do not reuse `status` or `published`. Those already express catalogue/commerce workflow. Preserve them when toggling this flag.

Add a tenant-scoped `Product3DInput` record, one per design, with an optional variant override relation for size/construction differences. Store structured `widthMm`, `depthMm`, `heightMm`, optional seat/arm dimensions, measurement method, `verifiedAt`, `verifiedBy` and selected source `MediaAsset` IDs. Model dimensions are currently free text; keep that text for display while collecting independently verified numeric measurements. Never silently turn guessed dimensions into verified data.

Use a `Product3DReference` relation to attach each selected image to its model, optional variant, view (`front`, `side`, `back`, `angle`, `detail`, `dimension`), physical capture set and provenance. Validate tenant and subject ownership on every association. Preserve the original `MediaAsset.checksum`; calculate it over original bytes if absent. Do not use a thumbnail checksum.

Readiness requirements:

- At least one explicitly selected variant where sellable variants exist; include applicable material/finish choices and dimensions.
- Positive, verified width/depth/height in millimetres.
- Original front, side, back and three-quarter photographs of the same construction/capture set. Detail/material images supplement these views.
- A human confirms source attribution and physical-photograph provenance. Keeri's generated back/detail photos are not independent evidence, even when approved for the listing.

When requirements are missing, the employee sees a concrete list and cannot turn the flag on. Existing marketing-photo completeness remains unchanged.

## 2. Add the employee control

Extend the existing design detail at `apps/admin/app/products/[id]/page.tsx`. Keep the control near its source photos/details, labelled **Ready for 3D**, with helper text: “Make this design available to Maple's 3D production team.” Show the readiness checklist and link to edit measurements/reference selection.

Relevant existing files:

- `apps/admin/src/products/model-form.ts`: normal model edits and existing status parsing.
- `apps/admin/app/products/model-editor.tsx`: existing editing pattern.
- `apps/admin/app/products/model-table.tsx`: optional compact ready badge/filter.
- `apps/admin/src/products/detail.ts` and `variant-detail.ts`: current scoped reads and inheritance.
- `apps/admin/app/api/products/[id]/route.ts`: existing design mutation pattern.

Prefer a dedicated readiness mutation `PATCH /api/products/:id/3d-input` over extending a generic mass-assignment update. Authenticate the employee through existing session/access helpers; verify tenant ownership; validate selected references and measurements in one transaction. Record who changed readiness and when using Keeri's audit conventions. Keep a request with `readyFor3D: false` valid even if the reference pack has become incomplete.

## 3. Expose a narrowly scoped integration credential

Create a revocable, read-only credential for `maple:3d-inputs:read`, bound to one Keeri tenant. Store only its hash and a nonsecret identifier/prefix. Compare credentials safely, rate-limit failures, and avoid printing tokens or signed image URLs in logs. Employee sessions are used to administer the connection, never copied into Maple's worker.

New helper: `apps/admin/src/integrations/maple/auth.ts`. New route handlers live under `apps/admin/app/api/integrations/maple/3d/`.

Every list, detail and download request derives tenant identity from that credential. Client-supplied tenant IDs cannot broaden access. Existing media routes at `apps/admin/app/api/media/[...key]/route.ts` require a user session; do not make them public to enable this integration.

## 4. Build the eligible list API

`GET /api/integrations/maple/3d/products?limit=20&cursor=<opaque>`

Return only `readyFor3D=true` and `deletedAt=null` designs belonging to the authenticated tenant. Order by immutable design ID; use a validated cursor and a maximum page size of 20. Readiness filtering must happen on the server, even if the client omits a filter.

```json
{
  "schemaVersion": 1,
  "tenantId": "company-maple",
  "products": [
    { "modelId": "design-taro", "name": "Taro Armchair", "code": "TARO", "sourceRevision": "sha256-of-canonical-inputs" }
  ],
  "nextCursor": null
}
```

The IDs above are illustrative, not current Keeri IDs. Maple stores stable design/variant IDs; names, SKU strings and slugs are display fields.

## 5. Build the detail/reference API

`GET /api/integrations/maple/3d/products/:modelId`

Return the exact source pack for one eligible design. Wrong-tenant, deleted or unknown IDs return 404. A previously accessible design whose flag is now off returns 409 with `code: "NOT_READY_FOR_3D"`. The route always rechecks readiness; knowing an old model ID is insufficient.

```json
{
  "schemaVersion": 1,
  "tenantId": "company-maple",
  "modelId": "design-taro",
  "name": "Taro Armchair",
  "code": "TARO",
  "readyFor3D": true,
  "sourceRevision": "sha256-of-canonical-inputs",
  "dimensionsMm": { "width": 660, "depth": 766, "height": 763 },
  "variants": [
    { "variantId": "variant-taro-walnut-ivory", "sku": "example-sku", "attributes": { "finish": "Walnut Brown", "fabric": "Ivory" } }
  ],
  "references": [
    { "id": "media-front", "role": "front", "url": "https://keeri.example/api/integrations/maple/3d/media/media-front?token=short-lived-signature", "checksum": "64-character-sha256-of-original-bytes", "provenance": "photograph" }
  ]
}
```

The example is shortened to one reference; production readiness requires the full set described above. Example dimensions are illustrative and do not certify the real Taro. Resolve variant overrides before returning measurements/materials; a variant with a different size must retain its own dimensions.

Implement source assembly in `apps/admin/src/integrations/maple/three-d-input.ts`. Use current `ProductModel`, `ProductVariant`, `VariantAttribute`, `AttributeValue`, `MediaAsset` relations. Read the design and its selected variants, references and attributes from a consistent database snapshot.

For download URLs, create a purpose-specific signed route scoped to tenant, asset ID/checksum and expiry. Serve original bytes from `@keeri/media`; check asset still belongs to the eligible selected design when serving. Use `private, no-store`. A 15-minute lifetime supports bounded imports and retries; an expired link is renewed by refetching detail. Maple copies those bytes into private Maple storage and verifies SHA-256. Keeri's ordinary gallery/media visibility stays unchanged.

## 6. Compute source revisions correctly

Compute SHA-256 over a canonical, sorted payload containing:

- Stable design ID, name/code and relevant model specifications.
- Included variant IDs, effective dimensions and canonical material/finish attributes.
- Selected media IDs, role, subject/capture attribution, provenance and original-byte checksums.
- Verified measurements and confirmation metadata.

Exclude signed URLs, link expiry and request time: renewing access must not create a new model job. A child-media or variant-attribute edit must change the revision even if `ProductModel.updatedAt` does not. JSON object keys and unordered lists must be sorted deterministically. Add the source pack schema version to the hash input.

Maple compares revisions to avoid duplicate imports. A source update creates a new private input snapshot and prompts review; it does not automatically regenerate or replace an approved live model.

## 7. Withdrawal, polling and future generation

The initial integration uses Maple admin's **Fetch from Keeri**, one bounded page at a time. Turning readiness off prevents future input fetches. It never deletes a Maple asset or unpublishes a model. Absence from a partial list page is not a withdrawal signal.

Before a future unattended worker starts a new generation job, Maple must revalidate the source detail/revision and readiness. Add a separate change feed or signed notification for flag-off/deletion if immediate synchronization becomes necessary. Do not pretend the initial paginated eligible list supplies that guarantee.

Keeri does not need GLB support, generation-provider fields, 3D job records or output webhooks. Future worker callbacks target Maple. An optional Keeri link can open the Maple workspace.

## 8. Acceptance tests

Create tests beside the new service/routes, following existing Keeri test conventions. Important examples:

```ts
it('does not expose an unflagged design through list OR known-ID detail', async () => {
  const design = await fixture.design({ readyFor3D: false });
  expect(await api.list(mapleCredential)).not.toContainEqual(expect.objectContaining({ modelId: design.id }));
  expect((await api.detail(mapleCredential, design.id)).status).toBe(409);
});

it('changes the source revision after a child reference replacement', async () => {
  const before = await exportInput(tenantId, designId);
  await replaceReferenceOriginal(referenceId, differentImageBytes);
  const after = await exportInput(tenantId, designId);
  expect(after.sourceRevision).not.toBe(before.sourceRevision);
});
```

These fixture/helper names describe the intended new test support; implement them using the repo's disposable DB harness, not a live catalogue. Also cover:

- Tenant A cannot list, fetch or download tenant B's references, including modified cursor/asset IDs.
- False is the migration default for every existing design; a normal product save cannot toggle readiness accidentally.
- Missing side view, unknown provenance or unverified measurements prevent enabling readiness.
- Approved AI-generated images do not satisfy original-photo requirements.
- Reordering unchanged attributes or renewing signed URLs leaves the revision identical.
- Empty/final pages and non-overlapping cursor pages work; a malformed cursor fails clearly.
- Referenced bytes match their exported checksum; expired/revoked signatures fail.
- A valid variant override wins over parent dimensions; unrelated variant images are excluded.

## 9. Delivery sequence

1. Add schema and readiness service/tests. Keep every existing flag off.
2. Add employee readiness/reference UI and scoped integration authentication.
3. Implement list/detail/download endpoints and contract tests against Maple's receiver.
4. Verify Taro's actual Keeri identity, originals and physical measurements, then flag only that pilot design.
5. Configure Maple's backend with the Keeri origin, company ID and integration token. Import, inspect the private snapshot, attach a model and review in Maple.
6. Expand to a small mixed batch: upholstered chair, solid-wood table and a design with size variants. Confirm material-only variants share geometry while size/construction differences get their own versions/recipes.

Before Keeri code changes, read its `apps/admin/AGENTS.md` and installed Next documentation. The current repo's instructions warn that its framework conventions may differ from this Maple app.
