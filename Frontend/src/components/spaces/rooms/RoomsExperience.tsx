"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import { gsap, ScrollTrigger } from "@/lib/motion";
import { PAGE_ENTER_EVENT, transitionState } from "@/lib/page-transition";
import { ROOM_WORLDS, type RoomsWorldId } from "./content";
import type { RoomsFilm } from "./director";
import { hasVeil, releaseVeil } from "./veil";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Motion director for a world's rooms (/spaces/nimbus, /spaces/terra).
 *
 *  film    the WebGL rooms (director.ts), scrubbed by the page's scroll,
 *          opening from the cloud's whiteout
 *  static  reduced motion or no WebGL: the finished rooms as sections
 *
 * Arriving from Spaces' "Click to Enter", the page loads behind the cloud
 * veil; its own first frame is that same whiteout, so the veil is simply
 * lifted and the cloud clears onto the first room. Arriving through the
 * route curtain, the opening waits for the curtain to lift.
 */
export default function RoomsExperience({
  world,
  className,
  children,
}: {
  world: RoomsWorldId;
  className: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { scrollTo } = useSmoothScroll();
  // The film is built once; these refs keep its callbacks current.
  const scrollRef = useRef(scrollTo);
  const routerRef = useRef(router);
  useEffect(() => {
    scrollRef.current = scrollTo;
    routerRef.current = router;
  }, [scrollTo, router]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viaCurtain = transitionState.phase === "covering" || transitionState.phase === "covered";

    let disposed = false;
    const film: { current: RoomsFilm | null } = { current: null };
    const cleanups: Array<() => void> = [];
    const ctx = gsap.context(() => {}, root);

    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => (markReady = resolve));
    transitionState.ready = ready;

    const goStatic = () => {
      root.dataset.mode = "static";
      releaseVeil(hasVeil() ? 700 : 0);
      markReady();
    };

    void (async () => {
      if (reduce) {
        goStatic();
        return;
      }
      try {
        const { createRoomsFilm } = await import("./director");
        if (disposed) return;
        ctx.add(() => {
          film.current = createRoomsFilm(root, ROOM_WORLDS[world], {
            scrollTo: (y, o) => scrollRef.current(y, o),
            navigate: (href) => routerRef.current.push(href),
          });
        });
      } catch (error) {
        console.warn("Spaces rooms: film unavailable, showing the static page.", error);
      }
      if (disposed) return;
      if (!film.current) {
        goStatic();
        return;
      }
      root.dataset.mode = "film";
      ScrollTrigger.refresh();
      // The first frame is the veil's own colour: lifting it shows no seam.
      film.current.drawNow();
      releaseVeil(0);
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __mapleRooms?: unknown }).__mapleRooms = { film: film.current };
      }

      // Type laid out, and the room in view on the GPU, before the cloud parts.
      await Promise.all([Promise.race([document.fonts.ready, wait(1500)]), film.current.whenReady(2600)]);
      if (disposed || !film.current) return;
      let enter: gsap.core.Timeline = gsap.timeline({ paused: true });
      ctx.add(() => {
        if (film.current) enter = film.current.entrance();
      });
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
  }, [world]);

  return (
    <div ref={rootRef} className={className} data-rooms-page data-world={world}>
      {children}
    </div>
  );
}
