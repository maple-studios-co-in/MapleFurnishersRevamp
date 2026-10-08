"use client";

import { useEffect, useState } from "react";
import { SECTIONS } from "@/lib/sections";


export function useActiveSection(): number {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // The index last handed to React: a state dispatch on every scroll
    // event costs React work on every frame of a scroll, for nothing.
    let current = 0;
    const measure = () => {
      const els = SECTIONS.map((s) => document.getElementById(s.id));
      // No chapters on this page (phones, other routes): don't touch layout.
      // Reading innerHeight or a rect forces a style/layout pass whenever
      // something animated since the last frame — on every scroll event.
      if (!els.some(Boolean)) {
        if (current !== 0) {
          current = 0;
          setActive(0);
        }
        return;
      }
      const mid = window.innerHeight / 2;
      let best = 0;

      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // The last section whose top has crossed the midpoint is the one
        // being viewed; sections are laid out in document order.
        if (r.top <= mid) best = i;
      }
      if (best !== current) {
        current = best;
        setActive(best);
      }
    };

    // Run inline rather than coalescing through requestAnimationFrame: a
    // rAF-guarded version wedges permanently if one frame is ever dropped
    // (the in-flight id never clears, so later scrolls are all skipped).
    // Six rect reads per scroll event is not worth that failure mode.
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return active;
}
