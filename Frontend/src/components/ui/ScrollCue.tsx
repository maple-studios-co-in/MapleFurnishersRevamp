"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

/**
 * "SCROLL DOWN" cue shown once the hero film freezes, matched to the
 * user's reference crop: the label arches steeply (sagitta ≈ 0.28 of the
 * chord, end letters tilting ~45°) over a thin plumb line threaded
 * THROUGH a hollow ring, which drifts gently down the line — scroll
 * direction. Red Hat Display 500 at full-strength #F4F2EC with a tight
 * dark halo so it holds up over the sunlit floor.
 */
export default function ScrollCue({ visible }: { visible: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const beadRef = useRef<SVGCircleElement>(null);
  const [dismissed, setDismissed] = useState(false);

  // Retire the cue the moment the user actually scrolls — leaving it up
  // once its instruction has been followed reads as clutter.
  useEffect(() => {
    if (!visible) return;
    const onScroll = () => window.scrollY > 40 && setDismissed(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visible]);

  useEffect(() => {
    if (!visible || dismissed) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 1.1, ease: "power2.out" },
      );
      if (reduce) return;
      // The ring drifts down the line and softens — scroll direction.
      gsap.fromTo(
        beadRef.current,
        { y: 0, opacity: 1 },
        {
          y: 14,
          opacity: 0.5,
          duration: 1.5,
          ease: "power1.inOut",
          repeat: -1,
          yoyo: true,
        },
      );
    });
    return () => ctx.revert();
  }, [visible, dismissed]);

  useEffect(() => {
    if (!dismissed) return;
    gsap.to(rootRef.current, { autoAlpha: 0, duration: 0.5 });
  }, [dismissed]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute bottom-[4%] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center"
      style={{
        // Tight dark halo + soft ambient shadow — the cue sits over the
        // bright sunlit floor, where a single soft shadow washed out.
        filter:
          "drop-shadow(0 1px 3px rgba(0,0,0,0.85)) drop-shadow(0 4px 14px rgba(0,0,0,0.55))",
      }}
      aria-hidden
    >
      {/* One drawing, per the reference: the label rides a steep arc
          (chord 236, sagitta 64) whose descending ends flank the plumb
          line below; the line threads through the ring. The path runs
          ~14px longer than the label — glyphs past a path's end are
          dropped entirely, so the margin guards against fallback-font
          metrics while Red Hat Display loads. */}
      <svg viewBox="0 0 300 195" className="h-[195px] w-[300px]">
        <defs>
          <path id="mf-scroll-arc" d="M 32,108 Q 150,-20 268,108" fill="none" />
        </defs>
        <text
          fill="#F4F2EC"
          fontSize="21.863"
          fontWeight="500"
          style={{ fontFamily: "var(--font-redhat)", letterSpacing: "9.2px" }}
        >
          <textPath href="#mf-scroll-arc" startOffset="50%" textAnchor="middle">
            SCROLL DOWN
          </textPath>
        </text>

        <line
          x1="150"
          y1="103"
          x2="150"
          y2="188"
          stroke="#F4F2EC"
          strokeOpacity="0.7"
          strokeWidth="1"
        />
        <circle
          ref={beadRef}
          cx="150"
          cy="134"
          r="17"
          fill="none"
          stroke="#F4F2EC"
          strokeOpacity="0.95"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
