"use client";

import { FILM, filmFrame } from "../content";
import { gsap, ScrollTrigger, SplitText } from "../motion/gsap-about";
import { FrameStore } from "./frames";

/** Window insets from the viewport edges, in CSS px. */
type Rect = { l: number; t: number; r: number; b: number };

export interface FilmDirector {
  /** Paused hero entrance: header, headline letters, the window drawn open. */
  entrance(): gsap.core.Timeline;
  /** Resolves when the first film frame is decoded (or on timeout). */
  whenReady(timeoutMs: number): Promise<void>;
  destroy(): void;
}

/**
 * Pacing, in viewport-heights of scroll per beat (the timeline runs one
 * second per viewport height, so these read directly as scroll distance).
 */
const PACE = {
  heroHold: 0.25,
  heroOpen: 1.7,
  chapter: 2.7,
  sheetIn: 1.1,
  read: 0.9,
};

const INK = "#741a14";
const LOADING_TONE = "#795c5b";

/**
 * Builds the desktop About film on the markup from FilmStage and the
 * section sheets, and returns its controls. Call inside a gsap.context so
 * every tween, split and trigger it creates is reverted with the page.
 */
export function createFilm(root: HTMLElement): FilmDirector | null {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const stage = $("[data-film-stage]");
  const layer = $("[data-film-layer]");
  const canvas = $<HTMLCanvasElement>("canvas[data-film-canvas]");
  const spacer = $("[data-film-spacer]");
  const hero = $("[data-film-hero]");
  const heroTitle = $("[data-film-hero-title]");
  const tagline = $("[data-film-tagline]");
  const taglineInner = $("[data-film-tagline-inner]");
  const progressBar = $("[data-film-progress]");
  const coordX = $("[data-film-x]");
  const coordY = $("[data-film-y]");
  const ctx2d = canvas?.getContext("2d", { alpha: true }) ?? null;
  if (!stage || !layer || !canvas || !spacer || !hero || !heroTitle || !ctx2d) return null;

  const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-film-chapter]"));
  const letter = $("[data-panel='letter']");
  const folder = $("[data-panel='folder']");
  const faq = $("[data-panel='faq']");
  const footer = $("[data-panel='footer']");
  const sheets = [letter, folder, faq, footer].filter((el): el is HTMLElement => Boolean(el));
  // The CSS parks sheets with translate3d(0, 100%, 0). GSAP would read
  // that into its cache as a px y offset and keep it under every yPercent
  // tween, leaving the sheets below the fold; hand it over explicitly.
  // Parked sheets also stay hidden: their top-edge shadow would otherwise
  // bleed up into the bottom of the film. Each is shown as its slide starts.
  gsap.set(sheets, { y: 0, yPercent: 100, visibility: "hidden" });
  const showSheet = (sheet: HTMLElement, at: number) => tl.set(sheet, { visibility: "visible" }, at);

  const store = new FrameStore(filmFrame, FILM.frames);

  // ------------------------------------------------------------------ layout
  const zero: Rect = { l: 0, t: 0, r: 0, b: 0 };
  const L = { vw: 1440, vh: 900, header: 78, hero: zero, full: zero, left: zero, right: zero };
  const S = { frame: 0, reveal: 0, win: { ...zero } };
  let total = 0;

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: "none", immediateRender: false },
  });

  const layout = () => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const u = Math.min(1, vw / 1440);
    // The Figma hero is 996 tall: scale its vertical rhythm to fit.
    const hk = Math.min(u, vh / 996);
    L.vw = vw;
    L.vh = vh;
    L.header = 78 * u;
    const heroTop = 410 * hk;
    // The window fills down to the tagline, but never deeper than the
    // Figma window's proportions (1392 × 510): tall screens get more film
    // instead of a thin strip.
    const heroHeight = Math.min(vh - heroTop - (58 * hk + 18), (vw - 48 * u) * (510 / 1392));
    const heroBottom = vh - heroTop - Math.max(120, heroHeight);
    L.hero = { l: 24 * u, r: 24 * u, t: heroTop, b: heroBottom };
    L.full = { l: 16, r: 16, t: L.header + 8, b: 16 };
    const column = 484 * u; // 64 margin + 372 copy + 48 gap
    L.left = { ...L.full, l: column };
    L.right = { ...L.full, r: column };

    stage.style.setProperty("--hero-title-top", `${150 * hk}px`);
    stage.style.setProperty("--hero-size", `${80 * hk}px`);
    stage.style.setProperty("--hero-stroke", `${2 * hk}px`);
    stage.style.setProperty("--tagline-top", `${vh - heroBottom + 16 * hk}px`);
    stage.style.setProperty("--copy-y", `${(L.full.t + vh - L.full.b) / 2}px`);
    if (total) spacer.style.height = `${Math.round((total + 1) * vh)}px`;

    // Sheets scale down to fit under the header on short screens. The
    // questions sheet keeps headroom for answers opening.
    for (const sheet of sheets) {
      const frame = sheet.firstElementChild as HTMLElement | null;
      if (!frame) continue;
      const need = frame.offsetHeight + (sheet === faq ? 170 : 0);
      const room = vh - L.header - 28;
      sheet.style.setProperty("--panel-scale", Math.min(1, room / Math.max(1, need)).toFixed(4));
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(vw * dpr);
    const h = Math.round(vh * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (tl.time() <= PACE.heroHold) Object.assign(S.win, L.hero);
    dirty = true;
  };

  // -------------------------------------------------------------------- draw
  let dirty = true;
  const requestDraw = () => {
    dirty = true;
  };

  const draw = () => {
    dirty = false;
    const dpr = canvas.width / Math.max(1, L.vw);
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    if (S.reveal <= 0.001) return;

    const x = S.win.l;
    const y = S.win.t;
    const w = L.vw - S.win.l - S.win.r;
    const h = L.vh - S.win.t - S.win.b;
    if (w < 2 || h < 2) return;

    const index = Math.max(0, Math.min(FILM.frames - 1, Math.round(S.frame)));
    store.setFocus(index);
    const img = store.get(index);

    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(x, y, w, h * S.reveal);
    ctx2d.clip();
    if (img) {
      // object-fit: cover inside the window.
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const s = Math.max(w / iw, h / ih);
      const sw = w / s;
      const sh = h / s;
      ctx2d.imageSmoothingQuality = "high";
      ctx2d.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
    } else {
      ctx2d.fillStyle = LOADING_TONE;
      ctx2d.fillRect(x, y, w, h);
    }
    ctx2d.restore();

    // While the window is being drawn open, an ink line leads the edge.
    if (S.reveal < 0.999) {
      ctx2d.fillStyle = INK;
      ctx2d.fillRect(x, y + h * S.reveal - 1, w, 2);
    }
  };

  let pointerX = 720;
  let pointerY = 450;
  let coordsDirty = false;
  const onPointer = (e: PointerEvent) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    coordsDirty = true;
  };

  const tick = () => {
    if (dirty) draw();
    if (coordsDirty && coordX && coordY) {
      coordsDirty = false;
      coordX.textContent = pointerX.toFixed(2);
      coordY.textContent = pointerY.toFixed(2);
    }
  };

  store.onLoad = (i) => {
    const current = Math.round(S.frame);
    if (i === current || !store.isLoaded(current)) requestDraw();
  };

  // ---------------------------------------------------------------- timeline
  const rectVars = (get: () => Rect) => ({
    l: () => get().l,
    t: () => get().t,
    r: () => get().r,
    b: () => get().b,
  });
  const moveWindow = (from: () => Rect, to: () => Rect, at: number, duration: number) =>
    tl.fromTo(S.win, rectVars(from), { ...rectVars(to), duration, ease: "mapleInOut" }, at);
  const runFrames = (a: number, b: number, at: number, duration: number) =>
    tl.fromTo(S, { frame: a }, { frame: b, duration }, at);

  // Hero: the window opens to the full frame while the atelier begins.
  let t = PACE.heroHold;
  runFrames(FILM.marks[0], FILM.marks[1], t, PACE.heroOpen);
  moveWindow(() => L.hero, () => L.full, t, PACE.heroOpen * 0.8);
  tl.fromTo(hero, { yPercent: 0, opacity: 1 }, { yPercent: -60, opacity: 0, duration: 0.8, ease: "power2.in" }, t);
  if (tagline) tl.fromTo(tagline, { opacity: 1 }, { opacity: 0, duration: 0.35 }, t);
  t += PACE.heroOpen;

  // Chapters: the window narrows to one side, the copy is written in on the
  // other, the film keeps running; then the copy leaves and the window opens.
  const C = PACE.chapter;
  chapters.forEach((chapter, i) => {
    const left = chapter.dataset.side !== "right";
    const narrow = left ? () => L.left : () => L.right;
    const dir = left ? -1 : 1;
    const inner = chapter.querySelector<HTMLElement>("[data-film-chapter-inner]");
    const label = chapter.querySelector<HTMLElement>("[data-film-label]");
    const title = chapter.querySelector<HTMLElement>("[data-film-title]");
    const body = chapter.querySelector<HTMLElement>("[data-film-body]");
    if (!inner || !label || !title || !body) return;
    const chars = SplitText.create(title, { type: "words,chars", charsClass: "film-char" }).chars;
    gsap.set([label, body, ...chars], { opacity: 0 });

    runFrames(FILM.marks[i + 1], FILM.marks[i + 2], t, C);
    moveWindow(() => L.full, narrow, t + 0.1, 0.65);
    tl.fromTo(label, { opacity: 0, x: dir * 22 }, { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" }, t + 0.45);
    tl.fromTo(
      chars,
      { opacity: 0, yPercent: 40 },
      { opacity: 1, yPercent: 0, duration: 0.4, ease: "power2.out", stagger: { amount: 0.45 } },
      t + 0.5,
    );
    tl.fromTo(body, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, t + 0.85);
    tl.fromTo(inner, { opacity: 1, x: 0 }, { opacity: 0, x: dir * 70, duration: 0.45, ease: "power2.in" }, t + C - 0.8);
    moveWindow(narrow, () => L.full, t + C - 0.65, 0.65);
    t += C;
  });

  // The letter: a dark sheet rises over the film, the card is set down on it.
  const marks: Array<{ el: HTMLElement; from: number }> = [];
  const letterCard = letter?.querySelector<HTMLElement>("[data-reveal='letter']") ?? null;
  tl.fromTo(layer, { yPercent: 0 }, { yPercent: -18, duration: PACE.sheetIn, ease: "power2.inOut" }, t);
  if (letter) {
    marks.push({ el: letter, from: t });
    showSheet(letter, t);
    tl.fromTo(letter, { yPercent: 100 }, { yPercent: 0, duration: PACE.sheetIn, ease: "mapleInOut" }, t);
    if (letterCard) {
      tl.fromTo(
        letterCard,
        { y: () => L.vh * 0.62, rotate: -3 },
        { y: 0, rotate: 0, duration: 1.0, ease: "power3.out" },
        t + 0.7,
      );
      tl.fromTo(
        Array.from(letterCard.children),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.1, ease: "power2.out" },
        t + 1.15,
      );
    }
    t += PACE.sheetIn + 1.0 + PACE.read;
  }

  // The project folder slides up; the letter is lifted away as it comes.
  if (folder) {
    marks.push({ el: folder, from: t });
    if (letterCard) {
      tl.fromTo(letterCard, { y: 0 }, { y: () => -L.vh * 0.55, duration: PACE.sheetIn, ease: "power2.inOut" }, t);
    }
    showSheet(folder, t);
    tl.fromTo(folder, { yPercent: 100 }, { yPercent: 0, duration: PACE.sheetIn, ease: "mapleInOut" }, t);
    const tab = folder.querySelector("[data-reveal='tab']");
    const heading = folder.querySelector("[data-reveal='lines']");
    const cards = folder.querySelectorAll("[data-reveal='card']");
    const cta = folder.querySelector("[data-magnetic]");
    if (tab) {
      tl.fromTo(
        tab,
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: "power2.out" },
        t + 0.75,
      );
    }
    if (heading) tl.fromTo(heading, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, t + 0.8);
    if (cards.length) {
      tl.fromTo(
        cards,
        { y: () => L.vh * 0.5 },
        { y: 0, duration: 0.85, stagger: 0.12, ease: "power3.out" },
        t + 0.85,
      );
    }
    if (cta) tl.fromTo(cta, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, t + 1.5);
    t += PACE.sheetIn + 0.9 + PACE.read;
  }

  // Questions: a second sheet; rules draw across as the questions arrive.
  if (faq) {
    marks.push({ el: faq, from: t });
    showSheet(faq, t);
    tl.fromTo(faq, { yPercent: 100 }, { yPercent: 0, duration: PACE.sheetIn, ease: "mapleInOut" }, t);
    const intro = faq.querySelectorAll("[data-reveal='fade'], [data-reveal='lines']");
    const rules = faq.querySelectorAll("[data-reveal='rule']");
    const questions = faq.querySelectorAll("[data-reveal='question']");
    tl.fromTo(intro, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.1, ease: "power2.out" }, t + 0.8);
    tl.fromTo(
      rules,
      { scaleX: 0, transformOrigin: "0% 50%" },
      { scaleX: 1, duration: 0.6, stagger: 0.07, ease: "power2.inOut" },
      t + 0.85,
    );
    tl.fromTo(questions, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: "power2.out" }, t + 0.9);
    t += PACE.sheetIn + 0.8 + 1.2;
  }

  // The footer: last sheet, with the wordmark sketched in hairline.
  if (footer) {
    marks.push({ el: footer, from: t });
    showSheet(footer, t);
    tl.fromTo(footer, { yPercent: 100 }, { yPercent: 0, duration: PACE.sheetIn, ease: "mapleInOut" }, t);
    const items = footer.querySelectorAll("[data-reveal]");
    tl.fromTo(items, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, t + 0.8);
    const paths = Array.from(footer.querySelectorAll<SVGPathElement>("[data-footer-mark] g path"));
    for (const p of paths) {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    }
    if (paths.length) {
      tl.fromTo(
        paths,
        { strokeDashoffset: (_i: number, p: SVGPathElement) => p.getTotalLength() },
        { strokeDashoffset: 0, duration: 1.3, stagger: 0.025, ease: "power1.inOut" },
        t + 0.7,
      );
    }
    t += PACE.sheetIn + 1.3 + 0.4;
  }
  total = t;
  tl.set({}, {}, total);

  // Only the sheet on top takes focus and clicks.
  const sheetWindows = marks.map((m, i) => ({
    el: m.el,
    from: m.from + 0.6,
    to: i + 1 < marks.length ? marks[i + 1].from + 0.7 : Infinity,
  }));
  const manageSheets = () => {
    const time = tl.time();
    for (const w of sheetWindows) {
      const active = time >= w.from && time < w.to;
      if (w.el.inert === active) w.el.inert = !active;
    }
  };
  tl.eventCallback("onUpdate", () => {
    requestDraw();
    manageSheets();
  });

  // ------------------------------------------------------------------ wiring
  layout();
  ScrollTrigger.addEventListener("refreshInit", layout);
  const trigger = ScrollTrigger.create({
    trigger: spacer,
    start: "top top",
    end: "bottom bottom",
    animation: tl,
    scrub: 0.6,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      if (progressBar) progressBar.style.transform = `scaleY(${self.progress})`;
    },
  });
  manageSheets();
  gsap.ticker.add(tick);
  window.addEventListener("pointermove", onPointer, { passive: true });

  return {
    entrance() {
      const enter = gsap.timeline({ paused: true });
      const headerItems = document.querySelectorAll<HTMLElement>("[data-paper-header] [data-intro-item]");
      if (headerItems.length) {
        gsap.set(headerItems, { opacity: 0, y: -16 });
        enter.to(headerItems, { opacity: 1, y: 0, duration: 1.2, stagger: 0.07, ease: "mapleOut" }, 0.2);
      }
      const chars = SplitText.create(heroTitle, { type: "words,chars", charsClass: "film-char" }).chars;
      gsap.set(chars, { opacity: 0, yPercent: 45 });
      enter.to(chars, { opacity: 1, yPercent: 0, duration: 1, stagger: 0.035, ease: "mapleOut" }, 0.1);
      S.reveal = 0;
      enter.to(S, { reveal: 1, duration: 1.5, ease: "mapleInOut", onUpdate: requestDraw }, 0.35);
      if (taglineInner) {
        gsap.set(taglineInner, { opacity: 0, y: 12 });
        enter.to(taglineInner, { opacity: 1, y: 0, duration: 1, ease: "mapleOut" }, 1.3);
      }
      return enter;
    },
    whenReady(timeoutMs) {
      return Promise.race([
        store.whenFirstReady(),
        new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
      ]);
    },
    destroy() {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onPointer);
      ScrollTrigger.removeEventListener("refreshInit", layout);
      trigger.kill();
      tl.kill();
      store.destroy();
      spacer.style.height = "";
      for (const sheet of sheets) sheet.inert = false;
    },
  };
}
