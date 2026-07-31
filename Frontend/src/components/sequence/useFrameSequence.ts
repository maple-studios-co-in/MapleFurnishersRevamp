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
    const ctx = canvas.getContext("2d");
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
       The source frames carry a small (~40×40 px in 1280×720 image space)
       sparkle icon in the bottom-right corner. We sample a strip from
       just outside the watermark zone and paint over the corner with a
       smooth gradient fill. This is cheaper than re-encoding 500+ images. */
    {
      // Patch covers ~5% width × 7% height of canvas — safely covers
      // the watermark at any viewport size.
      const patchW = Math.ceil(cw * 0.05);
      const patchH = Math.ceil(ch * 0.07);
      const px = cw - patchW;
      const py = ch - patchH;

      try {
        // Sample a 4px-tall strip just LEFT of the patch, near its vertical
        // centre, and average the RGBA values for a stable local colour.
        const sampleX = Math.max(0, px - 4);
        const sampleH = 4;
        const sampleY = py + Math.floor(patchH / 2) - Math.floor(sampleH / 2);
        const strip = ctx.getImageData(sampleX, Math.max(0, sampleY), 1, sampleH).data;
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        for (let i = 0; i < strip.length; i += 4) {
          rSum += strip[i]; gSum += strip[i + 1]; bSum += strip[i + 2]; aSum += strip[i + 3];
        }
        const n = sampleH;
        const r = Math.round(rSum / n);
        const g = Math.round(gSum / n);
        const b = Math.round(bSum / n);
        const af = Math.min(1, aSum / n / 255);

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
      } catch {
        // getImageData can throw on tainted canvases — fail silently.
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
