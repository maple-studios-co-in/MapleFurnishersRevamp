"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import FrameSequence from "@/components/sequence/FrameSequence";
import { gsap } from "@/lib/gsap";
import { SEQUENCES } from "@/lib/sequences";
import type { SceneProducts } from "@/lib/api";
import { heading, subText } from "@/lib/typography";

/* ------------------------------------------------------------------ */
/*  Scene script                                                       */
/*                                                                     */
/*  The outro film is one continuous scrub; these ranges were measured */
/*  from the footage (scene-cut scan over the 242 frames). Each scene  */
/*  carries its own copy and product hotspots, revealed while the      */
/*  scrub is inside its range and retired when it leaves.              */
/* ------------------------------------------------------------------ */

interface Hotspot {
  /**
   * Position as IMAGE-space percentages of the footage frame (1280×720) —
   * projected through the canvas's cover transform at runtime, so the dot
   * stays on its furniture at any viewport aspect ratio. When the scene's
   * camera moves during the hotspot window, this is the position at the
   * window's END.
   */
  x: number;
  y: number;
  /**
   * Optional position at the window's START — when set, the dot glides
   * linearly between (x0,y0) and (x,y) as the scrub crosses the window,
   * staying pinned to its furniture while the camera pushes in.
   */
  x0?: number;
  y0?: number;
  /** Which side the card opens toward. */
  side: "left" | "right";
  name: string;
  desc: string;
  img?: string;
}

interface SceneCopy {
  /** Extra classes positioning the copy block. */
  className: string;
  eyebrow?: boolean;
  /** Render the eyebrow rule ABOVE the headline instead of inline before it. */
  eyebrowAbove?: boolean;
  headline: string;
  subBold?: string;
  /**
   * Per-scene override for the subBold line. Chapters 05 and 06 spec their
   * closing lines as bold Red Hat Display headings rather than the shared
   * weight-300 sub-text treatment.
   */
  subBoldStyle?: CSSProperties;
  body?: string;
  /**
   * When set, subBold + body render as their OWN positioned block instead
   * of stacking under the headline — the bedroom key frame splits its copy
   * across the composition like this.
   */
  subClassName?: string;
}

interface Scene {
  key: string;
  /**
   * 1-based frame window measured straight from the footage. Compared
   * against the FRAME progress reported by the sequence, so it can never
   * drift when scroll distance or tailHold are re-tuned.
   */
  frames: readonly [number, number];
  /**
   * Separate, tighter window for the hotspots — they appear only once the
   * scene's furniture has SETTLED, never while pieces are still animating
   * into place. Defaults to `frames`.
   */
  hotspotFrames?: readonly [number, number];
  copy?: SceneCopy;
  hotspots?: Hotspot[];
}

const SCENES: readonly Scene[] = [
  {
    // Daylight living room, freshly furnished (frames ~31–47). Carries the
    // "Comfort, Curated Beautifully." key frame: Playfair, eyebrow dash,
    // sitting a little below the header per the reference.
    key: "day-room",
    frames: [30, 47],
    hotspotFrames: [37, 47],
    copy: {
      // max-w-3xl: wide enough for the headline to run as ONE line.
      // eyebrowAbove (not inline): the rule sits ABOVE the headline.
      className: "left-[9%] top-[22%] max-w-3xl lg:left-[10%]",
      eyebrowAbove: true,
      headline: "Comfort, Curated Beautifully.",
      body: "Where everyday moments become lasting memories.",
    },
    hotspots: [
      {
        x: 24, y: 55, side: "right",
        name: "Aria Lounge Chair",
        desc: "Comfort designed to welcome you home.",
        img: "/images/products/maple-chair.webp",
      },
      {
        x: 63, y: 52, side: "left",
        name: "Haven Sectional",
        desc: "Deep seats in traceable natural linen.",
        img: "/images/products/sofa.webp",
      },
      {
        x: 50, y: 76, side: "right",
        name: "Orbit Coffee Table",
        desc: "Turned from a single walnut blank.",
        img: "/images/products/coffee-table.webp",
      },
      {
        x: 10, y: 68, side: "right",
        name: "Pebble Side Table",
        desc: "A quiet perch for the evening cup.",
        img: "/images/products/side-table.webp",
      },
      {
        x: 47, y: 30, side: "right",
        name: "Column Floor Lamp",
        desc: "Soft, paper-diffused light.",
        img: "/images/products/floor-lamp.webp",
      },
      {
        x: 36, y: 88, side: "right",
        name: "Terra Weave Rug",
        desc: "Hand-knotted jute, edge to edge.",
        img: "/images/products/area-rug.webp",
      },
    ],
  },
  {
    // Same room at dusk, lamps on. The wall wipe to the dining room enters
    // frame-right at 87 — both windows close on the last clean frame, 86.
    key: "evening-room",
    frames: [50, 86],
    hotspotFrames: [55, 86],
    copy: {
      className: "left-[9%] top-[22%] max-w-2xl lg:left-[10%]",
      // Controlled break (rendered via whitespace-pre-line): line 1
      // "A Room Becomes A", line 2 "Place To Belong."
      headline: "A Room Becomes A\nPlace To Belong.",
    },
    hotspots: [
      {
        x: 24, y: 55, side: "right",
        name: "Aria Lounge Chair",
        desc: "Comfort designed to welcome you home.",
        img: "/images/products/maple-chair.webp",
      },
      {
        x: 63, y: 52, side: "left",
        name: "Haven Sectional",
        desc: "Deep seats in traceable natural linen.",
        img: "/images/products/sofa.webp",
      },
      {
        x: 50, y: 76, side: "right",
        name: "Orbit Coffee Table",
        desc: "Turned from a single walnut blank.",
        img: "/images/products/coffee-table.webp",
      },
      {
        x: 13, y: 42, side: "right",
        name: "Glow Table Lamp",
        desc: "A warm mushroom of light for the sideboard.",
        img: "/images/products/table-lamp.webp",
      },
    ],
  },
  {
    // Dining room — copy waits until the table is fully set (frame ~112).
    // The glass-panel wipe is already crossing the frame at 122, so both
    // windows close on the last clean frame, 120.
    key: "dining",
    frames: [110, 120],
    hotspotFrames: [115, 120],
    copy: {
      // The dining key frame: eyebrow rule ABOVE, headline at the shared
      // chapter size. max-w-5xl: TAN PEARL needs ~940px for the headline
      // to run as a single line (4xl wrapped it).
      className: "left-[9%] top-[18%] max-w-5xl",
      eyebrowAbove: true,
      headline: "Gather Around Something Meaningful.",
      subBold: "Designed For Conversations That Last.",
      // Bold, per the user — the sub-text spec's weight 300 read too
      // light against the headline here.
      subBoldStyle: { fontWeight: 700 },
      body: "Made for shared meals, celebrations and everything in between.",
    },
    hotspots: [
      {
        x: 46, y: 62, side: "right",
        name: "Longtable No. 4",
        desc: "Seats eight, remembers every one.",
        img: "/images/products/dining-table.webp",
      },
      {
        x: 78, y: 48, side: "left",
        name: "Credenza Low",
        desc: "Quiet storage in oiled walnut.",
        img: "/images/products/sideboard.webp",
      },
      {
        x: 28, y: 66, side: "right",
        name: "Bow Dining Chairs",
        desc: "Steam-bent backs, linen seats.",
        img: "/images/products/dining-chairs.webp",
      },
      {
        x: 44, y: 18, side: "right",
        name: "Tiered Pendant",
        desc: "Layered light over the table.",
        img: "/images/products/pendant-light.webp",
      },
      {
        x: 87, y: 42, side: "left",
        name: "Glow Table Lamp",
        desc: "A warm mushroom of light for the sideboard.",
        img: "/images/products/table-lamp.webp",
      },
    ],
  },
  {
    // Bedroom, made bed (frames ~138–151).
    key: "bedroom",
    frames: [138, 151],
    hotspotFrames: [142, 151],
    copy: {
      // The bedroom key frame splits its copy: headline upper-left with the
      // eyebrow rule above it, the bold close + body sitting lower, laid
      // ACROSS the bed itself per the reference.
      className: "left-[9%] top-[18%] max-w-md lg:left-[10%]",
      eyebrowAbove: true,
      headline: "The Best Part Of Every Day…",
      subBold: "Begins And Ends Here.",
      // Chapter 05 spec.
      subBoldStyle: {
        color: "#F4F2EC",
        fontFamily: "var(--font-redhat)",
        fontSize: "24px",
        fontStyle: "normal",
        fontWeight: 700,
        lineHeight: "150%",
        letterSpacing: "2.4px",
      },
      body: "Comfort designed to welcome you home.",
      // Bedroom key frame position (1536×1024): x154 (10%), y613 (60%).
      // The block's type mirrors the terrace scene's stacked sub/body
      // (16.5px semibold + 14px body) per the user.
      subClassName: "left-[10%] top-[60%] max-w-sm",
    },
    hotspots: [
      {
        x: 42, y: 58, side: "right",
        name: "Låg Platform Bed",
        desc: "Floating solid-timber frame, no hardware in sight.",
        img: "/images/products/bed.webp",
      },
      {
        x: 12, y: 38, side: "right",
        name: "Ember Wall Light",
        desc: "Warm pools of light where you need them.",
        img: "/images/products/wall-lamp.webp",
      },
      {
        x: 48, y: 78, side: "right",
        name: "Foot Bench",
        desc: "The landing spot for the day's end.",
        img: "/images/products/bench.webp",
      },
      {
        x: 26, y: 88, side: "right",
        name: "Dune Bedroom Rug",
        desc: "Barefoot-soft wool underfoot.",
        img: "/images/products/bedroom-rug.webp",
      },
    ],
  },
  {
    // Furnished terrace at sunset. The glass-door glide (152–166) and the
    // furniture assembling (166–175) are left clean; the terrace is fully
    // dressed and lit from 176. The camera keeps pushing in slowly until
    // the cross-dissolve to the exterior shot begins at 204, and the brand
    // card owns the tail — so copy dies at 203 and the hotspots at 202,
    // leaving the whole transition and brand card free of overlays.
    key: "terrace",
    frames: [153, 203],
    hotspotFrames: [176, 202],
    copy: {
      // max-w-4xl: the headline runs as ONE line.
      className: "left-[8%] top-[22%] max-w-4xl lg:left-[10%]",
      headline: "Luxury Doesn't End At The Door.",
      subBold: "Bring The Comfort Outside.",
      // Chapter 06 spec.
      subBoldStyle: {
        color: "#F4F2EC",
        fontFamily: "var(--font-redhat)",
        fontSize: "23.5px",
        fontStyle: "normal",
        fontWeight: 700,
        lineHeight: "150%",
        letterSpacing: "2.35px",
      },
      body: "Designed for open skies, quiet mornings and unforgettable evenings.",
    },
    // The camera pushes in across the window, so each dot carries TWO
    // calibrations: (x0,y0) measured on frame 176, (x,y) on frames
    // 200–202 — handleProgress lerps between them.
    hotspots: [
      {
        x0: 30, y0: 67, x: 26, y: 75, side: "right",
        name: "Vista Outdoor Sofa",
        desc: "All-weather comfort, golden hour included.",
        img: "/images/products/outdoor-sofa.webp",
      },
      {
        x0: 72, y0: 70, x: 76, y: 81, side: "left",
        name: "Rope Lounge Chair",
        desc: "Hand-woven cord over a teak frame.",
        img: "/images/products/outdoor-chair.webp",
      },
      {
        x0: 48, y0: 71, x: 48, y: 86, side: "right",
        name: "Plateau Low Table",
        desc: "Weatherproof stone-top centrepiece.",
        img: "/images/products/terrace-table.webp",
      },
      {
        x0: 76, y0: 57, x: 81, y: 71, side: "left",
        name: "Ceramic Planters",
        desc: "Glazed terracotta, frost-safe.",
        img: "/images/products/planter.webp",
      },
    ],
  },
] as const;

/**
 * Frames finish at (1 - TAIL_HOLD) of the pinned distance — keep in sync
 * with the tailHold passed to FrameSequence below. Marker positions convert
 * footage frames to scroll offsets through this factor.
 */
const TAIL_HOLD = 0.15;
const TOTAL = 242;

/**
 * Native dims of the outro frames. Hotspot coords are image-space
 * percentages; this maps them through the same cover transform the canvas
 * draws with, yielding viewport pixels for the current window size.
 */
const FRAME_W = 1280;
const FRAME_H = 720;
const projectSpot = (xPct: number, yPct: number) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.max(vw / FRAME_W, vh / FRAME_H);
  return {
    left: (vw - FRAME_W * s) / 2 + (xPct / 100) * FRAME_W * s,
    top: (vh - FRAME_H * s) / 2 + (yPct / 100) * FRAME_H * s,
  };
};

/** Chapter anchors, in footage frames (same scan as the scenes). */
const CHAPTER_05_FRAME = 90; // evening living room ends
const CHAPTER_06_FRAME = 152; // the glass-door terrace reveal lands

/** Scroll offset (px into the section) at which a footage frame is drawn. */
const frameToScrollPx = (frame: number, scrollDistance: number) =>
  Math.round(scrollDistance * (1 - TAIL_HOLD) * (frame / TOTAL));

/* ------------------------------------------------------------------ */
/*  Hotspot                                                            */
/* ------------------------------------------------------------------ */

function HotspotDot({ spot }: { spot: Hotspot }) {
  return (
    <div
      data-spot
      className="group pointer-events-auto absolute"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      <button
        type="button"
        aria-label={`About the ${spot.name}`}
        className="relative flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        {/* Breathing ring behind a solid core. */}
        <span className="absolute inset-0 animate-ping rounded-full bg-white/50 [animation-duration:2.2s]" />
        <span className="absolute inset-0 rounded-full border border-white/80 bg-white/25 backdrop-blur-[2px] transition-transform duration-300 group-hover:scale-110" />
        <span className="relative h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
      </button>

      {/* Product card — CSS-only reveal so it also works keyboard-focused. */}
      <div
        className={`invisible absolute top-1/2 z-30 w-72 -translate-y-1/2 opacity-0 transition-all duration-300 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${
          spot.side === "right"
            ? "left-5 translate-x-2 group-hover:translate-x-0"
            : "right-5 -translate-x-2 group-hover:translate-x-0"
        }`}
      >
        <div
          className="flex items-center gap-3 rounded-xl border border-white/40 p-3 shadow-[0_18px_50px_rgba(23,19,16,0.35)] backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.22) 100%)",
          }}
        >
          {spot.img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={spot.img}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg bg-sand-50 object-cover"
            />
          )}
          <div className="min-w-0">
            {/* Hotspot card, per spec. NOTE: "News701 BT" is a licensed
                Bitstream face that is not in this repo — it is declared
                first so it takes over the moment the file is added, with
                the project's serifs as the fallback until then. */}
            <p
              className="truncate"
              style={{
                color: "#741A14",
                fontFamily: '"News701 BT", var(--font-playfair), ui-serif, Georgia, serif',
                fontSize: "14px",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: "150%",
                letterSpacing: "1.4px",
              }}
            >
              {spot.name}
            </p>
            <p
              className="mt-0.5"
              style={{
                color: "#000",
                fontFamily: "var(--font-redhat)",
                fontSize: "12px",
                fontStyle: "normal",
                fontWeight: 300,
                lineHeight: "150%",
                letterSpacing: "1.2px",
              }}
            >
              {spot.desc}
            </p>
            {/* Design spec: Red Hat Display 12px/400, 150% leading (18px),
                ls 1.2px, #FFF. */}
            <button
              type="button"
              className="mt-2 rounded bg-clay-700 px-3 py-1.5 transition-colors hover:bg-clay-900"
              style={{
                color: "#FFF",
                fontFamily: "var(--font-redhat)",
                fontSize: "12px",
                fontStyle: "normal",
                fontWeight: 400,
                lineHeight: "150%",
                letterSpacing: "1.2px",
              }}
            >
              View More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

/**
 * Chapters 04–06 — the closing film. One scrub, five scenes, each with its
 * own copy and shoppable hotspots that live only while their scene is on
 * screen. Ends on the brand card: the film IS the closing page.
 */
export default function OutroScene({
  sceneProducts,
}: {
  /**
   * Hotspots from the API, keyed by scene. Fetched on the SERVER and passed
   * in, so the dot count is fixed before first paint — the per-scene DOM
   * caches below match hotspots positionally and cannot survive the list
   * changing underneath them. Omitted or null falls back to the built-in
   * SCENES data, so the film still works with the API down.
   */
  sceneProducts?: SceneProducts | null;
} = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<Record<string, boolean>>({});
  /**
   * Cached DOM lookups, keyed "<scene>/wrap" (hotspot wrappers, for the
   * per-tick visibility sweep) and "<scene>/dots" (the dots themselves,
   * for the camera-tracking position writes).
   */
  const trackRef = useRef<Record<string, HTMLElement[]>>({});
  const seq = SEQUENCES.outro;

  /** API hotspots for this scene if we have them, else the built-in list. */
  const hotspotsFor = useCallback(
    (scene: Scene): Hotspot[] => {
      const live = sceneProducts?.[scene.key];
      if (!live?.length) return scene.hotspots ?? [];
      return live.map((p) => ({
        x: p.x,
        y: p.y,
        x0: p.x0 ?? undefined,
        y0: p.y0 ?? undefined,
        side: p.side,
        name: p.name,
        desc: p.desc,
        img: p.img,
      }));
    },
    [sceneProducts],
  );

  /**
   * Place every dot by projecting its image-space coords through the cover
   * transform — the inline % styles are only an SSR placeholder, and would
   * drift off their furniture on any non-16:9 viewport. Re-runs on resize.
   * (The terrace dots get re-projected per tick by the camera-track lerp
   * while their window is open.)
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const apply = () => {
      for (const scene of SCENES) {
        const els = stage.querySelectorAll<HTMLElement>(
          `[data-scene="${scene.key}"] [data-spot]`,
        );
        els.forEach((el, i) => {
          const spot = hotspotsFor(scene)[i];
          if (!spot) return;
          const pos = projectSpot(spot.x, spot.y);
          el.style.left = `${pos.left}px`;
          el.style.top = `${pos.top}px`;
        });
      }
    };
    apply();
    window.addEventListener("resize", apply, { passive: true });
    return () => window.removeEventListener("resize", apply);
  }, []);

  /**
   * Reveal/retire one group (copy or hotspots) of one scene.
   *
   * killTweensOf before every state change is load-bearing: a staggered
   * reveal queues tweens up to ~0.8s out, and `overwrite` only cancels
   * tweens that are already ACTIVE — without the kill, scrolling through a
   * scene quickly let a queued reveal fire AFTER the hide, leaving a stray
   * hotspot floating over later scenes (the rug over the brand card).
   */
  const setGroup = useCallback(
    (sceneKey: string, group: "copy" | "spots", show: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const stateKey = `${sceneKey}/${group}`;
      if (!!shownRef.current[stateKey] === show) return;
      shownRef.current[stateKey] = show;

      const nodes = stage.querySelectorAll(
        `[data-scene="${sceneKey}"] [data-group="${group}"] > *`,
      );
      if (!nodes.length) return;
      gsap.killTweensOf(nodes);

      if (show) {
        // Hotspots snap in fast; copy keeps the softer editorial reveal.
        gsap.fromTo(
          nodes,
          { autoAlpha: 0, y: group === "spots" ? 10 : 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: group === "spots" ? 0.3 : 1.1,
            ease: "power3.out",
            stagger: group === "spots" ? 0.04 : 0.16,
            overwrite: "auto",
          },
        );
      } else if (group === "spots") {
        // Hotspots must die THE FRAME their window closes — any fade lets a
        // fast flick carry them into the next scene's frames or the brand
        // card, so they cut, they don't fade.
        gsap.set(nodes, { autoAlpha: 0, y: 0, overwrite: "auto" });
        const active = document.activeElement;
        for (const n of nodes) {
          if (n.contains(active)) (active as HTMLElement).blur();
        }
      } else {
        // Copy eases out gently — abrupt cuts read as glitches between
        // scenes; the frame windows leave enough room for the longer tail.
        gsap.to(nodes, {
          autoAlpha: 0,
          y: -20,
          duration: 0.6,
          ease: "power2.inOut",
          overwrite: "auto",
        });
        // A clicked dot keeps focus, and focus-within keeps its card open —
        // release it when the scene retires.
        const active = document.activeElement;
        for (const n of nodes) {
          if (n.contains(active)) (active as HTMLElement).blur();
        }
      }
    },
    [],
  );

  const handleProgress = useCallback(
    (p: number) => {
      // p is FRAME progress (0..1 over the footage) — compare in frames.
      const frame = 1 + p * (TOTAL - 1);
      for (const scene of SCENES) {
        const copyIn = frame >= scene.frames[0] && frame <= scene.frames[1];
        const spotWin = scene.hotspotFrames ?? scene.frames;
        const spotsIn = frame >= spotWin[0] && frame <= spotWin[1];
        setGroup(scene.key, "copy", copyIn);
        setGroup(scene.key, "spots", spotsIn);

        // Self-heal: setGroup's state flags can be lied to — an HMR remount
        // resets them while the DOM keeps gsap's inline styles, leaving a
        // dot visibly stranded outside its scene. Cheap per-tick sweep:
        // any dot wrapper still carrying a visible inline style while its
        // window is closed gets force-hidden. Reads only el.style (no
        // layout), and after one heal the styles read "0"/"hidden" so the
        // sweep is a string-compare no-op.
        if (!spotsIn) {
          const cacheKey = `${scene.key}/wrap`;
          let els = trackRef.current[cacheKey];
          if (!els || els.some((el) => !el.isConnected)) {
            els = Array.from(
              stageRef.current?.querySelectorAll<HTMLElement>(
                `[data-scene="${scene.key}"] [data-group="spots"] > *`,
              ) ?? [],
            );
            trackRef.current[cacheKey] = els;
          }
          for (const el of els) {
            if (el.style.opacity !== "0" && el.style.visibility !== "hidden") {
              gsap.killTweensOf(el);
              gsap.set(el, { autoAlpha: 0 });
            }
          }
        }

        // Same self-heal for COPY blocks — a scene's headline (or the
        // bedroom's split "Begins And Ends Here." block) orphaned visible
        // outside its window gets force-hidden. Unlike the dots, copy
        // legitimately fades out for 0.6s after its window closes, so an
        // element still mid-tween is left alone.
        if (!copyIn) {
          const cacheKey = `${scene.key}/copy`;
          let els = trackRef.current[cacheKey];
          if (!els || els.some((el) => !el.isConnected)) {
            els = Array.from(
              stageRef.current?.querySelectorAll<HTMLElement>(
                `[data-scene="${scene.key}"] [data-group="copy"] > *`,
              ) ?? [],
            );
            trackRef.current[cacheKey] = els;
          }
          for (const el of els) {
            if (
              el.style.opacity !== "0" &&
              el.style.visibility !== "hidden" &&
              !gsap.isTweening(el)
            ) {
              gsap.set(el, { autoAlpha: 0 });
            }
          }
        }

        // Camera-tracked dots: lerp each (x0,y0)→(x,y) across the window
        // so they ride the push-in instead of drifting off their furniture.
        const spots = hotspotsFor(scene);
        if (spotsIn && spots?.some((h) => h.x0 !== undefined)) {
          const cacheKey = `${scene.key}/dots`;
          let els = trackRef.current[cacheKey];
          if (!els || els.some((el) => !el.isConnected)) {
            els = Array.from(
              stageRef.current?.querySelectorAll<HTMLElement>(
                `[data-scene="${scene.key}"] [data-spot]`,
              ) ?? [],
            );
            trackRef.current[cacheKey] = els;
          }
          const t = Math.min(
            1,
            Math.max(
              0,
              (frame - spotWin[0]) / Math.max(1, spotWin[1] - spotWin[0]),
            ),
          );
          els.forEach((el, i) => {
            const h = spots[i];
            if (!h || h.x0 === undefined) return;
            const xi = h.x0 + (h.x - h.x0) * t;
            const yi = (h.y0 ?? h.y) + (h.y - (h.y0 ?? h.y)) * t;
            const pos = projectSpot(xi, yi);
            el.style.left = `${pos.left}px`;
            el.style.top = `${pos.top}px`;
          });
        }
      }
    },
    [setGroup],
  );

  return (
    <FrameSequence
      id="spaces"
      label="Maple Furnishers rooms — living, dining, bedroom, terrace"
      className="bg-ink"
      framePath={seq.path}
      totalFrames={seq.frames}
      scrollPerFrame={seq.scrollPerFrame}
      fit="cover"
      preloadMargin={1400}
      tailHold={TAIL_HOLD}
      onProgress={handleProgress}
      markers={
        <>
          {/* Chapter anchors on the spacer (pinned children never move);
              +50dvh aligns activation with useActiveSection's midpoint. */}
          <div
            id="promise"
            aria-hidden
            className="absolute left-0 h-px w-px"
            style={{
              top: `calc(${frameToScrollPx(CHAPTER_05_FRAME, seq.frames * seq.scrollPerFrame)}px + 50dvh)`,
            }}
          />
          {/* Chapter 06 anchor. Lives here because the film is the last
              thing on the page — BrandPromise, which briefly owned a real
              <section id="contact">, is unmounted. If it ever comes back,
              DELETE this marker: two elements sharing an id is invalid and
              scrollTo("#contact") matches the first, which would drop the
              user mid-scrub instead of on the section. */}
          <div
            id="contact"
            aria-hidden
            className="absolute left-0 h-px w-px"
            style={{
              top: `calc(${frameToScrollPx(CHAPTER_06_FRAME, seq.frames * seq.scrollPerFrame)}px + 50dvh)`,
            }}
          />
        </>
      }
      foreground={
        <div ref={stageRef} className="pointer-events-none absolute inset-0 z-20">
          {SCENES.map((scene) => (
            <div key={scene.key} data-scene={scene.key} className="absolute inset-0">
              {/* Copy and hotspots are separate groups with separate reveal
                  windows — hotspots wait for the furniture to settle. */}
              <div data-group="copy" className="absolute inset-0">
              {scene.copy && (
                <div className={`invisible absolute opacity-0 ${scene.copy.className}`}>
                  {scene.copy.eyebrowAbove && (
                    <span
                      aria-hidden
                      className="mb-4 block h-px w-14 bg-cream/80 sm:mb-5 sm:w-20"
                    />
                  )}
                  {/* whitespace-pre-line honours explicit \n breaks in a
                      headline (evening room) without affecting the rest. */}
                  {/* Design spec: TAN PEARL 32px/400, stroked 1px #FFF,
                      ls 1.6px — one treatment for every chapter 04–06
                      headline (the old Playfair variant is retired). */}
                  <h2
                    className="whitespace-pre-line"
                    style={{
                      ...heading("#FFF", "32px", "1.6px"),
                      textShadow: "0 2px 24px rgba(23,19,16,0.5)",
                    }}
                  >
                    {scene.copy.eyebrow && (
                      <span className="mr-3 inline-block h-px w-9 translate-y-[-8px] bg-cream/80 align-middle" />
                    )}
                    {scene.copy.headline}
                  </h2>
                  {/* Sub-text spec: Red Hat Display 18.544px/300, ls
                      1.854px, #FFF — same treatment for the bold close and
                      the body line. */}
                  {!scene.copy.subClassName && scene.copy.subBold && (
                    <p
                      className="mt-2.5"
                      style={{
                        ...subText("#FFF"),
                        ...scene.copy.subBoldStyle,
                        textShadow: "0 1px 14px rgba(23,19,16,0.55)",
                      }}
                    >
                      {scene.copy.subBold}
                    </p>
                  )}
                  {!scene.copy.subClassName && scene.copy.body && (
                    <p
                      className="mt-1.5 max-w-md"
                      style={{
                        ...subText("#FFF"),
                        textShadow: "0 1px 12px rgba(23,19,16,0.5)",
                      }}
                    >
                      {scene.copy.body}
                    </p>
                  )}
                </div>
              )}

              {/* Split layout: the bold close + body as their own block,
                  placed elsewhere in the composition (bedroom key frame). */}
              {scene.copy?.subClassName && (
                <div
                  className={`invisible absolute opacity-0 ${scene.copy.subClassName}`}
                >
                  {/* Split block (bedroom key frame) — same sub-text spec
                      as the stacked variant above. */}
                  {scene.copy.subBold && (
                    <p
                      style={{
                        ...subText("#FFF"),
                        ...scene.copy.subBoldStyle,
                        textShadow: "0 1px 14px rgba(23,19,16,0.55)",
                      }}
                    >
                      {scene.copy.subBold}
                    </p>
                  )}
                  {/* -mt-1: the bold line above carries 150% leading, which
                      left too much air under it in the bedroom scene.
                      Tightened per the user. */}
                  {scene.copy.body && (
                    <p
                      className="-mt-1"
                      style={{
                        ...subText("#FFF"),
                        textShadow: "0 1px 12px rgba(23,19,16,0.5)",
                      }}
                    >
                      {scene.copy.body}
                    </p>
                  )}
                </div>
              )}
              </div>

              <div data-group="spots" className="absolute inset-0">
                {hotspotsFor(scene).map((spot) => (
                  <div
                    key={spot.name}
                    className="invisible absolute inset-0 opacity-0"
                  >
                    <HotspotDot spot={spot} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    />
  );
}
