"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { useFrameSequence } from "@/components/sequence/useFrameSequence";
import ScrollCue from "@/components/ui/ScrollCue";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import { SEQUENCES } from "@/lib/sequences";
import { chromeType } from "@/lib/typography";

const INTRO_END_S = 5.4;
const INTRO_MAX_MS = 16_000;

/** Video time at which the title card rises (when the baked one did). */
const TITLE_IN_S = 4.3;


const SUB_AT = 0.985;

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
      // Slow, soft entrance — the sequence has finished and is resting on
      // its settled frame, so the copy can take its time drifting in.
      gsap.fromTo(
        els,
        { autoAlpha: 0, y: 36 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.5,
          ease: "power3.out",
          stagger: 0.22,
        },
      );
    } else {
      gsap.to(els, { autoAlpha: 0, y: 16, duration: 0.4, ease: "power2.in" });
    }
  }, []);

  const seq = SEQUENCES.heroTitle;
  const { canvasRef, sectionRef, stickyRef, ready, scrollDistance } = useFrameSequence({
    framePath: seq.path,
    totalFrames: seq.frames,
    scrollPerFrame: seq.scrollPerFrame,
    fit: "cover",
    /* Tail: the settled frame — chair, room, landed title — rests, and the
       hero→craft hand-off bridge runs INSIDE this rest (0.435 × 5520 ≈
       2401px ≥ ChairShowcase's BRIDGE_SCROLL_PX of 2200 + margin).
       Widened 0.3→0.435 with scrollPerFrame 19→23 so the film's own pace
       is unchanged (~3120px of play vs ~3192 before) while the rest that
       funds the hand-off nearly doubles. */
    tailHold: 0.435,
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
      /* `isolate`: the hero's own z-10/20/30 children (titles, cue, skip)
         must never paint above the craft section's hand-off overlay, which
         stacks at z-10 in the root context. Height comes from the hook so
         reduced-motion collapses the scrub runway to one viewport. */
      className="isolate relative bg-ink"
      style={{ height: `calc(100dvh + ${scrollDistance}px)` }}
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
        data-hero-stage
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

        {/* "Let's furnish yours." — per the design key frame: Catilde Light
            at 140px full-scale (9.11vw of the 1536px design frame), centred
            over the settled chair, 0.05em tracking = the spec's 7px. */}
        <p
          ref={titleBRef}
          className="invisible absolute inset-x-0 top-[26%] z-10 whitespace-nowrap text-center opacity-0"
          style={{
            // Design spec: TAN PEARL 95px/400, ls 4.75px, #F4F2EC with a
            // 2px #FFF stroke, centred. The 95px is capped by a vw term so
            // the nowrap line can never outrun a narrow viewport, and by a
            // dvh term for the same short-viewport reason as the hero
            // title — at 1440×900 and up it resolves to the full 95px.
            color: "#F4F2EC",
            textAlign: "center",
            WebkitTextStrokeWidth: 2,
            WebkitTextStrokeColor: "#FFF",
            fontFamily: "var(--font-hero)",
            fontSize: "clamp(2.4rem, min(7vw, 14dvh), 95px)",
            fontStyle: "normal",
            fontWeight: 400,
            lineHeight: "normal",
            letterSpacing: "4.75px",
            textShadow: "0 4px 40px rgba(23,19,16,0.5)",
          }}
        >
          Let&apos;s furnish yours.
        </p>

        {/* Kicker line — sits well clear of the SocialRail rings in the
            corner below it, per the key frame's spacing. */}
        <div
          ref={subRef}
          className="invisible absolute bottom-[24%] left-[7%] z-10 opacity-0"
        >
          {/* Chapter 02 copy, per spec: Red Hat Display 30px/300, ls 3px,
              uppercase, #FFF. Line breaks are explicit (see below), so the
              box only needs to clear the longest of the three. */}
          <p
            className="max-w-[32rem]"
            style={{
              color: "#FFF",
              fontFamily: "var(--font-redhat)",
              fontSize: "30px",
              fontStyle: "normal",
              fontWeight: 300,
              lineHeight: "normal",
              letterSpacing: "3px",
              textTransform: "uppercase",
              textShadow: "0 2px 16px rgba(23,19,16,0.5)",
            }}
          >
            {/* Explicit breaks, not width-driven wrapping: the key frame
                sets these exact three lines, and a max-width would re-flow
                them at other viewport sizes. */}
            Crafted for the
            <br />
            moments you&apos;ll
            <br />
            remember.
          </p>
        </div>

        {/* "Every home has a story." — Catilde Light, sized to the key
            frame's FIXED 930×270 text box on its 1440×963 frame: widest
            line = 930/1440 = 64.6vw ⇒ 10.93vw type (Catilde runs
            5.91em/line incl. 0.05em tracking), 270px over two lines ⇒
            0.858 leading, top gap 238/963 = 24.7%. */}
        {/* User spec: TAN PEARL 120px / 400, #FFF with a 2px #FFF stroke,
            line-height normal (the tight 0.858 leading collided with
            Pearl's tall glyphs), letter-spacing 6px @120 = 0.05em. */}
        <h1
          ref={titleARef}
          className="invisible absolute inset-x-0 top-[24.7%] z-10 text-center opacity-0"
          style={{
            fontFamily: "var(--font-hero)",
            fontWeight: 400,
            // The 8.33vw spec is WIDTH-driven, but this card is anchored by
            // top-[24.7%] — a percentage of HEIGHT. On a short viewport
            // (e.g. 1536×730, a maximized window on a 1080p screen at 125%
            // scaling) the capped 120px type made the two-line box 112% of
            // the viewport — the "zoomed in" report. min(…,13dvh) lets height
            // win when height is the scarce axis; on 1440×900 and up the vw
            // term still governs, so the calibrated look is unchanged.
            fontSize: "clamp(3rem, min(8.33vw, 13dvh), 7.5rem)",
            fontStyle: "normal",
            lineHeight: "normal",
            letterSpacing: "0.05em",
            color: "#FFF",
            WebkitTextStrokeWidth: 2,
            WebkitTextStrokeColor: "#FFF",
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
            /* Same pill as the header's Shop Now, per the user. */
            className="absolute bottom-6 right-6 z-30 flex items-center rounded-full border border-[rgb(var(--chrome-border))]/50 bg-[rgb(var(--chrome-fg))]/10 px-5 py-2 backdrop-blur-sm transition-colors duration-300 hover:border-[rgb(var(--chrome-accent))]/60 hover:text-[rgb(var(--chrome-accent))] sm:px-6"
            style={chromeType(500)}
          >
            Skip intro
          </button>
        )}
      </div>
    </section>
  );
}
