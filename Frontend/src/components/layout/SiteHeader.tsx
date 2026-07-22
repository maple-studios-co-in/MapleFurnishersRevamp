"use client";

import { ShoppingBag } from "lucide-react";
import { NAV_LINKS } from "@/lib/sections";
import { useSmoothScroll } from "./SmoothScroll";

/**
 * Fixed site header — always transparent, so the film runs edge to edge
 * behind it.
 *
 * Colours come from the --chrome-* custom properties, which SectionTheme
 * swaps per chapter — so the header reads cream-on-dark over the film and
 * clay-on-cream over the craftsmanship section without any prop plumbing.
 *
 * It must live outside every pinned container: ScrollTrigger's pinning
 * transforms the pin parent, and `position: fixed` inside a transformed
 * ancestor resolves against that ancestor instead of the viewport.
 */
export default function SiteHeader() {
  const { scrollTo } = useSmoothScroll();

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-12">
        <button
          type="button"
          onClick={() => scrollTo("#intro")}
          className="group shrink-0 text-left leading-none"
          aria-label="Maple Furnishers — back to top"
        >
          <span
            className="block text-xl text-[rgb(var(--chrome-fg))] transition-colors duration-500 group-hover:text-[rgb(var(--chrome-accent))] sm:text-[1.6rem]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Maple
          </span>
          <span className="mt-0.5 block font-ui text-[8px] tracking-[0.38em] text-[rgb(var(--chrome-accent))] transition-colors duration-500">
            FURNISHERS
          </span>
        </button>

        <nav className="hidden lg:flex lg:items-center lg:gap-10">
          {NAV_LINKS.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => scrollTo(l.href)}
              className="font-ui text-[12px] tracking-[0.08em] text-[rgb(var(--chrome-fg))]/80 transition-colors duration-300 hover:text-[rgb(var(--chrome-accent))]"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => scrollTo("#contact")}
          className="flex items-center gap-2.5 rounded-full border border-[rgb(var(--chrome-border))]/50 bg-[rgb(var(--chrome-fg))]/10 px-5 py-2 text-[13px] tracking-[0.08em] text-[rgb(var(--chrome-fg))] backdrop-blur-sm transition-colors duration-300 hover:border-[rgb(var(--chrome-accent))]/60 hover:text-[rgb(var(--chrome-accent))] sm:px-6"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
        >
          Shop Now
          <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
