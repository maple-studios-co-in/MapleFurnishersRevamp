"use client";

import { ShoppingBag } from "lucide-react";
import { NAV_LINKS } from "@/lib/sections";
import MapleLogo from "@/components/ui/MapleLogo";
import { chromeType } from "@/lib/typography";
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
          {/* The supplied wordmark carries both "Maple" and "FURNISHERS",
              so it replaces the old two-span text lockup outright. */}
          <MapleLogo className="h-[52px] w-auto text-[rgb(var(--chrome-fg))] transition-colors duration-500 group-hover:text-[rgb(var(--chrome-accent))]" />
        </button>

        {/* Gap measured off the user's header inspect: at a 1440 frame
            "About Us" sits 555 from the left / 805 from the right, which
            works out to ~154px between links (was 40). Capped by a vw term
            so narrower desktops shrink it instead of overflowing. */}
        {/* ml: justify-between centres the row between the logo and the
            button, landing the links ~45px left of the inspect. The margin
            eats free space that then re-splits evenly, so it moves the nav
            by only HALF its value — 90px buys the 45px shift. */}
        <nav className="hidden lg:flex lg:items-center lg:gap-[min(154px,10.7vw)] lg:ml-[min(90px,6.25vw)]">
          {NAV_LINKS.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => scrollTo(l.href)}
              className="transition-colors duration-300 hover:text-[rgb(var(--chrome-accent))]"
              style={chromeType(400)}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => scrollTo("#contact")}
          className="flex items-center gap-2.5 rounded-full border border-[rgb(var(--chrome-border))]/50 bg-[rgb(var(--chrome-fg))]/10 px-5 py-2 backdrop-blur-sm transition-colors duration-300 hover:border-[rgb(var(--chrome-accent))]/60 hover:text-[rgb(var(--chrome-accent))] sm:px-6"
          style={chromeType(500)}
        >
          Shop Now
          <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
