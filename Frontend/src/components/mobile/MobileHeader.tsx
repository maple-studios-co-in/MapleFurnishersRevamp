"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ShoppingBag } from "lucide-react";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import TransitionLink from "@/components/layout/TransitionLink";
import MapleLogo from "@/components/ui/MapleLogo";
import { SHOP_URL } from "@/lib/links";
import { NAV_LINKS } from "@/lib/sections";
import { SKIP_INTRO_EVENT } from "./script";
import Socials from "./Socials";
import styles from "./mobile.module.css";

/** Where the home page's chapter links land on a phone. */
const CHAPTER_TARGET: Record<string, string> = {
  "#intro": "#m-intro",
  "#spaces": "#m-spaces",
};

/**
 * The phone header, the desktop header's counterpart: the wordmark, the
 * Shop Now pill and a menu button that opens the nav full screen with an
 * iris from the button. The director flips its tone (data-tone) between
 * cream over the films and timber over the craft plate, and draws the
 * page progress along its top edge.
 */
export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const { scrollTo } = useSmoothScroll();
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

  const goTo = (target: string) => {
    setOpen(false);
    window.dispatchEvent(new Event(SKIP_INTRO_EVENT));
    // Let the iris start closing (and the intro release the page) first.
    window.setTimeout(() => scrollTo(target), 160);
  };

  return (
    <>
      <header className={styles.header} data-m-header data-tone="dark" data-menu={open}>
        <span className={styles.progress} data-m-progress aria-hidden />
        <a
          href="#m-intro"
          className={styles.logo}
          data-m-chrome
          aria-label="Maple Furnishers, back to the top"
          onClick={(e) => {
            e.preventDefault();
            goTo("#m-intro");
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
              const chapter = CHAPTER_TARGET[l.href];
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
