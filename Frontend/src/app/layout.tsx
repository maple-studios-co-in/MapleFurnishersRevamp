import type { Metadata } from "next";
import { Inter, Italiana, Montserrat, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import SectionRail from "@/components/layout/SectionRail";
import SectionTheme from "@/components/layout/SectionTheme";
import SiteHeader from "@/components/layout/SiteHeader";
import SmoothScroll from "@/components/layout/SmoothScroll";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

const italiana = Italiana({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-italiana",
  display: "swap",
});

// Hero title font, matching the film's baked-in typography.
// NOTE: free demo version (personal use). Buy the commercial license
// (Creative Market) before production launch.
const catilde = localFont({
  src: [
    { path: "../fonts/Catilde-Light.otf", weight: "300", style: "normal" },
    { path: "../fonts/Catilde-Regular.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-catilde",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Maple Furnishers — Interiors, Transformed",
    template: "%s | Maple Furnishers",
  },
  description:
    "Bespoke furniture and interiors. From blueprint to reality — crafted spaces that feel like home.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "Maple Furnishers — Interiors, Transformed",
    description:
      "Bespoke furniture and interiors. From blueprint to reality — crafted spaces that feel like home.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${italiana.variable} ${catilde.variable} ${montserrat.variable}`}
    >
      <body>
        {/* Chrome lives outside <main> so it never sits inside a pinned
            container — ScrollTrigger transforms the pin parent, and a fixed
            element inside a transformed ancestor resolves against that
            ancestor rather than the viewport. */}
        <SmoothScroll>
          <SectionTheme />
          <SiteHeader />
          <SectionRail />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
