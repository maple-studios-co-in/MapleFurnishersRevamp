import type { SceneProducts } from "@/lib/api";
import { ROOM_SCENES, type RoomScene, type SceneSpot } from "./script";

export interface ResolvedSpot extends SceneSpot {
  /** Formatted, when the API knows it. */
  price?: string;
}

export interface ResolvedScene extends Omit<RoomScene, "spots"> {
  spots: readonly ResolvedSpot[];
}

const normalise = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

function formatPrice(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return undefined;
  }
}

/**
 * The phone's room scenes with live product details folded in.
 *
 * The API's hotspot coordinates belong to the desktop's 16:9 footage, so the
 * phone keeps its own positions (script.ts) and takes only the product
 * details, matched by name. A piece the API doesn't know by that name keeps
 * the built-in details, so the dots never lose their cards.
 */
export function resolveScenes(products?: SceneProducts | null): ResolvedScene[] {
  return ROOM_SCENES.map((scene) => {
    const live = products?.[scene.key] ?? [];
    return {
      ...scene,
      spots: scene.spots.map((spot) => {
        const match = live.find((p) => normalise(p.name) === normalise(spot.name));
        if (!match) return spot;
        return {
          ...spot,
          name: match.name,
          desc: match.desc || spot.desc,
          img: match.img || spot.img,
          price: match.priceCents > 0 ? formatPrice(match.priceCents, match.currency) : undefined,
        };
      }),
    };
  });
}
