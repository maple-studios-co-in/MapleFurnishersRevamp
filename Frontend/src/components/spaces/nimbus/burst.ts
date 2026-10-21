"use client";

import { gsap } from "@/lib/motion";
import { PLATES, plateSrc, ROOMS, TALL_QUERY } from "./content";
import { cloudNoise } from "./noise";
import { NimbusRenderer } from "./renderer";
import { holdVeil } from "./veil";

/**
 * "Click to Enter" on the Nimbus scene of /spaces: cloud billows out of the
 * ring and rushes past the camera while the scene leans in toward it, until
 * the screen is white. Then the veil (veil.ts) is held and the Nimbus rooms
 * load behind it, opening from that same white.
 */
export function burstIntoNimbus(opts: {
  /** Screen uv of the ring's centre. */
  origin: readonly [number, number];
  /** Pushed toward the ring as the cloud comes. */
  scene?: HTMLElement | null;
  ring?: HTMLElement | null;
  navigate: () => void;
}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "9999",
    pointerEvents: "auto",
  });
  document.body.appendChild(canvas);

  // The film beneath must not move while the cloud comes.
  const block = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener("wheel", block, { capture: true, passive: false });
  window.addEventListener("touchmove", block, { capture: true, passive: false });
  window.addEventListener("keydown", block, { capture: true });

  // Cloud only (base 0): the plate shape never shows.
  const renderer = new NimbusRenderer(canvas, { transparent: true, plateAspect: PLATES.wide.width / PLATES.wide.height });
  const B = { cloud: 0.3, spread: 0, travel: 0, white: 0 };

  const tick = (time: number) =>
    renderer.render({
      time,
      base: 0,
      plateA: null,
      plateB: null,
      mix: 0,
      cam: [1, 0.5, 0.5, 0],
      streak: 0,
      cloud: B.cloud,
      spread: B.spread,
      clear: 0,
      travel: B.travel,
      cloudAt: opts.origin,
      white: B.white,
      skyDrift: 0,
      grade: 0,
    });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    holdVeil();
    gsap.ticker.remove(tick);
    window.removeEventListener("wheel", block, { capture: true });
    window.removeEventListener("touchmove", block, { capture: true });
    window.removeEventListener("keydown", block, { capture: true });
    renderer.destroy();
    canvas.remove();
    opts.navigate();
  };

  const tl = gsap.timeline({ onComplete: finish });
  if (renderer.ok) {
    renderer.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 1.25));
    gsap.ticker.add(tick);
    tl.to(B, { spread: 2.9, duration: 1.35, ease: "power2.in" }, 0)
      .to(B, { cloud: 1, duration: 1.1, ease: "power1.in" }, 0)
      .to(B, { travel: 1.5, duration: 1.6, ease: "power1.in" }, 0)
      .to(B, { white: 1, duration: 0.5, ease: "power2.in" }, 1.08);
  } else {
    // No WebGL: the white simply rises.
    canvas.style.background = "rgb(245 241 234)";
    tl.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.in" }, 0.25);
  }
  if (opts.ring) tl.to(opts.ring, { scale: 1.3, opacity: 0, duration: 0.75, ease: "power2.out" }, 0);
  if (opts.scene) {
    const r = opts.scene.getBoundingClientRect();
    const ox = opts.origin[0] * window.innerWidth - r.left;
    const oy = opts.origin[1] * window.innerHeight - r.top;
    tl.to(
      opts.scene,
      { scale: 1.16, filter: "blur(6px)", transformOrigin: `${ox}px ${oy}px`, duration: 1.55, ease: "power2.in" },
      0,
    );
  }
}

/**
 * Called when a visitor shows interest (hover, focus, an idle beat): builds
 * the cloud noise and starts the living room's first plates so the click
 * lands on a warm cache.
 */
export function warmNimbus() {
  cloudNoise();
  const set = window.matchMedia(TALL_QUERY).matches ? "tall" : "wide";
  for (const stage of [0, 1]) {
    void fetch(plateSrc(ROOMS[0], stage, set), { cache: "force-cache" }).catch(() => {});
  }
}
