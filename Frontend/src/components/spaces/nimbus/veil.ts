/**
 * The cloud veil: a flat sheet of the clouds' whiteout colour that carries
 * a cloud transition across a route change.
 *
 * A page that leaves through cloud fills the screen with it, holds the veil,
 * then navigates. The veil lives on <body>, outside React, so it survives
 * the route change; the next page draws its own first frame in the same
 * colour beneath it and releases it, at once (Nimbus, which opens from that
 * whiteout) or with a fade (Spaces). Nothing is left hanging if the next
 * page never claims it.
 */

/** #F5F1EA — must match WHITEOUT in shader.ts. */
export const VEIL_RGB = "245 241 234";

const VEIL_ID = "maple-cloud-veil";
const SAFETY_MS = 9000;

let safety = 0;

export function hasVeil() {
  return typeof document !== "undefined" && Boolean(document.getElementById(VEIL_ID));
}

export function holdVeil() {
  let el = document.getElementById(VEIL_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = VEIL_ID;
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      zIndex: "10000",
      background: `rgb(${VEIL_RGB})`,
      pointerEvents: "auto",
    });
    document.body.appendChild(el);
  }
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
