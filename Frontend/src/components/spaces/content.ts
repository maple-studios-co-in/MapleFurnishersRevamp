import { CATALOGUE_PATH } from "@/lib/links";

/**
 * Copy and artwork for /spaces — Figma file Lurp612Dny6LlrAcdK0qk5, frames
 * "1" (2550:347, landing), "2" (2550:457, the white box), "3" (2550:684,
 * Nimbus) and "4" (2583:186, Terra). All frames are 1440 × 950.
 */

export const LANDING = {
  headline: ["Don’t Choose Furniture", "Choose A World."],
  sub: "Every space begins with a feeling.",
} as const;

/**
 * "SCROLL DOWN" set on an arc, one glyph per Figma text layer: each box is
 * the layer's rotated bounds relative to the cue's top-left (frame x 620,
 * y 768.85), with the glyph's own rotation in degrees.
 */
export const CUE_GLYPHS: ReadonlyArray<{ ch: string; x: number; y: number; w: number; h: number; r: number }> = [
  { ch: "S", x: 0, y: 52.29, w: 32.19, h: 25.764, r: -62.63 },
  { ch: "C", x: 10.73, y: 33.35, w: 32.524, h: 30.851, r: -50.22 },
  { ch: "R", x: 27.88, y: 17.68, w: 29.56, h: 32.136, r: -37.52 },
  { ch: "O", x: 46.65, y: 6.01, w: 28.327, h: 33.835, r: -24.26 },
  { ch: "L", x: 72.05, y: 0.65, w: 19.405, h: 31.179, r: -11.29 },
  { ch: "L", x: 93.26, y: 0, w: 14, h: 29, r: 0 },
  { ch: "D", x: 117.52, y: 3.06, w: 24.312, h: 32.561, r: 18.34 },
  { ch: "O", x: 134.63, y: 11.84, w: 30.675, h: 34.132, r: 32.16 },
  { ch: "W", x: 151.89, y: 27.82, w: 34.884, h: 34.351, r: 47.4 },
  { ch: "N", x: 166.59, y: 50.54, w: 33.119, h: 27.809, r: 61.79 },
];

export type WorldId = "nimbus" | "terra";

export interface World {
  id: WorldId;
  title: string;
  tagline: string;
  eyebrow: string;
  body: string;
  photo: { src: string; width: number; height: number; alt: string };
  /** The bottom-right link to the other collection. */
  link: { kind: "next" | "previous"; label: string; collection: string; to: WorldId };
}

export const WORLDS: Record<WorldId, World> = {
  nimbus: {
    id: "nimbus",
    title: "NIMBUS",
    tagline: "A world shaped by clouds.",
    eyebrow: "Silence. Warmth. Space.",
    body: "For people who believe luxury doesn’t need to speak loudly.",
    photo: {
      src: "/media/spaces/nimbus-sofa.webp",
      width: 900,
      height: 417,
      alt: "Nimbus sofa in ivory bouclé with rounded arms, scatter cushions and walnut feet",
    },
    // The frame spells it "TERA"; the collection it leads to is Terra.
    link: { kind: "next", label: "Next", collection: "Terra Collection", to: "terra" },
  },
  terra: {
    id: "terra",
    title: "TERRA",
    tagline: "A world shaped by earth.",
    eyebrow: "Rooted. Warm. Timeless.",
    body: "Grounded forms. Honest materials. A deeper connection to the spaces we live in.",
    photo: {
      src: "/media/spaces/terra-chair.webp",
      width: 736,
      height: 480,
      alt: "Terra lounge chair: a sculpted walnut frame cradling a deep brown leather seat",
    },
    link: { kind: "previous", label: "Previous", collection: "Nimbus Collection", to: "nimbus" },
  },
};

/**
 * Where "Click to Enter" leads. Each world's own page (Figma frame "5" is
 * the Nimbus one) isn't built yet, so for now both open the catalogue.
 */
export const ENTER_HREF = CATALOGUE_PATH;
