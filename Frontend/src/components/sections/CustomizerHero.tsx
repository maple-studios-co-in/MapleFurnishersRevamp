"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * "Make It Yours" — step 06/07 product customizer, single-viewport.
 *
 * The chair is the one raster asset (alpha cutout, frame-001 of the chair
 * sequence). Options genuinely change it: a canvas engine classifies every
 * pixel as WOOD or FABRIC by hue (the olive velvet and walnut timber
 * separate cleanly), then re-tints each region toward the selected swatch
 * while preserving the photo's own shading; the stitching toggle accents
 * the fabric/wood boundary seam. Each change plays a GSAP 3D turntable
 * swing (perspective rotateY + scale on the stage) with an SVG light-sweep
 * masked to the chair's silhouette — the recolor lands at the apex of the
 * turn.
 *
 * No cart/wishlist system exists in this app yet — ADD TO CART and the
 * heart keep local state with obvious single-line extension points.
 */

/* ---- design tokens (pixel-sampled from the reference) ---- */
const T = {
  bgBase: "#0A0705",
  panelBg: "rgba(16,13,10,0.85)",
  gold: "#DFA35C",
  goldBtn: "#CAA676",
  textOnGold: "#4D3D28",
} as const;

const FINISHES = [
  { name: "Natural Ash", hex: "#835836" },
  { name: "Walnut", hex: "#472F22" },
  { name: "Dark Oak", hex: "#29190D" },
  { name: "Ebony", hex: "#0B0A0A" },
] as const;

const FABRICS = [
  { name: "Ivory Linen", hex: "#948574" },
  { name: "Sand", hex: "#77634D" },
  { name: "Olive", hex: "#2B2A1E" },
  { name: "Charcoal", hex: "#292929" },
  { name: "Rust", hex: "#6D3E27" },
] as const;

const BASE_STYLES = ["Signature Curve", "Sculpted Sled", "Classic Taper"] as const;

/** The hero product render (portrait alpha cutout, rembg'd from the
 *  supplied moody render — scripts/cutout-customizer.py regenerates it).
 *  Thumbnails reuse it as placeholders until real angle shots exist. */
const CHAIR_SRC = "/media/customizer/axtra-chair.png";
const ANGLES = [CHAIR_SRC, CHAIR_SRC, CHAIR_SRC, CHAIR_SRC];

const STEPS = ["01", "02", "03", "04", "05", "06", "07"] as const;
const ACTIVE_STEP = "06";

/** CALIBRATION — pixel classification thresholds, measured from the
 *  photo's hue histogram: the wood reads 0–35° (mode 10–30°, low in the
 *  frame), the "olive" velvet reads 38–52° (mode 42–45°, high in the
 *  frame), valley at 27–33°. Nudge FABRIC_HUE_MIN if a re-shot chair
 *  splits differently. */
const FABRIC_HUE_MIN = 38;
const FABRIC_HUE_MAX = 190;
const FABRIC_SAT_MIN = 0.04;

/* ================= pixel recolor engine ========================== */

type ChairMask = {
  w: number;
  h: number;
  /** 0 = empty, 1 = wood, 2 = fabric */
  cls: Uint8Array;
  /** fabric px adjacent to wood — the "stitch seam" */
  boundary: Uint8Array;
  /** per-pixel lightness 0..1 */
  lum: Float32Array;
  alpha: Uint8ClampedArray;
  avgL: [number, number, number]; // [_, wood, fabric]
  bbox: { x: number; y: number; w: number; h: number };
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** One-time pass: classify chair pixels and cache everything the recolor
 *  loop needs. Fabric = green-ish hues (the olive velvet), wood = the
 *  warm browns; low-alpha edges keep their class for clean antialiasing. */
function buildMask(img: HTMLImageElement): { mask: ChairMask; src: ImageData } {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;

  const rawCls = new Uint8Array(w * h);
  const lum = new Float32Array(w * h);
  const alpha = new Uint8ClampedArray(w * h);
  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    alpha[i] = a;
    if (a < 12) continue;
    const [hue, sat, l] = rgbToHsl(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    const isFabric =
      hue >= FABRIC_HUE_MIN && hue <= FABRIC_HUE_MAX && sat > FABRIC_SAT_MIN;
    rawCls[i] = isFabric ? 2 : 1;
    lum[i] = l;
    const x = i % w, y = (i / w) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }

  // Majority-vote denoise: hue classification speckles inside the velvet
  // (shadow pixels dipping under the hue split) read as scattered wood
  // dots — and later as bogus stitch specks. A 3×3 vote flips isolated
  // minorities to their surroundings.
  const cls = new Uint8Array(rawCls);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!rawCls[i]) continue;
      let fab = 0, wood = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = rawCls[i + dy * w + dx];
          if (k === 2) fab++;
          else if (k === 1) wood++;
        }
      }
      if (fab >= 6) cls[i] = 2;
      else if (wood >= 6) cls[i] = 1;
    }
  }

  // Class averages AFTER denoising.
  const sums = [0, 0, 0]; const counts = [0, 0, 0];
  for (let i = 0; i < w * h; i++) {
    const k = cls[i];
    if (k) { sums[k] += lum[i]; counts[k]++; }
  }

  // Seam = fabric pixels with a SUBSTANTIAL wood presence nearby (≥6 of
  // the 5×5 window) — a real piping line, never lone specks.
  const boundary = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (cls[i] !== 2) continue;
      let wood = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (cls[i + dy * w + dx] === 1) wood++;
        }
      }
      if (wood >= 6) boundary[i] = 1;
    }
  }

  return {
    mask: {
      w, h, cls, boundary, lum, alpha,
      avgL: [0, sums[1] / Math.max(1, counts[1]), sums[2] / Math.max(1, counts[2])],
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    },
    src,
  };
}

/** Retint: keep each pixel's shading (lightness), swap in the target's
 *  hue/sat, and scale lightness by target-vs-original class average so
 *  Ebony really goes dark and Ash really lightens. */
function recolor(
  mask: ChairMask,
  out: ImageData,
  finishHex: string,
  fabricHex: string,
  stitching: boolean,
) {
  const targets = [null, hexToHsl(finishHex), hexToHsl(fabricHex)] as const;
  const d = out.data;
  const { cls, lum, alpha, boundary, avgL, w, h } = mask;
  for (let i = 0; i < w * h; i++) {
    const k = cls[i];
    if (k === 0) { d[i * 4 + 3] = alpha[i]; continue; }
    const t = targets[k]!;
    // Ratio floored at 0.16: very dark targets (Ebony) still keep some of
    // the photo's shading instead of crushing to a mottled black mass.
    const l = Math.min(1, Math.max(0.02, lum[i] * Math.max(0.16, t[2] / avgL[k])));
    let [r, g, b] = hslToRgb(t[0], t[1], l);
    if (stitching && boundary[i]) {
      // Contrast piping along the seam — subtle, not painted-on.
      r = r * 0.65 + 232 * 0.35;
      g = g * 0.65 + 219 * 0.35;
      b = b * 0.65 + 197 * 0.35;
    }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = alpha[i];
  }
}

/* ---- inline icons (currentColor-themed, no deps) ---- */
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M4 2.5L13 8L4 13.5V2.5Z" fill="currentColor" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
const TruckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="1" y="6" width="14" height="11" />
    <path d="M15 9h4l3 4v4h-7z" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="19" r="2" />
  </svg>
);
const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);

const panelHeaderClass =
  "uppercase tracking-[0.08em] text-[11px] font-semibold text-white/48";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DFA35C] focus-visible:outline-offset-2";

/** Figma-frame material tile: rounded square with CSS-built material
 *  shading (no texture photos exist — wood gets a faint diagonal grain,
 *  fabric a soft weave sheen), gold border when selected. */
function Swatch({
  name, hex, kind, selected, onSelect,
}: {
  name: string; hex: string; kind: "wood" | "fabric"; selected: boolean; onSelect: () => void;
}) {
  const material =
    kind === "wood"
      ? `linear-gradient(115deg, rgba(255,255,255,0.14), transparent 45%), repeating-linear-gradient(100deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 2px, transparent 2px, transparent 6px)`
      : `radial-gradient(130% 130% at 30% 20%, rgba(255,255,255,0.16), transparent 55%), repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)`;
  return (
    <div className="flex w-[52px] shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={name}
        onClick={onSelect}
        className={`h-[46px] w-[46px] rounded-xl transition-transform duration-150 hover:scale-105 ${focusRing}`}
        style={{
          backgroundImage: material,
          backgroundColor: hex,
          border: selected ? `2px solid ${T.gold}` : "1px solid rgba(255,255,255,0.14)",
          boxShadow: selected ? "0 0 12px rgba(223,163,92,0.25)" : undefined,
        }}
      />
      {/* 60% (not the 48% muted) — 48% fails WCAG AA at this size. */}
      <span className="text-center text-[10px] leading-[1.3] text-white/60">{name}</span>
    </div>
  );
}

function Stepper({ horizontal }: { horizontal?: boolean }) {
  return (
    <ol
      aria-label="Customization steps"
      className={horizontal ? "flex flex-row items-center gap-5" : "flex flex-col gap-6"}
    >
      {STEPS.map((s) => {
        const active = s === ACTIVE_STEP;
        return (
          <li key={s} className="flex items-center gap-3">
            <span
              className={active ? "text-[15px] font-semibold" : "text-[13px] font-normal text-white/48"}
              style={active ? { color: T.gold } : undefined}
              aria-current={active ? "step" : undefined}
            >
              {s}
            </span>
            {active && <span aria-hidden className="h-px w-6" style={{ backgroundColor: T.gold }} />}
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================= */

export default function CustomizerHero() {
  const [finish, setFinish] = useState<(typeof FINISHES)[number]["name"]>("Walnut");
  const [fabric, setFabric] = useState<(typeof FABRICS)[number]["name"]>("Olive");
  const [stitching, setStitching] = useState(true);
  const [baseStyle, setBaseStyle] = useState<(typeof BASE_STYLES)[number]>(BASE_STYLES[0]);
  const [ddOpen, setDdOpen] = useState(false);
  const [angle, setAngle] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  /* ---- panel fit-to-height zoom (desktop) ----
     The menu scales to FILL the right column's height — up to 1.3× on
     tall screens, and never past what fits without a scrollbar. */
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
      const avail = window.innerHeight - 96 - 20; // navbar band + breathing room
      const scale = Math.min(1.3, Math.max(0.75, avail / natural));
      setPanelFit({ scale, h: natural });
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* ---- chair stage refs ---- */
  const stageRef = useRef<HTMLDivElement>(null);   // pointer tilt (outer)
  const swingRef = useRef<HTMLDivElement>(null);   // swap turntable (inner)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheenWrapRef = useRef<HTMLDivElement>(null);
  const sheenBandRef = useRef<SVGRectElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<ChairMask | null>(null);
  const outRef = useRef<ImageData | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const spinDirRef = useRef(1);
  const firstPaintRef = useRef(true);

  const finishHex = FINISHES.find((f) => f.name === finish)!.hex;
  const fabricHex = FABRICS.find((f) => f.name === fabric)!.hex;
  const variant = `${finish} / ${fabric} / ${baseStyle}`;

  /** Blit the recolored bbox crop into the display canvas, contain-fit,
   *  and park the silhouette-masked sheen overlay on the drawn rect. */
  const blit = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offRef.current;
    const mask = maskRef.current;
    const stage = stageRef.current;
    if (!canvas || !off || !mask || !stage) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const { bbox } = mask;
    const s = Math.min((width * dpr) / bbox.w, (height * dpr) / bbox.h) * 0.96;
    const dw = bbox.w * s, dh = bbox.h * s;
    const dx = (canvas.width - dw) / 2, dy = (canvas.height - dh) / 2;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, bbox.x, bbox.y, bbox.w, bbox.h, dx, dy, dw, dh);

    // Sheen overlay hugs the drawn rect; its CSS mask replays the same
    // crop so the sweep only ever lights the chair itself.
    const sheen = sheenWrapRef.current;
    if (sheen) {
      const left = dx / dpr, top = dy / dpr, w = dw / dpr, h = dh / dpr;
      sheen.style.left = `${left}px`;
      sheen.style.top = `${top}px`;
      sheen.style.width = `${w}px`;
      sheen.style.height = `${h}px`;
      const px = mask.w === bbox.w ? 0 : (bbox.x / (mask.w - bbox.w)) * 100;
      const py = mask.h === bbox.h ? 0 : (bbox.y / (mask.h - bbox.h)) * 100;
      const sz = `${(mask.w / bbox.w) * 100}% ${(mask.h / bbox.h) * 100}%`;
      sheen.style.maskImage = `url(${CHAIR_SRC})`;
      sheen.style.maskSize = sz;
      sheen.style.maskPosition = `${px}% ${py}%`;
    }
    const ground = groundRef.current;
    if (ground) {
      ground.style.top = `${(dy + dh) / dpr - 14}px`;
    }
  }, []);

  const applyColors = useCallback(
    (fin: string, fab: string, stitch: boolean) => {
      const mask = maskRef.current;
      const out = outRef.current;
      const off = offRef.current;
      if (!mask || !out || !off) return;
      recolor(mask, out, fin, fab, stitch);
      off.getContext("2d")!.putImageData(out, 0, 0);
      blit();
    },
    [blit],
  );

  /* ---- load the photo, build the mask, first paint ---- */
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = CHAIR_SRC;
    img
      .decode()
      .then(() => {
        if (cancelled) return;
        const { mask, src } = buildMask(img);
        maskRef.current = mask;
        outRef.current = new ImageData(new Uint8ClampedArray(src.data), mask.w, mask.h);
        const off = document.createElement("canvas");
        off.width = mask.w; off.height = mask.h;
        offRef.current = off;
        applyColors(finishHex, fabricHex, stitching);
        firstPaintRef.current = false;
      })
      .catch(() => {
        // Photo missing: the stage just stays empty; the panel still works.
      });
    return () => {
      cancelled = true;
    };
    // Initial paint only — later changes go through the animated effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => blit();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [blit]);

  /* ---- 3D turntable swing on every option change ---- */
  useGSAP(
    () => {
      if (firstPaintRef.current) return; // skip mount
      const swing = swingRef.current;
      const band = sheenBandRef.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || !swing) {
        applyColors(finishHex, fabricHex, stitching);
        return;
      }
      // Recolor SYNCHRONOUSLY — never inside the timeline: a callback at
      // the swing's apex depends on rAF ticking, which pauses in
      // background tabs (and never runs in headless panes), leaving the
      // chair on stale colors. The sheen sweeping over the swap covers
      // the instant change.
      applyColors(finishHex, fabricHex, stitching);

      const dir = (spinDirRef.current *= -1);
      gsap.set(swing, { transformPerspective: 1200, transformOrigin: "50% 60%" });
      const tl = gsap.timeline();
      tl.fromTo(
        swing,
        { rotationY: 18 * dir, scale: 1.05 },
        { rotationY: 0, scale: 1, duration: 0.8, ease: "power3.out" },
      );
      if (band) {
        tl.fromTo(
          band,
          { xPercent: -140 },
          { xPercent: 140, duration: 0.65, ease: "power2.inOut" },
          0.18,
        );
      }
      if (groundRef.current) {
        tl.fromTo(
          groundRef.current,
          { scaleX: 1 },
          { scaleX: 0.9, duration: 0.28, ease: "power2.in", yoyo: true, repeat: 1 },
          0,
        );
      }
    },
    { dependencies: [finish, fabric, stitching, baseStyle], scope: stageRef },
  );

  /* ---- standing pointer tilt (the craft chapter's 3D feel) ---- */
  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const stage = stageRef.current;
      if (reduce || !stage) return;
      gsap.set(stage, { transformPerspective: 1400, transformOrigin: "50% 55%" });
      const tiltX = gsap.quickTo(stage, "rotationY", { duration: 0.7, ease: "power2.out" });
      const tiltY = gsap.quickTo(stage, "rotationX", { duration: 0.7, ease: "power2.out" });
      const onMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        tiltX(((e.clientX - r.left) / r.width - 0.5) * 7);
        tiltY(-((e.clientY - r.top) / r.height - 0.5) * 5);
      };
      const parent = stage.parentElement ?? stage;
      parent.addEventListener("pointermove", onMove);
      return () => parent.removeEventListener("pointermove", onMove);
    },
    { scope: stageRef },
  );

  /* ---- dropdown dismissal ---- */
  useEffect(() => {
    if (!ddOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!ddRef.current?.contains(e.target as Node)) setDdOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDdOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ddOpen]);

  const addToCart = useCallback(() => {
    // EXTENSION POINT: call the real cart handler here once one exists —
    // the configured variant is `variant` and the price is fixed below.
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }, []);

  return (
    <section
      aria-label="Make it yours — customize the Axtra Lounge Chair"
      className="relative overflow-hidden pt-24 lg:h-[100dvh]"
      style={{ backgroundColor: T.bgBase }}
    >
      {/* warm ambient glow, upper-right — stands in for shelf lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[10%] right-[5%] h-[60%] w-[45%] blur-[60px]"
        style={{ background: "radial-gradient(circle, rgba(223,163,92,0.16), transparent 70%)" }}
      />
      {/* faint vertical fluting — suggests the wood panelling */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 40px)",
        }}
      />

      {/* vertical stepper rail (desktop) */}
      <div className="absolute left-8 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
        <Stepper />
      </div>

      <div className="relative mx-auto flex h-full max-w-[1440px] flex-col items-center gap-8 px-6 pb-10 lg:flex-row lg:gap-10 lg:px-20 lg:pb-6">
        {/* horizontal stepper (mobile) */}
        <div className="self-start lg:hidden">
          <Stepper horizontal />
        </div>

        {/* ---- left: copy column (per the Figma frame) ---- */}
        <div className="w-full lg:w-auto lg:flex-[0_0_310px]">
          <p
            className="uppercase tracking-[0.22em] text-[12px] font-semibold"
            style={{ color: T.gold }}
          >
            Your style. Your piece.
          </p>
          <h1
            className="mt-4 text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(2rem, 3.6vw, 3.4rem)",
              lineHeight: 1.18,
            }}
          >
            Crafted around
            <br />
            you.
          </h1>
          <p className="mt-5 max-w-[30ch] text-[14.5px] leading-[1.75] text-white/68">
            Choose the materials, finishes and details that reflect your
            taste. Each piece is made to order, exclusively for you.
          </p>
          <div aria-hidden className="mt-5 h-px w-12" style={{ backgroundColor: T.gold }} />
          <Link href="/#craft" className={`mt-6 inline-flex items-center gap-3 ${focusRing}`}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border transition-transform duration-150 hover:scale-105"
              style={{ borderColor: T.gold, color: T.gold }}
            >
              <PlayIcon />
            </span>
            <span className="uppercase tracking-[0.14em] text-[12px] font-semibold text-white/90">
              See how it&rsquo;s made
            </span>
          </Link>
        </div>

        {/* ---- the chair: canvas + SVG sheen, GSAP 3D stage ---- */}
        <div className="relative h-[46vh] w-full flex-1 lg:h-full">
          <div
            ref={stageRef}
            role="img"
            aria-label={`Axtra Lounge Chair in ${finish} finish with ${fabric} fabric`}
            className="relative h-full w-full"
          >
            <div ref={swingRef} className="relative h-full w-full">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                style={{ filter: "drop-shadow(0 40px 70px rgba(0,0,0,0.55))" }}
              />
              {/* SVG light sweep, CSS-masked to the chair silhouette so the
                  band only crosses the chair, never the background. */}
              <div
                ref={sheenWrapRef}
                aria-hidden
                className="pointer-events-none absolute overflow-hidden"
              >
                <svg className="h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="mf-sheen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#FFF6E6" stopOpacity="0" />
                      <stop offset="0.5" stopColor="#FFF6E6" stopOpacity="0.32" />
                      <stop offset="1" stopColor="#FFF6E6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect
                    ref={sheenBandRef}
                    x="-20%"
                    y="-10%"
                    width="45%"
                    height="120%"
                    fill="url(#mf-sheen)"
                    transform="skewX(-12)"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                </svg>
              </div>
            </div>
          </div>
          {/* grounding pool — reacts to the turntable swing */}
          <div
            ref={groundRef}
            aria-hidden
            className="pointer-events-none absolute left-1/2 h-8 w-[46%] -translate-x-1/2 rounded-[50%] blur-[26px]"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          />
        </div>

        {/* ---- right: customizer menu (Figma frame: no card — the menu
             sits directly on the scene, hairline-divided). The sizing
             wrapper reserves the SCALED footprint while the inner column
             zooms to fill the height with no scrollbar. ---- */}
        <div
          className="w-full lg:w-auto lg:shrink-0"
          style={
            panelFit
              ? { width: 310 * panelFit.scale, height: panelFit.h * panelFit.scale }
              : undefined
          }
        >
        <div
          ref={panelInnerRef}
          className="w-full lg:w-[310px] lg:origin-top-left"
          style={panelFit ? { transform: `scale(${panelFit.scale})` } : undefined}
        >
          {/* 1 — finish */}
          <p className={panelHeaderClass}>1. Choose your finish</p>
          <div className="mt-2.5 flex gap-2">
            {FINISHES.map((f) => (
              <Swatch
                key={f.name}
                name={f.name}
                hex={f.hex}
                kind="wood"
                selected={finish === f.name}
                onSelect={() => setFinish(f.name)}
              />
            ))}
          </div>

          <div className="my-3 h-px bg-white/[0.08]" />

          {/* 2 — fabric */}
          <p className={panelHeaderClass}>2. Choose your fabric</p>
          <div className="mt-2.5 flex gap-2">
            {FABRICS.map((f) => (
              <Swatch
                key={f.name}
                name={f.name}
                hex={f.hex}
                kind="fabric"
                selected={fabric === f.name}
                onSelect={() => setFabric(f.name)}
              />
            ))}
          </div>

          <div className="my-3 h-px bg-white/[0.08]" />

          {/* 3 — detail options */}
          <p className={panelHeaderClass}>3. Detail options</p>
          <div className="mt-2.5 flex items-center justify-between">
            <span id="stitching-label" className="text-[12.5px] text-white/68">
              Contrast Stitching
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={stitching}
              aria-labelledby="stitching-label"
              onClick={() => setStitching((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${focusRing}`}
              style={{ backgroundColor: stitching ? T.gold : "rgba(255,255,255,0.15)" }}
            >
              <span
                aria-hidden
                className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200 ease-out"
                style={{ transform: stitching ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
          </div>
          <div ref={ddRef} className="relative mt-2.5 flex items-center justify-between">
            <span className="text-[12.5px] text-white/68">Base Style</span>
            <button
              type="button"
              aria-expanded={ddOpen}
              aria-haspopup="listbox"
              onClick={() => setDdOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-[13px] text-white transition-colors hover:border-white/35 ${focusRing}`}
            >
              {baseStyle}
              <span className="text-white/60">
                <ChevronIcon />
              </span>
            </button>
            {ddOpen && (
              <ul
                role="listbox"
                aria-label="Base style"
                className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-md border border-white/15 shadow-xl"
                style={{ backgroundColor: "#17120D" }}
              >
                {BASE_STYLES.map((s) => (
                  <li key={s} role="option" aria-selected={s === baseStyle}>
                    <button
                      type="button"
                      onClick={() => {
                        setBaseStyle(s);
                        setDdOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/10 ${
                        s === baseStyle ? "text-[#DFA35C]" : "text-white/80"
                      }`}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="my-3 h-px bg-white/[0.08]" />

          {/* 4 — preview */}
          <div className="flex items-center justify-between">
            <p className={panelHeaderClass}>4. Preview your piece</p>
            <div className="flex items-center gap-2 text-white/70">
              <span className="flex h-6 items-center rounded-full border border-white/20 px-2 text-[9px] font-semibold tracking-wide">
                360°
              </span>
              <button
                type="button"
                aria-label="Rotate preview"
                className={`flex h-6 w-6 items-center justify-center rounded-full border border-white/20 transition-colors hover:border-white/45 ${focusRing}`}
              >
                <RotateIcon />
              </button>
            </div>
          </div>
          <div className="mt-2.5 flex gap-2.5">
            {/* Placeholder state, not a bug: all four slots reuse the one
                photo until real angle shots exist. */}
            {ANGLES.map((src, i) => (
              <button
                key={i}
                type="button"
                aria-label={`View angle ${i + 1}`}
                aria-pressed={angle === i}
                onClick={() => setAngle(i)}
                className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40 transition-transform duration-150 hover:scale-105 ${focusRing}`}
                style={{
                  border: angle === i ? `2px solid ${T.gold}` : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          {/* product bar — the mock's elevated dark card */}
          <div
            className="mt-4 rounded-xl p-3.5"
            style={{ backgroundColor: "rgba(23,18,13,0.92)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[15px] font-semibold uppercase tracking-wide text-white">
              Axtra Lounge Chair
            </p>
            <p className="mt-0.5 text-[12px] text-white/48">{variant}</p>
            <p className="mt-1.5 text-[15px] font-semibold text-white">₹ 78,900</p>
            <div className="mt-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={addToCart}
                className={`flex-1 rounded-full py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition-transform duration-150 hover:scale-[1.02] ${focusRing}`}
                style={{ backgroundColor: T.goldBtn, color: T.textOnGold }}
              >
                {added ? "Added to cart ✓" : "Add to cart"}
              </button>
              <button
                type="button"
                aria-pressed={wishlisted}
                aria-label="Save to wishlist"
                onClick={() => setWishlisted((v) => !v)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/20 transition-colors hover:border-white/45 ${focusRing}`}
                style={{ color: wishlisted ? T.gold : "rgba(255,255,255,0.8)" }}
              >
                <HeartIcon filled={wishlisted} />
              </button>
            </div>
            <div className="mt-2.5 h-px bg-white/[0.08]" />
            <p className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/48">
              <TruckIcon />
              Made to order&ensp;|&ensp;Delivery in 6–8 weeks
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* bottom-left step mark */}
      <div className="absolute bottom-8 left-8 hidden xl:block">
        <div
          aria-hidden
          className="absolute -left-8 bottom-0 h-24 w-px"
          style={{ backgroundColor: T.gold }}
        />
        <p className="leading-none">
          <span
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 56, color: T.gold }}
          >
            06
          </span>
          <span className="ml-2 text-[24px] text-white/48">/ 07</span>
        </p>
        <p className="mt-2 uppercase tracking-[0.18em] text-[13px] text-white/68">
          Make it yours
        </p>
      </div>

      {/* scroll indicator (per the Figma frame) */}
      <div
        aria-hidden
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 lg:flex"
      >
        <p className="uppercase tracking-[0.24em] text-[11px] text-white/55">
          Scroll to continue
        </p>
        <span className="block h-6 w-px bg-white/30" />
        <span className="scroll-cue-dot block h-1.5 w-1.5 rounded-full bg-white/70" />
      </div>
    </section>
  );
}
