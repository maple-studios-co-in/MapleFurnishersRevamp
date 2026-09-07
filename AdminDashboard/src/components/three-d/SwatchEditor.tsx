"use client";

import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { FieldSelect } from "./Fields";
import type { Swatch } from "@/lib/three-d-api";

interface Props {
  label: "Finish" | "Fabric";
  swatches: Swatch[];
  slots: string;
  defaultName: string;
  onChange: (swatches: Swatch[]) => void;
  onSlotsChange: (slots: string) => void;
  onDefaultChange: (name: string) => void;
}

export default function SwatchEditor({
  label,
  swatches,
  slots,
  defaultName,
  onChange,
  onSlotsChange,
  onDefaultChange,
}: Props) {
  const update = (index: number, patch: Partial<Swatch>) => {
    const oldName = swatches[index].name;
    onChange(
      swatches.map((swatch, i) =>
        i === index ? { ...swatch, ...patch } : swatch,
      ),
    );
    if (patch.name !== undefined && defaultName === oldName)
      onDefaultChange(patch.name);
  };
  const add = () => {
    let name = label === "Finish" ? "Natural" : "Ivory";
    let suffix = 2;
    while (swatches.some((swatch) => swatch.name === name))
      name = `${label} ${suffix++}`;
    onChange([
      ...swatches,
      { name, hex: label === "Finish" ? "#9C704B" : "#E9E3D7" },
    ]);
    if (!swatches.length) onDefaultChange(name);
  };
  return (
    <div className="space-y-4 rounded-xl border border-admin-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{label} options</h4>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          Add {label.toLowerCase()}
        </Button>
      </div>
      {!swatches.length ? (
        <p className="text-xs text-admin-text-muted">
          Keep the model’s original {label.toLowerCase()} materials. Add options
          only when customers can change them.
        </p>
      ) : (
        <>
          <Input
            id={`${label}-material-slots`}
            label={`${label} material names in the model`}
            placeholder={
              label === "Finish"
                ? "e.g. Wood_Frame, Wood_Legs"
                : "e.g. Upholstery"
            }
            value={slots}
            onChange={(e) => onSlotsChange(e.target.value)}
            required
          />
          <p className="text-xs text-admin-text-muted">
            Ask the 3D artist for the exact material names. Separate multiple
            names with commas.
          </p>
          {swatches.map((swatch, index) => (
            <div
              key={index}
              className="space-y-2 border-t border-admin-border/60 pt-3"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                <Input
                  id={`${label}-name-${index}`}
                  label={`${label} ${index + 1} name`}
                  value={swatch.name}
                  required
                  maxLength={80}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
                <div className="flex items-end gap-2">
                  <input
                    type="color"
                    aria-label={`${label} ${index + 1} color picker`}
                    value={
                      /^#[\da-f]{6}$/i.test(swatch.hex) ? swatch.hex : "#000000"
                    }
                    onChange={(e) =>
                      update(index, {
                        hex: e.target.value,
                        linearColor: undefined,
                      })
                    }
                    className="h-10 w-9 shrink-0 cursor-pointer rounded border border-admin-border"
                  />
                  <Input
                    id={`${label}-hex-${index}`}
                    label="Color"
                    value={swatch.hex}
                    pattern="#[a-fA-F0-9]{6}"
                    required
                    onChange={(e) =>
                      update(index, {
                        hex: e.target.value,
                        linearColor: undefined,
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                  onClick={() => {
                    const next = swatches.filter((_, i) => i !== index);
                    onChange(next);
                    if (defaultName === swatch.name)
                      onDefaultChange(next[0]?.name ?? "");
                    if (!next.length) onSlotsChange("");
                  }}
                >
                  Remove
                </Button>
              </div>
              <details className="text-xs text-admin-text-muted">
                <summary className="cursor-pointer py-1">
                  Artist color calibration (optional)
                </summary>
                <p className="py-2">
                  Leave blank for standard color. Enter three linear RGB values
                  from 0 to 1 only when supplied by the artist.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {["Red", "Green", "Blue"].map((channel, c) => (
                    <Input
                      key={channel}
                      id={`${label}-linear-${index}-${c}`}
                      label={channel}
                      type="number"
                      min={0}
                      max={1}
                      step="any"
                      value={swatch.linearColor?.[c] ?? ""}
                      onChange={(e) => {
                        if (!e.target.value)
                          return update(index, { linearColor: undefined });
                        const color: [number, number, number] =
                          swatch.linearColor
                            ? [...swatch.linearColor]
                            : [0, 0, 0];
                        color[c] = Number(e.target.value);
                        update(index, { linearColor: color });
                      }}
                    />
                  ))}
                </div>
              </details>
            </div>
          ))}
          <FieldSelect
            label={`Default ${label.toLowerCase()}`}
            value={defaultName}
            onChange={(e) => onDefaultChange(e.target.value)}
          >
            {swatches.map((swatch, i) => (
              <option key={i} value={swatch.name}>
                {swatch.name || `Unnamed ${label.toLowerCase()}`}
              </option>
            ))}
          </FieldSelect>
        </>
      )}
    </div>
  );
}
