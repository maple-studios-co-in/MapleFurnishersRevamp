"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { useFrameSequence } from "@/components/sequence/useFrameSequence";
import ScrollCue from "@/components/ui/ScrollCue";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import { SEQUENCES } from "@/lib/sequences";

/**
 * Where the film freezes — on the formed, sunlit room with the DOM title
 * card up and the scroll cue beneath it. The intro plays the clean
 * re-render (hero-intro-clean.mp4 — title-free, bars cropped out), and
 * "Every home has a story." is DOM text in Catilde Light, the same face
 * the footage's card was set in, timed to appear exactly when the baked
 * card used to. On the first scroll the canvas crossfades in and the
 * title lifts away — reversibly.
 */
const INTRO_END_S = 5.4;
const INTRO_MAX_MS = 16_000;

/** Video time at which the title card rises (when the baked one did). */
const TITLE_IN_S = 4.3;

/** Frame progress at which the chair has settled — "Let's furnish yours."
 *  plus the kicker line and social rings fade in over the film. */
const SUB_AT = 0.66;

/** Social profiles for the ring buttons under the kicker. The installed
 *  lucide-react no longer ships brand icons, so the paths are inlined in
 *  the same 24px stroke style. */
const SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/maplefurnishers",
    path: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/maplefurnishers",
    path: (
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    ),
  },
  {
    label: "Twitter",
    href: "https://x.com/maplefurnishers",
    path: (
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    ),
  },
] as const;

/** Dev-only sequencing trail (window.__mfIntroLog). */
function devLog(event: string, videoT?: number) {
  if (process.env.NODE_ENV === "production") return;
  type Log = { event: string; at: number; videoT?: number }[];
  const w = window as unknown as { __mfIntroLog?: Log };
  (w.__mfIntroLog ??= []).push({
    event,
    at: Math.round(performance.now()),
    videoT,
  });
}

/**
 * Chapter 01/02 — the film plays with scroll locked, freezes as its intro
 * title dissolves, then hands over to the scrubbed sequence in the same
 * pinned viewport: the chair assembles, the baked title lands, and the
 * room fades out around the constant chair into the chair chapter.
 */
export default function HeroFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const [introDone, setIntroDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const { stop, start } = useSmoothScroll();

  /**
   * The canvas stays hidden while the page rests on the frozen title card;
   * it crossfades in the moment scrubbing starts (and back out if the user
   * returns to the very top), so the title dissolve always happens in
   * motion, never as a static empty-room screen.
   */
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);

  /* ---- "Every home has a story." — DOM card over the clean intro ---- */
  const titleARef = useRef<HTMLHeadingElement>(null);
  const titleAOnRef = useRef(false);
  const showTitleA = useCallback(() => {
    if (titleAOnRef.current) return;
    titleAOnRef.current = true;
    const a = titleARef.current;
    if (a && !scrubbingRef.current) {
      gsap.fromTo(
        a,
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: 1.1, ease: "power3.out" },
      );
    }
  }, []);

  /* ---- title B + kicker + socials + canvas reveal, PAINTED-frame driven ---- */
  const titleBRef = useRef<HTMLParagraphElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const subOnRef = useRef(false);
  const handleProgress = useCallback((p: number) => {
    if (p > 0.004 && !scrubbingRef.current) {
      scrubbingRef.current = true;
      setScrubbing(true);
      const a = titleARef.current;
      if (a) {
        gsap.killTweensOf(a);
        gsap.to(a, { autoAlpha: 0, y: -46, duration: 0.55, ease: "power2.in" });
      }
    } else if (p <= 0.001 && scrubbingRef.current) {
      scrubbingRef.current = false;
      setScrubbing(false);
      const a = titleARef.current;
      if (a && titleAOnRef.current) {
        gsap.killTweensOf(a);
        gsap.to(a, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" });
      }
    }

    const els = [titleBRef.current, subRef.current].filter(
      Boolean,
    ) as HTMLElement[];
    if (!els.length) return;
    const show = p >= SUB_AT;
    if (show === subOnRef.current) return;
    subOnRef.current = show;
    gsap.killTweensOf(els);
    if (show) {
      gsap.fromTo(
        els,
        { autoAlpha: 0, y: 26 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.14,
        },
      );
    } else {
      gsap.to(els, { autoAlpha: 0, y: 16, duration: 0.4, ease: "power2.in" });
    }
  }, []);

  const seq = SEQUENCES.heroTitle;
  const { canvasRef, sectionRef, stickyRef, ready } = useFrameSequence({
    framePath: seq.path,
    totalFrames: seq.frames,
    scrollPerFrame: seq.scrollPerFrame,
    fit: "cover",
    /* Tail: the settled frame — chair, room, landed title — rests briefly,
       then the unpin pushes straight into the chair chapter. */
    tailHold: 0.22,
    onProgress: handleProgress,
  });

  const finishIntro = useCallback(() => {
    if (frozenRef.current) return;
    frozenRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const v = videoRef.current;
    if (v) {
      v.pause();
      try {
        if (Math.abs(v.currentTime - INTRO_END_S) > 0.05) {
          v.currentTime = INTRO_END_S;
        }
      } catch {
        // Seek before metadata — the poster underneath covers this.
      }
    }
    devLog("intro-frozen", v?.currentTime);
    // Covers the skip/timeout/error paths, where watch() never reaches it.
    showTitleA();
    setIntroDone(true);
  }, [showTitleA]);

  /* ---- scroll stays locked for the duration of the film ---- */
  useEffect(() => {
    if (introDone) {
      start();
      devLog("scroll-unlocked");
      return;
    }
    stop();
    devLog("scroll-locked");
  }, [introDone, stop, start]);

  const watch = useCallback(() => {
    const v = videoRef.current;
    if (!v || frozenRef.current) return;
    if (v.currentTime >= TITLE_IN_S) showTitleA();
    if (v.currentTime >= INTRO_END_S) finishIntro();
  }, [finishIntro, showTitleA]);

  useEffect(() => {
    const v = videoRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !v) {
      devLog("skip:reduced-motion");
      setSkipped(true);
      finishIntro();
      return;
    }
    timerRef.current = window.setTimeout(finishIntro, INTRO_MAX_MS);

    const hasRVFC = "requestVideoFrameCallback" in v;
    const loop = () => {
      if (frozenRef.current) return;
      watch();
      if (!frozenRef.current) v.requestVideoFrameCallback(loop);
    };

    v.play()
      .then(() => {
        devLog("video-playing", v.currentTime);
        if (hasRVFC) v.requestVideoFrameCallback(loop);
      })
      .catch(() => {
        devLog("skip:autoplay-blocked");
        setSkipped(true);
        finishIntro();
      });

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [finishIntro, watch]);

  const canvasVisible = introDone && ready && scrubbing;

  return (
    <section
      id="intro"
      ref={sectionRef}
      className="relative bg-ink"
      style={{ height: `calc(100dvh + ${seq.frames * seq.scrollPerFrame}px)` }}
    >
      {/* Chapter 02 anchor. Chapter 02 is the scrub itself — it begins with
          the very first scroll after the cue. The marker sits on the tall
          spacer — NOT inside the pinned viewport, whose children never
          move — and +50dvh aligns activation with the viewport-midpoint
          rule in useActiveSection. */}
      <div
        id="furnish"
        aria-hidden
        className="absolute left-0 h-px w-px"
        style={{
          top: `calc(${Math.round(seq.frames * seq.scrollPerFrame * 0.08)}px + 50dvh)`,
        }}
      />
      <div
        ref={stickyRef}
        className="relative h-[100dvh] w-full overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/video/hero-blueprint.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />

        {skipped ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${seq.path}/frame-001.webp`}
            alt="Sunlit interior with a slatted timber wall — Maple Furnishers"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src="/media/video/hero-intro-clean.mp4"
            muted
            playsInline
            preload="auto"
            onTimeUpdate={watch}
            onError={() => {
              devLog("skip:video-error");
              setSkipped(true);
              finishIntro();
            }}
          />
        )}

        <canvas
          ref={canvasRef}
          aria-hidden
          className={`absolute inset-0 block h-full w-full transition-opacity duration-300 ${
            canvasVisible ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* "Let's furnish yours." — per the design key frame: Catilde,
            spanning the stage from the left edge over the settled chair. */}
        <p
          ref={titleBRef}
          className="invisible absolute left-[7%] top-[26%] z-10 whitespace-nowrap leading-none text-cream opacity-0"
          style={{
            fontFamily: "var(--font-hero)",
            fontWeight: 400,
            fontSize: "clamp(3rem, 7.8vw, 9.5rem)",
            textShadow: "0 4px 40px rgba(23,19,16,0.5)",
          }}
        >
          Let&apos;s furnish yours.
        </p>

        {/* Kicker + social rings beneath the title. */}
        <div
          ref={subRef}
          className="invisible absolute bottom-[6%] left-[7%] z-10 opacity-0"
        >
          <p
            className="max-w-[26rem] font-ui text-[clamp(13px,1.05vw,19px)] font-medium uppercase leading-relaxed tracking-[0.22em] text-cream/85"
            style={{ textShadow: "0 2px 16px rgba(23,19,16,0.5)" }}
          >
            Crafted for the moments you&apos;ll remember.
          </p>
          <div className="pointer-events-auto mt-7 flex gap-4">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Maple Furnishers on ${s.label}`}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/40 text-cream/80 backdrop-blur-[2px] transition-colors duration-300 hover:border-cream hover:text-cream"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {s.path}
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* "Every home has a story." — Catilde Light, matching the film's
            original card in face, size and placement. */}
        <h1
          ref={titleARef}
          className="invisible absolute inset-x-0 top-[24%] z-10 text-center leading-[1.06] text-cream opacity-0"
          style={{
            fontFamily: "var(--font-hero)",
            fontWeight: 300,
            fontSize: "clamp(3.6rem, 9.8vw, 11.5rem)",
            letterSpacing: "0.005em",
            textShadow: "0 4px 40px rgba(23,19,16,0.35)",
          }}
        >
          Every home
          <br />
          has a story.
        </h1>

        <ScrollCue visible={introDone} />

        {!introDone && (
          <button
            type="button"
            onClick={finishIntro}
            className="absolute bottom-6 right-6 z-30 rounded-full border border-cream/40 px-4 py-1.5 font-ui text-[10px] uppercase tracking-[0.2em] text-cream/80 backdrop-blur-sm transition hover:border-cream hover:text-cream"
          >
            Skip intro
          </button>
        )}
      </div>
    </section>
  );
}
