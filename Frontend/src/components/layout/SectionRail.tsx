"use client";

import { usePathname } from "next/navigation";
import { SECTIONS } from "@/lib/sections";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useSmoothScroll } from "./SmoothScroll";

/**
 * Fixed 01–06 chapter rail down the left edge.
 *
 * Active state is tracked in React (unlike the theme, which is a data
 * attribute) because the rail needs to animate a width/scale change on the
 * marker, and there are only six items so re-rendering is trivial.
 */
export default function SectionRail() {
  const pathname = usePathname();
  const active = useActiveSection();
  const { scrollTo } = useSmoothScroll();

  // The 01–06 chapter rail belongs to the home scroll story only — other
  // routes (e.g. /customize with its own 01–07 stepper) go without it.
  if (pathname !== "/") return null;

  return (
    <nav
      aria-label="Section navigation"
      className="pointer-events-none fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-6 lg:flex xl:left-10"
    >
      {SECTIONS.map((s, i) => {
        const isActive = i === active;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(`#${s.id}`)}
            aria-label={s.title}
            aria-current={isActive ? "true" : undefined}
            className="pointer-events-auto flex items-center gap-3 text-left"
          >
            <span
              className={`tabular-nums transition-all duration-500 ${
                isActive
                  ? "text-[19px] text-[rgb(var(--chrome-accent))]"
                  : "font-ui text-[13px] text-[rgb(var(--chrome-fg))]/40 hover:text-[rgb(var(--chrome-fg))]/75"
              }`}
              style={
                isActive
                  ? { fontFamily: "var(--font-display)", fontWeight: 500 }
                  : undefined
              }
            >
              {s.label}
            </span>
            <span
              aria-hidden
              className={`h-px origin-left bg-[rgb(var(--chrome-accent))] transition-all duration-500 ${
                isActive ? "w-8 opacity-100" : "w-0 opacity-0"
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
