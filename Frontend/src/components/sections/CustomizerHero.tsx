"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Icon360 from "@/components/ui/Icon360";
import Viewer360 from "@/components/ui/Viewer360";
import ChairStage2D from "./ChairStage2D";

/* The 3D stage is client-only — three.js touches `window` at module scope
 * and there is nothing meaningful to server-render for a WebGL canvas. It
 * is also only ever loaded when a real model is present, so the three.js
 * bundle stays out of the page until there is something worth rendering. */
const ChairScene = dynamic(() => import("@/components/three/ChairScene"), {
  ssr: false,
});

/* Declared here rather than imported from the three/ module so that
 * probing for the model does not drag three.js into the main bundle. */
const CHAIR_GLB_URL = "/media/customizer/models/axtra-chair.glb";

/** Fraction of the stage box the piece fills — half of the 0.99 the flat
 *  stage used to fit to. ChairScene has its own twin of this (FRAME_FILL),
 *  halved to match, so the two stages read at the same size. */
const STAGE_FILL = 0.495;




/* Page type, per spec: Red Hat Display 18px / 400, ls 1.8px, #FFF —
 * applied across the page INCLUDING the right menu. The swatch labels are
 * the one exception: 68px circles sit ~65px apart, so an 18px "Walnut
 * Brown" would collide with its neighbour. The product card below runs on
 * its own measured spec (CARD_*) rather than on this. */
const PAGE_TYPE = {
  color: "#FFF",
  fontFamily: "var(--font-redhat)",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "normal",
  letterSpacing: "1.8px",
} as const;

const PANEL_EXTEND_PX = 52;
const PANEL_W = 470 + PANEL_EXTEND_PX;
/* The product card. 496x196 rather than the original 456x167: at the
 * smaller size the four rows had no air between them and the Shop Now
 * label ran out of its chip. 496 leaves the card inset ~11px on the left
 * of the 522 panel and 15px on the right, so it reads as one column. */
const CARD_W = 496;
const CARD_H = 196;

/* ---- product-card type, verbatim from the design spec --------------- */

const CARD_TITLE = {
  color: "#FFF",
  fontFamily: '"Red Hat Display", var(--font-redhat)',
  fontSize: "15px",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "normal",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
} as const;

/** The "Walnut Brown/Olive" configuration line. */
const CARD_VARIANT = {
  color: "#FFF",
  fontFamily: '"Red Hat Display", var(--font-redhat)',
  fontSize: "14px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "normal",
  letterSpacing: "1.4px",
} as const;

const CARD_PRICE = {
  color: "#FFF",
  fontFamily: '"Red Hat Display", var(--font-redhat)',
  fontSize: "15px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "normal",
  letterSpacing: "0.75px",
} as const;

/**
 * Shop Now. The spec's 88×16 is the *label* box, not the button: at
 * 15px/700 with 0.75px tracking "SHOP NOW" measures ~91px, so pinning the
 * width to 88 wrapped it to two lines that spilled out of the gold chip.
 * The label keeps 88px as a floor and holds one line; the chip pads
 * around it.
 */
const CARD_CTA_LABEL = {
  display: "flex",
  minWidth: "88px",
  height: "16px",
  flexDirection: "column",
  justifyContent: "center",
  whiteSpace: "nowrap",
  textAlign: "center",
  color: "#741A14",
  fontFamily: '"Red Hat Display", var(--font-redhat)',
  fontSize: "15px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "normal",
  letterSpacing: "0.75px",
  textTransform: "uppercase",
} as const;

/** The gold chip the label sits in. */
const CARD_CTA_CHIP = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 16px",
  borderRadius: 4,
} as const;

const CARD_DELIVERY = {
  color: "#FFF",
  fontFamily: '"Red Hat Display", var(--font-redhat)',
  fontSize: "10px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "normal",
  letterSpacing: "1px",
  textTransform: "uppercase",
} as const;


const T = {
  bgBase: "#0A0705",
  gold: "#DFA35C",
  goldBtn: "#CAA676",
  textOnGold: "#4D3D28",
} as const;


const FINISHES = [
  { name: "Natural Ash", hex: "#d6883b", img: "/media/customizer/swatches/finish-natural-ash.png" },
  { name: "Walnut Brown", hex: "#5e4230", img: "/media/customizer/swatches/finish-walnut-brown.png" },
  { name: "Dark Oak", hex: "#9c8364", img: "/media/customizer/swatches/finish-dark-oak.png" },
  { name: "Ebony", hex: "#63595a", img: "/media/customizer/swatches/finish-ebony.png" },
] as const;

const FABRICS = [
  { name: "Ivory", label: "Ivory", hex: "#beb4a5", img: "/media/customizer/swatches/fabric-ivory.png" },
  { name: "Sand", label: "Sand", hex: "#958068", img: "/media/customizer/swatches/fabric-sand.png" },
  { name: "Mauve", label: "Dark Oak", hex: "#6a5759", img: "/media/customizer/swatches/fabric-mauve.png" },
  { name: "Charcoal", label: "Dark Oak", hex: "#6b6b6b", img: "/media/customizer/swatches/fabric-charcoal.png" },
] as const;

const ANGLES = [
  { src: "/media/customizer/axtra-chair.png", label: "Three-quarter view" },
  { src: "/media/customizer/angles/side.png", label: "Side view" },
  { src: "/media/customizer/angles/front.png", label: "Front view" },
  { src: "/media/customizer/angles/back.png", label: "Back view" },
] as const;

/** Flat source list for the no-WebGL fallback stage. */
const ANGLE_SRCS = ANGLES.map((a) => a.src);

/* ---- inline icons ---- */
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DFA35C] focus-visible:outline-offset-2";

function Swatch({
  name, label, img, selected, onSelect,
}: {
  name: string; label?: string; img: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={name}
        onClick={onSelect}
        className={`h-[68px] w-[68px] overflow-hidden rounded-full transition-all duration-200 hover:scale-110 ${focusRing}`}
        style={{
          boxShadow: selected
            ? `0 0 0 2.5px ${T.gold}, 0 0 16px rgba(223,163,92,0.35)`
            : "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" className="h-full w-full object-cover" />
      </button>
      <span
        className="text-center leading-[1.3] text-white/70"
        style={{ ...PAGE_TYPE, fontSize: "11px", letterSpacing: "1.1px", color: undefined }}
      >
        {label ?? name}
      </span>
    </div>
  );
}

/* ================================================================= */

export default function CustomizerHero() {
  /** null = untouched: that aspect of the chair keeps its original pixels. */
  const [finish, setFinish] = useState<(typeof FINISHES)[number]["name"] | null>(null);
  const [fabric, setFabric] = useState<(typeof FABRICS)[number]["name"] | null>(null);
  const [angle, setAngle] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);

  /* ---- panel fit-to-height zoom (desktop) ---- */
  const panelInnerRef = useRef<HTMLDivElement>(null);
  const [panelFit, setPanelFit] = useState<{ scale: number; h: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = panelInnerRef.current;
      if (!el) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setPanelFit(null);
        return;
      }
      const natural = el.offsetHeight;
      // 94 = the frame's box-top measure (clears the navbar's Shop Now);
      // 82 reserves the bottom-nav band so the card never collides.
      const avail = window.innerHeight - 94 - 82;
      const scale = Math.min(1, Math.max(0.6, avail / natural));
      setPanelFit({ scale, h: natural });
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, [panelOpen]);

  const finishHex = finish ? FINISHES.find((f) => f.name === finish)!.hex : null;
  const fabricHex = fabric ? FABRICS.find((f) => f.name === fabric)!.hex : null;

  /* ---- which stage renders the piece ----
   *
   * "flat" is the real product photography, recoloured per pixel. "webgl"
   * is a live 3D scene, and it is only used when an actual model file is
   * present — a reconstructed mesh looked markedly worse than the render
   * it was derived from, so the flat stage is the better default and the
   * 3D one is the upgrade path.
   *
   * Drop a model at CHAIR_GLB_URL and this switches over on next load;
   * remove it and the page falls back here. No code change either way. */
  const [stage, setStage] = useState<"flat" | "webgl" | null>(null);
  useEffect(() => {
    let cancelled = false;
    const hasWebgl = () => {
      try {
        const probe = document.createElement("canvas");
        return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
      } catch {
        return false;
      }
    };
    if (!hasWebgl()) {
      setStage("flat");
      return;
    }
    // HEAD, so a missing model costs one 404 rather than a failed download.
    fetch(CHAIR_GLB_URL, { method: "HEAD" })
      .then((r) => {
        if (!cancelled) setStage(r.ok ? "webgl" : "flat");
      })
      .catch(() => {
        if (!cancelled) setStage("flat");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="Make it yours — customize the Axtra Lounge Chair"
      className="relative overflow-hidden lg:h-[100dvh]"
      style={{ backgroundColor: T.bgBase }}
    >
      {/* chairless interior — the canvas chair is the only chair */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/media/customizer/bg-interior.webp)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(10,7,5,0.45) 0%, rgba(10,7,5,0.1) 26%, rgba(10,7,5,0) 42%, rgba(10,7,5,0) 60%, rgba(10,7,5,0.3) 100%)",
        }}
      />

      <div className="relative flex h-full w-full flex-col gap-6 px-6 pb-10 pt-28 lg:block lg:px-0 lg:pb-0 lg:pt-0">
        {/* ---- left: copy — frame coords x162.85 / y240.62 (25.8% of the
            934-tall frame); the two-line heading ends right at the chair's
            top edge, overlapping it slightly like the frame. ---- */}
        {/* z-10: the chair stage now runs wider than this column so the
            piece reads at full scale, and it must pass BEHIND the copy. */}
        <div className="relative z-10 w-full lg:absolute lg:left-[8%] lg:top-[25.8%] lg:w-[440px]">
          {/* whitespace-nowrap: "Crafted around" must hold ONE line (Pearl
              at 48px needs ~460px; without this it wrapped to three lines
              on narrower desktops). */}
          <h1
            className="text-white lg:whitespace-nowrap"
            style={{
              // TAN PEARL (registered via next/font as --font-pearl).
              fontFamily: "var(--font-pearl), var(--font-hero)",
              fontSize: "clamp(2rem, 3.33vw, 48px)",
              fontStyle: "normal",
              fontWeight: 400,
              lineHeight: "normal",
              letterSpacing: "2.4px",
              WebkitTextStrokeWidth: 1,
              WebkitTextStrokeColor: "#FFF",
            }}
          >
            Crafted around
            <br />
            you.
          </h1>
          {/* 30ch (was 34): pulls the longest line in so it clears the
              chair's leftmost edge instead of overlapping it by 14px. */}
          <p className="mt-5 max-w-[30ch] leading-[1.75]" style={{ ...PAGE_TYPE, color: "rgba(255,255,255,0.7)" }}>
            Choose the materials, finishes and details that reflet your
            taste. Each piece is made to order, exclusively for you.
          </p>
          <div aria-hidden className="mt-5 h-px w-14 bg-white/40" />
          <button
            type="button"
            aria-label="View in 360 degrees"
            aria-haspopup="dialog"
            aria-expanded={viewerOpen}
            onClick={() => setViewerOpen(true)}
            className={`mt-6 inline-flex h-10 items-center justify-center rounded-full border px-5 transition-colors hover:border-white/50 hover:text-white ${focusRing}`}
            style={{ borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.75)" }}
          >
            <Icon360 className="h-[18px] w-auto" />
          </button>
        </div>

        {/* ---- the chair stage ---- */}
        {/* The piece is the subject of this page, so the box is deliberately
            larger than the free band between the copy and the menu — it runs
            behind both (they sit at z-10) and bleeds toward the bottom edge.
            A stage that overflows its column is what makes the chair read as
            standing in the room rather than pasted into a slot. */}
        <div className="relative z-0 order-last h-[62vh] w-full lg:absolute lg:bottom-[-16%] lg:left-[6%] lg:right-[8%] lg:top-[4%] lg:order-none lg:h-auto lg:w-auto">
          {/* The piece itself: a real WebGL scene. Drag it to orbit; the
              panel's four views fly the camera on a GSAP tween. */}
          <div
            role="img"
            aria-label={`Axtra Lounge Chair, ${ANGLES[angle].label}${finish ? `, ${finish} finish` : ""}${fabric ? `, ${fabric} fabric` : ""}.${stage === "webgl" ? " Drag to rotate." : ""}`}
            className="relative h-full w-full"
          >
            {stage === "flat" ? (
              <ChairStage2D
                sources={ANGLE_SRCS}
                angle={angle}
                finishHex={finishHex}
                fabricHex={fabricHex}
                fill={STAGE_FILL}
              />
            ) : stage === "webgl" ? (
              <ChairScene
                className="!absolute inset-0 cursor-grab active:cursor-grabbing"
                view={angle}
                finishColor={finishHex}
                fabricColor={fabricHex}
              />
            ) : null}
          </div>
        </div>

        {/* ---- right: the Figma menu — x970 (flush right), y94 (the
            frame's red measure — clears the navbar band) ---- */}
        {panelOpen ? (
          <div
            className="w-full lg:absolute lg:right-0 lg:top-[94px] lg:w-auto"
            style={{
              // Widths are consumed by the lg: arbitrary-value classes below,
              // so the mobile stack stays w-full.
              "--panel-w": `${PANEL_W}px`,
              "--card-w": `${CARD_W}px`,
              "--card-h": `${CARD_H}px`,
              ...(panelFit
                ? { width: PANEL_W * panelFit.scale, height: panelFit.h * panelFit.scale }
                : null),
            } as React.CSSProperties}
          >
            <div
              ref={panelInnerRef}
              className="relative w-full lg:absolute lg:right-0 lg:top-0 lg:w-[var(--panel-w)] lg:origin-top-right"
              style={panelFit ? { transform: `scale(${panelFit.scale})` } : undefined}
            >
              {/* close ⊗ above the box's top-right */}
              <button
                type="button"
                aria-label="Close customizer panel"
                onClick={() => setPanelOpen(false)}
                className={`absolute -top-9 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-white/60 transition-colors hover:border-white/55 hover:text-white/90 ${focusRing}`}
              >
                <CloseIcon />
              </button>

              {/* THE BOX — 470×561, #000 @ 33% */}
              <div
                className="flex w-full flex-col justify-between px-[29px] py-7 lg:h-[561px] lg:w-[var(--panel-w)]"
                style={{ backgroundColor: "rgba(0,0,0,0.33)" }}
              >
                <div>
                  <p className="uppercase" style={PAGE_TYPE}>
                    1. Choose your finish
                  </p>
                  <div className="mt-3.5 flex justify-between">
                    {FINISHES.map((f) => (
                      <Swatch
                        key={f.name}
                        name={f.name}
                        img={f.img}
                        selected={finish === f.name}
                        onSelect={() => setFinish(f.name)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="uppercase" style={PAGE_TYPE}>
                    2. Choose your fabric
                  </p>
                  <div className="mt-3.5 flex justify-between">
                    {FABRICS.map((f) => (
                      <Swatch
                        key={f.name}
                        name={f.name}
                        label={f.label}
                        img={f.img}
                        selected={fabric === f.name}
                        onSelect={() => setFabric(f.name)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="uppercase" style={PAGE_TYPE}>
                    3. Preview your piece
                  </p>
                  <div className="mt-3.5 flex justify-between">
                    {ANGLES.map((a, i) => (
                      <button
                        key={a.src}
                        type="button"
                        aria-label={a.label}
                        aria-pressed={angle === i}
                        onClick={() => setAngle(i)}
                        className={`h-[94px] w-[94px] shrink-0 overflow-hidden rounded-lg transition-transform duration-150 hover:scale-105 ${focusRing}`}
                        style={{
                          background:
                            "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",
                          border: angle === i ? `2px solid ${T.gold}` : "1.5px solid rgba(255,255,255,0.45)",
                          boxShadow: angle === i ? "0 0 14px rgba(223,163,92,0.3)" : undefined,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.src} alt="" className="h-full w-full object-contain p-2" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* product card — Figma spec: 456×167, r8, #000 @ 54%, 15px
                  in from the right edge, 44px below the box (y683). */}
              <div
                className="mt-5 flex w-full flex-col justify-center rounded-lg px-7 py-5 lg:ml-auto lg:mr-[15px] lg:mt-[44px] lg:h-[var(--card-h)] lg:w-[var(--card-w)]"
                style={{ backgroundColor: "rgba(0,0,0,0.54)" }}
              >
                <p style={CARD_TITLE}>Axtra Lounge Chair</p>
                <p className="mt-2" style={CARD_VARIANT}>
                  {finish ?? "Walnut Brown"}/{fabric ?? "Olive"}
                </p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p style={CARD_PRICE}>Rs. 75000.00</p>
                  {/* maroon-on-gold is what makes #741A14 legible here. */}
                  <button
                    type="button"
                    className={`shrink-0 transition-transform duration-150 hover:scale-[1.03] ${focusRing}`}
                    style={{ ...CARD_CTA_CHIP, backgroundColor: T.goldBtn }}
                  >
                    <span style={CARD_CTA_LABEL}>Shop Now</span>
                  </button>
                </div>
                <div className="mt-4 h-px bg-white/[0.12]" />
                <p className="mt-3 whitespace-nowrap text-center" style={CARD_DELIVERY}>
                  Delivery in 12-15 days&ensp;|&ensp;Contact our team for best prices
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Open customizer panel"
            onClick={() => setPanelOpen(true)}
            className={`hidden h-9 w-9 rotate-45 items-center justify-center rounded-full border border-white/25 text-white/55 transition-colors hover:border-white/50 hover:text-white/85 lg:absolute lg:right-6 lg:top-[90px] lg:flex ${focusRing}`}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* ---- bottom product navigation — both links grouped side by side
          at the bottom-left, per the frame ---- */}
      <div className="absolute bottom-6 left-0 right-0 z-10 hidden lg:block">
        <div className="flex w-full items-end justify-start gap-16 px-10">
          <Link
            href="#"
            className={`group flex flex-col gap-1.5 opacity-80 transition-opacity hover:opacity-100 ${focusRing}`}
          >
            <span className="flex items-center gap-1.5 uppercase" style={{ ...PAGE_TYPE, fontSize: "12px", letterSpacing: "1.2px", color: "rgba(255,255,255,0.5)" }}>
              <ArrowLeftIcon />
              Previous
            </span>
            <span className="uppercase transition-colors group-hover:text-white" style={{ ...PAGE_TYPE, color: "rgba(255,255,255,0.85)" }}>
              Arm Chair
            </span>
          </Link>
          <Link
            href="#"
            className={`group flex flex-col items-start gap-1.5 opacity-80 transition-opacity hover:opacity-100 ${focusRing}`}
          >
            <span className="flex items-center gap-1.5 uppercase" style={{ ...PAGE_TYPE, fontSize: "12px", letterSpacing: "1.2px", color: "rgba(255,255,255,0.5)" }}>
              Next
              <ArrowRightIcon />
            </span>
            <span className="uppercase transition-colors group-hover:text-white" style={{ ...PAGE_TYPE, color: "rgba(255,255,255,0.85)" }}>
              Sectional Sofa
            </span>
          </Link>
        </div>
      </div>

      <Viewer360
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title="Axtra Lounge Chair"
      />
    </section>
  );
}
