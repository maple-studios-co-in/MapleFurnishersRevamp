import { CATALOGUE_PATH } from "@/lib/links";

/**
 * The Nimbus rooms (/spaces/nimbus): three rooms above the clouds, each
 * furnished piece by piece as the visitor scrolls through it.
 *
 * Every room ships as six stage plates (scripts/build-nimbus-plates.mjs):
 * the empty room, then each piece added in turn, ending fully styled. The
 * renderer dissolves between neighbouring plates on the GPU, so the scroll
 * position can sit anywhere between two of them.
 */

export const NIMBUS_PATH = "/spaces/nimbus";
/** "Back to Spaces" lands on the Nimbus scene of the Spaces film. */
export const SPACES_NIMBUS = "/spaces#nimbus";
/** The Nimbus PDF in the catalogue app (proxied under /catalogue). */
export const NIMBUS_CATALOGUE = `${CATALOGUE_PATH}/nimbus-collection`;

/** All eighteen plates share the sequences' native size. */
export const PLATE = { width: 1672, height: 941 } as const;

const PLATE_ROOT = "/media/spaces/nimbus-v1";

export type RoomId = "living" | "dining" | "bedroom";

export interface RoomStage {
  /** Plate file name, without extension. */
  file: string;
  /** What arrives at this stage (stage 0 is the empty room). */
  label: string;
  /**
   * Where the camera looks once this stage has arrived, in plate UV
   * (0–1, y down). On wide screens the frame barely moves; on a portrait
   * phone, which sees about a third of the plate's width, the camera walks
   * across the room from piece to piece.
   */
  focus: readonly [number, number];
}

export interface Room {
  id: RoomId;
  numeral: string;
  title: string;
  line: string;
  eyebrow: string;
  body: string;
  /** The window onto the cloud sea, in plate UV: the camera leaves the room through it. */
  window: readonly [number, number];
  stages: readonly RoomStage[];
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
    alt: "Nimbus bedroom above the clouds: an upholstered bed with layered linens, glowing bedside tables and a sculpted vanity",
  },
];

export const plateSrc = (room: Room, stage: number) => `${PLATE_ROOT}/${room.id}/${room.stages[stage].file}.webp`;

export const FINALE = {
  title: "NIMBUS",
  tagline: "A world shaped by clouds.",
  body: "For people who believe luxury doesn’t need to speak loudly.",
  primary: { label: "Explore the collection", href: NIMBUS_CATALOGUE },
  secondary: { label: "Back to Spaces", href: SPACES_NIMBUS },
} as const;
