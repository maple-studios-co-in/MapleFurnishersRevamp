"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import MapleLogo from "@/components/ui/MapleLogo";
import { ENQUIRY_URL } from "@/lib/links";
import { NAV_LINKS, navHref } from "@/lib/sections";
import TransitionLink from "./TransitionLink";
import styles from "./PaperHeader.module.css";

/**
 * Light "paper" header for the editorial routes — Figma "header 63" from
 * the About page frame (burgundy wordmark, charcoal links at 50% with the
 * current page solid, filled "Bulk Order" pill).
 *
 * In the frame the bar sits 24px down, inside the hero's padding, and is
 * sticky. So at the top of the page it rests at that offset, docks to the
 * top over the first 24px of scroll, and from then on gains a paper
 * backdrop so the links stay legible over the dark letter and the
 * burgundy footer.
 *
 * The "spaces" variant is the same bar as drawn on the Spaces frames: flush
 * with the top of a full-screen scene that never scrolls, a 12% tinted
 * pill and a hairline underneath. Its logo, links and pill each carry
 * data-tone-item so the Spaces director can turn them light one by one as
 * the dark Terra scene slides in beneath them.
 */
export default function PaperHeader({ variant = "paper" }: { variant?: "paper" | "spaces" }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || variant !== "paper") return;
    const desktop = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      // 24 design px of the 1440 frame, scaled like the rest of the page.
      const rest = desktop.matches ? 24 * Math.min(1, el.clientWidth / 1440) : 0;
      const y = window.scrollY;
      el.style.setProperty("--dock", `${Math.max(0, rest - y)}px`);
      el.dataset.docked = String(y > rest);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    desktop.addEventListener("change", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      desktop.removeEventListener("change", update);
    };
  }, [variant]);

  return (
    <header ref={ref} className={styles.root} data-paper-header data-variant={variant}>
      <div className={styles.bar} aria-hidden />
      <div className={styles.row}>
        <TransitionLink
          href="/"
          className={styles.logo}
          aria-label="Maple Furnishers — home"
          data-intro-item
          data-tone-item
        >
          <MapleLogo className={styles.logoSvg} idPrefix="maple-header-logo" />
        </TransitionLink>

        <nav aria-label="Primary" className={styles.nav}>
          {NAV_LINKS.map((l) => {
            const href = navHref(l.href);
            return (
              <TransitionLink
                key={l.label}
                href={href}
                className={styles.link}
                aria-current={href === pathname ? "page" : undefined}
                data-intro-item
                data-tone-item
              >
                {l.label}
              </TransitionLink>
            );
          })}
        </nav>

        <a href={ENQUIRY_URL} className={styles.cta} data-intro-item data-tone-item data-magnetic>
          <span className={styles.ctaLabel}>Bulk Order</span>
          {/* The three staggered strokes from the frame (Lines 13–15). */}
          <span className={styles.ctaGlyph} aria-hidden>
            <span className={`${styles.ctaLine} ${styles.ctaLine1}`} />
            <span className={`${styles.ctaLine} ${styles.ctaLine2}`} />
            <span className={`${styles.ctaLine} ${styles.ctaLine3}`} />
          </span>
        </a>
      </div>
    </header>
  );
}
