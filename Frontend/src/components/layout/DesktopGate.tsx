"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Splits the home page by screen: the desktop films from 1024px up, the
 * phone experience below.
 *
 * Two layers make it flash-free AND cheap:
 *  - CSS decides instantly: the phone subtree is `lg:hidden`, the desktop
 *    subtree `max-lg:hidden`, so the right one shows from the first paint
 *    with no hydration flicker (and correctly with JS disabled).
 *  - After hydration a matchMedia listener unmounts whichever subtree is
 *    off screen, so neither side's film, GSAP or video work runs on the
 *    other. Crossing 1024px (a tablet turning, a window resized) swaps them.
 *
 * Both subtrees hydrate before the gate knows which one is on screen, so
 * the desktop sections wait for useDesktopActive() before they fetch any
 * media: without that a phone pulled ~14 MB of desktop frames and video in
 * the instant before the gate retired them.
 */
const MOBILE = "(max-width: 1023px)";

/** True once the gate has confirmed the desktop subtree is the one on screen. */
const DesktopActive = createContext(true);
export const useDesktopActive = () => useContext(DesktopActive);

export default function DesktopGate({ children, mobile }: { children: ReactNode; mobile: ReactNode }) {
  const [isMobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <>
      {isMobile !== false && <div className="lg:hidden">{mobile}</div>}
      {isMobile !== true && (
        <div className="max-lg:hidden">
          <DesktopActive.Provider value={isMobile === false}>{children}</DesktopActive.Provider>
        </div>
      )}
    </>
  );
}
