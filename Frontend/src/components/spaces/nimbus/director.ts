"use client";

import { gsap, ScrollTrigger, SplitText } from "@/lib/motion";
import { PLATE, plateSrc, ROOMS } from "./content";
import { PlateBank } from "./plates";
import { NimbusRenderer, type NimbusFrame } from "./renderer";
import { holdVeil } from "./veil";

export interface NimbusFilm {
  /** Lays the film out and draws its first frame (the whiteout) at once. */
  drawNow(): void;
  /** Resolves once the room in view has its first plates on the GPU (or on timeout). */
  whenReady(timeoutMs: number): Promise<void>;
  /** Paused arrival: the cloud clears onto the room. */
  entrance(): gsap.core.Timeline;
  destroy(): void;
}

export interface NimbusFilmOptions {
  /** Scrolls the page (through Lenis) to a px offset. */
  scrollTo: (y: number, opts?: { duration?: number; immediate?: boolean; easing?: (t: number) => number }) => void;
  /** Client-side navigation, used when leaving through the cloud veil. */
  navigate: (href: string) => void;
}

/**
 * Pacing in timeline seconds; the page scrolls VH_PER_SECOND viewport
 * heights per second, so each beat also reads as scroll distance.
 */
const PACE = {
  /** The room's name holds over the empty room… */
  titleHold: 0.6,
  /** …then lifts away as the first piece begins to gather. */
  titleOut: 1.0,
  /** Each piece of furniture: it forms (FORM of the step), then holds. */
  step: 1.25,
  /**
   * On a touch screen a piece is a swipe: it forms with the camera settled
   * on it (TOUCH_FORM of the step), then the camera moves on to the next
   * piece in the pause after (TOUCH_PAN).
   */
  touchStep: 1.6,
  /** The finished room, with its copy. */
  styledHold: 1.25,
  /** Out through the window, through the cloud, into the next room. */
  cross: 2.9,
  finaleHold: 1.5,
} as const;
const FORM = 0.74;
const TOUCH_FORM = 0.58;
const TOUCH_PAN = 0.6;
const VH_PER_SECOND = 0.72;
/** Inside a cross: the moment the cloud is a whiteout and the rooms change beneath it. */
const SWAP = 1.5;
/** Cloud reach that covers any screen from any origin. */
const SPREAD = 2.7;
/** Camera scale: arriving, room-wide, pushed in once furnished, through the window. */
const CAM = { arrive: 1.0, start: 1.05, end: 1.15, exit: 1.9 } as const;
const CENTRE = [0.5, 0.46] as const;

/**
 * The playhead eases after the scroll instead of being bolted to it: it
 * takes SMOOTH seconds to settle, and over short distances it never runs
 * faster than MAX_RATE timeline-seconds per second, so a piece always takes
 * the best part of a second to form however hard the wheel is flicked.
 * Far jumps (End, a long drag of the scrollbar) catch up faster.
 */
const SMOOTH = 0.55;
const MAX_RATE = 1.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Critically damped follow with a speed limit (after Unity's SmoothDamp). */
function smoothDamp(current: number, target: number, velocity: number, maxSpeed: number, dt: number) {
  const omega = 2 / SMOOTH;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * SMOOTH;
  const change = clamp(current - target, -maxChange, maxChange);
  const to = current - change;
  const temp = (velocity + omega * change) * dt;
  let vel = (velocity - omega * temp) * decay;
  let out = to + (change + temp) * decay;
  // Never overshoot the scroll.
  if (target - current > 0 === out > target) {
    out = target;
    vel = 0;
  }
  return [out, vel] as const;
}

/** Catmull–Rom through a room's look-at points, so the camera glides on without stopping at each. */
function along(points: ReadonlyArray<readonly [number, number]>, u: number): [number, number] {
  const n = points.length - 1;
  const i = clamp(Math.floor(u), 0, n - 1);
  const t = clamp(u - i, 0, 1);
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/**
 * Builds the Nimbus film on NimbusStage's markup.
 *
 *  room      the name forms, then each piece gathers out of mist and
 *            resolves as the camera glides through the room; on a portrait
 *            phone the camera walks from piece to piece
 *  cross     the camera pushes out through the window, cloud streams in
 *            from it and rushes past, the next room's name forms in the
 *            whiteout, and the cloud parts from the middle onto the next
 *            room (after the bedroom: onto the sky, and the finale)
 *
 * One paused timeline, played by a damped playhead that follows the page's
 * scroll. A gesture that stops inside a cross is carried through it. The
 * rail and #hash jump between rooms through a cloud of their own.
 *
 * Call inside a gsap.context so every tween, split and trigger is
 * reverted with it.
 */
export function createNimbusFilm(root: HTMLElement, opts: NimbusFilmOptions): NimbusFilm | null {
  const one = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector<T>(sel);
  const all = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const stage = one("[data-nimbus-stage]");
  const canvas = one<HTMLCanvasElement>("canvas[data-nimbus-canvas]");
  const spacer = one("[data-nimbus-spacer]");
  const finaleRoot = one("[data-finale]");
  const rail = one("[data-rail]");
  const cue = one("[data-cue]");
  const cueInner = one("[data-cue-inner]");
  if (!stage || !canvas || !spacer || !finaleRoot || !rail || !cue || !cueInner) return null;

  const parts = ROOMS.map((_, r) => {
    const title = one(`[data-room-title='${r}']`);
    const caption = one(`[data-caption='${r}']`);
    const copy = one(`[data-copy='${r}']`);
    if (!title || !caption || !copy) return null;
    const inner = one("[data-title-inner]", title);
    const name = one("[data-title-name]", title);
    const kicker = one("[data-title-kicker]", title);
    const line = one("[data-title-line]", title);
    const fill = one("[data-caption-fill]", caption);
    const steps = all("[data-step]", caption);
    if (!inner || !name || !kicker || !line || !fill || steps.length !== 5) return null;
    return { title, inner, name, kicker, line, caption, fill, steps, copy };
  });
  if (parts.some((p) => !p)) return null;
  const P = parts as NonNullable<(typeof parts)[number]>[];

  const finale = {
    title: one("[data-finale-title]", finaleRoot),
    tagline: one("[data-finale-tagline]", finaleRoot),
    body: one("[data-finale-body]", finaleRoot),
    ctas: one("[data-finale-ctas]", finaleRoot),
  };
  if (!finale.title || !finale.tagline || !finale.body || !finale.ctas) return null;
  const F = finale as { [K in keyof typeof finale]: HTMLElement };

  const renderer = new NimbusRenderer(canvas, { plateAspect: PLATE.width / PLATE.height });
  if (!renderer.ok) {
    renderer.destroy();
    return null;
  }
  const bank = new PlateBank(
    renderer,
    ROOMS.map((room) => room.stages.map((_, s) => plateSrc(room, s))),
  );
  // Phones start with the first two rooms on the GPU (see syncChrome).
  if (window.matchMedia("(pointer: coarse)").matches) bank.keepRooms([0, 1]);

  // ------------------------------------------------------------------ splits
  const nameChars = P.map(
    (p) => SplitText.create(p.name, { type: "words,chars", charsClass: "nimbus-char" }).chars as HTMLElement[],
  );
  const finaleChars = SplitText.create(F.title, { type: "chars", charsClass: "nimbus-char" }).chars as HTMLElement[];
  F.title.dataset.split = "";

  // ------------------------------------------------------------------ layout
  const L = { vw: 1, vh: 1, cw: 1, ch: 1, aspect: 1, u: 1, pxPerSecond: 1, spacerVh: 0, spacerVw: 0 };
  let total = 0;
  let dirty = true;
  const markDirty = () => {
    dirty = true;
  };
  const s = (n: number) => () => n * L.u;
  /** Touch screens: phones and tablets. */
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const STEP = coarse ? PACE.touchStep : PACE.step;
  /** Timeline seconds a piece takes to form. */
  const FORMING = STEP * (coarse ? TOUCH_FORM : FORM);
  const ROOM = PACE.titleHold + 5 * STEP + PACE.styledHold;
  /** Frame-rate governor: drops below 1 if the device can't keep up (see tick). */
  let quality = 1;
  /** Set once the film is built; from then on a resize redraws at once (see sizeCanvas). */
  let built = false;

  const sizeCanvas = () => {
    // No more pixels than the plates can fill (1672 × 941: past ~1.25 device
    // px per plate px the canvas only upsamples them), under a fill-rate
    // ceiling, times the governor's scale. A 3× phone draws about a quarter
    // of its native pixels, which the cloud never misses.
    const detail = 1.25 * Math.min(PLATE.width / L.cw, PLATE.height / L.ch);
    let ratio = clamp(detail, 0.75, Math.min(window.devicePixelRatio || 1, 2)) * quality;
    const MAX_PIXELS = 3.2e6;
    if (L.cw * L.ch * ratio * ratio > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / (L.cw * L.ch));
    renderer.resize(L.cw, L.ch, ratio);
    dirty = true;
    // Resizing clears the canvas (to black: it is opaque). Draw again in the
    // same task, so a resize or a governor step never shows an empty frame.
    if (built) draw(gsap.ticker.time);
  };

  /** Sizes the canvas; true if the scroll length (and so ScrollTrigger) needs refreshing. */
  const layout = () => {
    L.vw = stage.clientWidth || window.innerWidth;
    L.vh = stage.clientHeight || window.innerHeight;
    // The canvas spans the large viewport (CSS), so the frame holds still
    // while a phone's toolbar slides in and out over it.
    L.cw = canvas.clientWidth || L.vw;
    L.ch = canvas.clientHeight || L.vh;
    L.aspect = L.cw / Math.max(1, L.ch);
    L.u = Math.min(L.vw / 1440, L.vh / 900);
    sizeCanvas();
    // A phone's toolbar sliding away shouldn't re-measure the whole film.
    const vh = window.innerHeight;
    if (!total || (L.spacerVw === L.vw && Math.abs(vh - L.spacerVh) <= 120)) return false;
    L.spacerVw = L.vw;
    L.spacerVh = vh;
    L.pxPerSecond = VH_PER_SECOND * vh;
    spacer.style.height = `${Math.round(total * L.pxPerSecond + vh)}px`;
    return true;
  };

  // -------------------------------------------------------------- the state
  /** What the scroll timeline drives. */
  const S = {
    room: 0,
    base: 1,
    stage: 0,
    scale: CAM.start,
    /** Position along the room's look-at points (0 = the empty room … 5 = styled). */
    path: 0,
    /** 0 while in a room, 1 once the camera has turned to the window to leave. */
    lock: 0,
    warp: 0,
    streak: 0,
    cloud: 0,
    spread: 0,
    clear: 0,
    travel: 0,
    atWindow: 0,
    white: 0,
  };
  /** Cloud of its own, outside the scroll: the arrival, and rail jumps. Opens in full whiteout. */
  const E = {
    cloud: 1,
    spread: SPREAD,
    clear: 0,
    travel: 0,
    white: 1,
    zoom: 0.955,
    warp: 0.22,
    streak: 0.45,
    atX: CENTRE[0] as number,
    atY: CENTRE[1] as number,
  };

  // ---------------------------------------------------------------- timeline
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none", immediateRender: false } });
  const roomStarts: number[] = [];
  const crosses: number[] = [];
  /** [start, end] of each piece forming, for the touch assist. */
  const forms: Array<[number, number]> = [];
  let finaleAt = 0;
  let t = 0;
  let travel = 0;

  tl.fromTo(cue, { opacity: 1 }, { opacity: 0, duration: 0.35 }, 0.04);

  ROOMS.forEach((room, r) => {
    const R = t;
    roomStarts.push(R);
    const p = P[r];
    const last = r === ROOMS.length - 1;

    // The block, not its full-screen wrapper, takes the blur: a phone would
    // otherwise filter a whole screen of transparent layer every frame.
    tl.fromTo(
      p.inner,
      { opacity: 1, y: 0, filter: "blur(0px)" },
      { opacity: 0, y: s(-46), filter: "blur(10px)", duration: PACE.titleOut, ease: "power2.inOut" },
      R + PACE.titleHold,
    );

    tl.fromTo(S, { scale: CAM.start }, { scale: CAM.end, duration: ROOM, ease: "sine.inOut" }, R);
    const first = R + PACE.titleHold;
    if (coarse) {
      // Touch: the camera settles on each piece for the whole of its forming
      // (a phone sees a third of the room, so it must be in view), then
      // pans on to the next in the pause between them.
      for (let k = 1; k <= 5; k++) {
        const at = first + (k - 1) * STEP;
        tl.fromTo(S, { path: k - 1 }, { path: k, duration: TOUCH_PAN, ease: "sine.inOut" }, at - TOUCH_PAN);
      }
    } else {
      // Desktop: the camera glides through the room's look-at points without
      // stopping, leading the furniture so it reaches each piece just as the
      // mist begins to gather there.
      const lead = first - STEP + 0.3;
      const pathAt = Math.max(0, lead);
      const pathFrom = (pathAt - lead) / STEP;
      tl.fromTo(S, { path: pathFrom }, { path: 5, duration: (5 - pathFrom) * STEP }, pathAt);
    }

    tl.fromTo(p.caption, { opacity: 0, y: s(14) }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, first - 0.3);
    tl.fromTo(p.fill, { scaleX: 0 }, { scaleX: 1, duration: 5 * STEP }, first);
    for (let k = 1; k <= 5; k++) {
      const at = first + (k - 1) * STEP;
      // The piece forms over most of its step, then holds to be looked at.
      tl.fromTo(S, { stage: k - 1 }, { stage: k, duration: FORMING }, at);
      forms.push([at, at + FORMING]);
      const step = p.steps[k - 1];
      // One label at a time, each settling in out of a soft blur.
      tl.fromTo(
        step,
        { opacity: 0, yPercent: 45, filter: "blur(6px)" },
        { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 0.55, ease: "power2.out" },
        at + 0.1,
      );
      if (k < 5) {
        tl.fromTo(
          step,
          { opacity: 1, yPercent: 0, filter: "blur(0px)" },
          { opacity: 0, yPercent: -45, filter: "blur(6px)", duration: 0.36, ease: "power2.in" },
          at + STEP - 0.38,
        );
      }
    }
    const styled = first + 5 * STEP;
    tl.fromTo(p.caption, { opacity: 1, y: 0 }, { opacity: 0, y: s(-10), duration: 0.4, ease: "power2.in" }, styled - 0.35);
    tl.fromTo(
      p.copy,
      { opacity: 0, y: s(18), filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, ease: "power2.out" },
      styled + 0.15,
    );

    // Out through the window and into the cloud.
    const X = R + ROOM;
    crosses.push(X);
    tl.fromTo(p.copy, { opacity: 1, y: 0 }, { opacity: 0, y: s(-12), duration: 0.5, ease: "power2.in" }, X - 0.45);
    tl.set(S, { atWindow: 1 }, X);
    tl.fromTo(S, { scale: CAM.end }, { scale: CAM.exit, duration: SWAP - 0.05, ease: "power2.in" }, X);
    tl.fromTo(S, { lock: 0 }, { lock: 1, duration: SWAP - 0.2, ease: "power1.inOut" }, X);
    tl.fromTo(S, { warp: 0 }, { warp: 0.38, duration: SWAP - 0.05, ease: "power2.in" }, X);
    tl.fromTo(S, { streak: 0 }, { streak: 0.85, duration: SWAP - 0.45, ease: "power2.in" }, X + 0.45);
    tl.fromTo(S, { spread: 0 }, { spread: SPREAD, duration: SWAP - 0.2, ease: "power2.in" }, X + 0.05);
    tl.fromTo(S, { cloud: 0 }, { cloud: 1, duration: SWAP - 0.4, ease: "power2.in" }, X + 0.2);
    tl.fromTo(S, { travel }, { travel: travel + 2.0, duration: PACE.cross }, X);
    travel += 2.0;
    tl.fromTo(S, { white: 0 }, { white: 1, duration: 0.43, ease: "power1.in" }, X + SWAP - 0.45);

    // Under the whiteout the next room, or the sky, takes the screen.
    const W = X + SWAP;
    const after = PACE.cross - SWAP;
    const next = last ? null : ROOMS[r + 1];
    if (next) {
      tl.set(
        S,
        { room: r + 1, stage: 0, path: 0, scale: CAM.arrive, lock: 0, warp: 0.24, streak: 0.55, atWindow: 0 },
        W,
      );
      tl.fromTo(S, { streak: 0.55 }, { streak: 0, duration: 1.0, ease: "power2.out" }, W);
      tl.fromTo(S, { warp: 0.24 }, { warp: 0, duration: after, ease: "power2.out" }, W);
      tl.fromTo(S, { scale: CAM.arrive }, { scale: CAM.start, duration: after, ease: "power2.out" }, W);
      // The next room's name forms inside the cloud, and waits there as it parts.
      tl.fromTo(
        P[r + 1].inner,
        { opacity: 0, y: s(34), filter: "blur(12px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power2.out" },
        X + SWAP - 0.5,
      );
    } else {
      tl.set(S, { base: 2, warp: 0, streak: 0, atWindow: 0 }, W);
      finaleAt = W;
      tl.fromTo(
        F.tagline,
        { opacity: 0, letterSpacing: "0.5em" },
        { opacity: 1, letterSpacing: "0.22em", duration: 1.0, ease: "power2.out" },
        W + 0.3,
      );
      tl.fromTo(
        finaleChars,
        { opacity: 0, yPercent: 28 },
        { opacity: 1, yPercent: 0, duration: 1.0, stagger: 0.07, ease: "power3.out" },
        W + 0.45,
      );
      tl.fromTo(F.body, { opacity: 0, y: s(16) }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, W + 0.95);
      tl.fromTo(F.ctas, { opacity: 0, y: s(16) }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, W + 1.1);
    }
    tl.fromTo(S, { white: 1 }, { white: 0, duration: 0.6, ease: "power1.out" }, W + 0.05);
    tl.fromTo(S, { clear: 0 }, { clear: 1, duration: after - 0.05, ease: "power1.inOut" }, W + 0.05);
    tl.fromTo(S, { cloud: 1 }, { cloud: 0, duration: after - 0.15, ease: "power1.in" }, W + 0.15);
    tl.set(S, { spread: 0, clear: 0 }, X + PACE.cross);
    t = X + PACE.cross;
  });
  total = t + PACE.finaleHold;
  tl.set({}, {}, total);

  // Before the film reaches them. The opening room's name waits for the
  // entrance to write it in (it must not sit on the whiteout before that).
  gsap.set(P.map((p) => p.title), { opacity: 1 });
  gsap.set(P.slice(1).map((p) => p.inner), { opacity: 0 });
  gsap.set([...nameChars[0], P[0].kicker, P[0].line], { opacity: 0 });
  gsap.set(P.map((p) => p.caption), { opacity: 0 });
  gsap.set(P.flatMap((p) => p.steps), { opacity: 0 });
  gsap.set(P.map((p) => p.fill), { scaleX: 0 });
  gsap.set(P.map((p) => p.copy), { opacity: 0 });
  gsap.set(finaleRoot, { opacity: 1 });
  gsap.set([F.tagline, F.body, F.ctas], { opacity: 0 });
  gsap.set(finaleChars, { opacity: 0 });
  gsap.set(cue, { opacity: 1 });
  gsap.set(cueInner, { opacity: 0 });
  gsap.set(rail, { opacity: 0 });
  finaleRoot.inert = true;

  /** Which room the screen shows at a time (−1: the finale). */
  const roomAt = (time: number) => {
    if (finaleAt && time >= finaleAt) return -1;
    let r = 0;
    for (let i = 1; i < roomStarts.length; i++) if (time >= roomStarts[i] - (PACE.cross - SWAP)) r = i;
    return r;
  };

  // ------------------------------------------------------------------ wiring
  L.spacerVw = -1;
  layout();
  let lastU = L.u;
  const ro = new ResizeObserver(() => {
    const longer = layout();
    // Overlay offsets are in design px (s()): re-read them at the new size.
    if (Math.abs(L.u - lastU) > 0.01) {
      lastU = L.u;
      const now = tl.time();
      tl.invalidate();
      tl.time(now + 1e-4, true);
      tl.time(now, true);
    }
    if (longer) ScrollTrigger.refresh();
  });
  ro.observe(stage);

  /** The playhead: where the scroll is (target) and where the film is (time). */
  const play = { target: 0, time: 0, vel: 0 };
  /** Which way the visitor last scrolled (1 on, −1 back). */
  let heading = 1;
  const trigger = ScrollTrigger.create({
    trigger: spacer,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      play.target = self.progress * total;
      heading = self.direction;
      queueAssist(self.direction);
    },
    onRefresh: (self) => {
      play.target = self.progress * total;
    },
  });

  /** Moves the film toward the scroll; false once it has caught up. */
  const advance = (dt: number) => {
    const gap = play.target - play.time;
    if (Math.abs(gap) < 1e-4 && Math.abs(play.vel) < 1e-3) {
      if (gap !== 0) {
        play.time = play.target;
        tl.time(clamp(play.time, 0, total));
      }
      play.vel = 0;
      return false;
    }
    const rate = MAX_RATE + Math.max(0, Math.abs(gap) - 2.5) * 0.9;
    [play.time, play.vel] = smoothDamp(play.time, play.target, play.vel, rate, dt);
    tl.time(clamp(play.time, 0, total));
    return true;
  };

  const spacerTop = () => spacer.getBoundingClientRect().top + window.scrollY;
  const yAt = (time: number) => Math.round(spacerTop() + time * L.pxPerSecond);
  /** Puts the film straight onto the scroll position (after a jump). */
  const snapPlayhead = () => {
    ScrollTrigger.update();
    play.target = trigger.progress * total;
    play.time = play.target;
    play.vel = 0;
    tl.time(clamp(play.time, 0, total));
    dirty = true;
  };

  // A gesture that stops inside a cross is carried through it, in the
  // direction it was going. On a touch screen, where a swipe is the natural
  // unit, a swipe that stops while a piece is still forming finishes it too.
  // Nothing moves while a finger is down, and a new touch stops a carry.
  let busy = false;
  let assistTimer = 0;
  let touching = false;
  let carryUntil = 0;
  /** Dev-only switch (see __nimbusFilm), so a capture can hold a frame mid-cross. */
  const dev = { assist: true };
  const carry = (now: number, dest: number, perSecond: number, base: number, max: number) => {
    const duration = Math.min(max, base + Math.abs(dest - now) * perSecond);
    carryUntil = performance.now() + duration * 1000;
    opts.scrollTo(yAt(dest), { duration, easing: easeInOut });
  };
  const queueAssist = (dir: number) => {
    window.clearTimeout(assistTimer);
    if (busy || touching || !dev.assist) return;
    assistTimer = window.setTimeout(() => {
      if (touching) return;
      const now = trigger.progress * total;
      for (const X of crosses) {
        const a = X;
        const b = X + PACE.cross;
        if (now <= a + 0.08 || now >= b - 0.08) continue;
        carry(now, dir < 0 ? a - 0.01 : b + 0.01, 0.5, 0.9, 2.6);
        return;
      }
      if (!coarse) return;
      for (const [a, b] of forms) {
        if (now <= a + 0.06 || now >= b - 0.06) continue;
        carry(now, dir < 0 ? a - 0.01 : b + 0.08, 0.8, 0.6, 1.6);
        return;
      }
    }, coarse ? 260 : 220);
  };
  const onTouchStart = () => {
    touching = true;
    window.clearTimeout(assistTimer);
    // A finger on the glass takes the page back from a carry in progress.
    if (performance.now() < carryUntil) {
      carryUntil = 0;
      opts.scrollTo(window.scrollY, { immediate: true });
    }
  };
  const onTouchEnd = () => {
    touching = false;
  };
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });

  // ------------------------------------------------------------ the cloud of its own
  let coverTl: gsap.core.Timeline | null = null;

  /** The flight out of the whiteout: the bank thins, then parts from the middle. */
  const arrival = (to: gsap.core.Timeline) => {
    to.to(E, { white: 0, duration: 1.2, ease: "power2.inOut" }, 0.1);
    to.to(E, { clear: 1, duration: 2.6, ease: "power2.inOut" }, 0.3);
    to.to(E, { cloud: 0, duration: 2.4, ease: "power1.in" }, 0.7);
    to.to(E, { travel: E.travel + 1.1, duration: 3.0, ease: "power2.out" }, 0);
    to.to(E, { zoom: 1, warp: 0, duration: 3.0, ease: "power3.out" }, 0);
    to.to(E, { streak: 0, duration: 1.6, ease: "power2.out" }, 0);
    to.set(E, { spread: 0, clear: 0 }, 3.1);
    return to;
  };

  /** Cloud streams in from `at` (screen uv) and rushes past until the screen is white. */
  const cover = (at: readonly [number, number] = CENTRE) =>
    new Promise<void>((resolve) => {
      coverTl?.kill();
      Object.assign(E, { atX: at[0], atY: at[1], clear: 0 });
      coverTl = gsap
        .timeline({ onUpdate: markDirty, onComplete: resolve })
        .fromTo(E, { spread: 0 }, { spread: SPREAD, duration: 1.1, ease: "power2.in" }, 0)
        .fromTo(E, { cloud: 0.35 }, { cloud: 1, duration: 1.0, ease: "power1.in" }, 0)
        .to(E, { travel: E.travel + 1.3, duration: 1.3, ease: "power1.in" }, 0)
        .to(E, { zoom: 1.22, warp: 0.3, streak: 0.6, duration: 1.2, ease: "power2.in" }, 0)
        .fromTo(E, { white: 0 }, { white: 1, duration: 0.45, ease: "power1.in" }, 0.85);
    });

  /** From a whiteout, the cloud parts onto whatever the scroll shows now. */
  const uncover = () =>
    new Promise<void>((resolve) => {
      coverTl?.kill();
      Object.assign(E, {
        atX: CENTRE[0],
        atY: CENTRE[1],
        spread: SPREAD,
        cloud: 1,
        white: 1,
        clear: 0,
        zoom: 0.955,
        warp: 0.22,
        streak: 0.45,
      });
      coverTl = arrival(gsap.timeline({ onUpdate: markDirty, onComplete: resolve }));
    });

  const jumpTo = async (r: number) => {
    if (busy) return;
    busy = true;
    window.clearTimeout(assistTimer);
    bank.prioritise(r);
    await cover();
    opts.scrollTo(yAt(roomStarts[r] + 0.02), { immediate: true });
    snapPlayhead();
    await Promise.race([bank.whenStages(r, [0, 1]), wait(2500)]);
    await uncover();
    busy = false;
  };

  // --------------------------------------------------------------- rail, hash
  const railItems = all<HTMLAnchorElement>("[data-rail-item]");
  const railFills = railItems.map((a) => one("[data-rail-fill]", a));
  const onRail = (e: MouseEvent) => {
    e.preventDefault();
    const r = Number((e.currentTarget as HTMLElement).dataset.railItem);
    if (Number.isFinite(r)) void jumpTo(r);
  };
  railItems.forEach((a) => a.addEventListener("click", onRail));

  let shown = -2;
  let kept = "0,1";
  const fills: number[] = [];
  const syncChrome = () => {
    const time = tl.time();
    const r = roomAt(time);
    if (r !== shown) {
      railItems.forEach((a, i) => {
        if (i === r) a.dataset.active = "";
        else delete a.dataset.active;
      });
      // Keep the address on the room in view (once the visitor has moved).
      if (shown !== -2 && r >= 0) {
        const hash = r === 0 ? "" : `#${ROOMS[r].id}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
        }
      }
      shown = r;
    }
    for (let i = 0; i < roomStarts.length; i++) {
      const v = clamp((time - roomStarts[i]) / (ROOM + PACE.cross - SWAP), 0, 1);
      if (Math.abs(v - (fills[i] ?? -1)) < 0.002) continue;
      fills[i] = v;
      const el = railFills[i];
      if (el) el.style.transform = `scaleY(${v})`;
    }
    const finaleLive = finaleAt > 0 && time >= finaleAt + 0.8;
    if (finaleRoot.inert === finaleLive) finaleRoot.inert = !finaleLive;
    // A phone holds two rooms on the GPU, the one in view and the next in the
    // direction of travel (12 plates, ~75 MB, never all 18).
    if (coarse) {
      const at = r < 0 ? ROOMS.length - 1 : r;
      const want = [at, at + (heading < 0 ? -1 : 1)].filter((i) => i >= 0 && i < ROOMS.length);
      const key = want.join(",");
      if (key !== kept) {
        kept = key;
        bank.keepRooms(want);
      }
    }
  };

  // ---------------------------------------------------- leaving through cloud
  const leaveLinks = all<HTMLAnchorElement>("[data-leave]");
  const onLeave = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.currentTarget as HTMLAnchorElement;
    e.preventDefault();
    if (busy) return;
    busy = true;
    const r = link.getBoundingClientRect();
    const at = [(r.left + r.width / 2) / L.vw, (r.top + r.height / 2) / L.vh] as const;
    void cover(at).then(() => {
      if (link.dataset.leave === "internal") {
        holdVeil();
        opts.navigate(link.getAttribute("href") ?? "/spaces");
      } else {
        window.location.assign(link.href);
      }
    });
  };
  leaveLinks.forEach((a) => a.addEventListener("click", onLeave));

  // Back from the catalogue through the browser's page cache: clear the cloud.
  const onPageShow = (e: PageTransitionEvent) => {
    if (!e.persisted) return;
    busy = false;
    void uncover();
  };
  window.addEventListener("pageshow", onPageShow);

  // ------------------------------------------------------------- per frame
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / Math.max(1, L.vw)) * 2 - 1;
    pointer.y = (e.clientY / Math.max(1, L.vh)) * 2 - 1;
  };
  if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });

  /** Where a plate point lands on screen through the camera (ignoring the edge warp). */
  const screenOf = (pt: readonly [number, number], scale: number, fx: number, fy: number): [number, number] => {
    const pa = PLATE.width / PLATE.height;
    const vx = L.aspect > pa ? 1 : L.aspect / pa;
    const vy = L.aspect > pa ? pa / L.aspect : 1;
    const cx = clamp(fx, vx / (2 * scale), 1 - vx / (2 * scale));
    const cy = clamp(fy, vy / (2 * scale), 1 - vy / (2 * scale));
    return [clamp(0.5 + ((pt[0] - cx) * scale) / vx, -0.2, 1.2), clamp(0.5 + ((pt[1] - cy) * scale) / vy, -0.2, 1.2)];
  };

  const focusPoints = ROOMS.map((room) => room.stages.map((st) => st.focus));

  const compose = (time: number): NimbusFrame => {
    const room = ROOMS[S.room];
    const k = clamp(Math.floor(S.stage), 0, 4);
    const mix = clamp(S.stage - k, 0, 1);
    const a = bank.get(S.room, k) ?? bank.nearest(S.room, k);
    const b = bank.get(S.room, k + 1) ?? a;
    const missing = S.base === 1 && !a;
    const scale = Math.max(1, S.scale * E.zoom);
    // The camera glides through the room's look-at points, and turns to the
    // window to leave. A portrait phone sees a third of the plate, so it
    // walks to each piece; a wide screen sees nearly all of it and only
    // drifts toward them.
    const [gx, gy] = along(focusPoints[S.room], S.path);
    const lx = gx + (room.window[0] - gx) * S.lock;
    const ly = gy + (room.window[1] - gy) * S.lock;
    // How far the camera follows its look-at points: almost all the way on a
    // portrait phone (a little held back, to soften the widest pans), only a
    // drift on a wide screen; fully once it turns to the window to leave.
    const wide = clamp((L.aspect - 0.9) / 0.6, 0, 1);
    const reach = 0.88 - 0.48 * wide;
    const follow = reach + (1 - reach) * S.lock;
    const fx = 0.5 + (lx - 0.5) * follow + (pointer.sx * 0.012) / scale;
    const fy = 0.5 + (ly - 0.5) * follow + (pointer.sy * 0.008) / scale;
    const own = E.cloud > S.cloud;
    const at = own ? ([E.atX, E.atY] as const) : S.atWindow > 0.5 ? screenOf(room.window, scale, fx, fy) : CENTRE;
    return {
      time,
      base: S.base,
      plateA: a,
      plateB: b,
      mix,
      cam: [scale, fx, fy, Math.max(S.warp, E.warp)],
      streak: Math.max(S.streak, E.streak),
      cloud: own ? E.cloud : S.cloud,
      spread: own ? E.spread : S.spread,
      clear: own ? E.clear : S.clear,
      travel: S.travel + E.travel,
      cloudAt: at,
      white: missing ? 1 : Math.max(S.white, E.white),
      skyDrift: time * 0.02,
      grade: 1,
    };
  };

  const draw = (time: number) => {
    dirty = false;
    renderer.render(compose(time));
  };

  // The governor watches the frame rate while the heavy passes run (cloud,
  // mist) and lowers the canvas resolution a step when a device can't hold
  // its pace; soft cloud hides the difference, a stutter would not.
  const pace = { frames: 0, ms: 0 };
  const govern = (deltaMs: number) => {
    pace.frames++;
    pace.ms += deltaMs;
    if (pace.frames < 45) return;
    const avg = pace.ms / pace.frames;
    pace.frames = 0;
    pace.ms = 0;
    if (avg > 26 && quality > 0.62) {
      quality = Math.max(0.62, quality * 0.85);
      sizeCanvas();
    }
  };

  const tick = (time: number, deltaMs: number) => {
    if (bank.pump()) {
      dirty = true;
      // An upload frame isn't the device's true pace: start the count again.
      pace.frames = 0;
      pace.ms = 0;
    }
    advance(Math.min(0.1, Math.max(0, deltaMs / 1000)));
    const dx = pointer.x - pointer.sx;
    const dy = pointer.y - pointer.sy;
    const drifting = Math.abs(dx) + Math.abs(dy) > 0.0004;
    if (drifting) {
      pointer.sx += dx * 0.05;
      pointer.sy += dy * 0.05;
    }
    // Cloud, sky and a piece caught mid-way (its mist drifts) move on their
    // own; everything else draws only on change.
    const forming = S.stage % 1 > 0.002 && S.stage % 1 < 0.998;
    const live = Math.max(S.cloud, E.cloud) > 0.001 || S.base === 2 || forming;
    if (dirty || drifting || live) draw(time);
    if (live && deltaMs > 0 && deltaMs < 250) govern(deltaMs);
    syncChrome();
  };
  gsap.ticker.add(tick);

  // Load the room in view first; and the next one before it is needed.
  let preloaded = 0;
  const onScrollLoad = () => {
    const r = roomAt(tl.time());
    const want = Math.min(ROOMS.length - 1, Math.max(0, r) + 1);
    if (want > preloaded) {
      preloaded = want;
      bank.prioritise(want);
    }
  };
  tl.eventCallback("onUpdate", () => {
    markDirty();
    onScrollLoad();
  });

  // Arriving at #dining or #bedroom: start there.
  const hashRoom = ROOMS.findIndex((room) => `#${room.id}` === window.location.hash);
  if (hashRoom > 0) {
    bank.prioritise(hashRoom);
    opts.scrollTo(yAt(roomStarts[hashRoom] + 0.02), { immediate: true });
    snapPlayhead();
  }

  built = true;

  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __nimbusFilm?: unknown }).__nimbusFilm = {
      tl,
      trigger,
      play,
      snap: snapPlayhead,
      S,
      E,
      total,
      roomStarts,
      crosses,
      bank,
      dev,
    };
  }

  return {
    drawNow() {
      layout();
      draw(gsap.ticker.time);
    },

    whenReady(timeoutMs) {
      const r = Math.max(0, roomAt(tl.time()));
      return Promise.race([bank.whenStages(r, [0, 1]), wait(timeoutMs)]);
    },

    entrance() {
      const enter = arrival(gsap.timeline({ paused: true, onUpdate: markDirty }));
      const headerItems = document.querySelectorAll<HTMLElement>("[data-paper-header] [data-intro-item]");
      if (headerItems.length) {
        gsap.set(headerItems, { opacity: 0, y: -16 });
        enter.to(headerItems, { opacity: 1, y: 0, duration: 1.2, stagger: 0.07, ease: "mapleOut" }, 1.0);
      }
      const r = Math.max(0, roomAt(tl.time()));
      const p = P[r];
      // Opening on another room (a #hash): the living room's name is simply there to return to.
      if (r !== 0) gsap.set([...nameChars[0], P[0].kicker, P[0].line], { opacity: 1 });
      gsap.set(nameChars[r], { opacity: 0, yPercent: 40 });
      gsap.set([p.kicker, p.line], { opacity: 0, y: 14 * L.u });
      enter.to(p.kicker, { opacity: 1, y: 0, duration: 1.0, ease: "mapleOut" }, 1.1);
      enter.to(nameChars[r], { opacity: 1, yPercent: 0, duration: 1.2, stagger: 0.035, ease: "mapleOut" }, 1.2);
      enter.to(p.line, { opacity: 1, y: 0, duration: 1.1, ease: "mapleOut" }, 1.7);
      enter.to(rail, { opacity: 1, duration: 1.0, ease: "power1.out" }, 2.0);
      enter.to(cueInner, { opacity: 1, duration: 0.9, ease: "power1.out" }, 2.5);
      return enter;
    },

    destroy() {
      gsap.ticker.remove(tick);
      window.clearTimeout(assistTimer);
      coverTl?.kill();
      ro.disconnect();
      trigger.kill();
      tl.kill();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      railItems.forEach((a) => a.removeEventListener("click", onRail));
      leaveLinks.forEach((a) => a.removeEventListener("click", onLeave));
      railItems.forEach((a) => delete a.dataset.active);
      bank.destroy();
      renderer.destroy();
      spacer.style.height = "";
      finaleRoot.inert = false;
      delete F.title.dataset.split;
    },
  };
}
