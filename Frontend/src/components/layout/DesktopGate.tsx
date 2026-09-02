"use client";

import { useEffect, useState, type ReactNode } from "react";
import MapleLogo from "@/components/ui/MapleLogo";

/**
 * Below this width the cinematic page is replaced by a full-screen brand
 * card asking for a desktop — the scrub films, pinned scenes and frame
 * sequences are composed for large screens and degrade badly on phones
 * (the same move as lesanimals.digital's "browse it on desktop" plate).
 *
 * Two layers make it flash-free AND cheap:
 *  - CSS decides instantly: the gate is `lg:hidden`, the site subtree is
 *    `max-lg:hidden`, so the correct side shows from the first paint with
 *    no hydration flicker (and correctly with JS disabled).
 *  - After hydration a matchMedia listener unmounts the site subtree on
 *    mobile entirely, so none of the film/GSAP/video work ever runs there.
 *
 * Mobile visitors aren't dead-ended: the gate hands them the catalogue
 * (designed mobile-first) and the storefront.
 */
const MOBILE = "(max-width: 1023px)";

export default function DesktopGate({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <section className="desktop-gate lg:hidden" aria-label="Best viewed on a desktop">
        <span className="desktop-gate__glow desktop-gate__glow--a" aria-hidden />
        <span className="desktop-gate__glow desktop-gate__glow--b" aria-hidden />

        <div className="desktop-gate__logo" aria-hidden>
          <MapleLogo />
        </div>

        <p className="desktop-gate__eyebrow">A Maple Furnishers experience</p>

        <h1 className="desktop-gate__title">
          Made for the
          <br />
          Big Screen.
        </h1>

        <p className="desktop-gate__sub">
          To fully enjoy the experiment,
          <br />
          browse it on desktop.
        </p>

        <span className="desktop-gate__rule" aria-hidden />

        <div className="desktop-gate__actions">
          <a className="desktop-gate__cta" href="/catalogue">
            Browse the Catalogue
          </a>
          <a className="desktop-gate__shop" href="https://shop.maplefurnishers.com/">
            Shop Now
          </a>
        </div>

        <p className="desktop-gate__foot">Best experienced at 1024px and wider</p>
      </section>

      {mobile !== true && <div className="max-lg:hidden">{children}</div>}
    </>
  );
}
