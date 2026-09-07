"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";
import { downloadThreeDAsset, type ThreeDProductDetail } from "@/lib/three-d-api";
import { approvedKeeriInput } from "@/lib/three-d-evidence";
import { dateLabel, ErrorMessage } from "./Fields";

export default function ImportHistory({ product }: { product: ThreeDProductDetail }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);

  async function download(assetId: string) {
    const asset = product.assets.find(candidate => candidate.id === assetId && candidate.kind === "reference");
    if (!asset || locked.current) return;
    locked.current = true;
    setDownloading(assetId);
    setError(null);
    try {
      const blob = await downloadThreeDAsset(assetId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The private reference could not be downloaded.");
    } finally {
      locked.current = false;
      setDownloading(null);
    }
  }

  return (
    <details className="rounded-xl border border-admin-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Source & import history {product.imports.length ? `(${product.imports.length})` : ""}
      </summary>
      <div className="mt-4 space-y-3 text-sm text-admin-text-muted">
        <ErrorMessage message={error} />
        {product.sourceType === "manual" ? (
          <p>This product was created in Maple. Its production jobs, files and publication are managed here.</p>
        ) : (
          <>
            <p>Keeri supplies approved catalogue inputs. Maple keeps each imported revision and its private original images for production history.</p>
            {product.imports.length ? (
              <ol className="space-y-3">
                {product.imports.map(entry => {
                  const source = approvedKeeriInput(entry.snapshot);
                  return (
                    <li key={entry.id} className="space-y-3 rounded-lg bg-admin-bg/40 p-3">
                      <p className="font-medium">Imported {dateLabel(entry.createdAt)}{entry.sourceRevision === product.sourceRevision ? " · Current input" : ""}</p>
                      <p className="break-all text-xs">Revision {entry.sourceRevision}</p>
                      {!source ? (
                        <p className="text-xs text-admin-warning">Legacy input — reimport approved inputs. This snapshot does not contain verified approval and measurement evidence.</p>
                      ) : (
                        <>
                          <div className="space-y-1 rounded-lg border border-admin-border p-3 text-xs">
                            <p className="font-semibold text-admin-text">Approved in Keeri</p>
                            <p>By {source.approval.approvedBy} · {dateLabel(source.approval.approvedAt)}</p>
                            <p className="break-all">Approved revision: {source.approval.revision}</p>
                          </div>
                          {source.geometryGroups.map(group => (
                            <div key={group.id} className="space-y-1 text-xs">
                              <p className="break-all font-semibold text-admin-text">Geometry group: {group.id}</p>
                              <p>Width × depth × height: {group.dimensionsMm.width} × {group.dimensionsMm.depth} × {group.dimensionsMm.height} mm</p>
                              {group.dimensionsMm.seatHeight !== undefined && <p>Seat height: {group.dimensionsMm.seatHeight} mm</p>}
                              {group.dimensionsMm.armHeight !== undefined && <p>Arm height: {group.dimensionsMm.armHeight} mm</p>}
                              <p>Measured using {group.measurement.method.replaceAll("_", " ")}</p>
                              <p>Verified by {group.measurement.verifiedBy} · {dateLabel(group.measurement.verifiedAt)}</p>
                              <p className="break-all">Photo capture set: {group.captureSetId}</p>
                            </div>
                          ))}
                          <p className="text-xs">{source.variants.length} catalogue variants · {source.references.length} reference images</p>
                          {source.variants.length > 0 && <details className="rounded-lg border border-admin-border p-3 text-xs">
                            <summary className="cursor-pointer font-semibold text-admin-text">Approved catalogue variants</summary>
                            <ul className="mt-2 space-y-2">{source.variants.map(variant => <li key={variant.variantId} className="space-y-1">
                              <p className="break-all font-medium">{variant.sku || variant.variantId} · {variant.variantId}</p>
                              <p className="break-all">Geometry group: {variant.geometryGroupId}</p>
                              {Object.entries(variant.attributes).map(([label, value]) => <p key={label} className="break-words">{label}: {value}</p>)}
                            </li>)}</ul>
                          </details>}
                          <ul className="space-y-2">
                            {source.references.map(reference => {
                              const stored = source.storedReferences.find(item => item.referenceId === reference.id);
                              const asset = product.assets.find(item => item.id === stored?.assetId && item.kind === "reference");
                              const variant = source.variants.find(item => item.variantId === reference.variantId);
                              return (
                                <li key={reference.id} className="space-y-1 rounded-lg border border-admin-border p-3 text-xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="break-all font-semibold text-admin-text">{reference.role.replaceAll("_", " ")} · {reference.id}</p>
                                    {asset && <Button type="button" variant="ghost" size="sm" disabled={!!downloading} isLoading={downloading === asset.id} onClick={() => void download(asset.id)} aria-label={`Download private reference ${reference.id}`}><Download className="h-3.5 w-3.5" /> Download original</Button>}
                                  </div>
                                  <p>Source: {reference.provenance.replaceAll("_", " ")}</p>
                                  <p className="break-all">Geometry group: {reference.geometryGroupId} · Capture set: {reference.captureSetId}</p>
                                  <p className="break-all">{reference.variantId ? `Variant: ${variant?.sku || variant?.name || reference.variantId} (${reference.variantId})` : "Applies to the geometry group"}</p>
                                  {reference.provenance !== "photograph" && <p className="text-admin-warning">Visual guidance only. This image is not a verified photograph of the furniture.</p>}
                                  <p className="break-all">Checksum: {reference.checksum}</p>
                                  <p>{typeof reference.sizeBytes === "number" ? `${(reference.sizeBytes / 1024 / 1024).toFixed(2)} MB · ` : ""}{asset ? "Original saved privately in Maple" : "Private original is unavailable in this snapshot"}</p>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : <p>No import history available.</p>}
            <p className="text-xs">Importing new inputs leaves the published customizer version in place until a new version is reviewed and published. Keeri approval records the source evidence; Maple reviews the finished 3D model separately.</p>
          </>
        )}
      </div>
    </details>
  );
}
