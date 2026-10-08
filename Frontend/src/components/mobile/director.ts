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
  INTRO,
  ROOM_SCENES,
  ROOMS_SCRIPT,
  SKIP_INTRO_EVENT,
  type FilmSpec,
  type Knot,
} from "./script";

export interface DirectorOptions {
  /** Hold (true) or release (false) the page's smooth scroller. */
  lock: (on: boolean) => void;
}

export interface Director {
  destroy(): void;
}

/** Top of the assembled chair in the m-chair-v1 crop (ink row 299 of 999). */
const CHAIR_TOP = 299 / 999;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** A scale, or nothing at rest — an identity transform still costs a layer. */
const scaleOf = (s: number) => (Math.abs(s - 1) < 5e-4 ? "" : `scale(${s.toFixed(4)})`);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 1 across [a, b] of `v`, eased at both ends. */
const ramp = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Scroll (in screens) → a frame, along a script of knots. */
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
}

/**
 * One frame sequence painted into one canvas. The playhead is fractional:
 * between two decoded frames it cross-fades them, so footage sampled at
 * 12 fps still glides under a slow thumb.
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
    // Blend only while the film glides: in a fast flick (over half a frame
    // per refresh) the cross-fade can't be seen, and the second frame would
    // be one more fresh image to hand the GPU in the same refresh.
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
 * revive copy after its hide on a fast flick (the desktop's stray-callout
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

/* ------------------------------------------------------------ director -- */

/**
 * The phone home page, driven by native scrolling. Chapters are tall
 * sections with sticky full-screen stages; each tick reads the scroll
 * position once and:
 *  - plays the intro film with the page held, then lets it rest on the
 *    titled frame, like the desktop hero,
 *  - scrubs each film along its script (holds included) with an eased,
 *    cross-faded playhead,
 *  - dissolves the hero room into the craft plate around a rising chair,
 *  - slides each following chapter over the last like a sheet,
 *  - reveals copy and dots on the same frame windows the desktop uses,
 *  - keeps only the frames near the screen decoded, for phone memory.
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
  const cue = one("[data-m-cue]");
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
  const progress = one("[data-m-progress]");
  const heroStage = heroFrame?.parentElement;
  const craftStage = craftFrame?.parentElement;
  const craftDim = craftStage?.querySelector<HTMLElement>("[data-m-dim]");
  const roomsDim = roomsStage?.querySelector<HTMLElement>("[data-m-dim]");
  if (
    !hero || !heroFrame || !heroStage || !video || !rest || !furnishCanvas || !title || !cue || !skip ||
    !craft || !craftFrame || !craftStage || !craftDim || !plate || !wordmark || !chairBox || !chairCanvas ||
    !rooms || !roomsStage || !roomsFrame || !roomsDim || !roomsCanvas || !finale || !header || !progress
  ) {
    return null;
  }

  const furnish = new Film(FILMS.furnish, furnishCanvas, "cover", false, { keep: 10, stride: 24 });
  const chair = new Film(FILMS.chair, chairCanvas, "contain", true, { keep: 8, stride: 8, concurrency: 3 });
  const roomsFilm = new Film(FILMS.rooms, roomsCanvas, "cover", false, { keep: 8, stride: 20 });
  const furnishScript = new Script(FURNISH_SCRIPT);
  const craftScript = new Script(CRAFT_SCRIPT);
  const roomsScript = new Script(ROOMS_SCRIPT);

  const sceneEls = all("[data-m-scene]");
  const dots = all("[data-m-dots]").map((el) => all("[data-m-dot]", el));
  const assembled = all("[data-m-assembled]"); // eyebrow, wordmark, beauty
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
    cue: new Group([cue], {
      from: { autoAlpha: 0, y: 12 },
      to: { autoAlpha: 1, y: 0, duration: 1.1, ease: "power2.out" },
      out: { autoAlpha: 0, duration: 0.5 },
    }),
    notes: all("[data-m-note]").map(
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
  // garbage the collector would have to sweep mid-scroll.
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
  };
  const pageTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

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
   * a screen edge or below the always-visible box (a very short phone, a
   * long headline) sits that room out instead — its piece is still a swipe
   * away in the card.
   */
  const placeDots = () => {
    const w = roomsCanvas.clientWidth;
    dots.forEach((list, s) => {
      const scene = sceneEls[s];
      const top = scene?.querySelector<HTMLElement>("[data-m-copy='top']");
      const low = scene?.querySelector<HTMLElement>("[data-m-copy='low']");
      const ui = top?.offsetParent as HTMLElement | null;
      const copyBottom = top ? top.offsetTop + top.offsetHeight : 0;
      const lowTop = low ? low.offsetTop : Infinity;
      const visibleBottom = ui ? ui.offsetHeight : Infinity;
      for (const dot of list) {
        const p = roomsFilm.project(Number(dot.dataset.x), Number(dot.dataset.y));
        dot.style.left = `${p.x.toFixed(1)}px`;
        dot.style.top = `${p.y.toFixed(1)}px`;
        dot.hidden =
          p.y - 16 < copyBottom + 6 ||
          p.y + 16 > lowTop - 6 ||
          p.y > visibleBottom - 34 ||
          p.x < 18 ||
          p.x > w - 18;
      }
    });
  };

  /** Positions and canvas sizes — after anything that may move them. */
  const measure = () => {
    L.heroTop = pageTop(hero);
    L.craftTop = pageTop(craft);
    L.roomsTop = pageTop(rooms);
    L.finaleTop = pageTop(finale);
    L.end = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    furnish.resize();
    chair.resize();
    roomsFilm.resize();
    placeDots();
    placeWordmark();
  };

  /**
   * Scroll runs, in px of the screen height at layout time. Re-run only when
   * the width changes or the height changes a lot (rotation) — the toolbar
   * sliding in and out must not re-pace the page under the thumb.
   */
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
  let held = false;
  const block = (e: Event) => {
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  };
  const hold = (on: boolean) => {
    if (on === held) return;
    held = on;
    document.documentElement.style.overflow = on ? "hidden" : "";
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
    hold(false);
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
    hold(true);
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
    const y = window.scrollY;
    const vh = window.innerHeight;
    const V = L.V;
    const k = 1 - Math.exp(-dt * 11);

    /* 01–02 · the intro film rests; the weave plays under the thumb */
    const heroOff = y - L.heroTop;
    furnish.ease(intro.done ? furnishScript.frameAt(Math.max(0, heroOff) / V) : 0, k);
    const scrubbing = intro.done && heroOff > 4;
    G.title.set(intro.title && !scrubbing);
    opacity(furnishCanvas, intro.done ? ramp(2, 0.22 * V, heroOff) : 0);
    const furnished = intro.done && furnish.frame >= FURNISH_COPY_FRAME;
    G.furnish.set(furnished);
    G.heroScrim.set(furnished);
    G.cue.set(intro.done && y < 40);

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
    let lowCopy = false;
    for (let s = 0; s < ROOM_SCENES.length; s++) {
      const scene = ROOM_SCENES[s];
      const copyOn = landed && rf >= scene.copy[0] && rf <= scene.copy[1];
      G.scenes[s]?.set(copyOn);
      G.dots[s]?.set(landed && fp < 1 && rf >= scene.dots[0] && rf <= scene.dots[1]);
      if (copyOn) {
        anyCopy = true;
        if (scene.text.split) lowCopy = true;
      }
    }
    G.scrimTop.set(anyCopy);
    G.scrimBottom.set(lowCopy);
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

    /* chrome */
    const nextTone = finaleEdge < 34 || roomsEdge < 34 ? "dark" : plateIn > 0.5 ? "light" : "dark";
    if (nextTone !== tone) header.dataset.tone = tone = nextTone;
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
  // Sideways, the page is covered by a "turn your phone" card (CSS): hold
  // the layout as it was, so turning back finds the reader where they were.
  const sideways = window.matchMedia("(orientation: landscape) and (max-height: 600px) and (pointer: coarse)");
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (sideways.matches) return;
      if (window.innerWidth !== L.width || Math.abs(window.innerHeight - L.V) > 160) {
        // A real change of screen (a tablet turning, split view): re-pace
        // the page and keep the reader at the same point of the story.
        const at = window.scrollY / L.end;
        layout();
        if (at > 0) window.scrollTo(0, Math.round(at * L.end));
      } else {
        measure();
      }
    }, 150);
  };
  let destroyed = false;

  const restoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  // Instant, whatever the page's smooth-scroll CSS says.
  const html = document.documentElement;
  const behavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  html.style.scrollBehavior = behavior;
  layout();
  rest.src = INTRO.rest;
  skip.addEventListener("click", finishIntro);
  window.addEventListener(SKIP_INTRO_EVENT, finishIntro);
  root.addEventListener("click", onDotTap);
  window.addEventListener("resize", onResize);
  void document.fonts?.ready.then(() => !destroyed && measure());
  gsap.fromTo(
    all("[data-m-chrome]", header),
    { autoAlpha: 0, y: -10 },
    { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.3 },
  );
  skipIn.play();
  startIntro();
  gsap.ticker.add(tick);
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __mapleHome?: unknown }).__mapleHome = { L, intro, films: { furnish, chair, rooms: roomsFilm } };
  }

  return {
    destroy() {
      destroyed = true;
      gsap.ticker.remove(tick);
      window.clearTimeout(intro.timer);
      window.clearTimeout(resizeTimer);
      skip.removeEventListener("click", finishIntro);
      window.removeEventListener(SKIP_INTRO_EVENT, finishIntro);
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
      furnish.destroy();
      chair.destroy();
      roomsFilm.destroy();
      gsap.killTweensOf(root.querySelectorAll("*"));
    },
  };
}
