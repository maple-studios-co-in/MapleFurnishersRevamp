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

export const PDFS = {
  chair: "/catalogues/Chair_Collection.pdf",
  nimbus: "/catalogues/Nimbus_Collection.pdf",
} as const;
