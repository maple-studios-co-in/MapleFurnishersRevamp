/**
 * Outbound destinations for the site's calls to action, kept in one place
 * so a new storefront or enquiry route is a single edit.
 */

/** The live storefront. */
export const SHOP_URL = "https://shop.maplefurnishers.com/";

/**
 * The collections catalogue: a separate Vite app served under /catalogue by
 * the rewrites in next.config.ts. In development that rewrite targets a
 * locally served catalogue build on port 4173.
 */
export const CATALOGUE_PATH = "/catalogue";

/**
 * Where "Bulk Order", "Start your project" and the other enquiry CTAs lead.
 * The site has no contact page or enquiry inbox yet, so this falls back to
 * the storefront. Point it at the enquiry route once one exists.
 */
export const ENQUIRY_URL = SHOP_URL;
