"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import CustomizerHero, { CUSTOMIZER_FABRICS, CUSTOMIZER_FINISHES, type CustomizerSelection, type CustomizerStageProps } from "@/components/sections/CustomizerHero";
import { resolveSelection, selectionFromQuery, type PublicManifest } from "@/lib/three-d/manifest";
import { TARO_FALLBACK } from "@/lib/three-d/taro-fallback";

const TaroRoomScene = dynamic(() => import("./TaroRoomScene"), { ssr: false });
const Taro360Dialog = dynamic(() => import("./Taro360Dialog"), { ssr: false });
const VIEW_IDS = ["perspective", "side", "front", "back"];

/** Reuse the original /customize component so the two layouts cannot drift apart. */
export default function TaroExperience({ manifest = TARO_FALLBACK, preview = false }: { manifest?: PublicManifest; preview?: boolean }) {
  const initial: CustomizerSelection = { ...manifest.defaults, angle: 0 };
  const [selection, setSelection] = useState<CustomizerSelection>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const restore = () => {
      setSelection(selectionFromQuery(manifest, new URLSearchParams(window.location.search)));
      setHydrated(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [manifest]);

  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    for (const key of ["wood", "light", "savedWood", "savedFabric", "savedLight", "compare"]) url.searchParams.delete(key);
    if (selection.finish) url.searchParams.set("finish", selection.finish); else url.searchParams.delete("finish");
    if (selection.fabric) url.searchParams.set("fabric", selection.fabric); else url.searchParams.delete("fabric");
    url.searchParams.set("view", VIEW_IDS[selection.angle]);
    window.history.replaceState(window.history.state, "", url);
    setSaved(false);
  }, [selection, hydrated]);

  function saveLook(value: CustomizerStageProps) {
    const summary = [
      `MAPLE FURNISHERS — ${manifest.name.toUpperCase()}`,
      ...(value.finish ? [`Finish: ${value.finish}`] : []),
      ...(value.fabric ? [`Fabric: ${value.fabric}`] : []),
      `View: ${VIEW_IDS[value.angle]}`,
      "",
      manifest.disclaimer,
      "This is a saved visual choice, not a quote or order.",
      "",
      `Reopen: ${(() => { const url = new URL(window.location.href); url.searchParams.delete('preview'); return url.href; })()}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([summary], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Maple-${manifest.slug}-saved-look.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  }

  return <main>
    {preview && <div role="status" className="fixed left-4 top-24 z-50 rounded bg-[#741A14] px-4 py-2 text-sm text-white">Private preview · Not published</div>}
    <CustomizerHero selection={selection} onSelectionChange={next => setSelection(resolveSelection(manifest, next, next.fabric !== selection.fabric ? 'fabric' : 'finish'))} product={{
      name: manifest.name,
      modelUrl: manifest.modelUrl,
      fullScene: true,
      angles: manifest.angles.map((angle, index) => ({ ...angle, label: ['Three-quarter view', 'Side view', 'Front view', 'Back view'][index] })),
      finishes: manifest.finishes.filter(s => !manifest.variantBindings.length || manifest.variantBindings.some(b => b.finish === s.name)).map(s => ({ ...s, img: manifest.viewerProfile === 'taro-photo-room-v1' ? CUSTOMIZER_FINISHES.find(f => f.name === s.name)?.img : undefined })),
      fabrics: manifest.fabrics.filter(s => !manifest.variantBindings.length || manifest.variantBindings.some(b => b.fabric === s.name)).map(s => ({ ...s, img: manifest.viewerProfile === 'taro-photo-room-v1' ? CUSTOMIZER_FABRICS.find(f => f.name === s.name)?.img : undefined })),
      defaultFinish: manifest.defaults.finish,
      defaultFabric: manifest.defaults.fabric,
      priceLabel: saved ? "Look saved" : preview ? "Private preview" : "Visual prototype",
      note: manifest.disclaimer,
      actionLabel: "Save look",
      onAction: saveLook,
      // The modal owns the one active room renderer while it is open. Two
      // texture-rich contexts waste GPU memory and can evict the main view.
      renderStage: ({ angle, finish, fabric, finishColor, fabricColor, viewerOpen }) => viewerOpen ? null : <TaroRoomScene manifest={manifest} view={angle} finishName={finish} fabricName={fabric} finishColor={finishColor} fabricColor={fabricColor} className="!absolute inset-0 cursor-grab active:cursor-grabbing" />,
      renderViewer: ({ open, onClose, angle, finish, fabric, finishColor, fabricColor }) => <Taro360Dialog manifest={manifest} open={open} onClose={onClose} view={angle} finishName={finish} fabricName={fabric} finishColor={finishColor} fabricColor={fabricColor} />,
    }} />
  </main>;
}
