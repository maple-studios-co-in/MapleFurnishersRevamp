import type { NextConfig } from "next";

/**
 * The catalogue's source lives in this repo (Catalogue/ workspace) but
 * deploys as its own Vercel project (Vite SPA). The main site proxies it
 * under /catalogue via rewrites, so visitors stay on
 * maple-furnishers.vercel.app. Its bundles load from absolute /assets/*
 * (plus /favicon.svg) — paths this app doesn't use — so those proxy too.
 * Rewrites run after the filesystem check, so the main site's own static
 * files always win.
 */
// In dev the proxy targets a locally served catalogue build (`npm run
// preview --workspace Catalogue`, port 4173) so localhost:3005/catalogue
// exercises work-in-progress; production keeps the deployed origin.
const CATALOGUE_ORIGIN =
  process.env.NODE_ENV === "development"
    ? "http://localhost:4173"
    : "https://catalogue-eta-three.vercel.app";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a build run against its own output dir while `next dev` still owns
  // .next. Without it a build mid-session overwrites what the dev server is
  // serving and every route loses its stylesheet.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async rewrites() {
    return [
      { source: "/catalogue", destination: `${CATALOGUE_ORIGIN}/` },
      { source: "/catalogue/:path*", destination: `${CATALOGUE_ORIGIN}/:path*` },
      { source: "/assets/:path*", destination: `${CATALOGUE_ORIGIN}/assets/:path*` },
      { source: "/catalogues/:path*", destination: `${CATALOGUE_ORIGIN}/catalogues/:path*` },
      { source: "/favicon.svg", destination: `${CATALOGUE_ORIGIN}/favicon.svg` },
    ];
  },
  /**
   * public/ files ship from Vercel with `max-age=0, must-revalidate` by
   * default, so every visit re-negotiates all ~560 sequence frames (plus
   * fonts and product shots) — hundreds of conditional requests racing the
   * scrub is exactly the deployed-only stutter where footage, copy and
   * hotspots stall waiting on frames the local dev server hands over
   * instantly. These paths are versioned by convention instead: the files
   * never change in place — a re-render ships under a NEW folder/file name
   * (e.g. sequences/outro-v2) — which is what makes `immutable` safe.
   */
  async headers() {
    const immutable = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/media/:path*", headers: immutable },
      { source: "/images/:path*", headers: immutable },
      { source: "/fonts/:path*", headers: immutable },
    ];
  },
};

export default nextConfig;
