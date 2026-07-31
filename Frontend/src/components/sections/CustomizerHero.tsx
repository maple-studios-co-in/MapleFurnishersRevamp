"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap, useGSAP } from "@/lib/gsap";
import Icon360 from "@/components/ui/Icon360";




/* Page type, per spec: Red Hat Display 18px / 400, ls 1.8px, #FFF —
 * applied across the page INCLUDING the right menu. Two captions keep
 * their calibrated sizes and only inherit the family/weight/colour: the
 * swatch labels (68px circles sit ~65px apart, so an 18px "Walnut Brown"
 * would collide with its neighbour) and the delivery line (nowrap inside
 * a 508px card — 18px measures ~900px and would burst it). */
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
const CARD_W = 456 + PANEL_EXTEND_PX;


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

const FABRIC_HUE_MIN = 38;
const FABRIC_HUE_MAX = 190;
const FABRIC_SAT_MIN = 0.04;

/* ================= pixel recolor engine ========================== */

type ChairMask = {
  w: number;
  h: number;
  /** 0 = empty, 1 = wood, 2 = fabric */
  cls: Uint8Array;
  lum: Float32Array;
  alpha: Uint8ClampedArray;
  avgL: [number, number, number];
  bbox: { x: number; y: number; w: number; h: number };
};

type AngleCache = {
  mask: ChairMask;
  /** pristine pixels — the "original chair" */
  srcData: ImageData;
  /** working buffer */
  out: ImageData;
  /** offscreen canvas the stage blits from */
  off: HTMLCanvasElement;
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

  // Majority-vote denoise (skip for tiny angle shots: 3×3 voting on an
  // 83px image eats real detail).
  const cls = new Uint8Array(rawCls);
  if (w > 200) {
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
  }

  const sums = [0, 0, 0]; const counts = [0, 0, 0];
  for (let i = 0; i < w * h; i++) {
    const k = cls[i];
    if (k) { sums[k] += lum[i]; counts[k]++; }
  }

  return {
    mask: {
      w, h, cls, lum, alpha,
      avgL: [0, sums[1] / Math.max(1, counts[1]), sums[2] / Math.max(1, counts[2])],
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    },
    src,
  };
}

/** Retint toward the targets; a null target leaves that material class at
 *  its ORIGINAL pixels — so the untouched aspect of the chair stays real. */
function recolor(
  cache: AngleCache,
  finishHex: string | null,
  fabricHex: string | null,
) {
  const { mask, srcData, out } = cache;
  const targets = [
    null,
    finishHex ? hexToHsl(finishHex) : null,
    fabricHex ? hexToHsl(fabricHex) : null,
  ] as const;
  const d = out.data;
  const s = srcData.data;
  const { cls, lum, alpha, avgL, w, h } = mask;
  for (let i = 0; i < w * h; i++) {
    const k = cls[i];
    const t = k ? targets[k] : null;
    if (!t) {
      d[i * 4] = s[i * 4];
      d[i * 4 + 1] = s[i * 4 + 1];
      d[i * 4 + 2] = s[i * 4 + 2];
      d[i * 4 + 3] = alpha[i];
      continue;
    }
    const l = Math.min(1, Math.max(0.02, lum[i] * Math.max(0.16, t[2] / avgL[k])));
    const [r, g, b] = hslToRgb(t[0], t[1], l);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = alpha[i];
  }
  cache.off.getContext("2d")!.putImageData(out, 0, 0);
}

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

  /* ---- stage refs + per-angle engine caches ---- */
  const stageRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheenWrapRef = useRef<HTMLDivElement>(null);
  const sheenBandRef = useRef<SVGRectElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const cachesRef = useRef<Map<number, AngleCache>>(new Map());
  const angleRef = useRef(0);
  const spinDirRef = useRef(1);
  const bootedRef = useRef(false);

  const finishHex = finish ? FINISHES.find((f) => f.name === finish)!.hex : null;
  const fabricHex = fabric ? FABRICS.find((f) => f.name === fabric)!.hex : null;

  const ensureCache = useCallback(async (idx: number): Promise<AngleCache | null> => {
    const existing = cachesRef.current.get(idx);
    if (existing) return existing;
    try {
      const img = new Image();
      img.src = ANGLES[idx].src;
      await img.decode();
      const { mask, src } = buildMask(img);
      const off = document.createElement("canvas");
      off.width = mask.w; off.height = mask.h;
      off.getContext("2d")!.putImageData(src, 0, 0); // original pixels
      const cache: AngleCache = {
        mask,
        srcData: src,
        out: new ImageData(new Uint8ClampedArray(src.data), mask.w, mask.h),
        off,
      };
      cachesRef.current.set(idx, cache);
      return cache;
    } catch {
      return null;
    }
  }, []);

  /** Blit the active angle's offscreen into the display canvas. */
  const blit = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const cache = cachesRef.current.get(angleRef.current);
    if (!canvas || !stage || !cache) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const { bbox } = cache.mask;
    const s = Math.min((canvas.width) / bbox.w, (canvas.height) / bbox.h) * 0.99;
    const dw = bbox.w * s, dh = bbox.h * s;
    const dx = (canvas.width - dw) / 2, dy = (canvas.height - dh) / 2;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache.off, bbox.x, bbox.y, bbox.w, bbox.h, dx, dy, dw, dh);

    const sheen = sheenWrapRef.current;
    if (sheen) {
      const { mask } = cache;
      sheen.style.left = `${dx / dpr}px`;
      sheen.style.top = `${dy / dpr}px`;
      sheen.style.width = `${dw / dpr}px`;
      sheen.style.height = `${dh / dpr}px`;
      const px = mask.w === bbox.w ? 0 : (bbox.x / (mask.w - bbox.w)) * 100;
      const py = mask.h === bbox.h ? 0 : (bbox.y / (mask.h - bbox.h)) * 100;
      sheen.style.maskImage = `url(${ANGLES[angleRef.current].src})`;
      sheen.style.maskSize = `${(mask.w / bbox.w) * 100}% ${(mask.h / bbox.h) * 100}%`;
      sheen.style.maskPosition = `${px}% ${py}%`;
    }
    const ground = groundRef.current;
    if (ground) ground.style.top = `${(dy + dh) / dpr - 14}px`;
  }, []);

  /** The one driver: ensure the angle's cache, apply the selections (or
   *  originals), draw, and — after boot — play the 3D swing. */
  useEffect(() => {
    let stale = false;
    (async () => {
      angleRef.current = angle;
      const cache = await ensureCache(angle);
      if (!cache || stale) return;
      recolor(cache, finishHex, fabricHex);
      blit();

      if (!bootedRef.current) {
        bootedRef.current = true;
        return; // first paint: the original chair, no motion
      }
      const swing = swingRef.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || !swing) return;
      const dir = (spinDirRef.current *= -1);
      gsap.set(swing, { transformPerspective: 1200, transformOrigin: "50% 60%" });
      const tl = gsap.timeline();
      tl.fromTo(
        swing,
        { rotationY: 18 * dir, scale: 1.05 },
        { rotationY: 0, scale: 1, duration: 0.8, ease: "power3.out" },
      );
      if (sheenBandRef.current) {
        tl.fromTo(
          sheenBandRef.current,
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
    })();
    return () => {
      stale = true;
    };
  }, [angle, finishHex, fabricHex, ensureCache, blit]);

  useEffect(() => {
    const onResize = () => blit();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [blit]);

  /* ---- standing pointer tilt ---- */
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
        tiltX(((e.clientX - r.left) / r.width - 0.5) * 6);
        tiltY(-((e.clientY - r.top) / r.height - 0.5) * 4);
      };
      const section = stage.closest("section") ?? stage;
      section.addEventListener("pointermove", onMove as EventListener);
      return () => section.removeEventListener("pointermove", onMove as EventListener);
    },
    { scope: stageRef },
  );

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
        <div className="w-full lg:absolute lg:left-[8%] lg:top-[25.8%] lg:w-[440px]">
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
            className={`mt-6 inline-flex h-10 items-center justify-center rounded-full border px-5 transition-colors hover:border-white/50 ${focusRing}`}
            style={{ borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.75)" }}
          >
            <Icon360 className="h-[18px] w-auto" />
          </button>
        </div>

        {/* ---- the chair stage ---- */}
        {/* Scene-24 chair box: measured chair extent x434–1031, y311–859
            of the 1440×934 frame → these insets. */}
        {/* Stage box sized so NO angle collides with the copy or the right
            menu. The four renders have very different aspect ratios — the
            ¾ hero is portrait (0.94) but Side is landscape (1.45) — and a
            contain fit makes the landscape ones far wider, which is why
            Side/Back used to run under the panel by ~40-58px. Insets
            measured at 1440×900: the box spans the free band between the
            copy and the menu (~465–957), so even the widest angle stays
            inside it. Bottom stays at 8% so the base meets the carpet. */}
        <div className="relative order-last h-[46vh] w-full lg:absolute lg:bottom-[8%] lg:left-[32.3%] lg:right-[33.5%] lg:top-[38.5%] lg:order-none lg:h-auto lg:w-auto">
          <div
            ref={stageRef}
            role="img"
            aria-label={`Axtra Lounge Chair, ${ANGLES[angle].label}${finish ? `, ${finish} finish` : ""}${fabric ? `, ${fabric} fabric` : ""}`}
            className="relative h-full w-full"
          >
            <div ref={swingRef} className="relative h-full w-full">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                style={{ filter: "drop-shadow(0 26px 42px rgba(0,0,0,0.55))" }}
              />
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
          <div
            ref={groundRef}
            aria-hidden
            /* Contact shadow. Its top is written per-draw from the chair's
               measured base (see fit()), so it tracks every angle. Deepened
               and graded for the new interior plate: a hard core right under
               the chair falling off to nothing sells it as sitting ON the
               carpet rather than floating over it. */
            className="pointer-events-none absolute left-1/2 h-10 w-[54%] -translate-x-1/2 rounded-[50%] blur-[22px]"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0) 76%)",
            }}
          />
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
                className="mt-5 flex w-full flex-col justify-center rounded-lg px-6 py-4 lg:ml-auto lg:mr-[15px] lg:mt-[44px] lg:h-[167px] lg:w-[var(--card-w)]"
                style={{ backgroundColor: "rgba(0,0,0,0.54)" }}
              >
                <p className="uppercase" style={PAGE_TYPE}>
                  Axtra Lounge Chair
                </p>
                <p className="mt-0.5" style={{ ...PAGE_TYPE, fontSize: "14px", letterSpacing: "1.4px", color: "rgba(255,255,255,0.55)" }}>
                  {finish ?? "Walnut Brown"}/{fabric ?? "Olive"}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p style={PAGE_TYPE}>Rs. 75000.00</p>
                  <button
                    type="button"
                    className={`px-5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-transform duration-150 hover:scale-[1.03] ${focusRing}`}
                    style={{ backgroundColor: T.goldBtn, color: T.textOnGold, borderRadius: 3 }}
                  >
                    Shop Now
                  </button>
                </div>
                <div className="mt-2.5 h-px bg-white/[0.12]" />
                {/* nowrap + tight tracking: TAN PEARL's wide advance made
                    this line wrap and burst the 167px card. */}
                <p
                  className="mt-2 whitespace-nowrap text-center uppercase"
                  style={{ ...PAGE_TYPE, fontSize: "9.5px", letterSpacing: "0.1px", color: "rgba(255,255,255,0.45)" }}
                >
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
    </section>
  );
}
