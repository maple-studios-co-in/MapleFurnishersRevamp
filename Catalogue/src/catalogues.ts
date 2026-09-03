/**
 * Embedded PDFs are broken on mobile: iOS WebKit renders only the first
 * page of an iframed PDF (frozen, no scrolling) and Android often refuses
 * to render one at all. On touch platforms every "view catalogue" action
 * links straight to the PDF — the native viewer scrolls, zooms and
 * paginates properly. Desktop keeps the in-page iframe routes. (iPadOS 13+
 * masquerades as MacIntel, hence the maxTouchPoints check.)
 */
export const MOBILE_PDF =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/**
 * Routes are the collection names, kebab-cased, and sub-collections nest
 * under their family page: /chairs-collections/dining-collections. The
 * object keys below ARE the URL segments.
 */

/** The six chair collections — /chairs-collections/:slug. */
export const CHAIR_COLLECTIONS = {
  "arm-collections": { title: "Arm Collections", pdf: "/catalogues/arm-chairs.pdf" },
  "dining-collections": { title: "Dining Collections", pdf: "/catalogues/dining.pdf" },
  // No dedicated Accent PDF supplied yet — the client sent Dining.pdf
  // twice, so Accent shows the dining catalogue until the real one lands.
  "accent-collections": { title: "Accent Collections", pdf: "/catalogues/dining.pdf" },
  "rocking-collections": { title: "Rocking Collections", pdf: "/catalogues/rocking-chairs.pdf" },
  "bar-collections": { title: "Bar Collections", pdf: "/catalogues/bar.pdf" },
  "bedroom-chairs": { title: "Bedroom Chairs", pdf: "/catalogues/bedroom-chairs.pdf" },
} as const;

export type ChairSlug = keyof typeof CHAIR_COLLECTIONS;

/** The five sofa collections — /sofa-collections/:slug.
 *  The four seater PDFs are chapters of one master catalogue (their
 *  printed page numbers run continuously); all-sofas.pdf is the merge —
 *  shared cover/intro/designer pages and back cover included once. */
export const SOFA_COLLECTIONS = {
  "2-seater": { title: "2+ Seater", pdf: "/catalogues/sofa-2-seater.pdf" },
  "3-seater": { title: "3+ Seater", pdf: "/catalogues/sofa-3-seater.pdf" },
  "5-seater": { title: "5+ Seater", pdf: "/catalogues/sofa-5-seater.pdf" },
  "7-seater": { title: "7+ Seater", pdf: "/catalogues/sofa-7-seater.pdf" },
  "all-sofas": { title: "All Sofas", pdf: "/catalogues/all-sofas.pdf" },
} as const;

export type SofaSlug = keyof typeof SOFA_COLLECTIONS;

/** The three bed collections — /beds-collections/:slug. */
export const BED_COLLECTIONS = {
  "fabric-beds": { title: "Fabric Beds", pdf: "/catalogues/fabric-beds.pdf" },
  "solidwood-beds": { title: "Solidwood Beds", pdf: "/catalogues/solidwood-beds.pdf" },
  "kids-bed": { title: "Kids Bed", pdf: "/catalogues/kids-beds.pdf" },
} as const;

export type BedSlug = keyof typeof BED_COLLECTIONS;

/** Landing cards that open a PDF catalogue directly (no collection page). */
export const DIRECT = {
  cafe: { title: "Cafe Collection", pdf: "/catalogues/cafe-collection.pdf" },
  restaurant: { title: "Restaurant Collection", pdf: "/catalogues/restaurant-collection.pdf" },
  nimbus: { title: "Nimbus Collection", pdf: "/catalogues/nimbus-collection.pdf" },
} as const;

/**
 * The routes shipped for a while as /catalogue-1 .. /catalogue-3 with
 * short child slugs; anything bookmarked or indexed under those paths
 * 301-style redirects onto the named routes above (see App.tsx).
 */
export const LEGACY_CHAIR_SLUGS: Record<string, ChairSlug> = {
  arm: "arm-collections",
  dining: "dining-collections",
  accent: "accent-collections",
  rocking: "rocking-collections",
  bar: "bar-collections",
  bedroom: "bedroom-chairs",
};

export const LEGACY_SOFA_SLUGS: Record<string, SofaSlug> = {
  "2-seater": "2-seater",
  "3-seater": "3-seater",
  "5-seater": "5-seater",
  "7-seater": "7-seater",
  all: "all-sofas",
};

export const LEGACY_BED_SLUGS: Record<string, BedSlug> = {
  fabric: "fabric-beds",
  solidwood: "solidwood-beds",
  kids: "kids-bed",
};
