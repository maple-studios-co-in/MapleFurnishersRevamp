import type { Metadata } from "next";
import { Inter, Playfair_Display, Red_Hat_Display } from "next/font/google";
import "./globals.css";

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

const redHat = Red_Hat_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-redhat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Admin — Maple Furnishers",
    template: "%s | Admin — Maple Furnishers",
  },
  description: "Maple Furnishers internal admin dashboard.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${redHat.variable}`}>
      <body>{children}</body>
    </html>
  );
}

