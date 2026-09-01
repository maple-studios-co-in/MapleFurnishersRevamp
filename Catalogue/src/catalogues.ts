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

/** The six chair collections, keyed by their /catalogue-1/:slug route. */
export const CHAIR_COLLECTIONS = {
  arm: { title: "Arm Collections", pdf: "/catalogues/arm-chairs.pdf" },
  dining: { title: "Dining Collections", pdf: "/catalogues/dining.pdf" },
  // No dedicated Accent PDF supplied yet — the client sent Dining.pdf
  // twice, so Accent shows the dining catalogue until the real one lands.
  accent: { title: "Accent Collections", pdf: "/catalogues/dining.pdf" },
  rocking: { title: "Rocking Collections", pdf: "/catalogues/rocking-chairs.pdf" },
  bar: { title: "Bar Collections", pdf: "/catalogues/bar.pdf" },
  bedroom: { title: "Bedroom Chairs", pdf: "/catalogues/bedroom-chairs.pdf" },
} as const;

export type ChairSlug = keyof typeof CHAIR_COLLECTIONS;

/** The five sofa collections, keyed by their /catalogue-2/:slug route.
 *  The four seater PDFs are chapters of one master catalogue (their
 *  printed page numbers run continuously); all-sofas.pdf is the merge —
 *  shared cover/intro/designer pages and back cover included once. */
export const SOFA_COLLECTIONS = {
  "2-seater": { title: "2+ Seater", pdf: "/catalogues/sofa-2-seater.pdf" },
  "3-seater": { title: "3+ Seater", pdf: "/catalogues/sofa-3-seater.pdf" },
  "5-seater": { title: "5+ Seater", pdf: "/catalogues/sofa-5-seater.pdf" },
  "7-seater": { title: "7+ Seater", pdf: "/catalogues/sofa-7-seater.pdf" },
  all: { title: "All Sofas", pdf: "/catalogues/all-sofas.pdf" },
} as const;

export type SofaSlug = keyof typeof SOFA_COLLECTIONS;

/** The three bed collections, keyed by their /catalogue-3/:slug route. */
export const BED_COLLECTIONS = {
  fabric: { title: "Fabric Beds", pdf: "/catalogues/fabric-beds.pdf" },
  solidwood: { title: "Solidwood Beds", pdf: "/catalogues/solidwood-beds.pdf" },
  kids: { title: "Kids Bed", pdf: "/catalogues/kids-beds.pdf" },
} as const;

export type BedSlug = keyof typeof BED_COLLECTIONS;

/** Landing cards that open a PDF catalogue directly (no collection page). */
export const DIRECT = {
  cafe: { title: "Cafe Collection", pdf: "/catalogues/cafe-collection.pdf" },
  restaurant: { title: "Restaurant Collection", pdf: "/catalogues/restaurant-collection.pdf" },
  nimbus: { title: "Nimbus Collection", pdf: "/catalogues/nimbus-collection.pdf" },
} as const;
