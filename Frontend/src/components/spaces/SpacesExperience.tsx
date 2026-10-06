"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import { PAGE_ENTER_EVENT, transitionState } from "@/lib/page-transition";
import { gsap, ScrollTrigger } from "@/lib/motion";
import type { SpacesFilm } from "./film/director";

/**
 * Motion director for /spaces.
 *
 *  film     desktop: one fixed stage that never scrolls; wheel, touch and
 *           keys play the film scene to scene (film/)
 *  stacked  phones: the scenes as a single column, revealed in view
 *  static   prefers-reduced-motion: every scene in place
 *
 * Arriving through the route curtain, the opening waits for it to lift.
 */
type Mode = "film" | "stacked" | "static";

/** Must match the film media query in spaces.module.css. */
const FILM_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

const SCENE_FROM_HASH: Record<string, number> = { "#nimbus": 2, "#terra": 3 };

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function SpacesExperience({ className, children }: { className: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { stop, start } = useSmoothScroll();
  // Bumped when the viewport crosses the film boundary: tears the current
  // mode down and builds the other.
  const [run, setRun] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia(FILM_QUERY);
    const flip = () => setRun((n) => n + 1);
    mq.addEventListener("change", flip);
    return () => mq.removeEventListener("change", flip);
  }, []);

  // The film never scrolls the page, so Lenis sits this route out.
  useEffect(() => {
    if (!window.matchMedia(FILM_QUERY).matches) return;
    stop();
    return () => start();
  }, [stop, start, run]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const filmMode = window.matchMedia(FILM_QUERY).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const viaCurtain = transitionState.phase === "covering" || transitionState.phase === "covered";

    let disposed = false;
    const film: { current: SpacesFilm | null } = { current: null };
    const cleanups: Array<() => void> = [];
    const ctx = gsap.context(() => {}, root);

    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => (markReady = resolve));
    transitionState.ready = ready;

    void (async () => {
      if (reduce) {
        root.dataset.mode = "static";
        markReady();
        return;
      }

      // Splits and layout must measure the final faces.
      await Promise.race([document.fonts.ready, wait(2500)]);
      if (disposed) return;

      let mode: Mode = "stacked";
      if (filmMode) {
        try {
          const { createSpacesFilm } = await import("./film/director");
          if (disposed) return;
          const initial = SCENE_FROM_HASH[window.location.hash] ?? 0;
          ctx.add(() => {
            film.current = createSpacesFilm(root, { initial });
          });
          if (film.current) mode = "film";
        } catch (error) {
          console.warn("Spaces: film unavailable, showing the stacked page.", error);
        }
      }
      if (disposed) return;
      root.dataset.mode = mode;
      if (finePointer) cleanups.push(...magnetic(root));
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __mapleSpaces?: unknown }).__mapleSpaces = { mode, film: film.current };
      }

      let enter: gsap.core.Timeline = gsap.timeline({ paused: true });
      if (mode === "film" && film.current) {
        await film.current.whenReady(1800);
        if (disposed) return;
        ctx.add(() => {
          if (film.current) enter = film.current.entrance();
        });
      } else {
        ctx.add(() => {
          enter = buildStacked(root);
        });
        ScrollTrigger.refresh();
      }
      markReady();

      const play = () => enter.play();
      if (viaCurtain && transitionState.phase !== "revealing") {
        window.addEventListener(PAGE_ENTER_EVENT, play, { once: true });
        cleanups.push(() => window.removeEventListener(PAGE_ENTER_EVENT, play));
      } else {
        play();
      }
    })();

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      film.current?.destroy();
      film.current = null;
      ctx.revert();
      if (transitionState.ready === ready) transitionState.ready = null;
      delete root.dataset.mode;
    };
  }, [run]);

  return (
    <div ref={rootRef} className={className} data-spaces-page>
      {children}
    </div>
  );
}

// ==========================================================================
// Stacked page (phones): the scenes revealed as they come into view
// ==========================================================================

function buildStacked(root: HTMLElement) {
  const enter = gsap.timeline({ paused: true });
  const headerItems = document.querySelectorAll<HTMLElement>("[data-paper-header] [data-intro-item]");
  if (headerItems.length) {
    gsap.set(headerItems, { opacity: 0, y: -12 });
    enter.to(headerItems, { opacity: 1, y: 0, duration: 1, stagger: 0.06, ease: "mapleOut" }, 0.1);
  }
  const landingBits = root.querySelectorAll<HTMLElement>("[data-scene='landing'] [data-enter]");
  gsap.set(landingBits, { opacity: 0, y: 18 });
  enter.to(landingBits, { opacity: 1, y: 0, duration: 1.1, stagger: 0.14, ease: "mapleOut" }, 0.15);

  root.querySelectorAll<HTMLElement>("[data-scene='nimbus'], [data-scene='terra']").forEach((scene) => {
    const bits = scene.querySelectorAll<HTMLElement>(
      "[data-world-tagline], [data-world-title], [data-world-photo], [data-world-enter], [data-world-copy], [data-world-switch]",
    );
    gsap.from(bits, {
      opacity: 0,
      y: 26,
      duration: 1.1,
      stagger: 0.1,
      ease: "mapleOut",
      scrollTrigger: { trigger: scene, start: "top 72%", once: true },
    });
  });
  return enter;
}

/** Rings and the header pill lean toward the cursor and spring back. */
function magnetic(root: HTMLElement): Array<() => void> {
  const els = [
    ...root.querySelectorAll<HTMLElement>("[data-magnetic]"),
    ...document.querySelectorAll<HTMLElement>("[data-paper-header] [data-magnetic]"),
  ];
  return els.map((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  });
}
