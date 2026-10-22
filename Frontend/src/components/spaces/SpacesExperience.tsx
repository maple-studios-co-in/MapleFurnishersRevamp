"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import { PAGE_ENTER_EVENT, transitionState } from "@/lib/page-transition";
import { gsap, ScrollTrigger } from "@/lib/motion";
import type { SpacesFilm } from "./film/director";
import { ROOM_WORLDS, type RoomsWorldId } from "./rooms/content";
import { hasVeil, releaseVeil } from "./rooms/veil";

type Router = ReturnType<typeof useRouter>;

/**
 * Motion director for /spaces.
 *
 *  film     desktop: one fixed stage that never scrolls; wheel, touch and
 *           keys play the film scene to scene (film/)
 *  stacked  phones: the scenes as a single column, revealed in view
 *  static   prefers-reduced-motion: every scene in place
 *
 * Arriving through the route curtain, the opening waits for it to lift;
 * arriving back from a world's rooms through their cloud, the veil fades
 * off that world's scene once it is ready.
 */
type Mode = "film" | "stacked" | "static";

/** Must match the film media query in spaces.module.css. */
const FILM_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

const SCENE_FROM_HASH: Record<string, number> = { "#nimbus": 2, "#terra": 3 };

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function SpacesExperience({ className, children }: { className: string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { stop, start } = useSmoothScroll();
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
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
        cleanups.push(...ENTERABLE.map((id) => wireEnter(root, id, routerRef, false)));
        markReady();
        releaseVeil(hasVeil() ? 600 : 0);
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
      cleanups.push(...ENTERABLE.map((id) => wireEnter(root, id, routerRef, true)));
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
      if (hasVeil()) releaseVeil(1100);

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

/** The worlds whose "Click to Enter" opens their rooms (rooms/content.ts). */
const ENTERABLE: readonly RoomsWorldId[] = ["nimbus", "terra"];

/**
 * A world's "Click to Enter": its cloud bursts out of the ring and the rooms
 * open behind it (rooms/burst.ts). Interest (hover, focus, an idle beat)
 * prefetches the route and the first plates. Modified clicks (a new tab)
 * keep the browser's default; without motion it is a plain navigation.
 */
function wireEnter(root: HTMLElement, id: RoomsWorldId, router: { current: Router }, motion: boolean) {
  const world = ROOM_WORLDS[id];
  const link = root.querySelector<HTMLAnchorElement>(`[data-world-enter='${id}']`);
  if (!link) return () => {};
  let busy = false;
  let warmed = false;
  const warm = () => {
    if (warmed) return;
    warmed = true;
    router.current.prefetch(world.path);
    if (motion) {
      void import("./rooms/burst").then((m) => m.warmRooms(world)).catch(() => {});
    }
  };
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (busy) return;
    busy = true;
    const go = () => router.current.push(world.path);
    if (!motion) {
      go();
      return;
    }
    const ring = link.querySelector<HTMLElement>("[data-enter-ring]") ?? link;
    const r = ring.getBoundingClientRect();
    const origin = [(r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight] as const;
    void import("./rooms/burst")
      .then(({ burstInto }) =>
        burstInto(world, { origin, scene: link.closest<HTMLElement>("[data-world-inner]"), ring: link, navigate: go }),
      )
      .catch((error) => {
        console.warn("Spaces: the burst is unavailable, entering directly.", error);
        go();
      });
  };
  link.addEventListener("pointerenter", warm);
  link.addEventListener("focus", warm);
  link.addEventListener("click", onClick);
  const idle = window.setTimeout(warm, 3000);
  return () => {
    window.clearTimeout(idle);
    link.removeEventListener("pointerenter", warm);
    link.removeEventListener("focus", warm);
    link.removeEventListener("click", onClick);
  };
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
