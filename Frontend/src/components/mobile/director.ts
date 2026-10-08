"use client";

import { gsap } from "@/lib/gsap";
import { FrameBank, type FrameBankOptions } from "./frames";
import {
  BRIDGE_SCREENS,
  COVER_SCREENS,
  CRAFT_NOTES,
  CRAFT_SCRIPT,
  EXPLODE_FRAME,
  FILMS,
  FURNISH_COPY_FRAME,
  FURNISH_SCRIPT,
  GO_STEP_EVENT,
  INTRO,
  ROOM_SCENES,
  ROOMS_SCRIPT,
  STEPS,
  type FilmSpec,
  type Knot,
  type Step,
} from "./script";

export interface StepState {
  /** The beat the story rests on (or last left). */
  at: number;
  /** The beat it is playing toward: `at` itself when at rest. */
  target: number;
  playing: boolean;
  /** The intro is over and the Previous / Next bar is up. */
  ready: boolean;
}

export interface DirectorOptions {
  /** Hold (true) or release (false) the page's smooth scroller. */
  lock: (on: boolean) => void;
  /** The story set off, turned, or came to rest. */
  onStep: (state: StepState) => void;
}

export interface Director {
  /** Play one beat on (1) or back (-1). */
  step(dir: 1 | -1): void;
  /** Cut straight to a beat, behind a curtain. */
  go(index: number): void;
  destroy(): void;
}

/** Top of the assembled chair in the m-chair-v1 crop (ink row 299 of 999). */
const CHAIR_TOP = 299 / 999;
/** The assembled chair's feet, down its contained box. */
const CHAIR_FEET = 0.96;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** A scale, or nothing at rest — an identity transform still costs a layer. */
const scaleOf = (s: number) => (Math.abs(s - 1) < 5e-4 ? "" : `scale(${s.toFixed(4)})`);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 1 across [a, b] of `v`, eased at both ends. */
const ramp = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Page position (in screens) → a frame, along a script of knots. */
class Script {
  private readonly at: number[] = [];
  private readonly frames: number[] = [];
  readonly screens: number;

  constructor(knots: readonly Knot[]) {
    let acc = 0;
    for (const [frame, screens] of knots) {
      acc += screens;
      this.at.push(acc);
      this.frames.push(frame);
    }
    this.screens = acc;
  }

  frameAt(screens: number) {
    const { at, frames } = this;
    if (screens <= at[0]) return frames[0];
    for (let i = 1; i < at.length; i++) {
      if (screens < at[i]) return lerp(frames[i - 1], frames[i], (screens - at[i - 1]) / (at[i] - at[i - 1]));
    }
    return frames[frames.length - 1];
  }

  /** Where the script rests on `frame`: mid-hold if it holds there, else where it passes it. */
  screensFor(frame: number) {
    const { at, frames } = this;
    for (let i = 1; i < at.length; i++) {
      if (frames[i] === frame && frames[i - 1] === frame) return (at[i - 1] + at[i]) / 2;
    }
    if (frame <= frames[0]) return at[0];
    for (let i = 1; i < at.length; i++) {
      const a = frames[i - 1];
      const b = frames[i];
      if (a !== b && frame >= Math.min(a, b) && frame <= Math.max(a, b)) {
        return at[i - 1] + ((frame - a) / (b - a)) * (at[i] - at[i - 1]);
      }
    }
    return at[at.length - 1];
  }
}

/**
 * One frame sequence painted into one canvas. The playhead is fractional:
 * between two decoded frames it cross-fades them, so footage sampled at
 * 12 fps still glides.
 */
class Film {
  readonly bank: FrameBank;
  /** Where the footage lands in the canvas, CSS px. */
  readonly box = { x: 0, y: 0, w: 0, h: 0 };
  /** The eased playhead, in frames. */
  frame = 0;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private painted = -1;
  /** The last paint used exactly the frames it wanted (no stand-in). */
  private exact = false;
  private dirty = true;
  private active = false;

  constructor(
    readonly spec: FilmSpec,
    readonly canvas: HTMLCanvasElement,
    private readonly fit: "cover" | "contain",
    private readonly alpha: boolean,
    bank: FrameBankOptions,
  ) {
    this.ctx = canvas.getContext("2d", { alpha });
    this.bank = new FrameBank(spec.path, spec.frames, { ...bank, bitmaps: true });
    // A frame arriving off screen needn't repaint the canvas — unless the
    // last paint was a stand-in waiting for it.
    this.bank.onLoad = (i) => {
      if (!this.exact || Math.abs(i - this.painted) < 1.5) this.dirty = true;
    };
  }

  /** Fetch frames around the playhead, or let every frame go. */
  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (on) {
      this.bank.focus(this.frame);
      this.bank.start();
    } else {
      this.bank.release();
    }
    this.dirty = true;
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    // Past 2x the 810px footage has no more detail to give.
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(w * this.dpr);
    const bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.w = w;
    this.h = h;
    const { width: iw, height: ih } = this.spec;
    const s = this.fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    this.box.w = iw * s;
    this.box.h = ih * s;
    this.box.x = (w - this.box.w) / 2;
    this.box.y = (h - this.box.h) / 2;
    this.dirty = true;
  }

  /** A point in the footage (% of the frame) in canvas CSS px. */
  project(xPct: number, yPct: number) {
    return { x: this.box.x + (xPct / 100) * this.box.w, y: this.box.y + (yPct / 100) * this.box.h };
  }

  /** Ease the playhead toward `target` (k = share of the gap closed this tick). */
  ease(target: number, k: number) {
    this.frame += (target - this.frame) * k;
    if (Math.abs(target - this.frame) < 0.004) this.frame = target;
  }

  /** A cut: the playhead lands on `frame` without passing the ones between. */
  snap(frame: number) {
    this.frame = frame;
    this.dirty = true;
  }

  /** Whether the footage at `frame` is decoded (either side of a blend). */
  near(frame: number) {
    return this.bank.isReady(Math.floor(frame)) || this.bank.isReady(Math.ceil(frame));
  }

  /** Paint the playhead; a no-op when nothing has changed. */
  paint() {
    const { ctx, box } = this;
    if (!ctx) return;
    const last = this.spec.frames - 1;
    // Blend steps finer than 1/32 of a frame don't show: skip those repaints.
    const q = Math.round(Math.max(0, Math.min(last, this.frame)) * 32) / 32;
    if (!this.dirty && q === this.painted) return;
    this.bank.focus(q);
    const i0 = Math.floor(q);
    const t = q - i0;
    const a = this.bank.get(i0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!a) {
      if (this.alpha) ctx.clearRect(0, 0, this.w, this.h);
      this.exact = false;
      return;
    }
    // Blend only while the film glides: past half a frame per refresh the
    // cross-fade can't be seen, and the second frame would be one more
    // fresh image to hand the GPU in the same refresh.
    const gliding = this.painted < 0 || Math.abs(q - this.painted) <= 0.5;
    let b = gliding && t > 0.03 && i0 < last && this.bank.isReady(i0 + 1) ? this.bank.get(i0 + 1) : null;
    if (b === a) b = null;
    if (this.alpha) {
      // Cut-outs add up instead of stacking, or the outgoing frame would
      // stay solid wherever the incoming one is transparent.
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.globalAlpha = b ? 1 - t : 1;
      ctx.drawImage(a, box.x, box.y, box.w, box.h);
      if (b) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = t;
        ctx.drawImage(b, box.x, box.y, box.w, box.h);
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.globalAlpha = 1;
      ctx.drawImage(a, box.x, box.y, box.w, box.h);
      if (b) {
        ctx.globalAlpha = t;
        ctx.drawImage(b, box.x, box.y, box.w, box.h);
      }
    }
    ctx.globalAlpha = 1;
    this.painted = q;
    this.exact = this.bank.isReady(i0) && (t <= 0.03 || i0 >= last || this.bank.isReady(i0 + 1));
    this.dirty = false;
  }

  destroy() {
    this.bank.destroy();
  }
}

/* --------------------------------------------------------- copy groups -- */

interface Motion {
  from: gsap.TweenVars;
  to: gsap.TweenVars;
  /** null: cut, don't fade (dots must die the frame their window closes). */
  out: gsap.TweenVars | null;
}

const COPY: Motion = {
  from: { autoAlpha: 0, y: 24 },
  to: { autoAlpha: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.1 },
  out: { autoAlpha: 0, y: -16, duration: 0.35, ease: "power2.inOut" },
};
const DOTS: Motion = {
  from: { autoAlpha: 0, y: 10 },
  to: { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out", stagger: 0.05 },
  out: null,
};
const SOFT: Motion = {
  from: { autoAlpha: 0 },
  to: { autoAlpha: 1, duration: 0.7, ease: "power2.out" },
  out: { autoAlpha: 0, duration: 0.45, ease: "power2.inOut" },
};

/**
 * A set of nodes revealed and retired together. Every change kills the
 * group's running tween instance first — a queued stagger left alive would
 * revive copy after its hide on a fast pass (the desktop's stray-callout
 * lesson).
 */
class Group {
  private on: boolean | null = null;
  private tween: gsap.core.Tween | null = null;

  constructor(
    readonly nodes: HTMLElement[],
    private readonly motion: Motion,
    private readonly flag = false,
  ) {}

  set(on: boolean) {
    if (on === this.on || !this.nodes.length) return;
    const first = this.on === null;
    this.on = on;
    this.tween?.kill();
    this.tween = null;
    gsap.killTweensOf(this.nodes);
    if (this.flag) for (const n of this.nodes) n.toggleAttribute("data-on", on);
    if (on) this.tween = gsap.fromTo(this.nodes, this.motion.from, { ...this.motion.to, overwrite: "auto" });
    else if (first || !this.motion.out) gsap.set(this.nodes, { autoAlpha: 0, y: 0 });
    else this.tween = gsap.to(this.nodes, { ...this.motion.out, overwrite: "auto" });
  }
}

/* ---------------------------------------------------------- the pacing -- */

/**
 * Seconds per unit of change, which is how a beat's length is worked out:
 * the films at their playing speeds (frames), the hand-off and the two
 * sheets at their own (0 → 1 each). A beat lasts as long as what changes
 * on the way to it — a held frame costs nothing, so a tap never waits on
 * dead air, and the weave takes the time a weave needs.
 */
const PACE = {
  furnish: 1 / 64, // ~2.7× the renders' 24 fps
  chair: 1 / 22,
  rooms: 1 / 34,
  bridge: 1.9,
  cover: 1.15,
  finale: 1.2,
  /** A screen of page where nothing moves. */
  idle: 0.08,
} as const;
const WEIGHTS = [PACE.furnish, PACE.chair, PACE.rooms, PACE.bridge, PACE.cover, PACE.finale] as const;
/** Seconds to reach full speed, and the braking that brings a beat to rest. */
const T_ACC = 0.5;
/** No beat plays in much under a second, however little changes. */
const T_MIN = 0.7;

/** One beat's stretch of page, measured in seconds of playing time. */
interface Path {
  ys: Float64Array;
  cum: Float64Array;
  n: number;
  total: number;
  /** Which films change on the way: furnish, chair, rooms. */
  moves: [boolean, boolean, boolean];
}

/* ------------------------------------------------------------ director -- */

/**
 * The phone home page: a film told in beats, moved only by its Previous
 * and Next buttons. The page itself is the old scroll-scrubbed story —
 * tall chapters with sticky full-screen stages — but no gesture moves it:
 * the director plays it from beat to beat, scrolling it by hand.
 *
 * Each tick reads the story's position once and:
 *  - plays the intro film, then rests on the titled frame like the desktop,
 *  - runs each film along its script with an eased, cross-faded playhead,
 *  - dissolves the hero room into the craft plate around a rising chair,
 *  - slides each following chapter over the last like a sheet,
 *  - reveals copy and dots on the same frame windows the desktop uses,
 *  - keeps only the frames near the screen decoded, for phone memory.
 * A beat plays at the films' own pace: it eases off, holds a film's
 * speed, and brakes to rest on the beat — slowing rather than showing a
 * stale frame if the footage has not decoded yet. Tapping again while it
 * plays carries straight on (or turns back) without a stop.
 * Returns null if the markup isn't all there.
 */
export function createDirector(root: HTMLElement, opts: DirectorOptions): Director | null {
  const one = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const all = (sel: string, scope: ParentNode = root) => Array.from(scope.querySelectorAll<HTMLElement>(sel));

  const hero = one("[data-m-hero]");
  const heroFrame = one("[data-m-hero-frame]");
  const video = one<HTMLVideoElement>("video[data-m-video]");
  const rest = one<HTMLImageElement>("img[data-m-rest]");
  const furnishCanvas = one<HTMLCanvasElement>("canvas[data-m-furnish-canvas]");
  const title = one("[data-m-title]");
  const skip = one<HTMLButtonElement>("[data-m-skip]");
  const craft = one("[data-m-craft]");
  const craftFrame = one("[data-m-craft-frame]");
  const plate = one("[data-m-plate]");
  const wordmark = one("[data-m-wordmark]");
  const chairBox = one("[data-m-chair-box]");
  const chairCanvas = one<HTMLCanvasElement>("canvas[data-m-chair-canvas]");
  const rooms = one("[data-m-rooms]");
  const roomsStage = one("[data-m-rooms-stage]");
  const roomsFrame = one("[data-m-rooms-frame]");
  const roomsCanvas = one<HTMLCanvasElement>("canvas[data-m-rooms-canvas]");
  const finale = one("[data-m-finale]");
  const header = one("[data-m-header]");
  const dock = one("[data-m-dock]");
  const progress = one("[data-m-progress]");
  const curtain = one("[data-m-curtain]");
  const heroStage = heroFrame?.parentElement;
  const craftStage = craftFrame?.parentElement;
  const craftDim = craftStage?.querySelector<HTMLElement>("[data-m-dim]");
  const roomsDim = roomsStage?.querySelector<HTMLElement>("[data-m-dim]");
  if (
    !hero || !heroFrame || !heroStage || !video || !rest || !furnishCanvas || !title || !skip ||
    !craft || !craftFrame || !craftStage || !craftDim || !plate || !wordmark || !chairBox || !chairCanvas ||
    !rooms || !roomsStage || !roomsFrame || !roomsDim || !roomsCanvas || !finale || !header || !dock ||
    !progress || !curtain
  ) {
    return null;
  }

  const furnish = new Film(FILMS.furnish, furnishCanvas, "cover", false, { keep: 10, stride: 24 });
  const chair = new Film(FILMS.chair, chairCanvas, "contain", true, { keep: 8, stride: 8, concurrency: 3 });
  const roomsFilm = new Film(FILMS.rooms, roomsCanvas, "cover", false, { keep: 8, stride: 20 });
  const films = [furnish, chair, roomsFilm];
  const furnishScript = new Script(FURNISH_SCRIPT);
  const craftScript = new Script(CRAFT_SCRIPT);
  const roomsScript = new Script(ROOMS_SCRIPT);
  const last = STEPS.length - 1;

  const sceneEls = all("[data-m-scene]");
  const dots = all("[data-m-dots]").map((el) => all("[data-m-dot]", el));
  const assembled = all("[data-m-assembled]"); // eyebrow, wordmark, beauty
  const noteEls = all("[data-m-note]");
  const G = {
    // Centred on the screen: top 50% in CSS, and every state of the
    // reveal carries yPercent -50 so GSAP's y never undoes the centring.
    title: new Group([title], {
      from: { autoAlpha: 0, y: 30, yPercent: -50 },
      to: { autoAlpha: 1, y: 0, yPercent: -50, duration: 1.1, ease: "power3.out" },
      out: { autoAlpha: 0, y: -46, yPercent: -50, duration: 0.55, ease: "power2.in" },
    }),
    furnish: new Group(all("[data-m-furnish-copy]"), {
      from: { autoAlpha: 0, y: 36 },
      to: { autoAlpha: 1, y: 0, duration: 1.5, ease: "power3.out", stagger: 0.22 },
      out: { autoAlpha: 0, y: 16, duration: 0.4, ease: "power2.in" },
    }),
    heroScrim: new Group(all("[data-m-hero-scrim]"), SOFT),
    notes: noteEls.map(
      (n) =>
        new Group([n], {
          from: { autoAlpha: 0, y: 22 },
          to: { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" },
          out: { autoAlpha: 0, y: -14, duration: 0.3, ease: "power2.in" },
        }),
    ),
    scenes: sceneEls.map((el) => new Group(all("[data-m-line]", el), COPY)),
    dots: dots.map((list) => new Group(list, DOTS, true)),
    scrimTop: new Group(all("[data-m-scrim-top]"), SOFT),
    scrimBottom: new Group(all("[data-m-scrim-bottom]"), SOFT),
    hint: new Group(all("[data-m-hint]"), SOFT),
    finale: new Group(all("[data-m-finale-in]"), {
      from: { autoAlpha: 0, y: 30 },
      to: { autoAlpha: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.14 },
      out: { autoAlpha: 0, y: 30, duration: 0.4, ease: "power2.in" },
    }),
  };

  /* ------------------------------------------------------------- styles */

  // Last value written per node and property: most ticks change nothing.
  const written = new WeakMap<HTMLElement, Record<string, string>>();
  const write = (el: HTMLElement, prop: "opacity" | "transform" | "visibility" | "borderRadius" | "willChange", value: string) => {
    let rec = written.get(el);
    if (!rec) written.set(el, (rec = {}));
    if (rec[prop] === value) return;
    rec[prop] = value;
    el.style[prop] = value;
  };
  // The number is compared first: a string per element per frame is
  // garbage the collector would have to sweep mid-play.
  const shownAs = new WeakMap<HTMLElement, number>();
  const opacity = (el: HTMLElement, v: number) => {
    const q = Math.round(v * 1000) / 1000;
    if (shownAs.get(el) === q) return;
    shownAs.set(el, q);
    write(el, "opacity", String(q));
  };
  const visible = (el: HTMLElement, on: boolean) => write(el, "visibility", on ? "" : "hidden");
  // Rounded while the sheet travels, square once it lands: two writes per
  // pass, never a per-frame re-clip of a full-screen layer.
  const sheetCorners = (el: HTMLElement, travelling: boolean) => write(el, "borderRadius", travelling ? "26px 26px 0 0" : "");
  // Promoted to its own layer only while it moves (a permanent will-change
  // is a permanent GPU texture — see the WebKit layer budget).
  const moving = (els: HTMLElement[], on: boolean, what = "transform, opacity") => {
    for (const el of els) write(el, "willChange", on ? what : "");
  };
  const setWordY = gsap.quickSetter(wordmark, "yPercent") as (v: number) => void;
  let wordY = Number.NaN;

  /* ------------------------------------------------------------- layout */

  const L = {
    V: 1,
    width: 0,
    bridge: 0,
    heroTop: 0,
    craftTop: 0,
    craftRun: 0,
    roomsTop: 0,
    finaleTop: 0,
    end: 1,
    /** Where each beat rests, px down the page. */
    steps: STEPS.map(() => 0),
  };
  const pageTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

  /**
   * The chair stands as large as the screen allows above its lowest copy
   * (the beauty line and the notes, which sit on the Previous / Next bar):
   * its feet clear the tallest of them by 16px.
   */
  const lowCopy = [assembled[2], ...noteEls].filter((el): el is HTMLElement => !!el);
  const placeChair = () => {
    const H = chairBox.parentElement?.clientHeight ?? 0;
    if (!H) return;
    chairBox.style.bottom = "";
    const top = chairBox.offsetTop;
    let copyTop = H;
    for (const el of lowCopy) copyTop = Math.min(copyTop, el.offsetTop);
    const bottom = H - top - (copyTop - 16 - top) / CHAIR_FEET;
    chairBox.style.bottom = `${Math.max(0, Math.round(bottom))}px`;
  };

  /**
   * The wordmark stands behind the assembled chair: its baseline a fifth of
   * the cap height down behind the chair's top, its cap tops clear of the
   * eyebrow. The chair's size against the screen varies a lot (an SE with
   * Safari's toolbar out to an iPad), so this is measured, not set in CSS;
   * on a short screen the word gives up a little size to fit.
   * TAN PEARL: line box 1.37em, baseline 1.07em down it, caps 1.0em tall.
   */
  const wordmarkWrap = wordmark.parentElement;
  const eyebrow = assembled[0];
  const placeWordmark = () => {
    const bw = chairBox.offsetWidth;
    const bh = chairBox.offsetHeight;
    if (!wordmarkWrap || !eyebrow || !bw || !bh) return;
    const { width: iw, height: ih } = FILMS.chair;
    const s = Math.min(bw / iw, bh / ih);
    const chairTop = chairBox.offsetTop + (bh - ih * s) / 2 + CHAIR_TOP * ih * s;
    wordmark.style.fontSize = "";
    const css = parseFloat(getComputedStyle(wordmark).fontSize) || 0;
    const room = chairTop - (eyebrow.offsetTop + eyebrow.offsetHeight) - 14;
    const size = Math.max(44, Math.min(css, room / 0.8));
    if (size < css) wordmark.style.fontSize = `${size.toFixed(1)}px`;
    const baseline = chairTop + 0.2 * size;
    // The wrap is centred on `top`: its middle is 0.685em down the line box.
    wordmarkWrap.style.top = `${Math.round(baseline - (1.07 - 0.685) * size)}px`;
  };

  /**
   * Dots ride the footage. A dot that would land under its room's copy, on
   * a screen edge or down by the Previous / Next bar sits that room out
   * instead — its piece is still an arrow away in the card.
   */
  const placeDots = () => {
    const w = roomsCanvas.clientWidth;
    const barTop = (roomsCanvas.clientHeight || window.innerHeight) - dock.offsetHeight;
    dots.forEach((list, s) => {
      const scene = sceneEls[s];
      const top = scene?.querySelector<HTMLElement>("[data-m-copy='top']");
      const low = scene?.querySelector<HTMLElement>("[data-m-copy='low']");
      const copyBottom = top ? top.offsetTop + top.offsetHeight : 0;
      const lowTop = low ? low.offsetTop : Infinity;
      for (const dot of list) {
        const p = roomsFilm.project(Number(dot.dataset.x), Number(dot.dataset.y));
        dot.style.left = `${p.x.toFixed(1)}px`;
        dot.style.top = `${p.y.toFixed(1)}px`;
        dot.hidden =
          p.y - 16 < copyBottom + 6 ||
          p.y + 16 > lowTop - 6 ||
          p.y + 16 > barTop - 10 ||
          p.x < 18 ||
          p.x > w - 18;
      }
    });
  };

  /** Where a beat rests, px down the page. */
  const stepY = (s: Step) => {
    const at = s.at;
    switch (at.film) {
      case "top":
        return L.heroTop;
      case "furnish":
        return L.heroTop + furnishScript.screensFor(at.frame) * L.V;
      case "chair":
        return L.craftTop + L.bridge + craftScript.screensFor(at.frame) * L.V;
      case "rooms":
        return L.roomsTop + roomsScript.screensFor(at.frame) * L.V;
      case "end":
        return L.end;
    }
  };

  /** Positions and canvas sizes — after anything that may move them. */
  const measure = () => {
    L.heroTop = pageTop(hero);
    L.craftTop = pageTop(craft);
    L.roomsTop = pageTop(rooms);
    L.finaleTop = pageTop(finale);
    L.end = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    L.steps = STEPS.map((s) => Math.round(Math.min(L.end, stepY(s))));
    furnish.resize();
    chair.resize();
    roomsFilm.resize();
    placeChair();
    placeDots();
    placeWordmark();
  };

  /** The page's runs, in px of the screen height. */
  const layout = () => {
    L.V = window.innerHeight;
    L.width = window.innerWidth;
    L.bridge = Math.round(BRIDGE_SCREENS * L.V);
    const cover = Math.round(COVER_SCREENS * L.V);
    const heroRun = Math.round(furnishScript.screens * L.V) + L.bridge;
    L.craftRun = L.bridge + Math.round(craftScript.screens * L.V) + cover;
    const roomsRun = Math.round(roomsScript.screens * L.V) + cover;
    hero.style.setProperty("--run", `${heroRun}px`);
    craft.style.setProperty("--run", `${L.craftRun}px`);
    craft.style.setProperty("--bridge", `${L.bridge}px`);
    rooms.style.setProperty("--run", `${roomsRun}px`);
    measure();
  };

  /* ---------------------------------------------------------- the story */

  /** The story's place on the page: the director's alone, never a gesture's. */
  const pos = { y: 0 };
  let at = 0;
  let target = 0;
  const setY = (y: number) => {
    pos.y = y;
    window.scrollTo(0, y);
  };

  /** What the page shows at `y`: three playheads, the hand-off and the two sheets. */
  const sample = (y: number, out: Float64Array) => {
    const V = L.V;
    out[0] = furnishScript.frameAt(Math.max(0, y - L.heroTop) / V);
    out[1] = craftScript.frameAt(Math.max(0, y - L.craftTop - L.bridge) / V);
    out[2] = roomsScript.frameAt(Math.max(0, y - L.roomsTop) / V);
    out[3] = clamp01((y - L.craftTop) / L.bridge);
    out[4] = clamp01(1 - (L.roomsTop - y) / V);
    out[5] = clamp01(1 - (L.finaleTop - y) / V);
  };
  const S = new Float64Array(6);
  const S2 = new Float64Array(6);

  /** Price the stretch from y0 to y1 in seconds of playing time, every 3px. */
  const buildPath = (y0: number, y1: number): Path => {
    const n = Math.max(2, Math.min(8000, Math.ceil(Math.abs(y1 - y0) / 3)));
    const ys = new Float64Array(n + 1);
    const cum = new Float64Array(n + 1);
    const moves: [boolean, boolean, boolean] = [false, false, false];
    ys[0] = y0;
    sample(y0, S);
    for (let i = 1; i <= n; i++) {
      const y = y0 + ((y1 - y0) * i) / n;
      sample(y, S2);
      let cost = (PACE.idle * Math.abs(y - ys[i - 1])) / L.V;
      for (let k = 0; k < 6; k++) {
        const d = Math.abs(S2[k] - S[k]);
        cost += d * WEIGHTS[k];
        if (k < 3 && d > 1e-6) moves[k] = true;
      }
      ys[i] = y;
      cum[i] = cum[i - 1] + cost;
      S.set(S2);
    }
    return { ys, cum, n, total: cum[n], moves };
  };

  /** The page position `cost` seconds into a path. */
  const yAtCost = (p: Path, cost: number) => {
    let lo = 0;
    let hi = p.n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p.cum[mid] <= cost) lo = mid;
      else hi = mid;
    }
    const span = p.cum[hi] - p.cum[lo];
    return lerp(p.ys[lo], p.ys[hi], span > 0 ? clamp01((cost - p.cum[lo]) / span) : 1);
  };

  /** The story's place in beats: 3.5 is half-way from the fourth to the fifth. */
  const beatAt = (y: number) => {
    const ys = L.steps;
    if (y <= ys[0]) return 0;
    for (let i = 1; i < ys.length; i++) {
      if (y <= ys[i]) return i - 1 + (ys[i] > ys[i - 1] ? (y - ys[i - 1]) / (ys[i] - ys[i - 1]) : 1);
    }
    return last;
  };

  /** Whether every film on screen at `y` has its frame decoded (only the moving ones, given `moves`). */
  const decoded = (y: number, moves: readonly boolean[] = [true, true, true]) => {
    sample(y, S);
    if (moves[0] && S[3] < 1 && y - L.heroTop > 2 && !furnish.near(S[0])) return false;
    if (moves[1] && S[3] > 0.2 && S[4] < 1 && !chair.near(S[1])) return false;
    if (moves[2] && S[4] > 0 && S[5] < 1 && !roomsFilm.near(S[2])) return false;
    return true;
  };

  const play = {
    path: null as Path | null,
    /** Seconds of playing time into the path, and the speed through it. */
    c: 0,
    v: 0,
    /** Fast-forward for beats asked for ahead, and the slow-down while frames decode. */
    rate: 1,
    buffer: 1,
    dir: 0,
  };

  let lastEmit = "";
  const emit = () => {
    const state: StepState = { at, target, playing: play.path !== null, ready: intro.done };
    const key = `${at}|${target}|${state.playing}|${state.ready}`;
    if (key === lastEmit) return;
    lastEmit = key;
    opts.onStep(state);
  };

  /** Fetch the next beat's footage into the cache while this one is read. */
  const warmNext = () => {
    if (at >= last || !framesGo) return;
    sample(L.steps[at], S);
    sample(L.steps[at + 1], S2);
    films.forEach((film, k) => {
      if (Math.abs(S2[k] - S[k]) > 0.5) film.bank.warm(S[k], S2[k]);
    });
  };

  const arrive = () => {
    setY(L.steps[target]);
    play.path = null;
    play.v = 0;
    play.dir = 0;
    at = target;
    // Resting: the next beat is the likelier ask.
    for (const film of films) film.bank.setLead(1);
    emit();
    warmNext();
  };

  /** Move the story along its path: ease off, hold the films' pace, brake onto the beat. */
  const advance = (dt: number) => {
    const p = play.path;
    if (!p) return;
    const ahead = Math.abs(target - beatAt(pos.y));
    play.rate += (Math.min(2.6, Math.max(1, 1 + 0.8 * (ahead - 1))) - play.rate) * (1 - Math.exp(-dt * 5));
    play.buffer += ((decoded(pos.y, p.moves) ? 1 : 0.22) - play.buffer) * (1 - Math.exp(-dt * 14));
    const vmax = play.rate * Math.min(1, p.total / T_MIN);
    const acc = Math.max(vmax, 0.2) / T_ACC;
    const left = p.total - play.c;
    const want = Math.min(vmax * play.buffer, Math.sqrt(2 * acc * Math.max(0, left)));
    play.v = play.v < want ? Math.min(want, play.v + acc * dt) : Math.max(want, play.v - acc * 2.5 * dt);
    const stepC = play.v * dt;
    if (left <= 1e-4 || stepC >= left) {
      arrive();
      return;
    }
    play.c += stepC;
    setY(yAtCost(p, play.c));
  };

  /** Play one beat on or back; asked again mid-beat, carry on (or turn) from where it is. */
  const step = (dir: 1 | -1) => {
    if (!intro.done || cutting) return;
    if (dir > 0 && target === last && !play.path) {
      go(0);
      return;
    }
    const next = Math.max(0, Math.min(last, target + dir));
    if (next === target) return;
    target = next;
    const y1 = L.steps[target];
    const way = Math.sign(y1 - pos.y);
    // Same way: keep the speed, so a second tap never stutters the film.
    if (way !== play.dir) play.v = 0;
    play.dir = way;
    play.path = buildPath(pos.y, y1);
    play.c = 0;
    for (const film of films) film.bank.setLead(way);
    emit();
  };

  /* ------------------------------------------------------------ the cut */

  let cutting = false;
  let lifter = 0;
  /** Snap every playhead to the page as it stands (after a cut). */
  const snapFilms = () => {
    sample(pos.y, S);
    films.forEach((film, k) => film.snap(S[k]));
    was.bp = was.cp = was.fp = was.progress = -1;
  };

  /**
   * Straight to a beat (the menu, the logo, Replay): a curtain in the
   * intro's burgundy falls, the page moves under it, and it lifts once the
   * new frame has decoded (or after a moment, whichever comes first).
   */
  const go = (index: number) => {
    const i = Math.max(0, Math.min(last, Math.round(index)));
    if (!intro.done) finishIntro();
    if (cutting || (i === at && i === target && !play.path)) return;
    cutting = true;
    play.path = null;
    play.v = 0;
    play.dir = 0;
    target = i;
    emit();
    gsap.killTweensOf(curtain);
    gsap.to(curtain, {
      autoAlpha: 1,
      duration: 0.45,
      ease: "power2.in",
      onComplete: () => {
        if (destroyed) return;
        setY(L.steps[i]);
        snapFilms();
        at = i;
        for (const film of films) film.bank.setLead(1);
        const t0 = performance.now();
        const lift = () => {
          if (destroyed) return;
          if (!decoded(pos.y) && performance.now() - t0 < 900) {
            lifter = window.setTimeout(lift, 40);
            return;
          }
          cutting = false;
          emit();
          warmNext();
          gsap.to(curtain, { autoAlpha: 0, duration: 0.85, ease: "power2.out" });
        };
        lift();
      },
    });
  };

  /* -------------------------------------------------------------- intro */

  const intro = { done: false, title: false, timer: 0, frameCb: 0 };
  // The intro film gets the network first; the weave frames follow once it
  // can play through (or the intro ends), so neither stutters for data.
  let framesGo = false;
  const letFramesGo = () => {
    framesGo = true;
  };
  // The pill eases in after a beat; an intro that ends first must stop it.
  const skipIn = gsap.to(skip, { opacity: 1, duration: 0.8, delay: 1.2, paused: true });

  // No gesture moves this page — only the director, through setY. Two
  // fingers still pinch-zoom.
  const html = document.documentElement;
  const saved = { overflow: html.style.overflow, behavior: html.style.scrollBehavior, overscroll: html.style.overscrollBehavior };
  let held = false;
  const block = (e: Event) => {
    if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) return;
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  };
  const hold = (on: boolean) => {
    if (on === held) return;
    held = on;
    html.style.overflow = on ? "hidden" : saved.overflow;
    // Every move is the director's: never a smooth-scroll of the browser's own.
    html.style.scrollBehavior = on ? "auto" : saved.behavior;
    html.style.overscrollBehavior = on ? "none" : saved.overscroll;
    if (on) {
      window.addEventListener("touchmove", block, { passive: false, capture: true });
      window.addEventListener("wheel", block, { passive: false, capture: true });
    } else {
      window.removeEventListener("touchmove", block, { capture: true });
      window.removeEventListener("wheel", block, { capture: true });
    }
    opts.lock(on);
  };

  const finishIntro = () => {
    if (intro.done) return;
    intro.done = true;
    intro.title = true;
    window.clearTimeout(intro.timer);
    if (intro.frameCb && "cancelVideoFrameCallback" in video) video.cancelVideoFrameCallback(intro.frameCb);
    video.pause();
    // The resting frame as a still over the paused film: identical to it,
    // instant on a skip (no seek to wait for), and immune to a phone
    // dropping a paused video's frame.
    gsap.to(rest, { opacity: 1, duration: 0.35, ease: "power1.out" });
    skipIn.kill();
    gsap.to(skip, { autoAlpha: 0, duration: 0.4, onComplete: () => skip.setAttribute("hidden", "") });
    letFramesGo();
    emit();
    warmNext();
  };

  const watch = () => {
    if (intro.done) return;
    const t = video.currentTime;
    if (t >= INTRO.titleAt) intro.title = true;
    if (t >= INTRO.freezeAt) finishIntro();
  };
  const onFrame = () => {
    watch();
    if (!intro.done) intro.frameCb = video.requestVideoFrameCallback(onFrame);
  };

  const startIntro = () => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = INTRO.src;
    video.addEventListener("timeupdate", watch);
    video.addEventListener("ended", finishIntro);
    video.addEventListener("error", finishIntro);
    video.addEventListener("canplaythrough", letFramesGo, { once: true });
    video.play().then(
      () => {
        if ("requestVideoFrameCallback" in video) intro.frameCb = video.requestVideoFrameCallback(onFrame);
      },
      // Autoplay refused (Low Power Mode, data saver): rest on the still.
      finishIntro,
    );
    intro.timer = window.setTimeout(finishIntro, INTRO.maxMs);
  };

  /* --------------------------------------------------------------- tick */

  const beats = [0.72, 0.6, 0.84]; // eyebrow, wordmark, beauty — wordmark leads
  const assembledOn: (boolean | null)[] = assembled.map(() => null);
  /** The craft's assembled copy: arrives in beats along the hand-off, lifts away as the chair parts. */
  const reconcileAssembled = (bp: number, exploded: boolean) => {
    assembled.forEach((el, i) => {
      const want = !exploded && bp > (beats[i] ?? 0.84);
      if (want === assembledOn[i]) return;
      const first = assembledOn[i] === null;
      assembledOn[i] = want;
      gsap.killTweensOf(el, "autoAlpha,opacity,visibility,y");
      if (first) gsap.set(el, { autoAlpha: want ? 1 : 0, y: want ? 0 : 26 });
      else if (want) gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", overwrite: "auto" });
      else gsap.to(el, { autoAlpha: 0, y: exploded ? -36 : 26, duration: 0.32, ease: "power2.in", overwrite: "auto" });
    });
  };

  let tone = "dark";
  let barTone = "dark";
  let finaleInert: boolean | null = null;
  // Each transition writes only while its progress moves.
  const was = { bp: -1, cp: -1, fp: -1, progress: -1 };
  const heroMovers = [heroFrame, plate, chairBox];
  const craftMovers = [craftFrame, craftDim];
  const roomsMovers = [roomsFrame, roomsDim];
  let hintDone = false;
  let videoGone = false;
  let lastT = performance.now();

  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (play.path) advance(dt);
    // Nothing else may move the page (a focus jump, find-in-page): put it back.
    else if (Math.abs(window.scrollY - pos.y) > 1.5) window.scrollTo(0, pos.y);
    const y = pos.y;
    const V = L.V;
    const vh = V;
    const k = 1 - Math.exp(-dt * 11);

    /* 01–02 · the intro film rests; the weave plays */
    const heroOff = y - L.heroTop;
    furnish.ease(intro.done ? furnishScript.frameAt(Math.max(0, heroOff) / V) : 0, k);
    const scrubbing = intro.done && heroOff > 4;
    G.title.set(intro.title && !scrubbing);
    opacity(furnishCanvas, intro.done ? ramp(2, 0.22 * V, heroOff) : 0);
    const furnished = intro.done && furnish.frame >= FURNISH_COPY_FRAME;
    G.furnish.set(furnished);
    G.heroScrim.set(furnished);

    /* hand-off: the room dissolves into the craft plate as the camera
       eases toward the chair, and the craft chair rises in its place */
    const bp = clamp01((y - L.craftTop) / L.bridge);
    const plateIn = ramp(0, 0.42, bp);
    if (bp !== was.bp) {
      was.bp = bp;
      moving(heroMovers, bp > 0 && bp < 1);
      opacity(plate, plateIn);
      write(heroFrame, "transform", scaleOf(1 + 0.1 * ramp(0, 0.6, bp)));
      const pod = ramp(0.24, 0.62, bp);
      opacity(chairBox, ramp(0.24, 0.48, bp));
      write(chairBox, "transform", pod >= 1 ? "" : `translate(0px,${(28 * (1 - pod)).toFixed(2)}px) scale(${(0.94 + 0.06 * pod).toFixed(4)})`);
    }

    /* 03 · the chair parts; the wordmark glides away; the notes in turn */
    const craftOff = y - L.craftTop - L.bridge;
    chair.ease(craftScript.frameAt(Math.max(0, craftOff) / V), k);
    const exploded = chair.frame >= EXPLODE_FRAME;
    reconcileAssembled(bp, exploded);
    const wy = Math.round(-320 * (chair.frame / (FILMS.chair.frames - 1)) * 10) / 10;
    if (wy !== wordY) setWordY((wordY = wy));
    let note = -1;
    if (exploded) for (let i = 0; i < CRAFT_NOTES.length; i++) if (chair.frame >= CRAFT_NOTES[i].from) note = i;
    for (let i = 0; i < G.notes.length; i++) G.notes[i].set(i === note);

    /* the rooms arrive over the craft like a sheet */
    const roomsEdge = L.roomsTop - y;
    const cp = clamp01(1 - roomsEdge / vh);
    if (cp !== was.cp) {
      was.cp = cp;
      moving(craftMovers, cp > 0 && cp < 1);
      write(craftFrame, "transform", scaleOf(1 - 0.06 * cp));
      opacity(craftDim, 0.62 * cp);
      sheetCorners(roomsStage, cp < 1);
    }

    /* the brand card's sheet, measured first: the rooms retire under it */
    const finaleEdge = L.finaleTop - y;
    const fp = clamp01(1 - finaleEdge / vh);

    /* 04–06 · one film through the rooms */
    const roomsOff = y - L.roomsTop;
    roomsFilm.ease(roomsScript.frameAt(Math.max(0, roomsOff) / V), k);
    const rf = Math.round(roomsFilm.frame);
    const landed = roomsOff > -0.12 * V;
    let anyCopy = false;
    let lowCopyOn = false;
    for (let s = 0; s < ROOM_SCENES.length; s++) {
      const scene = ROOM_SCENES[s];
      const copyOn = landed && rf >= scene.copy[0] && rf <= scene.copy[1];
      G.scenes[s]?.set(copyOn);
      G.dots[s]?.set(landed && fp < 1 && rf >= scene.dots[0] && rf <= scene.dots[1]);
      if (copyOn) {
        anyCopy = true;
        if (scene.text.split) lowCopyOn = true;
      }
    }
    G.scrimTop.set(anyCopy);
    G.scrimBottom.set(lowCopyOn);
    const first = ROOM_SCENES[0].dots;
    G.hint.set(!hintDone && landed && rf >= first[0] && rf <= first[1]);

    /* the brand card arrives over the rooms */
    if (fp !== was.fp) {
      was.fp = fp;
      moving(roomsMovers, fp > 0 && fp < 1);
      write(roomsFrame, "transform", scaleOf(1 - 0.06 * fp));
      opacity(roomsDim, 0.62 * fp);
      sheetCorners(finale, fp < 1);
    }
    G.finale.set(fp > 0.55);
    // Its links take focus only once it has arrived.
    const inert = fp < 0.999;
    if (inert !== finaleInert) finale.inert = finaleInert = inert;

    /* chrome: the header reads the top of the screen, the bar the bottom */
    const nextTone = finaleEdge < 34 || roomsEdge < 34 ? "dark" : plateIn > 0.5 ? "light" : "dark";
    if (nextTone !== tone) header.dataset.tone = tone = nextTone;
    const nextBar = finaleEdge < vh - 40 || roomsEdge < vh - 40 ? "dark" : plateIn > 0.5 ? "light" : "dark";
    if (nextBar !== barTone) dock.dataset.tone = barTone = nextBar;
    const read = Math.round(clamp01(y / L.end) * 2000) / 2000;
    if (read !== was.progress) {
      was.progress = read;
      write(progress, "transform", `scaleX(${read})`);
    }

    /* what is on screen, what is painted, what stays decoded */
    const heroOn = bp < 1;
    const craftOn = bp > 0 && cp < 1;
    const roomsOn = roomsEdge < vh && fp < 1;
    visible(heroStage, heroOn);
    visible(craftStage, craftOn);
    visible(roomsStage, roomsOn);
    furnish.setActive(framesGo && y < L.craftTop + L.bridge + 2 * V);
    chair.setActive(y > L.craftTop - 2.5 * V && y < L.roomsTop + 1.5 * V);
    roomsFilm.setActive(y > L.roomsTop - 3 * V);
    if (heroOn && intro.done) furnish.paint();
    if (craftOn) chair.paint();
    if (roomsOn) roomsFilm.paint();

    // The intro film has done its job once the plate covers it.
    if (!heroOn && intro.done && !videoGone) {
      videoGone = true;
      video.removeAttribute("src");
      video.load();
    }
  };

  /* ------------------------------------------------------------- events */

  const onDotTap = (e: Event) => {
    if ((e.target as Element | null)?.closest?.("[data-m-dot]")) hintDone = true;
  };
  const onGo = (e: Event) => {
    const i = STEPS.findIndex((s) => s.id === (e as CustomEvent<string>).detail);
    if (i >= 0) go(i);
  };
  // Keys walk the beats too (a tablet's keyboard, a narrow desktop window).
  const onKey = (e: KeyboardEvent) => {
    if (!intro.done || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (document.querySelector("#m-menu[data-open='true']")) return;
    const onControl = !!(e.target as Element | null)?.closest?.("button, a, input, textarea, select");
    let dir: 1 | -1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
      case "PageDown":
        dir = 1;
        break;
      case "ArrowUp":
      case "ArrowLeft":
      case "PageUp":
        dir = -1;
        break;
      case " ":
        if (onControl) return;
        dir = e.shiftKey ? -1 : 1;
        break;
      case "Home":
      case "End":
        e.preventDefault();
        go(e.key === "Home" ? 0 : last);
        return;
      default:
        return;
    }
    e.preventDefault();
    step(dir);
  };
  // Sideways, the page is covered by a "turn your phone" card (CSS): hold
  // the layout as it was, so turning back finds the reader where they were.
  const sideways = window.matchMedia("(orientation: landscape) and (max-height: 600px) and (pointer: coarse)");
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (sideways.matches) return;
      if (window.innerWidth === L.width && window.innerHeight === L.V) {
        measure();
      } else {
        // A new screen: re-pace the page, and land on the beat in hand.
        if (play.path) {
          play.path = null;
          play.v = 0;
          play.dir = 0;
          at = target;
          emit();
        }
        layout();
      }
      if (!play.path && !cutting) {
        setY(L.steps[at]);
        snapFilms();
      }
    }, 150);
  };
  let destroyed = false;

  const restoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  hold(true);
  setY(0);
  layout();
  rest.src = INTRO.rest;
  dock.dataset.tone = barTone;
  skip.addEventListener("click", finishIntro);
  window.addEventListener(GO_STEP_EVENT, onGo);
  window.addEventListener("keydown", onKey);
  root.addEventListener("click", onDotTap);
  window.addEventListener("resize", onResize);
  void document.fonts?.ready.then(() => {
    if (destroyed) return;
    measure();
    if (!play.path && !cutting && Math.abs(L.steps[at] - pos.y) > 1) setY(L.steps[at]);
  });
  gsap.fromTo(
    all("[data-m-chrome]", header),
    { autoAlpha: 0, y: -10 },
    { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.3 },
  );
  skipIn.play();
  startIntro();
  emit();
  gsap.ticker.add(tick);
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __mapleHome?: unknown }).__mapleHome = {
      L,
      intro,
      play,
      pos,
      state: () => ({ at, target, cutting }),
      step,
      go,
      films: { furnish, chair, rooms: roomsFilm },
    };
  }

  return {
    step,
    go,
    destroy() {
      destroyed = true;
      gsap.ticker.remove(tick);
      window.clearTimeout(intro.timer);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(lifter);
      skip.removeEventListener("click", finishIntro);
      window.removeEventListener(GO_STEP_EVENT, onGo);
      window.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onDotTap);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("timeupdate", watch);
      video.removeEventListener("ended", finishIntro);
      video.removeEventListener("error", finishIntro);
      video.removeEventListener("canplaythrough", letFramesGo);
      intro.done = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
      hold(false);
      history.scrollRestoration = restoration;
      for (const film of films) film.destroy();
      gsap.killTweensOf(root.querySelectorAll("*"));
    },
  };
}
