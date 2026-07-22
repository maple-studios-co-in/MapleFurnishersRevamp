"use client";

import {
  useFrameSequence,
  type FrameSequenceConfig,
} from "./useFrameSequence";

interface FrameSequenceProps extends FrameSequenceConfig {
  /** Section id — must match an entry in lib/sections.ts. */
  id?: string;
  className?: string;
  label?: string;
  /** Rendered inside the pinned viewport, behind the canvas. */
  background?: React.ReactNode;
  /** Rendered inside the pinned viewport, in front of the canvas. */
  foreground?: React.ReactNode;
  /**
   * Overrides the canvas placement classes. Lets a scene inset the drawing
   * area — e.g. the chair stage starts below the fixed header so the
   * exploded seat back is never hidden underneath it.
   */
  canvasClassName?: string;
  /**
   * Rendered directly on the tall spacer, OUTSIDE the pinned viewport —
   * for chapter-anchor markers at a given scroll depth. Children of the
   * pinned element never move, so markers must not live in there.
   */
  markers?: React.ReactNode;
}

/**
 * A pinned, scroll-scrubbed frame sequence.
 *
 * `background` and `foreground` bracket the canvas so a scene can layer real
 * DOM behind and in front of the subject — which is how the craftsmanship
 * chapter puts the wordmark behind the chair and the copy in front.
 */
export default function FrameSequence({
  id,
  className = "",
  label,
  background,
  foreground,
  canvasClassName = "absolute inset-0",
  markers,
  ...config
}: FrameSequenceProps) {
  const { canvasRef, sectionRef, stickyRef, ready, scrollDistance } =
    useFrameSequence(config);

  return (
    <section
      id={id}
      ref={sectionRef}
      aria-label={label}
      className={`relative ${className}`}
      style={{ height: `calc(100dvh + ${scrollDistance}px)` }}
    >
      {markers}
      <div
        ref={stickyRef}
        className="relative h-[100dvh] w-full overflow-hidden"
      >
        {background}
        {/* The placement classes live on a wrapper div: a canvas is a
            replaced element, so `top`/`bottom` insets don't stretch it —
            its layout height follows the bitmap's intrinsic ratio, which
            made it overflow the viewport and clip the drawing (the chair
            losing its base). The wrapper stretches; the canvas fills it. */}
        <div className={canvasClassName}>
          <canvas
            ref={canvasRef}
            aria-hidden
            className={`block h-full w-full transition-opacity duration-500 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
        {foreground}
      </div>
    </section>
  );
}
