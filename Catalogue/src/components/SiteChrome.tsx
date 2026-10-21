import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import MapleLogo from "./MapleLogo";
import backdrop from "../assets/figma/backdrop.png";

/**
 * Chrome shared by both catalogue scenes (Figma 2511:113 & 2511:420): the
 * moody backdrop raster, the fixed-height header and the giant TAN PEARL
 * watermark.
 *
 * The header mirrors the main site's nav so the catalogue feels like the
 * same site. Under the /catalogue proxy these anchors resolve against
 * maple-furnishers.vercel.app, so About and Spaces open the main site's own
 * pages; Catalogues is this app's landing, and the tab marked current. The
 * pill CTA matches the main site's header: Shop Now → the storefront.
 * Phones get the main site's phone menu (PhoneMenu below).
 */

const SHOP_URL = "https://shop.maplefurnishers.com/";
const BULK_ENQUIRY_URL = "https://shop.maplefurnishers.com/pages/bulk-enquiry";

const NAV = [
  { label: "Home", menu: "Home", href: "/", active: false },
  { label: "About US", menu: "About Us", href: "/about", active: false },
  { label: "Catalogues", menu: "Catalogues", href: "/catalogue", active: true },
  { label: "Spaces", menu: "Spaces", href: "/spaces", active: false },
];

/** The main site's three social rings (Frontend mobile/Socials). */
const SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/maplefurnishers",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/maplefurnishers",
    path: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  },
  {
    label: "Twitter",
    href: "https://x.com/maplefurnishers",
    path: (
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    ),
  },
];

export function Backdrop() {
  return <img className="backdrop" src={backdrop} alt="" aria-hidden />;
}

export function Header() {
  return (
    <header className="siteHeader">
      <div className="siteHeader-inner">
        <a className="siteHeader-logo" href="/" aria-label="Maple Furnishers — home">
          <MapleLogo />
        </a>
        <nav className="siteHeader-nav" aria-label="Primary">
          {NAV.map((l) => (
            <a
              key={l.label}
              className={l.active ? "siteHeader-link is-active" : "siteHeader-link"}
              href={l.href}
            >
              {l.label}
              {l.active && <span className="siteHeader-underline" aria-hidden />}
            </a>
          ))}
        </nav>
        <div className="siteHeader-end">
          <a className="shopNow" href={SHOP_URL}>
            <span className="shopNow-label">Shop Now</span>
            <span className="shopNow-burger" aria-hidden>
              <span style={{ width: "14.642px" }} />
              <span style={{ width: "17.369px" }} />
              <span style={{ width: "14.366px" }} />
            </span>
          </a>
          <PhoneMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * Phones (the nav above is hidden below 1024px): a round button that opens
 * the nav full screen as an iris from the button — the main site's phone
 * menu, large TAN PEARL links numbered 01–04, Catalogues marked as current,
 * the calls to action and socials at the foot. Portalled to <body> so the
 * sticky header can't clip it.
 */
function PhoneMenu() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const menu = menuRef.current;
    if (!open) {
      if (wasOpen.current) buttonRef.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    // The page holds still under the menu.
    const block = (e: Event) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    menu?.addEventListener("touchmove", block, { passive: false });
    menu?.addEventListener("wheel", block, { passive: false });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
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
    // The iris opens from the button; the close button lands where it sits.
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menuButton"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Open the menu"
        onClick={openMenu}
      >
        <span className="menuButton-burger" aria-hidden />
      </button>
      {createPortal(
        <div
          ref={menuRef}
          id={id}
          className="phoneMenu"
          data-open={open}
          inert={!open}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <a className="phoneMenu-logo" href="/" aria-label="Maple Furnishers — home">
            <MapleLogo />
          </a>
          <button ref={closeRef} type="button" className="phoneMenu-close" aria-label="Close the menu" onClick={close}>
            <span className="phoneMenu-cross" aria-hidden />
          </button>
          <nav aria-label="Primary">
            <ul className="phoneMenu-list">
              {NAV.map((l, i) => (
                <li key={l.label} className="phoneMenu-item" style={{ "--i": i } as CSSProperties}>
                  <a
                    className="phoneMenu-link"
                    href={l.href}
                    aria-current={l.active ? "page" : undefined}
                    onClick={l.active ? close : undefined}
                  >
                    <span className="phoneMenu-index">{String(i + 1).padStart(2, "0")}</span>
                    {l.menu}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="phoneMenu-foot">
            <a className="phoneMenu-primary" href={SHOP_URL}>
              Shop Now
            </a>
            <a className="phoneMenu-secondary" href={BULK_ENQUIRY_URL}>
              Bulk Order
            </a>
            <div className="phoneMenu-socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  className="phoneMenu-social"
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Maple Furnishers on ${s.label}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {s.path}
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** The near-invisible oversized "Maple Furnishers Catalogue" behind the
 *  cards. `top` differs per scene (401px landing, 441px chairs page). */
export function Watermark({ top }: { top: number }) {
  return (
    <p className="watermark" style={{ top }} aria-hidden>
      Maple Furnishers Catalogue
    </p>
  );
}
