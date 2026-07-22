"use client";

import { useEffect } from "react";
import { SECTIONS } from "@/lib/sections";
import { useActiveSection } from "@/hooks/useActiveSection";

/**
 * Publishes the active chapter to <html> as `data-theme` / `data-section`.
 *
 * Using data attributes rather than context means the fixed header and rail
 * restyle purely in CSS, so crossing a chapter boundary costs no re-render
 * of the page tree.
 */
export default function SectionTheme() {
  const active = useActiveSection();

  useEffect(() => {
    const s = SECTIONS[active];
    if (!s) return;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.section = s.id;
  }, [active]);

  return null;
}
