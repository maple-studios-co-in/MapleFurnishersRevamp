"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Socials from "@/components/mobile/Socials";
import MapleLogo from "@/components/ui/MapleLogo";
import { NAV_LINKS, navHref } from "@/lib/sections";
import TransitionLink from "./TransitionLink";
import styles from "./PhoneMenu.module.css";

interface Cta {
  label: string;
  href: string;
}

/**
 * The phone menu for every page but home (whose phone header carries its
 * own, mobile/MobileHeader): a round button that opens the site's nav full
 * screen as an iris from the button, dressed like the home menu — large
 * serif links numbered 01–04 with the current page marked, the calls to
 * action and socials at the foot. From 1024px the header's own nav shows
 * and the button hides.
 *
 * The overlay is portalled to <body>: a header that is a size container
 * (PaperHeader) would otherwise be the containing block of its
 * position: fixed, and the menu would open inside the 64px bar.
 */
export default function PhoneMenu({ primary, secondary }: { primary: Cta; secondary?: Cta }) {
  const pathname = usePathname();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => setHost(document.body), []);

  // A link inside was followed: the new page opens with the menu shut.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!open) {
      // Back to the button that opened it, once it has closed.
      if (wasOpen.current) buttonRef.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
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
    const focusTimer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 320);
    return () => {
      menu?.removeEventListener("touchmove", block);
      menu?.removeEventListener("wheel", block);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const openMenu = () => {
    // The iris opens from wherever the button sits in this page's header.
    const b = buttonRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (b && menu) {
      menu.style.setProperty("--mx", `${b.left + b.width / 2}px`);
      menu.style.setProperty("--my", `${b.top + b.height / 2}px`);
      menu.style.setProperty("--bx", `${window.innerWidth - b.right}px`);
      menu.style.setProperty("--by", `${b.top}px`);
    }
    setOpen(true);
  };
  const close = () => setOpen(false);

  const menu = (
    <div
      ref={menuRef}
      id={id}
      className={styles.menu}
      data-open={open}
      inert={!open}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <div className={styles.top}>
        <TransitionLink href="/" className={styles.logo} aria-label="Maple Furnishers — home" onClick={close}>
          <MapleLogo idPrefix="maple-phone-menu-logo" />
        </TransitionLink>
      </div>
      <button ref={closeRef} type="button" className={styles.close} aria-label="Close the menu" onClick={close}>
        <span className={styles.cross} aria-hidden />
      </button>

      <nav aria-label="Primary">
        <ul className={styles.list}>
          {NAV_LINKS.map((l, i) => {
            const href = navHref(l.href);
            const current = href === pathname || (href !== "/" && pathname.startsWith(`${href}/`));
            const body = (
              <>
                <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
                {l.label}
              </>
            );
            return (
              <li key={l.label} className={styles.item} style={{ "--i": i } as CSSProperties}>
                {l.separate ? (
                  // The catalogue is its own app: a plain link loads it as a page.
                  <a href={href} className={styles.link} onClick={close}>
                    {body}
                  </a>
                ) : (
                  <TransitionLink
                    href={href}
                    className={styles.link}
                    aria-current={current ? "page" : undefined}
                    onClick={close}
                  >
                    {body}
                  </TransitionLink>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.foot}>
        <a href={primary.href} className={styles.primary}>
          {primary.label}
        </a>
        {secondary && (
          <a href={secondary.href} className={styles.secondary}>
            {secondary.label}
          </a>
        )}
        <Socials className={styles.socials} />
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={id}
        aria-label="Open the menu"
        onClick={openMenu}
        data-intro-item
      >
        <span className={styles.burger} aria-hidden />
      </button>
      {host && createPortal(menu, host)}
    </>
  );
}
