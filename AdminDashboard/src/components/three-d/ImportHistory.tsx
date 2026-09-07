import type { ThreeDProductDetail } from "@/lib/three-d-api";
import { dateLabel } from "./Fields";

function summary(snapshot: unknown) {
  const source =
    snapshot && typeof snapshot === "object"
      ? (snapshot as Record<string, unknown>)
      : {};
  const sizes =
    source.dimensionsMm && typeof source.dimensionsMm === "object"
      ? (source.dimensionsMm as Record<string, unknown>)
      : {};
  const dimensions = [sizes.width, sizes.depth, sizes.height].every(
    (size) => typeof size === "number" && size > 0,
  )
    ? `${sizes.width} × ${sizes.depth} × ${sizes.height} mm`
    : null;
  const variants = Array.isArray(source.variants) ? source.variants.length : 0;
  const references = Array.isArray(source.references) ? source.references : [];
  const generated = references.filter(
    (reference) => reference?.provenance === "generated",
  ).length;
  return { dimensions, variants, references: references.length, generated };
}

export default function ImportHistory({
  product,
}: {
  product: ThreeDProductDetail;
}) {
  return (
    <details className="rounded-xl border border-admin-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Source & import history{" "}
        {product.imports.length ? `(${product.imports.length})` : ""}
      </summary>
      <div className="mt-4 space-y-3 text-sm text-admin-text-muted">
        {product.sourceType === "manual" ? (
          <p>
            This product was created in Maple. Its production jobs, files and
            publication are managed here.
          </p>
        ) : (
          <>
            <p>
              Keeri supplies catalogue inputs. Maple keeps each imported
              revision for production history.
            </p>
            {product.imports.length ? (
              <ol className="space-y-2">
                {product.imports.map((entry) => {
                  const source = summary(entry.snapshot);
                  return (
                    <li
                      key={entry.id}
                      className="space-y-2 rounded-lg bg-admin-bg/40 p-3"
                    >
                      <p className="font-medium">
                        {dateLabel(entry.createdAt)}
                        {entry.sourceRevision === product.sourceRevision
                          ? " · Current input"
                          : ""}
                      </p>
                      <p className="text-xs">
                        {source.variants} catalogue variants ·{" "}
                        {source.references} reference images
                      </p>
                      {source.dimensions && (
                        <p className="text-xs">
                          Width × depth × height: {source.dimensions}
                        </p>
                      )}
                      {source.generated > 0 && (
                        <p className="text-xs text-admin-warning">
                          {source.generated} generated reference
                          {source.generated === 1 ? "" : "s"}. These are visual
                          guidance; verify physical dimensions and materials
                          independently.
                        </p>
                      )}
                      <p className="break-all text-xs">
                        Revision {entry.sourceRevision}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p>No import history available.</p>
            )}
            <p className="text-xs">
              Fetching new catalogue inputs leaves the published customizer
              version in place until a new version is reviewed and published.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
