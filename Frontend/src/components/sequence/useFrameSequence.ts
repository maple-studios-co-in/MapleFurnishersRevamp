"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

export interface FrameSequenceConfig {
  /** Public path holding the frames, e.g. "/media/sequences/chair". */
  framePath: string;
  totalFrames: number;
  /** `{NNN}` = 3-digit, zero-padded, 1-based. */
  framePattern?: string;
  /** Pixels of scroll per frame advance. */
  scrollPerFrame?: number;
  /**
   * `cover` fills the viewport (crops overflow). `contain` shows the whole
   * frame. Use `contain` for alpha subjects so the product is never clipped.
   */
  fit?: "cover" | "contain";
  /** Transparent frames: skip the backdrop fill so page content shows through. */
  transparent?: boolean;
  /** Defer preload until the section is within N px of the viewport. */
  preloadMargin?: number;
  /** Pin the sticky element while scrubbing. */
  pin?: boolean;
  /**
   * Fraction of the pinned distance held AFTER the last frame (0–0.5).
   * The scrub playhead lags the scroll (`scrub` lerp), so without a hold
   * the pin can release while the sequence is still mid-motion and the
   * stage slides away showing a half-finished frame. 0.15 finishes the
   * frames by 85% of the pin and lets them settle before the unpin.
   * @default 0.15
   */
  tailHold?: number;
  /**
   * Fraction of the pinned distance held BEFORE the first frame advances
   * (0–0.5). Gives a scene room for an entrance transition — the chair
   * chapter's strip-tear plays over this window while the sequence rests
   * on frame 1.
   * @default 0
   */
  leadHold?: number;
  /**
   * ScrollTrigger `scrub` lerp seconds — how lazily the playhead chases the
   * scroll. Higher = softer, slower-feeling motion (the chair chapter uses
   * 1.2 so the explosion eases instead of snapping with each wheel notch).
   * @default 0.6
   */
  scrubSmooth?: number;
  /**
   * Called with 0..1 FRAME progress — derived from the frame actually being
   * drawn (scrub lag and tailHold included), not from raw scroll. Scene
   * scripts keyed to footage stay in sync with what's on screen no matter
   * how the pin distance or tail hold are tuned.
   */
  onProgress?: (p: number) => void;
}

export interface FrameSequenceReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  stickyRef: React.RefObject<HTMLDivElement | null>;
  /** First frame decoded — safe to reveal the canvas. */
  ready: boolean;
  /** Every frame decoded. */
  loaded: boolean;
  scrollDistance: number;
}

function frameSrc(base: string, idx: number, pattern: string) {
  return `${base}/${pattern.replace("{NNN}", String(idx + 1).padStart(3, "0"))}`;
}

/**
 * Frames decode()d ahead of the playhead on both sides. drawImage on a
 * cold image decodes it SYNCHRONOUSLY on the main thread (~10–30ms for
 * these 1080p frames) — a per-frame hitch on the first pass through a
 * film. decode() runs off the main thread, so a ~10-frame head start
 * (150ms+ at scrub pace) keeps the paint path stall-free.
 */
const DECODE_AHEAD = 10;

interface PatchColor {
  r: number;
  g: number;
  b: number;
  af: number;
}

/** Shared 1×4 sampling canvas — CPU-backed via willReadFrequently, so
 *  reading it back never touches the display canvas's GPU queue. */
let sampler: CanvasRenderingContext2D | null = null;

/**
 * Average colour of a 1×4 strip just left of the watermark zone, read from
 * the SOURCE image — never from the display canvas. getImageData on the
 * display canvas forces a synchronous GPU→CPU readback (and repeated reads
 * make Chrome demote the canvas to software raster), which stalled the
 * whole Lenis/ScrollTrigger pipeline on every frame advance.
 */
function samplePatchColor(img: HTMLImageElement): PatchColor | null {
  try {
    if (!sampler) {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 4;
      sampler = c.getContext("2d", { willReadFrequently: true });
      if (!sampler) return null;
    }
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    // Image-space mirror of the old canvas-space sample point: just left
    // of the 5% × 7% corner zone, at its vertical centre.
    const zoneW = Math.ceil(iw * 0.05);
    const zoneH = Math.ceil(ih * 0.07);
    const sx = Math.max(0, iw - zoneW - 4);
    const sy = Math.max(0, ih - Math.ceil(zoneH / 2) - 2);
    sampler.clearRect(0, 0, 1, 4);
    sampler.drawImage(img, sx, sy, 1, 4, 0, 0, 1, 4);
    const d = sampler.getImageData(0, 0, 1, 4).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      a += d[i + 3];
    }
    return {
      r: Math.round(r / 4),
      g: Math.round(g / 4),
      b: Math.round(b / 4),
      af: Math.min(1, a / 4 / 255),
    };
  } catch {
    // Tainted canvas — leave the frame unpatched.
    return null;
  }
}

/**
 * Scroll-scrubbed frame sequence, driven by GSAP ScrollTrigger.
 *
 * ScrollTrigger owns the pinning and the scroll→progress mapping; `scrub`
 * lerps the playhead so the sequence eases rather than snapping frame to
 * frame. The preloader and the cached-image guard are carried over from the
 * hand-rolled version — both fixed real bugs that ScrollTrigger doesn't
 * address.
 */
export function useFrameSequence(
  config: FrameSequenceConfig,
): FrameSequenceReturn {
  const {
    framePath,
    totalFrames,
    framePattern = "frame-{NNN}.webp",
    scrollPerFrame = 32,
    fit = "cover",
    transparent = false,
    preloadMargin = 0,
    pin = true,
    tailHold = 0.15,
    leadHold = 0,
    scrubSmooth = 0.6,
    onProgress,
  } = config;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  /** 2D context, created once — repeated getContext calls are pointless
   *  and the alpha option below must be applied on first creation. */
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  /** Watermark patch colour per frame — sampled once, reused forever. */
  const patchColorsRef = useRef<(PatchColor | null | undefined)[]>([]);
  /** 1 = decode() already requested for that frame. */
  const decodeQueuedRef = useRef<Uint8Array | null>(null);
  const drawnRef = useRef(-1);
  /** Most recently REQUESTED frame — stale decode callbacks check it. */
  const pendingRef = useRef(-1);
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  const [shouldPreload, setShouldPreload] = useState(preloadMargin === 0);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* ---- prefers-reduced-motion: no pin, no scrub — snap to end state ----
     False during SSR/first paint (matchMedia is browser-only) and corrected
     after mount; the height collapse + skipped timeline follow via state. */
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Under reduced motion the section keeps no scrub runway: it collapses
     to one viewport showing the sequence's end state. */
  const scrollDistance = reducedMotion ? 0 : totalFrames * scrollPerFrame;

  /* ---- hold back below-the-fold sequences ---- */
  useEffect(() => {
    if (shouldPreload) return;
    const section = sectionRef.current;
    if (!section) return;
    const check = () => {
      if (
        section.getBoundingClientRect().top <=
        window.innerHeight + preloadMargin
      ) {
        setShouldPreload(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [shouldPreload, preloadMargin]);

  /* ---- preload ---- */
  useEffect(() => {
    if (!shouldPreload || totalFrames <= 0) return;
    let cancelled = false;
    const imgs: HTMLImageElement[] = new Array(totalFrames);
    imagesRef.current = imgs;
    patchColorsRef.current = new Array(totalFrames);
    const decodeQueued = new Uint8Array(totalFrames);
    decodeQueuedRef.current = decodeQueued;
    let count = 0;

    for (let i = 0; i < totalFrames; i++) {
      const img = new Image();
      imgs[i] = img;
      const settle = () => {
        img.onload = null;
        img.onerror = null;
        if (cancelled) return;
        if (i === 0) setReady(true);
        if (++count === totalFrames) setLoaded(true);
      };
      // Handlers before src: a cached image can fire load during assignment.
      img.onload = settle;
      img.onerror = settle;
      img.src = frameSrc(framePath, i, framePattern);
      if (i === 0) {
        // The first frame paints the moment the scrub mounts — decode it
        // off-thread now so that paint can't stall. Later frames are
        // decoded ahead of the playhead from draw().
        decodeQueued[0] = 1;
        img.decode?.().catch(() => {});
      }
      if (img.complete) settle();
    }
    return () => {
      cancelled = true;
    };
  }, [shouldPreload, framePath, totalFrames, framePattern]);

  /* ---- paint ---- */
  const draw = useCallback(function paint(idx: number) {
    const canvas = canvasRef.current;
    const img = imagesRef.current[idx];
    if (!canvas || !img) return;
    pendingRef.current = idx;
    if (idx === drawnRef.current) return;

    // Warm the decoder for the frames the scrub is about to hit (both
    // directions — the playhead reverses). Each frame is requested once.
    const flags = decodeQueuedRef.current;
    if (flags) {
      const imgs = imagesRef.current;
      const lo = Math.max(0, idx - DECODE_AHEAD);
      const hi = Math.min(imgs.length - 1, idx + DECODE_AHEAD);
      for (let j = lo; j <= hi; j++) {
        if (!flags[j] && imgs[j]) {
          flags[j] = 1;
          imgs[j].decode?.().catch(() => {});
        }
      }
    }

    if (!img.complete || !img.naturalWidth) {
      // Repaint when the frame decodes — but only if no newer frame has
      // been requested meanwhile, or a slow decode would paint an old
      // frame on top of a newer one.
      img.addEventListener(
        "load",
        () => {
          if (pendingRef.current === idx) paint(idx);
        },
        { once: true },
      );
      return;
    }
    let ctx = ctxRef.current;
    if (!ctx) {
      // Opaque sequences (cover-fit footage) declare alpha:false — the
      // compositor skips blending an 8-megapixel layer against the page.
      // Transparent stages (the chair cutout) keep their alpha channel.
      ctx = canvas.getContext("2d", { alpha: transparent });
      ctxRef.current = ctx;
    }
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Transparent frames must not smear — clear rather than overdraw.
    ctx.clearRect(0, 0, cw, ch);

    if (fitRef.current === "contain") {
      if (!transparent) {
        const cs = Math.max(cw / iw, ch / ih);
        ctx.save();
        ctx.filter = "blur(28px)";
        ctx.drawImage(img, (cw - iw * cs) / 2, (ch - ih * cs) / 2, iw * cs, ih * cs);
        ctx.restore();
      }
      const s = Math.min(cw / iw, ch / ih);
      ctx.drawImage(img, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s);
    } else {
      const s = Math.max(cw / iw, ch / ih);
      const sw = cw / s;
      const sh = ch / s;
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, cw, ch);
    }

    /* ---- Erase baked-in watermark (Gemini sparkle, bottom-right) ----
       The source frames carry a small (~40×40 px in image space) sparkle
       icon in the bottom-right corner. We paint over the corner with a
       smooth gradient fill matched to the local footage colour. This is
       cheaper than re-encoding 500+ images.

       PERF — this must never read the display canvas back. The old
       per-paint ctx.getImageData here forced a synchronous GPU→CPU
       readback on every frame advance of every film, which stalled the
       Lenis/ScrollTrigger pipeline (scroll itself is main-thread) and
       could demote the canvas to software raster. The colour now comes
       from samplePatchColor (source image, tiny CPU canvas), once per
       frame index, cached for the life of the sequence.

       Transparent sequences skip the patch entirely: their contain-fit
       corner is empty alpha, so the sampled colour was rgba(x,x,x,0) and
       the fills painted nothing — full cost, zero pixels. */
    if (!transparent) {
      // Patch covers ~5% width × 7% height of canvas — safely covers
      // the watermark at any viewport size.
      const patchW = Math.ceil(cw * 0.05);
      const patchH = Math.ceil(ch * 0.07);
      const px = cw - patchW;
      const py = ch - patchH;

      let c = patchColorsRef.current[idx];
      if (c === undefined) {
        c = samplePatchColor(img);
        patchColorsRef.current[idx] = c;
      }
      if (c) {
        const { r, g, b, af } = c;
        ctx.save();

        // Horizontal gradient: fades from transparent to the sampled colour
        // across the left 40% of the patch, then solid for the rest.
        const featherL = Math.ceil(patchW * 0.4);
        const grad = ctx.createLinearGradient(px - featherL, 0, px + Math.ceil(patchW * 0.15), 0);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},${af})`);
        ctx.fillStyle = grad;
        ctx.fillRect(px - featherL, py, patchW + featherL, patchH);

        // Vertical gradient: feathers the top edge so the patch blends
        // into the image above without a hard seam.
        const featherT = Math.ceil(patchH * 0.4);
        const gradV = ctx.createLinearGradient(0, py - featherT, 0, py + Math.ceil(patchH * 0.2));
        gradV.addColorStop(0, `rgba(${r},${g},${b},0)`);
        gradV.addColorStop(1, `rgba(${r},${g},${b},${af})`);
        ctx.fillStyle = gradV;
        ctx.fillRect(px, py - featherT, patchW, patchH + featherT);

        // Solid fill for the innermost corner to fully cover the sparkle.
        ctx.fillStyle = `rgba(${r},${g},${b},${af})`;
        ctx.fillRect(px + Math.ceil(patchW * 0.15), py + Math.ceil(patchH * 0.2), patchW, patchH);

        ctx.restore();
      }
    }

    drawnRef.current = idx;
    // Progress is emitted from the ACTUAL paint, not the request: while
    // frames are still streaming in, a fast scrub outruns the decoder and
    // the canvas holds an older frame — scene scripts (hotspots, copy)
    // must hold with it, or dots float over the wrong room.
    progressRef.current?.(idx / Math.max(1, totalFrames - 1));
  }, [transparent, totalFrames]);

  /* ---- canvas bitmap sizing ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2); // cap: 3x costs fill-rate
      // Measure the wrapper, not the canvas: the canvas carries gsap
      // transforms (cursor tilt) that inflate its bounding box, and as a
      // replaced element its layout height tracks the bitmap, not the box.
      //
      // offset* rather than getBoundingClientRect(): the RECT IS SCALED BY
      // ANCESTOR TRANSFORMS. The hero→craft hand-off scales
      // [data-hero-stage] — this canvas's own parent — down to 0.04, so a
      // resize landing mid-bridge sized the bitmap to ~4% of the viewport
      // and left it there, and every later frame was smeared back up to
      // full size. offsetWidth/Height read the untransformed layout box,
      // so the bitmap is always allocated at true resolution.
      const box = canvas.parentElement ?? canvas;
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      if (!width || !height) return;
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        const last = drawnRef.current;
        drawnRef.current = -1;
        if (ready) draw(last >= 0 ? last : 0);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("orientationchange", resize, { passive: true });
    resize();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [ready, draw]);

  /* ---- ScrollTrigger scrub ---- */
  useEffect(() => {
    if (!ready) return;
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section) return;

    if (reducedMotion) {
      // Snap straight to the section's end state: paint the final frame,
      // which also emits onProgress(1) so scene copy lands in its settled
      // position. No pin, no timeline — nothing to kill.
      draw(totalFrames - 1);
      return;
    }

    const playhead = { frame: 0 };
    draw(0);

    const hold = Math.min(0.5, Math.max(0, tailHold));
    const lead = Math.min(0.5, Math.max(0, leadHold));
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: `+=${scrollDistance}`,
        pin: pin ? sticky ?? undefined : false,
        // The section already reserves `100dvh + scrollDistance`, so letting
        // ScrollTrigger add its own pin spacer would double the scroll length.
        pinSpacing: false,
        scrub: scrubSmooth, // lerped playhead — removes frame-to-frame snapping
        invalidateOnRefresh: true,
      },
    });
    // Dead time at the head — frame 1 rests on screen while an entrance
    // transition (e.g. the strip-tear) plays over the lead distance.
    if (lead > 0) tl.to({}, { duration: lead });
    tl.to(playhead, {
      frame: totalFrames - 1,
      ease: "none",
      snap: "frame",
      duration: 1 - hold - lead,
      // draw() emits onProgress itself, from the frame it actually paints.
      onUpdate: () => draw(Math.round(playhead.frame)),
    });
    // Dead time at the tail — the finished frame rests on screen while the
    // remaining pin distance scrolls out, so the unpin never interrupts.
    if (hold > 0) tl.to({}, { duration: hold });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [ready, reducedMotion, totalFrames, scrollDistance, pin, tailHold, leadHold, scrubSmooth, draw]);

  return { canvasRef, sectionRef, stickyRef, ready, loaded, scrollDistance };
}
