import assert from "node:assert/strict";
import { test } from "node:test";
import { approvedKeeriInput, inputBlockReason, productionInput } from "../src/lib/three-d-evidence";
import type { ThreeDProductDetail } from "../src/lib/three-d-api";

function source(revision = "revision-a") {
  return {
    schemaVersion: 2, sourceRevision: revision,
    approval: { revision, approvedBy: "Keeri reviewer", approvedAt: "2026-09-07T00:00:00Z" },
    geometryGroups: [{ id: "chair-standard", captureSetId: "capture-a", dimensionsMm: { width: 650, depth: 700, height: 800 }, measurement: { method: "physical_measurement", verifiedBy: "Product team", verifiedAt: "2026-09-06T00:00:00Z" } }],
    variants: [{ variantId: "ivory-chair", geometryGroupId: "chair-standard", sku: "MPL-CH-IV" }],
    references: [{ id: "front", role: "front", geometryGroupId: "chair-standard", captureSetId: "capture-a", variantId: "ivory-chair", provenance: "photograph", checksum: "sha256:123", sizeBytes: 6000, url: "https://keeri.example/private?token=never-show" }],
    storedReferences: [{ referenceId: "front", assetId: "private-front", sha256: "123" }],
  };
}
const product = (snapshot: unknown) => ({ sourceType: "keeri", sourceRevision: "revision-a", imports: [{ sourceRevision: "revision-a", snapshot }], jobs: [] }) as unknown as ThreeDProductDetail;

test("approved source retains attribution and private download mapping without source URLs", () => {
  const input = approvedKeeriInput(source());
  assert.equal(input?.approval.approvedBy, "Keeri reviewer");
  assert.equal(input?.geometryGroups[0].measurement.verifiedBy, "Product team");
  assert.equal(input?.references[0].variantId, "ivory-chair");
  assert.equal(input?.storedReferences[0].assetId, "private-front");
  assert.equal(JSON.stringify(input).includes("never-show"), false);
});

test("approved evidence retains seat and arm measurements and variant attributes", () => {
  const fixture = source();
  const input = approvedKeeriInput({
    ...fixture,
    geometryGroups: [{ ...fixture.geometryGroups[0], dimensionsMm: { ...fixture.geometryGroups[0].dimensionsMm, seatHeight: 450, armHeight: 620 } }],
    variants: [{ ...fixture.variants[0], attributes: { Finish: "Natural Ash", Fabric: "Ivory" } }],
  });
  assert.deepEqual(input?.geometryGroups[0].dimensionsMm, { width: 650, depth: 700, height: 800, seatHeight: 450, armHeight: 620 });
  assert.deepEqual(input?.variants[0].attributes, { Finish: "Natural Ash", Fabric: "Ivory" });
});

test("legacy, incomplete and stale approval snapshots do not gain an approval label", () => {
  assert.equal(approvedKeeriInput({ ...source(), schemaVersion: 1 }), null);
  assert.equal(approvedKeeriInput({ ...source(), approval: { ...source().approval, revision: "older" } }), null);
  assert.equal(approvedKeeriInput({ ...source(), geometryGroups: [{ id: "chair-standard" }] }), null);
  assert.match(inputBlockReason(product({ schemaVersion: 1 }))!, /Legacy input/);
});

test("manual product production is unaffected by Keeri evidence requirements", () => {
  assert.equal(inputBlockReason({ ...product(null), sourceType: "manual" }), null);
});

test("different shapes cannot be offered as material choices on one model", () => {
  const mixed = source();
  mixed.geometryGroups.push({ ...mixed.geometryGroups[0], id: "chair-large", dimensionsMm: { width: 800, depth: 900, height: 950 } });
  assert.match(inputBlockReason(product(mixed))!, /different shapes or sizes/);
  assert.equal(inputBlockReason(product(source())), null);
});

test("delivery evidence follows the selected job snapshot when the product has newer inputs", () => {
  const detail = product(source());
  detail.jobs = [{ id: "job-old", inputSnapshot: source("revision-old") }] as ThreeDProductDetail["jobs"];
  assert.equal(productionInput(detail, "job-old")?.sourceRevision, "revision-old");
  assert.equal(productionInput(detail)?.sourceRevision, "revision-a");
  assert.equal(productionInput(detail, "missing"), null);
});

test("a variant without the approved geometry ownership blocks production", () => {
  const invalid = source();
  invalid.variants[0].geometryGroupId = "different-design";
  assert.equal(approvedKeeriInput(invalid), null);
});
