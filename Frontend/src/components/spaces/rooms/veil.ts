/**
 * The cloud veil: a flat sheet of the clouds' whiteout colour that carries
 * a cloud transition across a route change.
 *
 * A page that leaves through cloud fills the screen with it, holds the veil,
 * then navigates. The veil lives on <body>, outside React, so it survives
 * the route change; the next page draws its own first frame in the same
 * colour beneath it and releases it, at once (a world's rooms, which open
 * from that whiteout) or with a fade (Spaces). Nothing is left hanging if
 * the next page never claims it.
 *
 * Its colour is the world's whiteout (CloudPalette in content.ts, also
 * WHITEOUT in the shader): Nimbus's pearl, Terra's warm sand.
 */

const VEIL_ID = "maple-cloud-veil";
const SAFETY_MS = 9000;

let safety = 0;

export function hasVeil() {
  return typeof document !== "undefined" && Boolean(document.getElementById(VEIL_ID));
}

/** Fills the screen with the veil, in CSS "r g b" (cssRgb of the world's whiteout). */
export function holdVeil(rgb: string) {
  let el = document.getElementById(VEIL_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = VEIL_ID;
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      zIndex: "10000",
      pointerEvents: "auto",
    });
    document.body.appendChild(el);
  }
  el.style.background = `rgb(${rgb})`;
  el.style.transition = "none";
  el.style.opacity = "1";
  window.clearTimeout(safety);
  safety = window.setTimeout(() => releaseVeil(700), SAFETY_MS);
}

export function releaseVeil(fadeMs = 0) {
  const el = document.getElementById(VEIL_ID);
  window.clearTimeout(safety);
  if (!el) return;
  if (!fadeMs) {
    el.remove();
    return;
  }
  el.style.pointerEvents = "none";
  el.style.transition = `opacity ${fadeMs}ms cubic-bezier(0.33, 0, 0.2, 1)`;
  // Let the transition see the starting opacity before changing it.
  void el.offsetWidth;
  el.style.opacity = "0";
  window.setTimeout(() => el.remove(), fadeMs + 60);
}
