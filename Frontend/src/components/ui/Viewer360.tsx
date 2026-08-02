"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "@/lib/gsap";

/**
 * The 360° product viewer — the lightbox behind the customizer's "360"
 * button.
 *
 * It runs on a frame sequence rather than a video. A <video> can only be
 * scrubbed by seeking `currentTime`, and browsers snap those seeks to the
 * nearest keyframe, so dragging a clip stutters and lands on the wrong
 * angle. 60 decoded stills at 6° apart give exact, reversible control —
 * this is how product spinners are built.
 *
 * Interaction, mirroring the reference:
 *  - opens with a slow auto-turn, so the piece reads as 3D immediately;
 *  - drag left/right, scroll, or arrow-key to take over the spin;
 *  - a flick keeps turning and eases out on a GSAP inertia tween;
 *  - the readout tracks degrees turned, and ⊗ / Escape exit.
 *
 * Rendered through a portal so it escapes the customizer's transformed
 * ancestors — a fixed element inside a transformed parent resolves against
 * that parent instead of the viewport.
 */

const FRAME_COUNT = 60;
/** Degrees of turn each frame advances. 360 / 60. */
const DEG_PER_FRAME = 360 / FRAME_COUNT;
const frameUrl = (i: number) =>
  `/media/customizer/360/frames/f-${String(i).padStart(2, "0")}.webp`;

/** Viewport px of horizontal drag that equals one full revolution. */
const DRAG_PX_PER_REVOLUTION = 700;
/** Wheel delta → degrees. */
const WHEEL_DEG_PER_PX = 0.35;
/** Idle turntable speed, deg/sec. */
const AUTO_SPIN_DEG_PER_SEC = 26;

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SpinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

/** Normalise any angle into [0, 360). */
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

export default function Viewer360({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** @deprecated the viewer runs on the frame sequence, not the clip. */
  src?: string;
  poster?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /** Decoded frames, index-aligned with frameUrl(). */
  const framesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  /** The single source of truth for rotation; canvas reads it, React doesn't. */
  const angleRef = useRef(0);
  const [degrees, setDegrees] = useState(0);
  const [manual, setManual] = useState(false);

  const dragRef = useRef<{ x: number; angle: number; t: number; vx: number } | null>(null);
  const autoRef = useRef<gsap.core.Tween | null>(null);
  const inertiaRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => setMounted(true), []);

  /* ---- paint ---- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || !frames.length) return;
    const idx = Math.round(wrap360(angleRef.current) / DEG_PER_FRAME) % FRAME_COUNT;
    const img = frames[idx];
    if (!img?.complete || !img.naturalWidth) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // cover-fit: the frames carry their own room, so filling the stage
    // reads as a window into the space rather than a letterboxed clip.
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }, []);

  /** Move to an absolute angle and repaint. */
  const setAngle = useCallback(
    (deg: number) => {
      angleRef.current = deg;
      setDegrees(Math.round(wrap360(deg)));
      draw();
    },
    [draw],
  );

  /* ---- preload ---- */
  useEffect(() => {
    if (!open || framesRef.current.length) return;
    let cancelled = false;
    let done = 0;
    const imgs: HTMLImageElement[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = frameUrl(i);
      const tick = () => {
        if (cancelled) return;
        done++;
        setLoaded(done);
        // Paint as soon as the opening frame exists so the stage is never
        // blank, then again on the last one to settle.
        if (i === 0 || done === FRAME_COUNT) draw();
        if (done === FRAME_COUNT) setReady(true);
      };
      img.onload = tick;
      img.onerror = tick;
      imgs.push(img);
    }
    framesRef.current = imgs;
    return () => {
      cancelled = true;
    };
  }, [open, draw]);

  /* ---- esc to close + scroll lock + focus restore ---- */
  useEffect(() => {
    if (!open) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        autoRef.current?.kill();
        inertiaRef.current?.kill();
        setManual(true);
        setAngle(angleRef.current + (e.key === "ArrowRight" ? DEG_PER_FRAME : -DEG_PER_FRAME));
      }
    };
    document.addEventListener("keydown", onKey);
    const focusId = requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(focusId);
      document.body.style.overflow = prevOverflow;
      restoreTo?.focus?.();
    };
  }, [open, onClose, setAngle]);

  /* ---- entrance + idle turntable ---- */
  useEffect(() => {
    if (!open) return;
    setManual(false);
    setAngle(0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduce) {
      const tl = gsap.timeline();
      if (backdropRef.current) {
        tl.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" }, 0);
      }
      if (dialogRef.current) {
        tl.fromTo(
          dialogRef.current,
          { opacity: 0, scale: 0.955, y: 14 },
          { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out" },
          0.04,
        );
      }
      // Turn continuously until the user takes over.
      autoRef.current = gsap.to(angleRef, {
        current: 360,
        duration: 360 / AUTO_SPIN_DEG_PER_SEC,
        ease: "none",
        repeat: -1,
        onUpdate: () => {
          setDegrees(Math.round(wrap360(angleRef.current)));
          draw();
        },
      });
      return () => {
        tl.kill();
        autoRef.current?.kill();
        autoRef.current = null;
      };
    }
    return undefined;
  }, [open, draw, setAngle]);

  /* ---- keep the canvas crisp through resizes ---- */
  useEffect(() => {
    if (!open) return;
    const onResize = () => draw();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [open, draw]);

  /* ---- take over ---- */
  const takeOver = useCallback(() => {
    autoRef.current?.kill();
    autoRef.current = null;
    inertiaRef.current?.kill();
    inertiaRef.current = null;
    setManual(true);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      takeOver();
      dragRef.current = { x: e.clientX, angle: angleRef.current, t: e.timeStamp, vx: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [takeOver],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x;
      // Dragging right turns the piece toward the viewer's right.
      const next = drag.angle - (dx / DRAG_PX_PER_REVOLUTION) * 360;
      const dt = e.timeStamp - drag.t;
      if (dt > 0) drag.vx = (e.clientX - drag.x) / dt;
      setAngle(next);
    },
    [setAngle],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (!drag) return;
      // Flick: carry the throw on an easing tween instead of stopping dead.
      const degPerMs = -(drag.vx / DRAG_PX_PER_REVOLUTION) * 360;
      if (Math.abs(degPerMs) < 0.02) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const throwDeg = degPerMs * 420;
      inertiaRef.current = gsap.to(angleRef, {
        current: angleRef.current + throwDeg,
        duration: 1.15,
        ease: "power2.out",
        onUpdate: () => {
          setDegrees(Math.round(wrap360(angleRef.current)));
          draw();
        },
      });
    },
    [draw],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      takeOver();
      setAngle(angleRef.current + e.deltaY * WHEEL_DEG_PER_PX);
    },
    [takeOver, setAngle],
  );

  if (!mounted || !open) return null;

  const pct = Math.round((loaded / FRAME_COUNT) * 100);

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: "rgba(6,4,3,0.92)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => {
        // Backdrop-only: a mousedown that started on the dialog must not
        // close when the pointer is released outside it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — 360 degree view`}
        className="relative w-full max-w-[1100px]"
      >
        {/* header */}
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p
              className="uppercase"
              style={{
                color: "#FFF",
                fontFamily: '"Red Hat Display", var(--font-redhat)',
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "1.5px",
              }}
            >
              {title}
            </p>
            <p
              className="mt-1 flex items-center gap-1.5 uppercase"
              style={{
                color: "rgba(255,255,255,0.5)",
                fontFamily: '"Red Hat Display", var(--font-redhat)',
                fontSize: "10px",
                fontWeight: 400,
                letterSpacing: "1px",
              }}
            >
              <SpinIcon />
              {ready
                ? manual
                  ? "Drag or scroll to spin"
                  : "Drag, scroll or use ← → to take control"
                : `Loading ${pct}%`}
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close 360 degree view"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DFA35C] focus-visible:outline-offset-2"
          >
            <CloseIcon />
          </button>
        </div>

        {/* stage */}
        <div
          className="relative aspect-[16/9] max-h-[70dvh] w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-black/60 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          role="img"
          aria-label={`${title}, turned ${degrees} degrees. Drag to rotate.`}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />

          {!ready && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-px w-40 overflow-hidden bg-white/15">
                <div
                  className="h-full bg-[#DFA35C] transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* readout — degrees turned, on a 0-360 track */}
        <div className="mt-4 flex items-end justify-between gap-6">
          <div className="flex items-baseline gap-2">
            <span
              style={{
                color: "#FFF",
                fontFamily: "var(--font-pearl), var(--font-hero)",
                fontSize: "30px",
                lineHeight: 1,
                letterSpacing: "1px",
              }}
            >
              {degrees}
            </span>
            <span
              className="uppercase"
              style={{
                color: "rgba(255,255,255,0.5)",
                fontFamily: '"Red Hat Display", var(--font-redhat)',
                fontSize: "10px",
                fontWeight: 400,
                letterSpacing: "1px",
              }}
            >
              Degrees turned
            </span>
          </div>

          <div className="flex-1">
            <div className="relative h-px w-full bg-white/15">
              <div
                className="absolute inset-y-0 left-0 bg-[#DFA35C]"
                style={{ width: `${(degrees / 360) * 100}%` }}
              />
            </div>
            <div
              className="mt-1.5 flex justify-between uppercase"
              style={{
                color: "rgba(255,255,255,0.35)",
                fontFamily: '"Red Hat Display", var(--font-redhat)',
                fontSize: "10px",
                letterSpacing: "1px",
              }}
            >
              <span>0°</span>
              <span>360°</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
