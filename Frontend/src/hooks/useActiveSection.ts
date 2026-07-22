"use client";

import { useEffect, useState } from "react";
import { SECTIONS } from "@/lib/sections";


export function useActiveSection(): number {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const measure = () => {
      const mid = window.innerHeight / 2;
      let best = 0;

      for (let i = 0; i < SECTIONS.length; i++) {
        const el = document.getElementById(SECTIONS[i].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // The last section whose top has crossed the midpoint is the one
        // being viewed; sections are laid out in document order.
        if (r.top <= mid) best = i;
      }
      setActive((prev) => (prev === best ? prev : best));
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
