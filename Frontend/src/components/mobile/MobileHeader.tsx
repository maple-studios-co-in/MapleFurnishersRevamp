"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ShoppingBag } from "lucide-react";
import TransitionLink from "@/components/layout/TransitionLink";
import MapleLogo from "@/components/ui/MapleLogo";
import { SHOP_URL } from "@/lib/links";
import { NAV_LINKS } from "@/lib/sections";
import { GO_STEP_EVENT } from "./script";
import Socials from "./Socials";
import styles from "./mobile.module.css";

/** The beat each of the home page's chapter links plays to on a phone. */
const CHAPTER_STEP: Record<string, string> = {
  "#intro": "story",
  "#spaces": "day-room",
};

/**
 * The phone header, the desktop header's counterpart: the wordmark, the
 * Shop Now pill and a menu button that opens the nav full screen with an
 * iris from the button. The director flips its tone (data-tone) between
 * cream over the films and timber over the craft plate. Chapter links
 * (and the wordmark) cut the story to their beat behind a curtain.
 */
export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const button = buttonRef.current;
    // The page holds still under the menu: swallow scroll gestures on it
    // before they reach the page (or Lenis, for a wheel).
    const block = (e: Event) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    menu?.addEventListener("touchmove", block, { passive: false });
    menu?.addEventListener("wheel", block, { passive: false });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => firstLinkRef.current?.focus({ preventScroll: true }), 320);
    return () => {
      menu?.removeEventListener("touchmove", block);
      menu?.removeEventListener("wheel", block);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  const goTo = (step: string) => {
    setOpen(false);
    // The curtain falls under the closing iris, so the cut never shows.
    window.dispatchEvent(new CustomEvent(GO_STEP_EVENT, { detail: step }));
  };

  return (
    <>
      <header className={styles.header} data-m-header data-tone="dark" data-menu={open}>
        <a
          href="#m-intro"
          className={styles.logo}
          data-m-chrome
          aria-label="Maple Furnishers, back to the top"
          onClick={(e) => {
            e.preventDefault();
            goTo("story");
          }}
        >
          <MapleLogo idPrefix="maple-m-header" />
        </a>
        <div className={styles.headerRight} data-m-chrome>
          <a href={SHOP_URL} className={styles.shop}>
            Shop Now
            <ShoppingBag strokeWidth={1.5} aria-hidden />
          </a>
          <button
            ref={buttonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="m-menu"
            aria-label={open ? "Close the menu" : "Open the menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={styles.burger} aria-hidden />
          </button>
        </div>
      </header>

      <div
        ref={menuRef}
        id="m-menu"
        className={styles.menu}
        data-open={open}
        inert={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <nav aria-label="Primary">
          <ul className={styles.menuList}>
            {NAV_LINKS.map((l, i) => {
              const style = { "--i": i } as CSSProperties;
              const index = <span className={styles.menuIndex}>{String(i + 1).padStart(2, "0")}</span>;
              const chapter = CHAPTER_STEP[l.href];
              return (
                <li key={l.label} className={styles.menuItem} style={style}>
                  {chapter ? (
                    <button
                      ref={i === 0 ? firstLinkRef : undefined}
                      type="button"
                      className={styles.menuLink}
                      onClick={() => goTo(chapter)}
                    >
                      {index}
                      {l.label}
                    </button>
                  ) : (
                    <TransitionLink href={l.href} className={styles.menuLink} onClick={() => setOpen(false)}>
                      {index}
                      {l.label}
                    </TransitionLink>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.menuFoot}>
          <a href={SHOP_URL} className={styles.menuShop}>
            Shop Now
            <ShoppingBag width={14} height={14} strokeWidth={1.5} aria-hidden />
          </a>
          <Socials className={styles.menuSocials} />
        </div>
      </div>
    </>
  );
}
