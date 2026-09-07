# Keeri 3D source contract v2

This is the authoritative input contract for Maple's receiver. It replaces the earlier v1 proposal before any real Keeri integration. The public viewer manifest is a separate contract and remains version 1.

Implementation: `Backend/src/modules/three-d/source-contract.ts`. Executable tests: `Backend/test/three-d-source-contract.test.ts`.

## Example and test vectors

- [Complete export example](keeri-3d-source-v2.example.json)
- [Exact canonical hash-input bytes](keeri-3d-source-v2.canonical.json)

**The example is a synthetic contract fixture, not a photographed or verified real chair.** Its four images all describe the same 68-byte test PNG. The actor IDs, measurements and approvals are test values. Do not mark Taro or another real design ready using this fixture.

The example passes Maple's structural, attribution and hash validation. Its expected SHA-256 source revision is:

```text
0b024c0418bb890d9123efcb5085c4f2a6d4d8ac2ef62417ed320a7ea0a0d263
```

Its original-image checksum is:

```text
79d67cab43bcc2c581ee0623800b3e8997fa4bf75516bafa94d32f1a49f141d6
```

A second vector uses the same input but replaces the first variant's attributes with `{"2":"two","10":"ten"}`. The expected source revision is:

```text
a6f796e53d4d847357f2ad329c51e6ed2016481a34d6983de48aa2469874c925
```

This second case catches serializers that accidentally emit numeric-looking keys in numeric order.

## Exact source fields

Every object is strict. Unknown fields fail validation rather than disappearing. IDs are nonempty strings of at most 200 characters without surrounding whitespace. Names are nonblank strings of at most 120 characters. SHA-256 values are 64 lowercase hexadecimal characters. Dimensions are finite positive numbers at most 100,000, expressed in millimetres. Values are preserved without string trimming or Unicode normalization.

| Field | Required value |
| --- | --- |
| `schemaVersion` | `2` |
| `tenantId`, `modelId` | Stable company/design IDs. Both must match the authenticated/requested scope. |
| `name`, `code` | Name; code is a string of at most 120 characters. |
| `readyFor3D` | Literal `true`. An unapproved pack must not be exported. |
| `sourceRevision` | Canonical input SHA-256, recalculated and verified by Maple. |
| `approval` | `{ revision, approvedAt, approvedBy }`. The revision must equal `sourceRevision`; timestamp is ISO 8601 with UTC/offset; actor is a stable ID. |
| `geometryGroups` | 1–100 distinct `{ id, dimensionsMm, measurement, captureSetId }` objects. Maple's current pilot accepts exactly one group. |
| `variants` | 0–5,000 distinct `{ variantId, sku, geometryGroupId, attributes, dimensionsMm? }` objects. |
| `references` | 4–100 distinct reference objects, defined below. Current pilot limit: 24. |

`dimensionsMm` has required `width`, `depth`, `height`, and optional `seatHeight` and `armHeight`; no other properties. `measurement` has `{ method, verifiedAt, verifiedBy }`: a nonblank method up to 1,000 characters, an ISO timestamp and a verifier ID. Every geometry group must have independently verified dimensions.

Each variant's `sku` is a nonempty string of at most 200 characters. `attributes` is a flat map with at most 100 keys; keys are 1–120 characters and values are strings of 1–200 characters. Resolve inherited materials before exporting. Nested attribute objects are not accepted. Optional variant dimensions must exactly equal the referenced group's dimensions, including the presence/value of optional seat/arm measurements. A different size or construction belongs in another geometry group.

Each reference has exactly:

```text
id, role, geometryGroupId, captureSetId, variantId,
url, checksum, sizeBytes, provenance
```

- `role`: `front`, `side`, `back`, `angle`, `detail` or `dimension`.
- `variantId`: an explicit ID or `null` for a group-level reference. Omission is invalid. A non-null variant must belong to that geometry group.
- `geometryGroupId`: a group in this design; `captureSetId` must equal that group's capture set.
- `url`: HTTPS URL. Prefer Keeri's authenticated same-origin original-byte endpoint.
- `checksum`: SHA-256 of the exact original bytes; `sizeBytes`: positive integer at most 52,428,800 (50 MiB).
- `provenance`: `photograph`, `generated` or `unknown`.

Every group needs `front`, `side`, `back` and `angle` references with `provenance: "photograph"` in its declared capture set. Generated/unknown images can supplement the pack but do not count toward those four views. The schema verifies the declared relationships; Keeri's human approval must establish that these labels describe real evidence.

## Canonical revision algorithm

1. Select **only** `schemaVersion`, `tenantId`, `modelId`, `name`, `code`, `geometryGroups`, `variants` and `references` from the source.
2. Keep every field inside those objects except `references[*].url`.
3. Sort `geometryGroups` by `id`, `variants` by `variantId`, and `references` by `id`. Do not sort by names, SKU, role or checksum.
4. Recursively serialize JSON object keys in ascending **UTF-16 code-unit lexical order**. Sort with an explicit code-unit comparison, never a locale-sensitive comparison. Numeric-looking keys are still lexical: `"10"` precedes `"2"`. Emit the serialized keys directly; building a sorted JavaScript object and then calling `JSON.stringify` incorrectly reorders integer-looking keys.
5. Use compact JSON without indentation, spaces between tokens, BOM or trailing newline. Preserve array order after step 3. Strings/finite numbers use ECMAScript JSON scalar serialization; do not normalize Unicode, timestamps or number precision. For another language, use a serializer compatible with these exact rules and verify both vectors.
6. SHA-256 the UTF-8 bytes and emit lowercase hexadecimal.

`approval`, `readyFor3D` and `sourceRevision` never enter the hash; approval therefore has no circular dependency. Original URLs, URL expiry and request time never enter it. Measurement verification timestamps **do** enter it because they are part of the approved evidence. Changing an approval actor/date without changing source content does not change the content revision.

The same algorithm is used after Maple removes all download URLs. Its strict stored snapshot additionally contains `storedReferences: [{ referenceId, assetId, sha256 }]`. This Maple-only field is excluded from the hash and is never accepted in a Keeri wire export. Every reference must map to one distinct private Maple asset with the matching checksum.

## List response

`GET /api/integrations/maple/3d/products?limit=20&cursor=<opaque>` returns exactly:

```json
{
  "schemaVersion": 2,
  "tenantId": "tenant-a",
  "products": [
    {
      "modelId": "chair",
      "name": "Chair",
      "code": "CHAIR",
      "sourceRevision": "0b024c0418bb890d9123efcb5085c4f2a6d4d8ac2ef62417ed320a7ea0a0d263"
    }
  ],
  "nextCursor": null
}
```

Maximum 20 entries with distinct design IDs. `nextCursor` is `null` or a nonempty opaque string up to 2,000 characters. A page is tenant-scoped and is not a complete inventory or a withdrawal event. A detail response is the full source example, not this summary row.

## Current Maple intake limits

The reusable schema supports future geometry recipes, while this pilot deliberately applies tighter import limits:

| Boundary | Limit |
| --- | --- |
| Geometry groups accepted per design | 1 |
| References per imported design | 24 |
| Declared/downloaded bytes per design | 200 MiB |
| Original file | 50 MiB |
| Import-worker download budget per persisted batch (one page) | 500 MiB total across retries and worker restarts |
| List entries per page | 20 |
| JSON response | 2 MiB |
| Individual HTTP request | 15 seconds |
| Worker attempt | 5 minutes |

The 500 MiB budget is stored on the batch and is not reset for a retry, a new worker attempt or a worker restart. The five-minute deadline applies to each worker attempt.

A later recipe can support multiple geometries without redefining the input contract. The current receiver rejects them explicitly; it never chooses a group silently or represents a larger chair using a material swatch.
