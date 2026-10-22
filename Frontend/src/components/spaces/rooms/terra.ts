import { CATALOGUE_PATH } from "@/lib/links";
import type { RoomsWorld } from "./content";

/**
 * Terra (/spaces/terra): a resort grounded in earth. Arrive in the lobby,
 * rest in the bedroom, end outside on the garden terrace. Between rooms the
 * camera leaves through the garden and flies through sunlit foliage (olive
 * sprays, bay and fern: leaves.ts) instead of Nimbus's cloud, and the film
 * ends on a golden sky over a sea of treetops. It plays slower than Nimbus:
 * a walk through a garden, never a rush.
 */

export const TERRA_PATH = "/spaces/terra";

export const TERRA: RoomsWorld = {
  id: "terra",
  name: "Terra",
  path: TERRA_PATH,
  transit: "foliage",
  // About 30% more scroll per beat than Nimbus, a gentler top speed, a
  // heavier settle and a longer crossing.
  tempo: { vhPerSecond: 0.56, maxRate: 0.85, smooth: 0.72, cross: 3.6, swap: 1.85 },
  plates: {
    wide: { width: 1672, height: 941, root: "/media/spaces/terra-v1" },
    tall: { width: 810, height: 1440, root: "/media/spaces/terra-tall-v1" },
  },
  heading: "Terra: a hotel lobby, a bedroom and a garden terrace, grounded in earth",
  staticTitle: "Three rooms, grounded in earth",
  // Sun through leaves: the crossing's heart is a warm sage light; the
  // finale's treetops are olive, lit gold at the top, deep in their shade,
  // under a sand-gold sky.
  palette: {
    whiteout: [232, 228, 202],
    lit: [176, 178, 112],
    shade: [64, 76, 44],
    warm: [240, 202, 138],
    skyTop: [214, 201, 180],
    skyLow: [246, 229, 196],
    haze: [234, 231, 206],
    mist: [251, 246, 238],
  },
  rooms: [
    {
      id: "lobby",
      numeral: "I",
      title: "The Lobby",
      line: "Arrive somewhere grounded.",
      eyebrow: "Arrive. Breathe. Belong.",
      body: "Travertine, timber and an olive courtyard: a welcome made of honest materials.",
      window: [0.82, 0.3],
      stages: [
        { file: "00-empty", label: "The empty hall", focus: [0.55, 0.45] },
        { file: "01-rug", label: "The rug", focus: [0.5, 0.76] },
        { file: "02-sofa", label: "The sofa", focus: [0.5, 0.6] },
        { file: "03-seating", label: "Lounge chairs", focus: [0.5, 0.68] },
        { file: "04-furniture", label: "Tables & reception", focus: [0.4, 0.62] },
        { file: "05-styled", label: "Finishing touches", focus: [0.52, 0.55] },
      ],
      tall: {
        window: [0.82, 0.32],
        // The lounge chairs stand at the plate's edges: the camera turns to
        // the left one, then sweeps right across the tables to the other.
        focus: [
          [0.5, 0.5],
          [0.5, 0.7],
          [0.5, 0.58],
          [0.3, 0.66],
          [0.62, 0.63],
          [0.45, 0.56],
        ],
      },
      alt: "Terra hotel lobby: a curved sofa and two timber-ringed lounge chairs around a round walnut table, an olive courtyard beyond",
    },
    {
      id: "bedroom",
      numeral: "II",
      title: "The Bedroom",
      line: "Rest, close to the earth.",
      eyebrow: "Still. Warm. Rooted.",
      body: "Leather, linen and sun-warmed stone, opening onto the garden and the pool.",
      window: [0.85, 0.3],
      stages: [
        { file: "00-empty", label: "The empty room", focus: [0.5, 0.45] },
        { file: "01-rug", label: "The rug", focus: [0.5, 0.75] },
        { file: "02-bed", label: "The bed", focus: [0.38, 0.6] },
        { file: "03-bedside-tables", label: "Bedside tables", focus: [0.3, 0.6] },
        { file: "04-lounge", label: "The lounge", focus: [0.78, 0.62] },
        { file: "05-styled", label: "Finishing touches", focus: [0.55, 0.5] },
      ],
      tall: {
        window: [0.88, 0.36],
        focus: [
          [0.5, 0.5],
          [0.5, 0.68],
          [0.42, 0.55],
          [0.4, 0.54],
          [0.66, 0.62],
          [0.55, 0.56],
        ],
      },
      alt: "Terra hotel bedroom: a low leather bed in white linen, sculpted timber bedside tables and a curved sofa by a glass wall onto the pool",
    },
    {
      id: "outdoor",
      numeral: "III",
      title: "The Terrace",
      line: "Where the house meets the garden.",
      eyebrow: "Open air. Long afternoons.",
      body: "Woven frames and olive tones on travertine, made to weather the seasons with you.",
      window: [0.45, 0.3],
      stages: [
        { file: "00-empty", label: "The empty terrace", focus: [0.48, 0.45] },
        { file: "01-sofa", label: "The sofa", focus: [0.48, 0.55] },
        { file: "02-chairs", label: "Lounge chairs", focus: [0.5, 0.6] },
        { file: "03-coffee-table", label: "The coffee table", focus: [0.5, 0.72] },
        { file: "04-side-tables", label: "Side tables", focus: [0.55, 0.7] },
        { file: "05-styled", label: "Finishing touches", focus: [0.5, 0.6] },
      ],
      tall: {
        window: [0.5, 0.38],
        // The chairs again stand at the edges: left one first, then right.
        focus: [
          [0.5, 0.5],
          [0.5, 0.56],
          [0.3, 0.63],
          [0.62, 0.64],
          [0.55, 0.65],
          [0.5, 0.6],
        ],
      },
      alt: "Terra garden terrace: a woven sofa and lounge chairs around a round rope coffee table under a timber pergola, olive trees and a pool beyond",
    },
  ],
  finale: {
    title: "TERRA",
    tagline: "A world shaped by earth.",
    body: "Grounded forms. Honest materials. A deeper connection to the spaces we live in.",
    // The catalogue has no Terra PDF yet: its landing, as the Spaces scene does.
    primary: { label: "Explore the collection", href: CATALOGUE_PATH },
    secondary: { label: "Back to Spaces", href: "/spaces#terra" },
  },
};
