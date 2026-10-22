import { CATALOGUE_PATH } from "@/lib/links";
import type { RoomsWorld } from "./content";

/** Nimbus (/spaces/nimbus): three rooms above the clouds. */

export const NIMBUS_PATH = "/spaces/nimbus";

export const NIMBUS: RoomsWorld = {
  id: "nimbus",
  name: "Nimbus",
  path: NIMBUS_PATH,
  transit: "cloud",
  plates: {
    wide: { width: 1672, height: 941, root: "/media/spaces/nimbus-v1" },
    tall: { width: 810, height: 1440, root: "/media/spaces/nimbus-tall-v1" },
  },
  heading: "Nimbus: a living room, a dining room and a bedroom above the clouds",
  staticTitle: "Three rooms above the clouds",
  // Lit in the plates' own palette: white tops, lavender shade, peach edges,
  // a pearl sky. The mist is the old shader constant (0.986, 0.976, 0.963).
  palette: {
    whiteout: [245, 241, 234],
    lit: [255, 252, 248],
    shade: [196, 201, 216],
    warm: [253, 228, 209],
    skyTop: [198, 209, 221],
    skyLow: [239, 236, 226],
    haze: [248, 246, 243],
    mist: [251.43, 248.88, 245.565],
  },
  rooms: [
    {
      id: "living",
      numeral: "I",
      title: "The Living Room",
      line: "Where the day goes soft.",
      eyebrow: "Settle. Stay. Unwind.",
      body: "Rounded forms and pale textures, set low so the sky can do the talking.",
      window: [0.62, 0.31],
      stages: [
        { file: "00-empty", label: "The empty room", focus: [0.56, 0.44] },
        { file: "01-rug", label: "The rug", focus: [0.5, 0.76] },
        { file: "02-sofa", label: "The sofa", focus: [0.55, 0.52] },
        { file: "03-chairs", label: "Lounge chairs", focus: [0.2, 0.62] },
        { file: "04-tables", label: "Coffee & side tables", focus: [0.52, 0.66] },
        { file: "05-styled", label: "Finishing touches", focus: [0.84, 0.52] },
      ],
      tall: {
        window: [0.55, 0.47],
        // The lounge chairs stand at the plate's edges, past a phone's frame:
        // the camera turns to the left one as they form, then sweeps right
        // across the tables to the other.
        focus: [
          [0.5, 0.5],
          [0.5, 0.72],
          [0.5, 0.61],
          [0.3, 0.66],
          [0.62, 0.65],
          [0.5, 0.58],
        ],
      },
      alt: "Nimbus living room above the clouds: a pale sofa, two rounded lounge chairs and stone coffee tables on a textured rug",
    },
    {
      id: "dining",
      numeral: "II",
      title: "The Dining Room",
      line: "A table set above the weather.",
      eyebrow: "Slow dinners. Long light.",
      body: "Generous seats around a table made for lingering, under light that falls like cloud.",
      window: [0.27, 0.38],
      stages: [
        { file: "00-empty", label: "The empty room", focus: [0.4, 0.45] },
        { file: "01-rug", label: "The rug", focus: [0.5, 0.76] },
        { file: "02-table", label: "The dining table", focus: [0.48, 0.56] },
        { file: "03-chairs", label: "Dining chairs", focus: [0.45, 0.66] },
        { file: "04-console-pendant", label: "Console & pendant", focus: [0.82, 0.46] },
        { file: "05-styled", label: "Finishing touches", focus: [0.58, 0.45] },
      ],
      tall: {
        window: [0.22, 0.47],
        focus: [
          [0.45, 0.5],
          [0.55, 0.72],
          [0.55, 0.6],
          [0.55, 0.65],
          [0.65, 0.45],
          [0.58, 0.55],
        ],
      },
      alt: "Nimbus dining room above the clouds: a long timber table ringed by soft white chairs under a cloud-like pendant",
    },
    {
      id: "bedroom",
      numeral: "III",
      title: "The Bedroom",
      line: "Sleep, somewhere above it all.",
      eyebrow: "Hushed. Warm. Weightless.",
      body: "Layered softness and a quiet glow, for rest that feels like floating.",
      window: [0.3, 0.36],
      stages: [
        { file: "00-empty", label: "The empty room", focus: [0.42, 0.45] },
        { file: "01-rug", label: "The rug", focus: [0.55, 0.78] },
        { file: "02-bed", label: "The bed", focus: [0.6, 0.6] },
        { file: "03-bedside-tables", label: "Bedside tables", focus: [0.86, 0.6] },
        { file: "04-vanity", label: "The vanity", focus: [0.24, 0.52] },
        { file: "05-styled", label: "Finishing touches", focus: [0.62, 0.5] },
      ],
      tall: {
        window: [0.3, 0.47],
        focus: [
          [0.45, 0.5],
          [0.55, 0.7],
          [0.62, 0.62],
          [0.62, 0.6],
          [0.22, 0.52],
          [0.55, 0.57],
        ],
      },
      alt: "Nimbus bedroom above the clouds: an upholstered bed with layered linens, glowing bedside tables and a sculpted vanity",
    },
  ],
  finale: {
    title: "NIMBUS",
    tagline: "A world shaped by clouds.",
    body: "For people who believe luxury doesn’t need to speak loudly.",
    // The Nimbus PDF in the catalogue app (proxied under /catalogue).
    primary: { label: "Explore the collection", href: `${CATALOGUE_PATH}/nimbus-collection` },
    secondary: { label: "Back to Spaces", href: "/spaces#nimbus" },
  },
};
