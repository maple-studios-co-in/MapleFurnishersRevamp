"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import {
  customizerUrl,
  previewThreeDVersion,
  publishThreeDVersion,
  reviewThreeDVersion,
  type ThreeDProductDetail,
  type ThreeDVersion,
} from "@/lib/three-d-api";
import { dateLabel, ErrorMessage } from "./Fields";

export type RunAction = (
  key: string,
  operation: () => Promise<unknown>,
  message: string,
  refresh?: boolean,
) => Promise<void>;

export default function VersionsPanel({
  product,
  busy,
  runAction,
}: {
  product: ThreeDProductDetail;
  busy: string | null;
  runAction: RunAction;
}) {
  const [publishVersion, setPublishVersion] = useState<ThreeDVersion | null>(
    null,
  );
  const [review, setReview] = useState<{
    version: ThreeDVersion;
    decision: "approved" | "rejected";
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [previewLinks, setPreviewLinks] = useState<
    Record<string, { url: string; expiresAt: string }>
  >({});

  async function preview(version: ThreeDVersion) {
    // Reserve the window during the click so browsers do not block an async popup.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      await runAction(
        `preview-${version.id}`,
        async () => {
          const result = await previewThreeDVersion(version.id);
          const url = customizerUrl(result.path);
          setPreviewLinks((links) => ({
            ...links,
            [version.id]: { url, expiresAt: result.expiresAt },
          }));
          if (popup) popup.location.replace(url);
        },
        "Private preview ready. The link expires in 15 minutes or less.",
        false,
      );
    } catch {
      popup?.close();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Versions & publishing</h3>
        <p className="mt-1 text-sm text-admin-text-muted">
          Preview the model, record a review, then publish the approved version.
          Previously approved versions can be restored.
        </p>
      </div>
      {!product.versions.length && (
        <div className="rounded-xl border border-dashed border-admin-border p-8 text-center text-sm text-admin-text-muted">
          No model versions yet. Upload the files in Production, then create a
          draft version.
        </div>
      )}
      {[...product.versions]
        .sort((a, b) => b.sequence - a.sequence)
        .map((version) => {
          const published = product.publishedVersionId === version.id;
          const manifest = version.manifest;
          const model = product.assets.find(
            (asset) => asset.id === manifest.modelAssetId,
          );
          const master = product.assets.find(
            (asset) => asset.id === version.masterAssetId,
          );
          const link = previewLinks[version.id];
          return (
            <article
              key={version.id}
              className={`space-y-4 rounded-xl border p-5 ${published ? "border-admin-success/40 bg-green-50/40" : "border-admin-border bg-admin-surface"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">Version {version.sequence}</h4>
                  <p className="mt-1 text-xs text-admin-text-muted">
                    Created {dateLabel(version.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      version.status === "approved"
                        ? "success"
                        : version.status === "draft"
                          ? "warning"
                          : "default"
                    }
                  >
                    {version.status === "draft"
                      ? "Needs review"
                      : version.status}
                  </Badge>
                  {published && (
                    <Badge variant="success">Live in customizer</Badge>
                  )}
                </div>
              </div>
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                {version.geometryGroupId && (
                  <div>
                    <dt className="text-admin-text-muted">Source geometry group</dt>
                    <dd className="mt-1 break-all font-medium">{version.geometryGroupId}</dd>
                  </div>
                )}
                {master && (
                  <div>
                    <dt className="text-admin-text-muted">
                      Blender master · Private
                    </dt>
                    <dd className="mt-1 break-all font-medium">
                      {master.filename}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-admin-text-muted">Web model</dt>
                  <dd className="mt-1 break-all font-medium">
                    {model?.filename ?? "Model unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-admin-text-muted">
                    Dimensions · width × depth × height
                  </dt>
                  <dd className="mt-1 font-medium">
                    {manifest.dimensionsMm.width} ×{" "}
                    {manifest.dimensionsMm.depth} ×{" "}
                    {manifest.dimensionsMm.height} mm
                  </dd>
                </div>
                <div>
                  <dt className="text-admin-text-muted">Customer materials</dt>
                  <dd className="mt-1 font-medium">
                    {manifest.finishes.length
                      ? `${manifest.finishes.length} finishes`
                      : "Original finish"}{" "}
                    ·{" "}
                    {manifest.fabrics.length
                      ? `${manifest.fabrics.length} fabrics`
                      : "Original fabric"}
                  </dd>
                </div>
                <div>
                  <dt className="text-admin-text-muted">Viewer</dt>
                  <dd className="mt-1 font-medium">
                    {manifest.viewerProfile === "studio-v1"
                      ? "Studio"
                      : "Taro photographic room"}
                  </dd>
                </div>
              </dl>
              {version.notes && (
                <p className="whitespace-pre-wrap text-sm text-admin-text-muted">
                  {version.notes}
                </p>
              )}
              {version.reviewedAt && (
                <div className="rounded-lg bg-admin-bg/40 p-3 text-xs">
                  <span className="font-medium">
                    Review · {dateLabel(version.reviewedAt)}
                  </span>
                  {version.reviewNotes && (
                    <p className="mt-1 whitespace-pre-wrap text-admin-text-muted">
                      {version.reviewNotes}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busy}
                  isLoading={busy === `preview-${version.id}`}
                  onClick={() => void preview(version)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open private preview
                </Button>
                {version.status === "draft" && (
                  <>
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => {
                        setDialogError(null);
                        setReviewNotes("");
                        setReview({ version, decision: "approved" });
                      }}
                    >
                      Review & approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!!busy}
                      onClick={() => {
                        setDialogError(null);
                        setReviewNotes("");
                        setReview({ version, decision: "rejected" });
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {version.status === "approved" && !published && (
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => {
                      setDialogError(null);
                      setPublishVersion(version);
                    }}
                  >
                    {product.publishedVersionId
                      ? "Publish this version"
                      : "Publish to customizer"}
                  </Button>
                )}
                {published && (
                  <a
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-admin-accent hover:underline"
                    href={customizerUrl(
                      `/customize/${encodeURIComponent(product.slug)}`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open live customizer{" "}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {link && (
                <p className="text-xs text-admin-text-muted">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-admin-accent underline"
                  >
                    Open preview in a new tab
                  </a>{" "}
                  · Expires {dateLabel(link.expiresAt)}
                </p>
              )}
              {version.status === "rejected" && (
                <p className="text-xs text-admin-text-muted">
                  Create a new version with the corrected files or settings to
                  request another review.
                </p>
              )}
            </article>
          );
        })}
      <Modal
        isOpen={!!review}
        title={
          review?.decision === "approved"
            ? "Review model version"
            : "Reject model version"
        }
        onClose={() => {
          if (!busy) setReview(null);
        }}
      >
        {review && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                `review-${review.version.id}`,
                () =>
                  reviewThreeDVersion(
                    review.version.id,
                    review.decision,
                    reviewNotes,
                  ),
                review.decision === "approved"
                  ? "Version approved. Publish it separately when ready."
                  : "Version rejected. A corrected version can be submitted.",
              )
                .then(() => setReview(null))
                .catch((error) =>
                  setDialogError(
                    error instanceof Error
                      ? error.message
                      : "Review could not be saved.",
                  ),
                );
            }}
            className="space-y-4"
          >
            <ErrorMessage message={dialogError} />
            <p className="text-sm">
              {review.decision === "approved"
                ? `Approve version ${review.version.sequence} after checking its model, four views, measurements and material controls in the private preview.`
                : `Record what needs changing in version ${review.version.sequence}.`}
            </p>
            <Textarea
              id="review-notes"
              label="Review notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              maxLength={4000}
              required={review.decision === "rejected"}
              placeholder={
                review.decision === "approved"
                  ? "What did you check?"
                  : "What should the artist correct?"
              }
            />
            <p className="text-xs text-admin-text-muted">
              This records the review. Publication is a separate action.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!!busy}
                onClick={() => setReview(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={review.decision === "rejected" ? "danger" : "primary"}
                isLoading={!!busy}
              >
                {review.decision === "approved"
                  ? "Approve version"
                  : "Reject version"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={!!publishVersion}
        title="Publish to the Maple customizer"
        onClose={() => {
          if (!busy) setPublishVersion(null);
        }}
      >
        {publishVersion && (
          <div className="space-y-4">
            <ErrorMessage message={dialogError} />
            <p className="text-sm">
              Customers will see{" "}
              <strong>
                {product.name}, version {publishVersion.sequence}
              </strong>{" "}
              at <span className="break-all">/customize/{product.slug}</span>.
            </p>
            {product.publishedVersionId && (
              <p className="text-sm text-admin-text-muted">
                This replaces the currently displayed model. You can restore an
                approved previous version from this workspace.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => setPublishVersion(null)}
              >
                Cancel
              </Button>
              <Button
                isLoading={!!busy}
                onClick={() =>
                  void runAction(
                    `publish-${publishVersion.id}`,
                    () => publishThreeDVersion(publishVersion.id),
                    "This version is now published in the Maple customizer.",
                  )
                    .then(() => setPublishVersion(null))
                    .catch((error) =>
                      setDialogError(
                        error instanceof Error
                          ? error.message
                          : "Version could not be published.",
                      ),
                    )
                }
              >
                Publish version {publishVersion.sequence}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
