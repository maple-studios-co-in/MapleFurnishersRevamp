import { NIMBUS } from "./nimbus";
import { TERRA } from "./terra";

/**
 * The rooms of a Spaces world (/spaces/nimbus, /spaces/terra): three rooms,
 * each furnished piece by piece as the visitor scrolls through it, joined
 * by a flight through the world's own cloud. One engine (director.ts) plays
 * every world; a world is data: its rooms, its plates and its palette.
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

export type RoomsWorldId = "nimbus" | "terra";
export type PlateSet = "wide" | "tall";

/** Screens this tall or taller (phones, portrait tablets) get the tall plates. */
export const TALL_QUERY = "(max-aspect-ratio: 4/5)";

type Point = readonly [number, number];
/** sRGB, 0–255. */
export type Rgb = readonly [number, number, number];

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
  /** Also the plates' folder and the room's #hash. */
  id: string;
  numeral: string;
  title: string;
  line: string;
  eyebrow: string;
  body: string;
  /** The way out (a window, an opening to the garden), in wide-plate UV: the camera leaves the room through it. */
  window: Point;
  stages: readonly RoomStage[];
  /** The same for the tall plates: the way out, and a look-at point per stage. */
  tall: { window: Point; focus: readonly Point[] };
  /** Alt text for the finished room (static page). */
  alt: string;
}

/**
 * The world's light (shader.ts): the whiteout, the full cover at the heart
 * of a crossing (which the veil carries across a page change, veil.ts);
 * the lit tops, shade and warm edges of its cloud (or, in a foliage world,
 * of the treetops in its finale); the finale's sky; the haze inside the
 * bank; and the mist a piece of furniture condenses out of.
 */
export interface CloudPalette {
  whiteout: Rgb;
  lit: Rgb;
  shade: Rgb;
  warm: Rgb;
  skyTop: Rgb;
  skyLow: Rgb;
  haze: Rgb;
  mist: Rgb;
}

/**
 * How fast a world plays. Nimbus's are the defaults (director.ts); Terra's
 * are slower, an unhurried walk through a garden.
 */
export interface Tempo {
  /** Viewport heights of scroll per second of the film's timeline. */
  vhPerSecond: number;
  /** The playhead's top speed over short distances, timeline seconds per second. */
  maxRate: number;
  /** Seconds the playhead takes to settle on the scroll. */
  smooth: number;
  /** A crossing between rooms (timeline seconds), and when inside it the rooms change. */
  cross: number;
  swap: number;
}

export interface RoomsWorld {
  id: RoomsWorldId;
  name: string;
  path: string;
  /**
   * What the camera flies through between rooms: Nimbus's cloud, or
   * Terra's foliage (sprays of leaves at depth, leaves.ts).
   */
  transit: "cloud" | "foliage";
  tempo?: Partial<Tempo>;
  /** Each set's plates share their sequence's native size. */
  plates: Record<PlateSet, { width: number; height: number; root: string }>;
  rooms: readonly Room[];
  palette: CloudPalette;
  /** The page's heading for screen readers. */
  heading: string;
  /** The static page's title. */
  staticTitle: string;
  finale: {
    title: string;
    tagline: string;
    body: string;
    primary: { label: string; href: string };
    /** Back to the world's scene on /spaces. */
    secondary: { label: string; href: string };
  };
}

export const ROOM_WORLDS: Record<RoomsWorldId, RoomsWorld> = { nimbus: NIMBUS, terra: TERRA };

export const plateSrc = (world: RoomsWorld, room: Room, stage: number, set: PlateSet = "wide") =>
  set === "tall"
    ? `${world.plates.tall.root}/${room.id}/${String(stage).padStart(2, "0")}.webp`
    : `${world.plates.wide.root}/${room.id}/${room.stages[stage].file}.webp`;

/** A palette colour as CSS's space-separated "r g b". */
export const cssRgb = (c: Rgb) => c.join(" ");
