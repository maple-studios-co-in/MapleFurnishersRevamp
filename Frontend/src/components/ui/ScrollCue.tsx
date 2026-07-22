"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

/**
 * "SCROLL DOWN" cue shown once the hero film freezes, per the blueprint
 * reference: the label arches gently over a thin plumb line, with a small
 * hollow ring that drifts down the line. No enclosing circle — just the
 * arc, the line, and the bead, in warm cream with a soft shadow so it
 * survives the bright floor of the frozen frame.
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
      // The ring drifts down the line and dissolves — scroll direction.
      gsap.fromTo(
        beadRef.current,
        { y: 0, opacity: 1 },
        {
          y: 26,
          opacity: 0.15,
          duration: 1.6,
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
      className="pointer-events-none absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center"
      style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.5))" }}
      aria-hidden
    >
      {/* Label arched over the line. */}
      <svg viewBox="0 0 180 46" className="h-[46px] w-[180px]">
        <defs>
          <path id="mf-scroll-arc" d="M 8,42 Q 90,4 172,42" fill="none" />
        </defs>
        <text
          className="font-ui"
          fill="rgb(246 241 232 / 0.92)"
          fontSize="11"
          letterSpacing="4.2"
        >
          <textPath href="#mf-scroll-arc" startOffset="50%" textAnchor="middle">
            SCROLL DOWN
          </textPath>
        </text>
      </svg>

      {/* Plumb line with the drifting ring bead. */}
      <svg viewBox="0 0 20 60" className="mt-1 h-[60px] w-[20px]">
        <line
          x1="10"
          y1="0"
          x2="10"
          y2="60"
          stroke="rgb(246 241 232 / 0.55)"
          strokeWidth="1"
        />
        <circle
          ref={beadRef}
          cx="10"
          cy="12"
          r="5.5"
          fill="none"
          stroke="rgb(246 241 232 / 0.95)"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}
