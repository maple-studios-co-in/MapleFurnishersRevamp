"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface SmoothScrollApi {
  /** Freeze scrolling (used while the hero film plays). */
  stop: () => void;
  /** Resume scrolling. */
  start: () => void;
  /** Animate to a section id. */
  scrollTo: (target: string) => void;
}

const SmoothScrollContext = createContext<SmoothScrollApi>({
  stop: () => {},
  start: () => {},
  scrollTo: () => {},
});

export const useSmoothScroll = () => useContext(SmoothScrollContext);

/**
 * Momentum scrolling wired into GSAP's ticker.
 *
 * Lenis must drive ScrollTrigger.update rather than the native scroll event,
 * otherwise pinned sections lag a frame behind the smoothed position and the
 * scrubbed sequences visibly judder.
 *
 * Scroll locking goes through lenis.stop()/start() — setting
 * `overflow: hidden` on <body> does not stop Lenis, it only hides the
 * scrollbar while the virtual scroll keeps running.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const [api, setApi] = useState<SmoothScrollApi>({
    stop: () => {},
    start: () => {},
    scrollTo: () => {},
  });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Native scrolling only; still let ScrollTrigger drive the sequences.
      setApi({
        stop: () => {
          document.documentElement.style.overflow = "hidden";
        },
        start: () => {
          document.documentElement.style.overflow = "";
        },
        scrollTo: (t) =>
          document.querySelector(t)?.scrollIntoView({ behavior: "auto" }),
      });
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    setApi({
      stop: () => lenis.stop(),
      start: () => lenis.start(),
      scrollTo: (t) => lenis.scrollTo(t, { offset: 0, duration: 1.2 }),
    });

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <SmoothScrollContext.Provider value={api}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
