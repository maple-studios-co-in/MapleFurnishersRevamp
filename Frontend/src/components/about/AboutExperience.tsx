"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import MapleLogo from "@/components/ui/MapleLogo";
import { PAGE_ENTER_EVENT, transitionState } from "@/lib/page-transition";
import type { FilmDirector } from "./film/filmDirector";
import type { PhoneFilmDirector } from "./phone/phoneDirector";
import { gsap, ScrollTrigger, SplitText } from "./motion/gsap-about";
import styles from "./about.module.css";

/**
 * Motion director for /about.
 *
 *  film     desktop: one fixed stage, the three films scrubbed by scroll as
 *           a single sequence with the chapters written in beside it, then
 *           the letter, folder, questions and footer sheets (film/)
 *  stacked  phones: the page as stacked sections, films looping in view
 *  static   prefers-reduced-motion: everything in place, posters only
 *
 * A hard load opens with the intro sheet (wordmark drawn in, load counter,
 * then the sheet wipes away); arriving through the route curtain skips it.
 */
type Mode = "film" | "phone" | "stacked" | "static";

/** Must match the film-mode media query in about.module.css. */
const FILM_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
/** Phones with motion get the phone film (phone/); must match .phoneOnly. */
const PHONE_QUERY = "(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function AboutExperience({
  className,
  fontVars,
  children,
}: {
  className: string;
  fontVars: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  // Bumped when the viewport crosses the film/stacked boundary, which
  // tears the current mode down and builds the other.
  const [run, setRun] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia(FILM_QUERY);
    const flip = () => setRun((n) => n + 1);
    mq.addEventListener("change", flip);
    return () => mq.removeEventListener("change", flip);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const intro = introRef.current;
    if (!root || !intro) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const filmMode = window.matchMedia(FILM_QUERY).matches;
    const phoneMode = window.matchMedia(PHONE_QUERY).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const viaCurtain = transitionState.phase === "covering" || transitionState.phase === "covered";
    const withIntro = !reduce && !viaCurtain && run === 0;

    let disposed = false;
    const film: { current: FilmDirector | null } = { current: null };
    const phone: { current: PhoneFilmDirector | null } = { current: null };
    const cleanups: Array<() => void> = [];
    const ctx = gsap.context(() => {}, root);

    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => (markReady = resolve));
    transitionState.ready = ready;

    // ---- Intro sheet ------------------------------------------------------
    const progress = { p: 0 };
    const count = intro.querySelector<HTMLElement>("[data-intro-count]");
    const bar = intro.querySelector<HTMLElement>("[data-intro-bar]");
    const renderProgress = () => {
      if (count) count.textContent = String(Math.round(progress.p * 100)).padStart(3, "0");
      if (bar) bar.style.transform = `scaleX(${progress.p})`;
    };
    const introLead: { tl: gsap.core.Timeline | null } = { tl: null };

    if (!withIntro) {
      intro.style.display = "none";
    } else {
      intro.style.display = "";
      intro.classList.add(styles.introLive);
      ctx.add(() => {
        introLead.tl = gsap
          .timeline()
          .fromTo(
            intro.querySelector("[data-intro-mark]"),
            { clipPath: "inset(-10% 100% -10% 0%)" },
            { clipPath: "inset(-10% 0% -10% 0%)", duration: 1.4, ease: "mapleDraw" },
            0.15,
          )
          .fromTo(
            intro.querySelectorAll("[data-intro-fade]"),
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: "mapleOut" },
            0.2,
          )
          .to(progress, { p: 0.82, duration: 1.5, ease: "power2.out", onUpdate: renderProgress }, 0);
      });
    }
    // Never leave the sheet over the page.
    const failsafe = window.setTimeout(() => {
      if (intro.style.display !== "none") gsap.to(intro, { autoAlpha: 0, duration: 0.4 });
    }, 10000);

    // ---- Staging ----------------------------------------------------------
    void (async () => {
      if (reduce) {
        root.dataset.mode = "static";
        markReady();
        return;
      }

      // Splits and the film layout must measure the final faces.
      await Promise.race([document.fonts.ready, wait(2500)]);
      if (disposed) return;

      let mode: Mode = "stacked";
      if (filmMode) {
        try {
          const { createFilm } = await import("./film/filmDirector");
          if (disposed) return;
          ctx.add(() => {
            film.current = createFilm(root);
          });
          if (film.current) mode = "film";
        } catch (error) {
          console.warn("About: film unavailable, showing the stacked page.", error);
        }
      } else if (phoneMode) {
        try {
          const { createPhoneFilm } = await import("./phone/phoneDirector");
          if (disposed) return;
          ctx.add(() => {
            phone.current = createPhoneFilm(root);
          });
          if (phone.current) mode = "phone";
        } catch (error) {
          console.warn("About: phone film unavailable, showing the stacked page.", error);
        }
      }
      if (disposed) return;
      root.dataset.mode = mode;

      let enter: gsap.core.Timeline = gsap.timeline({ paused: true });
      ctx.add(() => {
        if (mode === "film" && film.current) {
          enter = film.current.entrance();
        } else if (mode === "phone" && phone.current) {
          enter = phone.current.entrance();
          // The letter, folder, questions and footer reveal as they arrive.
          buildScrollReveals(root, "[data-stacked-only]");
        } else {
          buildScrollReveals(root);
          enter = buildEntrance(root);
        }
      });
      if (mode === "stacked") cleanups.push(playVideosInView(root));
      if (finePointer) cleanups.push(...magnetic(root));
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __mapleAbout?: unknown }).__mapleAbout = { mode, film: film.current, phone: phone.current };
      }
      ScrollTrigger.refresh();

      if (!withIntro) {
        const play = () => enter.play();
        if (viaCurtain && transitionState.phase !== "revealing") {
          window.addEventListener(PAGE_ENTER_EVENT, play, { once: true });
          cleanups.push(() => window.removeEventListener(PAGE_ENTER_EVENT, play));
        } else {
          play();
        }
        markReady();
        return;
      }
      markReady();

      // Hold the sheet until the opening frame can actually be shown.
      const heroPoster = root.querySelector<HTMLImageElement>("[data-media-hero] img");
      await Promise.all([
        film.current
          ? film.current.whenReady(2600)
          : phone.current
            ? phone.current.whenReady(2600)
            : imageReady(heroPoster, 2600),
        introLead.tl ? introLead.tl.then(() => undefined) : Promise.resolve(),
      ]);
      if (disposed) return;

      ctx.add(() => {
        gsap
          .timeline()
          .to(progress, { p: 1, duration: 0.5, ease: "power2.inOut", onUpdate: renderProgress })
          .to(
            intro.querySelectorAll("[data-intro-fade], [data-intro-mark]"),
            { y: -16, opacity: 0, duration: 0.55, stagger: 0.04, ease: "power3.in" },
            "+=0.12",
          )
          .fromTo(
            intro,
            { clipPath: "inset(0% 0% 0% 0%)" },
            { clipPath: "inset(0% 0% 100% 0%)", duration: 1.25, ease: "mapleInOut" },
            "-=0.2",
          )
          .add(() => {
            enter.play();
          }, "-=0.85")
          .set(intro, { display: "none" });
      });
    })();

    return () => {
      disposed = true;
      window.clearTimeout(failsafe);
      cleanups.forEach((fn) => fn());
      film.current?.destroy();
      film.current = null;
      phone.current?.destroy();
      phone.current = null;
      ctx.revert();
      if (transitionState.ready === ready) transitionState.ready = null;
      delete root.dataset.mode;
    };
  }, [run]);

  return (
    <>
      <div ref={introRef} className={`${styles.intro} ${fontVars}`} aria-hidden="true">
        <div className={styles.introCenter}>
          <div className={styles.introMark} data-intro-mark>
            <MapleLogo idPrefix="maple-intro-logo" />
          </div>
          <div className={styles.introRule} data-intro-fade>
            <span data-intro-bar />
          </div>
        </div>
        <p className={`${styles.introMeta} ${styles.introCaption}`} data-intro-fade>
          Furniture with intention
        </p>
        <p className={`${styles.introMeta} ${styles.introCount}`} data-intro-fade data-intro-count>
          000
        </p>
      </div>
      <div ref={rootRef} className={className} data-about-page>
        {children}
      </div>
    </>
  );
}

// ==========================================================================
// Stacked page (phones): scroll-triggered reveals and in-view video
// ==========================================================================

/** Reveal one artwork slot: a wipe up the frame while the film settles in. */
function revealMedia(slot: HTMLElement, vars: gsap.TimelineVars = {}) {
  const tl = gsap.timeline(vars);
  const inner = slot.querySelector<HTMLElement>("[data-media-inner]");
  tl.fromTo(
    slot,
    { clipPath: "inset(100% 0% 0% 0%)" },
    { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "mapleInOut" },
    0,
  );
  if (inner) tl.fromTo(inner, { scale: 1.3 }, { scale: 1, duration: 2.2, ease: "mapleOut" }, 0);
  return tl;
}

function buildEntrance(root: HTMLElement) {
  const tl = gsap.timeline({ paused: true });

  const headerItems = document.querySelectorAll<HTMLElement>("[data-paper-header] [data-intro-item]");
  if (headerItems.length) {
    gsap.set(headerItems, { opacity: 0, y: -16 });
    tl.to(headerItems, { opacity: 1, y: 0, duration: 1.2, stagger: 0.07, ease: "mapleOut" }, 0.2);
  }

  const title = root.querySelector<HTMLElement>('[data-reveal="hero"]');
  if (title) {
    const split = SplitText.create(title, { type: "lines", mask: "lines", linesClass: "about-line" });
    gsap.set(split.lines, { yPercent: 120 });
    tl.to(split.lines, { yPercent: 0, duration: 1.7, stagger: 0.14, ease: "mapleOut" }, 0);
  }

  const heroSlot = root.querySelector<HTMLElement>("[data-media-hero]");
  if (heroSlot) tl.add(revealMedia(heroSlot), 0.35);

  const tagline = root.querySelector<HTMLElement>("[data-hero-tagline]");
  if (tagline) {
    gsap.set(tagline, { opacity: 0, y: 14 });
    tl.to(tagline, { opacity: 1, y: 0, duration: 1.2, ease: "mapleOut" }, 1.3);
  }
  return tl;
}

function buildScrollReveals(root: HTMLElement, skip?: string) {
  const pick = <T extends Element = HTMLElement>(sel: string) =>
    Array.from(root.querySelectorAll<T>(sel)).filter((el) => !skip || !el.closest(skip));
  const once = (trigger: Element, start: string): ScrollTrigger.Vars => ({ trigger, start, once: true });

  pick<HTMLElement>('[data-reveal="lines"]').forEach((el) => {
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "about-line",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 120,
          duration: 1.45,
          stagger: 0.1,
          ease: "mapleOut",
          scrollTrigger: once(el, "top 86%"),
        }),
    });
  });

  pick<HTMLElement>('[data-reveal="text"]').forEach((el) => {
    SplitText.create(el, {
      type: "lines",
      linesClass: "about-text-line",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          opacity: 0,
          yPercent: 70,
          duration: 1.25,
          stagger: 0.07,
          delay: 0.15,
          ease: "mapleOut",
          scrollTrigger: once(el, "top 90%"),
        }),
    });
  });

  pick<HTMLElement>('[data-reveal="write"]').forEach((el) => {
    SplitText.create(el, {
      type: "lines",
      linesClass: "about-ink-line",
      autoSplit: true,
      onSplit: (self) =>
        gsap.fromTo(
          self.lines,
          { clipPath: "inset(-40% 100% -40% 0%)" },
          {
            clipPath: "inset(-40% 0% -40% 0%)",
            duration: 1.15,
            stagger: 0.45,
            ease: "mapleDraw",
            scrollTrigger: once(el, "top 90%"),
          },
        ),
    });
  });

  pick<HTMLElement>('[data-reveal="fade"]').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 26, duration: 1.15, ease: "mapleOut", scrollTrigger: once(el, "top 92%") });
  });

  pick<HTMLElement>('[data-reveal="tab"]').forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: "inset(100% 0% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "mapleInOut", scrollTrigger: once(el, "top 90%") },
    );
  });

  pick<HTMLElement>('[data-reveal="letter"]').forEach((el) => {
    gsap.from(el, { y: 150, rotate: -2.4, opacity: 0, duration: 1.7, ease: "mapleOut", scrollTrigger: once(el, "top 92%") });
  });

  pick<HTMLElement>('[data-reveal-group="cards"]').forEach((group) => {
    gsap.from(group.querySelectorAll('[data-reveal="card"]'), {
      y: 110,
      rotate: 1.4,
      opacity: 0,
      duration: 1.35,
      stagger: 0.13,
      ease: "mapleOut",
      scrollTrigger: once(group, "top 86%"),
    });
  });

  const faqList = pick<HTMLElement>("[data-reveal-group='faq']")[0];
  if (faqList) {
    gsap.from(faqList.querySelectorAll('[data-reveal="rule"]'), {
      scaleX: 0,
      transformOrigin: "0% 50%",
      duration: 1.5,
      stagger: 0.09,
      ease: "mapleInOut",
      scrollTrigger: once(faqList, "top 86%"),
    });
    gsap.from(faqList.querySelectorAll("[data-reveal='question']"), {
      opacity: 0,
      y: 18,
      duration: 1.1,
      stagger: 0.09,
      delay: 0.25,
      ease: "mapleOut",
      scrollTrigger: once(faqList, "top 86%"),
    });
  }

  pick<HTMLElement>("[data-media]").forEach((slot) => {
    if (slot.hasAttribute("data-media-hero")) return; // part of the entrance
    revealMedia(slot, { scrollTrigger: once(slot, "top 82%") });
    const inner = slot.querySelector<HTMLElement>("[data-media-inner]");
    if (inner) {
      gsap.fromTo(
        inner,
        { yPercent: -3.5 },
        {
          yPercent: 3.5,
          ease: "none",
          scrollTrigger: { trigger: slot, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    }
  });

  const hero = pick<HTMLElement>("[data-hero]")[0];
  const heroTitle = pick<HTMLElement>("[data-hero-title-box]")[0];
  if (hero && heroTitle) {
    gsap.to(heroTitle, {
      yPercent: -22,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
  }
}

/** Buttons lean toward the cursor and spring back. */
function magnetic(root: HTMLElement): Array<() => void> {
  const els = [
    ...root.querySelectorAll<HTMLElement>("[data-magnetic]"),
    ...document.querySelectorAll<HTMLElement>("[data-paper-header] [data-magnetic]"),
  ];
  return els.map((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.55, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  });
}

/** Stacked mode: play each clip only while its slot is on screen. */
function playVideosInView(root: HTMLElement) {
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("[data-media-video]"));
  const onPlaying = (e: Event) => {
    (e.currentTarget as HTMLVideoElement).dataset.playing = "true";
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.preload = "auto";
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    },
    { rootMargin: "160px 0px" },
  );
  for (const video of videos) {
    video.addEventListener("playing", onPlaying);
    io.observe(video);
  }
  return () => {
    io.disconnect();
    for (const video of videos) {
      video.removeEventListener("playing", onPlaying);
      video.pause();
    }
  };
}

function imageReady(img: HTMLImageElement | null, timeoutMs: number) {
  if (!img || img.complete) return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => img.addEventListener("load", () => resolve(), { once: true })),
    wait(timeoutMs),
  ]);
}
