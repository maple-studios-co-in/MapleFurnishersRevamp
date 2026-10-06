"use client";

import { gsap, SplitText } from "@/lib/motion";
import { PortalRenderer } from "./portal";
import { createSceneScroller } from "./sceneScroller";

/** Resting scenes, in film order. "box" is frame 2: the landing with the white box drawn in. */
export const SCENES = ["landing", "box", "nimbus", "terra"] as const;

export interface SpacesFilm {
  /** Paused entrance for whichever scene the film opens on. */
  entrance(): gsap.core.Timeline;
  /** Resolves when the collection photos are decoded (or on timeout). */
  whenReady(timeoutMs: number): Promise<void>;
  destroy(): void;
}

/**
 * The white box in design px: frame 2's rectangle (centre 45.1 below the
 * middle of the 950 frame, 388 × 256), and the size it swells to before
 * it bursts, chosen so the headline and line it pushes apart keep their
 * 32px gaps and stay on screen.
 */
const BOX = { cy: 45.1, hx: 194.17, hy: 128.1 };
const SWELL = { cy: 79, hx: 387, hy: 255 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Builds the desktop Spaces film on SpacesStage's markup: one paused
 * timeline holding every transition, played by the scene scroller.
 *
 *  landing → box     the scroll cue lifts away, the headline and line part,
 *                    and an ink line draws the white box open between them
 *  box → nimbus      the box swells into a cushion, trembles and bursts into
 *                    a bank of cloud that clears onto Nimbus
 *  nimbus → terra    Terra slides in from the left across the whole page,
 *                    pushing Nimbus aside; the header turns light as it
 *                    passes beneath each item
 *
 * Call inside a gsap.context so every tween and split is reverted with it.
 */
export function createSpacesFilm(root: HTMLElement, opts: { initial?: number } = {}): SpacesFilm | null {
  const one = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector<T>(sel);
  const all = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const stage = one("[data-spaces-stage]");
  const landing = one("[data-scene='landing']");
  const nimbus = one("[data-scene='nimbus']");
  const terra = one("[data-scene='terra']");
  const terraTrack = one("[data-terra-track]");
  const canvas = one<HTMLCanvasElement>("canvas[data-portal]");
  const headline = one("[data-headline]");
  const sub = one("[data-sub]");
  if (!stage || !landing || !nimbus || !terra || !terraTrack || !canvas || !headline || !sub) return null;

  const landingBg = one("[data-landing-bg]");
  const cueGlyphs = all("[data-cue-glyph]");
  const cueMark = one("[data-cue-mark]");
  const cueBob = one("[data-cue-bob]");
  const fallback = one("[data-portal-fallback]");
  const terraShadow = one("[data-terra-shadow]");
  const nimbusDim = one("[data-nimbus-dim]");

  const worldParts = (scene: HTMLElement) => {
    const parts = {
      inner: one("[data-world-inner]", scene),
      title: one("[data-world-title]", scene),
      tagline: one("[data-world-tagline]", scene),
      photo: one("[data-world-photo]", scene),
      eyebrow: one("[data-world-eyebrow]", scene),
      body: one("[data-world-body]", scene),
      switchLink: one<HTMLAnchorElement>("[data-world-switch]", scene),
      ring: one("[data-enter-ring]", scene),
      enterText: one("[data-enter-text]", scene),
    };
    if (Object.values(parts).some((el) => !el)) return null;
    return { ...(parts as { [K in keyof typeof parts]: NonNullable<(typeof parts)[K]> }), depth: all("[data-depth]", scene) };
  };
  const N = worldParts(nimbus);
  const T = worldParts(terra);
  if (!N || !T) return null;

  // ------------------------------------------------------------------ splits
  const splitWord = (el: HTMLElement) => {
    const chars = SplitText.create(el, { type: "chars", charsClass: "spaces-char" }).chars as HTMLElement[];
    el.dataset.split = "";
    return chars;
  };
  const headChars = SplitText.create(headline, { type: "words,chars", charsClass: "spaces-char" }).chars as HTMLElement[];
  const nChars = splitWord(N.title);
  const tChars = splitWord(T.title);

  // ------------------------------------------------------------------ layout
  const L = { vw: 1440, vh: 950, s: 1 };
  /** Portal state, all 0–1: line drawn (w), opened (h), ink, swell… */
  const P = { w: 0, h: 0, ink: 0, grow: 0, bulge: 0, wobble: 0, burst: 0, cloud: 0, clear: 0, shadow: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let toneItems: Array<{ el: HTMLElement; x: number; dark: boolean }> = [];

  const renderer = new PortalRenderer(canvas);
  const gl = renderer.ok;

  // The crisp box renders at device resolution; once it bursts there are
  // no hard edges left, so the cloud renders at a fraction of it.
  let glScale = 0;
  const sharpScale = () => Math.min(window.devicePixelRatio || 1, 1.5);
  const setGlScale = (scale: number) => {
    if (scale === glScale) return;
    glScale = scale;
    renderer.resize(L.vw, L.vh, scale);
  };

  const layout = () => {
    L.vw = document.documentElement.clientWidth;
    L.vh = window.innerHeight;
    L.s = Math.min(L.vw / 1440, L.vh / 950);
    glScale = 0;
    setGlScale(sharpScale());
    toneItems = all("[data-paper-header] [data-tone-item]", document).map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + r.width / 2, dark: el.dataset.tone === "dark" };
    });
  };
  layout();

  const box = () => {
    const g = P.grow;
    return {
      cx: L.vw / 2,
      cy: L.vh / 2 + lerp(BOX.cy, SWELL.cy, g) * L.s,
      hx: lerp(BOX.hx, SWELL.hx, g) * L.s * P.w,
      hy: Math.max(0.5, lerp(BOX.hy, SWELL.hy, g) * L.s * P.h),
    };
  };

  // ---------------------------------------------------------------- timeline
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none", immediateRender: false } });
  const s = (n: number) => () => n * L.s;

  // Landing → box (frame 1 → frame 2).
  tl.fromTo(
    cueGlyphs,
    { opacity: 1, y: 0 },
    { opacity: 0, y: s(-10), duration: 0.42, ease: "power2.in", stagger: { each: 0.02, from: "center" } },
    0,
  );
  if (cueMark) tl.fromTo(cueMark, { opacity: 1, y: 0 }, { opacity: 0, y: s(22), duration: 0.5, ease: "power2.in" }, 0.04);
  tl.fromTo(headline, { y: 0 }, { y: s(-121), duration: 1.2, ease: "mapleInOut" }, 0.15);
  tl.fromTo(sub, { y: 0 }, { y: s(181.2), duration: 1.2, ease: "mapleInOut" }, 0.15);
  tl.fromTo(P, { ink: 0 }, { ink: 1, duration: 0.12 }, 0.32);
  tl.fromTo(P, { w: 0 }, { w: 1, duration: 0.62, ease: "power3.inOut" }, 0.32);
  tl.fromTo(P, { h: 0 }, { h: 1, duration: 0.72, ease: "mapleInOut" }, 0.88);
  tl.fromTo(P, { ink: 1 }, { ink: 0, duration: 0.5, ease: "power1.in" }, 1.12);
  tl.fromTo(P, { cloud: 0 }, { cloud: 0.16, duration: 0.6 }, 1.0);
  const BOX_AT = 1.7;

  // Box → Nimbus: swell, tremble, burst, clear.
  const G = BOX_AT;
  const GD = 1.3;
  tl.fromTo(P, { grow: 0, bulge: 0, shadow: 0 }, { grow: 1, bulge: 1, shadow: 1, duration: GD, ease: "power2.in" }, G);
  tl.fromTo(headline, { y: s(-121) }, { y: s(-245), duration: GD, ease: "power2.in" }, G);
  tl.fromTo(sub, { y: s(181.2) }, { y: s(372.6), duration: GD, ease: "power2.in" }, G);
  if (landingBg) tl.fromTo(landingBg, { scale: 1 }, { scale: 1.05, duration: GD, ease: "power1.in" }, G);
  tl.fromTo(P, { wobble: 0 }, { wobble: 1, duration: 0.5, ease: "power1.in" }, G + GD - 0.5);

  const B = G + GD;
  tl.fromTo(P, { wobble: 1 }, { wobble: 0, duration: 0.12 }, B);
  tl.fromTo(P, { burst: 0 }, { burst: 1, duration: 1.0, ease: "power2.out" }, B);
  tl.fromTo(P, { cloud: 0.16 }, { cloud: 1, duration: 0.45, ease: "power2.out" }, B);
  const blast = { scale: 1.16, opacity: 0, filter: "blur(10px)", duration: 0.42, ease: "power2.out" };
  tl.fromTo(headline, { y: s(-245), scale: 1, opacity: 1, filter: "blur(0px)" }, { ...blast, y: s(-330) }, B);
  tl.fromTo(sub, { y: s(372.6), scale: 1, opacity: 1, filter: "blur(0px)" }, { ...blast, y: s(450) }, B);
  if (landingBg) tl.fromTo(landingBg, { scale: 1.05 }, { scale: 1.22, duration: 0.7, ease: "power2.out" }, B);
  // The cloud covers the whole screen by now: swap the scenes beneath it.
  tl.set(nimbus, { visibility: "visible" }, B + 0.36);
  tl.set(landing, { visibility: "hidden" }, B + 0.42);

  const C = B + 0.5;
  tl.fromTo(P, { clear: 0 }, { clear: 1, duration: 1.6, ease: "power1.inOut" }, C);
  tl.fromTo(P, { cloud: 1 }, { cloud: 0, duration: 1.6, ease: "power1.in" }, C);

  const R = C + 0.2;
  tl.fromTo(
    nChars,
    { opacity: 0, yPercent: 20 },
    { opacity: 1, yPercent: 0, duration: 1.1, ease: "power3.out", stagger: 0.07 },
    R,
  );
  tl.fromTo(
    N.photo,
    { opacity: 0, y: s(80), scale: 0.92 },
    { opacity: 1, y: 0, scale: 1, duration: 1.3, ease: "mapleOut" },
    R + 0.1,
  );
  tl.fromTo(
    N.tagline,
    { opacity: 0, letterSpacing: "0.42em" },
    { opacity: 1, letterSpacing: "0.2em", duration: 1.2, ease: "power2.out" },
    R + 0.3,
  );
  tl.fromTo(N.ring, { "--draw": 0 }, { "--draw": 1, duration: 0.9, ease: "power2.inOut" }, R + 0.6);
  tl.fromTo(N.enterText, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, R + 0.95);
  tl.fromTo(
    [N.eyebrow, N.body],
    { opacity: 0, y: s(18) },
    { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.1 },
    R + 0.75,
  );
  tl.fromTo(N.switchLink, { opacity: 0, x: s(-14) }, { opacity: 1, x: 0, duration: 0.8, ease: "power2.out" }, R + 0.9);
  const NIMBUS_AT = R + 1.75;

  // Nimbus → Terra: the whole page slides in from the left.
  const TT = NIMBUS_AT;
  const TD = 1.55;
  // Shown a hair after the stop, so its edge shadow never rests on Nimbus.
  tl.set(terraTrack, { visibility: "visible" }, TT + 0.001);
  if (terraShadow) tl.fromTo(terraShadow, { opacity: 0 }, { opacity: 1, duration: 0.35 }, TT);
  tl.fromTo(terraTrack, { xPercent: -100 }, { xPercent: 0, duration: TD, ease: "mapleInOut" }, TT);
  tl.fromTo(T.inner, { xPercent: 42 }, { xPercent: 0, duration: TD, ease: "mapleInOut" }, TT);
  tl.fromTo(N.inner, { xPercent: 0 }, { xPercent: 24, duration: TD, ease: "mapleInOut" }, TT);
  if (nimbusDim) tl.fromTo(nimbusDim, { opacity: 0 }, { opacity: 0.55, duration: TD, ease: "mapleInOut" }, TT);
  tl.fromTo(
    tChars,
    { opacity: 0, xPercent: -60 },
    { opacity: 1, xPercent: 0, duration: 1.1, ease: "power3.out", stagger: { each: 0.06, from: "end" } },
    TT + 0.45,
  );
  tl.fromTo(
    T.photo,
    { x: () => -0.3 * L.vw, rotation: -9 },
    { x: 0, rotation: 0, duration: 1.5, ease: "mapleOut" },
    TT + 0.3,
  );
  tl.fromTo(
    T.tagline,
    { opacity: 0, letterSpacing: "0.42em" },
    { opacity: 1, letterSpacing: "0.2em", duration: 1.0, ease: "power2.out" },
    TT + 0.95,
  );
  tl.fromTo(T.ring, { "--draw": 0 }, { "--draw": 1, duration: 0.8, ease: "power2.inOut" }, TT + 1.1);
  tl.fromTo(T.enterText, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.out" }, TT + 1.35);
  tl.fromTo(
    [T.eyebrow, T.body],
    { opacity: 0, y: s(18) },
    { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: 0.1 },
    TT + 1.15,
  );
  tl.fromTo(T.switchLink, { opacity: 0, x: s(14) }, { opacity: 1, x: 0, duration: 0.7, ease: "power2.out" }, TT + 1.3);
  tl.set(nimbus, { visibility: "hidden" }, TT + TD);
  const TERRA_AT = TT + 2.1;
  tl.set({}, {}, TERRA_AT);

  const stops = [0, BOX_AT, NIMBUS_AT, TERRA_AT];

  // Pre-reveal states: what the worlds look like before the film reaches them.
  gsap.set(nChars, { opacity: 0, yPercent: 20 });
  gsap.set(N.photo, { opacity: 0, y: 80 * L.s, scale: 0.92 });
  gsap.set([N.tagline, T.tagline], { opacity: 0, letterSpacing: "0.42em" });
  gsap.set([N.ring, T.ring], { "--draw": 0 });
  gsap.set([N.enterText, T.enterText], { opacity: 0 });
  gsap.set([N.eyebrow, N.body], { opacity: 0, y: 18 * L.s });
  gsap.set(N.switchLink, { opacity: 0, x: -14 * L.s });
  gsap.set(terraTrack, { xPercent: -100 });
  if (terraShadow) gsap.set(terraShadow, { opacity: 0 });
  gsap.set(T.inner, { xPercent: 42 });
  gsap.set(tChars, { opacity: 0, xPercent: -60 });
  gsap.set(T.photo, { x: -0.3 * L.vw, rotation: -9 });
  gsap.set([T.eyebrow, T.body], { opacity: 0, y: 18 * L.s });
  gsap.set(T.switchLink, { opacity: 0, x: 14 * L.s });

  // ------------------------------------------------------------ scene state
  const sceneOf = (i: number) => (i <= 1 ? landing : i === 2 ? nimbus : terra);
  const setActive = (i: number | null) => {
    for (const el of [landing, nimbus, terra]) el.inert = i === null || sceneOf(i) !== el;
  };

  const cueLoop = cueBob
    ? gsap.to(cueBob, { y: s(7), duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true })
    : null;
  let enter: gsap.core.Timeline | null = null;
  let focusOnSettle: HTMLElement | null = null;

  const syncHash = (i: number) => {
    const hash = i === 2 ? "#nimbus" : i === 3 ? "#terra" : "";
    if (window.location.hash === hash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  };

  const scroller = createSceneScroller({
    timeline: tl,
    stops,
    secondsPerPixel: () => 1 / (0.8 * L.vh),
    initial: opts.initial,
    onLeave: () => {
      setActive(null);
      // A scroll during the opening lands it at once.
      if (enter && enter.progress() < 1) enter.progress(1);
      cueLoop?.pause();
    },
    onSettle: (i) => {
      setActive(i);
      syncHash(i);
      if (i === 0 && enter && enter.progress() >= 1) cueLoop?.play();
      if (focusOnSettle) {
        focusOnSettle.focus({ preventScroll: true });
        focusOnSettle = null;
      }
    },
  });

  // NEXT / PREVIOUS run the film; their hrefs stay real #hash links.
  const onSwitch = (e: MouseEvent) => {
    const link = e.currentTarget as HTMLAnchorElement;
    const to = link.dataset.worldSwitch === "terra" ? 3 : 2;
    e.preventDefault();
    const other = to === 3 ? T.switchLink : N.switchLink;
    focusOnSettle = e.detail === 0 ? other : null; // keyboard activation keeps focus in the page
    scroller.goTo(to);
  };
  N.switchLink.addEventListener("click", onSwitch);
  T.switchLink.addEventListener("click", onSwitch);

  const onHash = () => {
    const to = window.location.hash === "#terra" ? 3 : window.location.hash === "#nimbus" ? 2 : null;
    if (to !== null && to !== scroller.index) scroller.goTo(to);
  };
  window.addEventListener("hashchange", onHash);

  // ---------------------------------------------------------------- per frame
  let canvasOn = false;
  const showCanvas = (on: boolean) => {
    if (on === canvasOn) return;
    canvasOn = on;
    canvas.style.visibility = on ? "visible" : "hidden";
    if (!on) renderer.clear();
  };

  const drawFallback = () => {
    if (!fallback) return;
    const on = P.w > 0.0005 && P.clear < 0.9995;
    fallback.style.visibility = on ? "visible" : "hidden";
    if (!on) return;
    const b = box();
    const k = 1 + P.burst * 5;
    const w = b.hx * 2 * k * (1 + 0.085 * P.bulge);
    const h = b.hy * 2 * k * (1 + 0.12 * P.bulge);
    fallback.style.width = `${w}px`;
    fallback.style.height = `${h}px`;
    fallback.style.transform = `translate(${b.cx - w / 2}px, ${b.cy - h / 2}px)`;
    fallback.style.borderRadius = `${Math.min(w, h) * (0.21 * P.bulge + 0.5 * P.burst)}px`;
    fallback.style.boxShadow = P.ink > 0.01 ? `0 0 0 1.5px rgb(116 26 20 / ${P.ink})` : "none";
    fallback.style.opacity = String(1 - P.clear);
  };

  const tick = (time: number) => {
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;

    if (gl) {
      const on = P.w > 0.0005 && P.clear < 0.9995;
      showCanvas(on);
      if (on) {
        setGlScale(P.burst > 0.04 || P.clear > 0 ? 0.62 : sharpScale());
        renderer.render({
          time,
          ...box(),
          ink: P.ink,
          bulge: P.bulge,
          wobble: P.wobble,
          burst: P.burst,
          cloud: P.cloud,
          clear: P.clear,
          shadow: P.shadow,
          px: pointer.sx,
          py: pointer.sy,
        });
      }
    } else {
      drawFallback();
    }

    // Terra's leading edge, and the header items it has passed under.
    const edge = L.vw * (1 + Number(gsap.getProperty(terraTrack, "xPercent")) / 100);
    for (const item of toneItems) {
      const dark = edge > item.x;
      if (dark === item.dark) continue;
      item.dark = dark;
      if (dark) item.el.dataset.tone = "dark";
      else delete item.el.dataset.tone;
    }
  };
  gsap.ticker.add(tick);

  // Pointer: a little depth between the world titles and the pieces.
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const depthLayers = [...N.depth, ...T.depth].map((el) => ({
    k: Number(el.dataset.depth) || 0,
    x: gsap.quickTo(el, "x", { duration: 1.1, ease: "power3.out" }),
    y: gsap.quickTo(el, "y", { duration: 1.1, ease: "power3.out" }),
  }));
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / Math.max(1, L.vw)) * 2 - 1;
    pointer.y = (e.clientY / Math.max(1, L.vh)) * 2 - 1;
    for (const d of depthLayers) {
      d.x(-pointer.x * 16 * d.k * L.s);
      d.y(-pointer.y * 10 * d.k * L.s);
    }
  };
  if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      layout();
      const t = tl.time();
      tl.invalidate();
      tl.time(t + 1e-4, true);
      tl.time(t, true);
    }, 120);
  };
  window.addEventListener("resize", onResize);

  setActive(scroller.index);
  if (scroller.index !== 0) {
    scroller.jump(scroller.index);
  }
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __spacesFilm?: unknown }).__spacesFilm = { tl, scroller, stops, P };
  }

  return {
    entrance() {
      enter = gsap.timeline({ paused: true });
      const headerItems = document.querySelectorAll<HTMLElement>("[data-paper-header] [data-intro-item]");
      if (headerItems.length) {
        gsap.set(headerItems, { opacity: 0, y: -16 });
        enter.to(headerItems, { opacity: 1, y: 0, duration: 1.2, stagger: 0.07, ease: "mapleOut" }, 0.2);
      }
      if (scroller.index === 0) {
        gsap.set(headChars, { opacity: 0, yPercent: 45 });
        enter.to(headChars, { opacity: 1, yPercent: 0, duration: 1.1, stagger: 0.028, ease: "mapleOut" }, 0.15);
        enter.fromTo(sub, { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: 1.1, ease: "mapleOut" }, 0.8);
        enter.fromTo(
          cueGlyphs,
          { opacity: 0, yPercent: 60 },
          { opacity: 1, yPercent: 0, duration: 0.6, stagger: 0.045, ease: "power2.out" },
          1.25,
        );
        if (cueMark) {
          enter.fromTo(cueMark, { opacity: 0, yPercent: -18 }, { opacity: 1, yPercent: 0, duration: 0.9, ease: "mapleOut" }, 1.5);
        }
        enter.add(() => {
          if (scroller.index === 0) cueLoop?.play();
        }, 2.1);
      }
      root.dataset.entered = "";
      return enter;
    },

    whenReady(timeoutMs) {
      const imgs = [N.photo, T.photo]
        .map((el) => el.querySelector("img"))
        .filter((img): img is HTMLImageElement => Boolean(img));
      const decoded = Promise.all(
        imgs.map((img) =>
          (img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
          ).then(() => img.decode().catch(() => undefined)),
        ),
      ).then(() => undefined);
      return Promise.race([decoded, new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))]);
    },

    destroy() {
      gsap.ticker.remove(tick);
      scroller.destroy();
      cueLoop?.kill();
      tl.kill();
      renderer.destroy();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("hashchange", onHash);
      N.switchLink.removeEventListener("click", onSwitch);
      T.switchLink.removeEventListener("click", onSwitch);
      for (const item of toneItems) delete item.el.dataset.tone;
      for (const el of [landing, nimbus, terra]) el.inert = false;
      canvas.style.visibility = "";
      delete root.dataset.entered;
    },
  };
}
