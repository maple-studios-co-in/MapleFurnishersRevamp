import { Caveat, DM_Sans } from "next/font/google";

/**
 * Faces the About design adds on top of the site-wide set. They are only
 * imported by the About route, so other pages never download them.
 */

/** "Maple/Body" and "Maple/Label" — variable, with the optical-size axis
 *  the design pins at 14 (see --about-opsz in about.module.css). */
export const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

/** "Maple/Note" — the handwritten letter lines. */
export const caveat = Caveat({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-caveat",
  display: "swap",
});

export const aboutFontVars = `${dmSans.variable} ${caveat.variable}`;
