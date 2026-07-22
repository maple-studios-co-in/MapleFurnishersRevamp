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

  const scrollDistance = totalFrames * scrollPerFrame;

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
      const box = canvas.parentElement ?? canvas;
      const { width, height } = box.getBoundingClientRect();
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
        scrub: 0.6, // lerped playhead — removes frame-to-frame snapping
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
  }, [ready, totalFrames, scrollDistance, pin, tailHold, leadHold, draw]);

  return { canvasRef, sectionRef, stickyRef, ready, loaded, scrollDistance };
}
