import { Red_Hat_Display } from "next/font/google";

/**
 * The Spaces frames set Red Hat Display at 300, 400, 500, 600 and 700. The
 * site-wide instance (layout.tsx) ships static 300/400/500/700 only, so this
 * route loads the variable face instead: one file covering every weight,
 * imported only here.
 */
export const redHatVariable = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-redhat-var",
  display: "swap",
});

export const spacesFontVars = redHatVariable.variable;
