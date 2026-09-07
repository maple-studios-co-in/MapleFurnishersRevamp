"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type {
  ManifestInput,
  ThreeDProductDetail,
  VersionInput,
} from "@/lib/three-d-api";
import { ErrorMessage, FieldSelect, dateLabel } from "./Fields";
import SwatchEditor from "./SwatchEditor";
import { inputBlockReason, productionInput } from "@/lib/three-d-evidence";

const ANGLES = ["perspective", "side", "front", "back"];
const splitNames = (value: string) =>
  value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

export default function VersionForm({
  product,
  isSaving,
  onSubmit,
  onCancel,
}: {
  product: ThreeDProductDetail;
  isSaving: boolean;
  onSubmit: (input: VersionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const previousVersion = [...product.versions].sort(
    (a, b) => b.sequence - a.sequence,
  )[0];
  const previous = previousVersion?.manifest;
  const [manifest, setManifest] = useState<ManifestInput>(() =>
    previous
      ? structuredClone(previous)
      : {
          schemaVersion: 1,
          modelAssetId: "",
          angles: ANGLES.map((label) => ({ label, assetId: "" })),
          dimensionsMm: { width: 0, depth: 0, height: 0 },
          viewerProfile: "studio-v1",
          materialSlots: { finish: [], fabric: [] },
          finishes: [],
          fabrics: [],
          defaults: { finish: "", fabric: "" },
          variantBindings: [],
          disclaimer:
            "Colors and proportions are indicative. Confirm dimensions and materials before ordering.",
        },
  );
  const [finishSlots, setFinishSlots] = useState(
    previous?.materialSlots.finish.join(", ") ?? "",
  );
  const [fabricSlots, setFabricSlots] = useState(
    previous?.materialSlots.fabric.join(", ") ?? "",
  );
  const [jobId, setJobId] = useState(
    product.jobs.find((job) => job.status === "awaiting_delivery" && !inputBlockReason(product, job.id))?.id ?? "",
  );
  const [notes, setNotes] = useState("");
  const [masterAssetId, setMasterAssetId] = useState(
    previousVersion?.masterAssetId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const models = product.assets.filter((asset) => asset.kind === "web_model");
  const images = product.assets.filter((asset) => asset.kind === "preview");
  const jobs = product.jobs.filter((job) => job.status === "awaiting_delivery" && !inputBlockReason(product, job.id));
  const source = product.sourceType === "keeri" ? productionInput(product, jobId || undefined) : null;
  const geometry = source?.geometryGroups.length === 1 ? source.geometryGroups[0] : null;
  const inputError = inputBlockReason(product, jobId || undefined);
  const variants = source?.variants.filter(variant => variant.geometryGroupId === geometry?.id) ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || isSaving) return;
    setError(null);
    if (inputError) return setError(inputError);
    const next: ManifestInput = {
      ...manifest,
      dimensionsMm: geometry ? { width: geometry.dimensionsMm.width, depth: geometry.dimensionsMm.depth, height: geometry.dimensionsMm.height } : manifest.dimensionsMm,
      materialSlots: {
        finish: manifest.finishes.length ? splitNames(finishSlots) : [],
        fabric: manifest.fabrics.length ? splitNames(fabricSlots) : [],
      },
      defaults: {
        finish: manifest.finishes.length ? manifest.defaults.finish : "",
        fabric: manifest.fabrics.length ? manifest.defaults.fabric : "",
      },
      finishes: manifest.finishes.map((swatch) => ({
        ...swatch,
        name: swatch.name.trim(),
      })),
      fabrics: manifest.fabrics.map((swatch) => ({
        ...swatch,
        name: swatch.name.trim(),
      })),
      variantBindings: manifest.variantBindings.map((binding) => ({
        ...binding,
        variantId: binding.variantId.trim(),
      })),
    };
    next.defaults.finish = next.defaults.finish.trim();
    next.defaults.fabric = next.defaults.fabric.trim();
    if (
      !models.some((asset) => asset.id === next.modelAssetId) ||
      next.angles.some(
        (angle) => !images.some((asset) => asset.id === angle.assetId),
      )
    )
      return setError(
        "Choose a web model and all four viewer images uploaded to this product.",
      );
    if (
      Object.values(next.dimensionsMm).some(
        (n) => !Number.isFinite(n) || n <= 0 || n > 100000,
      )
    )
      return setError(
        "Enter width, depth and height between 0 and 100,000 millimetres.",
      );
    if (!next.disclaimer.trim())
      return setError(
        "Add a customer note about the model’s dimensions and materials.",
      );
    for (const key of ["finish", "fabric"] as const) {
      const swatches = key === "finish" ? next.finishes : next.fabrics;
      if (
        new Set(swatches.map((swatch) => swatch.name)).size !== swatches.length
      )
        return setError(`Each ${key} needs a different name.`);
      if (
        swatches.length &&
        !swatches.some((swatch) => swatch.name === next.defaults[key])
      )
        return setError(`Choose an available default ${key}.`);
      if (swatches.length && !next.materialSlots[key].length)
        return setError(`Enter the model’s material names for ${key} options.`);
      if (
        new Set(next.materialSlots[key]).size !== next.materialSlots[key].length
      )
        return setError(`Remove repeated ${key} material names.`);
    }
    if (
      next.materialSlots.finish.some((name) =>
        next.materialSlots.fabric.includes(name),
      )
    )
      return setError(
        "A model material cannot be assigned to both finish and fabric controls.",
      );
    if (
      new Set(next.variantBindings.map((binding) => binding.variantId)).size !==
      next.variantBindings.length
    )
      return setError("Use each catalogue variant only once.");
    if (source && (next.variantBindings.some(binding => !variants.some(variant => variant.variantId === binding.variantId)) || (variants.length > 0 && next.variantBindings.length === 0)))
      return setError("Match catalogue variants from this approved geometry group. Different shapes or sizes need separate models.");
    if (
      next.variantBindings.some(
        (binding) =>
          !binding.variantId ||
          (next.finishes.length
            ? !next.finishes.some((s) => s.name === binding.finish)
            : binding.finish !== "") ||
          (next.fabrics.length
            ? !next.fabrics.some((s) => s.name === binding.fabric)
            : binding.fabric !== ""),
      )
    )
      return setError(
        "Each variant needs an available finish and fabric, or Original when that group has no options.",
      );
    if (
      next.variantBindings.length &&
      !next.variantBindings.some(
        (binding) =>
          binding.finish === next.defaults.finish &&
          binding.fabric === next.defaults.fabric,
      )
    )
      return setError(
        "Include the default finish and fabric combination in the variant matches.",
      );
    submitting.current = true;
    try {
      await onSubmit({
        ...(jobId ? { jobId } : {}),
        ...(masterAssetId ? { masterAssetId } : {}),
        manifest: next,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The version could not be saved.",
      );
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Create a model version</h3>
        <p className="mt-1 text-sm text-admin-text-muted">
          Choose the files and customer controls, then save a draft for review.
          {previous
            ? " Settings below start from the most recent version."
            : " The original model materials are kept unless you add options."}
        </p>
      </div>
      <FieldSelect
        label="Blender master for this version (optional)"
        value={masterAssetId}
        disabled={isSaving}
        onChange={(event) => setMasterAssetId(event.target.value)}
      >
        <option value="">No master attached</option>
        {product.assets
          .filter((asset) => asset.kind === "blender_master")
          .map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.filename}
            </option>
          ))}
      </FieldSelect>
      <p className="text-xs text-admin-text-muted">
        Attach the artist’s editable Blender file to preserve the source for
        this version. It remains private.
      </p>
      <ErrorMessage message={error} />
      <ErrorMessage message={inputError} />
      {geometry && source && (
        <div className="space-y-1 rounded-xl border border-admin-border bg-admin-bg/40 p-3 text-xs text-admin-text-muted">
          <p className="font-semibold text-admin-text">Approved source for this model</p>
          <p className="break-all">Geometry group: {geometry.id} · Revision: {source.approval.revision}</p>
          <p>Approved by {source.approval.approvedBy} · {dateLabel(source.approval.approvedAt)}</p>
          <p>Verified dimensions: {geometry.dimensionsMm.width} × {geometry.dimensionsMm.depth} × {geometry.dimensionsMm.height} mm</p>
          {geometry.dimensionsMm.seatHeight !== undefined && <p>Seat height: {geometry.dimensionsMm.seatHeight} mm</p>}
          {geometry.dimensionsMm.armHeight !== undefined && <p>Arm height: {geometry.dimensionsMm.armHeight} mm</p>}
          <p>Only variants sharing this shape and size can be matched to this model.</p>
        </div>
      )}
      <fieldset disabled={isSaving || !!inputError} className="space-y-6 disabled:opacity-60">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldSelect
            label="Web model"
            value={manifest.modelAssetId}
            required
            onChange={(e) =>
              setManifest({ ...manifest, modelAssetId: e.target.value })
            }
          >
            <option value="">Choose an uploaded GLB</option>
            {models.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.filename}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect
            label="Production job"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
          >
            <option value="">Independent delivery</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                Manual Blender · {dateLabel(job.createdAt)}{job.geometryGroupId ? ` · ${job.geometryGroupId}` : ""}
              </option>
            ))}
          </FieldSelect>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Four customer views</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {ANGLES.map((label) => (
              <FieldSelect
                key={label}
                label={`${label[0].toUpperCase() + label.slice(1)} image`}
                value={
                  manifest.angles.find((angle) => angle.label === label)
                    ?.assetId ?? ""
                }
                required
                onChange={(e) =>
                  setManifest({
                    ...manifest,
                    angles: ANGLES.map((name) => ({
                      label: name,
                      assetId:
                        name === label
                          ? e.target.value
                          : (manifest.angles.find(
                              (angle) => angle.label === name,
                            )?.assetId ?? ""),
                    })),
                  })
                }
              >
                <option value="">Choose a viewer image</option>
                {images.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </FieldSelect>
            ))}
          </div>
          <p className="mt-2 text-xs text-admin-text-muted">
            Upload images with the “Viewer image” file type before creating this
            version.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">
            Finished product dimensions
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {(["width", "depth", "height"] as const).map((dimension) => (
              <Input
                key={dimension}
                id={`dimension-${dimension}`}
                label={`${dimension[0].toUpperCase() + dimension.slice(1)} (mm)`}
                type="number"
                min="0.1"
                max="100000"
                step="any"
                required
                value={(geometry?.dimensionsMm ?? manifest.dimensionsMm)[dimension] || ""}
                readOnly={!!geometry}
                onChange={(e) =>
                  setManifest({
                    ...manifest,
                    dimensionsMm: {
                      ...manifest.dimensionsMm,
                      [dimension]: Number(e.target.value),
                    },
                  })
                }
              />
            ))}
          </div>
        </div>
        <FieldSelect
          label="Viewer setting"
          value={manifest.viewerProfile}
          onChange={(e) =>
            setManifest({
              ...manifest,
              viewerProfile: e.target.value as ManifestInput["viewerProfile"],
            })
          }
        >
          <option value="studio-v1">
            Studio — suitable for any furniture model
          </option>
          <option value="taro-photo-room-v1">
            Taro photographic room — calibrated Taro model only
          </option>
        </FieldSelect>
        <SwatchEditor
          label="Finish"
          swatches={manifest.finishes}
          slots={finishSlots}
          defaultName={manifest.defaults.finish}
          onChange={(finishes) =>
            setManifest((current) => ({ ...current, finishes }))
          }
          onSlotsChange={setFinishSlots}
          onDefaultChange={(finish) =>
            setManifest((current) => ({
              ...current,
              defaults: { ...current.defaults, finish },
            }))
          }
        />
        <SwatchEditor
          label="Fabric"
          swatches={manifest.fabrics}
          slots={fabricSlots}
          defaultName={manifest.defaults.fabric}
          onChange={(fabrics) =>
            setManifest((current) => ({ ...current, fabrics }))
          }
          onSlotsChange={setFabricSlots}
          onDefaultChange={(fabric) =>
            setManifest((current) => ({
              ...current,
              defaults: { ...current.defaults, fabric },
            }))
          }
        />
        <details className="rounded-xl border border-admin-border p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Catalogue variant matching {source ? "(required)" : "(optional)"}
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-xs text-admin-text-muted">
              {source ? "Match the available variants from this approved geometry group. Only the listed finish and fabric combinations will be offered." : "Link a catalogue variant to its finish and fabric. With no matches, every combination is available. With matches, only listed combinations are offered."}
            </p>
            {manifest.variantBindings.map((binding, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg bg-admin-surface-hover p-3 sm:grid-cols-2"
              >
                {source ? (
                  <FieldSelect label={`Variant ${index + 1} reference`} value={binding.variantId} required onChange={event => setManifest({ ...manifest, variantBindings: manifest.variantBindings.map((item, i) => i === index ? { ...item, variantId: event.target.value } : item) })}>
                    <option value="">Choose a variant from this geometry group</option>
                    {binding.variantId && !variants.some(variant => variant.variantId === binding.variantId) && <option value={binding.variantId} disabled>Previous match unavailable — choose again</option>}
                    {variants.map(variant => <option key={variant.variantId} value={variant.variantId}>{variant.sku || variant.name || variant.variantId}</option>)}
                  </FieldSelect>
                ) : (
                <Input
                  id={`variant-${index}`}
                  label={`Variant ${index + 1} reference`}
                  placeholder="Catalogue variant ID"
                  value={binding.variantId}
                  required
                  onChange={(e) =>
                    setManifest({
                      ...manifest,
                      variantBindings: manifest.variantBindings.map(
                        (item, i) =>
                          i === index
                            ? { ...item, variantId: e.target.value }
                            : item,
                      ),
                    })
                  }
                />
                )}
                {(["finish", "fabric"] as const).map((key) => (
                  <FieldSelect
                    key={key}
                    label={key === "finish" ? "Finish" : "Fabric"}
                    value={binding[key]}
                    onChange={(e) =>
                      setManifest({
                        ...manifest,
                        variantBindings: manifest.variantBindings.map(
                          (item, i) =>
                            i === index
                              ? { ...item, [key]: e.target.value }
                              : item,
                        ),
                      })
                    }
                  >
                    {!(key === "finish" ? manifest.finishes : manifest.fabrics)
                      .length && <option value="">Original</option>}
                    {(key === "finish"
                      ? manifest.finishes
                      : manifest.fabrics
                    ).map((swatch, i) => (
                      <option key={i} value={swatch.name}>
                        {swatch.name}
                      </option>
                    ))}
                  </FieldSelect>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setManifest({
                      ...manifest,
                      variantBindings: manifest.variantBindings.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Remove match {index + 1}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setManifest({
                  ...manifest,
                  variantBindings: [
                    ...manifest.variantBindings,
                    {
                      variantId: "",
                      finish: manifest.finishes[0]?.name ?? "",
                      fabric: manifest.fabrics[0]?.name ?? "",
                    },
                  ],
                })
              }
            >
              Add variant match
            </Button>
          </div>
        </details>
        <Textarea
          id="version-disclaimer"
          label="Customer note"
          required
          value={manifest.disclaimer}
          maxLength={1000}
          onChange={(e) =>
            setManifest({ ...manifest, disclaimer: e.target.value })
          }
        />
        <Textarea
          id="version-notes"
          label="Internal delivery notes"
          placeholder="What changed? Any details the reviewer should check?"
          value={notes}
          maxLength={4000}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="text-xs text-admin-text-muted">
          Saving creates an immutable draft. Preview and approve it before
          publishing to the customizer.
        </p>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={isSaving}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} disabled={!!inputError}>
          Save draft version
        </Button>
      </div>
    </form>
  );
}
