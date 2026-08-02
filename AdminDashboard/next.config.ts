import type { NextConfig } from "next";

/**
 * The deployed admin calls its own origin (/api/...) and this proxy hands
 * those calls to the backend server-side. Browser never makes a cross-site
 * request, so ad-block filter lists, tracking prevention, per-subdomain DNS
 * failures and CORS are all out of the picture — a login from a real user's
 * browser was being killed client-side calling the backend domain directly.
 *
 * Note: proxied requests reach the backend from Vercel's egress, so its
 * per-IP login rate limit effectively becomes shared for admin users. With
 * a single admin account that trade is fine.
 */
const BACKEND_ORIGIN = "https://maple-furnishers-backend.vercel.app";
/** The marketing site, which owns the product image files. */
const SITE_ORIGIN = "https://maple-furnishers-revamp-frontend.vercel.app";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a build run against its own output dir while `next dev` still owns
  // .next — on OneDrive the two colliding surface as EINVAL/readlink.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      // Product thumbnails are stored as site-relative paths ("/images/
      // products/sofa.webp") that only exist in the marketing site's public
      // folder, so every row in the admin table 404'd. Proxying keeps one
      // copy of the images rather than duplicating them into this app.
      { source: "/images/:path*", destination: `${SITE_ORIGIN}/images/:path*` },
    ];
  },
};

export default nextConfig;
