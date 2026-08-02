"use client";

import { useCallback, useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * The customizer's default stage: the real product renders, with a pixel
 * recolour engine that classifies each pixel as wood or fabric and retints
 * it in place, keeping the source luminance so all the original shading,
 * grain and velvet nap survive.
 *
 * This is the primary stage, not a fallback. Image-to-3D reconstruction of
 * this piece produced a mesh that read as plastic next to the renders it
 * was derived from, so the photography is what ships. `ChairScene` takes
 * over automatically if a real authored model is ever dropped in — see
 * public/media/customizer/models/README.md.
 *
 * Changing angle plays a GSAP swing on rotationY plus a sheen sweep, which
 * is what gives the flat stage its sense of turning.
 */

const FABRIC_HUE_MIN = 38;
const FABRIC_HUE_MAX = 190;
const FABRIC_SAT_MIN = 0.04;

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

export default function ChairStage2D({
  sources,
  angle,
  finishHex,
  fabricHex,
  fill = 0.99,
}: {
  sources: readonly string[];
  angle: number;
  finishHex: string | null;
  fabricHex: string | null;
  /** Fraction of the stage box the piece fills. The flat-stage twin of
   *  ChairScene's FRAME_FILL, so both stages size from one number. */
  fill?: number;
}) {
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

  const ensureCache = useCallback(
    async (idx: number): Promise<AngleCache | null> => {
      const existing = cachesRef.current.get(idx);
      if (existing) return existing;
      try {
        const img = new Image();
        img.src = sources[idx];
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
    },
    [sources],
  );

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
    const s = Math.min((canvas.width) / bbox.w, (canvas.height) / bbox.h) * fill;
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
      sheen.style.maskImage = `url(${sources[angleRef.current]})`;
      sheen.style.maskSize = `${(mask.w / bbox.w) * 100}% ${(mask.h / bbox.h) * 100}%`;
      sheen.style.maskPosition = `${px}% ${py}%`;
    }
    const ground = groundRef.current;
    if (ground) {
      // Track the piece's drawn size, not the stage's — otherwise shrinking
      // the chair leaves a shadow wider than the thing casting it.
      ground.style.top = `${(dy + dh) / dpr - 14}px`;
      ground.style.width = `${(dw / dpr) * 0.62}px`;
      ground.style.height = `${Math.max(16, (dh / dpr) * 0.09)}px`;
    }
  }, [sources, fill]);

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

  return (
    <>
      <div ref={stageRef} className="relative h-full w-full">
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
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] blur-[22px]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0) 76%)",
        }}
      />
    </>
  );
}
