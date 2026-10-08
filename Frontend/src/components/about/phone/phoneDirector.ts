"use client";

import { FrameBank } from "@/components/mobile/frames";
import { gsap, SplitText } from "../motion/gsap-about";

/** The phone cut of the About film: every 2nd frame of film-v1, at 1600 × 686. */
const PHONE_FILM = { path: "/media/about/film-m-v1", frames: 176, width: 1600, height: 686 } as const;

/** Where each part begins, in phone frames (film-v1's marks, halved): the hero, then the five chapters. */
const MARKS = [0, 29, 58, 87, 116, 145, 175] as const;

/**
 * Where the camera looks across the wide frame (a fraction of its width),
 * keyed by film-v1 frame: on the designer at her desk, then the drawing,
 * the plan, and the room taking shape on the table.
 */
const FOCUS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.47],
  [30, 0.55],
  [58, 0.58],
  [85, 0.55],
  [116, 0.55],
  [145, 0.38],
  [175, 0.38],
  [200, 0.52],
  [232, 0.35],
  [260, 0.45],
  [291, 0.45],
  [350, 0.45],
];

const INK = "#741a14";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

const focusAt = (filmFrame: number) => {
  let i = 0;
  while (i < FOCUS.length - 2 && filmFrame > FOCUS[i + 1][0]) i++;
  const [f0, c0] = FOCUS[i];
  const [f1, c1] = FOCUS[i + 1];
  return lerp(c0, c1, ease(clamp01((filmFrame - f0) / (f1 - f0))));
};

export interface PhoneFilmDirector {
  /** Paused opening: header, headline, asides, the film drawn open in its card. */
  entrance(): gsap.core.Timeline;
  /** Resolves when the first frame is decoded (or on timeout). */
  whenReady(timeoutMs: number): Promise<void>;
  destroy(): void;
}

/**
 * The About film on a phone. The page scrolls natively over one fixed
 * canvas; the director reads the scroll position each frame and:
 *  - opens the film out of its card under the headline to the full screen,
 *  - plays the footage part by part as each chapter's panel goes by,
 *  - keeps the camera on what matters in the wide frame (FOCUS).
 * Call inside a gsap.context.
 */
export function createPhoneFilm(root: HTMLElement): PhoneFilmDirector | null {
  const stage = root.querySelector<HTMLElement>("[data-phone-stage]");
  const canvas = root.querySelector<HTMLCanvasElement>("canvas[data-phone-canvas]");
  const card = root.querySelector<HTMLElement>("[data-phone-card]");
  const title = root.querySelector<HTMLElement>("[data-phone-title]");
  const notes = Array.from(root.querySelectorAll<HTMLElement>("[data-phone-note]"));
  const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-phone-chapter]"));
  const ctx = canvas?.getContext("2d", { alpha: true }) ?? null;
  if (!stage || !canvas || !card || !ctx || chapters.length < 5) return null;

  const bank = new FrameBank(PHONE_FILM.path, PHONE_FILM.frames, { keep: 10, stride: 10 });
  let firstReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => (firstReady = resolve));
  let dirty = true;
  bank.onLoad = () => {
    firstReady();
    dirty = true;
  };
  bank.start();

  // ------------------------------------------------------------------ layout
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const L = {
    vw: 1,
    vh: 1,
    /** The card's box in page coordinates. */
    card: { top: 0, bottom: 0, left: 12, right: 12 },
    /** Scroll positions that pin the film's part boundaries, and where the film ends. */
    knots: [] as number[],
    end: 0,
  };
  const pageTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

  const layout = () => {
    L.vw = document.documentElement.clientWidth;
    L.vh = window.innerHeight;
    const r = card.getBoundingClientRect();
    L.card = { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: L.vw - r.right };
    // A part reaches its first frame as its panel arrives (half a screen in).
    L.knots = [0, ...chapters.map((c) => pageTop(c) - L.vh * 0.5)];
    const last = chapters[chapters.length - 1];
    L.end = pageTop(last) + last.offsetHeight - L.vh;
    const w = Math.round(L.vw * dpr);
    const h = Math.round(L.vh * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    dirty = true;
  };
  layout();

  /** Film frame for a scroll position: each part spans the scroll between its knots. */
  const frameFor = (y: number) => {
    const k = L.knots;
    if (y >= L.end) return MARKS[MARKS.length - 1];
    for (let i = k.length - 1; i >= 0; i--) {
      if (y >= k[i]) {
        const to = i + 1 < k.length ? k[i + 1] : L.end;
        return lerp(MARKS[i], MARKS[i + 1], clamp01((y - k[i]) / Math.max(1, to - k[i])));
      }
    }
    return 0;
  };

  // -------------------------------------------------------------------- draw
  const S = { frame: 0, reveal: 0, lastY: -1, lastFrame: -1 };

  const draw = (y: number) => {
    const { vw: W, vh: H } = L;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (S.reveal <= 0.001) return;

    // The window: the card as it scrolls up, opening to the full screen by
    // the time its top reaches the top of the screen.
    const open = ease(clamp01(y / Math.max(1, L.card.top - 8)));
    const ct = L.card.top - y;
    const cb = L.card.bottom - y;
    const x0 = lerp(L.card.left, 0, open);
    const x1 = lerp(W - L.card.right, W, open);
    const y0 = lerp(ct, 0, open);
    const y1 = lerp(cb, H, open);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 2 || h < 2) return;

    const idx = Math.max(0, Math.min(PHONE_FILM.frames - 1, S.frame));
    bank.focus(idx);
    const img = bank.get(idx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h * S.reveal);
    ctx.clip();
    if (img) {
      const iw = PHONE_FILM.width;
      const ih = PHONE_FILM.height;
      const s = Math.max(w / iw, h / ih);
      const dw = iw * s;
      const dh = ih * s;
      const fx = focusAt(idx * 2);
      const x = Math.min(x0, Math.max(x0 + w - dw, x0 + w / 2 - fx * dw));
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, x, y0 + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#795c5b";
      ctx.fillRect(x0, y0, w, h);
    }
    ctx.restore();
    // While the card is drawn open, an ink line leads the edge.
    if (S.reveal < 0.999) {
      ctx.fillStyle = INK;
      ctx.fillRect(x0, y0 + h * S.reveal - 1, w, 2);
    }
  };

  let shown = true;
  const tick = (_t: number, dtMs: number) => {
    const y = window.scrollY;
    // Past the last chapter the letter covers the stage: stop painting it.
    const on = y < L.end + L.vh;
    if (on !== shown) {
      shown = on;
      stage.style.visibility = on ? "visible" : "hidden";
    }
    if (!on) return;
    const target = frameFor(y);
    const k = 1 - Math.exp(-(dtMs / 1000) * 9);
    S.frame += (target - S.frame) * k;
    if (Math.abs(target - S.frame) < 0.02) S.frame = target;
    const frame = Math.round(S.frame);
    if (dirty || y !== S.lastY || frame !== S.lastFrame) {
      dirty = false;
      S.lastY = y;
      S.lastFrame = frame;
      draw(y);
    }
  };
  gsap.ticker.add(tick);

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 120);
  };
  window.addEventListener("resize", onResize);
  // Fonts and images settling can move the chapters: measure again once.
  const settle = window.setTimeout(layout, 1200);

  return {
    entrance() {
      const enter = gsap.timeline({ paused: true });
      const headerItems = document.querySelectorAll<HTMLElement>("[data-paper-header] [data-intro-item]");
      if (headerItems.length) {
        gsap.set(headerItems, { opacity: 0, y: -12 });
        enter.to(headerItems, { opacity: 1, y: 0, duration: 1.1, stagger: 0.06, ease: "mapleOut" }, 0.15);
      }
      if (title) {
        const chars = SplitText.create(title, { type: "words,chars", charsClass: "film-char" }).chars;
        gsap.set(chars, { opacity: 0, yPercent: 45 });
        enter.to(chars, { opacity: 1, yPercent: 0, duration: 1, stagger: 0.03, ease: "mapleOut" }, 0.1);
      }
      if (notes.length) {
        enter.fromTo(
          notes,
          { clipPath: "inset(-20% 100% -20% 0%)" },
          { clipPath: "inset(-20% 0% -20% 0%)", duration: 1, stagger: 0.25, ease: "mapleDraw" },
          0.7,
        );
      }
      S.reveal = 0;
      enter.to(S, { reveal: 1, duration: 1.4, ease: "mapleInOut", onUpdate: () => (dirty = true) }, 0.4);
      return enter;
    },
    whenReady(timeoutMs) {
      return Promise.race([ready, new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))]);
    },
    destroy() {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(settle);
      bank.destroy();
      stage.style.visibility = "";
    },
  };
}
