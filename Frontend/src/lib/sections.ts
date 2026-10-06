/**
 * Single source of truth for the page's chapters.
 *
 * Drives three things at once — the fixed header's colour theme, the left
 * step rail, and the nav — so they can never drift out of sync. Adding a
 * chapter here is the only edit needed to make it appear in all three.
 */

export type SectionTheme = "dark" | "light";

export interface SectionDef {
  /** DOM id — the section element must carry this. */
  id: string;
  /** Rail label. */
  label: string;
  /** Human title, used for a11y and the rail tooltip. */
  title: string;
  /** Which palette the fixed chrome switches to over this section. */
  theme: SectionTheme;
}

// "furnish" and "promise" are markers inside taller scrub sections (hero
// and outro respectively), not standalone DOM sections — the beat they
// name is part of the film, so the anchor sits at its scroll depth.
export const SECTIONS: readonly SectionDef[] = [
  { id: "intro", label: "01", title: "Every Home Has A Story", theme: "dark" },
  { id: "furnish", label: "02", title: "Let's Furnish Yours", theme: "dark" },
  { id: "craft", label: "03", title: "Craftsmanship", theme: "light" },
  { id: "spaces", label: "04", title: "Comfort, Curated", theme: "dark" },
  { id: "promise", label: "05", title: "Rooms To Live In", theme: "dark" },
  { id: "contact", label: "06", title: "Beyond The Door", theme: "dark" },
] as const;

// A "#" href is a home-page chapter; a "/" href is its own route.
export const NAV_LINKS = [
  { label: "Home", href: "#intro" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "#spaces" },
  { label: "Spaces", href: "/spaces" },
] as const;

/**
 * Resolves a NAV_LINKS href for use off the home page, where a chapter can
 * only be reached through "/" and the intro chapter is simply the top of it.
 */
export const navHref = (href: string) =>
  href === "#intro" ? "/" : href.startsWith("#") ? `/${href}` : href;

/** Routes that wear the light PaperHeader instead of the film SiteHeader. */
export const PAPER_HEADER_ROUTES: readonly string[] = ["/about", "/spaces"];

export const usesPaperHeader = (pathname: string) =>
  PAPER_HEADER_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
