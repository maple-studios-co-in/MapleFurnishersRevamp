"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import CustomizerHero, { CUSTOMIZER_FABRICS, CUSTOMIZER_FINISHES, type CustomizerSelection, type CustomizerStageProps } from "@/components/sections/CustomizerHero";

const TaroRoomScene = dynamic(() => import("./TaroRoomScene"), { ssr: false });
const Taro360Dialog = dynamic(() => import("./Taro360Dialog"), { ssr: false });
const VIEW_IDS = ["perspective", "side", "front", "back"];
const INITIAL: CustomizerSelection = { finish: "Walnut Brown", fabric: "Ivory", angle: 0 };
const LEGACY_WOODS: Record<string, string> = { natural: "Natural Ash", walnut: "Walnut Brown", ebonised: "Ebony" };
const LEGACY_FABRICS: Record<string, string> = { oat: "Ivory", moss: "Sand", clay: "Mauve", ink: "Charcoal" };

/** Reuse the original /customize component so the two layouts cannot drift apart. */
export default function TaroExperience() {
  const [selection, setSelection] = useState<CustomizerSelection>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const wood = params.get("finish") ?? LEGACY_WOODS[params.get("wood") ?? ""];
      const upholstery = params.get("fabric");
      const fabric = LEGACY_FABRICS[upholstery ?? ""] ?? upholstery;
      const view = VIEW_IDS.indexOf(params.get("view") ?? "perspective");
      setSelection({
        finish: CUSTOMIZER_FINISHES.some(f => f.name === wood) ? wood : INITIAL.finish,
        fabric: CUSTOMIZER_FABRICS.some(f => f.name === fabric) ? fabric : INITIAL.fabric,
        angle: view >= 0 ? view : 0,
      });
      setHydrated(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    for (const key of ["wood", "light", "savedWood", "savedFabric", "savedLight", "compare"]) url.searchParams.delete(key);
    url.searchParams.set("finish", selection.finish ?? INITIAL.finish!);
    url.searchParams.set("fabric", selection.fabric ?? INITIAL.fabric!);
    url.searchParams.set("view", VIEW_IDS[selection.angle]);
    window.history.replaceState(window.history.state, "", url);
    setSaved(false);
  }, [selection, hydrated]);

  function saveLook(value: CustomizerStageProps) {
    const summary = [
      "MAPLE FURNISHERS — TARO ARMCHAIR",
      `Finish: ${value.finish ?? INITIAL.finish}`,
      `Fabric: ${value.fabric ?? INITIAL.fabric}`,
      `View: ${VIEW_IDS[value.angle]}`,
      "",
      "Illustrative 3D prototype. Shape, finishes and measurements await approval.",
      "This is a saved visual choice, not a quote or order.",
      "",
      `Reopen: ${window.location.href}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([summary], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Maple-Taro-saved-look.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  }

  return <main>
    <CustomizerHero selection={selection} onSelectionChange={setSelection} product={{
      name: "Taro Armchair",
      modelUrl: "/media/models/taro/taro-v4.glb",
      fullScene: true,
      angles: [
        { src: "/media/models/taro/taro-v4-perspective.webp", label: "Three-quarter view" },
        { src: "/media/models/taro/taro-v4-side.webp", label: "Side view" },
        { src: "/media/models/taro/taro-v4-front.webp", label: "Front view" },
        { src: "/media/models/taro/taro-v4-back.webp", label: "Back view" },
      ],
      defaultFinish: INITIAL.finish!,
      defaultFabric: INITIAL.fabric!,
      priceLabel: saved ? "Look saved" : "Visual prototype",
      note: "Illustrative model | Measurements & finishes unverified",
      actionLabel: "Save look",
      onAction: saveLook,
      // The modal owns the one active room renderer while it is open. Two
      // texture-rich contexts waste GPU memory and can evict the main view.
      renderStage: ({ angle, finishColor, fabricColor, viewerOpen }) => viewerOpen ? null : <TaroRoomScene view={angle} finishColor={finishColor} fabricColor={fabricColor} className="!absolute inset-0 cursor-grab active:cursor-grabbing" />,
      renderViewer: ({ open, onClose, angle, finishColor, fabricColor }) => <Taro360Dialog open={open} onClose={onClose} view={angle} finishColor={finishColor} fabricColor={fabricColor} />,
    }} />
  </main>;
}
