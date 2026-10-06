"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import MapleLogo from "@/components/ui/MapleLogo";
import { gsap } from "@/lib/gsap";
import { PAGE_ENTER_EVENT, transitionState } from "@/lib/page-transition";
import styles from "./PageTransition.module.css";

const NavigateContext = createContext<(href: string) => void>(() => {});

/** Navigate with the curtain. Falls back to a plain push when it can't run. */
export const usePageNavigate = () => useContext(NavigateContext);

/**
 * Route-change curtain: a burgundy blueprint sheet rises over the page, the
 * route changes underneath, and the sheet carries on upward to reveal the
 * new page once it reports ready (see transitionState.ready).
 */
export default function PageTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const curtainRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<string | null>(null);
  const safetyRef = useRef<number | undefined>(undefined);

  const uncover = useCallback(() => {
    const curtain = curtainRef.current;
    window.clearTimeout(safetyRef.current);
    targetRef.current = null;
    if (!curtain) return;
    transitionState.phase = "revealing";
    window.dispatchEvent(new Event(PAGE_ENTER_EVENT));
    gsap
      .timeline()
      .to(markRef.current, { yPercent: -40, opacity: 0, duration: 0.6, ease: "power3.in" }, 0)
      .to(curtain, { yPercent: -100, duration: 1.05, ease: "expo.inOut" }, 0.05)
      .set(curtain, { visibility: "hidden" })
      .add(() => {
        transitionState.phase = "idle";
        transitionState.ready = null;
      });
  }, []);

  const navigate = useCallback(
    (href: string) => {
      const curtain = curtainRef.current;
      const url = new URL(href, window.location.href);
      const samePage = url.pathname === window.location.pathname;
      if (samePage && !url.hash) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!curtain || reduce || samePage) {
        router.push(href);
        return;
      }
      if (targetRef.current) return; // a transition is already running

      targetRef.current = url.pathname;
      transitionState.phase = "covering";
      transitionState.ready = null;
      router.prefetch(href);

      gsap
        .timeline()
        .set(curtain, { visibility: "visible", yPercent: 100 })
        .set(markRef.current, { yPercent: 50, opacity: 0 })
        .to(curtain, { yPercent: 0, duration: 0.85, ease: "expo.inOut" })
        .to(markRef.current, { yPercent: 0, opacity: 1, duration: 0.7, ease: "expo.out" }, 0.45)
        .add(() => {
          transitionState.phase = "covered";
          router.push(href);
          // Never leave the curtain down if the route stalls.
          safetyRef.current = window.setTimeout(uncover, 7000);
        }, 0.85);
    },
    [router, uncover],
  );

  // The route changed under the curtain: wait for the new page, then lift.
  useEffect(() => {
    if (!targetRef.current || pathname !== targetRef.current) return;
    let cancelled = false;
    const settle = new Promise((resolve) => window.setTimeout(resolve, 260));
    const ready = transitionState.ready ?? Promise.resolve();
    const cap = new Promise((resolve) => window.setTimeout(resolve, 2400));
    void Promise.all([settle, Promise.race([ready, cap])]).then(() => {
      if (!cancelled) uncover();
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, uncover]);

  return (
    <NavigateContext.Provider value={navigate}>
      {children}
      <div ref={curtainRef} className={styles.curtain} aria-hidden="true">
        <div className={styles.grid} />
        <div ref={markRef} className={styles.mark}>
          <MapleLogo className={styles.logo} idPrefix="maple-curtain-logo" />
        </div>
      </div>
    </NavigateContext.Provider>
  );
}
