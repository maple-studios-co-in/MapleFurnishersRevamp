import { CATALOGUE_PATH } from "@/lib/links";

/**
 * The Nimbus rooms (/spaces/nimbus): three rooms above the clouds, each
 * furnished piece by piece as the visitor scrolls through it.
 *
 * Every room ships as six stage plates (scripts/build-nimbus-plates.mjs):
 * the empty room, then each piece added in turn, ending fully styled. The
 * renderer dissolves between neighbouring plates on the GPU, so the scroll
 * position can sit anywhere between two of them.
 *
 * There are two sets of plates: wide (16:9) for landscape screens, and
 * tall (9:16), the same rooms recomposed for phones, so a portrait screen
 * sees the whole room instead of a third of a wide one.
 */

export const NIMBUS_PATH = "/spaces/nimbus";
/** "Back to Spaces" lands on the Nimbus scene of the Spaces film. */
export const SPACES_NIMBUS = "/spaces#nimbus";
/** The Nimbus PDF in the catalogue app (proxied under /catalogue). */
export const NIMBUS_CATALOGUE = `${CATALOGUE_PATH}/nimbus-collection`;

/** Each set's plates share their sequence's native size. */
export const PLATES = {
  wide: { width: 1672, height: 941, root: "/media/spaces/nimbus-v1" },
  tall: { width: 810, height: 1440, root: "/media/spaces/nimbus-tall-v1" },
} as const;

export type PlateSet = keyof typeof PLATES;

/** Screens this tall or taller (phones, portrait tablets) get the tall plates. */
export const TALL_QUERY = "(max-aspect-ratio: 4/5)";

export type RoomId = "living" | "dining" | "bedroom";

type Point = readonly [number, number];

export interface RoomStage {
  /** Plate file name in the wide set, without extension (tall plates are 00–05). */
  file: string;
  /** What arrives at this stage (stage 0 is the empty room). */
  label: string;
  /**
   * Where the camera looks once this stage has arrived, in wide-plate UV
   * (0–1, y down). On wide screens the frame barely moves toward it.
   */
  focus: Point;
}

export interface Room {
  id: RoomId;
  numeral: string;
  title: string;
  line: string;
  eyebrow: string;
  body: string;
  /** The window onto the cloud sea, in wide-plate UV: the camera leaves the room through it. */
  window: Point;
  stages: readonly RoomStage[];
  /** The same for the tall plates: the window, and a look-at point per stage. */
  tall: { window: Point; focus: readonly Point[] };
  /** Alt text for the finished room (static page). */
  alt: string;
}

export const ROOMS: readonly Room[] = [
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
];

export const plateSrc = (room: Room, stage: number, set: PlateSet = "wide") =>
  set === "tall"
    ? `${PLATES.tall.root}/${room.id}/${String(stage).padStart(2, "0")}.webp`
    : `${PLATES.wide.root}/${room.id}/${room.stages[stage].file}.webp`;

export const FINALE = {
  title: "NIMBUS",
  tagline: "A world shaped by clouds.",
  body: "For people who believe luxury doesn’t need to speak loudly.",
  primary: { label: "Explore the collection", href: NIMBUS_CATALOGUE },
  secondary: { label: "Back to Spaces", href: SPACES_NIMBUS },
} as const;
