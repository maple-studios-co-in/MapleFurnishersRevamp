import { gsap } from "@/lib/motion";

export interface SceneScroller {
  /** The scene at rest (during a transition, the one it set out from). */
  readonly index: number;
  /** Play to a scene at the film's own pace. */
  goTo(index: number): void;
  /** Cut straight to a scene without motion, e.g. from a #hash on load. */
  jump(index: number): void;
  destroy(): void;
}

export interface SceneScrollerOptions {
  timeline: gsap.core.Timeline;
  /** Timeline time of each resting scene, ascending. */
  stops: number[];
  /** Timeline seconds per px of wheel or touch travel. */
  secondsPerPixel: () => number;
  initial?: number;
  /** A transition away from `from` has begun. */
  onLeave?: (from: number) => void;
  /** Came to rest on a scene. */
  onSettle?: (index: number) => void;
}

/** Timeline seconds played per real second when a transition runs itself. */
const PACE = 1.05;
/** Quiet time that ends a wheel gesture. */
const GESTURE_GAP_MS = 170;

/**
 * Drives a paused timeline from wheel, touch and keys. The page itself
 * never scrolls.
 *
 * Input scrubs the timeline directly, but only within reach of the scene
 * the gesture started on, so one gesture moves at most one scene. When
 * the gesture ends the film settles: pushed past a small threshold it
 * plays on to the next scene at its own pace, otherwise it eases back.
 * Momentum still arriving from a gesture that already turned the scene is
 * absorbed, so a flick on a trackpad can't skip the box or a world.
 * Reversing mid-transition hands the film straight back to the gesture.
 */
export function createSceneScroller(opts: SceneScrollerOptions): SceneScroller {
  const { timeline: tl, stops } = opts;
  const last = stops.length - 1;
  const clampIndex = (i: number) => Math.max(0, Math.min(last, i));

  let index = clampIndex(opts.initial ?? 0);
  const state = { time: stops[index] };
  let mode: "idle" | "drag" | "snap" = "idle";

  // Gesture
  let target = state.time;
  let winLo = 0;
  let winHi = 0;
  let gestureStart = 0;
  let startedAtRest = true;
  let lastDir = 0;

  // Transition
  let snap: gsap.core.Tween | null = null;
  let snapFrom = index;
  let snapTo = index;
  let snapDir = 0;

  let releaseTimer = 0;
  let lastWheel = 0;
  let absorbDir = 0;
  let touchY: number | null = null;

  const apply = () => {
    tl.time(state.time);
  };

  const settle = (i: number) => {
    index = i;
    mode = "idle";
    opts.onSettle?.(i);
  };

  const goTo = (to: number, fromDrag = false) => {
    to = clampIndex(to);
    snap?.kill();
    snap = null;
    window.clearTimeout(releaseTimer);
    const dest = stops[to];
    const distance = Math.abs(dest - state.time);
    if (distance < 1e-4) {
      state.time = target = dest;
      apply();
      settle(to);
      return;
    }
    if (to !== index) opts.onLeave?.(index);
    snapFrom = index;
    snapTo = to;
    snapDir = Math.sign(dest - state.time);
    mode = "snap";
    snap = gsap.to(state, {
      time: dest,
      duration: Math.min(4.2, Math.max(0.45, distance / PACE)),
      // A push carries on at speed; a key or a click starts from rest.
      ease: fromDrag ? "power1.out" : "sine.inOut",
      onUpdate: apply,
      onComplete: () => {
        snap = null;
        absorbDir = snapDir;
        target = dest;
        settle(to);
      },
    });
  };

  const release = () => {
    if (mode !== "drag") return;
    let to: number;
    const moved = target - gestureStart;
    const neighbour = clampIndex(index + Math.sign(moved));
    const span = Math.abs(stops[neighbour] - stops[index]) || 1;
    if (startedAtRest && Math.abs(moved) < Math.min(0.1, span * 0.04)) {
      to = index;
    } else if (lastDir > 0) {
      to = stops.findIndex((s) => s >= target - 1e-4);
      if (to < 0) to = last;
    } else {
      to = 0;
      for (let i = last; i >= 0; i--) {
        if (stops[i] <= target + 1e-4) {
          to = i;
          break;
        }
      }
    }
    goTo(to, true);
  };

  const push = (px: number, timed: boolean) => {
    const dir = Math.sign(px);
    if (!dir) return;
    if (mode === "snap") {
      // Momentum riding along with the transition: let it play.
      if (dir === snapDir) return;
      // The other way: the film is the gesture's again, between the two
      // scenes it was travelling between.
      snap?.kill();
      snap = null;
      mode = "drag";
      target = gestureStart = state.time;
      startedAtRest = false;
      winLo = Math.min(stops[snapFrom], stops[snapTo]);
      winHi = Math.max(stops[snapFrom], stops[snapTo]);
    } else if (mode === "idle") {
      mode = "drag";
      target = gestureStart = state.time;
      startedAtRest = true;
      winLo = stops[Math.max(0, index - 1)];
      winHi = stops[Math.min(last, index + 1)];
    }
    lastDir = dir;
    target = Math.max(winLo, Math.min(winHi, target + px * opts.secondsPerPixel()));
    window.clearTimeout(releaseTimer);
    if (timed) releaseTimer = window.setTimeout(release, GESTURE_GAP_MS);
  };

  const tick = (_time: number, deltaMs: number) => {
    if (mode !== "drag") return;
    const k = 1 - Math.exp(-(deltaMs / 1000) * 11);
    state.time += (target - state.time) * k;
    if (Math.abs(target - state.time) < 1e-4) state.time = target;
    apply();
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return; // pinch zoom
    let dy = e.deltaY;
    if (Math.abs(dy) < Math.abs(e.deltaX)) return; // sideways swipes stay the browser's
    e.preventDefault();
    if (e.deltaMode === 1) dy *= 40;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (mode !== "snap" && absorbDir) {
      if (Math.sign(dy) === absorbDir && gap < GESTURE_GAP_MS) return;
      absorbDir = 0;
    }
    push(dy, true);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    absorbDir = 0;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (touchY === null || e.touches.length !== 1) return;
    const y = e.touches[0].clientY;
    const dy = (touchY - y) * 1.5;
    touchY = y;
    if (e.cancelable) e.preventDefault();
    push(dy, false);
  };

  const onTouchEnd = () => {
    if (touchY === null) return;
    touchY = null;
    release();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return;
    const from = mode === "snap" ? snapTo : index;
    let to: number;
    switch (e.key) {
      case "ArrowDown":
      case "PageDown":
        to = from + 1;
        break;
      case "ArrowUp":
      case "PageUp":
        to = from - 1;
        break;
      case " ":
        to = e.shiftKey ? from - 1 : from + 1;
        break;
      case "Home":
        to = 0;
        break;
      case "End":
        to = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (clampIndex(to) !== from) goTo(to);
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
  window.addEventListener("keydown", onKey);
  gsap.ticker.add(tick);
  apply();

  return {
    get index() {
      return index;
    },
    goTo: (i) => goTo(i),
    jump(i) {
      snap?.kill();
      snap = null;
      window.clearTimeout(releaseTimer);
      const to = clampIndex(i);
      state.time = target = stops[to];
      apply();
      settle(to);
    },
    destroy() {
      snap?.kill();
      window.clearTimeout(releaseTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      gsap.ticker.remove(tick);
    },
  };
}
