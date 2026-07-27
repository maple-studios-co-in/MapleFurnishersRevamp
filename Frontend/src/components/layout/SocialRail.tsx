"use client";

import { useEffect, useState } from "react";

/**
 * Social profiles for the fixed bottom-left ring trio. The installed
 * lucide-react no longer ships brand icons, so the paths are inlined in
 * the same 24px stroke style. (Moved here from HeroFilm when the rings
 * were promoted to persistent chrome.)
 */
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
    path: (
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    ),
  },
  {
    label: "Twitter",
    href: "https://x.com/maplefurnishers",
    path: (
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    ),
  },
] as const;

/**
 * Fixed social-ring trio, bottom-left — the per-key-frame constant of the
 * design: the rings sit in the corner of every scrubbed frame. Appears the
 * moment scrolling begins (the intro is scroll-locked, so it can never
 * show over the film) and rides the --chrome-* theme vars, so it flips
 * cream-on-dark / timber-on-cream with the chapters like the header and
 * chapter rail do. It bows out only over the footer, which carries its
 * own social links.
 */
export default function SocialRail() {
  const [scrolled, setScrolled] = useState(false);
  const [footerInView, setFooterInView] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const io = new IntersectionObserver(
      ([entry]) => setFooterInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  const visible = scrolled && !footerInView;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed bottom-[5%] left-[5%] z-40 flex gap-4 transition-all duration-700 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      {SOCIALS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          tabIndex={visible ? undefined : -1}
          aria-label={`Maple Furnishers on ${s.label}`}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgb(var(--chrome-fg))]/40 text-[rgb(var(--chrome-fg))]/80 backdrop-blur-[2px] transition-colors duration-300 hover:border-[rgb(var(--chrome-fg))] hover:text-[rgb(var(--chrome-fg))]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {s.path}
          </svg>
        </a>
      ))}
    </div>
  );
}
