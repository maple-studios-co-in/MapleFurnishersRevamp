import type { NextConfig } from "next";

/**
 * The catalogue lives in its own repo/deployment (Vite SPA). The main site
 * proxies it under /catalogue via rewrites, so visitors stay on
 * maple-furnishers.vercel.app. Its bundles load from absolute /assets/*
 * (plus /favicon.svg) — paths this app doesn't use — so those proxy too.
 * Rewrites run after the filesystem check, so the main site's own static
 * files always win.
 */
const CATALOGUE_ORIGIN = "https://catalogue-eta-three.vercel.app";

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
};

export default nextConfig;
