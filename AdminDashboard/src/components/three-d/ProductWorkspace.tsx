"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, Plus, RefreshCw, Upload } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  createThreeDVersion,
  downloadThreeDAsset,
  fetchThreeDProduct,
  queueThreeDJob,
  uploadThreeDAsset,
  type AssetKind,
  type ThreeDConfig,
  type ThreeDProductDetail,
} from "@/lib/three-d-api";
import { assetLabels, dateLabel, ErrorMessage, FieldSelect } from "./Fields";
import VersionForm from "./VersionForm";
import ImportHistory from "./ImportHistory";
import VersionsPanel, { type RunAction } from "./VersionsPanel";
import { inputBlockReason, productionInput } from "@/lib/three-d-evidence";

export default function ProductWorkspace({
  productId,
  config,
  refreshToken,
  onListRefresh,
}: {
  productId: string;
  config: ThreeDConfig | null;
  refreshToken: number;
  onListRefresh: () => Promise<void>;
}) {
  const [product, setProduct] = useState<ThreeDProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"production" | "versions">("production");
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [kind, setKind] = useState<AssetKind>("web_model");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const locked = useRef(false);
  const jobKey = useRef<string | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetchThreeDProduct(productId);
      if (request === requestId.current) setProduct(response.product);
    } catch (error) {
      if (request === requestId.current)
        setLoadError(
          error instanceof Error
            ? error.message
            : "The product could not be loaded.",
        );
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [productId]);
  useEffect(() => {
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh, refreshToken]);

  const runAction: RunAction = async (
    key,
    operation,
    message,
    shouldRefresh = true,
  ) => {
    if (locked.current)
      throw new Error("Please wait for the current action to finish.");
    locked.current = true;
    setBusy(key);
    setActionError(null);
    try {
      await operation();
      toast("success", message);
      if (shouldRefresh) await Promise.all([refresh(), onListRefresh()]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This action could not be completed.";
      setActionError(message);
      toast("error", message);
      throw error;
    } finally {
      locked.current = false;
      setBusy(null);
    }
  };

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return setActionError("Choose a file to upload.");
    if (file.size > 50 * 1024 * 1024)
      return setActionError("Each file must be 50 MB or smaller.");
    if (!file.size) return setActionError("Choose a file that is not empty.");
    try {
      await runAction(
        "upload",
        async () => {
          await uploadThreeDAsset(productId, kind, file);
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
        },
        `${file.name} uploaded.`,
      );
    } catch {
      /* Error remains visible above the workspace. */
    }
  }

  if (!product && loading)
    return (
      <div
        className="glass-card p-8 text-sm text-admin-text-muted"
        role="status"
      >
        Loading 3D product…
      </div>
    );
  if (!product)
    return (
      <div className="glass-card space-y-4 p-6">
        <ErrorMessage message={loadError} />
        <Button variant="secondary" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  const recipe = config?.recipes.find(
    (recipe) => recipe.id === "manual-blender",
  );
  const disabled = !!busy || loading || !!loadError;
  const sourceBlock = inputBlockReason(product);
  const source = productionInput(product);

  return (
    <section
      className="glass-card min-w-0 space-y-5 p-5 lg:p-6"
      aria-label={`${product.name} 3D workspace`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold">
              {product.name}
            </h2>
            <Badge variant={product.publishedVersionId ? "success" : "default"}>
              {product.publishedVersionId ? "Published" : "Not published"}
            </Badge>
          </div>
          <p className="mt-1 break-all text-xs text-admin-text-muted">
            /customize/{product.slug} ·{" "}
            {product.sourceType === "keeri"
              ? "Keeri catalogue input"
              : "Maple manual product"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!!busy}
          isLoading={loading}
          onClick={() => void refresh()}
          aria-label="Refresh selected product"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      <ErrorMessage
        message={
          loadError
            ? `Could not refresh this product: ${loadError}. Refresh before making more changes.`
            : actionError
        }
      />
      <div
        className="flex flex-wrap gap-2 border-b border-admin-border pb-4"
        role="tablist"
        aria-label="3D product workflow"
      >
        <Button
          variant={tab === "production" ? "primary" : "ghost"}
          size="sm"
          role="tab"
          aria-selected={tab === "production"}
          aria-controls="production-panel"
          id="production-tab"
          onClick={() => setTab("production")}
        >
          Production
        </Button>
        <Button
          variant={tab === "versions" ? "primary" : "ghost"}
          size="sm"
          role="tab"
          aria-selected={tab === "versions"}
          aria-controls="versions-panel"
          id="versions-tab"
          onClick={() => setTab("versions")}
        >
          Versions & publishing ({product.versions.length})
        </Button>
      </div>
      {tab === "production" ? (
        <div
          id="production-panel"
          role="tabpanel"
          aria-labelledby="production-tab"
          className="space-y-6"
        >
          <div className="rounded-xl bg-admin-bg/50 p-4">
            <h3 className="text-sm font-semibold">Production workflow</h3>
            <p className="mt-1 text-sm text-admin-text-muted">
              Start a Blender job, upload the artist’s files, then create a
              version to review in the Maple customizer.
            </p>
            <p className="mt-2 text-xs text-admin-text-muted">
              Manual delivery is available now. Automatic AI generation is not
              connected.
            </p>
          </div>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Production jobs</h3>
              <Button
                size="sm"
                disabled={disabled || !recipe || !!sourceBlock}
                isLoading={busy === "job"}
                onClick={() => {
                  jobKey.current ??= crypto.randomUUID();
                  void runAction(
                    "job",
                    async () => {
                      await queueThreeDJob(
                        productId,
                        "manual-blender",
                        jobKey.current!,
                      );
                      jobKey.current = null;
                    },
                    "Manual Blender job created. It is awaiting the artist’s delivery.",
                  ).catch(() => {});
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Start Blender job
              </Button>
            </div>
            {sourceBlock && <p className="text-xs text-admin-warning">{sourceBlock}</p>}
            {product.sourceType === "keeri" && source && !sourceBlock && <p className="break-all text-xs text-admin-text-muted">Production uses geometry group {source.geometryGroups[0].id}, approved in Keeri by {source.approval.approvedBy} on {dateLabel(source.approval.approvedAt)}.</p>}
            {!recipe && (
              <p className="text-xs text-admin-warning">
                The manual Blender recipe is unavailable. Refresh the workspace
                after the backend is configured.
              </p>
            )}
            {!product.jobs.length ? (
              <p className="text-sm text-admin-text-muted">
                No production jobs yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {product.jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-admin-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {config?.recipes.find(
                          (recipe) => recipe.id === job.recipeId,
                        )?.name ?? "Manual Blender delivery"}
                      </p>
                      <p className="mt-1 text-xs text-admin-text-muted">
                        Started {dateLabel(job.createdAt)} · Recipe{" "}
                        {job.recipeVersion}
                        {job.importId
                          ? " · Saved Keeri input"
                          : " · Maple input"}
                        {job.geometryGroupId ? ` · Geometry group ${job.geometryGroupId}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        job.status === "completed" ? "success" : "warning"
                      }
                    >
                      {job.status === "completed"
                        ? "Delivered"
                        : "Awaiting delivery"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-3">
            <h3 className="font-semibold">Files</h3>
            <form
              onSubmit={upload}
              className="space-y-3 rounded-xl border border-admin-border p-4"
            >
              <fieldset
                disabled={disabled}
                className="grid gap-3 md:grid-cols-[180px_1fr] disabled:opacity-60"
              >
                <FieldSelect
                  label="File purpose"
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as AssetKind);
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  {Object.entries(assetLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </FieldSelect>
                <div className="space-y-1.5">
                  <label
                    htmlFor="artifact-upload"
                    className="block text-xs font-medium text-admin-text-muted"
                  >
                    Choose file
                  </label>
                  <input
                    id="artifact-upload"
                    ref={fileInput}
                    type="file"
                    required
                    accept={
                      kind === "web_model"
                        ? ".glb"
                        : kind === "blender_master"
                          ? ".blend"
                          : ".png,.jpg,.jpeg,.webp"
                    }
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-xl border border-admin-border p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-admin-bg file:px-3 file:py-1.5 file:text-admin-text"
                  />
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-xs text-admin-text-muted">
                  Up to 50 MB per file. GLB, Blender, PNG, JPEG or WebP. Masters
                  and reference images remain private.
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={disabled || !file}
                  isLoading={busy === "upload"}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload file
                </Button>
              </div>
            </form>
            {!product.assets.length ? (
              <p className="text-sm text-admin-text-muted">
                Upload a web model and four viewer images to prepare the first
                version.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-admin-border">
                <ul className="divide-y divide-admin-border/60">
                  {product.assets.map((asset) => (
                    <li
                      key={asset.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium">
                          {asset.filename}
                        </p>
                        <p className="mt-1 text-xs text-admin-text-muted">
                          {assetLabels[asset.kind]} ·{" "}
                          {asset.sizeBytes < 1024 * 1024
                            ? `${Math.ceil(asset.sizeBytes / 1024)} KB`
                            : `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}{" "}
                          · {dateLabel(asset.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {["blender_master", "reference"].includes(
                          asset.kind,
                        ) && <Badge>Private</Badge>}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          isLoading={busy === `download-${asset.id}`}
                          aria-label={`Download ${asset.filename}`}
                          onClick={() =>
                            void runAction(
                              `download-${asset.id}`,
                              async () => {
                                const blob = await downloadThreeDAsset(
                                  asset.id,
                                );
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = asset.filename;
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.setTimeout(
                                  () => URL.revokeObjectURL(url),
                                  1000,
                                );
                              },
                              "File download started.",
                              false,
                            ).catch(() => {})
                          }
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-admin-bg/50 p-4">
            <div>
              <h3 className="font-semibold">Prepare a version for review</h3>
              <p className="mt-1 text-xs text-admin-text-muted">
                Choose the web model, four views, measurements and material
                options.
              </p>
            </div>
            <Button
              disabled={
                disabled ||
                !!sourceBlock ||
                !product.assets.some((asset) => asset.kind === "web_model") ||
                !product.assets.some((asset) => asset.kind === "preview")
              }
              onClick={() => setShowVersionForm(true)}
            >
              Create version
            </Button>
          </div>
          <ImportHistory product={product} />
        </div>
      ) : (
        <div id="versions-panel" role="tabpanel" aria-labelledby="versions-tab">
          <VersionsPanel
            product={product}
            busy={disabled ? (busy ?? "refresh") : null}
            runAction={runAction}
          />
        </div>
      )}
      <Modal
        isOpen={showVersionForm}
        onClose={() => {
          if (!busy) setShowVersionForm(false);
        }}
        title="Create a 3D model version"
        maxWidth="max-w-3xl"
      >
        <VersionForm
          product={product}
          isSaving={!!busy}
          onCancel={() => setShowVersionForm(false)}
          onSubmit={async (input) => {
            await runAction(
              "version",
              () => createThreeDVersion(productId, input),
              "Draft version saved. Preview it and record a review before publishing.",
            );
            setShowVersionForm(false);
            setTab("versions");
          }}
        />
      </Modal>
    </section>
  );
}
