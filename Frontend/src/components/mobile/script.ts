/**
 * The phone home page's script: footage, scroll pacing, copy and hotspots.
 *
 * The footage is the user's portrait renders of the desktop films, cut into
 * frame sequences by the scratchpad build (build_mobile_v2.py):
 *   m-intro-v1.mp4   burgundy wash → the sunlit empty room (desktop intro)
 *   m-furnish-v1     the chair weaves itself together (desktop hero scrub)
 *   m-chair-v1       the craft chair, cropped out of the desktop alpha frames
 *   m-rooms-v1       living (day → evening) · dining · bedroom · terrace,
 *                    one film with 0.5 s dissolves baked in where rooms cut
 *
 * All copy mirrors the desktop chapters word for word; only the line breaks
 * are set for a phone's measure. Frame numbers are 0-based indices into the
 * sequences (frame-001.webp is 0).
 */

export const PHONE_QUERY = "(max-width: 1023px)";

/** Asks the director to end a still-playing intro (it holds the scroll). */
export const SKIP_INTRO_EVENT = "maple:skip-intro";

export interface FilmSpec {
  path: string;
  frames: number;
  width: number;
  height: number;
}

export const FILMS = {
  furnish: { path: "/media/sequences/m-furnish-v1", frames: 241, width: 810, height: 1440 },
  chair: { path: "/media/sequences/m-chair-v1", frames: 79, width: 724, height: 999 },
  rooms: { path: "/media/sequences/m-rooms-v1", frames: 320, width: 810, height: 1440 },
} as const satisfies Record<string, FilmSpec>;

/** The intro film — the desktop beats: title rises at 4.3 s, film rests at 5.4 s. */
export const INTRO = {
  src: "/media/video/m-intro-v1.mp4",
  /** The resting frame, for reduced motion, a blocked autoplay or a stall. */
  rest: "/media/video/m-intro-rest-v1.webp",
  titleAt: 4.3,
  freezeAt: 5.4,
  maxMs: 12_000,
} as const;

/**
 * A scroll script: [frame, screens of scroll since the previous knot].
 * Repeating a frame makes a hold — the film rests while its copy is read.
 */
export type Knot = readonly [frame: number, screens: number];

/** 01–02 — the empty room, the weave, the camera drawing back. */
export const FURNISH_SCRIPT: readonly Knot[] = [
  [0, 0],
  [36, 0.45], // the empty room, light moving on the wall
  [150, 1.5], // the ribbons weave the chair together
  [180, 0.45], // the seat settles
  [240, 0.75], // the camera draws back: lamp, plant
  [240, 0.8], // rest — "Let's furnish yours."
];

/** "Let's furnish yours." lands once the film has finished (desktop: 0.985). */
export const FURNISH_COPY_FRAME = 236;

/** Hero → craft hand-off: the room dissolves into the craft plate. */
export const BRIDGE_SCREENS = 1.1;

/** A sheet sliding over the pinned stage before it (craft → rooms → finale). */
export const COVER_SCREENS = 1;

/** 03 — the chair parts and comes back together (after the hand-off). */
export const CRAFT_SCRIPT: readonly Knot[] = [
  [0, 0],
  [0, 0.35], // assembled — the wordmark and copy have the stage
  [30, 1.0], // the chair comes apart
  [64, 1.8], // the pieces hang; the three notes in turn
  [78, 0.7], // back together
  [78, 0.35], // rest before the rooms arrive
];

/** Desktop EXPLODE_AT (0.32 of the scrub): the assembled copy hands over. */
export const EXPLODE_FRAME = 25;

export interface CraftNote {
  title: string;
  body: string;
  /** First frame this note owns (it holds until the next one's). */
  from: number;
}

/** The desktop's three callouts, given the stage one at a time, all set left. */
export const CRAFT_NOTES: readonly CraftNote[] = [
  {
    title: "Comfort Is\nEngineered.",
    body: "Balanced support beneath every moment of relaxation.",
    from: EXPLODE_FRAME,
  },
  {
    title: "Every Curve Has\nA Purpose.",
    body: "Sculpted for comfort. Refined through precision.",
    from: 43,
  },
  {
    title: "Strength Hidden\nIn Plain Sight.",
    body: "Solid wood craftsmanship that defines every silhouette.",
    from: 58,
  },
];

/** 04–06 — one film through the rooms, holding where each is settled. */
export const ROOMS_SCRIPT: readonly Knot[] = [
  [0, 0],
  [11, 0.45], // into the day room
  [11, 0.7], // hold — Comfort, Curated Beautifully.
  [62, 1.3], // day turns to evening; the cove lights come up
  [100, 1.2], // evening — A Room Becomes A Place To Belong.
  [168, 1.5], // past the wall: the dining room furnishes itself
  [180, 0.45],
  [180, 0.7], // hold — Gather Around Something Meaningful.
  [236, 1.4], // dissolve, past the pillar: the bed is made
  [245, 0.35],
  [245, 0.7], // hold — The Best Part Of Every Day…
  [300, 1.4], // dissolve, through the glass doors: the terrace dresses
  [319, 0.5],
  [319, 0.8], // hold — Luxury Doesn't End At The Door.
];

export interface SceneCopy {
  /** "\n" breaks the line on a phone. */
  headline: string;
  /** The short rule above the headline. */
  eyebrowAbove?: boolean;
  subBold?: string;
  body?: string;
  /** subBold + body sit low in the frame, apart from the headline (bedroom). */
  split?: boolean;
}

export interface SceneSpot {
  name: string;
  /** Position in the frame, % of the 810×1440 footage. */
  x: number;
  y: number;
  /** Fallbacks when the products API is unreachable (same as the desktop). */
  desc: string;
  img: string;
}

export interface RoomScene {
  /** Matches the desktop scene keys, which key the products API. */
  key: "day-room" | "evening-room" | "dining" | "bedroom" | "terrace";
  label: string;
  /** Frames the copy is up for. */
  copy: readonly [number, number];
  /** Frames the dots are up for — only once the furniture has settled. */
  dots: readonly [number, number];
  /** The settled frame, for the reduced-motion page. */
  still: number;
  text: SceneCopy;
  spots: readonly SceneSpot[];
}

export const ROOM_SCENES: readonly RoomScene[] = [
  {
    key: "day-room",
    label: "Living room",
    copy: [1, 24],
    dots: [4, 22],
    still: 11,
    text: {
      eyebrowAbove: true,
      headline: "Comfort, Curated\nBeautifully.",
      body: "Where everyday moments become lasting memories.",
    },
    spots: [
      { name: "Aria Lounge Chair", x: 37, y: 50, desc: "Comfort designed to welcome you home.", img: "/images/products/maple-chair.webp" },
      { name: "Haven Sectional", x: 61, y: 45, desc: "Deep seats in traceable natural linen.", img: "/images/products/sofa.webp" },
      { name: "Orbit Coffee Table", x: 57, y: 51.5, desc: "Turned from a single walnut blank.", img: "/images/products/coffee-table.webp" },
      { name: "Column Floor Lamp", x: 64.5, y: 39, desc: "Soft, paper-diffused light.", img: "/images/products/floor-lamp.webp" },
    ],
  },
  {
    key: "evening-room",
    label: "Living room, evening",
    copy: [64, 102],
    // The dissolve into the dining film reframes the room from 90 on.
    dots: [70, 89],
    still: 89,
    text: {
      headline: "A Room Becomes A\nPlace To Belong.",
    },
    spots: [
      { name: "Aria Lounge Chair", x: 37, y: 53, desc: "Comfort designed to welcome you home.", img: "/images/products/maple-chair.webp" },
      { name: "Haven Sectional", x: 64, y: 47, desc: "Deep seats in traceable natural linen.", img: "/images/products/sofa.webp" },
      { name: "Orbit Coffee Table", x: 58, y: 53.5, desc: "Turned from a single walnut blank.", img: "/images/products/coffee-table.webp" },
    ],
  },
  {
    key: "dining",
    label: "Dining room",
    copy: [170, 181],
    dots: [174, 181],
    still: 180,
    text: {
      eyebrowAbove: true,
      headline: "Gather Around\nSomething\nMeaningful.",
      subBold: "Designed For Conversations That Last.",
      body: "Made for shared meals, celebrations and everything in between.",
      // Three headline lines already reach the pendant on a short phone:
      // the closing lines go low, over the floor, as in the bedroom.
      split: true,
    },
    spots: [
      { name: "Longtable No. 4", x: 52, y: 53.5, desc: "Seats eight, remembers every one.", img: "/images/products/dining-table.webp" },
      { name: "Bow Dining Chairs", x: 33, y: 57, desc: "Steam-bent backs, linen seats.", img: "/images/products/dining-chairs.webp" },
      { name: "Tiered Pendant", x: 48, y: 42.5, desc: "Layered light over the table.", img: "/images/products/pendant-light.webp" },
      { name: "Credenza Low", x: 84, y: 51.5, desc: "Quiet storage in oiled walnut.", img: "/images/products/sideboard.webp" },
    ],
  },
  {
    key: "bedroom",
    label: "Bedroom",
    copy: [237, 246],
    dots: [239, 246],
    still: 245,
    text: {
      eyebrowAbove: true,
      headline: "The Best Part\nOf Every Day…",
      subBold: "Begins And Ends Here.",
      body: "Comfort designed to welcome you home.",
      split: true,
    },
    spots: [
      { name: "Låg Platform Bed", x: 40, y: 52, desc: "Floating solid-timber frame, no hardware in sight.", img: "/images/products/bed.webp" },
      { name: "Ember Wall Light", x: 52, y: 48.5, desc: "Warm pools of light where you need them.", img: "/images/products/wall-lamp.webp" },
      { name: "Foot Bench", x: 60, y: 57, desc: "The landing spot for the day's end.", img: "/images/products/bench.webp" },
      { name: "Dune Bedroom Rug", x: 27, y: 61, desc: "Barefoot-soft wool underfoot.", img: "/images/products/bedroom-rug.webp" },
    ],
  },
  {
    key: "terrace",
    label: "Terrace",
    copy: [302, 319],
    dots: [306, 319],
    still: 319,
    text: {
      headline: "Luxury Doesn't\nEnd At The Door.",
      subBold: "Bring The Comfort Outside.",
      body: "Designed for open skies, quiet mornings and unforgettable evenings.",
    },
    spots: [
      { name: "Vista Outdoor Sofa", x: 30, y: 57, desc: "All-weather comfort, golden hour included.", img: "/images/products/outdoor-sofa.webp" },
      { name: "Plateau Low Table", x: 51, y: 58.5, desc: "Weatherproof stone-top centrepiece.", img: "/images/products/terrace-table.webp" },
      { name: "Rope Lounge Chair", x: 72, y: 59, desc: "Hand-woven cord over a teak frame.", img: "/images/products/outdoor-chair.webp" },
      { name: "Ceramic Planters", x: 77, y: 50.5, desc: "Glazed terracotta, frost-safe.", img: "/images/products/planter.webp" },
    ],
  },
];

/** A frame of a sequence, by 0-based index. */
export const frameUrl = (film: FilmSpec, index: number) =>
  `${film.path}/frame-${String(index + 1).padStart(3, "0")}.webp`;
